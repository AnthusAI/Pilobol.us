const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });
  
  // check if canvas is there
  const canvas = await page.$('#pilo-physarum-bg');
  console.log("Canvas found:", !!canvas);
  
  await browser.close();
})();
