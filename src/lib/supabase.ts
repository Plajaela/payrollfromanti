import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ejqrwoocntbjttlxrama.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXJ3b29jbnRianR0bHhyYW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTQ4MTAsImV4cCI6MjA4ODA5MDgxMH0.O-EaDGCsDigzqdQ7vJ8whGwoJtboAxKL_rZ2Eu1Grtc';

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
)
