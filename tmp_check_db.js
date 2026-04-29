import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('shift_schedules').select('*').limit(1);
  console.log("shift_schedules:", error ? error.message : "EXISTS");
  const { data: d2, error: e2 } = await supabase.from('weekly_day_off').select('*').limit(1);
  console.log("weekly_day_off:", e2 ? e2.message : "EXISTS", d2);
}
check();
