import { Injectable } from '@nestjs/common';
import { prisma } from '@testlens/db';
import { GitService } from '../common/git/git.service';
import { StorageManager } from '../common/storage/storage.manager';
import { FilterService } from '../common/filter/filter.service';
import { ManifestService } from '../common/manifest/manifest.service';
import { RegistryService } from '../common/registry/registry.service';
import { ContextBuilderService } from '../common/context/context-builder.service';
import { DiscoveryContextBuilderService } from '../common/context/discovery-context-builder.service';
import { FeatureDiscoveryAgentService } from '../common/context/feature-discovery-agent.service';
import { QualityEvaluatorService } from '../common/context/quality-evaluator.service';
import { FeatureQualityEvaluatorService } from '../common/context/feature-quality-evaluator.service';
import { ScenarioDiscoveryContextBuilderService } from '../common/context/scenario-discovery-context-builder.service';
import { ScenarioDiscoveryAgentService } from '../common/context/scenario-discovery-agent.service';
import { ScenarioQualityEvaluatorService } from '../common/context/scenario-quality-evaluator.service';
import { TestCaseDiscoveryContextBuilderService } from '../common/context/test-case-discovery-context-builder.service';
import { TestCaseDiscoveryAgentService } from '../common/context/test-case-discovery-agent.service';
import { TestCaseQualityEvaluatorService } from '../common/context/test-case-quality-evaluator.service';
import { AutomationDiscoveryContextBuilderService } from '../common/context/automation-discovery-context-builder.service';
import { AutomationGenerationAgentService } from '../common/context/automation-generation-agent.service';
import { AutomationQualityEvaluatorService } from '../common/context/automation-quality-evaluator.service';
import { UnderstandingAgentService } from '../common/understanding/understanding-agent.service';

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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
    private readonly qualityEvaluatorService: QualityEvaluatorService,
    private readonly discoveryContextBuilderService: DiscoveryContextBuilderService,
    private readonly featureDiscoveryAgentService: FeatureDiscoveryAgentService,
    private readonly featureQualityEvaluatorService: FeatureQualityEvaluatorService,
    private readonly scenarioDiscoveryContextBuilderService: ScenarioDiscoveryContextBuilderService,
    private readonly scenarioDiscoveryAgentService: ScenarioDiscoveryAgentService,
    private readonly scenarioQualityEvaluatorService: ScenarioQualityEvaluatorService,
    private readonly testCaseDiscoveryContextBuilderService: TestCaseDiscoveryContextBuilderService,
    private readonly testCaseDiscoveryAgentService: TestCaseDiscoveryAgentService,
    private readonly testCaseQualityEvaluatorService: TestCaseQualityEvaluatorService,
    private readonly automationDiscoveryContextBuilderService: AutomationDiscoveryContextBuilderService,
    private readonly automationGenerationAgentService: AutomationGenerationAgentService,
    private readonly automationQualityEvaluatorService: AutomationQualityEvaluatorService
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

      // 12. Execute Feature Discovery Context Builder
      const discoveryContext = this.discoveryContextBuilderService.buildDiscoveryContext(
        repositoryUnderstanding,
        aiReadyContext,
        qualityScorecard,
        intelligenceManifest
      );

      // 13. Execute Feature Discovery Agent
      let rawFeatures: any[] = [];
      if (discoveryContext.discoveryReadiness.ready) {
        rawFeatures = await this.featureDiscoveryAgentService.discoverFeatures(discoveryContext);
      }

      // Assign UUIDs to features in memory
      const features = rawFeatures.map(f => ({
        id: randomUUID(),
        featureName: f.featureName,
        featureType: f.featureType,
        description: f.description,
        confidenceScore: f.confidenceScore,
        evidence: f.evidence,
        sourceWorkflows: f.sourceWorkflows,
        riskLevel: f.riskLevel
      }));

      // 14. Execute Feature Quality Evaluator
      let featureQualityScorecard: any = null;
      let evaluatedFeatures = features.map(f => ({
        ...f,
        qualityScore: 100,
        completenessScore: 100,
        evidenceCoverageScore: 100,
        workflowCoverageScore: 100,
        confidenceReliabilityScore: 100,
        riskClassificationScore: 100,
        qualityWarnings: []
      }));

      if (features.length > 0) {
        featureQualityScorecard = await this.featureQualityEvaluatorService.evaluate(features, discoveryContext);
        const scoresMap = new Map<string, any>(
          featureQualityScorecard.featuresEvaluations.map((e: any) => [e.featureId, e])
        );
        evaluatedFeatures = features.map(f => {
          const score = scoresMap.get(f.id);
          return {
            ...f,
            qualityScore: score?.qualityScore ?? 100,
            completenessScore: score?.completenessScore ?? 100,
            evidenceCoverageScore: score?.evidenceCoverageScore ?? 100,
            workflowCoverageScore: score?.workflowCoverageScore ?? 100,
            confidenceReliabilityScore: score?.confidenceReliabilityScore ?? 100,
            riskClassificationScore: score?.riskClassificationScore ?? 100,
            qualityWarnings: score?.warnings ?? []
          };
        });
      }

      // 15. Execute Scenario Discovery Context Builder
      let scenarioDiscoveryContext: any = null;
      if (evaluatedFeatures.length > 0) {
        scenarioDiscoveryContext = this.scenarioDiscoveryContextBuilderService.buildScenarioDiscoveryContext(
          evaluatedFeatures,
          discoveryContext
        );
      }

      // 15b. Execute Scenario Discovery Agent
      let discoveredScenarios: any[] = [];
      if (scenarioDiscoveryContext && scenarioDiscoveryContext.scenarioReadiness.ready) {
        discoveredScenarios = await this.scenarioDiscoveryAgentService.discoverScenarios(scenarioDiscoveryContext);
      }

      // 15c. Execute Scenario Quality Evaluator
      let scenarioQualityScorecard: any = null;
      if (discoveredScenarios.length > 0 && scenarioDiscoveryContext) {
        scenarioQualityScorecard = await this.scenarioQualityEvaluatorService.evaluate(
          discoveredScenarios,
          scenarioDiscoveryContext
        );
      }

      // 15d. Execute Test Case Discovery Context Builder
      let testCaseDiscoveryContext: any = null;
      if (scenarioDiscoveryContext) {
        const candidateAssets = {
          routes: scenarioDiscoveryContext.candidateAssets?.routes || [],
          apis: scenarioDiscoveryContext.candidateAssets?.apis || [],
          forms: scenarioDiscoveryContext.candidateAssets?.forms || []
        };

        const scoresMap = new Map<string, any>(
          (scenarioQualityScorecard?.scenariosEvaluations || []).map((e: any) => [e.scenarioId, e])
        );

        const scenariosWithScores = discoveredScenarios.map(s => {
          const score = scoresMap.get(s.scenarioId);
          return {
            ...s,
            id: s.scenarioId,
            qualityScore: score?.qualityScore ?? null
          };
        });

        testCaseDiscoveryContext = this.testCaseDiscoveryContextBuilderService.buildContext(
          scenariosWithScores,
          scenarioQualityScorecard,
          candidateAssets
        );
      }

      // 15e. Execute Test Case Discovery Agent
      let discoveredTestCases: any[] = [];
      let testCaseGenerationReadiness: any = null;
      if (testCaseDiscoveryContext && testCaseDiscoveryContext.testCaseReadiness.ready) {
        const agentResult = await this.testCaseDiscoveryAgentService.discoverTestCases(testCaseDiscoveryContext);
        discoveredTestCases = agentResult.testCases;
        testCaseGenerationReadiness = agentResult.readiness;
      }

      // 15f. Execute Test Case Quality Evaluator
      let testCaseQualityScorecard: any = null;
      if (testCaseDiscoveryContext) {
        testCaseQualityScorecard = await this.testCaseQualityEvaluatorService.evaluate(
          discoveredTestCases,
          testCaseDiscoveryContext
        );
      }

      // 15g. Execute Automation Discovery Context Builder
      let automationDiscoveryContext: any = null;
      if (testCaseDiscoveryContext) {
        automationDiscoveryContext = this.automationDiscoveryContextBuilderService.buildContext(
          discoveredTestCases,
          testCaseQualityScorecard,
          interactionRegistry as any
        );
      }

      // 15h. Execute Automation Generation Agent
      let automationOutput: any = null;
      if (automationDiscoveryContext && automationDiscoveryContext.automationGenerationReadiness.ready) {
        automationOutput = await this.automationGenerationAgentService.generateAutomation(
          automationDiscoveryContext,
          evaluatedFeatures,
          testCaseQualityScorecard
        );
      }

      // 15i. Execute Automation Quality Evaluator Service
      let automationEvaluation: any = null;
      if (automationOutput && automationOutput.scripts.length > 0) {
        automationEvaluation = await this.automationQualityEvaluatorService.evaluateAutomation(
          automationOutput.scripts,
          automationDiscoveryContext
        );
      }

      // 16. Save features and update status to COMPLETED
      await prisma.$transaction(async (tx) => {
        // Get quality evaluation scorecard if available
        let scorecardData: any = null;
        if (automationEvaluation) {
          scorecardData = automationEvaluation.scorecard;
        }

        // Save Discovery Context & metadata
        await tx.analysisRun.update({
          where: { id: analysisId },
          data: {
            status: 'COMPLETED',
            commitSha,
            completedAt: new Date(),
            repositoryStatistics: intelligenceManifest as any,
            interactionRegistry: interactionRegistry as any,
            aiReadyContext: aiReadyContext as any,
            repositoryUnderstanding: repositoryUnderstanding as any,
            qualityScorecard: qualityScorecard as any,
            discoveryContext: discoveryContext as any,
            featureQualityScorecard: featureQualityScorecard as any,
            scenarioDiscoveryContext: scenarioDiscoveryContext as any,
            scenarioQualityScorecard: scenarioQualityScorecard as any,
            testCaseDiscoveryContext: testCaseDiscoveryContext as any,
            testCaseQualityScorecard: testCaseQualityScorecard as any,
            automationDiscoveryContext: automationDiscoveryContext as any,
            automationQualityScorecard: scorecardData as any
          }
        });


        // Insert relational discovered features
        if (evaluatedFeatures.length > 0) {
          await tx.feature.createMany({
            data: evaluatedFeatures.map(f => ({
              id: f.id,
              analysisRunId: analysisId,
              featureName: f.featureName,
              featureType: f.featureType,
              description: f.description,
              confidenceScore: f.confidenceScore,
              evidence: f.evidence,
              sourceWorkflows: f.sourceWorkflows,
              riskLevel: f.riskLevel,
              qualityScore: f.qualityScore,
              completenessScore: f.completenessScore,
              evidenceCoverageScore: f.evidenceCoverageScore,
              workflowCoverageScore: f.workflowCoverageScore,
              confidenceReliabilityScore: f.confidenceReliabilityScore,
              riskClassificationScore: f.riskClassificationScore,
              qualityWarnings: f.qualityWarnings
            }))
          });
        }

        // Insert relational discovered scenarios
        if (discoveredScenarios.length > 0) {
          const scoresMap = new Map<string, any>(
            (scenarioQualityScorecard?.scenariosEvaluations || []).map((e: any) => [e.scenarioId, e])
          );

          for (const s of discoveredScenarios) {
            const score = scoresMap.get(s.scenarioId);

            await tx.scenario.create({
              data: {
                id: s.scenarioId,
                scenarioName: s.scenarioName,
                scenarioType: s.scenarioType,
                priority: s.priority,
                description: s.description,
                confidenceScore: s.confidenceScore,
                riskLevel: s.riskLevel,
                evidence: s.evidence,
                sourceWorkflows: s.sourceWorkflows,
                coverageTargets: s.coverageTargets,
                scenarioOrigin: s.scenarioOrigin,
                qualityScore: score?.qualityScore ?? null,
                completenessScore: score?.completenessScore ?? null,
                evidenceCoverageScore: score?.evidenceCoverageScore ?? null,
                workflowCoverageScore: score?.workflowCoverageScore ?? null,
                priorityValidityScore: score?.priorityValidityScore ?? null,
                riskClassificationScore: score?.riskClassificationScore ?? null,
                traceabilityQualityScore: score?.traceabilityQualityScore ?? null,
                coverageTargetScore: score?.coverageTargetScore ?? null,
                confidenceReliabilityScore: score?.confidenceReliabilityScore ?? null,
                qualityWarnings: score?.warnings ? (score.warnings as any) : null,
                features: {
                  connect: s.scenarioOrigin.featureIds.map((id: string) => ({ id }))
                }
              }
            });
          }
        }

        // Insert relational discovered test cases
        if (discoveredTestCases.length > 0) {
          for (const tc of discoveredTestCases) {
            await tx.testCase.create({
              data: {
                id: tc.testCaseId,
                testCaseKey: tc.testCaseKey,
                testCaseName: tc.testCaseName,
                testCaseType: tc.testCaseType,
                priority: tc.priority,
                description: tc.description,
                preconditions: tc.preconditions,
                steps: tc.steps,
                expectedResult: tc.expectedResult,
                evidence: tc.evidence,
                riskLevel: tc.riskLevel,
                coverageTargets: tc.coverageTargets,
                testCaseOrigin: tc.testCaseOrigin,
                contractVersion: tc.contractVersion,
                automationStatus: tc.automationStatus,
                automationPath: tc.automationPath,
                scenarios: {
                  connect: tc.testCaseOrigin.scenarioIds.map((id: string) => ({ id }))
                }
              }
            });
          }
        }

        // Insert relational discovered test case quality records
        if (testCaseQualityScorecard && testCaseQualityScorecard.testCasesEvaluations && testCaseQualityScorecard.testCasesEvaluations.length > 0) {
          await tx.testCaseQuality.createMany({
            data: testCaseQualityScorecard.testCasesEvaluations.map((e: any) => ({
              testCaseId: e.testCaseId,
              qualityScore: e.qualityScore,
              completenessScore: e.completenessScore,
              groundingScore: e.groundingScore,
              traceabilityScore: e.traceabilityScore,
              stepStructureScore: e.stepStructureScore,
              warnings: e.warnings as any
            }))
          });
        }

        // Save Automation Scripts and Quality records
        if (automationOutput && automationOutput.scripts.length > 0) {
          const evalMap = new Map<string, any>(
            (automationEvaluation?.evaluations || []).map((e: any) => [e.scriptId, e])
          );

          for (const script of automationOutput.scripts) {
            await tx.automationScript.create({
              data: {
                id: script.scriptId,
                testCaseId: script.testCaseId,
                filePath: script.filePath,
                codeContent: script.codeContent,
                framework: script.framework,
                confidenceScore: script.confidenceScore,
                automationOrigin: script.automationOrigin as any,
                contractVersion: script.contractVersion
              }
            });

            const ev = evalMap.get(script.scriptId);
            await tx.automationQuality.create({
              data: {
                id: ev?.id || randomUUID(),
                scriptId: script.scriptId,
                qualityScore: ev?.qualityScore ?? 100,
                syntaxScore: ev?.syntaxScore ?? 100,
                complianceScore: ev?.complianceScore ?? 100,
                maintainabilityScore: ev?.maintainabilityScore ?? 100,
                groundingScore: ev?.groundingScore ?? 100,
                traceabilityScore: ev?.traceabilityScore ?? 100,
                crossFileIntegrityScore: ev?.crossFileIntegrityScore ?? 100,
                warnings: ev?.warnings ? (ev.warnings as any) : []
              }
            });

            // Update TestCase automation status
            await tx.testCase.update({
              where: { id: script.testCaseId },
              data: {
                automationStatus: 'AUTOMATED',
                automationPath: script.filePath
              }
            });
          }
        }
      });

      // 17. PHYSICAL FILE GENERATION - Write files ONLY AFTER successful transaction commit
      if (automationOutput && automationOutput.scripts.length > 0) {
        for (const script of automationOutput.scripts) {
          // Write spec file
          const fullSpecPath = path.join(targetPath, script.filePath);
          const specDir = path.dirname(fullSpecPath);
          if (!fs.existsSync(specDir)) {
            fs.mkdirSync(specDir, { recursive: true });
          }
          fs.writeFileSync(fullSpecPath, script.codeContent, 'utf8');

          // Write page object file
          if (script.pageObjectFilePath && script.pageObjectCode) {
            const fullPagePath = path.join(targetPath, script.pageObjectFilePath);
            const pageDir = path.dirname(fullPagePath);
            if (!fs.existsSync(pageDir)) {
              fs.mkdirSync(pageDir, { recursive: true });
            }
            fs.writeFileSync(fullPagePath, script.pageObjectCode, 'utf8');
          }
        }
      }

      
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
