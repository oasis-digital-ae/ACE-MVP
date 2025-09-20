import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './env';

// Initialize Supabase client using validated environment variables
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase };