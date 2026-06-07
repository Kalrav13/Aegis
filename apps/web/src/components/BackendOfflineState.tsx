import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, Loader2, AlertCircle, ShieldAlert, Terminal, CheckCircle } from 'lucide-react';
import { getApiBaseUrl } from '../utils/api';

interface BackendOfflineStateProps {
  /** URL to ping for connectivity checks */
  healthEndpoint?: string;
  /** How often (ms) to auto-retry when offline */
  autoRetryIntervalMs?: number;
  /** Callback fired when connectivity is restored */
  onReconnected?: () => void;
}

type ConnectionStatus = {
  isOnline: boolean;
  errorType: 'API_OFFLINE' | 'API_ROUTE_NOT_FOUND' | 'AUTHORIZATION_ERROR' | 'VALIDATION_ERROR' | 'SERVER_ERROR' | null;
  statusCode: number | null;
  details: string | null;
};

export default function BackendOfflineState({
  healthEndpoint,
  autoRetryIntervalMs = 10000,
  onReconnected
}: BackendOfflineStateProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isOnline: true,
    errorType: null,
    statusCode: null,
    details: null
  });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const onReconnectedRef = useRef(onReconnected);

  // Resolve healthEndpoint dynamically
  const activeHealthEndpoint = healthEndpoint || (getApiBaseUrl() ? `${getApiBaseUrl()}/health` : '/health');

  useEffect(() => {
    setTempApiUrl(localStorage.getItem('testlens_api_url') || getApiBaseUrl() || 'http://localhost:3001/api/v1');
  }, [isOffline]);

  const handleSaveUrl = () => {
    localStorage.setItem('testlens_api_url', tempApiUrl);
    window.location.reload();
  };

  const handleClearUrl = () => {
    localStorage.removeItem('testlens_api_url');
    window.location.reload();
  };

  useEffect(() => {
    onReconnectedRef.current = onReconnected;
  }, [onReconnected]);

  const checkConnectivity = useCallback(async (): Promise<ConnectionStatus> => {
    try {
      const res = await fetch(activeHealthEndpoint, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      });
      
      if (res.ok) {
        return {
          isOnline: true,
          errorType: null,
          statusCode: res.status,
          details: 'Healthy connection established.'
        };
      }
      
      let errorType: ConnectionStatus['errorType'] = 'SERVER_ERROR';
      let details = `HTTP ${res.status} ${res.statusText || ''}`;
      
      if (res.status === 404) {
        errorType = 'API_ROUTE_NOT_FOUND';
        details = 'The health check endpoint was not found (404). Check global prefixes, controller exclusions, or routing configuration.';
      } else if (res.status === 401 || res.status === 403) {
        errorType = 'AUTHORIZATION_ERROR';
        details = 'Access to the health check endpoint is unauthorized (401/403). Check CORS headers or authorization middleware.';
      } else if (res.status === 422) {
        errorType = 'VALIDATION_ERROR';
        details = 'The server rejected the parameters (422 validation failure).';
      } else if (res.status >= 500) {
        errorType = 'SERVER_ERROR';
        details = 'The server encountered an internal server error (500) while processing the health check request.';
      }
      
      return {
        isOnline: false,
        errorType,
        statusCode: res.status,
        details
      };
    } catch (err: any) {
      return {
        isOnline: false,
        errorType: 'API_OFFLINE',
        statusCode: null,
        details: err?.message || 'Failed to connect. The API server may be offline, DNS resolving failed, or browser CORS policy blocked the request.'
      };
    }
  }, [activeHealthEndpoint]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    const statusObj = await checkConnectivity();
    setConnectionStatus(statusObj);
    setIsRetrying(false);

    if (statusObj.isOnline) {
      setIsOffline(false);
      onReconnectedRef.current?.();
    }
  }, [checkConnectivity]);

  // Initial connectivity check on mount
  useEffect(() => {
    let mounted = true;

    const initialCheck = async () => {
      const statusObj = await checkConnectivity();
      if (mounted) {
        setConnectionStatus(statusObj);
        if (!statusObj.isOnline) {
          setIsOffline(true);
        }
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
      const statusObj = await checkConnectivity();
      setConnectionStatus(statusObj);
      if (statusObj.isOnline) {
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

  // Resolve styling based on error classification
  const getClassificationUI = () => {
    switch (connectionStatus.errorType) {
      case 'API_OFFLINE':
        return {
          label: 'API Server Offline',
          badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          indicatorColor: 'from-rose-500 via-red-500 to-rose-500'
        };
      case 'API_ROUTE_NOT_FOUND':
        return {
          label: 'Route Not Found (404)',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          indicatorColor: 'from-amber-500 via-orange-500 to-amber-500'
        };
      case 'AUTHORIZATION_ERROR':
        return {
          label: 'Authorization Error (401/403)',
          badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
          indicatorColor: 'from-violet-500 via-indigo-500 to-violet-500'
        };
      case 'VALIDATION_ERROR':
        return {
          label: 'Validation Error (422)',
          badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          indicatorColor: 'from-cyan-500 via-teal-500 to-cyan-500'
        };
      case 'SERVER_ERROR':
      default:
        return {
          label: 'Server Error (500+)',
          badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          indicatorColor: 'from-rose-600 via-pink-500 to-rose-600'
        };
    }
  };

  const ui = getClassificationUI();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Animated top accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${ui.indicatorColor} animate-pulse`} />

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
            <p className="text-sm text-slate-450 leading-relaxed max-w-sm">
              The TestLens frontend client was unable to connect to the backend server.
            </p>
          </div>

          {/* Classification details */}
          <div className="w-full bg-slate-900/90 rounded-xl border border-slate-800 p-4 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Classification</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ui.badgeColor}`}>
                {ui.label}
              </span>
            </div>
            
            <div className="space-y-1">
              <span className="block text-[10px] text-slate-500 font-semibold uppercase">Target Endpoint</span>
              <div className="font-mono text-[11px] text-slate-300 break-all select-all bg-slate-950/60 p-2 rounded border border-slate-900 flex items-center justify-between">
                <span>{activeHealthEndpoint}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-[10px] text-slate-500 font-semibold uppercase">Error Diagnostics</span>
              <p className="text-[11px] text-slate-400 leading-normal bg-slate-950/40 p-2 rounded border border-slate-900">
                {connectionStatus.details}
              </p>
            </div>
          </div>

          {/* Countdown indicator */}
          <div className="text-[11px] text-slate-500 font-medium">
            Auto-retry in <span className="text-amber-400 font-bold tabular-nums">{countdown}s</span>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center space-y-4 pt-1 w-full">
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

            {/* Configurable URL */}
            <div className="w-full pt-4 border-t border-slate-800/80 space-y-2 text-left">
              <label className="block text-[10px] text-slate-500 font-semibold uppercase">
                API Connection URL Customizer
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={tempApiUrl}
                  onChange={(e) => setTempApiUrl(e.target.value)}
                  placeholder="https://testlens-production.up.railway.app"
                  className="flex-1 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleSaveUrl}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm text-center"
                  >
                    Save
                  </button>
                  {localStorage.getItem('testlens_api_url') && (
                    <button
                      onClick={handleClearUrl}
                      className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors text-center"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <span className="block text-[9.5px] text-slate-500 leading-normal">
                Leave empty or click Reset to fallback to Vercel's environment default. If overriding, type the base domain only (e.g., <code>https://your-api.up.railway.app</code>).
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
