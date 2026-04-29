const supabaseUrl = 'https://kiqptcpukecbeegkpnui.supabase.co';
const supabaseKey = 'sb_publishable_1b1-asFYQjDBlHmtXXufHA_DPkyqv8i';

const tables = [
  'personnel', 'break_records', 'personnel_movements', 'weekly_day_off',
  'overtime_records', 'cargo_shipments', 'system_settings', 'reminders', 'user_roles',
  'reminder_responses', 'tasks', 'task_assignments', 'shift_gender_rules', 'shift_schedules', 'department_shift_rules'
];

async function checkAll() {
  // 1. Try Login
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'turgaydolu23@gmail.com', password: 'turgay23keban' })
  });
  
  const authData = await authRes.json();
  console.log("Login response:", authData);
  if (authData.error) {
    console.error("Login failed:", authData);
    return;
  }
  
  const token = authData.access_token;
  console.log("Login successful, testing tables...");

  for (const table of tables) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (data.code || data.error || data.message) {
      console.log(`Error on table ${table}:`, JSON.stringify(data));
    } else {
      console.log(`Table ${table} OK (returned array)`);
    }
  }
}

checkAll();
