import { closeIssue, writeIssue } from "./project.js";
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const actions = [
  {
    action: 'calculator',
    handler({ equation }) {
      console.log('resolving', equation, 'result is', eval(equation));
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
];

const actionDefinitions = actions.reduce((acc, action) => {
  acc.definitions += action.definition + "\n";
  acc.interfaces.push(action.interface);
  return acc;
}, { definitions: '', interfaces: [] });
export const actionContext = `${actionDefinitions.definitions}

type Action = ${actionDefinitions.interfaces.join(' | ')}; `;

export const executeAction = async (action) => {
  const actionHandler = actions.find(a => a.action === action.action);
  if (!actionHandler) {
    throw new Error(`No handler found for action type ${action.action}`);
  }
  return await actionHandler.handler(action);
}