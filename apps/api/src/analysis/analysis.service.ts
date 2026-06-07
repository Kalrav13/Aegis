import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, AnalysisRun } from '@testlens/db';
import { AnalysisProcessor } from './analysis.processor';

@Injectable()
export class AnalysisService {
  constructor(private readonly processor: AnalysisProcessor) {}

  /**
   * Initializes a cloning analysis run in the database and triggers async task.
   */
  public async triggerAnalysis(projectId: string): Promise<AnalysisRun> {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const run = await prisma.analysisRun.create({
      data: {
        projectId,
        status: 'CLONING',
        commitSha: 'pending'
      }
    });

    // Trigger asynchronous execution loop (bypassing route thread timeouts)
    this.processor.executeClone(run.id, project.repoUrl, project.branch, project.authTokenEncrypted || undefined)
      .catch((error) => console.error(`Asynchronous clone background runner failed for run ${run.id}:`, error));

    return run;
  }

  /**
   * Retrieves current analysis status run details.
   */
  public async getAnalysisStatus(id: string): Promise<AnalysisRun | null> {
    return prisma.analysisRun.findUnique({
      where: { id }
    });
  }

  /**
   * Lists all analysis runs history.
   */
  public async getProjectHistory(projectId: string): Promise<AnalysisRun[]> {
    return prisma.analysisRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' }
    });
  }
}
