import { useCallback, useRef } from 'react';

export type AuditEventType = 
  | 'ANALYSIS_TRIGGERED'
  | 'ANALYSIS_SELECTED'
  | 'RUN_COMPARED'
  | 'TAB_CHANGED'
  | 'PROJECT_CREATED'
  | 'PROJECT_SELECTED'
  | 'EXPORT_TRIGGERED'
  | 'SEARCH_PERFORMED'
  | 'DRAWER_OPENED'
  | 'DRAWER_CLOSED';

interface AuditEvent {
  type: AuditEventType;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Lightweight audit logger for tracing user interactions.
 * Events are stored in-memory and can be flushed to console or external service.
 * This is a Release v1.0.0 placeholder — future versions will integrate with telemetry.
 */
export function useAuditLogger() {
  const eventsRef = useRef<AuditEvent[]>([]);

  const logEvent = useCallback((type: AuditEventType, metadata?: Record<string, any>) => {
    const event: AuditEvent = {
      type,
      timestamp: new Date().toISOString(),
      metadata
    };
    eventsRef.current.push(event);

    // Dev-mode console tracing
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[TestLens Audit] ${type}`, metadata || '');
    }
  }, []);

  const getEvents = useCallback((): ReadonlyArray<AuditEvent> => {
    return eventsRef.current;
  }, []);

  const flushEvents = useCallback((): AuditEvent[] => {
    const flushed = [...eventsRef.current];
    eventsRef.current = [];
    return flushed;
  }, []);

  return { logEvent, getEvents, flushEvents };
}
