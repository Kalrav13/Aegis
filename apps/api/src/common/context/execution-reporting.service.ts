import { Injectable } from '@nestjs/common';
import { prisma } from '@testlens/db';
import {
  ExecutionRun,
  ExecutionScorecard,
  ExecutionQuality,
  validateExecutionDashboardPayload,
  validateExecutionReportingQuality,
  ExecutionDashboardPayload,
  ExecutionReportingQuality,
  TrendDirection
} from '@testlens/contracts';

export class ExecutionReportNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionReportNotFoundError';
  }
}

export class ExecutionDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionDataValidationError';
  }
}

@Injectable()
export class ExecutionReportingService {
  /**
   * Retrieves the pre-computed execution dashboard report from the database cache.
   */
  public async getExecutionReport(analysisRunId: string): Promise<ExecutionDashboardPayload> {
    const run = await prisma.analysisRun.findUnique({
      where: { id: analysisRunId }
    });

    if (!run) {
      throw new ExecutionReportNotFoundError(`Analysis run with ID ${analysisRunId} not found`);
    }

    const payload = run.executionDashboardPayload;
    if (!payload) {
      throw new ExecutionReportNotFoundError(`Execution report not found for analysis run ${analysisRunId}`);
    }

    try {
      return validateExecutionDashboardPayload(payload);
    } catch (error: any) {
      throw new ExecutionDataValidationError(`Execution dashboard payload validation failed: ${error.message}`);
    }
  }

  /**
   * Generates a complete pre-computed Execution Dashboard Payload and Reporting Quality report.
   */
  public generateDashboardPayload(
    analysisRunId: string,
    run: ExecutionRun,
    scorecard: ExecutionScorecard,
    quality: ExecutionQuality,
    results: any[],
    historyRuns: any[]
  ): {
    payload: ExecutionDashboardPayload;
    reportingQuality: ExecutionReportingQuality;
  } {
    const executiveSummary = this.buildExecutiveSummary(run, scorecard, results);
    const failuresReport = this.buildFailureReport(results, run);
    const flakyReport = this.buildFlakyReport(results, historyRuns, scorecard);
    const trendsReport = this.buildTrendReport(analysisRunId, scorecard, historyRuns);
    const sourceReport = this.buildSourceReport(scorecard);
    const readiness = this.buildReadinessReport(run, scorecard, trendsReport);
    const reportingQuality = this.buildQualityReport(results, historyRuns);

    const payload = validateExecutionDashboardPayload({
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      analysisRunId,
      executiveSummary,
      readiness,
      failuresReport,
      flakyReport,
      trendsReport,
      sourceReport,
      qualityMetrics: quality
    });

    return {
      payload,
      reportingQuality
    };
  }

