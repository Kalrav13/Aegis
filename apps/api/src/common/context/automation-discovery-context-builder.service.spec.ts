import { Test, TestingModule } from '@nestjs/testing';
import { AutomationDiscoveryContextBuilderService } from './automation-discovery-context-builder.service';
import { AppConfigService } from '../config/config.service';
import { TestCase, TestCaseQualityScorecard } from '@testlens/contracts';

describe('AutomationDiscoveryContextBuilderService', () => {
  let service: AutomationDiscoveryContextBuilderService;
  let appConfigServiceMock: any;

  const mockScorecard: TestCaseQualityScorecard = {
    evaluationVersion: '1.0.0',
    overallTestCaseQualityScore: 85,
    totalTestCasesEvaluated: 1,
    passingTestCasesCount: 1,
    failingTestCasesCount: 0,
    testCasesEvaluations: [
      {
        testCaseId: 'tc-login-1',
        qualityScore: 90,
        completenessScore: 90,
        groundingScore: 90,
        traceabilityScore: 90,
        stepStructureScore: 90,
        warnings: []
      }
    ],
    testCaseGenerationReadiness: {
      ready: true,
      blockingReasons: []
    },
    globalWarnings: []
  };

  const mockRegistry = {
    elements: [
      { elementId: 'el-login', elementName: 'Login Button', selector: '#login', pageRoute: '/login' }
    ],
    routes: ['/login'],
    apis: ['POST /api/auth'],
    forms: ['loginForm']
  };

  beforeEach(async () => {
    appConfigServiceMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationDiscoveryContextBuilderService,
        {
          provide: AppConfigService,
          useValue: appConfigServiceMock
        }
      ]
    }).compile();

    service = module.get<AutomationDiscoveryContextBuilderService>(
      AutomationDiscoveryContextBuilderService
    );
  });

  it('should compile context and build default framework configurations', () => {
    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-login-1',
        testCaseKey: 'TC-LOGIN-001',
        contractVersion: '1.0.0',
        testCaseName: 'Verify login completes successfully',
        testCaseType: 'FUNCTIONAL',
        priority: 'HIGH',
        description: 'Verify login flow is successful when user provides valid credentials.',
        preconditions: ['User is on page'],
        steps: [{ stepNumber: 1, action: 'Click', expectedResult: 'Page' }],
        expectedResult: 'Success',
        evidence: ['/login'],
        riskLevel: 'HIGH',
        coverageTargets: { routes: ['/login'], apis: ['/api/auth'], forms: [] },
        testCaseOrigin: { featureIds: ['feat-auth'], scenarioIds: ['scen-login'], workflowIds: ['wf-login'] },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const context = service.buildContext(mockTestCases, mockScorecard, mockRegistry);

    expect(context.contextVersion).toBe('1.0.0');
    expect(context.builderMetadata.testCasesCount).toBe(1);
    expect(context.frameworkConfiguration.framework).toBe('PLAYWRIGHT');
    expect(context.frameworkConfiguration.configurationVersion).toBe('1.0.0');
    expect(context.automationGenerationReadiness.ready).toBe(true);
  });

  it('should filter out test cases with quality score under 50', () => {
    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-low',
        testCaseKey: 'TC-LOW-001',
        contractVersion: '1.0.0',
        testCaseName: 'Low quality case',
        testCaseType: 'FUNCTIONAL',
        priority: 'LOW',
        description: 'Case description details.',
        preconditions: [],
        steps: [],
        expectedResult: 'Fails',
        evidence: [],
        riskLevel: 'LOW',
        coverageTargets: { routes: [], apis: [], forms: [] },
        testCaseOrigin: { featureIds: [], scenarioIds: [], workflowIds: [] },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const scorecardLow: TestCaseQualityScorecard = {
      ...mockScorecard,
      testCasesEvaluations: [
        {
          testCaseId: 'tc-low',
          qualityScore: 40, // < 50
          completenessScore: 40,
          groundingScore: 40,
          traceabilityScore: 40,
          stepStructureScore: 40,
          warnings: []
        }
      ]
    };

    const context = service.buildContext(mockTestCases, scorecardLow, mockRegistry);
    expect(context.testCases.length).toBe(0);
    expect(context.automationGenerationReadiness.ready).toBe(false);
  });

  it('should deduplicate and normalize interaction registry elements, routes, APIs, and forms', () => {
    const duplicateRegistry = {
      elements: [
        { elementId: 'el-1', elementName: 'Login', selector: '#login', pageRoute: '/login' },
        { elementId: 'el-1-dup', elementName: 'Login Dup', selector: '#login', pageRoute: '/login' }
      ],
      routes: ['/LOGIN', '/login', ''],
      apis: ['POST /api/auth', 'post /api/auth'],
      forms: ['loginForm', 'loginForm', ' ']
    };

    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-login-1',
        testCaseKey: 'TC-LOGIN-001',
        contractVersion: '1.0.0',
        testCaseName: 'Verify login completes successfully',
        testCaseType: 'FUNCTIONAL',
        priority: 'HIGH',
        description: 'Verify login flow description detail.',
        preconditions: [],
        steps: [],
        expectedResult: 'Success',
        evidence: ['/login'],
        riskLevel: 'HIGH',
        coverageTargets: { routes: [], apis: [], forms: [] },
        testCaseOrigin: { featureIds: ['feat-auth'], scenarioIds: ['scen-login'], workflowIds: [] },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const context = service.buildContext(mockTestCases, mockScorecard, duplicateRegistry);
    expect(context.interactionRegistry.elements.length).toBe(1);
    expect(context.interactionRegistry.routes).toEqual(['/login']);
    expect(context.interactionRegistry.apis).toEqual(['post /api/auth']);
    expect(context.interactionRegistry.forms).toEqual(['loginForm']);
  });

  it('should enforce readiness gates under different failures and allow API-only headless repos', () => {
    // 1. All assets empty -> ready = false
    const emptyRegistry = { elements: [], routes: [], apis: [], forms: [] };
    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-login-1',
        testCaseKey: 'TC-LOGIN-001',
        contractVersion: '1.0.0',
        testCaseName: 'Verify login',
        testCaseType: 'FUNCTIONAL',
        priority: 'HIGH',
        description: 'Verify login flow description detail.',
        preconditions: [],
        steps: [],
        expectedResult: 'Success',
        evidence: ['/login'],
        riskLevel: 'HIGH',
        coverageTargets: { routes: [], apis: [], forms: [] },
        testCaseOrigin: { featureIds: ['feat-auth'], scenarioIds: ['scen-login'], workflowIds: [] },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    let context = service.buildContext(mockTestCases, mockScorecard, emptyRegistry);
    expect(context.automationGenerationReadiness.ready).toBe(false);
    expect(context.automationGenerationReadiness.blockingReasons).toContain(
      'No candidate assets (selectors, routes, APIs, or forms) available in interaction registry.'
    );

    // 2. API-only repository -> ready = true
    const apiOnlyRegistry = { elements: [], routes: [], apis: ['GET /api/users'], forms: [] };
    context = service.buildContext(mockTestCases, mockScorecard, apiOnlyRegistry);
    expect(context.automationGenerationReadiness.ready).toBe(true);
  });

  it('should truncate test case descriptions exceeding 500 characters', () => {
    const longDesc = 'A'.repeat(550);
    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-login-1',
        testCaseKey: 'TC-LOGIN-001',
        contractVersion: '1.0.0',
        testCaseName: 'Verify login completes successfully',
        testCaseType: 'FUNCTIONAL',
        priority: 'HIGH',
        description: longDesc,
        preconditions: [],
        steps: [],
        expectedResult: 'Success',
        evidence: ['/login'],
        riskLevel: 'HIGH',
        coverageTargets: { routes: [], apis: [], forms: [] },
        testCaseOrigin: { featureIds: ['feat-auth'], scenarioIds: ['scen-login'], workflowIds: [] },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const context = service.buildContext(mockTestCases, mockScorecard, mockRegistry);
    expect(context.testCases[0].description.length).toBe(500);
    expect(context.testCases[0].description.endsWith('...')).toBe(true);
  });

  it('should enforce scenario and feature pruning limits', () => {
    // Generate 18 test cases for the same scenario and feature
    const mockTestCases: TestCase[] = [];
    const evaluationsList: any[] = [];
    for (let i = 1; i <= 18; i++) {
      const tcId = `tc-${i}`;
      mockTestCases.push({
        testCaseId: tcId,
        testCaseKey: `TC-KEY-${i}`,
        contractVersion: '1.0.0',
        testCaseName: `Test Case ${i}`,
        testCaseType: 'FUNCTIONAL',
        priority: 'MEDIUM',
        description: 'Verify test case description detail.',
        preconditions: [],
        steps: [],
        expectedResult: 'Success',
        evidence: ['/login'],
        riskLevel: 'MEDIUM',
        coverageTargets: { routes: [], apis: [], forms: [] },
        testCaseOrigin: { featureIds: ['feat-1'], scenarioIds: ['scen-1'], workflowIds: [] },
        automationStatus: 'UNAUTOMATED'
      });

      evaluationsList.push({
        testCaseId: tcId,
        qualityScore: 60 + i, // quality score increases with index
        completenessScore: 80,
        groundingScore: 80,
        traceabilityScore: 80,
        stepStructureScore: 80,
        warnings: []
      });
    }

    const customScorecard: TestCaseQualityScorecard = {
      ...mockScorecard,
      testCasesEvaluations: evaluationsList
    };

    const context = service.buildContext(mockTestCases, customScorecard, mockRegistry);
    
    // Scenario cap is max 5
    expect(context.testCases.length).toBe(5);
    
    // Check that we kept the 5 test cases with the highest quality scores (tc-18 down to tc-14)
    const includedIds = new Set(context.testCases.map(tc => tc.testCaseId));
    expect(includedIds.has('tc-18')).toBe(true);
    expect(includedIds.has('tc-14')).toBe(true);
    expect(includedIds.has('tc-1')).toBe(false);
  });
});
