-- Add custom_allowances column to workers table
ALTER TABLE workers ADD COLUMN IF NOT EXISTS custom_allowances JSONB DEFAULT '[]'::jsonb;
