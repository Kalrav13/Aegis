import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionIntelligenceService } from './execution-intelligence.service';
import {
  validateExecutionRun,
  validateExecutionScorecard,
  validateExecutionResult,
  validateExecutionArtifact,
  validateExecutionQuality
} from '@testlens/contracts';

describe('ExecutionIntelligenceService', () => {
  let service: ExecutionIntelligenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExecutionIntelligenceService]
    }).compile();

    service = module.get<ExecutionIntelligenceService>(ExecutionIntelligenceService);
  });

  it('should compile and evaluate execution run metrics successfully', async () => {
    const mockResults = [
      { status: 'PASSED', durationMs: 100, retryCount: 0 },
      { status: 'PASSED', durationMs: 150, retryCount: 0 },
      { status: 'FAILED', durationMs: 200, retryCount: 1 },
      { status: 'SKIPPED', durationMs: 0, retryCount: 0 }
    ];

    const mockEnv = {
      executionEnvironment: 'staging',
      browser: 'Chromium',
      operatingSystem: 'Linux',
      frameworkVersion: 'Playwright v1.40.0',
      executionSource: 'GITHUB_ACTIONS' as const,
      externalExecutionId: 'github-run-123'
    };

    const { run, scorecard, quality, processedResults } = await service.evaluateExecution(
      '681816f0-d3a9-4670-be95-8120efd70659',
      mockResults,
      mockEnv
    );

    // Verify run structure and Zod parsing success
    expect(validateExecutionRun(run)).toBeDefined();
    expect(run.totalTests).toBe(4);
    expect(run.passedTests).toBe(2);
    expect(run.failedTests).toBe(1);
    expect(run.skippedTests).toBe(1);
    expect(run.durationMs).toBe(450);

    // Verify scorecard Zod validation success
    expect(validateExecutionScorecard(scorecard)).toBeDefined();
    expect(scorecard.passRate).toBe(50);
    expect(scorecard.failRate).toBe(25);
    expect(scorecard.skippedRate).toBe(25);
    // Raw confidence: 0.40 * 50 - 0 + 0.20 * 100 + 0.10 * 75 + 0.10 * 0 = 20 - 0 + 20 + 7.5 + 0 = 47.5
    expect(scorecard.executionConfidenceScore).toBe(47.5);
    expect(scorecard.executionReadiness.ready).toBe(false); 
    expect(scorecard.executionReadiness.blockingReasons[0]).toContain('Pass rate 50% is below the 95% threshold.');
  });

  describe('Refinement 1 — Minimum Sample Gate', () => {
    it('should cap confidence score at 80 if total tests are less than 20', async () => {
      // 10 passing tests (pass rate = 100%)
      const mockResults = Array(10).fill({ status: 'PASSED', durationMs: 100, retryCount: 0 });
      const mockEnv = {
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const
      };

      const { scorecard } = await service.evaluateExecution(
        '681816f0-d3a9-4670-be95-8120efd70659',
        mockResults,
        mockEnv
      );

      // Raw confidence: 0.40 * 100 - 0 + 0.20 * 100 + 0.10 * 100 + 0.10 * 100 = 40 + 20 + 10 + 10 = 90
      // Capped at 80 because totalTests < 20
      expect(scorecard.executionConfidenceScore).toBe(80);
    });

    it('should not cap confidence score at 80 if total tests are 20 or more', async () => {
      // 20 passing tests
      const mockResults = Array(20).fill({ status: 'PASSED', durationMs: 100, retryCount: 0 });
      const mockEnv = {
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const
      };

      const { scorecard } = await service.evaluateExecution(
        '681816f0-d3a9-4670-be95-8120efd70659',
        mockResults,
        mockEnv
      );

      // Raw confidence: 90. No cap because totalTests >= 20.
      expect(scorecard.executionConfidenceScore).toBe(90);
    });
  });

  describe('Refinement 2 — Critical Failure Override', () => {
    it('should cap readiness rating and add cap warning if critical path fails', async () => {
      const mockResults = [
        { status: 'PASSED', durationMs: 100, retryCount: 0 },
        { 
          status: 'FAILED', 
          durationMs: 200, 
          retryCount: 0, 
          failureReason: 'Assertion failed during checkout flow payment gateway' 
        }
      ];
      const mockEnv = {
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const
      };

      const { scorecard, processedResults } = await service.evaluateExecution(
        '681816f0-d3a9-4670-be95-8120efd70659',
        mockResults,
        mockEnv
      );

      // Verify severity is classified as CRITICAL
      const failedResult = processedResults.find(r => r.status === 'FAILED');
      expect(failedResult.failureSeverity).toBe('CRITICAL');

      // Verify override warning exists and readiness is false
      expect(scorecard.executionReadiness.ready).toBe(false);
      expect(scorecard.executionReadiness.blockingReasons).toContain('Critical path failure detected.');
      expect(scorecard.executionReadiness.blockingReasons).toContain(
        'Critical path failure detected. Maximum quality classification capped at GOOD.'
      );
    });
  });

  describe('Zero-Division Bounds', () => {
    it('should safely return 0.00 for rates and block readiness if total tests are 0', async () => {
      const mockEnv = {
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const
      };

      const { scorecard, quality } = await service.evaluateExecution(
        '681816f0-d3a9-4670-be95-8120efd70659',
        [],
        mockEnv
      );

      expect(scorecard.passRate).toBe(0);
      expect(scorecard.failRate).toBe(0);
      expect(scorecard.executionConfidenceScore).toBe(20); // 0.20 * 100 (automationQuality) = 20
      expect(scorecard.executionReadiness.ready).toBe(false);
      expect(scorecard.executionReadiness.blockingReasons).toContain('No execution results exist.');
      
      expect(quality.passRateScore).toBe(0);
      expect(quality.flakyScore).toBe(100);
      expect(quality.retryStabilityScore).toBe(100);
    });
  });

  describe('Refinement 5 — Historical Stability Index', () => {
    it('should identify IMPROVING pass rate compared to rolling averages', async () => {
      const historyRuns = [
        { totalTests: 10, passedTests: 6 }, // 60%
        { totalTests: 10, passedTests: 7 }  // 70%
      ]; // average = 65%

      const mockResults = Array(10).fill({ status: 'PASSED', durationMs: 100, retryCount: 0 }); // 100%

      const mockEnv = {
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const
      };

      const { scorecard } = await service.evaluateExecution(
        '681816f0-d3a9-4670-be95-8120efd70659',
        mockResults,
        mockEnv,
        historyRuns
      );

      expect(scorecard.builderMetadata.trendDirection).toBe('IMPROVING');
    });

    it('should identify DECLINING pass rate compared to rolling averages', async () => {
      const historyRuns = [
        { totalTests: 10, passedTests: 9 }, // 90%
        { totalTests: 10, passedTests: 10 } // 100%
      ]; // average = 95%

      const mockResults = [
        ...Array(6).fill({ status: 'PASSED', durationMs: 100, retryCount: 0 }),
        ...Array(4).fill({ status: 'FAILED', durationMs: 100, retryCount: 0 })
      ]; // 60%

      const mockEnv = {
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const
      };

      const { scorecard } = await service.evaluateExecution(
        '681816f0-d3a9-4670-be95-8120efd70659',
        mockResults,
        mockEnv,
        historyRuns
      );

      expect(scorecard.builderMetadata.trendDirection).toBe('DECLINING');
    });
  });

  describe('Refinement 4 — Execution Source Analytics', () => {
    it('should compute segment metrics grouped by executionSource', async () => {
      const historyRuns = [
        { executionSource: 'GITHUB_ACTIONS', totalTests: 10, passedTests: 9, durationMs: 1000 },
        { executionSource: 'LOCAL', totalTests: 5, passedTests: 5, durationMs: 500 }
      ];

      const mockResults = [
        { status: 'PASSED', durationMs: 100, retryCount: 0 },
        { status: 'FAILED', durationMs: 200, retryCount: 0 }
      ];

      const mockEnv = {
        executionEnvironment: 'staging',
        browser: 'Chromium',
        operatingSystem: 'Linux',
        frameworkVersion: 'Playwright v1.40.0',
        executionSource: 'GITHUB_ACTIONS' as const
      };

      const { scorecard } = await service.evaluateExecution(
        '681816f0-d3a9-4670-be95-8120efd70659',
        mockResults,
        mockEnv,
        historyRuns
      );

      const analytics = scorecard.builderMetadata.sourceAnalytics;
      expect(analytics).toBeDefined();
      
      const githubAnalytics = analytics.find(a => a.executionSource === 'GITHUB_ACTIONS');
      expect(githubAnalytics).toBeDefined();
      // Current: 50% pass rate (1/2), duration = 150ms. History: 90% pass rate (9/10), duration = 100ms.
      // Average pass rate: (50 + 90) / 2 = 70%
      expect(githubAnalytics.averagePassRate).toBe(70);
    });
  });
});
