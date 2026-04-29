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

async function testQuery() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'turgaydolu23@gmail.com',
    password: 'turgay23keban'
  });
  
  if (authError) {
    console.error("Login failed:", authError);
    return;
  }
  console.log("Logged in as Admin.");

  const { data, error } = await supabase
    .from('personnel')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error fetching personnel:", error);
  } else {
    console.log("Success! Fetched", data.length, "personnel records.");
  }
}

testQuery();
