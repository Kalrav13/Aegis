import { Controller, Post, Get, Param, NotFoundException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller()
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('projects/:projectId/analyses')
  public async trigger(@Param('projectId') projectId: string) {
    return this.analysisService.triggerAnalysis(projectId);
  }

  @Get('analyses/:id')
  public async getStatus(@Param('id') id: string) {
    const run = await this.analysisService.getAnalysisStatus(id);
    if (!run) {
      throw new NotFoundException(`Analysis run with ID ${id} not found`);
    }
    return run;
  }

  @Get('projects/:projectId/analyses')
  public async getHistory(@Param('projectId') projectId: string) {
    return this.analysisService.getProjectHistory(projectId);
  }
}
