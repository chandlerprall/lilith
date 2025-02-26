import { Signal } from "@venajs/core";
import project, { Session } from "../project.mjs";
import { getId } from "./id.mjs";

const { spawn, execSync } = require("child_process");

const sessionTerminalProcesses = new WeakMap();
const allOpenTerminalProcesses = new Set();

const getSessionTerminalProcesses = (session: Session) => {
	if (!sessionTerminalProcesses.has(session)) {
		sessionTerminalProcesses.set(session, {});
	}
	return sessionTerminalProcesses.get(session);
};

export const startTerminal = async (session: Session) => {
	const terminalProcesses = getSessionTerminalProcesses(session);
	const existingIds = new Set(Object.keys(terminalProcesses));
	const id = getId(existingIds);

	const output = new Signal("");
	output.on((value) => {
		if (value.length > 1000) {
			output.value = value.substring(value.length - 1000);
		}
	});

	const process = spawn("sh", { cwd: project.directory, detached: true });
	allOpenTerminalProcesses.add(process);
	process.unref();

	process.on("close", () => {
		// this is called when the terminal is closed
		// which also happens when we call closeTerminal
		// so only call closeTerminal if the terminal is still in the list
		if (terminalProcesses[id]) closeTerminal(session, id);
	});

	process.stdout.on("data", (data: string) => {
		output.value += data;
	});
	process.stderr.on("data", (data: string) => {
		output.value += data;
	});

	terminalProcesses[id] = { process, output };

	return `Terminal ${id} started`;
};

export const executeCommand = async (session: Session, id: string, command: string) => {
	const terminalProcesses = getSessionTerminalProcesses(session);
	const terminalWindow = terminalProcesses[id];
	if (!terminalWindow) {
		throw new Error(`Terminal ${id} not found`);
	}

	const { process, output } = terminalWindow;

	output.value += `\n$ ${command}\n`;
	process.stdin.write(command + "\n");

	let stdout = "";
	let stderr = "";

	const outCollector = (data: string) => {
		stdout += data;
	};
	const errCollector = (data: string) => {
		stderr += data;
	};

	process.stdout.on("data", outCollector);
	process.stderr.on("data", errCollector);

	// wait before collecting data
	await new Promise((resolve) => setTimeout(resolve, 5_000));

	process.stdout.off("data", outCollector);
	process.stderr.off("data", errCollector);

	return `
  <stdout><![CDATA[
${stdout}
  ]]></stdout>
  <stderr><![CDATA[
${stderr}
  ]]></stderr>
  `.trim();
};

export const readTerminal = (session: Session, id: string, lineCount?: number) => {
	const terminalProcesses = getSessionTerminalProcesses(session);
	const terminalWindow = terminalProcesses[id];
	if (!terminalWindow) {
		throw new Error(`Terminal ${id} not found`);
	}
	const { output } = terminalWindow;
	return lineCount ? output.value.split("\n").slice(-lineCount).join("\n") : output.value;
};

export const closeTerminal = (session: Session, id: string) => {
	const terminalProcesses = getSessionTerminalProcesses(session);
	const terminalWindow = terminalProcesses[id];
	if (!terminalWindow) {
		throw new Error(`Terminal ${id} not found`);
	}
	const { process, output } = terminalWindow;
	output.value = "";

	killTerminalProcess(process);

	delete terminalProcesses[id];
	allOpenTerminalProcesses.delete(process);
};

function killTerminalProcess(process: any) {
	// use pkill to kill any of its children
	try {
		// the command fails if the process has no children
		execSync(`pkill -P ${process.pid}`);
	} catch (e) {}

	// kill the process
	process.kill();
}

const closeTerminals = () => {
	// close all terminals
	allOpenTerminalProcesses.forEach((process: any) => {
		killTerminalProcess(process.pid);
	});
};

window.addEventListener("beforeunload", closeTerminals);
