import { Controller, Post, Get, Param, NotFoundException, UnprocessableEntityException, InternalServerErrorException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisRun } from '@testlens/db';
import {
  CoverageReportingService,
  CoverageReportNotFoundError,
  CoverageDataValidationError
} from '../common/context/coverage-reporting.service';
import {
  ExecutionReportingService,
  ExecutionReportNotFoundError,
  ExecutionDataValidationError
} from '../common/context/execution-reporting.service';

@Controller()
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly coverageReportingService: CoverageReportingService,
    private readonly executionReportingService: ExecutionReportingService
  ) {}

  @Get()
  public async getRoot() {
    return {
      status: 'ok',
      service: 'testlens-api',
      version: '1.0.0',
      message: 'TestLens API Gateway is active.'
    };
  }

  @Get('health')
  public async getHealth() {
    return {
      status: 'ok',
      service: 'testlens-api',
      version: '1.0.0'
    };
  }

  @Get('api/v1/health')
  public async getApiHealth() {
    return this.getHealth();
  }

  @Post('projects/:projectId/analyses')
  public async trigger(@Param('projectId') projectId: string): Promise<AnalysisRun> {
    return this.analysisService.triggerAnalysis(projectId);
  }

  @Get('analyses/:id')
  public async getStatus(@Param('id') id: string): Promise<AnalysisRun> {
    const run = await this.analysisService.getAnalysisStatus(id);
    if (!run) {
      throw new NotFoundException(`Analysis run with ID ${id} not found`);
    }
    return run;
  }

  @Get('projects/:projectId/analyses')
  public async getHistory(@Param('projectId') projectId: string): Promise<AnalysisRun[]> {
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

  @Get('api/analysis/:id/execution-report')
  public async getExecutionReport(@Param('id') id: string) {
    try {
      return await this.executionReportingService.getExecutionReport(id);
    } catch (error: any) {
      if (error instanceof ExecutionReportNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ExecutionDataValidationError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw new InternalServerErrorException(error.message || 'Unexpected internal reporting error');
    }
  }
}

