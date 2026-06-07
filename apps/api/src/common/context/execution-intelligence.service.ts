import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ExecutionRun,
  ExecutionScorecard,
  ExecutionQuality,
  validateExecutionRun,
  validateExecutionScorecard,
  validateExecutionQuality,
  validateExecutionResult,
  validateExecutionArtifact
} from '@testlens/contracts';

@Injectable()
export class ExecutionIntelligenceService {
  /**
   * Evaluates test execution run results, retry stability, flakiness, artifact availability,
   * confidence scoring, readiness gates, and historical trends.
   */
  public async evaluateExecution(
    analysisRunId: string,
    results: any[],
    environment: {
      executionEnvironment: string;
      browser: string;
      operatingSystem: string;
      frameworkVersion: string;
      executionSource: 'LOCAL' | 'GITHUB_ACTIONS' | 'JENKINS' | 'GITLAB_CI' | 'AZURE_DEVOPS' | 'MANUAL_IMPORT';
      externalExecutionId?: string;
    },
    historyRuns: any[] = []
  ): Promise<{
    run: ExecutionRun;
    scorecard: ExecutionScorecard;
    quality: ExecutionQuality;
    processedResults: any[];
    processedArtifacts: any[];
  }> {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'PASSED').length;
    const failedTests = results.filter(r => r.status === 'FAILED').length;
    const skippedTests = results.filter(r => r.status === 'SKIPPED').length;
    const blockedTests = results.filter(r => r.status === 'BLOCKED').length;
    const timedOutTests = results.filter(r => r.status === 'TIMED_OUT').length;
    
    const durationMs = results.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
    const nowStr = new Date().toISOString();
    const runUuid = randomUUID();

    // 1. Failure Intelligence and Flaky Detection Engine
    const processedResults: any[] = [];
    const processedArtifacts: any[] = [];
    
    let flakyCount = 0;
    let retryCountTotal = 0;
    let testsWithRetriesCount = 0;
    let hasCriticalFailure = false;

    // Helper to calculate standard deviation
    const calculateStdDev = (durations: number[]): number => {
      if (durations.length <= 1) return 0;
      const mean = durations.reduce((s, v) => s + v, 0) / durations.length;
      const variance = durations.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (durations.length - 1);
      return Math.sqrt(variance);
    };

    for (const rawRes of results) {
      const resId = rawRes.id || randomUUID();
      const status = rawRes.status || 'UNKNOWN';
      const duration = rawRes.durationMs || 0;
      const retries = rawRes.retryCount || 0;
      retryCountTotal += retries;
      if (retries > 0) {
        testsWithRetriesCount++;
      }

      // Check flakiness
      let isFlaky = status === 'PASSED' && retries > 0;
      
      const scriptId = rawRes.automationScriptId;
      const testDurations: number[] = [duration];
      const testStatuses: string[] = [status];
      let flakyHistoryCount = 0;

      if (scriptId && historyRuns.length > 0) {
        for (const histRun of historyRuns) {
          const histRes = histRun.results?.find((r: any) => r.automationScriptId === scriptId);
          if (histRes) {
            testDurations.push(histRes.durationMs || 0);
            testStatuses.push(histRes.status);
            if (histRes.status === 'PASSED' && histRes.retryCount > 0) {
              flakyHistoryCount++;
            }
          }
        }
      }

      // Status flipped in history
      const uniqueStatuses = new Set(testStatuses);
      if (uniqueStatuses.size > 1) {
        isFlaky = true;
      }

      // High duration variance (>200% coefficient of variation)
      if (testDurations.length > 1) {
        const testMean = testDurations.reduce((s, v) => s + v, 0) / testDurations.length;
        const testStd = calculateStdDev(testDurations);
        if (testMean > 0 && (testStd / testMean) > 2.0) {
          isFlaky = true;
        }
      }

      if (isFlaky) {
        flakyCount++;
      }

      // Determine Category
      let failureCategory = rawRes.failureCategory;
      if (!failureCategory && (status === 'FAILED' || status === 'TIMED_OUT')) {
        const reason = (rawRes.failureReason || '').toLowerCase();
        if (reason.includes('timeout') || reason.includes('timed out') || reason.includes('exceeded')) {
          failureCategory = 'TIMEOUT';
        } else if (reason.includes('network') || reason.includes('fetch') || reason.includes('xhr') || reason.includes('http')) {
          failureCategory = 'NETWORK';
        } else if (reason.includes('selector') || reason.includes('locator') || reason.includes('not found') || reason.includes('visible')) {
          failureCategory = 'SELECTOR';
        } else if (reason.includes('expect') || reason.includes('assert') || reason.includes('equal')) {
          failureCategory = 'ASSERTION';
        } else {
          failureCategory = 'UNKNOWN';
        }
      }

      // Determine Severity
      let failureSeverity = rawRes.failureSeverity;
      if (!failureSeverity && (status === 'FAILED' || status === 'TIMED_OUT')) {
        const reason = (rawRes.failureReason || '').toLowerCase();
        const isCriticalPath =
          reason.includes('billing') || reason.includes('checkout') ||
          reason.includes('auth') || reason.includes('payment') ||
          reason.includes('login');

        if (isCriticalPath) {
          failureSeverity = 'CRITICAL';
        } else if (status === 'FAILED' && failureCategory === 'ASSERTION') {
          failureSeverity = 'HIGH';
        } else if (failureCategory === 'SELECTOR' || failureCategory === 'TIMEOUT') {
          failureSeverity = 'MEDIUM';
        } else {
          failureSeverity = 'LOW';
        }
      } else if (status === 'SKIPPED' || status === 'BLOCKED') {
        failureSeverity = 'LOW';
      }

      if (failureSeverity === 'CRITICAL') {
        hasCriticalFailure = true;
      }

      const validatedResult = validateExecutionResult({
        id: resId,
        executionRunId: runUuid,
        automationScriptId: scriptId || null,
        status,
        failureCategory: failureCategory || undefined,
        failureSeverity: failureSeverity || undefined,
        durationMs: duration,
        failureReason: rawRes.failureReason || undefined,
        retryCount: retries,
        startedAt: rawRes.startedAt || nowStr,
        completedAt: rawRes.completedAt || nowStr
      });

      processedResults.push(validatedResult);

      // Process Artifacts
      const rawArtifacts = rawRes.artifacts || [];
      for (const rawArt of rawArtifacts) {
        const validatedArtifact = validateExecutionArtifact({
          id: rawArt.id || randomUUID(),
          executionResultId: resId,
          artifactType: rawArt.artifactType || 'LOG',
          path: rawArt.path || '',
          sizeBytes: rawArt.sizeBytes !== undefined ? rawArt.sizeBytes : undefined,
          createdAt: rawArt.createdAt || nowStr,
          checksum: rawArt.checksum || undefined,
          expiresAt: rawArt.expiresAt || undefined
        });
        processedArtifacts.push(validatedArtifact);
      }
    }

