import { useState, useEffect } from 'react';
import { Worker, DailyEntry, AdvancePayment } from './types';
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
  const [isEntriesLoading, setIsEntriesLoading] = useState(true);

  const [entries, setEntries] = useState<DailyEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ENTRIES);
    return saved ? JSON.parse(saved) : [];
  });

  const [advances, setAdvances] = useState<AdvancePayment[]>([]);

  // Fetch workers from Supabase on mount and subscribe to changes
  useEffect(() => {
    const fetchWorkers = async () => {
      setIsWorkersLoading(true);
      try {
        let allWorkers: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('workers')
            .select('*')
            .order('name')
            .range(from, from + step - 1);

          if (error) {
            console.error('Error fetching workers from Supabase:', error);
            return;
          }

          if (data && data.length > 0) {
            allWorkers = [...allWorkers, ...data];
            from += step;
            if (data.length < step) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        const data = allWorkers;

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
                  payment_type: w.paymentType || 'month',
                  has_guarantee: w.hasGuarantee || false
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
            paymentType: w.payment_type,
            hasGuarantee: w.has_guarantee || false
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

  // Fetch entries from Supabase
  useEffect(() => {
    const fetchEntries = async () => {
      setIsEntriesLoading(true);
      try {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('daily_entries')
            .select('*')
            .order('date', { ascending: false })
            .range(from, from + step - 1);

          if (error) {
            console.error('Error fetching entries from Supabase:', error);
            return;
          }

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += step;
            if (data.length < step) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        const data = allData;

        if (data) {
          // Check for migration from local storage
          if (data.length === 0) {
            const saved = localStorage.getItem(STORAGE_KEY_ENTRIES);
            const localEntries: DailyEntry[] = saved ? JSON.parse(saved) : [];

            if (localEntries.length > 0) {
              const { error: insertError } = await supabase.from('daily_entries').insert(
                localEntries.map(e => ({
                  id: e.id,
                  worker_id: e.workerId,
                  date: e.date,
                  clock_in: e.clockIn,
                  clock_out: e.clockOut,
                  base_wage: e.baseWage,
                  travel_allowance: e.travelAllowance,
                  toll_fee: e.tollFee,
                  late_deduction: e.lateDeduction,
                  overtime_hours: e.overtimeHours,
                  overtime_minutes: e.overtimeMinutes,
                  overtime_pay: e.overtimePay,
                  adjustments: e.adjustments || [],
                  total_pay: e.totalPay,
                  note: e.note,
                  is_draft: e.isDraft || false,
                  is_leave: e.isLeave || false,
                  transfer_slip_url: e.transferSlipUrl,
                  toll_receipt_url: e.tollReceiptUrl,
                  guarantee_deduction: e.guaranteeDeduction || 0
                }))
              );

              if (!insertError) {
                setEntries(localEntries);
                return;
              } else {
                console.error('Entry Migration failed:', insertError);
              }
            }
          }

          // Map snake_case to camelCase
          const formattedEntries: DailyEntry[] = data.map(e => ({
            id: e.id,
            workerId: e.worker_id,
            date: e.date,
            clockIn: e.clock_in,
            clockOut: e.clock_out,
            baseWage: Number(e.base_wage),
            travelAllowance: Number(e.travel_allowance),
            tollFee: Number(e.toll_fee),
            lateDeduction: Number(e.late_deduction),
            overtimeHours: Number(e.overtime_hours),
            overtimeMinutes: Number(e.overtime_minutes),
            overtimePay: Number(e.overtime_pay),
            adjustments: e.adjustments,
            totalPay: Number(e.total_pay),
            note: e.note,
            isDraft: e.is_draft,
            isLeave: e.is_leave,
            transferSlipUrl: e.transfer_slip_url,
            tollReceiptUrl: e.toll_receipt_url,
            guaranteeDeduction: Number(e.guarantee_deduction) || 0
          }));
          setEntries(formattedEntries);
        }
      } catch (err) {
        console.error('Failed to fetch entries:', err);
      } finally {
        setIsEntriesLoading(false);
      }
    };

    fetchEntries();

    const subscription = supabase
      .channel('entries_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_entries' },
        () => {
          fetchEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Fetch advances from Supabase
  useEffect(() => {
    const fetchAdvances = async () => {
      try {
        const { data, error } = await supabase
          .from('advance_payments')
          .select('*')
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching advances:', error);
          return;
        }

        if (data) {
          const formattedAdvances: AdvancePayment[] = data.map(a => ({
            id: a.id,
            workerId: a.worker_id,
            date: a.date,
            amount: Number(a.amount),
            type: a.type,
            note: a.note || ''
          }));
          setAdvances(formattedAdvances);
        }
      } catch (err) {
        console.error('Failed to fetch advances:', err);
      }
    };

    fetchAdvances();

    const subscription = supabase
      .channel('advances_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'advance_payments' },
        () => {
          fetchAdvances();
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
        payment_type: worker.paymentType || 'month',
        has_guarantee: worker.hasGuarantee || false
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
      if (updated.hasGuarantee !== undefined) updateData.has_guarantee = updated.hasGuarantee;

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

  const addEntry = async (entry: Omit<DailyEntry, 'id'>) => {
    const newId = uuidv4();
    const newEntry = { ...entry, id: newId };
    setEntries((prev) => [...prev, newEntry]);

    try {
      const { error } = await supabase.from('daily_entries').insert([{
        id: newId,
        worker_id: entry.workerId,
        date: entry.date,
        clock_in: entry.clockIn,
        clock_out: entry.clockOut,
        base_wage: entry.baseWage,
        travel_allowance: entry.travelAllowance,
        toll_fee: entry.tollFee,
        late_deduction: entry.lateDeduction,
        overtime_hours: entry.overtimeHours,
        overtime_minutes: entry.overtimeMinutes,
        overtime_pay: entry.overtimePay,
        adjustments: entry.adjustments || [],
        total_pay: entry.totalPay,
        note: entry.note,
        is_draft: entry.isDraft || false,
        is_leave: entry.isLeave || false,
        transfer_slip_url: entry.transferSlipUrl,
        toll_receipt_url: entry.tollReceiptUrl,
        guarantee_deduction: entry.guaranteeDeduction || 0
      }]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to add entry to Supabase:', err);
    }
  };

  const updateEntry = async (id: string, updated: Partial<DailyEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e))
    );

    try {
      const updateData: any = {};
      if (updated.workerId !== undefined) updateData.worker_id = updated.workerId;
      if (updated.date !== undefined) updateData.date = updated.date;
      if (updated.clockIn !== undefined) updateData.clock_in = updated.clockIn;
      if (updated.clockOut !== undefined) updateData.clock_out = updated.clockOut;
      if (updated.baseWage !== undefined) updateData.base_wage = updated.baseWage;
      if (updated.travelAllowance !== undefined) updateData.travel_allowance = updated.travelAllowance;
      if (updated.tollFee !== undefined) updateData.toll_fee = updated.tollFee;
      if (updated.lateDeduction !== undefined) updateData.late_deduction = updated.lateDeduction;
      if (updated.overtimeHours !== undefined) updateData.overtime_hours = updated.overtimeHours;
      if (updated.overtimeMinutes !== undefined) updateData.overtime_minutes = updated.overtimeMinutes;
      if (updated.overtimePay !== undefined) updateData.overtime_pay = updated.overtimePay;
      if (updated.adjustments !== undefined) updateData.adjustments = updated.adjustments;
      if (updated.totalPay !== undefined) updateData.total_pay = updated.totalPay;
      if (updated.note !== undefined) updateData.note = updated.note;
      if (updated.isDraft !== undefined) updateData.is_draft = updated.isDraft;
      if (updated.isLeave !== undefined) updateData.is_leave = updated.isLeave;
      if (updated.transferSlipUrl !== undefined) updateData.transfer_slip_url = updated.transferSlipUrl;
      if (updated.tollReceiptUrl !== undefined) updateData.toll_receipt_url = updated.tollReceiptUrl;
      if (updated.guaranteeDeduction !== undefined) updateData.guarantee_deduction = updated.guaranteeDeduction;

      const { error } = await supabase
        .from('daily_entries')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update entry in Supabase:', err);
    }
  };

  const deleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));

    try {
      const { error } = await supabase
        .from('daily_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete entry from Supabase:', err);
    }
  };

  const addAdvance = async (advance: Omit<AdvancePayment, 'id'>) => {
    const newId = uuidv4();
    const newAdvance = { ...advance, id: newId };
    setAdvances((prev) => [...prev, newAdvance]);

    try {
      const { error } = await supabase.from('advance_payments').insert([{
        id: newId,
        worker_id: advance.workerId,
        date: advance.date,
        amount: advance.amount,
        type: advance.type,
        note: advance.note
      }]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to add advance to Supabase:', err);
    }
  };

  const deleteAdvance = async (id: string) => {
    setAdvances((prev) => prev.filter((a) => a.id !== id));

    try {
      const { error } = await supabase
        .from('advance_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete advance from Supabase:', err);
    }
  };

  return {
    workers,
    isWorkersLoading,
    isEntriesLoading,
    addWorker,
    updateWorker,
    deleteWorker,
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    advances,
    addAdvance,
    deleteAdvance,
  };
}
