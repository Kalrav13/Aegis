import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';

interface BackendOfflineStateProps {
  /** URL to ping for connectivity checks */
  healthEndpoint?: string;
  /** How often (ms) to auto-retry when offline */
  autoRetryIntervalMs?: number;
  /** Callback fired when connectivity is restored */
  onReconnected?: () => void;
}

export default function BackendOfflineState({
  healthEndpoint = '/health',
  autoRetryIntervalMs = 10000,
  onReconnected
}: BackendOfflineStateProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const onReconnectedRef = useRef(onReconnected);

  useEffect(() => {
    onReconnectedRef.current = onReconnected;
  }, [onReconnected]);

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(healthEndpoint, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [healthEndpoint]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    const isOnline = await checkConnectivity();
    setIsRetrying(false);

    if (isOnline) {
      setIsOffline(false);
      onReconnectedRef.current?.();
    }
  }, [checkConnectivity]);

  // Initial connectivity check on mount
  useEffect(() => {
    let mounted = true;

    const initialCheck = async () => {
      const isOnline = await checkConnectivity();
      if (mounted && !isOnline) {
        setIsOffline(true);
      }
    };

    initialCheck();
    return () => { mounted = false; };
  }, [checkConnectivity]);

  // Auto-retry countdown loop when offline
  useEffect(() => {
    if (!isOffline) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const totalSeconds = Math.floor(autoRetryIntervalMs / 1000);
    setCountdown(totalSeconds);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return totalSeconds;
        return prev - 1;
      });
    }, 1000);

    timerRef.current = setInterval(async () => {
      const isOnline = await checkConnectivity();
      if (isOnline) {
        setIsOffline(false);
        onReconnectedRef.current?.();
      }
    }, autoRetryIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isOffline, autoRetryIntervalMs, checkConnectivity]);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-sm border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Animated top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse" />

        <div className="p-8 flex flex-col items-center text-center space-y-5">
          {/* Animated icon */}
          <div className="relative">
            <div className="h-16 w-16 bg-rose-500/10 rounded-full flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-rose-400" />
            </div>
            <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-rose-500/20 animate-ping" />
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-lg text-slate-100">
              Unable to Connect
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              TestLens API is not responding. Please verify the backend service is running
              and accessible.
            </p>
          </div>

          {/* Countdown indicator */}
          <div className="text-[11px] text-slate-500 font-medium">
            Auto-retry in <span className="text-amber-400 font-bold tabular-nums">{countdown}s</span>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-1">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl flex items-center space-x-2 transition-all duration-200 shadow-lg shadow-indigo-600/20"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>{isRetrying ? 'Checking...' : 'Retry Connection'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
