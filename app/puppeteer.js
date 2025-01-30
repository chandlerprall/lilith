const puppeteer = require('puppeteer');

let browser;
let page;

export const doPuppeteer = async ({ code }) => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      ignoreHTTPErrors: true,
      slowMo: 250,
      args: [
        '--ignore-certificate-errors',
      ],
    });
    page = await browser.newPage();
    page.setViewport({ width: 1280, height: 800 });
  }
  return eval(`(async () => { ${code} })()`);
}

export const closePuppeteer = async () => {
  if (browser) {
    await browser.close();

    browser = undefined;
    page = undefined;
  }
}