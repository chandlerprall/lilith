import { registerComponent, Signal } from "@venajs/core";
import project, { ActionNode, getSessionById, Message, MessageRole, SendableMessage, Session, SessionMeta, sessions, SessionTask, SessionType } from "./project.mjs";
import { executeAction, getActionsContext } from "./actions.mjs";
import { taskDefinitions } from "./tasks.mjs";
import { getId } from "./utils/id.mjs";
import { ActionType } from "./actions.mjs";

const sessionPromises = new Map();

declare global {
	namespace Vena {
		interface Elements {
			"l-chat-session-config": {};
			"l-pairing-session-config": {};
		}
	}
}

export type Persona = {
	name: string;
	bio: string;
};

declare global {
	namespace Project {
		interface SessionTypes {
			chat: {
				type: "chat";
				who: Persona;
			};
			pairing: {
				type: "pairing";
				executor: Persona;
				pairer: Persona;
			};
		}
	}
}

const ChatSessionConfig = registerComponent("l-chat-session-config", ({ render, element, refs }) => {
	Object.defineProperty(element, "value", {
		get() {
			return {
				type: "chat",
				who: (refs.persona as HTMLInputElement).value,
			};
		},
	});

	render`
    <style>
      :host {
        display: block;
      }
    </style>
    Who do you want to chat with?
    <l-persona-selector id="persona"/>
  `;
});

const PairingSessionConfig = registerComponent("l-pairing-session-config", ({ render, element, refs }) => {
	Object.defineProperty(element, "value", {
		get() {
			return {
				type: "pairing",
				executor: (refs.executor as HTMLInputElement).value,
				pairer: (refs.pairer as HTMLInputElement).value,
			};
		},
	});

	render`
    <style>
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
    </style>
    
    <span>Who do you want to pair up?</span>
    
    <div>
      executor: <l-persona-selector id="executor"></l-persona-selector>
    </div>

    <div>
      pairer: <l-persona-selector id="pairer"></l-persona-selector>
    </div>
  `;
});

function getTaskTitle(session: Session) {
	switch (session.meta.task.type) {
		case "none":
			return "[no task for this session, follow the user's lead]";
		case "freeform":
			return session.meta.task.title;
		case "review-pr":
			return `Review PR "${session.meta.task.url}"`;
		default:
			// @ts-expect-error
			console.error(`[task type "${session.meta.task.type}" not understood, please report this to a supervisor ASAP]`);
			// @ts-expect-error
			return `[task type "${session.meta.task.type}" not understood, please report this to a supervisor ASAP]`;
	}
}

