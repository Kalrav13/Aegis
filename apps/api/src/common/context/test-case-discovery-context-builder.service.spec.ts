import { Test, TestingModule } from '@nestjs/testing';
import { TestCaseDiscoveryContextBuilderService, ScenarioInput } from './test-case-discovery-context-builder.service';
import { AppConfigService } from '../config/config.service';
import { ScenarioQualityScorecard } from '@testlens/contracts';

describe('TestCaseDiscoveryContextBuilderService', () => {
  let service: TestCaseDiscoveryContextBuilderService;
  let appConfigServiceMock: any;

  const mockScorecard: ScenarioQualityScorecard = {
    evaluationVersion: '1.0.0',
    overallScenarioQualityScore: 85,
    totalScenariosEvaluated: 2,
    passingScenariosCount: 2,
    failingScenariosCount: 0,
    scenariosEvaluations: [],
    scenarioGenerationReadiness: {
      ready: true,
      blockingReasons: []
    },
    globalWarnings: []
  };

  const mockCandidateAssets = {
    routes: ['/login', '/Profile'],
    apis: ['get /api/users', 'POST /api/auth'],
    forms: ['loginForm', 'profileForm']
  };

  beforeEach(async () => {
    appConfigServiceMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestCaseDiscoveryContextBuilderService,
        {
          provide: AppConfigService,
          useValue: appConfigServiceMock
        }
      ]
    }).compile();

    service = module.get<TestCaseDiscoveryContextBuilderService>(
      TestCaseDiscoveryContextBuilderService
    );
  });

  it('should compile context, deduplicate candidate assets, and normalize casing', () => {
    const mockScenarios: ScenarioInput[] = [
      {
        id: 'scen-1',
        scenarioName: 'User authentication',
        scenarioType: 'POSITIVE',
        priority: 'HIGH',
        description: 'Verify login flow is successful when user provides valid credentials.',
        evidence: ['/login', '/LOGIN'], // duplicate evidence
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: {
          routes: ['/login'],
          apis: ['GET /api/users'],
          forms: []
        },
        qualityScore: 85,
        confidenceScore: 0.9,
        riskLevel: 'HIGH',
        scenarioOrigin: {
          featureIds: ['feat-auth']
        }
      }
    ];

    const context = service.buildContext(mockScenarios, mockScorecard, mockCandidateAssets);

    expect(context.contextVersion).toBe('1.0.0');
    expect(context.builderMetadata.scenariosCount).toBe(1);
    
    // Normalized candidate assets
    expect(context.candidateAssets.routes).toEqual(['/login', '/profile']);
    expect(context.candidateAssets.apis).toEqual(['GET /api/users', 'POST /api/auth']);
    
    // Optimized scenarios
    const aggregatedScenario = context.scenarios[0];
    expect(aggregatedScenario.evidence).toEqual(['/login']); // deduplicated and lowercase
    expect(aggregatedScenario.description).toBe('Verify login flow is successful when user provides valid credentials.');
    expect(context.testCaseReadiness.ready).toBe(true);
  });

  it('should trim description exceeding 500 characters', () => {
    const longDesc = 'A'.repeat(550);
    const mockScenarios: ScenarioInput[] = [
      {
        id: 'scen-1',
        scenarioName: 'User authentication',
        scenarioType: 'POSITIVE',
        priority: 'HIGH',
        description: longDesc,
        evidence: ['/login'],
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: {
          routes: [],
          apis: [],
          forms: []
        },
        qualityScore: 85,
        confidenceScore: 0.9,
        riskLevel: 'HIGH',
        scenarioOrigin: {
          featureIds: ['feat-auth']
        }
      }
    ];

    const context = service.buildContext(mockScenarios, mockScorecard, mockCandidateAssets);
    expect(context.scenarios[0].description.length).toBe(500);
    expect(context.scenarios[0].description.endsWith('...')).toBe(true);
  });

  it('should enforce scenarios selection limits per feature and prioritize correctly', () => {
    // Generate 18 scenarios for the same feature to trigger selection limits (>15)
    const mockScenarios: ScenarioInput[] = [];
    for (let i = 1; i <= 18; i++) {
      mockScenarios.push({
        id: `scen-${i}`,
        scenarioName: `Scenario ${i}`,
        scenarioType: 'POSITIVE',
        priority: 'MEDIUM',
        description: `Verify scenario ${i} description details.`,
        evidence: ['/login'],
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: { routes: [], apis: [], forms: [] },
        qualityScore: i, // Higher index has higher quality score
        confidenceScore: 0.8,
        riskLevel: 'MEDIUM',
        scenarioOrigin: {
          featureIds: ['feat-auth']
        }
      });
    }

    const context = service.buildContext(mockScenarios, mockScorecard, mockCandidateAssets);
    
    // Output scenarios count must be capped to 15
    expect(context.scenarios.length).toBe(15);
    
    // Prioritize highest quality score: so scen-18 down to scen-4 should be kept, scen-1 to scen-3 discarded
    const includedIds = new Set(context.scenarios.map(s => s.id));
    expect(includedIds.has('scen-18')).toBe(true);
    expect(includedIds.has('scen-4')).toBe(true);
    expect(includedIds.has('scen-1')).toBe(false);
    expect(includedIds.has('scen-2')).toBe(false);
    expect(includedIds.has('scen-3')).toBe(false);
  });

  it('should block readiness if scenarios list is empty', () => {
    const context = service.buildContext([], mockScorecard, mockCandidateAssets);
    expect(context.testCaseReadiness.ready).toBe(false);
    expect(context.testCaseReadiness.blockingReasons).toContain(
      'Scenario count is zero. No scenarios available for test case discovery.'
    );
  });

  it('should block readiness if average scenario quality score is under 70', () => {
    const mockScenarios: ScenarioInput[] = [
      {
        id: 'scen-1',
        scenarioName: 'Scenario 1',
        scenarioType: 'POSITIVE',
        priority: 'MEDIUM',
        description: 'Verify scenario description details.',
        evidence: ['/login'],
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: { routes: [], apis: [], forms: [] },
        qualityScore: 60, // under 70
        confidenceScore: 0.8,
        riskLevel: 'MEDIUM',
        scenarioOrigin: {
          featureIds: ['feat-auth']
        }
      }
    ];

    const context = service.buildContext(mockScenarios, mockScorecard, mockCandidateAssets);
    expect(context.testCaseReadiness.ready).toBe(false);
    expect(context.testCaseReadiness.blockingReasons.some(r => r.includes('Average scenario quality score'))).toBe(true);
  });

  it('should block readiness if quality failure rate is 30% or more', () => {
    const mockScenarios: ScenarioInput[] = [
      {
        id: 'scen-1',
        scenarioName: 'Scenario 1',
        scenarioType: 'POSITIVE',
        priority: 'MEDIUM',
        description: 'Verify scenario description details.',
        evidence: ['/login'],
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: { routes: [], apis: [], forms: [] },
        qualityScore: 85,
        confidenceScore: 0.8,
        riskLevel: 'MEDIUM',
        scenarioOrigin: {
          featureIds: ['feat-auth']
        }
      },
      {
        id: 'scen-2',
        scenarioName: 'Scenario 2',
        scenarioType: 'POSITIVE',
        priority: 'MEDIUM',
        description: 'Verify scenario description details.',
        evidence: ['/login'],
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: { routes: [], apis: [], forms: [] },
        qualityScore: 80,
        confidenceScore: 0.8,
        riskLevel: 'MEDIUM',
        scenarioOrigin: {
          featureIds: ['feat-auth']
        }
      },
      {
        id: 'scen-3',
        scenarioName: 'Scenario 3',
        scenarioType: 'POSITIVE',
        priority: 'MEDIUM',
        description: 'Verify scenario description details.',
        evidence: ['/login'],
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: { routes: [], apis: [], forms: [] },
        qualityScore: 50, // fails (< 70) -> 1/3 = 33% fail
        confidenceScore: 0.8,
        riskLevel: 'MEDIUM',
        scenarioOrigin: {
          featureIds: ['feat-auth']
        }
      }
    ];

    const context = service.buildContext(mockScenarios, mockScorecard, mockCandidateAssets);
    expect(context.testCaseReadiness.ready).toBe(false);
    expect(context.testCaseReadiness.blockingReasons.some(r => r.includes('Scenario quality failure rate is 33%'))).toBe(true);
  });
});
