import { llmRequest, LLMRequestResponse } from './request.js';
import { InvariantCheck, parseXml } from './parseXml.js';
import type { Persona } from './persona.js';
import type { Tool } from './tools.js';

interface Usage {
	result: string;
	history: ExecutionHistory[];
}

interface ToolUsage extends Usage {
	tool: Tool;
	input: string;
}
interface AgentUsage extends Usage {
	agent: Persona;
	prompt: string;
}
export type ExecutionHistory = Array<ToolUsage | AgentUsage>

interface ExecuteOptions {
	persona: Persona;
	prompt: string;
}
interface ExecuteResponseShape {
	history: ExecutionHistory;
	llmResponse: LLMRequestResponse;
}
export async function execute({ persona, prompt }: ExecuteOptions): Promise<ExecuteResponseShape> {
	prompt = prompt.trim();

	const { availableDelegations, availableTools } = persona;
	let { context } = persona;

	if (availableDelegations.length) {
		context += `
---
The following AI agents are available to delegate to:
${availableDelegations.map(persona => `* ${persona.name} - ${persona.description}\n`)}

To delegate to an agent you must respond with exactly an XML document of the format:
<agent_delegation><agent_name>Name of target agent</agent_name><input>... agent prompt ...</input></agent_delegation>

e.g.

<agent_delegation><agent_name>Cat expert</agent_name><input>What is the best way to calm a kitten?</input></agent_delegation>
---
		`;
	} else {
		context += '\n---\nThere are no available agents to delegate to.\n---\n'
	}
	if (availableTools.length) {
		context += `
---
The following tools are available to use:
${availableTools.map(tool => `* ${tool.name} - ${tool.description}\n`)}

To use a tool you must respond with exactly an XML document of the format:
<tool_use><tool_name>Name of target tool</tool_name><input>... tool input ...</input></tool_use>

e.g.

<tool_use><tool_name>retrieve_tweets</tool_name><input><account>myaccount@example.com</account></input></tool_use>
---
		`;
	} else {
		context += '\n---\nThere are no available tools to use.\n---\n'
	}

	context += `
After calling an agent or tool their response will be provided to you as additional input, and you will be able to continue iterating with agents/tools or decide to update the program state for the next execution cycle.

When you have the information to finish the task you will report back with the <result></result> tag:

<result>the final result here</result>

Results should attempt to be terse but with differentiating information. For example, if the task is "count the apples" the result could be <result>5</result>, but if more information is available and appears relevant to the task then it should be provided: <result>5 apples, but 3 are rotten and should not be used</result> provides the asked-for answer but also understands that the requester may be assuming the result is how many "good" apples are present.
	`;

	const executionHistory: ExecutionHistory = [];
	const errors: string[] = [];
	while (true) {
		let currentPrompt = prompt;

		// add history to context
		if (executionHistory.length) {
			currentPrompt += `\n---
For guidance, these steps have been taken so far in this task:
${executionHistory.map(historyItem => {
	if ("tool" in historyItem) {
		return `* tool ${historyItem.tool.name}
\t* input: ${historyItem.input}
\t* result: ${historyItem.result}`;
	} else if ("agent" in historyItem) {
		return `* agent ${historyItem.agent.name}
\t* input: ${historyItem.prompt}
\t* result: ${historyItem.result}`;
	}
}).join('\n')}
---`;
		}

		// add errors to context
		if (errors.length) {
			currentPrompt += `\n---
For guidance, these error(s) have been encountered while previously performing this step:
${errors.map(error => `* ${error}`).join('\\n')}
---`;
		}

		const llmResponse = await llmRequest(
			context,
			[{ role: 'user', content: currentPrompt }]
		);

		console.log(llmResponse.result);
		debugger;
		try {
			const xml = parseXml(
				llmResponse.result,
				[
					invariant_one_tag,
					invariant_known_top_level_tag,
					invariant_agent_delegation.bind(undefined, availableDelegations),
					invariant_tool_use.bind(undefined, availableTools),
					invariant_result,
				]
			);

			const cmd = Object.keys(xml)[0];
			switch (cmd) {
				case 'agent_delegation': {
					const agentDelegation = (xml as AgentDelegationShape).agent_delegation!;
					const agentName = agentDelegation.agent_name;
					const agentInput = agentDelegation.input;

					const agent = availableDelegations.find(({ name }) => name === agentName)!;
					const result = await execute({
						persona: agent,
						prompt: agentInput,
					});

					executionHistory.push({ agent, prompt: agentInput, result: result.llmResponse.result, history: result.history });

					break;
				}
				case 'tool_use': {
					const toolDelegation = (xml as ToolUseShape).tool_use!;
					const toolName = toolDelegation.tool_name;
					const toolInput = toolDelegation.input;

					const tool = availableTools.find(({ name }) => name === toolName)!;
					const { result, history } = tool.runner(toolInput);
					executionHistory.push({ tool, input: toolInput, result, history });

					break;
				}

				case 'result': {
					const formattedResult = (xml as { result: string }).result; // remove the wrapping `result` tags
					const onResultResult = persona.onResult?.(prompt, formattedResult);
					if (onResultResult !== undefined) {
						prompt = onResultResult;
					} else {
						return {
							llmResponse: {
								...llmResponse,
								result: formattedResult,
							},
							history: executionHistory,
						};
					}
				}
			}
		} catch(e) {
			errors.push((e as Error).message);
		}
	}
}

