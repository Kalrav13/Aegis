import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisProcessor } from './analysis.processor';
import { prisma } from '@testlens/db';
import { GitService } from '../common/git/git.service';
import { StorageManager } from '../common/storage/storage.manager';
import { FilterService } from '../common/filter/filter.service';
import { ManifestService } from '../common/manifest/manifest.service';
import { RegistryService } from '../common/registry/registry.service';
import { ContextBuilderService } from '../common/context/context-builder.service';
import { DiscoveryContextBuilderService } from '../common/context/discovery-context-builder.service';
import { FeatureDiscoveryAgentService } from '../common/context/feature-discovery-agent.service';
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
import { CoverageIntelligenceService } from '../common/context/coverage-intelligence.service';
import { CoverageReportingService } from '../common/context/coverage-reporting.service';

const mockTx = {
  analysisRun: {
    findMany: jest.fn(),
    update: jest.fn()
  },
  coverageReport: {
    create: jest.fn()
  },
  coverageQuality: {
    create: jest.fn()
  },
  feature: {
    createMany: jest.fn()
  },
  scenario: {
    create: jest.fn()
  },
  testCase: {
    create: jest.fn()
  },
  testCaseQuality: {
    createMany: jest.fn()
  },
  automationScript: {
    create: jest.fn()
  },
  automationQuality: {
    create: jest.fn()
  }
};

jest.mock('@testlens/db', () => ({
  prisma: {
    analysisRun: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      return callback(mockTx);
    })
  }
}));

