import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionReportingService } from './execution-reporting.service';
import {
  validateExecutionDashboardPayload,
  validateExecutionReportingQuality
} from '@testlens/contracts';

describe('ExecutionReportingService', () => {
  let service: ExecutionReportingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExecutionReportingService]
    }).compile();

    service = module.get<ExecutionReportingService>(ExecutionReportingService);
  });

  it('should generate execution reporting dashboard payload successfully', () => {
    const mockRun = {
      id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a81',
      analysisRunId: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a82',
      executionEnvironment: 'staging',
      browser: 'Chromium',
      operatingSystem: 'Linux',
      frameworkVersion: 'Playwright v1.40.0',
      executionSource: 'GITHUB_ACTIONS' as const,
      externalExecutionId: 'run-123',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalTests: 4,
      passedTests: 3,
      failedTests: 1,
      skippedTests: 0,
      blockedTests: 0,
      timedOutTests: 0,
      durationMs: 400
    };

    const mockScorecard = {
      version: '1.0.0' as const,
      passRate: 75,
      failRate: 25,
      skippedRate: 0,
      blockedRate: 0,
      timeoutRate: 0,
      executionConfidenceScore: 80,
      executionReadiness: {
        ready: false,
        blockingReasons: ['Pass rate 75% is below the 95% threshold.']
      },
      builderMetadata: {
        generatedAt: new Date().toISOString(),
        analysisRunId: mockRun.analysisRunId,
        flakyRate: 10,
        retryRate: 0,
        artifactAvailability: 100,
        sourceAnalytics: [
          {
            executionSource: 'GITHUB_ACTIONS',
            averagePassRate: 85,
            flakyRate: 5,
            averageDurationMs: 120,
            sampleCount: 2
          }
        ]
      }
    };

    const mockQuality = {
      id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a83',
      executionRunId: mockRun.id,
      passRateScore: 75,
      flakyScore: 90,
      retryStabilityScore: 100,
      durationReliabilityScore: 95,
      artifactCompletenessScore: 100
    };

    const mockResults = [
      {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a84',
        status: 'PASSED',
        durationMs: 100,
        retryCount: 0
      },
      {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a85',
        status: 'PASSED',
        durationMs: 100,
        retryCount: 0
      },
      {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a86',
        status: 'PASSED',
        durationMs: 100,
        retryCount: 0
      },
      {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a87',
        status: 'FAILED',
        durationMs: 100,
        retryCount: 0,
        failureSeverity: 'HIGH',
        failureCategory: 'ASSERTION',
        failureReason: 'expected true to be false',
        artifacts: [
          {
            id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a88',
            artifactType: 'SCREENSHOT',
            path: 'screens/fail.png',
            createdAt: new Date().toISOString()
          }
        ]
      }
    ];

    const { payload, reportingQuality } = service.generateDashboardPayload(
      mockRun.analysisRunId,
      mockRun,
      mockScorecard,
      mockQuality,
      mockResults,
      []
    );

    // Verify reporting payload complies with contracts
    expect(validateExecutionDashboardPayload(payload)).toBeDefined();
    expect(validateExecutionReportingQuality(reportingQuality)).toBeDefined();

    // Verify executive summaries
    expect(payload.executiveSummary.overallExecutionScore).toBe(77); // 0.60 * 75 + 0.40 * 80 = 45 + 32 = 77
    expect(payload.executiveSummary.executionClassification).toBe('FAIR');
    expect(payload.executiveSummary.releaseReady).toBe(false);

    // Verify deep links
    expect(payload.failuresReport.highFailures[0].ciDeepLink).toBe('https://github.com/company/repo/actions/runs/run-123');
  });

  describe('30-Day Stale Trend Guard', () => {
    it('should ignore historical execution runs completed more than 30 days ago', () => {
      const mockRun = {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a81',
        analysisRunId: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a82',
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        skippedTests: 0,
        blockedTests: 0,
        timedOutTests: 0,
        durationMs: 100
      };

      const mockScorecard = {
        version: '1.0.0' as const,
        passRate: 100,
        failRate: 0,
        skippedRate: 0,
        blockedRate: 0,
        timeoutRate: 0,
        executionConfidenceScore: 100,
        executionReadiness: { ready: true, blockingReasons: [] }
      };

      const mockQuality = {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a83',
        executionRunId: mockRun.id,
        passRateScore: 100,
        flakyScore: 100,
        retryStabilityScore: 100,
        durationReliabilityScore: 100,
        artifactCompletenessScore: 100
      };

      const date45DaysAgo = new Date();
      date45DaysAgo.setDate(date45DaysAgo.getDate() - 45);

      const date10DaysAgo = new Date();
      date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);

      const historyRuns = [
        {
          id: 'h1',
          startedAt: date10DaysAgo,
          completedAt: date10DaysAgo,
          totalTests: 10,
          passedTests: 9,
          failedTests: 1,
          executionScorecard: { executionConfidenceScore: 90, executionReadiness: { ready: true } }
        },
        {
          id: 'h2',
          startedAt: date45DaysAgo,
          completedAt: date45DaysAgo,
          totalTests: 10,
          passedTests: 8,
          failedTests: 2,
          executionScorecard: { executionConfidenceScore: 80, executionReadiness: { ready: true } }
        }
      ];

      const { payload } = service.generateDashboardPayload(
        mockRun.analysisRunId,
        mockRun,
        mockScorecard,
        mockQuality,
        [],
        historyRuns
      );

      // Verify that trend history contains only the current run and the 10-days-ago run, ignoring the 45-days-ago run
      expect(payload.trendsReport.history.length).toBe(2);
      expect(payload.trendsReport.history[0].analysisRunId).toBe('h1');
      expect(payload.trendsReport.history[1].analysisRunId).toBe(mockRun.analysisRunId);
    });
  });

  describe('Flaky Maintenance Priority Scoring', () => {
    it('should rank flaky tests based on calculated priority score', () => {
      const mockRun = {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a81',
        analysisRunId: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a82',
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalTests: 2,
        passedTests: 2,
        failedTests: 0,
        skippedTests: 0,
        blockedTests: 0,
        timedOutTests: 0,
        durationMs: 200
      };

      const mockScorecard = {
        version: '1.0.0' as const,
        passRate: 100,
        failRate: 0,
        skippedRate: 0,
        blockedRate: 0,
        timeoutRate: 0,
        executionConfidenceScore: 100,
        executionReadiness: { ready: true, blockingReasons: [] }
      };

      const mockQuality = {
        id: 'd9b0f682-1a4c-47bc-8cd2-d352c8b87a83',
        executionRunId: mockRun.id,
        passRateScore: 100,
        flakyScore: 100,
        retryStabilityScore: 100,
        durationReliabilityScore: 100,
        artifactCompletenessScore: 100
      };

      const mockResults = [
        {
          id: 'test-low-flaky',
          automationScriptId: 'script-low',
          status: 'PASSED',
          durationMs: 100,
          retryCount: 1, // Flaky in current run
          failureSeverity: 'LOW'
        },
        {
          id: 'test-high-flaky',
          automationScriptId: 'script-high',
          status: 'PASSED',
          durationMs: 100,
          retryCount: 2, // Flaky in current run
          failureSeverity: 'CRITICAL'
        }
      ];

      const historyRuns = [
        {
          id: 'h1',
          results: [
            { automationScriptId: 'script-high', status: 'PASSED', retryCount: 1, durationMs: 100 },
            { automationScriptId: 'script-low', status: 'PASSED', retryCount: 0, durationMs: 100 }
          ]
        }
      ];

      const { payload } = service.generateDashboardPayload(
        mockRun.analysisRunId,
        mockRun,
        mockScorecard,
        mockQuality,
        mockResults,
        historyRuns
      );

      const highPriorityTest = payload.flakyReport.mediumFlakyTests[0];
      const lowPriorityTest = payload.flakyReport.mediumFlakyTests[1];

      // Verifies that the critical script is ranked first
      expect(highPriorityTest.testCaseName).toContain('script-high');
      expect(lowPriorityTest.testCaseName).toContain('script-low');
      expect(highPriorityTest.maintenancePriorityScore).toBeGreaterThan(lowPriorityTest.maintenancePriorityScore);
    });
  });
});
