const { chromium } = require('playwright');
const express = require('express');
const app = express();
app.use(express.static('dist'));
const server = app.listen(4000, async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));
    await page.goto('http://localhost:4000');
    await page.waitForTimeout(3000);
    const body = await page.innerHTML('body');
    console.log('BODY LENGTH:', body.length);
    await browser.close();
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
  }
});