    // 2. Aggregator calculations
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 10000) / 100 : 0;
    const failRate = totalTests > 0 ? Math.round((failedTests / totalTests) * 10000) / 100 : 0;
    const skippedRate = totalTests > 0 ? Math.round((skippedTests / totalTests) * 10000) / 100 : 0;
    const blockedRate = totalTests > 0 ? Math.round((blockedTests / totalTests) * 10000) / 100 : 0;
    const timeoutRate = totalTests > 0 ? Math.round((timedOutTests / totalTests) * 10000) / 100 : 0;
    
    const executionSuccessRate = (totalTests - skippedTests) > 0
      ? Math.round((passedTests / (totalTests - skippedTests)) * 10000) / 100
      : 0;

    const retryRate = totalTests > 0 ? Math.round((testsWithRetriesCount / totalTests) * 10000) / 100 : 0;
    const flakyRate = totalTests > 0 ? Math.round((flakyCount / totalTests) * 10000) / 100 : 0;

    // 3. Artifact Integrity Evaluator
    const failingTestsCount = failedTests + timedOutTests;
    const failingTestsWithArtifactsCount = processedResults
      .filter(r => r.status === 'FAILED' || r.status === 'TIMED_OUT')
      .filter(r => processedArtifacts.some(a => a.executionResultId === r.id))
      .length;

    const artifactAvailability = failingTestsCount > 0
      ? Math.round((failingTestsWithArtifactsCount / failingTestsCount) * 10000) / 100
      : 100.00;

    // 4. Execution Confidence Engine
    const automationQuality = 100.00; // Pull standard default or set constant
    const retryStability = 100.00 - retryRate;
    const artifactIntegrity = artifactAvailability;

    let confidence = 0.40 * passRate - 0.20 * flakyRate + 0.20 * automationQuality + 0.10 * retryStability + 0.10 * artifactIntegrity;
    confidence = Math.max(0, Math.min(100, Math.round(confidence * 100) / 100));

    // Minimum Sample Gate
    if (totalTests < 20) {
      confidence = Math.min(80, confidence);
    }

    // 5. Execution Readiness Engine
    const readyBlockingReasons: string[] = [];
    if (totalTests === 0) {
      readyBlockingReasons.push("No execution results exist.");
    }
    if (passRate < 95.0) {
      readyBlockingReasons.push(`Pass rate ${passRate}% is below the 95% threshold.`);
    }
    if (flakyRate > 15.0) {
      readyBlockingReasons.push(`Flaky rate ${flakyRate}% exceeds the 15% threshold.`);
    }
    if (hasCriticalFailure) {
      readyBlockingReasons.push("Critical path failure detected.");
    }
    if (confidence < 70.0) {
      readyBlockingReasons.push(`Execution confidence score ${confidence} is below the 70 threshold.`);
    }

    // Critical Failure Override
    if (hasCriticalFailure) {
      readyBlockingReasons.push("Critical path failure detected. Maximum quality classification capped at GOOD.");
    }

    const isReady = readyBlockingReasons.length === 0;

    // 6. Historical Stability Index
    const validHistRuns = historyRuns.filter(r => r.totalTests > 0);
    let trendDirection: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';

    if (validHistRuns.length > 0) {
      const sumPassRates = validHistRuns.reduce((sum, run) => {
        const runPassRate = (run.passedTests / run.totalTests) * 100;
        return sum + runPassRate;
      }, 0);
      const avgPassRate = sumPassRates / validHistRuns.length;
      
      if (passRate > avgPassRate + 2.0) {
        trendDirection = 'IMPROVING';
      } else if (passRate < avgPassRate - 2.0) {
        trendDirection = 'DECLINING';
      }
    }

    // 7. Execution Source Analytics
    const sourceGroups: Record<string, { passRates: number[], flakyRates: number[], durations: number[] }> = {};

    const allRunsForAnalytics = [
      {
        executionSource: environment.executionSource,
        passedTests,
        failedTests,
        totalTests,
        durationMs,
        flakyCount
      },
      ...historyRuns.map(r => ({
        executionSource: r.executionSource,
        passedTests: r.passedTests,
        failedTests: r.failedTests,
        totalTests: r.totalTests,
        durationMs: r.durationMs,
        flakyCount: r.results?.filter((res: any) => res.status === 'PASSED' && res.retryCount > 0).length || 0
      }))
    ];

    for (const runData of allRunsForAnalytics) {
      if (runData.totalTests === 0) continue;
      const src = runData.executionSource;
      if (!sourceGroups[src]) {
        sourceGroups[src] = { passRates: [], flakyRates: [], durations: [] };
      }
      const runPassRate = (runData.passedTests / runData.totalTests) * 100;
      const runFlakyRate = (runData.flakyCount / runData.totalTests) * 100;
      const runAvgDuration = runData.durationMs / runData.totalTests;
      
      sourceGroups[src].passRates.push(runPassRate);
      sourceGroups[src].flakyRates.push(runFlakyRate);
      sourceGroups[src].durations.push(runAvgDuration);
    }

    const sourceAnalytics = Object.entries(sourceGroups).map(([source, data]) => {
      const avgPass = data.passRates.reduce((s, v) => s + v, 0) / data.passRates.length;
      const avgFlaky = data.flakyRates.reduce((s, v) => s + v, 0) / data.flakyRates.length;
      const avgDur = data.durations.reduce((s, v) => s + v, 0) / data.durations.length;
      return {
        executionSource: source,
        averagePassRate: Math.round(avgPass * 100) / 100,
        flakyRate: Math.round(avgFlaky * 100) / 100,
        averageDurationMs: Math.round(avgDur * 100) / 100,
        sampleCount: data.passRates.length
      };
    });

    const run: ExecutionRun = {
      id: runUuid,
      analysisRunId,
      executionEnvironment: environment.executionEnvironment,
      browser: environment.browser,
      operatingSystem: environment.operatingSystem,
      frameworkVersion: environment.frameworkVersion,
      executionSource: environment.executionSource,
      externalExecutionId: environment.externalExecutionId,
      startedAt: nowStr,
      completedAt: nowStr,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      blockedTests,
      timedOutTests,
      durationMs
    };

    const scorecard: ExecutionScorecard = {
      version: '1.0.0',
      passRate,
      failRate,
      skippedRate,
      blockedRate,
      timeoutRate,
      executionConfidenceScore: confidence,
      executionReadiness: {
        ready: isReady,
        blockingReasons: readyBlockingReasons
      },
      builderMetadata: {
        generatedAt: nowStr,
        analysisRunId,
        executionSuccessRate,
        retryRate,
        flakyRate,
        artifactAvailability,
        trendDirection,
        sourceAnalytics: sourceAnalytics as any
      }
    };

    // 8. Execution Quality calculations
    // Calculate standard deviation of durations in current run to map durationReliabilityScore
    const currentDurations = results.map(r => r.durationMs || 0);
    const currentMean = currentDurations.reduce((s, v) => s + v, 0) / Math.max(1, currentDurations.length);
    const currentStd = calculateStdDev(currentDurations);
    const cv = currentMean > 0 ? (currentStd / currentMean) : 0;
    const durationReliabilityScore = Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));

    const quality: ExecutionQuality = {
      id: randomUUID(),
      executionRunId: run.id,
      passRateScore: passRate,
      flakyScore: Math.round((100.00 - flakyRate) * 100) / 100,
      retryStabilityScore: Math.round(retryStability * 100) / 100,
      durationReliabilityScore,
      artifactCompletenessScore: artifactAvailability
    };

    return {
      run: validateExecutionRun(run),
      scorecard: validateExecutionScorecard(scorecard),
      quality: validateExecutionQuality(quality),
      processedResults,
      processedArtifacts
    };
  }
}