  private buildExecutiveSummary(
    run: ExecutionRun,
    scorecard: ExecutionScorecard,
    results: any[]
  ) {
    const passRate = scorecard.passRate;
    const confidence = scorecard.executionConfidenceScore;
    const overallScore = Math.round((0.60 * passRate + 0.40 * confidence) * 100) / 100;
    
    let classification: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'POOR';
    if (overallScore >= 90) {
      classification = 'EXCELLENT';
    } else if (overallScore >= 80) {
      classification = 'GOOD';
    } else if (overallScore >= 65) {
      classification = 'FAIR';
    }

    const hasCritical = results.some(r => r.failureSeverity === 'CRITICAL');
    if (hasCritical && classification === 'EXCELLENT') {
      classification = 'GOOD';
    }

    const strengths: string[] = [];
    const risks: string[] = [];

    if (passRate >= 95.0) {
      strengths.push(`High test pass rate of ${passRate}% exceeds the 95% gate.`);
    } else {
      risks.push(`Low test pass rate of ${passRate}% blocks release readiness.`);
    }

    const flakyRate = scorecard.builderMetadata?.flakyRate ?? 0;
    if (flakyRate < 5.0) {
      strengths.push(`Excellent execution stability with low flaky rate of ${flakyRate}%.`);
    } else if (flakyRate > 10.0) {
      risks.push(`High test flakiness of ${flakyRate}% requires maintenance.`);
    }

    const retryRate = scorecard.builderMetadata?.retryRate ?? 0;
    if (retryRate < 5.0) {
      strengths.push(`High execution stability with retry rate of ${retryRate}%.`);
    }

    const artifactAvailability = scorecard.builderMetadata?.artifactAvailability ?? 100;
    if (artifactAvailability > 90.0) {
      strengths.push(`Diagnostic screenshots and logs are ${artifactAvailability}% available for failures.`);
    } else {
      risks.push(`Diagnostic artifacts are only ${artifactAvailability}% available, impeding failure investigations.`);
    }

    if (hasCritical) {
      risks.push("Critical path failures detected in core functionality workflows.");
    }

    if (confidence < 70.0) {
      risks.push(`Confidence score of ${confidence} is below the 70 threshold.`);
    }

    const ready = scorecard.executionReadiness.ready;
    let recommendation = "All release readiness thresholds have been satisfied. Recommended for production deployment.";
    let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';

    if (!ready) {
      recommendation = `Release blocked due to: ${scorecard.executionReadiness.blockingReasons.join(', ')}`;
      severity = 'CRITICAL';
    } else if (classification === 'FAIR') {
      recommendation = "Gates passed, but execution classification is FAIR. Proceed with caution.";
      severity = 'WARNING';
    }

    return {
      overallExecutionScore: overallScore,
      executionConfidenceScore: confidence,
      executionClassification: classification,
      releaseReady: ready,
      topStrengths: strengths.slice(0, 3),
      topRisks: risks.slice(0, 3),
      recommendation,
      recommendationSeverity: severity
    };
  }

  private buildFailureReport(results: any[], run: ExecutionRun) {
    const getLink = (source: string, extId?: string | null): string => {
      if (!extId) return '#';
      if (source === 'GITHUB_ACTIONS') {
        return `https://github.com/company/repo/actions/runs/${extId}`;
      } else if (source === 'JENKINS') {
        return `https://jenkins.company.com/job/test-run/${extId}`;
      } else if (source === 'GITLAB_CI') {
        return `https://gitlab.com/company/repo/-/jobs/${extId}`;
      } else if (source === 'AZURE_DEVOPS') {
        return `https://dev.azure.com/company/project/_build/results?buildId=${extId}`;
      }
      return '#';
    };

    const mapper = (r: any) => ({
      resultId: r.id,
      testCaseId: r.testCaseId || null,
      testCaseName: r.testCaseName || `Test Result: ${r.id.substring(0, 8)}`,
      failureReason: r.failureReason || 'Unknown failure reason',
      durationMs: r.durationMs || 0,
      failureCategory: r.failureCategory || 'UNKNOWN',
      ciDeepLink: getLink(run.executionSource, run.externalExecutionId)
    });

    const criticalFailures = results.filter(r => r.failureSeverity === 'CRITICAL').map(mapper);
    const highFailures = results.filter(r => r.failureSeverity === 'HIGH').map(mapper);
    const mediumFailures = results.filter(r => r.failureSeverity === 'MEDIUM').map(mapper);
    const lowFailures = results.filter(r => r.failureSeverity === 'LOW').map(mapper);

    return {
      criticalFailures,
      highFailures,
      mediumFailures,
      lowFailures
    };
  }