function getTaskContext(session: Session) {
	let parentStack = [];
	let parent = getSessionById(session.meta.parent);
	while (parent) {
		parentStack.unshift(getTaskTitle(parent));
		parent = getSessionById(parent.meta.parent);
	}

	const parentInfo = parentStack.length ? `## Parent tasks\n\n${parentStack.map((x) => `* ${x}`).join("\n")}` : "";

	let task = `${parentInfo}\n\n## Current task`;

	switch (session.meta.task.type) {
		case "none":
			task += "[no task for this session, follow the user's lead]";
			break;

		case "freeform":
			task += `
**${session.meta.task.title}**

${session.meta.task.description}
      `;
			break;

		case "review-pr":
			task += `
**You are reviewing this PR:**
${session.meta.task.url}

${session.meta.task.instructions ? `**Additional instructions:**\n---\n${session.meta.task.instructions}` : ""}
## Pull request details

### Checkout directory

The contents of this PR are already checked out for you in: ${session.meta.task.checkoutDirectory}

### Title

${session.meta.task.prDetails?.title}

### Body

${session.meta.task.prDetails?.body}


### Files

${session.meta.task.prDetails?.files.map((file) => `* ${file.path} (${file.additions} additions, ${file.deletions} deletions)`).join("\n")}

## Review process

### **Objective**
The AI Code Review Agents engage in a simulated adversarial pairing session to rigorously analyze pull requests (PRs) within a **React web application**, backed by a **Java+Kotlin API server** and a **PostgreSQL database**. The agents evaluate code changes for their effect on **mass** (size of the codebase) and **inertia** (the ability to meet current and future business/engineering needs). The goal is to optimize for **high inertia with minimal mass**.

> [!IMPORTANT]  
> Use the \`gh\` command line tool from the terminal to get PR and issue details. Prefer using fully-qualified URLs instead of just IDs when fetching issue or PR details, as this avoids confusion about issues linked from separate repositories.
> **only use the \`view\` commands, this is a read-only operation.**
> The output of this code review should be saved to /Users/chandlerprall/review.txt
> for human evaluation.

---

### **Core Principles**
1. **Context-Driven Analysis**
   - Understand the **reasoning behind the PR** by pulling in details from linked issues, descriptions, and relevant past PRs.
   - Retrieve additional codebase context as needed to properly frame the changes.
   
2. **Adversarial but Constructive Review**
   - Challenge all changes, avoiding automatic approvals based on assumptions about author reliability.
   - Treat every PR as an adjustment to mass and inertia, ensuring a **net gain in beneficial inertia**.
   
3. **Multi-Layered Evaluation**
   - **Local Scope:** Analyze code within its immediate function and file.
   - **Codebase Scope:** Compare against similar patterns, enforce consistency, and ensure proper design token usage.
   - **Application Scope:** Validate alignment with broader architectural and business objectives.
   
4. **Change Categorization & Impact Assessment**
   - **Code Deletion:** Reduces mass—great! But assess whether it also reduces necessary inertia.
   - **Code Addition:** Increases mass—ensure added inertia is worth the trade-off.
   - **Code Modification:** Subtle shifts in mass and inertia—requires careful before/after evaluation.

---

### **AI Review Workflow**
1. **Initialize the Problem Space**
   - Extract PR details, linked issues, and any referenced documentation.
   - Determine expected inertia impact based on business/engineering objectives.

2. **Search & Explore Additional Context**
   - Pull in related files, previous PRs, and relevant code sections for holistic understanding.
   - Check for references to affected components, APIs, or database schemas.

3. **Analyze Code Changes**
   - **3a. Diff Context:** Assess how all changes interact within the PR itself.
   - **3b. Codebase Context:** Check consistency with established patterns, adherence to design tokens, and potential refactors.
   - **3c. Problem Context:** Validate that the implementation effectively solves the stated problem—consider alternative approaches.

4. **Provide Constructive Feedback**
   - Identify high-impact issues, inconsistencies, or areas of improvement.
   - Flag small details such as naming, formatting, and style adherence.
   - Offer alternative solutions when beneficial.

---

### **Expected AI Behavior in Pairing Session**
- Agents actively **question and challenge** each other’s conclusions.
- No assumptions about correctness—every decision must be backed by analysis.
- Strive for **clarity and precision** in feedback, ensuring human developers understand the reasoning behind suggestions.
- Consider **long-term maintainability** rather than just immediate correctness.

---

### **Outcome**

The final review should be a **comprehensive, well-structured document** that:
* summarizes the PR's purpose and context,
* details the analysis of changes,
* provides actionable feedback, <-- this is the most important piece
* and outlines any areas requiring further discussion or clarification

Be sure to include specific examples and references to code sections where applicable.

### **Summary**
The AI agents operate in a rigorous, context-aware, adversarial pairing session to ensure every PR maintains a balance between **code mass and beneficial inertia**. All changes must be deeply understood within their **local function, the broader codebase, and the problem they aim to solve**. The review process is designed to prevent over-permissiveness and drive **high-quality, maintainable, and scalable** code contributions.

### **Tasking Recommendations**

To keep large reviews within the LLM context window, it is strongly recommended to break the workflow steps into tasks.
    `;
			break;

		default:
			// @ts-expect-error
			console.error(`[task type "${session.meta.task.type}" not understood, please report this to a supervisor ASAP]`);
			// @ts-expect-error
			task += `[task type "${session.meta.task.type}" not understood, please report this to a supervisor ASAP]`;
			break;
	}

	return task;
}

