import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import {
  CoverageReportingService,
  CoverageReportNotFoundError,
  CoverageDataValidationError
} from '../common/context/coverage-reporting.service';
import {
  ExecutionReportingService
} from '../common/context/execution-reporting.service';
import { NotFoundException, UnprocessableEntityException, InternalServerErrorException } from '@nestjs/common';

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let reportingService: CoverageReportingService;

  const mockAnalysisService = {
    triggerAnalysis: jest.fn(),
    getAnalysisStatus: jest.fn(),
    getProjectHistory: jest.fn()
  };

  const mockReportingService = {
    generateReport: jest.fn()
  };

  const mockExecutionService = {
    getExecutionReport: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: mockAnalysisService
        },
        {
          provide: CoverageReportingService,
          useValue: mockReportingService
        },
        {
          provide: ExecutionReportingService,
          useValue: mockExecutionService
        }
      ]
    }).compile();

    controller = module.get<AnalysisController>(AnalysisController);
    reportingService = module.get<CoverageReportingService>(CoverageReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analysis/:id/coverage-report', () => {
    it('should return 200 and the payload when generated successfully', async () => {
      const mockPayload = {
        payloadVersion: '1.0.0',
        executiveSummary: {
          overallCoverageScore: 85,
          coverageClassification: 'EXCELLENT',
          coverageConfidenceScore: 90,
          topStrengths: [],
          topRisks: [],
          recommendation: 'Release ready.',
          recommendationSeverity: 'INFO'
        },
        coverageOverview: {
          featureCoverage: 80,
          scenarioCoverage: 90,
          testCaseCoverage: 85,
          automationCoverage: 85,
          executionReadinessScore: 90,
          coverageConfidenceScore: 90
        },
        gapReport: {
          criticalGaps: [],
          highPriorityGaps: [],
          mediumPriorityGaps: [],
          lowPriorityGaps: []
        },
        trendReport: {
          trendDirection: {
            coverageTrend: 'STABLE',
            automationTrend: 'STABLE',
            confidenceTrend: 'STABLE'
          },
          history: []
        },
        reportingQuality: {
          completenessScore: 100,
          consistencyScore: 100,
          trendIntegrityScore: 100,
          reportingAccuracyScore: 100
        },
        reportingReadiness: {
          ready: true,
          blockingReasons: []
        }
      };

      mockReportingService.generateReport.mockResolvedValue(mockPayload);

      const result = await controller.getCoverageReport('run-123');
      expect(result).toEqual(mockPayload);
      expect(reportingService.generateReport).toHaveBeenCalledWith('run-123');
    });

    it('should map CoverageReportNotFoundError to NotFoundException (404)', async () => {
      mockReportingService.generateReport.mockRejectedValue(
        new CoverageReportNotFoundError('Analysis run not found')
      );

      await expect(controller.getCoverageReport('missing-run')).rejects.toThrow(NotFoundException);
    });

    it('should map CoverageDataValidationError to UnprocessableEntityException (422)', async () => {
      mockReportingService.generateReport.mockRejectedValue(
        new CoverageDataValidationError('Invalid schema fields')
      );

      await expect(controller.getCoverageReport('invalid-run')).rejects.toThrow(UnprocessableEntityException);
    });

    it('should map unhandled exceptions to InternalServerErrorException (500)', async () => {
      mockReportingService.generateReport.mockRejectedValue(
        new Error('Database crash')
      );

      await expect(controller.getCoverageReport('crash-run')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
