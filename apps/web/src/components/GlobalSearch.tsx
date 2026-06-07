import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Command } from 'lucide-react';
import { useUIStore } from '../store/store';

interface GlobalSearchProps {
  placeholder?: string;
}

export default function GlobalSearch({ 
  placeholder = 'Search features, scenarios, test cases…' 
}: GlobalSearchProps) {
  const { searchQuery, setSearchQuery } = useUIStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query updates to Zustand
  const handleChange = useCallback((value: string) => {
    setLocalQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }, [setSearchQuery]);

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to blur
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync external store changes
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleClear = () => {
    setLocalQuery('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative flex items-center transition-all duration-300 ${
      isFocused ? 'w-80' : 'w-64'
    }`}>
      {/* Search icon */}
      <Search className={`absolute left-3 h-4 w-4 transition-colors duration-200 pointer-events-none ${
        isFocused ? 'text-indigo-400' : 'text-slate-500'
      }`} />
      
      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-20 py-2 bg-slate-900/80 border rounded-xl text-sm text-slate-300 font-medium outline-none placeholder:text-slate-600 transition-all duration-200 ${
          isFocused 
            ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20' 
            : 'border-slate-800 hover:border-slate-700'
        }`}
        aria-label="Global search"
        id="global-search-input"
      />

      {/* Right side controls */}
      <div className="absolute right-2 flex items-center space-x-1.5">
        {localQuery ? (
          <button
            onClick={handleClear}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:flex items-center space-x-0.5 px-1.5 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded-md text-[10px] text-slate-500 font-semibold select-none">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </kbd>
        )}
      </div>
    </div>
  );
}
