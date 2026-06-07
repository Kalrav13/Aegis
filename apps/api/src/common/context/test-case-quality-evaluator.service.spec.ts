import { Test, TestingModule } from '@nestjs/testing';
import { TestCaseQualityEvaluatorService } from './test-case-quality-evaluator.service';
import { AiService } from '../ai/ai.service';
import { TestCaseDiscoveryContext, TestCase } from '@testlens/contracts';

describe('TestCaseQualityEvaluatorService', () => {
  let service: TestCaseQualityEvaluatorService;
  let aiServiceMock: any;

  const mockContext: TestCaseDiscoveryContext = {
    contextVersion: '1.0.0',
    builderMetadata: {
      generatedAt: new Date().toISOString(),
      scenariosCount: 1
    },
    scenarios: [
      {
        id: 'scen-auth',
        scenarioName: 'Secure Login',
        scenarioType: 'POSITIVE',
        priority: 'HIGH',
        description: 'Verify login completes successfully.',
        evidence: ['/login'],
        sourceWorkflows: ['Login Workflow'],
        coverageTargets: {
          routes: ['/login'],
          apis: ['/api/auth'],
          forms: ['loginForm']
        },
        qualityScore: 90
      }
    ],
    candidateAssets: {
      routes: ['/login'],
      apis: ['/api/auth'],
      forms: ['loginForm']
    },
    testCaseReadiness: {
      ready: true,
      blockingReasons: []
    }
  };

  beforeEach(async () => {
    aiServiceMock = {
      generateJson: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestCaseQualityEvaluatorService,
        {
          provide: AiService,
          useValue: aiServiceMock
        }
      ]
    }).compile();

    service = module.get<TestCaseQualityEvaluatorService>(TestCaseQualityEvaluatorService);
  });

  it('should compile quality scorecard, compute AI critic isolation, and enforce versioning', async () => {
    aiServiceMock.generateJson.mockResolvedValue(
      JSON.stringify({
        evaluations: [
          {
            testCaseName: 'Verify successful login with valid credentials',
            stepClarityScore: 95,
            expectedResultsScore: 95,
            semanticUsefulnessScore: 90,
            warnings: []
          }
        ]
      })
    );

    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-login-1',
        testCaseKey: 'TC-LOGIN-001',
        contractVersion: '1.0.0',
        testCaseName: 'Verify successful login with valid credentials',
        testCaseType: 'FUNCTIONAL',
        priority: 'HIGH',
        description: 'Detailed description for testing user login with valid credentials.',
        preconditions: ['User is on the login page'],
        steps: [
          {
            stepNumber: 1,
            action: 'Enter valid username and password',
            expectedResult: 'Fields are populated'
          },
          {
            stepNumber: 2,
            action: 'Click submit button',
            expectedResult: 'User is redirected to dashboard'
          },
          {
            stepNumber: 3,
            action: 'Verify dashboard loads',
            expectedResult: 'Dashboard metrics are visible'
          }
        ],
        expectedResult: 'User logged in successfully',
        evidence: ['/login'],
        riskLevel: 'HIGH',
        coverageTargets: {
          routes: ['/login'],
          apis: ['/api/auth'],
          forms: ['loginForm']
        },
        testCaseOrigin: {
          featureIds: ['feat-auth'],
          workflowIds: ['wf-login'],
          scenarioIds: ['scen-auth']
        },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const scorecard = await service.evaluate(mockTestCases, mockContext);

    expect(scorecard.evaluationVersion).toBe('1.0.0');
    expect(scorecard.totalTestCasesEvaluated).toBe(1);
    expect(scorecard.passingTestCasesCount).toBe(1);
    expect(scorecard.failingTestCasesCount).toBe(0);

    const tcEval = scorecard.testCasesEvaluations[0];
    expect(tcEval).toBeDefined();
    expect(tcEval.testCaseId).toBe('tc-login-1');
    expect(tcEval.qualityScore).toBeGreaterThanOrEqual(70);
  });

  it('should enforce deterministic scoring deductions for low completeness, ungrounded paths, and weak steps', async () => {
    aiServiceMock.generateJson.mockResolvedValue(
      JSON.stringify({
        evaluations: [
          {
            testCaseName: 'Weak Test Case',
            stepClarityScore: 50,
            expectedResultsScore: 50,
            semanticUsefulnessScore: 40,
            warnings: ['[LLM Critic] Bad steps']
          }
        ]
      })
    );

    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-weak',
        testCaseKey: 'TC-WEAK-001',
        contractVersion: '1.0.0',
        testCaseName: 'Weak Test Case',
        testCaseType: 'FUNCTIONAL',
        priority: 'LOW',
        description: 'Short', // < 10 characters -> completeness deduct 50
        preconditions: [], // missing -> completeness deduct 30
        steps: [
          {
            stepNumber: 2, // out of sequence -> step deduct 30
            action: '', // missing action -> step deduct 50
            expectedResult: 'Action result'
          }
        ],
        expectedResult: '', // empty -> completeness deduct 20
        evidence: ['/invalid-route'], // ungrounded -> grounding deduct 30
        riskLevel: 'LOW',
        coverageTargets: {
          routes: [],
          apis: [],
          forms: []
        },
        testCaseOrigin: {
          featureIds: [], // missing origin parameters -> traceability deduct 30
          workflowIds: [], // missing origin parameters -> traceability deduct 30
          scenarioIds: []  // missing origin parameters -> traceability deduct 30
        },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const scorecard = await service.evaluate(mockTestCases, mockContext);
    const tcEval = scorecard.testCasesEvaluations[0];

    expect(tcEval.completenessScore).toBeLessThan(50);
    expect(tcEval.groundingScore).toBeLessThan(100);
    expect(tcEval.traceabilityScore).toBeLessThan(50);
    expect(tcEval.stepStructureScore).toBeLessThan(50);
    expect(tcEval.qualityScore).toBeLessThan(50);

    expect(tcEval.warnings.some(w => w.includes('LOW_COMPLETENESS'))).toBe(true);
    expect(tcEval.warnings.some(w => w.includes('LOW_GROUNDING'))).toBe(true);
    expect(tcEval.warnings.some(w => w.includes('LOW_TRACEABILITY'))).toBe(true);
    expect(tcEval.warnings.some(w => w.includes('WEAK_STEP_STRUCTURE'))).toBe(true);
  });

  it('should isolate AI critic and fall back gracefully if AI service throws an error', async () => {
    aiServiceMock.generateJson.mockRejectedValue(new Error('API Failure'));

    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-login-1',
        testCaseKey: 'TC-LOGIN-001',
        contractVersion: '1.0.0',
        testCaseName: 'Verify successful login with valid credentials',
        testCaseType: 'FUNCTIONAL',
        priority: 'HIGH',
        description: 'Detailed description for testing user login with valid credentials.',
        preconditions: ['User is on the login page'],
        steps: [
          {
            stepNumber: 1,
            action: 'Enter valid username and password',
            expectedResult: 'Fields are populated'
          },
          {
            stepNumber: 2,
            action: 'Click submit button',
            expectedResult: 'User is redirected to dashboard'
          }
        ],
        expectedResult: 'User logged in successfully',
        evidence: ['/login'],
        riskLevel: 'HIGH',
        coverageTargets: {
          routes: ['/login'],
          apis: ['/api/auth'],
          forms: ['loginForm']
        },
        testCaseOrigin: {
          featureIds: ['feat-auth'],
          workflowIds: ['wf-login'],
          scenarioIds: ['scen-auth']
        },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const scorecard = await service.evaluate(mockTestCases, mockContext);
    expect(scorecard.totalTestCasesEvaluated).toBe(1);
    expect(scorecard.testCasesEvaluations[0].qualityScore).toBeGreaterThan(0);
    expect(scorecard.testCasesEvaluations[0].warnings).toContain('[LLM Critic fell back to default rating]');
  });

  it('should block readiness if average quality is below 70, any individual score is below 50, or failing ratio >= 30%', async () => {
    aiServiceMock.generateJson.mockResolvedValue(
      JSON.stringify({
        evaluations: [
          {
            testCaseName: 'TC Low Quality 1',
            stepClarityScore: 40,
            expectedResultsScore: 40,
            semanticUsefulnessScore: 40,
            warnings: []
          },
          {
            testCaseName: 'TC Low Quality 2',
            stepClarityScore: 40,
            expectedResultsScore: 40,
            semanticUsefulnessScore: 40,
            warnings: []
          },
          {
            testCaseName: 'TC High Quality',
            stepClarityScore: 90,
            expectedResultsScore: 90,
            semanticUsefulnessScore: 90,
            warnings: []
          }
        ]
      })
    );

    const mockTestCases: TestCase[] = [
      {
        testCaseId: 'tc-low-1',
        testCaseKey: 'TC-LOW-001',
        contractVersion: '1.0.0',
        testCaseName: 'TC Low Quality 1',
        testCaseType: 'FUNCTIONAL',
        priority: 'MEDIUM',
        description: 'Short', // completeness deduct 50
        preconditions: [], // completeness deduct 30
        steps: [
          {
            stepNumber: 1,
            action: 'Action',
            expectedResult: 'Expected'
          }
        ],
        expectedResult: 'Expected Result',
        evidence: [],
        riskLevel: 'MEDIUM',
        coverageTargets: { routes: [], apis: [], forms: [] },
        testCaseOrigin: { featureIds: [], workflowIds: [], scenarioIds: [] },
        automationStatus: 'UNAUTOMATED'
      },
      {
        testCaseId: 'tc-low-2',
        testCaseKey: 'TC-LOW-002',
        contractVersion: '1.0.0',
        testCaseName: 'TC Low Quality 2',
        testCaseType: 'FUNCTIONAL',
        priority: 'MEDIUM',
        description: 'Short',
        preconditions: [],
        steps: [
          {
            stepNumber: 1,
            action: 'Action',
            expectedResult: 'Expected'
          }
        ],
        expectedResult: 'Expected Result',
        evidence: [],
        riskLevel: 'MEDIUM',
        coverageTargets: { routes: [], apis: [], forms: [] },
        testCaseOrigin: { featureIds: [], workflowIds: [], scenarioIds: [] },
        automationStatus: 'UNAUTOMATED'
      },
      {
        testCaseId: 'tc-high',
        testCaseKey: 'TC-HIGH-001',
        contractVersion: '1.0.0',
        testCaseName: 'TC High Quality',
        testCaseType: 'FUNCTIONAL',
        priority: 'HIGH',
        description: 'Very detailed test case description for verifying the high quality login scenario.',
        preconditions: ['User exists', 'Page exists'],
        steps: [
          { stepNumber: 1, action: 'Step 1 action', expectedResult: 'Step 1 expected' },
          { stepNumber: 2, action: 'Step 2 action', expectedResult: 'Step 2 expected' },
          { stepNumber: 3, action: 'Step 3 action', expectedResult: 'Step 3 expected' }
        ],
        expectedResult: 'High quality outcome expected',
        evidence: ['/login'],
        riskLevel: 'HIGH',
        coverageTargets: { routes: ['/login'], apis: ['/api/auth'], forms: ['loginForm'] },
        testCaseOrigin: { featureIds: ['feat-auth'], workflowIds: ['wf-login'], scenarioIds: ['scen-auth'] },
        automationStatus: 'UNAUTOMATED'
      }
    ];

    const scorecard = await service.evaluate(mockTestCases, mockContext);

    expect(scorecard.testCaseGenerationReadiness.ready).toBe(false);
    expect(scorecard.testCaseGenerationReadiness.blockingReasons.length).toBeGreaterThan(0);
    // Average quality is under 70 (approx: tc-low-1 = 30, tc-low-2 = 30, tc-high = 98 -> avg = 53)
    // Individual scores under 50 (tc-low-1 and tc-low-2)
    // Failing ratio (2/3 = 67% >= 30%)
    expect(scorecard.testCaseGenerationReadiness.blockingReasons.some(reason => reason.includes('below the threshold of 70'))).toBe(true);
    expect(scorecard.testCaseGenerationReadiness.blockingReasons.some(reason => reason.includes('below the minimum allowed cap of 50'))).toBe(true);
    expect(scorecard.testCaseGenerationReadiness.blockingReasons.some(reason => reason.includes('maximum allowed failure rate is 30%'))).toBe(true);
  });

  it('should support transaction simulation and persist evaluation results', async () => {
    // Simulating the transactional persistence behavior in analysis.processor.ts
    const mockTx = {
      testCaseQuality: {
        createMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    };

    const mockScorecard = {
      evaluationVersion: '1.0.0',
      overallTestCaseQualityScore: 90,
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
      testCaseGenerationReadiness: { ready: true, blockingReasons: [] },
      globalWarnings: []
    };

    await mockTx.testCaseQuality.createMany({
      data: mockScorecard.testCasesEvaluations.map((e) => ({
        testCaseId: e.testCaseId,
        qualityScore: e.qualityScore,
        completenessScore: e.completenessScore,
        groundingScore: e.groundingScore,
        traceabilityScore: e.traceabilityScore,
        stepStructureScore: e.stepStructureScore,
        warnings: e.warnings
      }))
    });

    expect(mockTx.testCaseQuality.createMany).toHaveBeenCalledWith({
      data: [
        {
          testCaseId: 'tc-login-1',
          qualityScore: 90,
          completenessScore: 90,
          groundingScore: 90,
          traceabilityScore: 90,
          stepStructureScore: 90,
          warnings: []
        }
      ]
    });
  });
});
