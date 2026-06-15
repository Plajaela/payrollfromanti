-- Add unique constraint to daily_entries to prevent duplicate entries for the same worker on the same date
ALTER TABLE public.daily_entries 
ADD CONSTRAINT daily_entries_worker_id_date_key UNIQUE (worker_id, date);
