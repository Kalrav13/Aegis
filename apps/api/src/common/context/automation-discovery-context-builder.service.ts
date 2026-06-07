import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import {
  TestCase,
  TestCaseQualityScorecard,
  AutomationDiscoveryContext,
  AutomationDiscoveryContextSchema
} from '@testlens/contracts';

@Injectable()
export class AutomationDiscoveryContextBuilderService {
  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * Compiles and validates the AutomationDiscoveryContext.
   */
  public buildContext(
    testCases: TestCase[],
    testCaseQualityScorecard: TestCaseQualityScorecard | null,
    interactionRegistry: {
      elements?: any[];
      routes?: string[];
      apis?: string[];
      forms?: string[];
    } | null,
    frameworkConfiguration?: {
      framework?: string;
      language?: string;
      testStructure?: string;
    }
  ): AutomationDiscoveryContext {
    // 1. Framework Configuration
    const defaultFrameworkConfig = {
      configurationVersion: "1.0.0" as const,
      framework: "PLAYWRIGHT" as const,
      language: "TYPESCRIPT",
      testStructure: "PAGE_OBJECT_MODEL"
    };

    const config = {
      ...defaultFrameworkConfig,
      ...frameworkConfiguration
    };

    // 2. Interaction Registry Aggregation
    const rawElements = Array.isArray(interactionRegistry?.elements) ? interactionRegistry.elements : [];
    const rawRoutes = Array.isArray(interactionRegistry?.routes) ? interactionRegistry.routes : [];
    const rawApis = Array.isArray(interactionRegistry?.apis) ? interactionRegistry.apis : [];
    const rawForms = Array.isArray(interactionRegistry?.forms) ? interactionRegistry.forms : [];

    // Deduplicate selectors
    const elementsMap = new Map<string, any>();
    for (const el of rawElements) {
      if (el && el.selector) {
        const selector = String(el.selector).trim();
        const elementId = el.elementId || '';
        const elementName = el.elementName || '';
        const pageRoute = el.pageRoute || '';
        
        if (!elementsMap.has(selector) && selector.length > 0) {
          elementsMap.set(selector, {
            elementId,
            elementName,
            selector,
            pageRoute
          });
        }
      }
    }
    const elements = Array.from(elementsMap.values());

    // Normalize routes and APIs to lowercase
    const routesSet = new Set<string>();
    for (const r of rawRoutes) {
      if (r && typeof r === 'string') {
        const norm = r.toLowerCase().trim().replace(/\s+/g, ' ');
        if (norm.length > 0) {
          routesSet.add(norm);
        }
      }
    }
    const routes = Array.from(routesSet);

    const apisSet = new Set<string>();
    for (const a of rawApis) {
      if (a && typeof a === 'string') {
        const norm = a.toLowerCase().trim().replace(/\s+/g, ' ');
        if (norm.length > 0) {
          apisSet.add(norm);
        }
      }
    }
    const apis = Array.from(apisSet);

    const formsSet = new Set<string>();
    for (const f of rawForms) {
      if (f && typeof f === 'string') {
        const norm = f.trim().replace(/\s+/g, ' ');
        if (norm.length > 0) {
          formsSet.add(norm);
        }
      }
    }
    const forms = Array.from(formsSet);

    // 3. Test Case Aggregation & Filtering & Sorting
    const priorityWeight = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };

    const evaluatedTestCases = testCases
      .map(tc => {
        let qualityScore = 100;
        if (typeof (tc as any).qualityScore === 'number') {
          qualityScore = (tc as any).qualityScore;
        } else if ((tc as any).quality && typeof (tc as any).quality.qualityScore === 'number') {
          qualityScore = (tc as any).quality.qualityScore;
        } else if (testCaseQualityScorecard && Array.isArray(testCaseQualityScorecard.testCasesEvaluations)) {
          const matchingEval = testCaseQualityScorecard.testCasesEvaluations.find(e => e.testCaseId === tc.testCaseId);
          if (matchingEval) {
            qualityScore = matchingEval.qualityScore;
          }
        }

        let description = tc.description || '';
        if (description.length > 500) {
          description = description.substring(0, 497) + '...';
        }

        return {
          testCaseId: tc.testCaseId,
          testCaseKey: tc.testCaseKey,
          contractVersion: tc.contractVersion,
          testCaseName: tc.testCaseName,
          testCaseType: tc.testCaseType,
          priority: tc.priority,
          description,
          preconditions: tc.preconditions,
          steps: tc.steps,
          expectedResult: tc.expectedResult,
          evidence: tc.evidence,
          riskLevel: tc.riskLevel,
          coverageTargets: tc.coverageTargets,
          testCaseOrigin: tc.testCaseOrigin,
          automationStatus: tc.automationStatus,
          automationPath: tc.automationPath,
          qualityScore
        };
      })
      // Remove quality < 50
      .filter(tc => tc.qualityScore >= 50)
      // Sort: 1. highest qualityScore, 2. highest priority weight, 3. alphabetically by testCaseKey
      .sort((a, b) => {
        if (b.qualityScore !== a.qualityScore) {
          return b.qualityScore - a.qualityScore;
        }
        const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
        const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
        if (weightB !== weightA) {
          return weightB - weightA;
        }
        return a.testCaseKey.localeCompare(b.testCaseKey);
      });

