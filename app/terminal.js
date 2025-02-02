import { Signal } from '@venajs/core';
import project from './project.js';
import { getId } from './utils/id.js';

const { spawn, execSync } = require('child_process');

export const terminalProcesses = {};

export const startTerminal = async () => {
  const existingIds = new Set(Object.keys(terminalProcesses));
  const id = getId(existingIds);

  const output = new Signal('');
  output.on(value => {
    if (value.length > 1000) {
      output.value = value.substring(value.length - 1000);
    }
  })

  const process = spawn('sh', { cwd: project.directory, detached: true })
  process.unref();

  process.on('close', () => {
    // this is called when the terminal is closed
    // which also happens when we call closeTerminal
    // so only call closeTerminal if the terminal is still in the list
    if (terminalProcesses[id]) closeTerminal(id);
  })

  process.stdout.on('data', data => {
    output.value += data;
  });
  process.stderr.on('data', data => {
    output.value += data;
  });

  terminalProcesses[id] = { process, output };

  return `Terminal ${id} started`;
}

export const executeCommand = async (id, command) => {
  const terminalWindow = terminalProcesses[id];
  if (!terminalWindow) {
    throw new Error(`Terminal ${id} not found`);
  }

  const { process, output } = terminalWindow;

  output.value += `\n$ ${command}\n`;
  process.stdin.write(command + '\n');

  let stdout = '';
  let stderr = '';

  const outCollector = data => {
    stdout += data;
  };
  const errCollector = data => {
    stderr += data;
  };

  process.stdout.on('data', outCollector);
  process.stderr.on('data', errCollector);

  // wait before collecting data
  await new Promise(resolve => setTimeout(resolve, 5_000));

  process.stdout.off('data', outCollector);
  process.stderr.off('data', errCollector);

  return `stdout\n-----\n${stdout}\nstderr\n-----\n${stderr}`;
}

export const closeTerminal = (id) => {
  const terminalWindow = terminalProcesses[id];
  if (!terminalWindow) {
    throw new Error(`Terminal ${id} not found`);
  }
  const { process, output } = terminalWindow;
  output.value = '';

  // use pkill to kill any of its children
  try {
    // the command fails if the process has no children
    execSync(`pkill -P ${process.pid}`);
  } catch (e) { }

  // kill the process
  process.kill();

  delete terminalProcesses[id];
}

export const closeTerminals = () => {
  Object.keys(terminalProcesses).forEach(id => closeTerminal(id));
}

window.startTerminal = startTerminal;
window.executeCommand = executeCommand;
window.closeTerminal = closeTerminal;
window.terminalProcesses = terminalProcesses;

window.addEventListener('beforeunload', closeTerminals);