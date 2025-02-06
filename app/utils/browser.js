import { getId } from './id.js';

const puppeteer = require('puppeteer');

let browser;

export const browserSessions = {};

export const startPageSession = async () => {
  await ensureBrowser();

  const existingIds = new Set(Object.keys(browserSessions));
  const id = getId(existingIds);

  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 800 });
  browserSessions[id] = page;

  return `Browser session ${id} started`;
}

export const closePageSession = async (id) => {
  const page = browserSessions[id];
  if (!page) {
    throw new Error(`Browser session ${id} not found`);
  }

  await page.close();
  delete browserSessions[id];

  if (!Object.keys(browserSessions).length) {
    await browser.close();
    browser = undefined;
  }

  return `Browser session ${id} closed`;
}

export const navigateTo = async (id, url) => {
  const page = browserSessions[id];
  if (!page) {
    throw new Error(`Browser session ${id} not found`);
  }
  await page.goto(url);
  return `Navigated to ${url}`;
}

export const executeInPage = async (id, waitMsAfter = 0, code) => {
  const page = browserSessions[id];
  if (!page) {
    throw new Error(`Browser session ${id} not found`);
  }
  const formattedCode = `
const ____console_log = console.log;
const ____console_error = console.error;

let consoleLog = [];
let consoleError = [];
console.log = (msg) => {
  consoleLog.push(msg);
  ____console_log(msg);
};
console.error = (msg) => {
  consoleError.push(msg);
  ____console_error(msg);
};

function cleanup() {
  console.log = ____console_log;
  console.error = ____console_error;
}

const returnValue = (async () => {
  ${code}
})();

const wait = new Promise(resolve => setTimeout(resolve, ${waitMsAfter}));

return Promise.all([returnValue, wait])
  .then(([returnValue]) => { return { returnValue, consoleLog, consoleError }; })
  .finally(result => { cleanup(); return result; });
`;
  const formattedFn = new Function(formattedCode);
  return JSON.stringify(await page.evaluate(formattedFn), null, 2);
}

async function ensureBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      ignoreHTTPErrors: true,
      slowMo: 250, // appears required for the --ignore-certificate-errors to take effect
      args: [
        '--ignore-certificate-errors',
      ],
    });
  }
}

window.browserSessions = browserSessions;
window.startPageSession = startPageSession;
window.closePageSession = closePageSession;
window.navigateTo = navigateTo;
window.executeInPage = executeInPage;
