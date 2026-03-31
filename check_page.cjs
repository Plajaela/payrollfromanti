const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  const body = await page.innerHTML('body');
  console.log('BODY LENGTH:', body.length);
  const root = await page.innerHTML('#root');
  console.log('ROOT EXCERPT:', root.substring(0, 300));
  await browser.close();
})();