    // 4. Token Optimization Pruning
    const testCasesPerScenario = new Map<string, number>();
    const testCasesPerFeature = new Map<string, number>();
    const optimizedTestCases: any[] = [];

    for (const tc of evaluatedTestCases) {
      const origin = tc.testCaseOrigin || { featureIds: [], scenarioIds: [], workflowIds: [] };
      const featureIds = origin.featureIds || [];
      const scenarioIds = origin.scenarioIds || [];

      // Check scenario pruning limit (max 5)
      let scenarioLimitExceeded = false;
      for (const sId of scenarioIds) {
        const count = testCasesPerScenario.get(sId) || 0;
        if (count >= 5) {
          scenarioLimitExceeded = true;
          break;
        }
      }

      // Check feature pruning limit (max 15)
      let featureLimitExceeded = false;
      for (const fId of featureIds) {
        const count = testCasesPerFeature.get(fId) || 0;
        if (count >= 15) {
          featureLimitExceeded = true;
          break;
        }
      }

      if (scenarioLimitExceeded || featureLimitExceeded) {
        continue;
      }

      // Record count increments
      for (const sId of scenarioIds) {
        testCasesPerScenario.set(sId, (testCasesPerScenario.get(sId) || 0) + 1);
      }
      for (const fId of featureIds) {
        testCasesPerFeature.set(fId, (testCasesPerFeature.get(fId) || 0) + 1);
      }

      optimizedTestCases.push(tc);
    }

    // 5. Readiness Evaluator
    const blockingReasons: string[] = [];

    if (optimizedTestCases.length === 0) {
      blockingReasons.push("No valid test cases available for automation generation context.");
    } else {
      const sumQuality = optimizedTestCases.reduce((sum, curr) => sum + curr.qualityScore, 0);
      const avgQuality = sumQuality / optimizedTestCases.length;
      if (avgQuality < 70) {
        blockingReasons.push(`Average test case quality score of ${avgQuality.toFixed(1)} is below the minimum threshold of 70.`);
      }

      const severeCases = optimizedTestCases.filter(tc => tc.qualityScore < 50);
      if (severeCases.length > 0) {
        blockingReasons.push(`${severeCases.length} test case(s) fell below the minimum quality floor of 50.`);
      }
    }

    // Upstream check
    if (!testCaseQualityScorecard) {
      blockingReasons.push("Upstream test case quality scorecard is missing.");
    } else if (!testCaseQualityScorecard.testCaseGenerationReadiness || !testCaseQualityScorecard.testCaseGenerationReadiness.ready) {
      const reasons = testCaseQualityScorecard.testCaseGenerationReadiness?.blockingReasons || [];
      blockingReasons.push(
        `Upstream test case quality readiness gate has failed. Reasons: ${reasons.join(", ")}`
      );
    }

    // Asset availability (elements > 0 OR routes > 0 OR apis > 0 OR forms > 0)
    const assetsCount = elements.length + routes.length + apis.length + forms.length;
    if (assetsCount === 0) {
      blockingReasons.push("No candidate assets (selectors, routes, APIs, or forms) available in interaction registry.");
    }

    const automationGenerationReadiness = {
      ready: blockingReasons.length === 0,
      blockingReasons
    };

    // 6. Build the Context Object
    const context = {
      contextVersion: "1.0.0" as const,
      builderMetadata: {
        generatedAt: new Date().toISOString(),
        testCasesCount: optimizedTestCases.length,
        elementsCount: elements.length
      },
      targetFramework: config.framework,
      testCases: optimizedTestCases,
      interactionRegistry: {
        elements,
        routes,
        apis,
        forms
      },
      frameworkConfiguration: config,
      automationGenerationReadiness
    };

    // 7. Validate output payload against Zod Schema
    return AutomationDiscoveryContextSchema.parse(context);
  }
}
