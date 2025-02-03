import { closeIssue, setKnowledgeBase, writeIssue } from "./project.js";
import { closePuppeteer, doPuppeteer } from "./puppeteer.js";
import { executeCommand, startTerminal, terminalProcesses, closeTerminal } from "./terminal.js";
const { exec } = require('child_process');
const { promisify } = require('util');
const { readFileSync, writeFileSync, unlinkSync } = require('fs');
const execAsync = promisify(exec);

const actions = [
  {
    action: 'speak',
    handler() {/* handled by project code */ },
    definition: `<!-- give a response back to the conversation -->
<!ELEMENT speak (#PCDATA)>`,
  },

  {
    action: 'calculate',
    handler({ equation }) {
      return eval(equation);
    },
    definition: `<!-- perform a mathematical calculation -->
<!ELEMENT calculate EMPTY>
<!ATTLIST calculate
  equation CDATA #REQUIRED <!-- uses javascript syntax (including Math objects) -->
>`,
  },

  {
    action: 'nodejs_runcode',
    async handler(_, code) {
      // escape "code" to be shell-safe
      code = code.replace(/"/g, '\\"');

      // run code in a nodejs shell, capture the stdout + stderr and return it; using execAsync
      const { stdout, stderr } = await execAsync(`node -e "${code}"`);
      return `stdout\n----------\n${stdout}\nstderr\n----------\n${stderr}`;
    },
    definition: `<!-- text in the element body is executed in a nodejs shell, stdout and stderr are returned -->
<!ELEMENT nodejs_runcode (#PCDATA)>`,
  },

  {
    action: "issues.write",
    async handler({ title }, description) {
      const issue = await writeIssue(title, description);
      return `Issue ${issue.id} created for ${issue.name}: ${description}`;
    },
    definition: `<!-- sets the titled issue's description to the element text -->
<!ELEMENT issues.write (#PCDATA)>
<!ATTLIST issues.write
title CDATA #REQUIRED
>`,
  },
  {
    action: "issues.close",
    async handler({ id }) {
      await closeIssue(id);
      return `Issue ${id} closed`;
    },
    definition: `<!ELEMENT issues.close EMPTY>
<!ATTLIST issues.close
id CDATA #REQUIRED <!-- id of the issue to close -->
>`,
  },

  {
    action: 'terminal.start',
    async handler() {
      return startTerminal();
    },
    definition: `<!-- open a new terminal in the project directory -->
    <!-- **note** this returns the terminal id for use in the other terminal actions, you must wait before using a started temrinal -->
<!ELEMENT terminal.start EMPTY>`,
  },
  {
    action: 'terminal.run',
    async handler({ id }, command) {
      return await executeCommand(id, command);
    },
    get definition() {
      return `<!-- sends input to the terminal's stdin, resulting stdout and stderr are returned -->
<!ELEMENT terminal.run (#PCDATA)> <!-- element body is used as the command -->
<!ATTLIST terminal.run
id CDATA #REQUIRED <!-- id of the terminal, options: ${Object.keys(terminalProcesses).join(', ') ? Object.keys(terminalProcesses).join(', ') : '[no terminals are open]'} -->
>`;
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
    get definition() {
      return `<!-- read output from the terminal -->
<!ELEMENT terminal.read EMPTY>
<!ATTLIST terminal.read
id CDATA #REQUIRED <!-- id of the terminal, options: ${Object.keys(terminalProcesses).join(', ') ? Object.keys(terminalProcesses).join(', ') : '[no terminals are open]'} -->
lineCount CDATA #IMPLIED <!-- number of lines to limit read to, if omitted all lines are read -->
>`;
    },
  },
  {
    action: 'terminal.close',
    async handler({ id }) {
      closeTerminal(id);
      return "terminal has been closed";
    },
    get definition() {
      return `<!-- close the terminal -->
<!ELEMENT terminal.close EMPTY>
<!ATTLIST terminal.close
id CDATA #REQUIRED <!-- id of the terminal, options: ${Object.keys(terminalProcesses).join(', ') ? Object.keys(terminalProcesses).join(', ') : '[no terminals are open]'} -->
>`;
    },
  },

  {
    action: 'knowledgebase.write',
    async handler(_, content) {
      setKnowledgeBase(content);
      return `Knowledgebase written`;
    },
    definition: `<!-- write to the knowledge base -->
<! -- use the knowledge base to store information that is useful for anyone working on the project
    it is useful to continually update this with new information as it is discovered or produced
    we encourage markdown formatting -->
<!ELEMENT knowledgebase.write (#PCDATA)> <!-- element body is used as the new knowledgebase -->`,
  },

  {
    action: 'file.write',
    async handler({ path, startLine, endLine }, content) {
      // handle undefined & string values in startLine and endLine
      startLine = startLine ? parseInt(startLine, 10) : undefined;
      endLine = endLine ? parseInt(endLine, 10) : undefined;
      if (startLine != null || endLine != null) {
        const fileContents = readFileSync(path, 'utf8').split('\n');
        if (startLine != null) {
          startLine = Math.max(1, Math.min(startLine, fileContents.length));
        } else {
          startLine = 1;
        }

        if (endLine != null) {
          endLine = Math.max(startLine, Math.min(endLine, fileContents.length));
        } else {
          endLine = fileContents.length;
        }

        const newContents = [...fileContents.slice(0, startLine - 1), ...content.split('\n'), ...fileContents.slice(endLine)];
        writeFileSync(path, newContents.join('\n'));

        // communicate the result, including the lines that were replaced +/- 5 lines on each side
        const start = Math.max(0, startLine - 6);
        const end = Math.min(fileContents.length, endLine + 5);
        return `File written to ${path}\n\n${fileContents.slice(start, end).join('\n')}`;
      } else {
        writeFileSync(path, content);
        return `File written to ${path}`;
      }
    },
    definition: `<!-- write to a file -->
<!ELEMENT file.write (#PCDATA)> <!-- element body is written as the file contents -->
<!ATTLIST file.write
path CDATA #REQUIRED
startLine CDATA #IMPLIED <!-- line number to start writing at, inclusive; NOTE line count starts at 1 -->
endLine CDATA #IMPLIED <!-- line number to stop writing, inclusive -->
>
<!--
  Without startLine or endLine, the element body represents the entire file contents. When either startLine and/or endLine are specified,
  the file is read and the element body is used to replace lines in the file using the following rules. Omitting either startLine or endLine defaults them to the start and end of the document, respectively
  
  Some examples:
  - <file.write path="/path/to/file.txt"">foo</file.write>
    writes the entire file with the single line "foo"
  - <file.write path="/path/to/file.txt" startLine="1" endLine="3">foo</file.write>
    writes lines 1-3 with the single line "foo"
  - <file.write path="/path/to/file.txt" startLine="5">
      foo
      bar
    </file.write>
    replaces lines 5-[end] with the lines "foo" and "bar"
  - <file.write path="/path/to/file.txt" endLine="10">
      foo
      bar
    </file.write>
    writes lines [start]-10 with the lines "foo" and "bar"

  NOTE if either startLine or endLine are out of range they are aligned to the start and end lines of the file, no error or other message is given
-->`,
  },
  {
    action: 'file.read',
    async handler({ path, includeLineNumbers = "false" }) {
      let contents = readFileSync(path, 'utf8');
      if (includeLineNumbers === "true") {
        // line numbers should be left-padding
        const lines = contents.split('\n');
        const maxLineNumberLength = lines.length.toString().length;
        contents = lines.map((line, idx) => `${(idx + 1).toString().padStart(maxLineNumberLength, ' ')}: ${line}`).join('\n');
      }
      return contents;
    },
    definition: `<!-- read a file -->
<!ELEMENT file.read EMPTY>
<!ATTLIST file.read
path CDATA #REQUIRED
includeLineNumbers (true | false) "false" <!-- whether to include line numbers in the response, useful when performing edits -->
>`,
  },
  {
    action: 'file.delete',
    async handler({ path }) {
      unlinkSync(path);
      return `File deleted at ${path}`;
    },
    definition: `<!-- delete a file or directory -->
<!ELEMENT file.delete EMPTY>
<!ATTLIST file.delete
path CDATA #REQUIRED
>`,
  },

  {
    action: 'puppeteer.run',
    async handler(_, code) {
      return await doPuppeteer({ code });
    },
    definition: `<!-- run puppeteer code -->
<!--  opens or resumes a persistant browser instance
    executes in nodejs context where \`browser\` and \`page\` are already available
    return the data you want to capture at the end, e.g.
      return await page.evaluate(() => document.title);
      to verify the page title
    or
      return await page.content();
        to get the html contents of the page -->
<!ELEMENT puppeteer.run (#PCDATA)> <!-- element body is executed in puppeteer -->`,
  },
  {
    action: 'puppeteer.close',
    async handler() {
      await closePuppeteer();
      return "Puppeteer session closed";
    },
    definition: `<!-- close puppeteer session -->
<!ELEMENT puppeteer.close EMPTY>`,
  },
];

export const getActionNames = () => {
  return actions.map(action => action.action).join(' | ');
}

export const getActionDefinitions = () => {
  return actions.reduce((acc, action) => {
    acc += action.definition + "\n\n";
    return acc;
  }, '');
}

export const executeAction = async ({ action: actionName, args, text }) => {
  const actionHandler = actions.find(a => a.action === actionName)?.handler;
  if (!actionHandler) {
    throw new Error(`No handler found for action type ${actionName}`);
  }
  return await actionHandler(args, text);
}
