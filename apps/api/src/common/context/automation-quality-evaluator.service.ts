import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AppConfigService } from '../config/config.service';
import {
  AutomationDiscoveryContext,
  AutomationQuality,
  AutomationQualityScorecard,
  validateAutomationQuality,
  validateAutomationQualityScorecard
} from '@testlens/contracts';
import * as ts from 'typescript';
import { randomUUID } from 'crypto';

@Injectable()
export class AutomationQualityEvaluatorService {
  constructor(
    private readonly aiService: AiService,
    private readonly appConfigService: AppConfigService
  ) {}

  /**
   * Performs complete quality evaluation on generated automation scripts.
   */
  public async evaluateAutomation(
    scripts: any[],
    context: AutomationDiscoveryContext
  ): Promise<{ scorecard: AutomationQualityScorecard; evaluations: any[] }> {
    const generatedAt = new Date().toISOString();
    const testCasesCount = context.testCases.length;
    const scriptsCount = scripts.length;
    
    // Calculate initial failures from generation stage
    const generationFailures = context.testCases.filter(
      tc => !scripts.some(s => s.testCaseId === tc.testCaseId)
    ).length;

    const evaluations: any[] = [];
    let validationFailuresCount = 0;

    const whitelistSelectors = new Set(context.interactionRegistry.elements.map(e => e.selector.trim()));
    const whitelistRoutes = new Set(context.interactionRegistry.routes.map(r => r.toLowerCase().trim()));
    const whitelistApis = new Set(context.interactionRegistry.apis.map(a => a.toLowerCase().trim()));

    // 1. Audit each generated script
    for (const script of scripts) {
      const warnings: string[] = [];

      // A. Structural Validation Engine
      const isStructureValid = this.validateStructure(script, warnings);

      // B. Syntax Validation Engine
      const syntaxScore = this.validateSyntax(script.codeContent, script.pageObjectCode, warnings);

      // C. Grounding Validation Engine
      const groundingMetrics = this.validateGrounding(
        script.codeContent,
        script.pageObjectCode,
        whitelistSelectors,
        whitelistRoutes,
        whitelistApis,
        warnings
      );
      const groundingScore = Math.round(groundingMetrics.groundingDensity * 100);

      // D. Traceability Validation Engine
      const traceabilityScore = this.validateTraceability(script.automationOrigin, warnings);

      // E. Framework Compliance Engine
      const complianceScore = this.validateFrameworkCompliance(script.codeContent, warnings);

      // F. Cross-File Integrity Engine
      const crossFileIntegrityScore = this.validateCrossFileIntegrity(
        script.filePath,
        script.codeContent,
        script.pageObjectFilePath,
        script.pageObjectCode,
        whitelistSelectors,
        warnings
      );

      // G. AI Critic Engine (Isolated Review)
      let maintainabilityScore = 70; // Fallback score
      try {
        const criticResult = await this.runAiCritic(script.codeContent, script.pageObjectCode);
        maintainabilityScore = criticResult.maintainabilityScore;
        if (criticResult.warnings) {
          warnings.push(...criticResult.warnings.map((w: string) => `[AI_CRITIC] ${w}`));
        }
      } catch (error: any) {
        warnings.push(`[AI_CRITIC] Review failed or timed out: ${error.message}. Applied fallback score.`);
      }

      // H. Score Aggregation Engine
      // Quality Score = 0.15*Syntax + 0.15*Compliance + 0.15*Maintainability + 0.25*Grounding + 0.15*Traceability + 0.15*CrossFileIntegrity
      const rawQualityScore = (
        0.15 * syntaxScore +
        0.15 * complianceScore +
        0.15 * maintainabilityScore +
        0.25 * groundingScore +
        0.15 * traceabilityScore +
        0.15 * crossFileIntegrityScore
      );
      const qualityScore = Math.round(rawQualityScore * 100) / 100;

      if (qualityScore < 50) {
        validationFailuresCount++;
      }

      evaluations.push({
        id: randomUUID(),
        scriptId: script.scriptId,
        testCaseId: script.testCaseId,
        qualityScore,
        syntaxScore,
        complianceScore,
        maintainabilityScore,
        groundingScore,
        traceabilityScore,
        crossFileIntegrityScore,
        warnings,
        groundingDensity: groundingMetrics.groundingDensity // passed back temporarily
      });
    }

    const totalFailures = generationFailures + validationFailuresCount;

    // I. Readiness Evaluation Engine
    const blockingReasons: string[] = [];

    // Rule 1: Average quality score >= 70
    const totalQuality = evaluations.reduce((sum, curr) => sum + curr.qualityScore, 0);
    const avgQuality = evaluations.length > 0 ? totalQuality / evaluations.length : 0;
    if (evaluations.length === 0 || avgQuality < 70) {
      blockingReasons.push(`Average automation quality score of ${avgQuality.toFixed(1)} is below the minimum threshold of 70.`);
    }

    // Rule 2: Any script quality < 50
    const severeFailures = evaluations.filter(e => e.qualityScore < 50);
    if (severeFailures.length > 0) {
      blockingReasons.push(`${severeFailures.length} script(s) failed the minimum quality score floor of 50.`);
    }

    // Rule 3: Failure ratio >= 30%
    const failureRatio = testCasesCount > 0 ? totalFailures / testCasesCount : 1.0;
    if (failureRatio >= 0.3) {
      blockingReasons.push(`Automation failure ratio of ${(failureRatio * 100).toFixed(1)}% exceeds the maximum limit of 30%.`);
    }

    // Rule 4: Critical Grounding density < 80% (groundingScore < 80)
    const criticalGroundingIssues = evaluations.filter(e => e.groundingScore < 80);
    if (criticalGroundingIssues.length > 0) {
      blockingReasons.push(`${criticalGroundingIssues.length} script(s) have critical grounding failures (density below 80%).`);
    }

    // Rule 5: Cross-file integrity failures (crossFileIntegrityScore < 100)
    const crossFileIssues = evaluations.filter(e => e.crossFileIntegrityScore < 100);
    if (crossFileIssues.length > 0) {
      blockingReasons.push(`${crossFileIssues.length} script(s) have cross-file integrity linkage failures.`);
    }

    const automationExecutionReadiness = {
      ready: blockingReasons.length === 0,
      blockingReasons
    };

    const scorecard = {
      evaluationVersion: "1.0.0" as const,
      generatedAt,
      scriptsCount,
      failuresCount: totalFailures,
      overallQualityScore: Math.round(avgQuality * 100) / 100,
      automationExecutionReadiness
    };

    // Assert validation on output contract
    validateAutomationQualityScorecard(scorecard);

    return {
      scorecard,
      evaluations
    };
  }

