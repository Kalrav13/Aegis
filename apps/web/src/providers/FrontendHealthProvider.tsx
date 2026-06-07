import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getApiBaseUrl } from '../utils/api';

interface HealthMetrics {
  /** Average API latency in ms (rolling window) */
  avgLatencyMs: number;
  /** Last measured API latency in ms */
  lastLatencyMs: number;
  /** Number of successful health checks */
  successCount: number;
  /** Number of failed health checks */
  failureCount: number;
  /** Whether the backend is currently reachable */
  isHealthy: boolean;
  /** Timestamp of last successful check */
  lastCheckedAt: string | null;
}

interface FrontendHealthContextType {
  metrics: HealthMetrics;
  /** Force an immediate health check */
  checkNow: () => Promise<void>;
}

const FrontendHealthContext = createContext<FrontendHealthContextType | undefined>(undefined);

export function useFrontendHealth() {
  const context = useContext(FrontendHealthContext);
  if (!context) {
    throw new Error('useFrontendHealth must be used within a FrontendHealthProvider');
  }
  return context;
}

export function FrontendHealthProvider({ 
  children,
  healthEndpoint,
  intervalMs = 30000 
}: { 
  children: React.ReactNode;
  healthEndpoint?: string;
  intervalMs?: number;
}) {
  const [metrics, setMetrics] = useState<HealthMetrics>({
    avgLatencyMs: 0,
    lastLatencyMs: 0,
    successCount: 0,
    failureCount: 0,
    isHealthy: true,
    lastCheckedAt: null
  });

  const latencyWindowRef = useRef<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve healthEndpoint dynamically
  const activeHealthEndpoint = healthEndpoint || (getApiBaseUrl() ? `${getApiBaseUrl()}/health` : '/health');

  const performCheck = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch(activeHealthEndpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Bypass-Tunnel-Reminder': 'true' },
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - start);

      // Keep rolling window of last 10 measurements
      latencyWindowRef.current.push(latency);
      if (latencyWindowRef.current.length > 10) {
        latencyWindowRef.current.shift();
      }

      const avg = Math.round(
        latencyWindowRef.current.reduce((a, b) => a + b, 0) / latencyWindowRef.current.length
      );

      setMetrics(prev => ({
        avgLatencyMs: avg,
        lastLatencyMs: latency,
        successCount: prev.successCount + 1,
        failureCount: prev.failureCount,
        isHealthy: res.ok,
        lastCheckedAt: new Date().toISOString()
      }));
    } catch {
      const latency = Math.round(performance.now() - start);
      setMetrics(prev => ({
        ...prev,
        lastLatencyMs: latency,
        failureCount: prev.failureCount + 1,
        isHealthy: false,
        lastCheckedAt: new Date().toISOString()
      }));
    }
  }, [activeHealthEndpoint]);

  useEffect(() => {
    // Initial check
    performCheck();

    // Set up periodic checks
    timerRef.current = setInterval(performCheck, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [performCheck, intervalMs]);

  return (
    <FrontendHealthContext.Provider value={{ metrics, checkNow: performCheck }}>
      {children}
    </FrontendHealthContext.Provider>
  );
}
