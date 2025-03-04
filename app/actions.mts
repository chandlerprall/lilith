import { Session } from "./project.mjs";
import { closePageSession, executeInPage, navigateTo, readBrowserPage, startPageSession } from "./utils/browser.mjs";
import { executeCommand, startTerminal, closeTerminal, readTerminal } from "./utils/terminal.mjs";
import { activeSession, awaitSession, continueSession, startSession } from "./session.mjs";
const os = require("os");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const { readFileSync, writeFileSync, unlinkSync } = require("fs");
const execAsync = promisify(exec);

const actions = [
	{
		action: "task.start",
		async handler(session: Session, { title }: { title: string }, description: string) {
			if (!title) {
				throw new Error("task.start requires a title");
			}

			if (session.meta.task.type !== "none" && session.meta.task.title === title) {
				const error = new Error(`The current task is already titled "${title}", are you sure you need to start a new task instead of working within the current one?`);
				(error as Error & { content: string }).content = `The current task is already titled "${title}", we should work on this task directly instead of starting something new.`;
				throw error;
			}

			const newTask =
				session.meta.task.type === "review-pr"
					? ({
							type: "review-pr",
							url: session.meta.task.url,
							title,
							instructions: `Task "${title}"\n---\n${description}`,
					  } satisfies Project.SessionTasks["review-pr"])
					: ({
							type: "freeform",
							title,
							description,
					  } satisfies Project.SessionTasks["freeform"]);
			const newSession = await startSession({
				parent: session.id,
				task: newTask,
				type: structuredClone(session.meta.type),
			});
			newSession.autorun = session.autorun; // inherit autorun
			newSession.messages = structuredClone(session.messages); // inherit messages

			continueSession(newSession, {
				role: session.messages.at(-1)?.role === "assistant" ? "user" : "assistant",
				content: `New task "${title}" started, with instructions:\n---\n${description}\n---\nRemember to complete only this task, starting new tasks only as required to finish it.`,
			});
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
		action: "task.success",
		handler() {
			/* handled by project code */
		},
		definition: `<!-- mark the current task as completed successfully -->
<!ELEMENT task.success (#PCDATA)> <!-- results to return to who started the task, this should meet the requirements provided by the current task -->`,
	},
	{
		action: "task.failure",
		handler() {
			/* handled by project code */
		},
		definition: `<!-- mark the current task as failed  -->
<!ELEMENT task.failure (#PCDATA)> <!-- results to return to who started the task, use the space to describe the results and why the task failed -->`,
	},

	{
		action: "calculate",
		handler(session: Session, { equation }: { equation: string }) {
			return eval(equation);
		},
		definition: `<!-- perform a mathematical calculation -->
<!ELEMENT calculate EMPTY>
<!ATTLIST calculate
  equation CDATA #REQUIRED <!-- uses javascript syntax (including Math objects) -->
>`,
	},

	{
		action: "file.write",
		async handler(session: Session, { path, startLine: _startLine, endLine: _endLine }: { path: string; startLine?: string; endLine?: string }, content: string) {
			// handle undefined & string values in startLine and endLine
			let startLine = _startLine ? parseInt(_startLine, 10) : undefined;
			let endLine = _endLine ? parseInt(_endLine, 10) : undefined;
			if (startLine != null || endLine != null) {
				const fileContents = readFileSync(path, "utf8").split("\n");
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

				const newContents = [...fileContents.slice(0, startLine - 1), ...content.split("\n"), ...fileContents.slice(endLine)];
				writeFileSync(path, newContents.join("\n"));
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
		action: "file.read",
		async handler(session: Session, { path, includeLineNumbers = "false" }: { path: string; includeLineNumbers?: string }) {
			let contents: string = readFileSync(path, "utf8");
			if (includeLineNumbers === "true") {
				// line numbers should be left-padding
				const lines = contents.split("\n");
				const maxLineNumberLength = lines.length.toString().length;
				contents = lines.map((line, idx) => `${(idx + 1).toString().padStart(maxLineNumberLength, " ")}: ${line}`).join("\n");
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
		action: "file.delete",
		async handler(session: Session, { path }: { path: string }) {
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
		action: "nodejs_runcode",
		async handler(session: Session, _: {}, code: string) {
			const tmpFile = path.join(os.tmpdir(), "__lilith.js");
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
		action: "terminal.start",
		async handler(session: Session) {
			return startTerminal(session);
		},
		definition: `<!-- open a new terminal in the project directory -->
    <!-- **note** this returns the terminal id for use in the other terminal actions, you must wait before using a started terminal -->
<!ELEMENT terminal.start EMPTY>`,
	},
	{
		action: "terminal.run",
		async handler(session: Session, { id }: { id: string }, command: string) {
			if (id == null) {
				throw new Error("terminal.run requires an id attribute");
			}
			if (!command) {
				throw new Error("terminal.run requires a command; the element body is used as the command");
			}
			return await executeCommand(session, id, command);
		},
		get definition() {
			return `<!-- sends input to the terminal's stdin, resulting stdout and stderr are returned -->
<!--
in addition to base commands, the following tools are available:

* \`gh\` CLI
  * use fully-qualified URLS for issues & PRs
  * use only read-only operations (do not write/post to github)
-->
<!ELEMENT terminal.run (#PCDATA)> <!-- element body is used as the command -->
<!ATTLIST terminal.run
id CDATA #REQUIRED <!-- id of the terminal, start a terminal first if you don't have an ID -->
>`;
		},
	},
	{
		action: "terminal.read",
		async handler(session: Session, { id, lineCount }: { id: string; lineCount?: string }) {
			return readTerminal(session, id, lineCount ? parseInt(lineCount, 10) : undefined);
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
		action: "terminal.close",
		async handler(session: Session, { id }: { id: string }) {
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
		action: "browser.open",
		async handler(session: Session) {
			return await startPageSession(session);
		},
		definition: `<!-- **note** this returns the session id for use in the other browser actions, you must wait before using an opened browser -->
<!ELEMENT browser.open EMPTY>`,
	},
	{
		action: "browser.navigate",
		async handler(session: Session, { id, url }: { id: string; url: string }) {
			return await navigateTo(session, id, url);
		},
		definition: `<!ELEMENT browser.navigate (EMPTY)>
<!ATTLIST browser.navigate
  id CDATA #REQUIRED <!-- id of the browser session -->
  url CDATA #REQUIRED <!-- url to navigate to -->
>`,
	},
	{
		action: "browser.getcontent",
		async handler(session: Session, { id, format }: { id: string; format?: string }) {
			return await readBrowserPage(session, id, format);
		},
		definition: `<!ELEMENT browser.getcontent EMPTY>
<!ATTLIST browser.getcontent
  id CDATA #REQUIRED <!-- id of the browser session -->
  format (html | text | markdown) "markdown" <!-- format to read the page in -->
>`,
	},
	{
		action: "browser.execute",
		async handler(session: Session, { id, waitMsAfter: _waitMsAfter }: { id: string; waitMsAfter?: string }, code: string) {
			let waitMsAfter: number | undefined;
			if (_waitMsAfter) {
				waitMsAfter = parseInt(_waitMsAfter, 10);
			}
			return await executeInPage(session, id, waitMsAfter, code);
		},
		definition: `<!--
    Function body to execute javascript in the page (it is wrapped in an async function so await usage is safe).
    To access any data, you can use any combination of console.log, console.error, and return values.

    e.g.

    \`\`\`javascript
    console.log('foo')
    console.log('bar')
    await somePromise;
    return 5;
    \`\`\`
  -->
<!ELEMENT browser.execute (#PCDATA)> <!-- any value from \`return\` is reported back -->
<!ATTLIST browser.execute
  id CDATA #REQUIRED <!-- id of the browser session -->
  waitMsAfter CDATA #IMPLIED <!-- if present, the number of milliseconds to wait after the code is excuted, before returning -->
>`,
	},
	{
		action: "browser.close",
		async handler(session: Session, { id }: { id: string }) {
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
		action: "speak",
		handler() {
			/* handled by project code */
		},
		definition: `<!-- give a response back to the user; NOTE: do not use speak to return task information, just complete the task -->
<!ELEMENT speak (#PCDATA)>`,
	},
] as const;

type Action = (typeof actions)[number];
export type ActionType = Action["action"];

export const getActionNames = (definedActions: ReadonlyArray<Action> = actions) => {
	return definedActions.map((action) => action.action).join(" | ");
};

export const filterActionsByTypes = (types: Array<ActionType> | Set<ActionType>): Array<Action> => {
	if (Array.isArray(types)) {
		types = new Set(types);
	}
	return actions.filter((action) => types.has(action.action));
};
export const getActionsContext = (session: Session) => {
	// const isPairingAndUser = session.meta.type.type === 'pairing' && session.messages.at(-1)?.role === 'assistant';
	// const definedActions = isPairingAndUser ? filterActionsByTypes(['speak', 'task.start', 'task.success', 'task.failure']) : actions;

	let definedActions: ReadonlyArray<Action> = actions;

	if (session.meta.type.type === "pairing") {
		if (session.meta.parent == null) {
			// limit top-level pairing session
			definedActions = filterActionsByTypes(["speak", "task.start", "task.success", "task.failure"]);
		}
	}

	const actionDefs = definedActions.reduce((acc, action) => {
		acc += action.definition + "\n\n";
		return acc;
	}, "");

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

> [!IMPORTANT]  
> The actions are listed above in their order of preference. If multiple actions could be used to achieve the same result, the first one listed should be used. If you are unsure, use the first one listed, if that fails you can always take another approach.
`;
};

type ActionParameters = {
	[K in (typeof actions)[number]["action"]]: Parameters<Extract<(typeof actions)[number], { action: K }>["handler"]>[1];
};

export const executeAction = async <T extends ActionType>(session: Session, { action: actionName, args, text }: { action: T; args: ActionParameters[T]; text?: string }) => {
	const actionHandler = actions.find((a) => a.action === actionName)?.handler;
	if (!actionHandler) {
		throw new Error(`No handler found for action type ${actionName}`);
	}
	// @ts-expect-error TS is lost in indirection
	return await actionHandler(session, args, text);
};
