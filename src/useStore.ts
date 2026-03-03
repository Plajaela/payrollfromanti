import { useState, useEffect } from 'react';
import { Worker, DailyEntry } from './types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './lib/supabase';

const STORAGE_KEY_WORKERS = 'wage_app_workers';
const STORAGE_KEY_ENTRIES = 'wage_app_entries';

export function useStore() {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WORKERS);
    return saved ? JSON.parse(saved) : [];
  });
  const [isWorkersLoading, setIsWorkersLoading] = useState(true);

  const [entries, setEntries] = useState<DailyEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ENTRIES);
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch workers from Supabase on mount and subscribe to changes
  useEffect(() => {
    const fetchWorkers = async () => {
      setIsWorkersLoading(true);
      try {
        const { data, error } = await supabase
          .from('workers')
          .select('*')
          .order('name');

        if (error) {
          console.error('Error fetching workers from Supabase:', error);
          return;
        }

        if (data) {
          // Check for migration from local storage
          if (data.length === 0) {
            const saved = localStorage.getItem(STORAGE_KEY_WORKERS);
            const localWorkers: Worker[] = saved ? JSON.parse(saved) : [];

            if (localWorkers.length > 0) {
              // We have local data but no Supabase data, let's migrate it!
              const { error: insertError } = await supabase.from('workers').insert(
                localWorkers.map(w => ({
                  id: w.id,
                  name: w.name,
                  base_wage: w.baseWage,
                  default_travel_allowance: w.defaultTravelAllowance || 0,
                  shift_start: w.shiftStart || '07:00',
                  shift_end: w.shiftEnd || '16:00',
                  payment_type: w.paymentType || 'month'
                }))
              );

              if (!insertError) {
                setWorkers(localWorkers);
                return;
              } else {
                console.error('Migration failed:', insertError);
              }
            }
          }

          // Map snake_case to camelCase
          const formattedWorkers: Worker[] = data.map(w => ({
            id: w.id,
            name: w.name,
            baseWage: Number(w.base_wage),
            defaultTravelAllowance: Number(w.default_travel_allowance),
            shiftStart: w.shift_start,
            shiftEnd: w.shift_end,
            paymentType: w.payment_type
          }));
          setWorkers(formattedWorkers);
        }
      } catch (err) {
        console.error('Failed to fetch workers:', err);
      } finally {
        setIsWorkersLoading(false);
      }
    };

    fetchWorkers();

    const subscription = supabase
      .channel('workers_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers' },
        () => {
          fetchWorkers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
  }, [entries]);

  const addWorker = async (worker: Omit<Worker, 'id'>) => {
    // Generate ID for optimistic UI update
    const newId = uuidv4();
    const newWorker = { ...worker, id: newId };

    // Optimistic update
    setWorkers((prev) => [...prev, newWorker]);

    // Persist to Supabase
    try {
      const { error } = await supabase.from('workers').insert([{
        id: newId,
        name: worker.name,
        base_wage: worker.baseWage,
        default_travel_allowance: worker.defaultTravelAllowance || 0,
        shift_start: worker.shiftStart || '07:00',
        shift_end: worker.shiftEnd || '16:00',
        payment_type: worker.paymentType || 'month'
      }]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to add worker to Supabase:', err);
      // Revert on error could be implemented here
    }
  };

  const updateWorker = async (id: string, updated: Partial<Worker>) => {
    // Optimistic update
    setWorkers((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updated } : w))
    );

    // Persist to Supabase
    try {
      const updateData: any = {};
      if (updated.name !== undefined) updateData.name = updated.name;
      if (updated.baseWage !== undefined) updateData.base_wage = updated.baseWage;
      if (updated.defaultTravelAllowance !== undefined) updateData.default_travel_allowance = updated.defaultTravelAllowance;
      if (updated.shiftStart !== undefined) updateData.shift_start = updated.shiftStart;
      if (updated.shiftEnd !== undefined) updateData.shift_end = updated.shiftEnd;
      if (updated.paymentType !== undefined) updateData.payment_type = updated.paymentType;

      const { error } = await supabase
        .from('workers')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update worker in Supabase:', err);
    }
  };

  const deleteWorker = async (id: string) => {
    // Optimistic update
    setWorkers((prev) => prev.filter((w) => w.id !== id));

    // Persist to Supabase
    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete worker from Supabase:', err);
    }
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
    isWorkersLoading,
    addWorker,
    updateWorker,
    deleteWorker,
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}
