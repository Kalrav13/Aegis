import { useEffect, useRef } from 'react';
import { fetchAnalysisStatus } from '../utils/api';
import { AnalysisRun } from '../types';

interface PollingOptions {
  analysisId: string | null;
  status: string | null;
  onStatusUpdate: (updatedRun: AnalysisRun) => void;
  pollingInterval?: number;
}

export function useAnalysisPolling({
  analysisId,
  status,
  onStatusUpdate,
  pollingInterval = 3000
}: PollingOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef<number>(0);
  const callbackRef = useRef(onStatusUpdate);

  // Keep callback reference updated
  useEffect(() => {
    callbackRef.current = onStatusUpdate;
  }, [onStatusUpdate]);

  useEffect(() => {
    const isActiveStatus = (s: string) => {
      return ['CLONING', 'FILTERING', 'ANALYZING', 'GENERATING'].includes(s.toUpperCase());
    };

    if (!analysisId || !status || !isActiveStatus(status)) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const run = await fetchAnalysisStatus(analysisId);
        errorCountRef.current = 0; // reset error count
        
        callbackRef.current(run);

        if (!isActiveStatus(run.status)) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch (err) {
        errorCountRef.current++;
        console.error(`Polling error for analysis ${analysisId}:`, err);
        
        if (errorCountRef.current >= 4) {
          console.warn(`Stopping poll for analysis ${analysisId} due to consecutive errors.`);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      }
    };

    // Trigger initial poll
    poll();

    // Set interval loop
    timerRef.current = setInterval(poll, pollingInterval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [analysisId, status, pollingInterval]);
}
