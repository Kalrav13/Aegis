import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchAnalysisStatus } from '../utils/api';
import { AnalysisRun } from '../types';
import { useToast } from '../components/Toast';

interface AnalysisStatusContextType {
  activePollingRun: AnalysisRun | null;
  startPolling: (run: AnalysisRun) => void;
  stopPolling: () => void;
}

const AnalysisStatusContext = createContext<AnalysisStatusContextType | undefined>(undefined);

export function useAnalysisStatus() {
  const context = useContext(AnalysisStatusContext);
  if (!context) {
    throw new Error('useAnalysisStatus must be used within an AnalysisStatusProvider');
  }
  return context;
}

export function AnalysisStatusProvider({ 
  children,
  onStatusComplete
}: { 
  children: React.ReactNode;
  onStatusComplete?: (updatedRun: AnalysisRun) => void;
}) {
  const { showToast } = useToast();
  const [activePollingRun, setActivePollingRun] = useState<AnalysisRun | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef<number>(0);
  const completeCallbackRef = useRef(onStatusComplete);

  useEffect(() => {
    completeCallbackRef.current = onStatusComplete;
  }, [onStatusComplete]);

  const stopPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setActivePollingRun(null);
  };

  const startPolling = (run: AnalysisRun) => {
    stopPolling(); // clear existing first
    errorCountRef.current = 0;
    setActivePollingRun(run);
  };

  useEffect(() => {
    const isActiveStatus = (statusStr: string) => {
      return ['CLONING', 'FILTERING', 'ANALYZING', 'GENERATING'].includes(statusStr.toUpperCase());
    };

    if (!activePollingRun || !isActiveStatus(activePollingRun.status)) {
      return;
    }

    const poll = async () => {
      try {
        const run = await fetchAnalysisStatus(activePollingRun.id);
        errorCountRef.current = 0;
        
        setActivePollingRun(run);
        
        if (completeCallbackRef.current) {
          completeCallbackRef.current(run);
        }

        if (!isActiveStatus(run.status)) {
          stopPolling();
          if (run.status === 'COMPLETED') {
            showToast(`Analysis run #${run.id.substring(0, 5)} completed successfully!`, 'SUCCESS');
          } else if (run.status === 'FAILED') {
            showToast(`Analysis run #${run.id.substring(0, 5)} failed.`, 'ERROR');
          }
        }
      } catch (err) {
        errorCountRef.current++;
        console.error(`Status polling error for run ${activePollingRun.id}:`, err);
        
        if (errorCountRef.current >= 4) {
          console.warn('Halting status polling due to consecutive endpoint failures.');
          stopPolling();
          showToast('Failed to poll analysis status. Connection lost.', 'ERROR');
        }
      }
    };

    // Set interval check loop
    timerRef.current = setInterval(poll, 3000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activePollingRun, showToast]);

  return (
    <AnalysisStatusContext.Provider value={{ activePollingRun, startPolling, stopPolling }}>
      {children}
    </AnalysisStatusContext.Provider>
  );
}
