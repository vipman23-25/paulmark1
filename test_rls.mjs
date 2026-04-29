import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envStr.split('\n')) {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) envVars[key.trim()] = vals.join('=').trim().replace(/"/g, '');
}

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRLS() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: 'SELECT relname, relrowsecurity FROM pg_class WHERE relname = \'personnel\';' });
  console.log(data, error);
}

testRLS();
