import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioQualityEvaluatorService } from './scenario-quality-evaluator.service';
import { AiService } from '../ai/ai.service';
import { ScenarioDiscoveryContext, Scenario } from '@testlens/contracts';

describe('ScenarioQualityEvaluatorService', () => {
  let service: ScenarioQualityEvaluatorService;
  let aiServiceMock: any;

  const mockContext: ScenarioDiscoveryContext = {
    contextVersion: '1.0.0',
    builderMetadata: {
      generatedAt: new Date().toISOString(),
      featuresCount: 2
    },
    applicationSummary: {
      purpose: 'Test Payments Application',
      targetUsers: ['Users'],
      businessDomains: ['FinTech']
    },
    featureSummary: [
      {
        id: 'feat-auth',
        featureName: 'User Login Flow',
        featureType: 'CORE',
        description: 'Enables users to sign in securely.',
        evidence: ['/login', 'src/components/login.tsx'],
        sourceWorkflows: ['Login Workflow'],
        riskLevel: 'CRITICAL',
        qualityScore: 90,
        warnings: []
      },
      {
        id: 'feat-profile',
        featureName: 'User Profile Page',
        featureType: 'SUPPORTING',
        description: 'Dashboard profile details settings.',
        evidence: ['/profile', 'src/components/profile.tsx'],
        sourceWorkflows: ['Update Profile Workflow'],
        riskLevel: 'MEDIUM',
        qualityScore: 85,
        warnings: []
      }
    ],
    workflowSummary: [
      {
        name: 'Login Workflow',
        description: 'Workflow to sign in',
        steps: ['enter credential detail', 'submit'],
        routes: ['/login'],
        apis: ['/api/auth/login'],
        evidence: ['src/components/login.tsx']
      },
      {
        name: 'Update Profile Workflow',
        description: 'Workflow to update profile details',
        steps: ['edit fields', 'save'],
        routes: ['/profile'],
        apis: ['/api/profile/update'],
        evidence: ['src/components/profile.tsx']
      }
    ],
    riskSummary: [],
    evidenceSummary: {
      totalEvidenceFiles: 10,
      mappedEvidenceFiles: 5,
      unmappedEvidenceFiles: 5
    },
    candidateAssets: {
      routes: ['/login', '/profile'],
      apis: ['/api/auth/login', '/api/profile/update'],
      forms: ['loginForm', 'profileForm'],
      components: ['src/components/login.tsx', 'src/components/profile.tsx']
    },
    scenarioReadiness: {
      ready: true,
      blockingReasons: []
    },
    coverageSummary: {
      routeCoverageRatio: 100,
      apiCoverageRatio: 100,
      formCoverageRatio: 100,
      overallCoverageRatio: 100,
      warnings: []
    }
  };

  beforeEach(async () => {
    aiServiceMock = {
      generateJson: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenarioQualityEvaluatorService,
        {
          provide: AiService,
          useValue: aiServiceMock
        }
      ]
    }).compile();

    service = module.get<ScenarioQualityEvaluatorService>(ScenarioQualityEvaluatorService);
  });

  it('should compile scenario quality scorecard, compute AI critic isolation, and enforce versioning', async () => {
    // 1. Mock AI critic to evaluate descriptions
    aiServiceMock.generateJson.mockResolvedValue(
      JSON.stringify({
        evaluations: [
          {
            scenarioName: 'Authenticate User with Valid MFA Token',
            completenessScore: 90,
            warnings: []
          },
          {
            scenarioName: 'Update profile settings with empty description details',
            completenessScore: 40, // criticized for short details
            warnings: ['[LLM Critic] Shallow description detail']
          }
        ]
      })
    );

    const mockScenarios: Scenario[] = [
      {
        scenarioId: 'scen-auth-1',
        scenarioName: 'Authenticate User with Valid MFA Token',
        scenarioType: 'POSITIVE',
        priority: 'CRITICAL',
        description: 'Verify user login flow completes cleanly when entering a valid username, password, and MFA code.',
        confidenceScore: 1.0,
        riskLevel: 'CRITICAL',
        parentFeatures: ['User Login Flow'],
        sourceWorkflows: ['Login Workflow'],
        evidence: ['/login', 'src/components/login.tsx', '/api/auth/login'],
        coverageTargets: {
          routes: ['/login'],
          apis: ['/api/auth/login'],
          forms: []
        },
        scenarioOrigin: {
          featureIds: ['feat-auth'],
          workflowIds: ['login-workflow']
        }
      },
      {
        scenarioId: 'scen-prof-1',
        scenarioName: 'Update profile settings with empty description details',
        scenarioType: 'EDGE_CASE',
        priority: 'LOW',
        description: 'Short flow.', // very short, < 50 chars
        confidenceScore: 0.5,
        riskLevel: 'MEDIUM',
        parentFeatures: ['User Profile Page'],
        sourceWorkflows: ['Update Profile Workflow'],
        evidence: ['/profile', '/invalid/grounding'], // contains ungrounded path
        coverageTargets: {
          routes: ['/profile'],
          apis: [],
          forms: []
        },
        scenarioOrigin: {
          featureIds: ['feat-profile'],
          workflowIds: ['update-profile-workflow']
        }
      }
    ];

    const scorecard = await service.evaluate(mockScenarios, mockContext);

    expect(scorecard.evaluationVersion).toBe('1.0.0');
    expect(scorecard.totalScenariosEvaluated).toBe(2);
    expect(scorecard.passingScenariosCount).toBe(1);
    expect(scorecard.failingScenariosCount).toBe(1);
    
    // Check user auth scenario evaluation details
    const authEval = scorecard.scenariosEvaluations.find(e => e.scenarioId === 'scen-auth-1')!;
    expect(authEval).toBeDefined();
    expect(authEval.qualityScore).toBeGreaterThanOrEqual(70);
    expect(authEval.completenessScore).toBeGreaterThanOrEqual(80); // deterministic (85) + LLM (90)
    
    // Check profile scenario evaluation details
    const profileEval = scorecard.scenariosEvaluations.find(e => e.scenarioId === 'scen-prof-1')!;
    expect(profileEval).toBeDefined();
    expect(profileEval.qualityScore).toBeLessThan(70);
    expect(profileEval.evidenceCoverageScore).toBeLessThan(60); // contains invalid path (-40)
  });

  it('should enforce readiness gate blocking conditions', async () => {
    // Both scenarios are mock evaluated to fail
    aiServiceMock.generateJson.mockResolvedValue(
      JSON.stringify({
        evaluations: [
          {
            scenarioName: 'Scenario Auth Vague',
            completenessScore: 30,
            warnings: ['Vague']
          },
          {
            scenarioName: 'Scenario Profile Vague',
            completenessScore: 30,
            warnings: ['Vague']
          }
        ]
      })
    );

    const mockScenarios: Scenario[] = [
      {
        scenarioId: 'scen-auth-vague',
        scenarioName: 'Scenario Auth Vague',
        scenarioType: 'POSITIVE',
        priority: 'LOW',
        description: 'Vague auth description.',
        confidenceScore: 0.4,
        riskLevel: 'LOW',
        parentFeatures: ['User Login Flow'],
        sourceWorkflows: ['Login Workflow'],
        evidence: ['/login'],
        coverageTargets: {
          routes: ['/login'],
          apis: [],
          forms: []
        },
        scenarioOrigin: {
          featureIds: ['feat-auth'],
          workflowIds: ['login-workflow']
        }
      },
      {
        scenarioId: 'scen-prof-vague',
        scenarioName: 'Scenario Profile Vague',
        scenarioType: 'POSITIVE',
        priority: 'LOW',
        description: 'Vague profile description.',
        confidenceScore: 0.4,
        riskLevel: 'LOW',
        parentFeatures: ['User Profile Page'],
        sourceWorkflows: ['Update Profile Workflow'],
        evidence: ['/profile'],
        coverageTargets: {
          routes: ['/profile'],
          apis: [],
          forms: []
        },
        scenarioOrigin: {
          featureIds: ['feat-profile'],
          workflowIds: ['update-profile-workflow']
        }
      }
    ];

    const scorecard = await service.evaluate(mockScenarios, mockContext);

    // Readiness should fail since 100% fail and overall average is below 70
    expect(scorecard.scenarioGenerationReadiness.ready).toBe(false);
    expect(scorecard.scenarioGenerationReadiness.blockingReasons.length).toBeGreaterThan(0);
  });
});
