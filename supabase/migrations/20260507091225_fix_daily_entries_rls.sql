-- Enable RLS for daily_entries table and create policy
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for all users" 
ON public.daily_entries 
FOR ALL 
USING (true) 
WITH CHECK (true);
