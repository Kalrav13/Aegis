import { Test, TestingModule } from '@nestjs/testing';
import { CoverageIntelligenceService } from './coverage-intelligence.service';
import { prisma } from '@testlens/db';

jest.mock('@testlens/db', () => ({
  prisma: {
    analysisRun: {
      findUnique: jest.fn()
    }
  }
}));

describe('CoverageIntelligenceService', () => {
  let service: CoverageIntelligenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoverageIntelligenceService]
    }).compile();

    service = module.get<CoverageIntelligenceService>(CoverageIntelligenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compile and evaluate coverage correctly on a standard repository state', async () => {
    (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-uuid-123'
    });

    const mockFeatures = [
      { id: 'feat-1', featureName: 'User Authentication', riskLevel: 'HIGH', description: 'Log in flow' },
      { id: 'feat-2', featureName: 'Billing', riskLevel: 'HIGH', description: 'Payment processing' }
    ];

    const mockScenarios = [
      { id: 'scen-1', scenarioId: 'scen-1', scenarioName: 'Valid Login', riskLevel: 'HIGH', scenarioOrigin: { featureIds: ['feat-1'] } },
      { id: 'scen-2', scenarioId: 'scen-2', scenarioName: 'Invalid Login', riskLevel: 'MEDIUM', scenarioOrigin: { featureIds: ['feat-1'] } }
    ];

    const mockTestCases = [
      { id: 'tc-1', testCaseId: 'tc-1', testCaseName: 'Verify Valid Credentials', testCaseKey: 'TC-AUTH-01', riskLevel: 'HIGH', automationStatus: 'AUTOMATED', testCaseOrigin: { scenarioIds: ['scen-1'] } },
      { id: 'tc-2', testCaseId: 'tc-2', testCaseName: 'Verify Invalid Credentials', testCaseKey: 'TC-AUTH-02', riskLevel: 'MEDIUM', automationStatus: 'UNAUTOMATED', testCaseOrigin: { scenarioIds: ['scen-2'] } }
    ];

    const mockScripts = [
      { scriptId: 'script-1', testCaseId: 'tc-1' }
    ];

    const mockAutomationEvaluations = [
      { scriptId: 'script-1', qualityScore: 85 }
    ];

    const mockTestCaseEvaluations = [
      { testCaseId: 'tc-1', qualityScore: 90 },
      { testCaseId: 'tc-2', qualityScore: 80 }
    ];

    const { report, scorecard, quality, context } = await service.evaluateCoverage(
      'run-uuid-123',
      mockFeatures,
      mockScenarios,
      mockTestCases,
      mockScripts,
      mockAutomationEvaluations,
      mockTestCaseEvaluations,
      { ready: true, blockingReasons: [] }
    );

    // Feature coverage: feat-1 has scenarios (scen-1, scen-2), feat-2 has 0 scenarios.
    // Count = 1/2 = 50%
    expect(report.featureCoverage).toBe(50);

    // Scenario coverage: scen-1 has tc-1, scen-2 has tc-2. Both covered.
    // Count = 2/2 = 100%
    expect(report.scenarioCoverage).toBe(100);

    // Test case coverage: tc-1 has scen-1, tc-2 has scen-2. Both covered.
    // Count = 2/2 = 100%
    expect(report.testCaseCoverage).toBe(100);

    // Automation Coverage: 1/2 = 50%
    expect(report.automationCoverage).toBe(50);

    // E2E Traceability: feat-1 has scen-1 traced to tc-1 (automated). feat-2 has none.
    // Count = 1/2 = 50%
    expect(report.details.unautomatedTestCaseIds).toContain('tc-2');
  });

  it('should evaluate coverage to 0% and fail readiness check when repository is empty', async () => {
    (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-uuid-empty'
    });

    const { report, scorecard, quality, context } = await service.evaluateCoverage(
      'run-uuid-empty',
      [],
      [],
      [],
      [],
      [],
      [],
      { ready: true, blockingReasons: [] }
    );

    expect(report.featureCoverage).toBe(0);
    expect(report.scenarioCoverage).toBe(0);
    expect(report.testCaseCoverage).toBe(0);
    expect(report.automationCoverage).toBe(0);
    expect(scorecard.coverageIntelligenceReadiness.ready).toBe(false);
    expect(scorecard.coverageIntelligenceReadiness.blockingReasons).toContain(
      'Repository contains no discoverable coverage entities.'
    );
  });

  it('should cap confidence score at 80 on tiny repositories (Refinement 2)', async () => {
    (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-uuid-tiny'
    });

    const mockFeatures = [
      { id: 'feat-1', featureName: 'User Auth', riskLevel: 'HIGH', description: 'Log in' }
    ];

    const mockScenarios = [
      { id: 'scen-1', scenarioId: 'scen-1', scenarioName: 'Valid Login', riskLevel: 'HIGH', scenarioOrigin: { featureIds: ['feat-1'] } }
    ];

    const mockTestCases = [
      { id: 'tc-1', testCaseId: 'tc-1', testCaseName: 'Verify Login', testCaseKey: 'TC-AUTH-01', riskLevel: 'HIGH', automationStatus: 'AUTOMATED', testCaseOrigin: { scenarioIds: ['scen-1'] } }
    ];

    const mockScripts = [
      { scriptId: 'script-1', testCaseId: 'tc-1' }
    ];

    const mockAutomationEvaluations = [
      { scriptId: 'script-1', qualityScore: 100 }
    ];

    const mockTestCaseEvaluations = [
      { testCaseId: 'tc-1', qualityScore: 100 }
    ];

    const { report, scorecard } = await service.evaluateCoverage(
      'run-uuid-tiny',
      mockFeatures,
      mockScenarios,
      mockTestCases,
      mockScripts,
      mockAutomationEvaluations,
      mockTestCaseEvaluations,
      { ready: true, blockingReasons: [] }
    );

    // Raw calculated confidence score is 100%, but must be capped at 80% because counts are too low.
    expect(report.coverageConfidenceScore).toBeLessThanOrEqual(80);
    expect(scorecard.coverageClassification).toBe('GOOD'); // 80 is GOOD classification
  });

  it('should identify critical gaps using keywords and risks (Refinement 3)', async () => {
    (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-uuid-gaps'
    });

    const mockFeatures = [
      { id: 'feat-1', featureName: 'Checkout Flow', riskLevel: 'CRITICAL', description: 'User checkout and payment' }
    ];

    const { report } = await service.evaluateCoverage(
      'run-uuid-gaps',
      mockFeatures,
      [], // No scenarios -> uncovered feature
      [],
      [],
      [],
      [],
      { ready: true, blockingReasons: [] }
    );

    expect(report.details.criticalCoverageGaps.length).toBeGreaterThan(0);
    expect(report.details.criticalCoverageGaps[0]).toContain("Checkout Flow");
  });
});