function getContext(session: Session) {
	let introduction;

	switch (session.meta.type.type) {
		case "chat":
			introduction = `The following is an interaction log between ${session.meta.type.who.name} and their boss.`;
			break;
		case "pairing":
			introduction = `The following is an interaction log between ${session.meta.type.executor.name} and ${session.meta.type.pairer.name}.`;
			break;
	}

	return `
${introduction}

# Project description

Name: ${project.name}
Directory: ${project.directory}

${project.context}

While the project as a whole is important to keep in mind, the task at hand is the most important thing to focus on. Make sure you dedicate actions to the task at hand, and not the project as a whole.

# Task

This conversation takes place in the context of the above project. More specifically, this conversation is about the task:

${getTaskContext(session)}

## Task completion

The intention of breaking operations into discrete tasks is to help the AI LLM agent focus on the task at hand. If the message history grows too long it will cause slow downs and eventually information dropping out of the context window.
Due to the this, to help faciliate your current task it may be necessary to create new tasks. To do this, use the \`task.create\` action and include information about the task you want to create.
If you need information that will likely span multiple actions or process lengths of content, it is best to split those into smaller tasks and compose the results.

Do not over-optimize for this, e.g. creating tasks for every thing, as that will lead to a task creating a task creating a task creating a task, all tasked with the same thing without ever achieving a result.

When the current task is complete, return its result as a success or failure. Do not take actions that are not neccessary for returning the requisite information, such as continuing on with the project. Return the result, and allow the owning task to decide how to proceed.

### Creating new tasks

Be explicit in what you need returned from the task. For example, asking for "a javascript function" that adds two numbers may result in the function being authored and saved to a file, instead of responding with the function body.
Instead, explicitly ask for "a javascript function" be returned as the task result. It's also important to remember LLMs halucinate and err on being overly agreeable, it is important to either have the task verify the output, or check yourself.

Make sure to include any important context in the task description, as the task will not have access to this conversation's history. If it needs to be aware of specific details, or keep in mind future steps, be sure to include that in the task description. For example: if the current task includes instructions on e.g. using a particular tool, or the known state of e.g. a codebase, send those details along!

### Completion

To complete the task, use the \`task.success\` action and include information completing the task. Do not take actions that are not neccessary for returning the requisite information.

### Failure

If you cannot fulfill the task for any reason, use the \`task.failure\` action and include information explaining why the task failed.

# Messages

## Format

${getActionsContext(session)}

## Content

Notice how intelligent and concise both parties are, applying their wealth of experience and insight to deal with any issue.
However, when getting stuck in a task they ask for input, never making something up.
They are self-starters, using the available tools and actions to solve problems and understand hurdles, iterating to find the right solution.

When you know what action should be taken next, do it! Be a self-starter, do not wait for the other party to tell you what to do next. If you are unsure, ask for input. If you are stuck, ask for help. If you need more information, ask for it. If you need to clarify something, ask for clarification. With the available actions, you are able to solve problems and understand hurdles, iterating to find the right solution.

### Message invariants

* never make something up, be honest when you don't know; look up the information and provide a source
* always take exactly action per message
* use well-formatted XML, properly escaping special characters when necessary
        `.trim();
}

type SessionTypeDefinition<T extends SessionType["type"], MappedType = Project.SessionTypes[T]> = {
	type: T;
	configElement: string;
	getSystemMessage?: (meta: MappedType extends SessionType ? SessionMeta<any, MappedType> : never, session?: Session) => string;
	getApiParams?: (session: Session & { meta: MappedType extends SessionType ? SessionMeta<any, MappedType> : never }) => Record<string, any>;
	preprocessMessages?: (this: SessionTypeDefinition<T>, session: Session & { meta: MappedType extends SessionType ? SessionMeta<any, MappedType> : never }) => Session["messages"];
	postprocessMessage?: (message: { role: "user" | "assistant"; content: string }, session: Session & { meta: MappedType extends SessionType ? SessionMeta<any, MappedType> : never }) => { role: "user" | "assistant"; content: string };
};

