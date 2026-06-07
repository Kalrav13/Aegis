import { Controller, Post, Get, Param, NotFoundException, UnprocessableEntityException, InternalServerErrorException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import {
  CoverageReportingService,
  CoverageReportNotFoundError,
  CoverageDataValidationError
} from '../common/context/coverage-reporting.service';

@Controller()
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly coverageReportingService: CoverageReportingService
  ) {}

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

  @Get('api/analysis/:id/coverage-report')
  public async getCoverageReport(@Param('id') id: string) {
    try {
      return await this.coverageReportingService.generateReport(id);
    } catch (error: any) {
      if (error instanceof CoverageReportNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof CoverageDataValidationError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw new InternalServerErrorException(error.message || 'Unexpected internal reporting error');
    }
  }
}

