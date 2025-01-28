const puppeteer = require('puppeteer');

let browser;
let page;

export const doPuppeteer = async ({ code }) => {
  if (!browser) {
    browser = await puppeteer.launch({ headless: false });
    page = await browser.newPage();
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