export const sessionDefinitions = [
	{
		type: "chat",
		configElement: ChatSessionConfig,
		getSystemMessage(meta) {
			const {
				type: { who },
			} = meta;
			return `You are Qwen, created by Alibaba Cloud. You are a helpful assistant.
  
  You must respond and act as if you are a person named ${who.name}: ${who.bio}`;
		},
	} as SessionTypeDefinition<"chat">,
	{
		type: "pairing",
		configElement: PairingSessionConfig,
		getSystemMessage(meta, session) {
			const {
				type: { executor, pairer },
			} = meta;
			if (session?.messages?.at(-1)?.role === "assistant") {
				return `You are Qwen, created by Alibaba Cloud. You are a helpful assistant.
  
You must respond and act as if you are a person named ${pairer.name}: ${pairer.bio}`;
			} else {
				return `You are Qwen, created by Alibaba Cloud. You are a helpful assistant.
  
You must respond and act as if you are a person named ${executor.name}: ${executor.bio}`;
			}
		},
		getApiParams(session) {
			if (session.messages.at(-1)?.role === "assistant") {
				// next message is from the user, remove the grammar
				return {
					// grammar_string: undefined,
				};
			}

			return {};
		},
		preprocessMessages(session) {
			console.log(this);
			let { messages } = session;

			// replace system message
			const systemMessage = this.getSystemMessage?.(session.meta, session);
			if (systemMessage && messages.at(0)?.role === "system") {
				messages[0].content = systemMessage;
			}

			// if the last message is from the user, don't swap the roles
			// else, swap the roles to make the assistant the user and vice versa

			if (messages.at(-1)?.role === "user") {
				return messages;
			}

			return structuredClone(messages).map((message) => {
				if (message.role === "assistant") {
					message.role = "user";
				} else if (message.role === "user") {
					message.role = "assistant";
				}
				return message;
			});
		},
		postprocessMessage(message, session) {
			return {
				...message,
				role: session.messages.at(-1)?.role === "assistant" ? "user" : "assistant",
			};
		},
	} as SessionTypeDefinition<"pairing">,
];

function refreshSessions() {
	sessions.dirty = true;
	activeSession.dirty = true;
}

export const activeSession = new Signal<Session | undefined>(sessions.value[0]);

class ExternallyResolvablePromise<T = any> {
	promise: Promise<T>;
	resolve: (value: T) => void = () => {};

	constructor() {
		this.promise = new Promise<T>((resolve) => {
			this.resolve = resolve;
		});
	}

	then(...args: Parameters<Promise<T>["then"]>) {
		return this.promise.then(...args);
	}

	catch(...args: Parameters<Promise<T>["catch"]>) {
		return this.promise.catch(...args);
	}

	finally(...args: Parameters<Promise<T>["finally"]>) {
		return this.promise.finally(...args);
	}
}
export const startSession = async ({ parent = undefined, task, type }: { parent?: string; task: SessionTask; type: SessionType }) => {
	const existingIds = new Set(sessions.value.map((issue) => issue.id));
	const id = getId(existingIds);

	const meta = {
		parent,
		task,
		type,
	};

	const session: Session = {
		id,
		meta,
		messages: getInitialMessages(meta),

		busy: false,
		autorun: false, //type.type !== 'chat',
		tokensUsed: null,
	};

	sessions.push(session);
	sessionPromises.set(session, new ExternallyResolvablePromise());

	const sessionTaskDef = taskDefinitions.find((def) => def.type === task.type);
	// @ts-expect-error having a sessionTaskDef proves this session is a valid argument
	await sessionTaskDef?.initializeSession?.(session);

	return session;
};

export const awaitSession = (session: Session) => {
	return sessionPromises.get(session);
};

export const addMessageWithoutSending = (session: Session, message: Message) => {
	session.messages.push(message);
	refreshSessions();
};

export const continueSession = (session: Session, message?: Message, forceSend: boolean = false) => {
	if (message && message.content) {
		session.messages.push(message);
		refreshSessions();
	}

	if (session.autorun || forceSend) {
		sendMessages(session);
	} else {
		session.busy = false;
		refreshSessions();
	}
};

export const resetSession = async (session: Session) => {
	session.messages = getInitialMessages(session.meta, session);
	session.busy = false;

	const sessionTaskDef = taskDefinitions.find((def) => def.type === session.meta.task.type);
	// @ts-expect-error having a sessionTaskDef proves this fn call is all valid
	await sessionTaskDef.initializeSession?.(session);

	refreshSessions();
};

export const closeSession = (session: Session) => {
	const idx = sessions.value.findIndex((s) => s === session);
	if (idx !== -1) {
		sessions.value.splice(idx, 1);
		refreshSessions();

		if (activeSession.value === session) {
			// load up the previous session, if any
			activeSession.value = sessions.value.at(idx - 1);
		}
	}
};

