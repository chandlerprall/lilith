import { closeIssue, setKnowledgeBase, writeIssue } from "./project.js";
import { closePageSession, executeInPage, navigateTo, readBrowserPage, startPageSession } from "./utils/browser.js";
import { executeCommand, startTerminal, closeTerminal, readTerminal } from "./utils/terminal.js";
import { activeSession, awaitSession, continueSession, sessionDefinitions, startSession } from "./session.js";
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { readFileSync, writeFileSync, unlinkSync } = require('fs');
const execAsync = promisify(exec);

const actions = [
  {
    action: 'task.start',
    async handler(session, { title }, description) {
      const newSession = startSession({
        parent: session,
        task: { type: 'freeform', title, description },
        type: structuredClone(session.meta.type)
      });
      newSession.autorun = session.autorun; // inherit autorun
      newSession.messages.length = 1; // keep only the system message
      newSession.messages.push({
        role: 'user',
        content: 'Start on the current task. First, decide if you can resolve the task immediately or if you will be creating sub tasks. As a reminder, only lengthy tasks should be broken into sub tasks.',
      })

      continueSession(newSession, undefined, true);
      activeSession.value = newSession;
      const { status, result } = await awaitSession(newSession);
      activeSession.value = session;

      return `${status}\n---\n${result}`;
    },
    definition: `<!-- start a new task, action returns with the results -->
<!ELEMENT task.start (#PCDATA)> <!-- element contents is a description of the task -->
<!ATTLIST task.start
  title CDATA #REQUIRED <!-- title provides an at-a-glance identifier for the task -->
>`,
  },
  {
    action: 'task.success',
    handler() {/* handled by project code */ },
    definition: `<!-- mark the current task as completed successfully -->
<!ELEMENT task.success (#PCDATA)> <!-- results to return to who started the task, this should meet the requirements provided by the current task -->`
  },
  {
    action: 'task.failure',
    handler() {/* handled by project code */ },
    definition: `<!-- mark the current task as failed  -->
<!ELEMENT task.failure (#PCDATA)> <!-- results to return to who started the task, use the space to describe the results and why the task failed -->`
  },

  {
    action: 'calculate',
    handler(session, { equation }) {
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
    async handler(session, _, code) {
      const tmpFile = path.join(os.tmpdir(), '__lilith.js');
      writeFileSync(tmpFile, code);
      const { stdout, stderr } = await execAsync(`node ${tmpFile}`);
      return `
<stdout><![CDATA[
${stdout}
]]></stdout>
<stderr><![CDATA[
${stderr}
]]></stderr>
`.trim();
    },
    definition: `<!-- text in the element body is executed in a nodejs shell, stdout and stderr are returned -->
<!ELEMENT nodejs_runcode (#PCDATA)>`,
  },

  //   {
  //     action: "issues.write",
  //     async handler(session, { title }, description) {
  //       const issue = await writeIssue(title, description);
  //       return `Issue ${issue.id} created for ${issue.name}: ${description}`;
  //     },
  //     definition: `<!-- sets the titled issue's description to the element text -->
  // <!ELEMENT issues.write (#PCDATA)>
  // <!ATTLIST issues.write
  // title CDATA #REQUIRED
  // >`,
  //   },
  //   {
  //     action: "issues.close",
  //     async handler(session, { id }) {
  //       await closeIssue(id);
  //       return `Issue ${id} closed`;
  //     },
  //     definition: `<!ELEMENT issues.close EMPTY>
  // <!ATTLIST issues.close
  // id CDATA #REQUIRED <!-- id of the issue to close -->
  // >`,
  //   },

  {
    action: 'terminal.start',
    async handler(session) {
      return startTerminal(session);
    },
    definition: `<!-- open a new terminal in the project directory -->
    <!-- **note** this returns the terminal id for use in the other terminal actions, you must wait before using a started temrinal -->
<!ELEMENT terminal.start EMPTY>`,
  },
  {
    action: 'terminal.run',
    async handler(session, { id }, command) {
      return await executeCommand(session, id, command);
    },
    get definition() {
      return `<!-- sends input to the terminal's stdin, resulting stdout and stderr are returned -->
<!ELEMENT terminal.run (#PCDATA)> <!-- element body is used as the command -->
<!ATTLIST terminal.run
id CDATA #REQUIRED <!-- id of the terminal, start a terminal first if you don't have an ID -->
>`;
    },
  },
  {
    action: 'terminal.read',
    async handler(session, { id, lineCount }) {
      return readTerminal(session, id, lineCount)
    },
    get definition() {
      return `<!ELEMENT terminal.read EMPTY>
<!ATTLIST terminal.read
id CDATA #REQUIRED <!-- id of the terminal, start a terminal first if you don't have an ID -->
lineCount CDATA #IMPLIED <!-- number of lines to limit read to, if omitted all lines are read -->
>`;
    },
  },
  {
    action: 'terminal.close',
    async handler(session, { id }) {
      closeTerminal(session, id);
      return "terminal has been closed";
    },
    get definition() {
      return `<!ELEMENT terminal.close EMPTY>
<!ATTLIST terminal.close
id CDATA #REQUIRED <!-- id of the terminal, start a terminal first if you don't have an ID -->
>`;
    },
  },

  //   {
  //     action: 'knowledgebase.write',
  //     async handler(session, _, content) {
  //       setKnowledgeBase(content);
  //       return `Knowledgebase written`;
  //     },
  //     definition: `<! -- use the knowledge base to store information that is useful for anyone working on the project
  //     it is useful to continually update this with new information as it is discovered or produced
  //     we encourage markdown formatting -->
  // <!ELEMENT knowledgebase.write (#PCDATA)> <!-- element body is used as the new knowledgebase -->`,
  //   },

  {
    action: 'file.write',
    async handler(session, { path, startLine, endLine }, content) {
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
      } else {
        writeFileSync(path, content);
      }
      return `File written to ${path}`;
    },
    definition: `<!ELEMENT file.write (#PCDATA)> <!-- element body is written as the file contents -->
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
    async handler(session, { path, includeLineNumbers = "false" }) {
      let contents = readFileSync(path, 'utf8');
      if (includeLineNumbers === "true") {
        // line numbers should be left-padding
        const lines = contents.split('\n');
        const maxLineNumberLength = lines.length.toString().length;
        contents = lines.map((line, idx) => `${(idx + 1).toString().padStart(maxLineNumberLength, ' ')}: ${line}`).join('\n');
      }
      return contents;
    },
    definition: `<!ELEMENT file.read EMPTY>
<!ATTLIST file.read
path CDATA #REQUIRED <!-- absolute path to the file -->
includeLineNumbers (true | false) "false" <!-- whether to include line numbers in the response, useful when performing edits -->
>`,
  },
  {
    action: 'file.delete',
    async handler(session, { path }) {
      unlinkSync(path);
      return `File deleted at ${path}`;
    },
    definition: `<!-- delete a file or directory -->
<!ELEMENT file.delete EMPTY>
<!ATTLIST file.delete
path CDATA #REQUIRED <!-- absolute path to the file -->
>`,
  },

  {
    action: 'browser.open',
    async handler(session) {
      return await startPageSession(session);
    },
    definition: `<!-- **note** this returns the session id for use in the other browser actions, you must wait before using an opened browser -->
<!ELEMENT browser.open EMPTY>`,
  },
  {
    action: 'browser.navigate',
    async handler(session, { id, url }) {
      return await navigateTo(session, id, url);
    },
    definition: `<!ELEMENT browser.navigate (EMPTY)>
<!ATTLIST browser.navigate
  id CDATA #REQUIRED <!-- id of the browser session -->
  url CDATA #REQUIRED <!-- url to navigate to -->
>`,
  },
  {
    action: 'browser.read',
    async handler(session, { id, format }) {
      return await readBrowserPage(session, id, format);
    },
    definition: `<!ELEMENT browser.read EMPTY>
<!ATTLIST browser.read
  id CDATA #REQUIRED <!-- id of the browser session -->
  format (html | text | markdown) "markdown" <!-- format to read the page in -->
>`,
  },
  {
    action: 'browser.execute',
    async handler(session, { id, waitMsAfter }, code) {
      if (waitMsAfter) {
        waitMsAfter = parseInt(waitMsAfter, 10);
      }
      return await executeInPage(session, id, waitMsAfter, code);
    },
    definition: `<!-- function body to execute javascript in the page (it is wrapped in an async function so await usage is safe) -->
<!ELEMENT browser.execute (#PCDATA)> <!-- any value from \`return\` is reported back -->
<!ATTLIST browser.execute
  id CDATA #REQUIRED <!-- id of the browser session -->
  waitMsAfter CDATA #IMPLIED <!-- if present, the number of milliseconds to wait after the code is excuted, before returning -->
>`,
  },
  {
    action: 'browser.close',
    async handler(session, { id }) {
      return await closePageSession(session, id);
    },
    definition: `<!-- close browser session -->
<!ELEMENT browser.close EMPTY>
<!ATTLIST browser.close
  id CDATA #REQUIRED <!-- id of the browser session -->
>
`,
  },

  {
    action: 'speak',
    handler() {/* handled by project code */ },
    definition: `<!-- give a response back to the user; NOTE: do not use speak to return task information, just complete the task -->
<!ELEMENT speak (#PCDATA)>`,
  },
];

export const getActionNames = (definedActions) => {
  return definedActions.map(action => action.action).join(' | ');
}

export const filterActionsByTypes = (types) => {
  if (Array.isArray(types)) {
    types = new Set(types);
  }
  return actions.filter(action => types.has(action.action));
}
export const getActionsContext = (definedActions = actions) => {
  const actionDefs = definedActions.reduce((acc, action) => {
    acc += action.definition + "\n\n";
    return acc;
  }, '');

  return `All of the responses are **only ever** a XML document containing the singular action to take, making great use of CDATA. There is no text before or after the XML document. An example document is:

\`\`\`document
<?xml version="1.0" encoding="UTF-8"?>
<action reason="I want to say hi">
  <speak><![CDATA[my message]]></speak>
</action>
\`\`\`

More formally, the document follows this definition:
  
\`\`\`dtd
<!ELEMENT action (${getActionNames(definedActions)})>
<!ATTLIST action
  reason CDATA #REQUIRED <!-- describe why you are taking this action -->
>

${actionDefs}
\`\`\`

<speak /> content is delivered back to the engineer's boss for him to respond, while the results of any action(s) are delivered back to the staff engineer for them to continue on. Also note how there is always exactly one child element of <action />.
`;
}

export const executeAction = async (session, { action: actionName, args, text }) => {
  const actionHandler = actions.find(a => a.action === actionName)?.handler;
  if (!actionHandler) {
    throw new Error(`No handler found for action type ${actionName}`);
  }
  return await actionHandler(session, args, text);
}