  private buildFlakyReport(results: any[], historyRuns: any[], scorecard: ExecutionScorecard) {
    const getRiskFactor = (severity?: string | null): number => {
      if (severity === 'CRITICAL') return 3.0;
      if (severity === 'HIGH') return 2.0;
      if (severity === 'MEDIUM') return 1.5;
      return 1.0;
    };

    const calculateStdDev = (durations: number[]): number => {
      if (durations.length <= 1) return 0;
      const mean = durations.reduce((s, v) => s + v, 0) / durations.length;
      const variance = durations.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (durations.length - 1);
      return Math.sqrt(variance);
    };

    const flakyItems: any[] = [];
    const scriptMap = new Map<string, { current: any; history: any[] }>();

    for (const r of results) {
      if (r.automationScriptId) {
        scriptMap.set(r.automationScriptId, { current: r, history: [] });
      }
    }

    for (const hRun of historyRuns) {
      if (!hRun.results) continue;
      for (const hRes of hRun.results) {
        if (hRes.automationScriptId && scriptMap.has(hRes.automationScriptId)) {
          scriptMap.get(hRes.automationScriptId)!.history.push(hRes);
        }
      }
    }

    for (const [scriptId, data] of scriptMap.entries()) {
      const currentRes = data.current;
      const historyResList = data.history;

      const isCurrentFlaky = currentRes.status === 'PASSED' && currentRes.retryCount > 0;
      let flakyCount = isCurrentFlaky ? 1 : 0;
      const allStatuses = [currentRes.status, ...historyResList.map(h => h.status)];
      const uniqueStatuses = new Set(allStatuses);
      let isHistoryFlaky = uniqueStatuses.size > 1;

      for (const h of historyResList) {
        if (h.status === 'PASSED' && h.retryCount > 0) {
          flakyCount++;
        }
      }

      const totalRuns = 1 + historyResList.length;
      const flakyRate = Math.round((flakyCount / totalRuns) * 10000) / 100;

      const durations = [currentRes.durationMs, ...historyResList.map(h => h.durationMs)];
      const avgDuration = durations.reduce((s, v) => s + v, 0) / durations.length;
      const stdDev = calculateStdDev(durations);
      const durationVarianceRatio = avgDuration > 0 ? (stdDev / avgDuration) : 0;

      const riskFactor = getRiskFactor(currentRes.failureSeverity);
      const priorityScore = Math.round((flakyRate * riskFactor + durationVarianceRatio * 100) * 100) / 100;

      let flakySeverity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (flakyCount >= 3) {
        flakySeverity = 'HIGH';
      } else if (flakyCount === 2) {
        flakySeverity = 'MEDIUM';
      }

      if (isCurrentFlaky || isHistoryFlaky || flakyCount > 0) {
        flakyItems.push({
          testCaseId: currentRes.testCaseId || null,
          testCaseName: currentRes.testCaseName || `Script ${scriptId.substring(0, 8)}`,
          flakyRate,
          maintenancePriorityScore: priorityScore,
          flakySeverity
        });
      }
    }

    flakyItems.sort((a, b) => b.maintenancePriorityScore - a.maintenancePriorityScore);

    const highFlakyTests = flakyItems.filter(t => t.flakySeverity === 'HIGH');
    const mediumFlakyTests = flakyItems.filter(t => t.flakySeverity === 'MEDIUM');
    const lowFlakyTests = flakyItems.filter(t => t.flakySeverity === 'LOW');

    const overallFlakyRate = scorecard.builderMetadata?.flakyRate ?? 0;
    const stabilityIndex = Math.round((100.00 - overallFlakyRate) * 100) / 100;

    return {
      highFlakyTests,
      mediumFlakyTests,
      lowFlakyTests,
      flakyRate: overallFlakyRate,
      stabilityIndex
    };
  }

  private buildTrendReport(
    analysisRunId: string,
    currentScorecard: ExecutionScorecard,
    historyRuns: any[]
  ) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const validHistoryRuns = historyRuns.filter(r => {
      const compDate = r.completedAt ? new Date(r.completedAt) : null;
      return compDate && compDate >= thirtyDaysAgo;
    });

    const trendItems: any[] = [];
    const sortedHistoryRuns = [...validHistoryRuns].reverse();

    for (const hRun of sortedHistoryRuns) {
      if (!hRun.totalTests) continue;
      const passRate = Math.round((hRun.passedTests / hRun.totalTests) * 10000) / 100;
      const failRate = Math.round((hRun.failedTests / hRun.totalTests) * 10000) / 100;
      
      const scorecardJson = hRun.executionScorecard as any;
      const flakyRate = scorecardJson?.builderMetadata?.flakyRate ?? 0;
      const confidenceScore = scorecardJson?.executionConfidenceScore ?? passRate;
      const ready = scorecardJson?.executionReadiness?.ready ?? false;

      trendItems.push({
        analysisRunId: hRun.id,
        startedAt: hRun.startedAt.toISOString(),
        passRate,
        failRate,
        flakyRate,
        confidenceScore,
        ready
      });
    }

