import { chromium } from 'playwright';

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', err => console.log('Runtime error: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('Console error: ' + msg.text());
  });

  console.log('Navigating to login...');
  await page.goto('http://localhost:8080/login');
  await page.waitForTimeout(1000);

  // Fill personnel login form
  console.log('Filling form...');
  await page.fill('input#username', '22222222222'); // we need a valid tc no or whatever is in their DB
  await page.fill('input#password', 'personel');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000); // Give it time to attempt login and redirect
  console.log('Current URL: ', page.url());
  console.log(await page.content());
  console.log('Done.');
  await browser.close();
})();
