import { Test, TestingModule } from '@nestjs/testing';
import {
  CoverageReportingService,
  CoverageReportNotFoundError,
  CoverageDataValidationError
} from './coverage-reporting.service';
import { prisma } from '@testlens/db';

jest.mock('@testlens/db', () => ({
  prisma: {
    analysisRun: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    feature: {
      findMany: jest.fn()
    },
    scenario: {
      findMany: jest.fn()
    },
    testCase: {
      findMany: jest.fn()
    }
  }
}));

describe('CoverageReportingService', () => {
  let service: CoverageReportingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoverageReportingService]
    }).compile();

    service = module.get<CoverageReportingService>(CoverageReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockBaseRun = (classification = 'EXCELLENT', isReady = true, criticalGaps: string[] = []) => ({
    id: 'run-uuid-current',
    projectId: 'proj-1',
    completedAt: new Date('2026-06-07T12:00:00Z'),
    coverageQualityScorecard: {
      coverageIntelligenceReadiness: {
        ready: isReady,
        blockingReasons: []
      }
    },
    coverageReport: {
      reportId: 'rep-curr',
      featureCoverage: 80,
      scenarioCoverage: 90,
      testCaseCoverage: 85,
      automationCoverage: 85,
      executionReadinessScore: 90,
      coverageConfidenceScore: 90,
      coverageClassification: classification,
      coverageGapSummary: {
        uncoveredFeaturesCount: 0,
        uncoveredScenariosCount: 0,
        uncoveredTestCasesCount: 0,
        unautomatedTestCasesCount: 0
      },
      details: {
        uncoveredFeatureIds: [],
        uncoveredScenarioIds: [],
        unautomatedTestCaseIds: [],
        criticalCoverageGaps: criticalGaps
      },
      quality: {
        id: 'qual-1',
        reportId: 'rep-curr',
        traceabilityCompleteness: 100,
        coverageCompleteness: 85,
        automationCompleteness: 85,
        readinessQuality: 100,
        reportingQuality: 100
      }
    }
  });

  it('should compile and evaluate reporting dashboard payload successfully on standard EXCELLENT run', async () => {
    (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('EXCELLENT'));
    (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([]);

    const payload = await service.generateReport('run-uuid-current');

    expect(payload.payloadVersion).toBe('1.0.0');
    expect(payload.executiveSummary.overallCoverageScore).toBe(85);
    expect(payload.executiveSummary.recommendationSeverity).toBe('INFO');
  });

  describe('Trend Intelligence Review', () => {
    it('should calculate IMPROVING trend correctly', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('GOOD'));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);

      // Prior run was lower (70%)
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'run-prior',
          completedAt: new Date('2026-06-07T11:00:00Z'), // 1 hour ago
          coverageReport: {
            featureCoverage: 70,
            scenarioCoverage: 70,
            testCaseCoverage: 70,
            automationCoverage: 70,
            coverageConfidenceScore: 70
          }
        }
      ]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.trendReport.trendDirection.coverageTrend).toBe('IMPROVING');
      expect(payload.trendReport.trendDirection.automationTrend).toBe('IMPROVING');
      expect(payload.trendReport.trendDirection.confidenceTrend).toBe('IMPROVING');
    });

    it('should calculate DECLINING trend correctly', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('FAIR'));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);

      // Prior run was higher (95%)
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'run-prior',
          completedAt: new Date('2026-06-07T11:00:00Z'), // 1 hour ago
          coverageReport: {
            featureCoverage: 95,
            scenarioCoverage: 95,
            testCaseCoverage: 95,
            automationCoverage: 95,
            coverageConfidenceScore: 95
          }
        }
      ]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.trendReport.trendDirection.coverageTrend).toBe('DECLINING');
      expect(payload.trendReport.trendDirection.automationTrend).toBe('DECLINING');
      expect(payload.trendReport.trendDirection.confidenceTrend).toBe('DECLINING');
    });

    it('should calculate STABLE trend if changes are within 0.5% threshold', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('GOOD'));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);

      // Prior run has very close numbers (e.g. 84.8% overall vs 85% overall, delta is 0.2%)
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'run-prior',
          completedAt: new Date('2026-06-07T11:00:00Z'),
          coverageReport: {
            featureCoverage: 80,
            scenarioCoverage: 89.6, // overall avg = (80 + 89.6 + 85) / 3 = 84.87%
            testCaseCoverage: 85,
            automationCoverage: 84.8,
            coverageConfidenceScore: 89.8
          }
        }
      ]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.trendReport.trendDirection.coverageTrend).toBe('STABLE');
      expect(payload.trendReport.trendDirection.automationTrend).toBe('STABLE');
      expect(payload.trendReport.trendDirection.confidenceTrend).toBe('STABLE');
    });

    it('should default trend direction to STABLE when historical prior run is older than 30 days', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('GOOD'));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);

      // Prior run is dated 40 days prior
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'run-prior-stale',
          completedAt: new Date('2026-04-28T12:00:00Z'), // 40 days ago
          coverageReport: {
            featureCoverage: 50,
            scenarioCoverage: 50,
            testCaseCoverage: 50,
            automationCoverage: 50,
            coverageConfidenceScore: 50
          }
        }
      ]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.trendReport.trendDirection.coverageTrend).toBe('STABLE');
      expect(payload.trendReport.trendDirection.automationTrend).toBe('STABLE');
      expect(payload.trendReport.trendDirection.confidenceTrend).toBe('STABLE');
    });
  });

  describe('Severity Testing Review', () => {
    it('should classify GOOD or FAIR as WARNING severity', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('GOOD'));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.executiveSummary.recommendationSeverity).toBe('WARNING');
    });

    it('should classify POOR as CRITICAL severity', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('POOR'));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.executiveSummary.recommendationSeverity).toBe('CRITICAL');
    });

    it('should classify unready upstream blocks as CRITICAL severity', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('GOOD', false));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.executiveSummary.recommendationSeverity).toBe('CRITICAL');
    });

    it('should classify critical gaps as CRITICAL severity', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(mockBaseRun('GOOD', true, ['Checkout flow lacks validation']));
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.executiveSummary.recommendationSeverity).toBe('CRITICAL');
    });
  });

  describe('Reporting Quality Review', () => {
    it('should calculate reporting quality metrics dynamically', async () => {
      const runData = mockBaseRun('GOOD');
      runData.coverageReport.quality.coverageCompleteness = 99; // trigger deviation from overall coverage score (85)
      
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(runData);
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);

      // Mocks descending chronological order history to verify integrity score
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'run-prior-1',
          completedAt: new Date('2026-06-07T10:00:00Z'),
          coverageReport: { featureCoverage: 80, scenarioCoverage: 80, testCaseCoverage: 80 }
        },
        {
          id: 'run-prior-2',
          completedAt: new Date('2026-06-07T09:00:00Z'),
          coverageReport: { featureCoverage: 80, scenarioCoverage: 80, testCaseCoverage: 80 }
        }
      ]);

      const payload = await service.generateReport('run-uuid-current');
      
      expect(payload.reportingQuality.completenessScore).toBeGreaterThan(0);
      expect(payload.reportingQuality.consistencyScore).toBeLessThan(100); // 99 coverageCompleteness vs 85 overallCoverageScore
      expect(payload.reportingQuality.trendIntegrityScore).toBe(100); // Ordered correctly
      expect(payload.reportingQuality.reportingAccuracyScore).toBe(100);
    });

    it('should penalize trendIntegrityScore if history is out of chronological order', async () => {
      const runData = mockBaseRun('GOOD');
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(runData);
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);

      // Chronologically ascending (out of order for descending list)
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'run-prior-1',
          completedAt: new Date('2026-06-07T09:00:00Z'),
          coverageReport: { featureCoverage: 80, scenarioCoverage: 80, testCaseCoverage: 80 }
        },
        {
          id: 'run-prior-2',
          completedAt: new Date('2026-06-07T10:00:00Z'), // Out of order: 10:00 > 09:00
          coverageReport: { featureCoverage: 80, scenarioCoverage: 80, testCaseCoverage: 80 }
        }
      ]);

      const payload = await service.generateReport('run-uuid-current');
      expect(payload.reportingQuality.trendIntegrityScore).toBeLessThan(100);
    });
  });

  describe('Domain Exceptions Review', () => {
    it('should throw CoverageReportNotFoundError when AnalysisRun is missing', async () => {
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.generateReport('missing-run')).rejects.toThrow(CoverageReportNotFoundError);
    });

    it('should throw CoverageReportNotFoundError when CoverageReport is missing', async () => {
      const runData = mockBaseRun('GOOD');
      (runData as any).coverageReport = null;
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(runData);

      await expect(service.generateReport('run-uuid-current')).rejects.toThrow(CoverageReportNotFoundError);
    });

    it('should throw CoverageReportNotFoundError when CoverageQuality is missing', async () => {
      const runData = mockBaseRun('GOOD');
      (runData.coverageReport as any).quality = null;
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(runData);

      await expect(service.generateReport('run-uuid-current')).rejects.toThrow(CoverageReportNotFoundError);
    });

    it('should throw CoverageDataValidationError when schema properties are malformed', async () => {
      const runData = mockBaseRun('GOOD');
      // Set featureCoverage out of bounds to trigger Zod validation error
      runData.coverageReport.featureCoverage = 150;
      (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue(runData);
      (prisma.feature.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.scenario.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.testCase.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.analysisRun.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.generateReport('run-uuid-current')).rejects.toThrow(CoverageDataValidationError);
    });
  });
});