describe('AnalysisProcessor', () => {
  let processor: AnalysisProcessor;
  let storageManager: StorageManager;
  let coverageReportingService: CoverageReportingService;

  const mockGitService = { clone: jest.fn() };
  const mockStorageManager = { getRepoPath: jest.fn(), calculateDirectorySize: jest.fn(), deleteDirectory: jest.fn() };
  const mockFilterService = { filterRepository: jest.fn() };
  const mockManifestService = { generateManifest: jest.fn() };
  const mockRegistryService = { generateRegistry: jest.fn() };
  const mockContextBuilderService = { buildContext: jest.fn() };
  const mockUnderstandingAgentService = { analyzeRepository: jest.fn() };
  const mockQualityEvaluatorService = { evaluate: jest.fn() };
  const mockDiscoveryContextBuilderService = { buildDiscoveryContext: jest.fn() };
  const mockFeatureDiscoveryAgentService = { discoverFeatures: jest.fn() };
  const mockFeatureQualityEvaluatorService = { evaluate: jest.fn() };
  const mockScenarioDiscoveryContextBuilderService = { buildScenarioDiscoveryContext: jest.fn() };
  const mockScenarioDiscoveryAgentService = { discoverScenarios: jest.fn() };
  const mockScenarioQualityEvaluatorService = { evaluate: jest.fn() };
  const mockTestCaseDiscoveryContextBuilderService = { buildContext: jest.fn() };
  const mockTestCaseDiscoveryAgentService = { discoverTestCases: jest.fn() };
  const mockTestCaseQualityEvaluatorService = { evaluate: jest.fn() };
  const mockAutomationDiscoveryContextBuilderService = { buildContext: jest.fn() };
  const mockAutomationGenerationAgentService = { generateAutomation: jest.fn() };
  const mockAutomationQualityEvaluatorService = { evaluateAutomation: jest.fn() };
  const mockCoverageIntelligenceService = { evaluateCoverage: jest.fn() };
  const mockCoverageReportingService = { buildDashboardPayload: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisProcessor,
        { provide: GitService, useValue: mockGitService },
        { provide: StorageManager, useValue: mockStorageManager },
        { provide: FilterService, useValue: mockFilterService },
        { provide: ManifestService, useValue: mockManifestService },
        { provide: RegistryService, useValue: mockRegistryService },
        { provide: ContextBuilderService, useValue: mockContextBuilderService },
        { provide: UnderstandingAgentService, useValue: mockUnderstandingAgentService },
        { provide: QualityEvaluatorService, useValue: mockQualityEvaluatorService },
        { provide: DiscoveryContextBuilderService, useValue: mockDiscoveryContextBuilderService },
        { provide: FeatureDiscoveryAgentService, useValue: mockFeatureDiscoveryAgentService },
        { provide: FeatureQualityEvaluatorService, useValue: mockFeatureQualityEvaluatorService },
        { provide: ScenarioDiscoveryContextBuilderService, useValue: mockScenarioDiscoveryContextBuilderService },
        { provide: ScenarioDiscoveryAgentService, useValue: mockScenarioDiscoveryAgentService },
        { provide: ScenarioQualityEvaluatorService, useValue: mockScenarioQualityEvaluatorService },
        { provide: TestCaseDiscoveryContextBuilderService, useValue: mockTestCaseDiscoveryContextBuilderService },
        { provide: TestCaseDiscoveryAgentService, useValue: mockTestCaseDiscoveryAgentService },
        { provide: TestCaseQualityEvaluatorService, useValue: mockTestCaseQualityEvaluatorService },
        { provide: AutomationDiscoveryContextBuilderService, useValue: mockAutomationDiscoveryContextBuilderService },
        { provide: AutomationGenerationAgentService, useValue: mockAutomationGenerationAgentService },
        { provide: AutomationQualityEvaluatorService, useValue: mockAutomationQualityEvaluatorService },
        { provide: CoverageIntelligenceService, useValue: mockCoverageIntelligenceService },
        { provide: CoverageReportingService, useValue: mockCoverageReportingService }
      ]
    }).compile();

    processor = module.get<AnalysisProcessor>(AnalysisProcessor);
    storageManager = module.get<StorageManager>(StorageManager);
    coverageReportingService = module.get<CoverageReportingService>(CoverageReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const setupBaseMocks = () => {
    (prisma.analysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-1',
      projectId: 'proj-1',
      status: 'PENDING'
    });
    mockGitService.clone.mockResolvedValue('commit-sha-123');
    mockStorageManager.calculateDirectorySize.mockResolvedValue(1000); // 1KB
    mockStorageManager.getRepoPath.mockReturnValue('C:/temp/clone-1');
    mockFilterService.filterRepository.mockResolvedValue({
      repository_statistics: { total_filtered_files: 5 }
    });
    mockManifestService.generateManifest.mockResolvedValue({ route_candidates: [] });
    mockRegistryService.generateRegistry.mockResolvedValue([]);
    mockContextBuilderService.buildContext.mockReturnValue({});
    mockUnderstandingAgentService.analyzeRepository.mockResolvedValue({});
    mockQualityEvaluatorService.evaluate.mockResolvedValue({});
    mockDiscoveryContextBuilderService.buildDiscoveryContext.mockReturnValue({
      discoveryReadiness: { ready: true }
    });
    mockFeatureDiscoveryAgentService.discoverFeatures.mockResolvedValue([
      { featureName: 'Auth', riskLevel: 'HIGH' }
    ]);
    mockScenarioDiscoveryContextBuilderService.buildScenarioDiscoveryContext.mockReturnValue({
      scenarioReadiness: { ready: true }
    });
    mockScenarioDiscoveryAgentService.discoverScenarios.mockResolvedValue([]);
    mockScenarioQualityEvaluatorService.evaluate.mockResolvedValue({ scenariosEvaluations: [] });
    mockTestCaseDiscoveryContextBuilderService.buildContext.mockReturnValue({
      testCaseReadiness: { ready: true }
    });
    mockTestCaseDiscoveryAgentService.discoverTestCases.mockResolvedValue({
      testCases: [],
      readiness: { ready: true }
    });
    mockTestCaseQualityEvaluatorService.evaluate.mockResolvedValue({ testCasesEvaluations: [] });
    mockAutomationDiscoveryContextBuilderService.buildContext.mockReturnValue({
      automationGenerationReadiness: { ready: true }
    });
    mockAutomationGenerationAgentService.generateAutomation.mockResolvedValue({ scripts: [] });
    mockAutomationQualityEvaluatorService.evaluateAutomation.mockResolvedValue({ evaluations: [] });

    mockCoverageIntelligenceService.evaluateCoverage.mockResolvedValue({
      report: { reportId: 'rep-curr', featureCoverage: 80, details: {} },
      scorecard: { coverageIntelligenceReadiness: { ready: true } },
      quality: { id: 'qual-curr' },
      context: {}
    });

    mockTx.analysisRun.findMany.mockResolvedValue([]);
  };

  it('should transactionally commit coverage artifacts and cached dashboard payload successfully', async () => {
    setupBaseMocks();
    const mockPayload = { payloadVersion: '1.0.0', content: 'test-cached-dashboard' };
    mockCoverageReportingService.buildDashboardPayload.mockReturnValue(mockPayload);

    await processor.executeClone('run-1', 'https://github.com/org/repo', 'main');

    // Verify Prisma updates and insertions inside transaction were called
    expect(mockTx.analysisRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        coverageDashboardPayload: mockPayload
      })
    });
    expect(mockTx.coverageReport.create).toHaveBeenCalled();
    expect(mockTx.coverageQuality.create).toHaveBeenCalled();
    expect(storageManager.deleteDirectory).not.toHaveBeenCalled(); // Successful run leaves clone repo intact or handles cleanly
  });

  it('should rollback transaction and delete temp clone folder if database insert fails', async () => {
    setupBaseMocks();
    // Simulate transaction database insert failure
    mockTx.coverageReport.create.mockRejectedValue(new Error('Unique key constraint violation'));

    await processor.executeClone('run-1', 'https://github.com/org/repo', 'main');

    // Assert database status was set to FAILED
    expect(prisma.analysisRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'Unique key constraint violation'
      })
    });
    
    // Assert cleanup of temporary clone workspace directory
    expect(storageManager.deleteDirectory).toHaveBeenCalledWith('C:/temp/clone-1');
  });

  it('should verify consistency between cached dashboard payload and service generated payload', async () => {
    setupBaseMocks();
    const mockPayload = {
      payloadVersion: '1.0.0',
      executiveSummary: { overallCoverageScore: 85 }
    };
    mockCoverageReportingService.buildDashboardPayload.mockReturnValue(mockPayload);

    await processor.executeClone('run-1', 'https://github.com/org/repo', 'main');

    // Assert that the dashboard payload passed to findUnique and update matches exactly
    const updateCall = mockTx.analysisRun.update.mock.calls[0][0];
    expect(updateCall.data.coverageDashboardPayload).toEqual(mockPayload);
  });
});
