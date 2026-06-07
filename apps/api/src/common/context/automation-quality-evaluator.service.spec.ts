import { Test, TestingModule } from '@nestjs/testing';
import { AutomationQualityEvaluatorService } from './automation-quality-evaluator.service';
import { AiService } from '../ai/ai.service';
import { AppConfigService } from '../config/config.service';

describe('AutomationQualityEvaluatorService', () => {
  let service: AutomationQualityEvaluatorService;
  let aiServiceMock: jest.Mocked<AiService>;

  beforeEach(async () => {
    aiServiceMock = {
      generateJson: jest.fn().mockResolvedValue(JSON.stringify({
        maintainabilityScore: 90,
        assertionQualityScore: 85,
        warnings: ['Mocked AI warning']
      }))
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationQualityEvaluatorService,
        { provide: AiService, useValue: aiServiceMock },
        { provide: AppConfigService, useValue: {} }
      ]
    }).compile();

    service = module.get<AutomationQualityEvaluatorService>(AutomationQualityEvaluatorService);
  });

  const getBaseMockContext = () => ({
    contextVersion: '1.0.0' as const,
    targetFramework: 'PLAYWRIGHT' as const,
    testCases: [
      {
        testCaseId: '77777777-7777-7777-7777-777777777777',
        testCaseKey: 'TC-AUTH-001',
        contractVersion: '1.0.0' as const,
        testCaseName: 'Verify auth login',
        testCaseType: 'FUNCTIONAL' as const,
        priority: 'HIGH' as const,
        description: 'Verify login functionality with valid user credential inputs.',
        preconditions: ['User on home'],
        steps: [{ stepNumber: 1, action: 'Fill credentials', expectedResult: 'Login succeeds' }],
        expectedResult: 'Login succeeds',
        evidence: [],
        riskLevel: 'MEDIUM' as const,
        coverageTargets: { routes: ['/login'], apis: ['/api/v1/auth'], forms: [] },
        testCaseOrigin: {
          featureIds: ['f-1'],
          scenarioIds: ['s-1'],
          testCaseIds: ['tc-1'],
          workflowIds: []
        },
        automationStatus: 'UNAUTOMATED' as const,
        qualityScore: 90
      }
    ],
    interactionRegistry: {
      elements: [
        { elementId: 'el-1', elementName: 'username', selector: '#username', pageRoute: '/login' },
        { elementId: 'el-2', elementName: 'submit', selector: '#submit', pageRoute: '/login' }
      ],
      routes: ['/login', '/dashboard'],
      apis: ['/api/v1/auth'],
      forms: []
    },
    frameworkConfiguration: {
      configurationVersion: '1.0.0' as const,
      framework: 'PLAYWRIGHT' as const,
      language: 'TYPESCRIPT',
      testStructure: 'PAGE_OBJECT_MODEL'
    },
    automationGenerationReadiness: { ready: true, blockingReasons: [] }
  });

  const getBaseMockScripts = () => [
    {
      scriptId: '11111111-1111-1111-1111-111111111111',
      testCaseId: '77777777-7777-7777-7777-777777777777',
      contractVersion: '1.0.0' as const,
      filePath: 'tests/auth.spec.ts',
      framework: 'PLAYWRIGHT' as const,
      confidenceScore: 0.9,
      automationOrigin: {
        featureIds: ['f-1'],
        scenarioIds: ['s-1'],
        testCaseIds: ['77777777-7777-7777-7777-777777777777'],
        workflowIds: []
      },
      codeContent: `
        import { test, expect } from '@playwright/test';
        import { LoginPage } from './pages/auth.page';

        test('verify user login', async ({ page }) => {
          const loginPage = new LoginPage(page);
          await page.goto('/login');
          await loginPage.enterUsername();
          await expect(page.locator('#username')).toBeVisible();
        });
      `,
      pageObjectFilePath: 'tests/pages/auth.page.ts',
      pageObjectCode: `
        import { Page } from '@playwright/test';
        export class LoginPage {
          constructor(private page: Page) {}
          async enterUsername() {
            await this.page.locator('#username').fill('user');
          }
        }
      `
    }
  ];

  it('should pass quality evaluation for fully valid inputs', async () => {
    const result = await service.evaluateAutomation(getBaseMockScripts(), getBaseMockContext());
    expect(result.scorecard).toBeDefined();
    expect(result.scorecard.overallQualityScore).toBeGreaterThanOrEqual(70);
    expect(result.scorecard.automationExecutionReadiness.ready).toBe(true);
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0].syntaxScore).toBe(100);
    expect(result.evaluations[0].crossFileIntegrityScore).toBe(100);
  });

  it('should decrease syntax score on TypeScript compilation errors', async () => {
    const badScripts = getBaseMockScripts();
    // Insert invalid syntax (unclosed curly brace)
    badScripts[0].codeContent += '\n const x = { ';

    const result = await service.evaluateAutomation(badScripts, getBaseMockContext());
    expect(result.evaluations[0].syntaxScore).toBeLessThan(100);
    expect(result.evaluations[0].warnings.some(w => w.includes('[SYNTAX]'))).toBe(true);
  });

  it('should flag ungrounded elements and decrease grounding score', async () => {
    const badScripts = getBaseMockScripts();
    // Add selector not present in candidate registry
    badScripts[0].codeContent += `\n await page.locator('#hallucinated-id').click();`;

    const result = await service.evaluateAutomation(badScripts, getBaseMockContext());
    expect(result.evaluations[0].groundingScore).toBeLessThan(100);
    expect(result.evaluations[0].warnings.some(w => w.includes('[GROUNDING]'))).toBe(true);
  });

  it('should detect prohibited locator methods like getByText', async () => {
    const badScripts = getBaseMockScripts();
    // Use prohibited locator method
    badScripts[0].codeContent += `\n await page.getByText('Login').click();`;

    const result = await service.evaluateAutomation(badScripts, getBaseMockContext());
    expect(result.evaluations[0].warnings.some(w => w.includes('Prohibited locator method'))).toBe(true);
  });

  it('should deduct compliance score on Playwright guideline failures', async () => {
    const badScripts = getBaseMockScripts();
    // Add sleep statement and missing awaits
    badScripts[0].codeContent += `\n await page.waitForTimeout(5000);\n page.click('#submit');`;

    const result = await service.evaluateAutomation(badScripts, getBaseMockContext());
    expect(result.evaluations[0].complianceScore).toBeLessThan(100);
    expect(result.evaluations[0].warnings.some(w => w.includes('[COMPLIANCE]'))).toBe(true);
  });

  it('should decrease cross-file integrity score on missing method mappings', async () => {
    const badScripts = getBaseMockScripts();
    // Call method in spec that is not declared in page object
    badScripts[0].codeContent += `\n await loginPage.nonExistentMethod();`;

    const result = await service.evaluateAutomation(badScripts, getBaseMockContext());
    expect(result.evaluations[0].crossFileIntegrityScore).toBeLessThan(100);
    expect(result.evaluations[0].warnings.some(w => w.includes('[CROSS_FILE]'))).toBe(true);
  });

  it('should use default maintainability score of 70 if AI Critic fails', async () => {
    aiServiceMock.generateJson.mockRejectedValueOnce(new Error('API Timeout'));
    
    const result = await service.evaluateAutomation(getBaseMockScripts(), getBaseMockContext());
    expect(result.evaluations[0].maintainabilityScore).toBe(70);
    expect(result.evaluations[0].warnings.some(w => w.includes('[AI_CRITIC] Review failed'))).toBe(true);
  });

  it('should block execution readiness if average quality falls below 70', async () => {
    const badScripts = getBaseMockScripts();
    // Introduce heavy grounding errors to lower overall quality score
    badScripts[0].codeContent += `
      await page.locator('#un-1').click();
      await page.locator('#un-2').click();
      await page.locator('#un-3').click();
      await page.locator('#un-4').click();
    `;

    const result = await service.evaluateAutomation(badScripts, getBaseMockContext());
    expect(result.scorecard.overallQualityScore).toBeLessThan(70);
    expect(result.scorecard.automationExecutionReadiness.ready).toBe(false);
    expect(result.scorecard.automationExecutionReadiness.blockingReasons.some(r => r.includes('Average'))).toBe(true);
  });
});
