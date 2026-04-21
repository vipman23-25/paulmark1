import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr;
try {
  envStr = fs.readFileSync('.env.local', 'utf-8');
} catch (e) {
  envStr = fs.readFileSync('.env', 'utf-8');
}

const envVars = {};
for (const line of envStr.split('\n')) {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) envVars[key.trim()] = vals.join('=').trim().replace(/"/g, '');
}

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing cargo_shipments...");
  const { data: cargo, error: cargoErr } = await supabase.from('cargo_shipments').select('*').limit(1);
  console.log("Cargo Error:", cargoErr?.message || "No error");
  
  console.log("Testing logistics_records...");
  const { data: logi, error: logiErr } = await supabase.from('logistics_records').select('*').limit(1);
  console.log("Logistics Error:", logiErr?.message || "No error");
}

test();