function getInitialMessages(meta: SessionMeta, session?: Session) {
	const typeDef = sessionDefinitions.find((def) => def.type === meta.type.type);
	// @ts-expect-error having a typeDef proves this fn call is all valid
	const systemMessage = typeDef?.getSystemMessage?.(meta, session);

	const messages: Session["messages"] = [];

	if (systemMessage) messages.push({ role: "system", content: systemMessage });

	messages.push({
		role: "assistant",
		content: `<think>Normally I would look back at the previous messages and reasons, determine the necessary action here, and anticipate future ones. However, this is the beginning of the conversation and there is no history to look at. I want to appear helpful and friendly, so I'll just ask how I can help.</think>
<?xml version="1.0" encoding="UTF-8"?>
<action reason="I want to provide a helpful response">
<speak>How can I help today?</speak>
</action>`,
		actions: [
			{
				reason: "I want to provide a helpful response",
				action: "speak",
				args: {},
				text: "How can I help today?",
			},
		],
		actionResults: [],
	});

	if (meta.type.type === "pairing") {
		if (meta.task.type === "freeform") {
			messages.push({
				role: "user",
				content: `<think>
We should focus on the task at hand, and not the project as a whole. I want to be friendly and helpful with who I am pairing with, so I will repeat the task details to them.
</think>
<?xml version="1.0" encoding="UTF-8"?>
<action reason="I want to be friendly, but make sure we focus on the task.">
<speak><![CDATA[Hi! I guess we should get started on our task. I'll repeat its details here:\n${meta.task?.title}\n---\n${meta.task?.description}]]></speak>
</action>`,
				think: "We should focus on the task at hand, and not the project as a whole. I want to be friendly and helpful with who I am pairing with, so I will repeat the task details to them.",
				actions: [
					{
						reason: "I want to be friendly, but make sure we focus on the task.",
						action: "speak",
						args: {},
						text: `Hi! I guess we should get started on our task. I'll repeat its details here:\n${meta.task?.title}\n---\n${meta.task?.description}`,
					},
				],
				actionResults: [],
			});
		} else if (meta.task.type === "review-pr") {
			messages.push({
				role: "user",
				content: `<think>
We should focus on the task at hand, and not the project as a whole. I want to be friendly and helpful with who I am pairing with, so I will repeat the task details to them.
</think>
<?xml version="1.0" encoding="UTF-8"?>
<action reason="I want to be friendly, but make sure we focus on the task.">
<speak><![CDATA[
Hi! I guess we should get started on our task. I'll repeat its details here:

${meta.task?.url}
---
${meta.task?.instructions ?? ""}

Remember that we need to make the best use of tasking to avoid overloading the context window. Let's begin by starting a new task for the first step: exploring the PR and understanding the problem space. The task should collect and return the PR title+description, and any linked issue(s).
]]></speak>
</action>`,
				think: "We should focus on the task at hand, and not the project as a whole. I want to be friendly and helpful with who I am pairing with, so I will repeat the task details to them.",
				actions: [
					{
						reason: "I want to provide a helpful response",
						action: "speak",
						args: {},
						text: `Hi! I guess we should get started on our task. I'll repeat its details here:

${meta.task?.url}
---
${meta.task?.instructions ?? ""}
`,
					},
				],
				actionResults: [],
			});
		}
	}

	return messages;
}