  /**
   * A. Structural Validation Engine
   */
  private validateStructure(script: any, warnings: string[]): boolean {
    if (!script.scriptId) {
      warnings.push('[STRUCTURE] Missing required field: scriptId');
      return false;
    }
    if (!script.testCaseId) {
      warnings.push('[STRUCTURE] Missing required field: testCaseId');
      return false;
    }
    if (!script.filePath) {
      warnings.push('[STRUCTURE] Missing required field: filePath');
      return false;
    }
    if (!script.codeContent) {
      warnings.push('[STRUCTURE] Missing required field: codeContent');
      return false;
    }
    return true;
  }

  /**
   * B. Syntax Validation Engine
   */
  private validateSyntax(code: string, pageObjectCode: string | undefined, warnings: string[]): number {
    let specDiagnostics = 0;
    let pageDiagnostics = 0;

    try {
      const specResult = ts.transpileModule(code, {
        compilerOptions: { noEmitOnError: true, target: ts.ScriptTarget.ES2020 }
      });
      if (specResult.diagnostics && specResult.diagnostics.length > 0) {
        specDiagnostics += specResult.diagnostics.length;
        warnings.push(`[SYNTAX] Spec file failed typescript compilation with ${specResult.diagnostics.length} diagnostic warnings.`);
      }
    } catch (e: any) {
      specDiagnostics++;
      warnings.push(`[SYNTAX] Spec syntax check crashed: ${e.message}`);
    }

    if (pageObjectCode) {
      try {
        const pageResult = ts.transpileModule(pageObjectCode, {
          compilerOptions: { noEmitOnError: true, target: ts.ScriptTarget.ES2020 }
        });
        if (pageResult.diagnostics && pageResult.diagnostics.length > 0) {
          pageDiagnostics += pageResult.diagnostics.length;
          warnings.push(`[SYNTAX] Page Object file failed typescript compilation with ${pageResult.diagnostics.length} diagnostic warnings.`);
        }
      } catch (e: any) {
        pageDiagnostics++;
        warnings.push(`[SYNTAX] Page Object syntax check crashed: ${e.message}`);
      }
    }

    // Malformed imports/exports check (detecting export statements, import syntax)
    if (code.includes('import ') && !code.includes('from ')) {
      specDiagnostics++;
      warnings.push('[SYNTAX] Malformed import statements detected in spec file.');
    }
    if (pageObjectCode && pageObjectCode.includes('export ') && !pageObjectCode.includes('class ')) {
      pageDiagnostics++;
      warnings.push('[SYNTAX] Malformed export statements in Page Object file.');
    }

    const totalDiag = specDiagnostics + pageDiagnostics;
    return totalDiag === 0 ? 100 : Math.max(0, 100 - totalDiag * 20);
  }

