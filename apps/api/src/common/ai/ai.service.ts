import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly apiKey: string;

  constructor(private readonly config: AppConfigService) {
    const rawApiKey = this.config.geminiApiKey || '';
    this.apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');
    
    // Diagnostic log to identify key format issues safely
    const keyPreview = this.apiKey ? `${this.apiKey.substring(0, 6)}... (length: ${this.apiKey.length})` : 'none';
    console.log(`🔑 Initializing Gemini client with API Key prefix: ${keyPreview}`);
    if (this.apiKey && !this.apiKey.startsWith('AIzaSy') && this.apiKey !== 'mock-gemini-api-key') {
      console.warn('⚠️ WARNING: The configured GEMINI_API_KEY does not start with the standard "AIzaSy" prefix. It is likely invalid!');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Calls the Gemini API with JSON mode enabled and returns the raw string response.
   */
  public async generateJson(prompt: string, modelName: string = 'gemini-2.5-flash'): Promise<string> {
    if (this.apiKey === 'mock-gemini-api-key' || !this.apiKey || this.apiKey.includes('mock') || this.apiKey.includes('invalid')) {
      return this.generateMockJson(prompt);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text) {
        throw new Error('Gemini API returned an empty response text.');
      }
      return text;
    } catch (error: any) {
      console.error('Gemini API integration layer failed:', error.message);
      throw error;
    }
  }

  private generateMockJson(prompt: string): string {
    // 1. Automation Quality Critic
    if (prompt.includes("maintainabilityScore") && prompt.includes("assertionQualityScore")) {
      return JSON.stringify({
        maintainabilityScore: 95,
        assertionQualityScore: 95,
        warnings: []
      });
    }

    // 2. Feature Quality Critic
    if (prompt.includes("criticize each feature description") || prompt.includes("auditing a list of discovered business features")) {
      const featureNames = Array.from(prompt.matchAll(/"name":\s*"([^"]+)"/g)).map(m => m[1]);
      const evaluations = featureNames.map(name => ({
        featureName: name,
        completenessScore: 95,
        warnings: []
      }));
      return JSON.stringify({ evaluations });
    }

    // 3. Scenario Quality Critic
    if (prompt.includes("criticize each scenario") || prompt.includes("auditing a list of discovered business scenarios")) {
      const scenarioNames = Array.from(prompt.matchAll(/"(?:scenarioName|name)":\s*"([^"]+)"/g)).map(m => m[1]);
      const evaluations = scenarioNames.map(name => ({
        scenarioName: name,
        completenessScore: 95,
        warnings: []
      }));
      return JSON.stringify({ evaluations });
    }

    // 4. TestCase Quality Critic
    if (prompt.includes("criticize each test case") || prompt.includes("auditing a list of discovered manual test cases")) {
      const tcNames = Array.from(prompt.matchAll(/"(?:testCaseName|name)":\s*"([^"]+)"/g)).map(m => m[1]);
      const evaluations = tcNames.map(name => ({
        testCaseName: name,
        completenessScore: 95,
        warnings: []
      }));
      return JSON.stringify({ evaluations });
    }

    // 5. Repository Understanding
    if (prompt.includes("applicationPurpose") && prompt.includes("targetUsers") && prompt.includes("businessDomains")) {
      let firstFile = 'package.json';
      try {
        const contextMatch = prompt.match(/<CONTEXT>([\s\S]*?)<\/CONTEXT>/);
        if (contextMatch) {
          const context = JSON.parse(contextMatch[1]);
          const files = [
            ...(context.evidence_index?.packages || []),
            ...(context.evidence_index?.configs || []),
            ...((context.routes_and_apis || []).flatMap((r: any) => r.files || [])),
            ...((context.forms || []).map((f: any) => f.path))
          ].filter(Boolean);
          if (files.length > 0) {
            firstFile = files[0];
          }
        }
      } catch (err) {
        console.error("Mock Repository Understanding: Failed to parse context", err);
      }

      return JSON.stringify({
        applicationPurpose: {
          summary: "This is a TestLens analyzed codebase showing user authentication, scenario execution reporting, and coverages.",
          confidenceScore: 0.95,
          evidence: [firstFile]
        },
        targetUsers: [
          {
            role: "QA Engineer",
            description: "Reviews coverages and executions",
            confidenceScore: 0.9,
            evidence: [firstFile]
          }
        ],
        businessDomains: [
          {
            name: "QA Automation",
            description: "Quality assurance and test tracking",
            confidenceScore: 0.9,
            evidence: [firstFile]
          }
        ],
        coreWorkflows: [
          {
            name: "User Login",
            description: "Logs user in",
            steps: ["Enter username", "Enter password", "Click submit"],
            associatedRoutes: [],
            associatedApis: [],
            confidenceScore: 0.9,
            evidence: [firstFile]
          }
        ],
        highRiskWorkflows: [
          {
            name: "User Authentication",
            riskFactor: "Auth bypass",
            mitigationFocus: "Strict credential check",
            confidenceScore: 0.9,
            evidence: [firstFile]
          }
        ]
      });
    }

    // 6. Feature Discovery
    if (prompt.includes("features") && prompt.includes("featureType") && prompt.includes("CORE | SUPPORTING")) {
      let routes: string[] = [];
      let apis: string[] = [];
      let components: string[] = [];
      let workflows: any[] = [];

      try {
        const routesMatch = prompt.match(/\* Routes:\s*(\[.*?\])/);
        if (routesMatch) routes = JSON.parse(routesMatch[1]);

        const apisMatch = prompt.match(/\* APIs:\s*(\[.*?\])/);
        if (apisMatch) apis = JSON.parse(apisMatch[1]);

        const compsMatch = prompt.match(/\* Components:\s*(\[.*?\])/);
        if (compsMatch) components = JSON.parse(compsMatch[1]);

        const wfMatch = prompt.match(/- Aggregated Core Workflows:\s*(\[[\s\S]*?\])\s*- Risk Profile:/i);
        if (wfMatch) workflows = JSON.parse(wfMatch[1]);
      } catch (e) {
        console.error("Mock Feature Discovery: Failed to parse candidates", e);
      }

      const evidenceFile = routes[0] || apis[0] || components[0] || 'package.json';
      const workflowName = workflows[0]?.name || 'User Login';

      const features = [
        {
          featureName: "User Authentication",
          featureType: "CORE",
          description: "Provides authentication layer to verify user credentials and establish session tokens securely.",
          confidenceScore: 0.95,
          evidence: [evidenceFile],
          sourceWorkflows: [workflowName],
          riskLevel: "CRITICAL"
        },
        {
          featureName: "Settings Management",
          featureType: "SUPPORTING",
          description: "Enables configurations, preference storage, system tuning, and key adjustments management.",
          confidenceScore: 0.85,
          evidence: [evidenceFile],
          sourceWorkflows: [workflowName],
          riskLevel: "MEDIUM"
        }
      ];

      return JSON.stringify({ features });
    }

    // 7. Scenario Discovery
    if (prompt.includes("scenarios") && prompt.includes("scenarioName") && prompt.includes("parentFeatures")) {
      let features: any[] = [];
      let workflows: any[] = [];
      let routes: string[] = [];
      let apis: string[] = [];
      let forms: string[] = [];

      try {
        const featMatch = prompt.match(/=== FEATURE LIST ===\s*(\[[\s\S]*?\])\s*=== WORKFLOW LIST ===/);
        if (featMatch) features = JSON.parse(featMatch[1]);

        const wfMatch = prompt.match(/=== WORKFLOW LIST ===\s*(\[[\s\S]*?\])\s*=== CANDIDATE ASSETS ===/);
        if (wfMatch) workflows = JSON.parse(wfMatch[1]);

        const routesMatch = prompt.match(/- Routes:\s*(\[.*?\])/);
        if (routesMatch) routes = JSON.parse(routesMatch[1]);

        const apisMatch = prompt.match(/- APIs:\s*(\[.*?\])/);
        if (apisMatch) apis = JSON.parse(apisMatch[1]);

        const formsMatch = prompt.match(/- Forms:\s*(\[.*?\])/);
        if (formsMatch) forms = JSON.parse(formsMatch[1]);
      } catch (e) {
        console.error("Mock Scenario Discovery: Failed to parse feature list", e);
      }

      const scenarios: any[] = [];
      
      // Default fallback lists if parsed empty
      if (features.length === 0) {
        features = [{ name: "User Authentication", riskLevel: "CRITICAL", evidence: ["package.json"], sourceWorkflows: ["User Login"] }];
      }

      for (const feat of features) {
        const evidenceFile = feat.evidence?.[0] || routes[0] || apis[0] || forms[0] || 'package.json';
        const workflowName = feat.sourceWorkflows?.[0] || 'User Login';
        const isCriticalOrHigh = feat.riskLevel === 'CRITICAL' || feat.riskLevel === 'HIGH';

        // 1. Positive
        scenarios.push({
          scenarioName: `Successful execution of ${feat.name}`,
          scenarioType: "POSITIVE",
          priority: isCriticalOrHigh ? "CRITICAL" : "HIGH",
          description: `Verify that users can complete the ${feat.name} flow under standard happy path inputs.`,
          confidenceScore: 0.95,
          riskLevel: feat.riskLevel,
          parentFeatures: [feat.name],
          sourceWorkflows: [workflowName],
          evidence: [evidenceFile]
        });

        // 2. Negative
        scenarios.push({
          scenarioName: `Invalid input failure handling of ${feat.name}`,
          scenarioType: "NEGATIVE",
          priority: "HIGH",
          description: `Verify that ${feat.name} handles validation errors and incorrect inputs gracefully with proper error messages.`,
          confidenceScore: 0.9,
          riskLevel: feat.riskLevel,
          parentFeatures: [feat.name],
          sourceWorkflows: [workflowName],
          evidence: [evidenceFile]
        });

        // 3. Security or Edge case
        scenarios.push({
          scenarioName: `Access controls validation for ${feat.name}`,
          scenarioType: isCriticalOrHigh ? "SECURITY" : "EDGE_CASE",
          priority: isCriticalOrHigh ? "CRITICAL" : "MEDIUM",
          description: `Verify that permission gates and data validation boundaries are enforced for ${feat.name}.`,
          confidenceScore: 0.92,
          riskLevel: feat.riskLevel,
          parentFeatures: [feat.name],
          sourceWorkflows: [workflowName],
          evidence: [evidenceFile]
        });
      }

      return JSON.stringify({ scenarios });
    }

    // 8. TestCase Discovery
    if (prompt.includes("testCases") && prompt.includes("testCaseName") && prompt.includes("parentScenarioId")) {
      let scenarios: any[] = [];
      let routes: string[] = [];
      let apis: string[] = [];
      let forms: string[] = [];

      try {
        const scenMatch = prompt.match(/=== SCENARIO LIST ===\s*(\[[\s\S]*?\])\s*=== CANDIDATE ASSET WHITELIST ===/);
        if (scenMatch) scenarios = JSON.parse(scenMatch[1]);

        const routesMatch = prompt.match(/- Routes:\s*(\[.*?\])/);
        if (routesMatch) routes = JSON.parse(routesMatch[1]);

        const apisMatch = prompt.match(/- APIs:\s*(\[.*?\])/);
        if (apisMatch) apis = JSON.parse(apisMatch[1]);

        const formsMatch = prompt.match(/- Forms:\s*(\[.*?\])/);
        if (formsMatch) forms = JSON.parse(formsMatch[1]);
      } catch (e) {
        console.error("Mock TestCase Discovery: Failed to parse scenario list", e);
      }

      if (scenarios.length === 0) {
        scenarios = [{ id: "scen-uuid", name: "Successful authentication", type: "POSITIVE", priority: "HIGH", evidence: ["package.json"] }];
      }

      const testCases: any[] = [];

      for (const scen of scenarios) {
        const evidenceFile = scen.evidence?.[0] || routes[0] || apis[0] || forms[0] || 'package.json';
        const isCriticalOrHigh = scen.priority === 'CRITICAL' || scen.priority === 'HIGH';

        // 1. Functional
        testCases.push({
          testCaseName: `Verify basic functional flow for ${scen.name}`,
          testCaseType: "FUNCTIONAL",
          priority: scen.priority,
          description: `Execute happy path flows to verify core functionality of ${scen.name}.`,
          preconditions: ["System is operational", "User session is valid"],
          steps: [
            { stepNumber: 1, action: "Trigger action on page", expectedResult: "Page displays result" },
            { stepNumber: 2, action: "Confirm data matches", expectedResult: "Values are verified successfully" }
          ],
          expectedResult: `Basic flow of ${scen.name} executes correctly.`,
          evidence: [evidenceFile],
          parentScenarioId: scen.id
        });

        // 2. Negative
        testCases.push({
          testCaseName: `Verify error response under invalid params for ${scen.name}`,
          testCaseType: "NEGATIVE",
          priority: "HIGH",
          description: `Verify validation schema blocks bad parameters and handles error outputs for ${scen.name}.`,
          preconditions: ["System is operational"],
          steps: [
            { stepNumber: 1, action: "Trigger action with invalid input", expectedResult: "Page displays input validation error" }
          ],
          expectedResult: "Action is blocked and user is notified of error.",
          evidence: [evidenceFile],
          parentScenarioId: scen.id
        });

        // 3. Security/Edge Case (if critical or high)
        if (isCriticalOrHigh) {
          testCases.push({
            testCaseName: `Verify authentication boundary checks for ${scen.name}`,
            testCaseType: "SECURITY",
            priority: "CRITICAL",
            description: `Verify access is denied for unauthorized requests to ${scen.name}.`,
            preconditions: ["System is operational"],
            steps: [
              { stepNumber: 1, action: "Submit request without token header", expectedResult: "Returns 401 Unauthorized" }
            ],
            expectedResult: "Unauthorized requests are blocked.",
            evidence: [evidenceFile],
            parentScenarioId: scen.id
          });
        }
      }

      return JSON.stringify({ testCases });
    }

    // 9. Automation Generation
    if (prompt.includes("specCode") && prompt.includes("pageObjectCode") && prompt.includes("MANUAL TEST CASES TO AUTOMATE")) {
      let selectors: any[] = [];
      let routes: string[] = [];
      let apis: string[] = [];
      let testCases: any[] = [];

      try {
        const selMatch = prompt.match(/=== WHITELISTED ELEMENT SELECTORS ===\s*(\[[\s\S]*?\])\s*=== WHITELISTED ROUTES ===/);
        if (selMatch) selectors = JSON.parse(selMatch[1]);

        const routesMatch = prompt.match(/=== WHITELISTED ROUTES ===\s*(\[[\s\S]*?\])\s*=== WHITELISTED APIS ===/);
        if (routesMatch) routes = JSON.parse(routesMatch[1]);

        const apisMatch = prompt.match(/=== WHITELISTED APIS ===\s*(\[[\s\S]*?\])\s*=== WHITELISTED FORMS ===/);
        if (apisMatch) apis = JSON.parse(apisMatch[1]);

        const tcMatch = prompt.match(/=== MANUAL TEST CASES TO AUTOMATE ===\s*(\[[\s\S]*?\])\s*=== OUTPUT FORMAT ===/);
        if (tcMatch) testCases = JSON.parse(tcMatch[1]);
      } catch (e) {
        console.error("Mock Automation Generation: Failed to parse whitelists", e);
      }

      if (testCases.length === 0) {
        testCases = [{ id: "tc-uuid", key: "TC-AUTH-001", name: "Verify login" }];
      }

      const firstSelector = selectors[0]?.selector || '#app';
      const firstRoute = routes[0] || '/';
      const firstApi = apis[0] || '/api/health';

      const scripts = testCases.map(tc => {
        const specCode = `import { test, expect } from '@playwright/test';
import { LoginPage } from './login.page';

test('Verify ${tc.name}', async ({ page }) => {
  await page.goto('${firstRoute}');
  const locator = page.locator('${firstSelector}');
  await expect(locator).toBeVisible();
});`;

        const pageObjectCode = `import { Page, Locator } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;
  private readonly locator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.locator = page.locator('${firstSelector}');
  }
}`;

        return {
          testCaseId: tc.id,
          pageObjectFilePath: "tests/pages/auth.page.ts",
          pageObjectCode,
          specFilePath: `tests/auth-${tc.key.toLowerCase()}.spec.ts`,
          specCode
        };
      });

      return JSON.stringify({ scripts });
    }

    // Default Fallback
    return JSON.stringify({});
  }
}
