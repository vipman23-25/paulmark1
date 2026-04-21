const url = 'https://kiqptcpukecbeegkpnui.supabase.co/rest/v1/cargo_companies?name=eq.TEST_COMPANY_FETCH';
const key = 'sb_publishable_1b1-asFYQjDBlHmtXXufHA_DPkyqv8i'; 

fetch(url, {
  method: 'DELETE',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
})
.then(res => res.text() || res.status)
.then(console.log)
.catch(console.error);