const flipRole = (role: MessageRole) => (role === "user" ? "assistant" : "user");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parser = new DOMParser();
const sendMessages = async (session: Session) => {
	session.busy = true;
	refreshSessions();

	await wait(250); // immediate auto-responses seem to hang the server

	/*
  tensorcors and flash attention tracking

  Qwen2.5-Coder-14B-Instruct-Q6_K_L.gguf

  flash attention appears to dramatically increase entropy in the conversation (avoids repetition)

  static, tensor, attention: 3s
  random, tensor, attention: 6s - jumps around quite a bit; slowish growth
  static, tensor: 6s; stable at 5.5->6.5s
  random, tensor: 4.5s; slow growth

  */

	const sessionTypeDef = sessionDefinitions.find((def) => def.type === session.meta.type.type);
	// @ts-expect-error having a sessionTypeDef proves this fn call is all valid
	const messages = sessionTypeDef?.preprocessMessages?.(session) ?? session.messages;

	const response = await fetch("http://10.0.0.77:5000/v1/chat/completions", {
		method: "POST",
		body: JSON.stringify({
			// https://github.com/oobabooga/text-generation-webui/blob/main/extensions/openai/typing.py#L55
			mode: "chat-instruct",
			context: getContext(session),
			messages: messages.map<SendableMessage>(({ role, content }) => ({ role, content })),
			max_tokens: 4096,
			temperature: 0.6,
			top_p: 1, // if not set to 1, select tokens with probabilities adding up to less than this number. Higher value = higher range of possible random results.
			min_p: 0.2, // Tokens with probability smaller than `(min_p) * (probability of the most likely token)` are discarded. This is the same as top_a but without squaring the probability.
			top_k: 1, // Similar to top_p, but select instead only the top_k most likely tokens. Higher value = higher range of possible random results.
			typical_p: 1, // If not set to 1, select only tokens that are at least this much more likely to appear than random tokens, given the prior text.
			tfs: 0.5, // Tries to detect a tail of low-probability tokens in the distribution and removes those tokens. See this [blog post](https://www.trentonbricken.com/Tail-Free-Sampling/) for details. The closer to 0, the more discarded tokens.
			repetition_penalty: 1.1, // Penalty factor for repeating prior tokens. 1 means no penalty, higher value = less repetition, lower value = more repetition.
			frequency_penalty: 0.0, // Repetition penalty that scales based on how many times the token has appeared in the context. Be careful with this; there's no limit to how much a token can be penalized.
			presence_penalty: 0.0, // Similar to repetition_penalty, but with an additive offset on the raw token scores instead of a multiplicative factor. It may generate better results. 0 means no penalty, higher value = less repetition, lower value = more repetition. Previously called "additive_repetition_penalty".

			// Qwen recommendations
			// repetition_penalty: 1.05,
			// temperature: 0.7,
			// top_p: 0.8,
			// top_k: 20,

			// me playing
			// temperature: 0.1, // stay pretty close to the most likely token
			// min_p: 0.6, // introduce some randomness
			// top_k: 20, // but confine it to the top 20 most likely tokens

			/*
        temperature: 0.7,
        top_p: 0.8, // if not set to 1, select tokens with probabilities adding up to less than this number. Higher value = higher range of possible random results.
        min_p: 0.5, // Tokens with probability smaller than `(min_p) * (probability of the most likely token)` are discarded. This is the same as top_a but without squaring the probability.
        top_k: 20, // Similar to top_p, but select instead only the top_k most likely tokens. Higher value = higher range of possible random results.
        typical_p: 1, // If not set to 1, select only tokens that are at least this much more likely to appear than random tokens, given the prior text.
        tfs: 0.5, // Tries to detect a tail of low-probability tokens in the distribution and removes those tokens. See this [blog post](https://www.trentonbricken.com/Tail-Free-Sampling/) for details. The closer to 0, the more discarded tokens.
        repetition_penalty: 1.1, // Penalty factor for repeating prior tokens. 1 means no penalty, higher value = less repetition, lower value = more repetition.
        frequency_penalty: 0.0, // Repetition penalty that scales based on how many times the token has appeared in the context. Be careful with this; there's no limit to how much a token can be penalized.
        presence_penalty: 0.0, // Similar to repetition_penalty, but with an additive offset on the raw token scores instead of a multiplicative factor. It may generate better results. 0 means no penalty, higher value = less repetition, lower value = more repetition. Previously called "additive_repetition_penalty".
        */

			grammar_string: `
# support deepseek r1 format (and compatible with other models), and then force the xml response payload:
# <think>...</think>
# <?xml version="1.0" encoding="UTF-8"?>
# <action reason="

# root specifies the pattern for the overall output
root ::= (
    # it must start with the characters "<think>" followed by some lines of thought,
    # followed by the closing "</think>" and a trailing newline
    "<think>\\n" think-line{1,} "</think>\\n"

    # then an XML declaration and start of document
    "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n"

    # finally the action block
    "<action reason=\\"" .{1,} "\\">"

    .+

    "</action>"
)

think-line ::= [^<]{25,} "\\n"
`,
			// @ts-expect-error having a sessionTypeDef proves this fn call is all valid
			...(sessionTypeDef?.getApiParams?.(session) ?? {}),
		}),
		headers: {
			"Content-Type": "application/json",
		},
	});

	const parsed = await response.json();
	session.tokensUsed = parsed.usage.total_tokens;
	refreshSessions();

	// @ts-expect-error having a sessionTypeDef proves this fn call is all valid
	const message = sessionTypeDef?.postprocessMessage?.(parsed.choices[0].message, session) ?? parsed.choices[0].message;

	const persistedMessage: Message = {
		role: message.role,
		content: message.content,
		actions: [],
		actionResults: [],
		think: "",
	};

	function respondWithError(msg: string) {
		addMessageWithoutSending(session, persistedMessage);
		continueSession(session, { role: flipRole(persistedMessage.role), content: msg });
	}

	// match two groups: think and xml
	// think is everything before the xml declaration
	const regexResult = message.content.match(/(?<think>.*?)(```xml[\r\n+](?<xml>.+)[\r\n+]```|(?<xml><\?xml.+))$/s);
	try {
		if (!regexResult) {
			respondWithError("Invalid response format, could not find xml declaraction");
			return;
		}

		// invariant
		regexResult.groups.think.length;
		regexResult.groups.xml.length;
	} catch (e) {
		respondWithError(`Invalid response format: ${(e as Error).message}`);
		return;
	}
	const { think, xml } = regexResult.groups;
	persistedMessage.think = think;

	let xmldoc;
	try {
		xmldoc = parser.parseFromString(xml, "text/xml");
	} catch (e) {
		respondWithError(`Error parsing XML: ${(e as Error).message}`);
		return;
	}

	// check invariants:
	// 1. there are no parser errors
	// 2. there is a root element named "action"
	// 3. it has a reason attribute
	const parserErrors = xmldoc.documentElement.querySelectorAll("parsererror");
	if (parserErrors.length) {
		const errorText = Array.from(parserErrors)
			.map((node) => node.textContent)
			.join("\n");
		respondWithError(`Error parsing XML:\n${errorText}`);
		return;
	}
	if (xmldoc.documentElement.nodeName !== "action") {
		respondWithError(`Invalid root element: found ${xmldoc.documentElement.nodeName}, expected "action"`);
		return;
	} else if (!xmldoc.documentElement.hasAttribute("reason")) {
		respondWithError(`Missing reason attribute on root element`);
		return;
	}

	const actionNodes = [xmldoc.documentElement];

	let actions = persistedMessage.actions!;
	let actionResults = persistedMessage.actionResults!;

	if (actionNodes[0].children.length > 1) {
		respondWithError("Multiple elements found inside <action />, only one item is allowed at a time");
		return;
	}

	// update with this message before executing actions
	session.messages.push(persistedMessage);
	refreshSessions();

	let actionStopsSession = false;
	try {
		for (let i = 0; i < actionNodes.length; i++) {
			const actionDef = actionNodeToObject(actionNodes[i]);
			actions.push(actionDef);

			if (actionDef.action === ("parsererror" as ActionType) /* error action type introduced by the parser api */) {
				respondWithError(xmldoc.documentElement.textContent ?? "");
				return;
			} else if (actionDef.action === "speak") {
				// not a real action
			} else if (actionDef.action === "task.success" || actionDef.action === "task.failure") {
				actionStopsSession = true;
				const sessionPromise = sessionPromises.get(session);
				if (sessionPromise) {
					if (actionDef.action === "task.success") {
						sessionPromise.resolve({ status: "success", result: actionDef.text });
					} else {
						sessionPromise.resolve({ status: "failed", result: actionDef.text });
					}
				}
			} else {
				try {
					actionResults.push(await executeAction(session, actionDef));
				} catch (e) {
					console.error(e);
					actionResults.push((e as Error & { content?: string }).content ? (e as { content: string }).content : `<error><![CDATA[${(e as Error).message}]]></error>`);
				}
			}
		}
	} catch (e) {
		console.error(e);
		respondWithError(`Error executing action: ${(e as Error).message}\n\nPlease reformat your XML and try again.`);
		return;
	}

	session.busy = false;
	refreshSessions();

	if (actionResults.length) {
		addMessageWithoutSending(session, {
			role: persistedMessage.role,
			content: `<result>
${actionResults[0]}
</result>
<llmTokenTracking>
  <used>${session.tokensUsed}</used>
  <max>${16384 - 4096}</max>
</llmTokenTracking>`,
		});
	}
	if (!actionStopsSession) {
		continueSession(session);
	}
};

function actionNodeToObject(node: HTMLElement): ActionNode {
	const reason = node.getAttribute("reason") ?? "";
	const actionNode = node.children[0];
	const action = actionNode.nodeName as ActionType;
	const text = actionNode.textContent ?? "";
	const args: Record<string, string> = {};
	for (let i = 0; i < actionNode.attributes.length; i++) {
		const attr = actionNode.attributes[i];
		args[attr.name] = attr.value;
	}
	return { reason, action, args, text };
}
