import { useState, useEffect } from 'react';
import { Worker, DailyEntry } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY_WORKERS = 'wage_app_workers';
const STORAGE_KEY_ENTRIES = 'wage_app_entries';

export function useStore() {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WORKERS);
    return saved ? JSON.parse(saved) : [];
  });

  const [entries, setEntries] = useState<DailyEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ENTRIES);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
  }, [entries]);

  const addWorker = (worker: Omit<Worker, 'id'>) => {
    setWorkers((prev) => [...prev, { ...worker, id: uuidv4() }]);
  };

  const updateWorker = (id: string, updated: Partial<Worker>) => {
    setWorkers((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updated } : w))
    );
  };

  const deleteWorker = (id: string) => {
    setWorkers((prev) => prev.filter((w) => w.id !== id));
    // Optionally delete associated entries, but maybe better to keep them for history
  };

  const addEntry = (entry: Omit<DailyEntry, 'id'>) => {
    setEntries((prev) => [...prev, { ...entry, id: uuidv4() }]);
  };

  const updateEntry = (id: string, updated: Partial<DailyEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e))
    );
  };

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return {
    workers,
    addWorker,
    updateWorker,
    deleteWorker,
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}