// invariants
const invariant_one_tag: InvariantCheck = (x) => {
	const topLevelTags = Object.keys(x);
	if (topLevelTags.length !== 1) throw new Error(`exactly one top-level tag expected, ${topLevelTags.length} found: ${topLevelTags.join(', ')}`);
}

const invariant_known_top_level_tag: InvariantCheck = (x) => {
	const topLevelTag = Object.keys(x)[0];
	const knownTags = ['agent_delegation', 'tool_use', 'result'];
	if (!knownTags.includes(topLevelTag)) throw new Error(`found top-level tag "${topLevelTag}", but expected one of ${knownTags.map(x => `"${x}"`).join(', ')}`);
}

interface AgentDelegationShape {
	agent_delegation?: {
		agent_name: string;
		input: string;
	}
}
const invariant_agent_delegation = (availablePersonas: Persona[], x: AgentDelegationShape) => {
	if ('agent_delegation' in x) {
		const { agent_name, input } = x.agent_delegation!;
		if (typeof agent_name !== 'string') throw new Error(`agent_name expected to be string, got ${typeof agent_name}`);
		if (typeof input !== 'string') throw new Error(`input expected to be string, got ${typeof input}`);

		if (!(availablePersonas.map(({ name }) => name)).includes(agent_name)) {
			throw new Error(`Invalid agent_name, got "${agent_name}" but expected one of ${availablePersonas.map(({ name }) => `"${name}"`).join(', ')}`)
		}
	}
}

interface ToolUseShape {
	tool_use?: {
		tool_name: string;
		input: string;
	}
}
const invariant_tool_use = (availableTools: Tool[], x: ToolUseShape) => {
	if ('tool_use' in x) {
		const { tool_name, input } = x.tool_use!;
		if (typeof tool_name !== 'string') throw new Error(`tool_name expected to be string, got ${typeof tool_name}`);
		if (typeof input !== 'string') throw new Error(`input expected to be string, got ${typeof input}`);

		if (!(availableTools.map(({ name }) => name)).includes(tool_name)) {
			throw new Error(`Invalid agent_name, got "${tool_name}" but expected one of ${availableTools.map(({ name }) => `"${name}"`).join(', ')}`)
		}
	}
}

interface ProgramStateShape {
	result?: string;
}
const invariant_result: InvariantCheck = (x: ProgramStateShape) => {
	if ('result' in x) {
		const { result } = x;
		if (typeof result !== 'string') throw new Error(`result expected to be string, got ${typeof result}`);
	}
}