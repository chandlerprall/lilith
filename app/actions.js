import { closeIssue, setFileSummary, setKnowledgeBase, writeIssue } from "./project.js";
import { closePuppeteer, doPuppeteer } from "./puppeteer.js";
import { executeCommand, startTerminal, terminalProcesses } from "./terminal.js";
const { exec } = require('child_process');
const { promisify } = require('util');
const { readFileSync, writeFileSync, unlinkSync } = require('fs');
const execAsync = promisify(exec);

const actions = [
  {
    action: 'calculator',
    handler({ equation }) {
      return eval(equation);
    },
    interface: 'CalcuatorAction',
    definition: `interface CalcuatorAction {
  action: "calculator";
  equation: string; // requires javascript syntax (including Math objects)
}`,
  },

  {
    action: 'nodejs_runcode',
    async handler({ code }) {
      // escape "code" to be shell-safe
      code = code.replace(/"/g, '\\"');

      // run code in a nodejs shell, capture the stdout + stderr and return it; using execAsync
      const { stdout, stderr } = await execAsync(`node -e "${code}"`);
      return `stdout\n----------\n${stdout}\nstderr\n----------\n${stderr}`;
    },
    interface: 'NodejsRunCode',
    definition: `interface NodejsRunCode {
  action: "nodejs_runcode";
  code: string; // executed in a nodejs shell, stdout and stderr are returned
}`
  },

  {
    action: "issues.write",
    async handler({ title, description }) {
      const issue = await writeIssue(title, description);
      return `Issue ${issue.id} created for ${issue.name}: ${description}`;
    },
    interface: 'IssuesWriteAction',
    definition: `interface IssuesWriteAction {
  action: "issues.write";
  title: string; // title of the issue to create or update
  description: string;
}`,
  },
  {
    action: "issues.close",
    async handler({ id }) {
      await closeIssue(id);
      return `Issue ${id} closed`;
    },
    interface: 'IssuesCloseAction',
    definition: `interface IssuesCloseAction {
  action: "issues.close";
  id: string; // id of the issue to close
}`,
  },

  {
    action: 'terminal.start',
    async handler() {
      return startTerminal();
    },
    interface: 'StartTerminalAction',
    definition: `interface StartTerminalAction {
  // opens a new ${process.platform} terminal in the project directory
  action: "terminal.start";
}`
  },
  {
    action: 'terminal.run',
    async handler({ id, command }) {
      return await executeCommand(id, command);
    },
    interface: 'RunTerminalAction',
    get definition() {
      return `interface RunTerminalAction {
  // executes a command in the ${process.platform} shell
  // stdout and stderr are returned
  action: "terminal.run";
  id: ${Object.keys(terminalProcesses).join(', ') ? Object.keys(terminalProcesses).join(', ') : 'never'}; // id of the terminal to use
  command: string;
}`;
    },
  },
  {
    action: 'terminal.read',
    async handler({ id, lineCount }) {
      const terminalWindow = terminalProcesses[id];
      if (!terminalWindow) {
        throw new Error(`Terminal ${id} not found`);
      }
      const { output } = terminalWindow;
      return lineCount ? output.value.split('\n').slice(-lineCount).join('\n') : output.value;
    },
    interface: 'ReadTerminalAction',
    get definition() {
      return `interface ReadTerminalAction {
  // executes a command in the ${process.platform} shell
  // stdout and stderr are returned
  // cwd defaults to project directory
  action: "terminal.read";
  id: ${Object.keys(terminalProcesses).join(', ') ? Object.keys(terminalProcesses).join(', ') : 'never'}; // id of the terminal to use
  lineCount?: number; // number of lines to limit read to
}`;
    },
  },
  {
    action: 'terminal.close',
    async handler({ id }) {
      closeTerminal(id);
      return "terminal has been closed";
    },
    interface: 'CloseTerminalAction',
    get definition() {
      return `interface CloseTerminalAction {
  action: "terminal.close";
  id: ${Object.keys(terminalProcesses).join(', ') ? Object.keys(terminalProcesses).join(', ') : 'never'}; // id of the terminal to use
}`;
    },
  },

  {
    action: 'knowledgebase.write',
    async handler({ content }) {
      setKnowledgeBase(content);
      return `Knowledgebase written`;
    },
    interface: 'WriteKnowledgeBaseAction',
    definition: `interface WriteKnowledgeBaseAction {
      action: "knowledgebase.write";
      // use the knowledge base to store information that is useful for anyone working on the project
      // it is useful to continually update this with new information as it is discovered or produced
      // we encourage markdown formatting
      content: string;
}`
  },

  {
    action: 'file.write',
    async handler({ path, summary, content }) {
      writeFileSync(path, content);
      setFileSummary(path, summary);
      return `File written to ${path}`;
    },
    interface: 'FileWriteAction',
    definition: `interface FileWriteAction {
      action: "file.write";
      path: string;
      summary: string; // short summary of the whole file (**NOT A CHANGE DESCRIPTION**), is saved in the project description for future reference
      content: string; // file contents
}`
  },
  {
    action: 'file.read',
    async handler({ path }) {
      return readFileSync(path, 'utf8');
    },
    interface: 'FileReadAction',
    definition: `interface FileReadAction {
      action: "file.read";
      path: string;
}`
  },
  {
    action: 'file.delete',
    async handler({ path }) {
      unlinkSync(path);
      return `File deleted at ${path}`;
    },
    interface: 'FileDeleteAction',
    definition: `interface FileDeleteAction {
      action: "file.delete";
      path: string; // file OR DIRECTORY to unlink
}`
  },

  {
    action: 'puppeteer.run',
    async handler({ code }) {
      return await doPuppeteer({ code });
    },
    interface: 'PuppeteerAction',
    definition: `interface PuppeteerAction {
      // opens or resumes a persistant browser instance
      // executes in nodejs context where \`browser\` and \`page\` are already available
      // return the data you want to capture at the end, e.g.
      //   return await page.evaluate(() => document.title);
      //     to verify the page title
      // or
      //   return await page.content();
      //     to get the html contents of the page
      action: "puppeteer.run";
      code: string;
}`
  },
  {
    action: 'puppeteer.close',
    async handler() {
      await closePuppeteer();
      return "Puppeteer session closed";
    },
    interface: 'ClosePuppeteerAction',
    definition: `interface ClosePuppeteerAction {
      // destroys the persistant browser instance
      action: "puppeteer.close";
}`
  },
];

export const getActionContext = () => {
  const actionDefinitions = actions.reduce((acc, action) => {
    acc.definitions += action.definition + "\n";
    acc.interfaces.push(action.interface);
    return acc;
  }, { definitions: '', interfaces: [] });
  const actionContext = `${actionDefinitions.definitions}
  
  type Action = ${actionDefinitions.interfaces.join(' | ')}; `;

  return actionContext;
}

export const executeAction = async (action) => {
  const actionHandler = actions.find(a => a.action === action.action);
  if (!actionHandler) {
    throw new Error(`No handler found for action type ${action.action}`);
  }
  return await actionHandler.handler(action);
}
