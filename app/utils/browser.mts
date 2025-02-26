import { Session } from "../project.mjs";
import { getId } from "./id.mjs";
import type { Browser } from "puppeteer";

const puppeteer = require("puppeteer");
const TurndownService = require("turndown");

let browser: Browser | undefined;

const sessionBrowsers = new WeakMap();

const getSessionBrowsers = (session: Session) => {
	if (!sessionBrowsers.has(session)) {
		sessionBrowsers.set(session, {});
	}
	return sessionBrowsers.get(session);
};

export const startPageSession = async (session: Session) => {
	const browserSessions = getSessionBrowsers(session);

	await ensureBrowser();

	const existingIds = new Set(Object.keys(browserSessions));
	const id = getId(existingIds);

	const page = await browser!.newPage();
	page.setViewport({ width: 1280, height: 800 });
	browserSessions[id] = page;

	return `Browser session ${id} started`;
};

export const closePageSession = async (session: Session, id: string) => {
	const browserSessions = getSessionBrowsers(session);
	const page = browserSessions[id];
	if (!page) {
		throw new Error(`Browser session ${id} not found`);
	}

	await page.close();
	delete browserSessions[id];

	if (!Object.keys(browserSessions).length) {
		await browser!.close();
		browser = undefined;
	}

	return `Browser session ${id} closed`;
};

export const navigateTo = async (session: Session, id: string, url: string) => {
	const browserSessions = getSessionBrowsers(session);
	const page = browserSessions[id];
	if (!page) {
		throw new Error(`Browser session ${id} not found`);
	}
	await page.goto(url);
	return `Navigated to ${url}`;
};

export const readBrowserPage = async (session: Session, id: string, format = "markdown") => {
	const browserSessions = getSessionBrowsers(session);
	const page = browserSessions[id];
	if (!page) {
		throw new Error(`Browser session ${id} not found`);
	}
	if (format === "html") {
		return await page.content();
	} else if (format === "text") {
		return await page.evaluate(() => document.body.textContent);
	} else if (format === "markdown") {
		const turndownService = new TurndownService();
		const html = await page.evaluate(() => {
			// starting with the body element, clone the current node and all of its (visible!) children
			function doClone(node: HTMLElement) {
				const clone = node.cloneNode();
				for (const child of node.childNodes) {
					if (child.nodeType === Node.TEXT_NODE) {
						clone.appendChild(child.cloneNode());
						// @ts-expect-error
					} else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "SCRIPT" && child.tagName !== "STYLE") {
						// @ts-expect-error
						if (child.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) {
							// @ts-expect-error
							clone.appendChild(doClone(child));
						}
					}
				}
				return clone;
			}

			const filteredBody = doClone(document.body) as HTMLBodyElement;
			return filteredBody.outerHTML;
		});
		return turndownService.turndown(html);
	} else {
		throw new Error(`Unknown format ${format}`);
	}
};

export const executeInPage = async (session: Session, id: string, waitMsAfter = 0, code: string) => {
	const browserSessions = getSessionBrowsers(session);
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
};

async function ensureBrowser() {
	if (!browser) {
		browser = await puppeteer.launch({
			headless: false,
			ignoreHTTPSErrors: true,
			ignoreHTTPErrors: true,
			slowMo: 250, // appears required for the --ignore-certificate-errors to take effect
			args: ["--ignore-certificate-errors"],
		});
	}
}
