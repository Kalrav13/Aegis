import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualizedListOptions<T> {
  /** Full array of items */
  items: T[];
  /** Height in pixels of each row */
  itemHeight: number;
  /** Height in pixels of the scrollable container */
  containerHeight: number;
  /** Number of extra rows to render above/below the visible area */
  overscan?: number;
}

interface VirtualizedListResult<T> {
  /** Items currently visible (plus overscan buffer) */
  visibleItems: { item: T; index: number; style: React.CSSProperties }[];
  /** Total height of the virtual content area */
  totalHeight: number;
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Handler to attach to the container's onScroll */
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  /** Current scroll position */
  scrollTop: number;
}

export function useVirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: VirtualizedListOptions<T>): VirtualizedListResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  }, []);

  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const result: { item: T; index: number; style: React.CSSProperties }[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute' as const,
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        }
      });
    }

    return result;
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  return {
    visibleItems,
    totalHeight,
    containerRef,
    onScroll,
    scrollTop
  };
}
