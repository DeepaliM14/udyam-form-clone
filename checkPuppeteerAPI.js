const puppeteer = require('puppeteer');

(async () => {
  console.log('Using puppeteer from:', require.resolve('puppeteer'));

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log('Type of page.waitForTimeout:', typeof page.waitForTimeout);

  await browser.close();
})();
