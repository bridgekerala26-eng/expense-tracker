import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zpbsmlwzgkictcpzzewr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_i1lWCKOJjWMDcCQU75qSpQ_h3jiprFS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
