import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AppConfigService } from '../config/config.service';
import {
  AutomationDiscoveryContext,
  AutomationScript,
  AutomationGenerationOutput,
  AutomationGenerationOutputSchema
} from '@testlens/contracts';
import { randomUUID, createHash } from 'crypto';
import * as ts from 'typescript';

@Injectable()
export class AutomationGenerationAgentService {
  constructor(
    private readonly aiService: AiService,
    private readonly appConfigService: AppConfigService
  ) {}

  /**
   * Generates executable Playwright test specs and Page Objects from manual test cases.
   */
  public async generateAutomation(
    context: AutomationDiscoveryContext,
    featuresList?: Array<{ id: string; featureName: string }>,
    testCaseQualityScorecard?: any
  ): Promise<any> {
    if (!context.automationGenerationReadiness.ready) {
      throw new Error(
        `Automation generation is blocked. Reasons: ${context.automationGenerationReadiness.blockingReasons.join(', ')}`
      );
    }

    const testCases = context.testCases;
    const targetFramework = context.targetFramework;

    // 1. Build prompt mapping all context assets and steps
    const prompt = this.buildPrompt(context);

    // 2. Query Gemini Gateway in JSON mode
    let generatedData: any = { scripts: [] };
    try {
      const response = await this.aiService.generateJson(prompt);
      // Clean up markdown wrapping if present
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(cleanedResponse);
      if (parsed && Array.isArray(parsed.scripts)) {
        generatedData = parsed;
      }
    } catch (error: any) {
      console.error('Gemini automation generation failed:', error.message);
      return {
        generationMetadata: {
          generatedAt: new Date().toISOString(),
          scriptsCount: 0,
          failuresCount: testCases.length
        },
        scripts: []
      };
    }

    const compiledScriptsMap = new Map<string, any>(
      generatedData.scripts.map((s: any) => [s.testCaseId, s])
    );

    const generatedScripts: any[] = [];
    let failuresCount = 0;

    const whitelistSelectors = new Set(context.interactionRegistry.elements.map(e => e.selector.trim()));
    const whitelistRoutes = new Set(context.interactionRegistry.routes.map(r => r.toLowerCase().trim()));
    const whitelistApis = new Set(context.interactionRegistry.apis.map(a => a.toLowerCase().trim()));

    // Helper to slugify feature names
    const slugify = (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    // 3. Process each test case
    for (const tc of testCases) {
      const compiled = compiledScriptsMap.get(tc.testCaseId);
      if (!compiled || !compiled.specCode || !compiled.pageObjectCode) {
        failuresCount++;
        continue;
      }

      // --- Grounding Engine ---
      const pageGrounding = this.checkGrounding(compiled.pageObjectCode, whitelistSelectors, whitelistRoutes, whitelistApis);
      const specGrounding = this.checkGrounding(compiled.specCode, whitelistSelectors, whitelistRoutes, whitelistApis);

      const combinedGroundingDensity = Math.round(((pageGrounding.groundingDensity + specGrounding.groundingDensity) / 2) * 100) / 100;
      const combinedSelectorCoverage = Math.round(((pageGrounding.selectorCoverage + specGrounding.selectorCoverage) / 2) * 100) / 100;
      
      const groundingWarnings = [...pageGrounding.warnings, ...specGrounding.warnings];

      // Discard strategy: If grounding density is below 0.8, we discard the script
      if (combinedGroundingDensity < 0.8) {
        console.warn(`Discarding script for TestCase ${tc.testCaseId} due to low grounding density: ${combinedGroundingDensity}`);
        failuresCount++;
        continue;
      }

      // --- Confidence Engine ---
      const isSpecCompileClean = this.verifyTypeScriptCompile(compiled.specCode);
      const isPageCompileClean = this.verifyTypeScriptCompile(compiled.pageObjectCode);
      
      const hasAssertion = compiled.specCode.includes('expect(');
      const codeCompleteness = (hasAssertion && isSpecCompileClean && isPageCompileClean) ? 1.0 : 0.5;

      let tcQualityScore = 100;
      if (testCaseQualityScorecard && Array.isArray(testCaseQualityScorecard.testCasesEvaluations)) {
        const matchingEval = testCaseQualityScorecard.testCasesEvaluations.find((e: any) => e.testCaseId === tc.testCaseId);
        if (matchingEval) {
          tcQualityScore = matchingEval.qualityScore;
        }
      } else if (typeof (tc as any).qualityScore === 'number') {
        tcQualityScore = (tc as any).qualityScore;
      }
      const testCaseQuality = tcQualityScore / 100;

      const confidenceScore = Math.round(
        (0.3 * combinedSelectorCoverage +
         0.3 * combinedGroundingDensity +
         0.2 * testCaseQuality +
         0.2 * codeCompleteness) * 100
      ) / 100;

      // --- Traceability Resolver ---
      const origin = tc.testCaseOrigin || { featureIds: [], scenarioIds: [], testCaseIds: [], workflowIds: [] };
      const automationOrigin = {
        featureIds: origin.featureIds || [],
        scenarioIds: origin.scenarioIds || [],
        testCaseIds: [tc.testCaseId],
        workflowIds: origin.workflowIds || []
      };

      // Determine correct physical paths for PM and Spec files
      const featureId = origin.featureIds?.[0];
      const featureObj = featuresList?.find(f => f.id === featureId);
      const featureSlug = featureObj ? slugify(featureObj.featureName) : 'default';
      const testCaseKeyLower = tc.testCaseKey.toLowerCase();

      const pageObjectFilePath = `tests/pages/${featureSlug}.page.ts`;
      const specFilePath = `tests/${featureSlug}-${testCaseKeyLower}.spec.ts`;

      // Create compound key for deduplication: hash(normalizedTestCaseName + framework + testCaseId)
      const normalizedName = tc.testCaseName.toLowerCase().trim().replace(/\s+/g, ' ');
      const rawKey = `${normalizedName}_${targetFramework}_${tc.testCaseId}`;
      const compoundKey = createHash('sha256').update(rawKey).digest('hex');

      // Assemble intermediate script object
      const script = {
        scriptId: randomUUID(),
        testCaseId: tc.testCaseId,
        contractVersion: "1.0.0" as const,
        filePath: specFilePath,
        codeContent: compiled.specCode,
        framework: targetFramework,
        confidenceScore,
        automationOrigin,
        // Custom properties carried temporarily for processor ingestion/file writing
        pageObjectFilePath,
        pageObjectCode: compiled.pageObjectCode,
        groundingDensity: combinedGroundingDensity,
        warnings: groundingWarnings,
        compoundKey
      };

      generatedScripts.push(script);
    }

    // --- Deduplication Engine ---
    const dedupMap = new Map<string, any>();
    for (const s of generatedScripts) {
      const key = s.compoundKey;
      const existing = dedupMap.get(key);
      if (!existing || s.confidenceScore > existing.confidenceScore) {
        if (existing) {
          failuresCount++; // Increment failures for discarded duplicate
        }
        dedupMap.set(key, s);
      } else {
        failuresCount++;
      }
    }

    const finalScripts = Array.from(dedupMap.values()).map(s => {
      // Remove temporary key before return
      const { compoundKey, ...cleanScript } = s;
      return cleanScript;
    });

    const output = {
      generationMetadata: {
        generatedAt: new Date().toISOString(),
        scriptsCount: finalScripts.length,
        failuresCount
      },
      scripts: finalScripts
    };

    // --- Validation Engine ---
    // Validate output structure conforms to Zod Schema
    const copyToValidate = {
      generationMetadata: output.generationMetadata,
      scripts: output.scripts.map((s: any) => {
        const { pageObjectFilePath, pageObjectCode, warnings, groundingDensity, ...rest } = s;
        return rest;
      })
    };
    AutomationGenerationOutputSchema.parse(copyToValidate);

    return output;
  }

  /**
   * Builds the strict code generation prompt for Playwright TypeScript POM scripts.
   */
  private buildPrompt(context: AutomationDiscoveryContext): string {
    return `
You are a Lead Staff SDET Architect compiling manual test case specs into executable Playwright TypeScript tests using the Page Object Model (POM) pattern.
Generate a Page Object class and a corresponding Spec file for each test case listed below.

=== STRICT GROUNDING RULES ===
1. You MUST ONLY use the routes, APIs, and element selectors provided in the Whitelists below.
2. DO NOT use generic text selectors, fuzzy matches, or custom text locators (e.g. page.getByText(), page.locator("text=...")) unless they exist in the Whitelisted Element Selector list.
3. If a selector is missing for a step, do not invent it. Remove the selector reference or reference a whitelisted parent.
4. Prepend "await" before all Playwright actions and assertions (e.g. await page.goto(), await expect(locator).toBeVisible()).
5. DO NOT generate hardcoded timeouts like page.waitForTimeout(5000). Rely on Playwright auto-waiting.

=== WHITELISTED ELEMENT SELECTORS ===
${JSON.stringify(context.interactionRegistry.elements, null, 2)}

=== WHITELISTED ROUTES ===
${JSON.stringify(context.interactionRegistry.routes, null, 2)}

=== WHITELISTED APIS ===
${JSON.stringify(context.interactionRegistry.apis, null, 2)}

=== WHITELISTED FORMS ===
${JSON.stringify(context.interactionRegistry.forms, null, 2)}

=== MANUAL TEST CASES TO AUTOMATE ===
${JSON.stringify(
  context.testCases.map(tc => ({
    id: tc.testCaseId,
    key: tc.testCaseKey,
    name: tc.testCaseName,
    preconditions: tc.preconditions,
    steps: tc.steps.map(s => ({ number: s.stepNumber, action: s.action, expected: s.expectedResult })),
    expected: tc.expectedResult
  })),
  null,
  2
)}

=== OUTPUT FORMAT ===
Return a JSON object conforming exactly to this structure (do not wrap in markdown \`\`\`json block, output raw JSON only):
{
  "scripts": [
    {
      "testCaseId": "<testCaseId>",
      "pageObjectFilePath": "tests/pages/<feature-slug>.page.ts",
      "pageObjectCode": "export class <Feature>Page { ... }",
      "specFilePath": "tests/<feature-slug>-<test-case-key>.spec.ts",
      "specCode": "import { test, expect } from '@playwright/test'; ... "
    }
  ]
}
`;
  }

  /**
   * Audits code to extract selectors and verify they belong to the whitelisted assets.
   */
  private checkGrounding(
    code: string,
    whitelistSelectors: Set<string>,
    whitelistRoutes: Set<string>,
    whitelistApis: Set<string>
  ): { groundingDensity: number; selectorCoverage: number; warnings: string[] } {
    const warnings: string[] = [];
    
    const allActions: string[] = [];
    const groundedActions: string[] = [];

    // 1. Check page.goto() routes
    const gotoRegex = /goto\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = gotoRegex.exec(code)) !== null) {
      const route = match[1].trim();
      const normRoute = route.toLowerCase();
      allActions.push(`route:${normRoute}`);
      if (normRoute === '/' || normRoute.startsWith('http') || whitelistRoutes.has(normRoute)) {
        groundedActions.push(`route:${normRoute}`);
      } else {
        warnings.push(`[LOW_GROUNDING] Target route '${route}' is not present in the whitelisted Interaction Registry.`);
      }
    }

    // 2. Check APIs (waitForResponse, request calls, etc.)
    const apiRegex = /(?:request\.(?:post|get|put|delete|patch)|waitForResponse|waitForRequest)\(['"]([^'"]+)['"]/g;
    while ((match = apiRegex.exec(code)) !== null) {
      const api = match[1].trim();
      const normApi = api.toLowerCase();
      allActions.push(`api:${normApi}`);
      if (normApi.startsWith('http') || whitelistApis.has(normApi)) {
        groundedActions.push(`api:${normApi}`);
      } else {
        warnings.push(`[LOW_GROUNDING] API endpoint '${api}' is not present in the whitelisted Interaction Registry.`);
      }
    }

    // 3. Extract all page.locator('selector') or page.locator("selector")
    const locatorRegex = /locator\(['"]([^'"]+)['"]\)/g;
    while ((match = locatorRegex.exec(code)) !== null) {
      const selector = match[1].trim();
      allActions.push(`selector:${selector}`);
      if (whitelistSelectors.has(selector)) {
        groundedActions.push(`selector:${selector}`);
      } else {
        warnings.push(`[LOW_GROUNDING] Selector '${selector}' is not present in the whitelisted Interaction Registry.`);
      }
    }

    // 4. Check prohibited methods: getByText, getByRole, getByPlaceholder, getByLabel, getByTestId
    const prohibitedMethodsRegex = /(getByText|getByRole|getByPlaceholder|getByLabel|getByTestId)\(([^)]+)\)/g;
    while ((match = prohibitedMethodsRegex.exec(code)) !== null) {
      const method = match[1];
      const args = match[2].trim();
      const cleanArg = args.replace(/^['"]|['"]$/g, '').trim();
      const callStr = `${method}(${args})`;
      allActions.push(`selector:${callStr}`);
      if (whitelistSelectors.has(cleanArg) || whitelistSelectors.has(callStr)) {
        groundedActions.push(`selector:${callStr}`);
      } else {
        warnings.push(`[LOW_GROUNDING] Prohibited locator method '${callStr}' is used but not explicitly whitelisted.`);
      }
    }

    // 5. Also check for text=... locators used inside locator()
    const textLocatorRegex = /locator\(['"]text=([^'"]+)['"]\)/g;
    while ((match = textLocatorRegex.exec(code)) !== null) {
      const textVal = match[1].trim();
      const callStr = `text=${textVal}`;
      allActions.push(`selector:${callStr}`);
      if (whitelistSelectors.has(callStr) || whitelistSelectors.has(textVal)) {
        groundedActions.push(`selector:${callStr}`);
      } else {
        warnings.push(`[LOW_GROUNDING] Prohibited text locator '${callStr}' is used but not explicitly whitelisted.`);
      }
    }

    // Grounding Density: ratio of all action occurrences that are grounded
    const groundingDensity = allActions.length === 0 ? 1.0 : groundedActions.length / allActions.length;

    // Selector Coverage: ratio of unique grounded actions to unique total actions
    const uniqueActions = new Set(allActions);
    const uniqueGrounded = new Set(groundedActions);
    const selectorCoverage = uniqueActions.size === 0 ? 1.0 : uniqueGrounded.size / uniqueActions.size;

    return { groundingDensity, selectorCoverage, warnings };
  }

  /**
   * Verifies that the TypeScript code fragment compiles without syntax errors.
   */
  private verifyTypeScriptCompile(code: string): boolean {
    try {
      const result = ts.transpileModule(code, {
        compilerOptions: { noEmitOnError: true, target: ts.ScriptTarget.ES2020 }
      });
      if (result.diagnostics && result.diagnostics.length > 0) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

