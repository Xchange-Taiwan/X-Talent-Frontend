'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { SelectFilters } from '@/components/filter/MentorFilterDropdown';

import { SESSION_KEY_FILTERS, SESSION_KEY_PATTERN } from './constants';

interface MentorPoolState {
  searchPattern: string;
  selectedFilters: SelectFilters;
  // True after sessionStorage restore has run; container uses this to gate
  // the first client-side fetch so it doesn't race with SSR-provided data.
  sessionRestored: boolean;
  // True when sessionStorage held a persisted search/filter that requires the
  // container to refetch on mount (overriding SSR-provided initial mentors).
  hasRestoredState: boolean;
  setSearch: (q: string) => void;
  setFilters: (filters: SelectFilters) => void;
  removeFilter: (key: string) => void;
}

const MentorPoolStateContext = createContext<MentorPoolState | null>(null);

export function MentorPoolStateProvider({ children }: { children: ReactNode }) {
  const [searchPattern, setSearchPattern] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<SelectFilters>({});
  const [sessionRestored, setSessionRestored] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  useEffect(() => {
    let restored = false;
    try {
      const savedPattern = sessionStorage.getItem(SESSION_KEY_PATTERN);
      const savedFilters = sessionStorage.getItem(SESSION_KEY_FILTERS);
      if (savedPattern) {
        setSearchPattern(savedPattern);
        restored = true;
      }
      if (savedFilters) {
        setSelectedFilters(JSON.parse(savedFilters));
        restored = true;
      }
    } catch {
      // sessionStorage unavailable (private browsing) — leave defaults
    } finally {
      setHasRestoredState(restored);
      setSessionRestored(true);
    }
  }, []);

  const setSearch = useCallback((q: string) => {
    setSearchPattern(q);
    try {
      sessionStorage.setItem(SESSION_KEY_PATTERN, q);
    } catch {}
  }, []);

  const setFilters = useCallback((filters: SelectFilters) => {
    setSelectedFilters(filters);
    try {
      sessionStorage.setItem(SESSION_KEY_FILTERS, JSON.stringify(filters));
    } catch {}
  }, []);

  const removeFilter = useCallback((key: string) => {
    setSelectedFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      try {
        sessionStorage.setItem(SESSION_KEY_FILTERS, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <MentorPoolStateContext.Provider
      value={{
        searchPattern,
        selectedFilters,
        sessionRestored,
        hasRestoredState,
        setSearch,
        setFilters,
        removeFilter,
      }}
    >
      {children}
    </MentorPoolStateContext.Provider>
  );
}

export function useMentorPoolState(): MentorPoolState {
  const ctx = useContext(MentorPoolStateContext);
  if (!ctx) {
    throw new Error(
      'useMentorPoolState must be used inside <MentorPoolStateProvider>'
    );
  }
  return ctx;
}
