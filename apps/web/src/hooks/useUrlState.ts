import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useUIStore } from '../store/store';

export function useUrlState() {
  const router = useRouter();
  const isReady = router.isReady;

  const {
    selectedProjectId,
    selectedRunId,
    activeTab,
    compareAId,
    compareBId,
    setSelectedProjectId,
    setSelectedRunId,
    setActiveTab,
    setCompareAId,
    setCompareBId
  } = useUIStore();

  const initialSyncRef = useRef(false);

  // 1. Sync URL query strings -> Zustand on mount
  useEffect(() => {
    if (!isReady || initialSyncRef.current) return;

    const { project, run, tab, compare } = router.query;

    if (project && typeof project === 'string') {
      setSelectedProjectId(project);
    }
    if (run && typeof run === 'string') {
      setSelectedRunId(run);
    }
    if (tab && typeof tab === 'string') {
      setActiveTab(tab);
    }
    if (compare && typeof compare === 'string') {
      const parts = compare.split(',');
      if (parts[0]) setCompareAId(parts[0]);
      if (parts[1]) setCompareBId(parts[1]);
    }

    initialSyncRef.current = true;
  }, [isReady, router.query, setSelectedProjectId, setSelectedRunId, setActiveTab, setCompareAId, setCompareBId]);

  // 2. Sync Zustand -> URL query strings on state changes
  useEffect(() => {
    if (!isReady || !initialSyncRef.current) return;

    const query: Record<string, string> = {};

    if (selectedProjectId) query.project = selectedProjectId;
    if (selectedRunId) query.run = selectedRunId;
    if (activeTab) query.tab = activeTab;

    const compareParts: string[] = [];
    if (compareAId) compareParts.push(compareAId);
    if (compareBId) compareParts.push(compareBId);
    if (compareParts.length > 0) {
      query.compare = compareParts.join(',');
    }

    // Push state updates without adding excessive history items (using shallow replace)
    router.replace(
      {
        pathname: router.pathname,
        query
      },
      undefined,
      { shallow: true }
    );
  }, [isReady, selectedProjectId, selectedRunId, activeTab, compareAId, compareBId]);
}
