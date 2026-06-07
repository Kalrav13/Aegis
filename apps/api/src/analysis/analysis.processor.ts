import { Injectable } from '@nestjs/common';
import { prisma } from '@testlens/db';
import { GitService } from '../common/git/git.service';
import { StorageManager } from '../common/storage/storage.manager';
import { FilterService } from '../common/filter/filter.service';
import { ManifestService } from '../common/manifest/manifest.service';
import { RegistryService } from '../common/registry/registry.service';
import { ContextBuilderService } from '../common/context/context-builder.service';
import { QualityEvaluatorService } from '../common/context/quality-evaluator.service';
import { UnderstandingAgentService } from '../common/understanding/understanding-agent.service';

@Injectable()
export class AnalysisProcessor {
  private readonly MAX_SIZE_BYTES = 52428800; // 50MB limit

  constructor(
    private readonly gitService: GitService,
    private readonly storageManager: StorageManager,
    private readonly filterService: FilterService,
    private readonly manifestService: ManifestService,
    private readonly registryService: RegistryService,
    private readonly contextBuilderService: ContextBuilderService,
    private readonly understandingAgentService: UnderstandingAgentService,
    private readonly qualityEvaluatorService: QualityEvaluatorService
  ) {}

  /**
   * Asynchronously clones the repository, filters it, compiles the intelligence manifest, and updates database records.
   */
  public async executeClone(
    analysisId: string,
    repoUrl: string,
    branch: string,
    token?: string
  ): Promise<void> {
    const run = await prisma.analysisRun.findUnique({ where: { id: analysisId } });
    if (!run) return;

    const targetPath = this.storageManager.getRepoPath(run.projectId, analysisId);

    try {
      // 1. Asynchronously clone target repository
      const commitSha = await this.gitService.clone(repoUrl, targetPath, token);
      
      // 2. Calculate local cloned directory size
      const totalSizeBytes = await this.storageManager.calculateDirectorySize(targetPath);

      // 3. Enforce size safeguards
      if (totalSizeBytes > this.MAX_SIZE_BYTES) {
        throw new Error(`Repository size of ${totalSizeBytes} bytes exceeds 50MB limit`);
      }

      // 4. Update status to FILTERING
      await prisma.analysisRun.update({
        where: { id: analysisId },
        data: { status: 'FILTERING' }
      });

      // 5. Execute Repository Filtering Layer
      const filteredManifest = await this.filterService.filterRepository(targetPath);

      // 6. Verify filtered source file count
      if (filteredManifest.repository_statistics.total_filtered_files === 0) {
        throw new Error('No whitelisted source files found in repository');
      }

      // 7. Execute Repository Intelligence Manifest Generator
      const intelligenceManifest = await this.manifestService.generateManifest(filteredManifest, commitSha);

      // 8. Execute Repository Interaction Element Registry
      const interactionRegistry = await this.registryService.generateRegistry(targetPath, filteredManifest);

      // 9. Execute AI-ready Context Builder
      const aiReadyContext = this.contextBuilderService.buildContext(intelligenceManifest, interactionRegistry);

      // 10. Execute Repository Understanding Agent
      const repositoryUnderstanding = await this.understandingAgentService.analyzeRepository(aiReadyContext);

      // 11. Execute Repository Understanding Quality Evaluator
      const qualityScorecard = await this.qualityEvaluatorService.evaluate(aiReadyContext, repositoryUnderstanding);

      // 12. Update status to COMPLETED and save all payloads
      await prisma.analysisRun.update({
        where: { id: analysisId },
        data: {
          status: 'COMPLETED',
          commitSha,
          completedAt: new Date(),
          repositoryStatistics: intelligenceManifest as any, // Stores complete IntelligenceManifest JSON
          interactionRegistry: interactionRegistry as any, // Stores complete InteractionRegistry JSON
          aiReadyContext: aiReadyContext as any, // Stores complete AiReadyContext JSON
          repositoryUnderstanding: repositoryUnderstanding as any, // Stores complete RepositoryUnderstanding JSON
          qualityScorecard: qualityScorecard as any // Stores complete QualityScorecard JSON
        }
      });
      
      console.log(`Successfully completed intelligence manifest run ${analysisId}. Found ${intelligenceManifest.route_candidates.length} routes.`);
    } catch (error: any) {
      console.error(`Cloning/Filtering/Ingestion run ${analysisId} failed:`, error.message);

      // Clean local workspace directories immediately on failure
      await this.storageManager.deleteDirectory(targetPath);

      // Update database status to FAILED
      await prisma.analysisRun.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Task execution failed',
          completedAt: new Date()
        }
      });
    }
  }
}
