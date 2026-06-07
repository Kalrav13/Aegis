import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioDiscoveryAgentService } from './scenario-discovery-agent.service';
import { AiService } from '../ai/ai.service';
import { ScenarioDiscoveryContext } from '@testlens/contracts';

describe('ScenarioDiscoveryAgentService', () => {
  let service: ScenarioDiscoveryAgentService;
  let aiServiceMock: any;

  const mockContext: ScenarioDiscoveryContext = {
    contextVersion: '1.0.0',
    builderMetadata: {
      generatedAt: new Date().toISOString(),
      featuresCount: 2
    },
    applicationSummary: {
      purpose: 'Test E-Commerce App',
      targetUsers: ['Buyers'],
      businessDomains: ['E-Commerce']
    },
    featureSummary: [
      {
        id: 'feat-auth',
        featureName: 'User Authentication',
        featureType: 'CORE',
        description: 'Authentication feature for logging in.',
        evidence: ['/login', 'src/components/login.tsx'],
        sourceWorkflows: ['Login Workflow'],
        riskLevel: 'CRITICAL',
        qualityScore: 90,
        warnings: []
      },
      {
        id: 'feat-profile',
        featureName: 'User Profile',
        featureType: 'SUPPORTING',
        description: 'Profile feature for changing settings.',
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
        description: 'Flow to sign in',
        steps: ['enter user details', 'submit'],
        routes: ['/login'],
        apis: ['/api/auth/login'],
        evidence: ['src/components/login.tsx']
      },
      {
        name: 'Update Profile Workflow',
        description: 'Flow to edit profile details',
        steps: ['go to settings', 'edit fields', 'save'],
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
        ScenarioDiscoveryAgentService,
        {
          provide: AiService,
          useValue: aiServiceMock
        }
      ]
    }).compile();

    service = module.get<ScenarioDiscoveryAgentService>(ScenarioDiscoveryAgentService);
  });

  it('should validate readiness, process raw LLM output, map targets and trace IDs, and satisfy count guardrails', async () => {
    // We mock the LLM output to return 3 scenarios for user auth (critical) and 3 for user profile
    const rawLlmScenarios = {
      scenarios: [
        // User Auth scenarios (Need: POSITIVE, NEGATIVE, plus SECURITY or EDGE_CASE since risk is CRITICAL)
        {
          scenarioName: 'Authenticate User with Valid Credentials',
          scenarioType: 'POSITIVE',
          priority: 'CRITICAL',
          description: 'Ensure a user can sign in using a valid username and password credential combination.',
          confidenceScore: 0.95,
          riskLevel: 'CRITICAL',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', '/api/auth/login']
        },
        {
          scenarioName: 'Authenticate User with Invalid Credentials',
          scenarioType: 'NEGATIVE',
          priority: 'HIGH',
          description: 'Ensure user login fails gracefully and displays proper error messages for incorrect passwords.',
          confidenceScore: 0.9,
          riskLevel: 'HIGH',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', '/api/auth/login']
        },
        {
          scenarioName: 'Prevent SQL Injection in Login Fields',
          scenarioType: 'SECURITY',
          priority: 'CRITICAL',
          description: 'Verify login form sanitized input fields block potential SQL injection payload vectors.',
          confidenceScore: 0.98,
          riskLevel: 'CRITICAL',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', 'loginForm']
        },

        // User Profile scenarios (Need: POSITIVE, NEGATIVE)
        {
          scenarioName: 'Update Profile with Valid Data',
          scenarioType: 'POSITIVE',
          priority: 'MEDIUM',
          description: 'Ensure profile fields mutate successfully in database when submitting valid profile forms.',
          confidenceScore: 0.88,
          riskLevel: 'MEDIUM',
          parentFeatures: ['User Profile'],
          sourceWorkflows: ['Update Profile Workflow'],
          evidence: ['/profile', 'profileForm', '/api/profile/update']
        },
        {
          scenarioName: 'Fail Profile Update with Missing Required Fields',
          scenarioType: 'NEGATIVE',
          priority: 'MEDIUM',
          description: 'Verify profile validation schema triggers and alerts user if mandatory inputs are left blank.',
          confidenceScore: 0.85,
          riskLevel: 'MEDIUM',
          parentFeatures: ['User Profile'],
          sourceWorkflows: ['Update Profile Workflow'],
          evidence: ['/profile', 'profileForm']
        },
        {
          scenarioName: 'Update Profile with Empty Optional Description',
          scenarioType: 'EDGE_CASE',
          priority: 'LOW',
          description: 'Verify profile form submits cleanly without errors if optional biography description is omitted.',
          confidenceScore: 0.8,
          riskLevel: 'LOW',
          parentFeatures: ['User Profile'],
          sourceWorkflows: ['Update Profile Workflow'],
          evidence: ['/profile', '/api/profile/update']
        }
      ]
    };

    aiServiceMock.generateJson.mockResolvedValue(JSON.stringify(rawLlmScenarios));

    const result = await service.discoverScenarios(mockContext);

    // Assert that we have all 6 scenarios returned successfully
    expect(result.length).toBe(6);

    // Verify User Authentication scenarios
    const authScenarios = result.filter(s => s.scenarioOrigin?.featureIds.includes('feat-auth'));
    expect(authScenarios.length).toBe(3);
    
    // Check coverage targets mapping for auth SQL injection scenario
    const secScenario = authScenarios.find(s => s.scenarioType === 'SECURITY')!;
    expect(secScenario).toBeDefined();
    expect(secScenario.coverageTargets.routes).toContain('/login');
    expect(secScenario.coverageTargets.forms).toContain('loginForm');
    expect(secScenario.scenarioOrigin?.workflowIds).toContain('login-workflow');

    // Verify User Profile scenarios
    const profileScenarios = result.filter(s => s.scenarioOrigin?.featureIds.includes('feat-profile'));
    expect(profileScenarios.length).toBe(3);
    expect(profileScenarios.find(s => s.scenarioType === 'POSITIVE')).toBeDefined();
    expect(profileScenarios.find(s => s.scenarioType === 'NEGATIVE')).toBeDefined();
  });

  it('should deduplicate scenarios keeping the one with highest confidence', async () => {
    const rawLlmScenarios = {
      scenarios: [
        // Duplicates on User Auth: Same name, type, and parent features
        {
          scenarioName: 'Authenticate User with Valid Credentials',
          scenarioType: 'POSITIVE',
          priority: 'CRITICAL',
          description: 'Ensure a user can sign in using a valid username and password combination.',
          confidenceScore: 0.8,
          riskLevel: 'CRITICAL',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', '/api/auth/login']
        },
        {
          scenarioName: 'Authenticate User with Valid Credentials', // duplicate name
          scenarioType: 'POSITIVE',
          priority: 'CRITICAL',
          description: 'Ensure a user can sign in using a valid username and password combination.',
          confidenceScore: 0.95, // higher confidence score
          riskLevel: 'CRITICAL',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', '/api/auth/login']
        },
        {
          scenarioName: 'Authenticate User with Invalid Credentials',
          scenarioType: 'NEGATIVE',
          priority: 'HIGH',
          description: 'Ensure user login fails gracefully and displays proper error messages for incorrect passwords.',
          confidenceScore: 0.9,
          riskLevel: 'HIGH',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', '/api/auth/login']
        },
        {
          scenarioName: 'Prevent SQL Injection in Login Fields',
          scenarioType: 'SECURITY',
          priority: 'CRITICAL',
          description: 'Verify login form sanitized input fields block potential SQL injection payload vectors.',
          confidenceScore: 0.98,
          riskLevel: 'CRITICAL',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', 'loginForm']
        },
        
        // Profile scenarios
        {
          scenarioName: 'Update Profile with Valid Data',
          scenarioType: 'POSITIVE',
          priority: 'MEDIUM',
          description: 'Ensure profile fields mutate successfully in database when submitting valid profile forms.',
          confidenceScore: 0.88,
          riskLevel: 'MEDIUM',
          parentFeatures: ['User Profile'],
          sourceWorkflows: ['Update Profile Workflow'],
          evidence: ['/profile', 'profileForm']
        },
        {
          scenarioName: 'Fail Profile Update with Missing Required Fields',
          scenarioType: 'NEGATIVE',
          priority: 'MEDIUM',
          description: 'Verify profile validation schema triggers and alerts user if mandatory inputs are left blank.',
          confidenceScore: 0.85,
          riskLevel: 'MEDIUM',
          parentFeatures: ['User Profile'],
          sourceWorkflows: ['Update Profile Workflow'],
          evidence: ['/profile', 'profileForm']
        },
        {
          scenarioName: 'Update Profile with Empty Optional Description',
          scenarioType: 'EDGE_CASE',
          priority: 'LOW',
          description: 'Verify profile form submits cleanly without errors if optional biography description is omitted.',
          confidenceScore: 0.8,
          riskLevel: 'LOW',
          parentFeatures: ['User Profile'],
          sourceWorkflows: ['Update Profile Workflow'],
          evidence: ['/profile', '/api/profile/update']
        }
      ]
    };

    aiServiceMock.generateJson.mockResolvedValue(JSON.stringify(rawLlmScenarios));

    const result = await service.discoverScenarios(mockContext);

    // Deduplication should merge the first two, keeping the one with 0.95 confidence
    expect(result.length).toBe(6);
    const validCredentialsScenario = result.find(
      s => s.scenarioName === 'Authenticate User with Valid Credentials'
    )!;
    expect(validCredentialsScenario).toBeDefined();
    expect(validCredentialsScenario.confidenceScore).toBe(0.95);
  });

  it('should throw an error if scenario count guardrail is violated', async () => {
    const rawLlmScenarios = {
      scenarios: [
        // Only 2 scenarios for User Auth (under minimum of 3)
        {
          scenarioName: 'Authenticate User with Valid Credentials',
          scenarioType: 'POSITIVE',
          priority: 'CRITICAL',
          description: 'Ensure a user can sign in using a valid username and password combination.',
          confidenceScore: 0.95,
          riskLevel: 'CRITICAL',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', '/api/auth/login']
        },
        {
          scenarioName: 'Authenticate User with Invalid Credentials',
          scenarioType: 'NEGATIVE',
          priority: 'HIGH',
          description: 'Ensure user login fails gracefully.',
          confidenceScore: 0.9,
          riskLevel: 'HIGH',
          parentFeatures: ['User Authentication'],
          sourceWorkflows: ['Login Workflow'],
          evidence: ['/login', '/api/auth/login']
        }
      ]
    };

    aiServiceMock.generateJson.mockResolvedValue(JSON.stringify(rawLlmScenarios));

    await expect(service.discoverScenarios(mockContext)).rejects.toThrow(
      /does not meet minimum scenario count guardrail/
    );
  });
});