    trendItems.push({
      analysisRunId,
      startedAt: new Date().toISOString(),
      passRate: currentScorecard.passRate,
      failRate: currentScorecard.failRate,
      flakyRate: currentScorecard.builderMetadata?.flakyRate ?? 0,
      confidenceScore: currentScorecard.executionConfidenceScore,
      ready: currentScorecard.executionReadiness.ready
    });

    const getDirection = (currVal: number, prevVal?: number): TrendDirection => {
      if (prevVal === undefined) return 'STABLE';
      const delta = currVal - prevVal;
      if (delta > 0.5) return 'IMPROVING';
      if (delta < -0.5) return 'DECLINING';
      return 'STABLE';
    };

    const n = trendItems.length;
    const current = trendItems[n - 1];
    const prev = n > 1 ? trendItems[n - 2] : undefined;

    return {
      history: trendItems,
      passRateTrend: getDirection(current.passRate, prev?.passRate),
      failRateTrend: getDirection(current.failRate, prev?.failRate),
      flakyRateTrend: getDirection(current.flakyRate, prev?.flakyRate),
      confidenceTrend: getDirection(current.confidenceScore, prev?.confidenceScore)
    };
  }

  private buildSourceReport(scorecard: ExecutionScorecard) {
    const sourceReport = scorecard.builderMetadata?.sourceAnalytics || [];
    const segments = sourceReport.map((s: any) => ({
      executionSource: s.executionSource,
      averagePassRate: s.averagePassRate,
      flakyRate: s.flakyRate || s.flakyRate === 0 ? s.flakyRate : 0,
      averageDurationMs: s.averageDurationMs,
      sampleCount: s.sampleCount
    }));

    return {
      sourceSegments: segments
    };
  }

  private buildQualityReport(results: any[], historyRuns: any[]) {
    const totalItems = results.length;
    if (totalItems === 0) {
      return validateExecutionReportingQuality({
        completenessScore: 100,
        consistencyScore: 100,
        trendIntegrityScore: 100,
        reportingAccuracyScore: 100
      });
    }

    let completeCount = 0;
    for (const r of results) {
      const hasBasicFields = r.status && r.durationMs !== undefined && r.startedAt && r.completedAt;
      const isFailed = r.status === 'FAILED' || r.status === 'TIMED_OUT';
      const hasArtifactCheck = !isFailed || (r.artifacts && r.artifacts.length > 0);
      
      if (hasBasicFields && hasArtifactCheck) {
        completeCount++;
      }
    }
    const completenessScore = Math.round((completeCount / totalItems) * 100);

    const hasConsistency = results.every(r => r.executionRunId);
    const consistencyScore = hasConsistency ? 100 : 50;

    const validHistoryCount = historyRuns.filter(r => r.totalTests > 0).length;
    const trendIntegrityScore = Math.min(100, Math.round((validHistoryCount / 5) * 100));

    const reportingAccuracyScore = 100;

    return validateExecutionReportingQuality({
      completenessScore,
      consistencyScore,
      trendIntegrityScore,
      reportingAccuracyScore
    });
  }

  private buildReadinessReport(
    run: ExecutionRun,
    scorecard: ExecutionScorecard,
    trend: any
  ) {
    const blockingReasons: string[] = [];

    if (!run) {
      blockingReasons.push("Execution run missing.");
    }
    if (!scorecard) {
      blockingReasons.push("Scorecard unavailable.");
    }
    if (!trend || !trend.history || trend.history.length === 0) {
      blockingReasons.push("Trend data corrupted.");
    }

    const ready = blockingReasons.length === 0;

    return {
      ready,
      blockingReasons
    };
  }
}
