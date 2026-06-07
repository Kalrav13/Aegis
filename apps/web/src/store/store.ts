import { create } from 'zustand';

interface UIState {
  selectedProjectId: string | null;
  selectedRunId: string | null;
  activeTab: string;
  compareAId: string;
  compareBId: string;
  searchQuery: string;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedRunId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  setCompareAId: (id: string) => void;
  setCompareBId: (id: string) => void;
  setSearchQuery: (query: string) => void;
  resetComparison: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedProjectId: null,
  selectedRunId: null,
  activeTab: 'dashboard',
  compareAId: '',
  compareBId: '',
  searchQuery: '',
  setSelectedProjectId: (id) => set({ selectedProjectId: id, selectedRunId: null, compareAId: '', compareBId: '' }),
  setSelectedRunId: (id) => set({ selectedRunId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setCompareAId: (id) => set({ compareAId: id }),
  setCompareBId: (id) => set({ compareBId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  resetComparison: () => set({ compareAId: '', compareBId: '' })
}));