  /**
   * C. Grounding Validation Engine
   */
  private validateGrounding(
    code: string,
    pageObjectCode: string | undefined,
    whitelistSelectors: Set<string>,
    whitelistRoutes: Set<string>,
    whitelistApis: Set<string>,
    warnings: string[]
  ): { groundingDensity: number; selectorCoverage: number } {
    const allActions: string[] = [];
    const groundedActions: string[] = [];

    const fullCode = `${code}\n${pageObjectCode || ''}`;

    // 1. Check goto routes
    const gotoRegex = /goto\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = gotoRegex.exec(fullCode)) !== null) {
      const route = match[1].trim();
      const normRoute = route.toLowerCase();
      allActions.push(`route:${normRoute}`);
      if (normRoute === '/' || normRoute.startsWith('http') || whitelistRoutes.has(normRoute)) {
        groundedActions.push(`route:${normRoute}`);
      } else {
        warnings.push(`[GROUNDING] Target route '${route}' is not present in the whitelisted Interaction Registry.`);
      }
    }

    // 2. Check APIs
    const apiRegex = /(?:request\.(?:post|get|put|delete|patch)|waitForResponse|waitForRequest)\(['"]([^'"]+)['"]/g;
    while ((match = apiRegex.exec(fullCode)) !== null) {
      const api = match[1].trim();
      const normApi = api.toLowerCase();
      allActions.push(`api:${normApi}`);
      if (normApi.startsWith('http') || whitelistApis.has(normApi)) {
        groundedActions.push(`api:${normApi}`);
      } else {
        warnings.push(`[GROUNDING] API endpoint '${api}' is not present in the whitelisted Interaction Registry.`);
      }
    }

    // 3. Check locators
    const locatorRegex = /locator\(['"]([^'"]+)['"]\)/g;
    while ((match = locatorRegex.exec(fullCode)) !== null) {
      const selector = match[1].trim();
      allActions.push(`selector:${selector}`);
      if (whitelistSelectors.has(selector)) {
        groundedActions.push(`selector:${selector}`);
      } else {
        warnings.push(`[GROUNDING] Selector '${selector}' is not present in the whitelisted Interaction Registry.`);
      }
    }

    // 4. Prohibited locator methods
    const prohibitedMethodsRegex = /(getByText|getByRole|getByPlaceholder|getByLabel|getByTestId)\(([^)]+)\)/g;
    while ((match = prohibitedMethodsRegex.exec(fullCode)) !== null) {
      const method = match[1];
      const args = match[2].trim();
      const cleanArg = args.replace(/^['"]|['"]$/g, '').trim();
      const callStr = `${method}(${args})`;
      allActions.push(`selector:${callStr}`);
      if (whitelistSelectors.has(cleanArg) || whitelistSelectors.has(callStr)) {
        groundedActions.push(`selector:${callStr}`);
      } else {
        warnings.push(`[GROUNDING] Prohibited locator method '${callStr}' is used but not explicitly whitelisted.`);
      }
    }

    // 5. Prohibited text locators
    const textLocatorRegex = /locator\(['"]text=([^'"]+)['"]\)/g;
    while ((match = textLocatorRegex.exec(fullCode)) !== null) {
      const textVal = match[1].trim();
      const callStr = `text=${textVal}`;
      allActions.push(`selector:${callStr}`);
      if (whitelistSelectors.has(callStr) || whitelistSelectors.has(textVal)) {
        groundedActions.push(`selector:${callStr}`);
      } else {
        warnings.push(`[GROUNDING] Prohibited text locator '${callStr}' is used but not explicitly whitelisted.`);
      }
    }

    const groundingDensity = allActions.length === 0 ? 1.0 : groundedActions.length / allActions.length;
    const uniqueActions = new Set(allActions);
    const uniqueGrounded = new Set(groundedActions);
    const selectorCoverage = uniqueActions.size === 0 ? 1.0 : uniqueGrounded.size / uniqueActions.size;

    return { groundingDensity, selectorCoverage };
  }

  /**
   * D. Traceability Validation Engine
   */
  private validateTraceability(origin: any, warnings: string[]): number {
    if (!origin) {
      warnings.push('[TRACEABILITY] Missing required traceability origin object.');
      return 0;
    }
    const hasFeatures = Array.isArray(origin.featureIds) && origin.featureIds.length > 0;
    const hasScenarios = Array.isArray(origin.scenarioIds) && origin.scenarioIds.length > 0;
    const hasTestCases = Array.isArray(origin.testCaseIds) && origin.testCaseIds.length > 0;
    
    if (!hasFeatures) {
      warnings.push('[TRACEABILITY] Missing feature mapping references.');
    }
    if (!hasScenarios) {
      warnings.push('[TRACEABILITY] Missing scenario mapping references.');
    }
    if (!hasTestCases) {
      warnings.push('[TRACEABILITY] Missing test case mapping references.');
    }

    return (hasFeatures && hasScenarios && hasTestCases) ? 100 : 50;
  }

  /**
   * E. Framework Compliance Engine
   */
  private validateFrameworkCompliance(code: string, warnings: string[]): number {
    let score = 100;

    // 1. Native auto waiting checks / Hardcoded timeout misuse
    const timeoutRegex = /waitForTimeout|page\.wait|sleep\(/g;
    if (timeoutRegex.test(code)) {
      score -= 30;
      warnings.push('[COMPLIANCE] Misuse of hardcoded wait timeouts detected. Playwright auto-waiting should be preferred.');
    }

    // 2. Playwright assertions presence check
    if (!code.includes('expect(')) {
      score -= 30;
      warnings.push('[COMPLIANCE] Script lacks native Playwright assertions (e.g. expect(locator).toBeVisible()).');
    }

    // 3. Async/await usage check
    // If we have key async methods but without awaits
    const missingAwaitRegex = /(?<!await\s+)(page\.(click|fill|goto|check|uncheck|selectOption))/g;
    if (missingAwaitRegex.test(code)) {
      score -= 20;
      warnings.push('[COMPLIANCE] Async Playwright action calls must be prepended with await.');
    }

    return Math.max(0, score);
  }

  /**
   * F. Cross-File Integrity Engine
   */
  private validateCrossFileIntegrity(
    specPath: string,
    specCode: string,
    pagePath: string | undefined,
    pageCode: string | undefined,
    whitelistSelectors: Set<string>,
    warnings: string[]
  ): number {
    if (!pagePath || !pageCode) {
      warnings.push('[CROSS_FILE] Page Object path or file is missing.');
      return 0;
    }

    let score = 100;

    // 1. Verify spec imports the correct Page Object class
    // Extract class name from pageCode
    const classMatch = pageCode.match(/export class (\w+)/);
    if (!classMatch) {
      score -= 25;
      warnings.push('[CROSS_FILE] Page Object file lacks valid exported class declaration.');
    } else {
      const className = classMatch[1];
      // Check spec imports this class
      if (!specCode.includes(className)) {
        score -= 25;
        warnings.push(`[CROSS_FILE] Spec file does not import the Page Object class '${className}'.`);
      }
    }

    // 2. Verify referenced methods exist in Page Object
    // Extract method calls on page object instance in spec file
    // e.g. loginPage.enterUsername(...) -> method is enterUsername
    const methodCallRegex = /\w+Page\.(\w+)\(/g;
    let match;
    while ((match = methodCallRegex.exec(specCode)) !== null) {
      const methodName = match[1];
      // Skip generic Playwright page methods
      if (['click', 'fill', 'goto', 'check', 'uncheck', 'selectOption', 'locator'].includes(methodName)) {
        continue;
      }
      // Check if method is declared in pageCode
      const methodDeclRegex = new RegExp(`(async\\s+)?${methodName}\\s*\\(`, 'g');
      if (!methodDeclRegex.test(pageCode)) {
        score -= 25;
        warnings.push(`[CROSS_FILE] Method '${methodName}' called in spec file is not declared in the Page Object class.`);
      }
    }

    // 3. Verify locator mappings exist in pageCode
    const locatorRegex = /locator\(['"]([^'"]+)['"]/g;
    while ((match = locatorRegex.exec(pageCode)) !== null) {
      const selector = match[1].trim();
      if (!whitelistSelectors.has(selector)) {
        score -= 10;
        warnings.push(`[CROSS_FILE] Selector '${selector}' registered in Page Object is not in the Interaction Registry.`);
      }
    }

    return Math.max(0, score);
  }

  /**
   * G. AI Critic Engine
   */
  private async runAiCritic(specCode: string, pageCode?: string): Promise<{ maintainabilityScore: number; warnings: string[] }> {
    const prompt = `
You are an isolated AI Critic evaluating the maintainability and design pattern adherence of these Playwright TypeScript POM scripts.
Provide scores and critiques. Do not propose code corrections.

=== SPECT TEST CODE ===
${specCode}

=== PAGE OBJECT CODE ===
${pageCode || 'None'}

=== CONTRACT RULES ===
Return a JSON object conforming exactly to this structure (no markdown wrap blocks, raw JSON output only):
{
  "maintainabilityScore": <score_between_0_and_100>,
  "assertionQualityScore": <score_between_0_and_100>,
  "warnings": [
    "warning string 1",
    "warning string 2"
  ]
}
`;

    const response = await this.aiService.generateJson(prompt);
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    const parsed = JSON.parse(cleaned);

    return {
      maintainabilityScore: typeof parsed.maintainabilityScore === 'number' ? parsed.maintainabilityScore : 70,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : []
    };
  }
}
