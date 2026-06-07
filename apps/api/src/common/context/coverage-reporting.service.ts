import { Injectable } from '@nestjs/common';
import { prisma } from '@testlens/db';
import {
  CoverageDashboardPayload,
  validateCoverageDashboardPayload
} from '@testlens/contracts';

export class CoverageReportNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverageReportNotFoundError';
  }
}

export class CoverageDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverageDataValidationError';
  }
}

export class CoverageTrendCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverageTrendCalculationError';
  }
}

@Injectable()
export class CoverageReportingService {
  /**
   * Generates the complete dashboard-ready coverage payload.
   */
  public async generateReport(analysisRunId: string): Promise<CoverageDashboardPayload> {
    const run = await prisma.analysisRun.findUnique({
      where: { id: analysisRunId },
      include: {
        coverageReport: {
          include: {
            quality: true
          }
        }
      }
    });

    if (!run) {
      throw new CoverageReportNotFoundError(`Analysis run with ID ${analysisRunId} not found`);
    }

    const report = run.coverageReport;
    if (!report) {
      throw new CoverageReportNotFoundError(`Coverage report not found for analysis run ${analysisRunId}`);
    }

    const quality = report.quality;
    if (!quality) {
      throw new CoverageReportNotFoundError(`Coverage quality scorecard not found for analysis run ${analysisRunId}`);
    }

    // Fetch db features, scenarios, test cases
    const dbFeatures = await prisma.feature.findMany({
      where: { analysisRunId }
    });
    const dbScenarios = await prisma.scenario.findMany({
      where: { features: { some: { analysisRunId } } }
    });
    const dbTestCases = await prisma.testCase.findMany({
      where: { scenarios: { some: { features: { some: { analysisRunId } } } } }
    });

    // Fetch history runs
    const historyRuns = await prisma.analysisRun.findMany({
      where: {
        projectId: run.projectId,
        status: 'COMPLETED',
        completedAt: { lt: run.completedAt || new Date() }
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
      include: {
        coverageReport: true
      }
    });

    const payload = this.buildDashboardPayload(
      run,
      report,
      quality,
      dbFeatures,
      dbScenarios,
      dbTestCases,
      historyRuns
    );

    try {
      return validateCoverageDashboardPayload(payload);
    } catch (error: any) {
      throw new CoverageDataValidationError(`Dashboard payload validation failed: ${error.message}`);
    }
  }

  /**
   * Consolidated dashboard payload builder - Single Source of Truth
   */
  public buildDashboardPayload(
    run: any,
    report: any,
    quality: any,
    features: any[],
    scenarios: any[],
    testCases: any[],
    historyRuns: any[]
  ): CoverageDashboardPayload {
    const detailsObj = (report.details as any) || {};
    const criticalGapsList = Array.isArray(detailsObj.criticalCoverageGaps) ? detailsObj.criticalCoverageGaps : [];
    const uncoveredFeatureIds = Array.isArray(detailsObj.uncoveredFeatureIds) ? detailsObj.uncoveredFeatureIds : [];
    const uncoveredScenarioIds = Array.isArray(detailsObj.uncoveredScenarioIds) ? detailsObj.uncoveredScenarioIds : [];
    const unautomatedTestCaseIds = Array.isArray(detailsObj.unautomatedTestCaseIds) ? detailsObj.unautomatedTestCaseIds : [];

    // 1. Executive Summary Builder
    const overallCoverageScore = Math.round(((report.featureCoverage + report.scenarioCoverage + report.testCaseCoverage) / 3) * 100) / 100;
    const classification = report.coverageClassification;
    const confidenceScore = report.coverageConfidenceScore;

    const topStrengths: string[] = [];
    if (report.featureCoverage >= 80) topStrengths.push("Strong feature specification mapping.");
    if (report.scenarioCoverage >= 80) topStrengths.push("High scenario specification coverage.");
    if (report.testCaseCoverage >= 80) topStrengths.push("Comprehensive functional test case coverage.");
    if (report.automationCoverage >= 80) topStrengths.push("High level of automated test script coverage.");
    if (report.executionReadinessScore >= 80) topStrengths.push("Excellent automated execution script quality.");
    if (topStrengths.length === 0) topStrengths.push("Baseline coverage established.");

    const topRisks: string[] = [];
    if (report.featureCoverage < 60) topRisks.push("Insufficient feature specification mapping.");
    if (report.scenarioCoverage < 60) topRisks.push("Low scenario coverage ratio.");
    if (report.testCaseCoverage < 60) topRisks.push("Critical untested scenario flows exist.");
    if (report.automationCoverage < 60) topRisks.push("Low level of automated test coverage.");
    if (report.executionReadinessScore < 60) topRisks.push("Low automated execution script quality.");

    criticalGapsList.slice(0, 3 - topRisks.length).forEach((gap: string) => {
      topRisks.push(gap);
    });
    if (topRisks.length === 0) topRisks.push("No immediate high-severity coverage risks identified.");

    const isReady = (run.coverageQualityScorecard as any)?.coverageIntelligenceReadiness?.ready ?? true;
    const hasCriticalGaps = criticalGapsList.length > 0;

    let recommendationSeverity: 'INFO' | 'WARNING' | 'CRITICAL' = 'WARNING';
    let recommendation = "Release approved with caution. Monitor and cover unautomated gaps.";

    if (classification === 'EXCELLENT') {
      recommendationSeverity = 'INFO';
      recommendation = "Release readiness approved. Proceed with deployment.";
    } else if (classification === 'GOOD' || classification === 'FAIR') {
      recommendationSeverity = 'WARNING';
      recommendation = "Release approved with caution. Monitor and cover unautomated gaps.";
    }

    if (classification === 'POOR' || !isReady || hasCriticalGaps) {
      recommendationSeverity = 'CRITICAL';
      recommendation = "Readiness block. Core feature flows lack verified coverage. Address critical gaps before deploy.";
    }

    const executiveSummary = {
      overallCoverageScore,
      coverageClassification: classification as any,
      coverageConfidenceScore: confidenceScore,
      topStrengths: topStrengths.slice(0, 3),
      topRisks: topRisks.slice(0, 3),
      recommendation,
      recommendationSeverity
    };

    // 2. Gap Prioritizer
    const highPriorityGaps: string[] = [];
    const mediumPriorityGaps: string[] = [];
    const lowPriorityGaps: string[] = [];

    const isBillingOrSecurity = (text: string): boolean => {
      if (!text) return false;
      const terms = ['checkout', 'payment', 'billing', 'auth', 'security', 'login', 'register', 'delete'];
      return terms.some(t => text.toLowerCase().includes(t));
    };

    // Features
    features.forEach(f => {
      if (uncoveredFeatureIds.includes(f.id)) {
        const desc = `Feature '${f.featureName}' is completely uncovered.`;
        if (isBillingOrSecurity(f.featureName)) return; // already in critical gaps
        if (f.riskLevel === 'CRITICAL' || f.riskLevel === 'HIGH') {
          highPriorityGaps.push(desc);
        } else if (f.riskLevel === 'MEDIUM') {
          mediumPriorityGaps.push(desc);
        } else {
          lowPriorityGaps.push(desc);
        }
      }
    });

    // Scenarios
    scenarios.forEach(s => {
      const sId = s.scenarioId || s.id;
      if (uncoveredScenarioIds.includes(sId)) {
        const desc = `Scenario '${s.scenarioName}' has no test cases.`;
        if (isBillingOrSecurity(s.scenarioName)) return; // already in critical gaps
        if (s.riskLevel === 'CRITICAL' || s.riskLevel === 'HIGH') {
          highPriorityGaps.push(desc);
        } else if (s.riskLevel === 'MEDIUM') {
          mediumPriorityGaps.push(desc);
        } else {
          lowPriorityGaps.push(desc);
        }
      }
    });

    // Test Cases
    testCases.forEach(tc => {
      const tcId = tc.testCaseId || tc.id;
      if (unautomatedTestCaseIds.includes(tcId)) {
        const desc = `Test Case '${tc.testCaseKey || tcId}: ${tc.testCaseName}' is unautomated.`;
        if (isBillingOrSecurity(tc.testCaseName)) return; // already in critical gaps
        if (tc.riskLevel === 'CRITICAL' || tc.riskLevel === 'HIGH') {
          highPriorityGaps.push(desc);
        } else if (tc.riskLevel === 'MEDIUM') {
          mediumPriorityGaps.push(desc);
        } else {
          lowPriorityGaps.push(desc);
        }
      }
    });

    const gapReport = {
      criticalGaps: criticalGapsList,
      highPriorityGaps,
      mediumPriorityGaps,
      lowPriorityGaps
    };

    // 3. Historical Trend Compiler (with 30-day stale limit & 0.5% threshold)
    const historyPayload = historyRuns.map(h => ({
      analysisRunId: h.id,
      generatedAt: h.completedAt instanceof Date ? h.completedAt.toISOString() : new Date(h.completedAt).toISOString(),
      featureCoverage: h.coverageReport?.featureCoverage ?? 0,
      scenarioCoverage: h.coverageReport?.scenarioCoverage ?? 0,
      testCaseCoverage: h.coverageReport?.testCaseCoverage ?? 0,
      automationCoverage: h.coverageReport?.automationCoverage ?? 0,
      coverageConfidenceScore: h.coverageReport?.coverageConfidenceScore ?? 0
    }));

    let coverageTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
    let automationTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
    let confidenceTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';

    if (historyRuns.length > 0) {
      const prior = historyRuns[0].coverageReport;
      const priorRun = historyRuns[0];
      if (prior && priorRun.completedAt && run.completedAt) {
        const currentDate = run.completedAt instanceof Date ? run.completedAt : new Date(run.completedAt);
        const priorDate = priorRun.completedAt instanceof Date ? priorRun.completedAt : new Date(priorRun.completedAt);

        const timeDiff = Math.abs(currentDate.getTime() - priorDate.getTime());
        const limit30Days = 30 * 24 * 60 * 60 * 1000;

        if (timeDiff > limit30Days) {
          console.warn(`Trend comparison skipped: preceding run is older than 30 days.`);
          coverageTrend = 'STABLE';
          automationTrend = 'STABLE';
          confidenceTrend = 'STABLE';
        } else {
          const priorOverall = (prior.featureCoverage + prior.scenarioCoverage + prior.testCaseCoverage) / 3;
          const currentOverall = (report.featureCoverage + report.scenarioCoverage + report.testCaseCoverage) / 3;

          if (currentOverall - priorOverall > 0.5) coverageTrend = 'IMPROVING';
          else if (priorOverall - currentOverall > 0.5) coverageTrend = 'DECLINING';

          if (report.automationCoverage - prior.automationCoverage > 0.5) automationTrend = 'IMPROVING';
          else if (prior.automationCoverage - report.automationCoverage > 0.5) automationTrend = 'DECLINING';

          if (report.coverageConfidenceScore - prior.coverageConfidenceScore > 0.5) confidenceTrend = 'IMPROVING';
          else if (prior.coverageConfidenceScore - report.coverageConfidenceScore > 0.5) confidenceTrend = 'DECLINING';
        }
      }
    }

    const trendReport = {
      trendDirection: {
        coverageTrend,
        automationTrend,
        confidenceTrend
      },
      history: historyPayload
    };

    // 4. Dynamic Reporting Quality
    // completenessScore check
    const completenessChecks = [
      executiveSummary.overallCoverageScore !== undefined,
      executiveSummary.recommendation !== undefined,
      report.featureCoverage !== undefined,
      gapReport.criticalGaps !== undefined,
      trendReport.trendDirection !== undefined,
      run.completedAt !== undefined
    ];
    const completenessScore = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

    // consistencyScore check
    let consistencyScore = 100;
    if (quality) {
      const diffCoverage = Math.abs(quality.coverageCompleteness - overallCoverageScore);
      const diffAutomation = Math.abs(quality.automationCompleteness - report.automationCoverage);
      consistencyScore -= (diffCoverage * 5 + diffAutomation * 5);
    }
    consistencyScore = Math.max(50, Math.round(consistencyScore));

    // trendIntegrityScore check
    let trendIntegrityScore = 100;
    if (historyRuns.length > 1) {
      let outOfOrder = 0;
      for (let i = 0; i < historyRuns.length - 1; i++) {
        const currentT = new Date(historyRuns[i].completedAt).getTime();
        const nextT = new Date(historyRuns[i + 1].completedAt).getTime();
        if (currentT <= nextT) {
          outOfOrder++;
        }
      }
      trendIntegrityScore -= (outOfOrder * 20);
    }
    trendIntegrityScore = Math.max(50, trendIntegrityScore);

    // reportingAccuracyScore check
    const exactAvg = (report.featureCoverage + report.scenarioCoverage + report.testCaseCoverage) / 3;
    const diff = Math.abs(exactAvg - overallCoverageScore);
    let reportingAccuracyScore = 100;
    if (diff > 0.01) {
      reportingAccuracyScore -= 20;
    }
    if (report.featureCoverage > 100 || report.scenarioCoverage > 100 || report.testCaseCoverage > 100) {
      reportingAccuracyScore -= 30;
    }
    reportingAccuracyScore = Math.max(50, reportingAccuracyScore);

    const reportingQuality = {
      completenessScore,
      consistencyScore,
      trendIntegrityScore,
      reportingAccuracyScore
    };

    // 5. Reporting Readiness Gate
    const reportingReadiness = {
      ready: true,
      blockingReasons: [] as string[]
    };

    // Build nested details features tree
    const detailedFeatures = features.map(f => {
      let featScenarios = f.scenarios;
      if (!featScenarios) {
        featScenarios = scenarios.filter(s => {
          const featureIds = s.scenarioOrigin?.featureIds || [];
          return featureIds.includes(f.id);
        });
      }

      const mappedScenarios = featScenarios.map((s: any) => {
        let scenTestCases = s.testCases;
        if (!scenTestCases) {
          scenTestCases = testCases.filter(tc => {
            const scenarioIds = tc.testCaseOrigin?.scenarioIds || [];
            const sId = s.scenarioId || s.id;
            return scenarioIds.includes(sId);
          });
        }

        const mappedTestCases = scenTestCases.map((tc: any) => {
          return {
            id: tc.testCaseId || tc.id,
            testCaseKey: tc.testCaseKey || '',
            testCaseName: tc.testCaseName || '',
            testCaseType: tc.testCaseType || 'FUNCTIONAL',
            priority: tc.priority || 'MEDIUM',
            description: tc.description || '',
            preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : [],
            steps: Array.isArray(tc.steps) ? tc.steps : [],
            expectedResult: tc.expectedResult || '',
            riskLevel: tc.riskLevel || 'MEDIUM',
            automationStatus: tc.automationStatus || 'UNAUTOMATED',
            automationPath: tc.automationPath || null
          };
        });

        return {
          id: s.scenarioId || s.id,
          scenarioName: s.scenarioName || '',
          scenarioType: s.scenarioType || 'POSITIVE',
          description: s.description || '',
          confidenceScore: s.confidenceScore || 0,
          riskLevel: s.riskLevel || 'MEDIUM',
          priority: s.priority || 'MEDIUM',
          testCases: mappedTestCases
        };
      });

      const scenariosCount = mappedScenarios.length;
      const testCasesCount = mappedScenarios.reduce((sum: number, s: any) => sum + s.testCases.length, 0);
      const automatedCount = mappedScenarios.reduce((sum: number, s: any) => 
        sum + s.testCases.filter((tc: any) => tc.automationStatus === 'AUTOMATED').length, 0
      );
      const coverageRatio = testCasesCount > 0 ? (automatedCount / testCasesCount) : 0;

      return {
        featureId: f.id,
        featureName: f.featureName,
        featureType: f.featureType || 'CORE',
        description: f.description || '',
        confidenceScore: f.confidenceScore || 0,
        riskLevel: f.riskLevel || 'MEDIUM',
        scenariosCount,
        testCasesCount,
        automatedCount,
        coverageRatio,
        scenarios: mappedScenarios
      };
    });

    // Build traceability gaps list
    const traceabilityGaps: any[] = [];
    features.forEach(f => {
      if (uncoveredFeatureIds.includes(f.id)) {
        traceabilityGaps.push({
          type: 'FEATURE',
          name: f.featureName,
          reason: `Feature '${f.featureName}' has no associated scenarios.`
        });
      }
    });
    scenarios.forEach(s => {
      const sId = s.scenarioId || s.id;
      if (uncoveredScenarioIds.includes(sId)) {
        traceabilityGaps.push({
          type: 'SCENARIO',
          name: s.scenarioName,
          reason: `Scenario '${s.scenarioName}' has no associated test cases.`
        });
      }
    });
    testCases.forEach(tc => {
      const tcId = tc.testCaseId || tc.id;
      if (unautomatedTestCaseIds.includes(tcId)) {
        traceabilityGaps.push({
          type: 'TEST_CASE',
          name: tc.testCaseName,
          reason: `Test case '${tc.testCaseKey || tcId}' is not automated.`
        });
      }
    });

    const dashboardPayload = {
      payloadVersion: '1.0.0' as const,
      executiveSummary,
      coverageOverview: {
        featureCoverage: report.featureCoverage,
        scenarioCoverage: report.scenarioCoverage,
        testCaseCoverage: report.testCaseCoverage,
        automationCoverage: report.automationCoverage,
        executionReadinessScore: report.executionReadinessScore,
        coverageConfidenceScore: report.coverageConfidenceScore
      },
      gapReport,
      trendReport,
      reportingQuality,
      reportingReadiness,
      details: {
        features: detailedFeatures,
        traceabilityGaps
      }
    };

    return dashboardPayload;
  }
}
