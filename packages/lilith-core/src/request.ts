export interface LLMMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface LLMResponseShape {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{ index: number; finish_reason: string; message: LLMMessage }>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: 180;
	};
}

interface LLMRequestOptions {
	mode?: 'chat' | 'chat-instruct';
	maxTokens?: number;
	temperature?: number;
	top_p?: number;
	min_p?: number;
	top_k?: number;
	typical_p?: number;
	tfs?: number;
	repetition_penalty?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	grammar?: string;
	[k: string]: number | string | undefined;
}
export interface LLMRequestResponse {
	response: LLMResponseShape;
	message: LLMMessage,
	result: string;
}
export async function llmRequest(context: string, messages: LLMMessage[], options: LLMRequestOptions = {}): Promise<LLMRequestResponse> {
	// making too many calls back-to-back gets an ECONNRESET error
	await new Promise(resolve => {
		setTimeout(resolve, 10);
	});

	const response = await fetch("http://127.0.0.1:5000/v1/chat/completions", {
		method: "POST",
		body: JSON.stringify({
			// https://github.com/oobabooga/text-generation-webui/blob/main/extensions/openai/typing.py#L55
			context,
			messages,
			mode: "instruct",

			// Qwen recommendations
			repetition_penalty: 1.05,
			presence_penalty: 1.5,
			temperature: 0.7,
			top_p: 0.8,
			top_k: 20,

			// me playing
			// temperature: 0.1, // stay pretty close to the most likely token
			// min_p: 0.6, // introduce some randomness
			// top_k: 20, // but confine it to the top 20 most likely tokens

			max_tokens: 4096,
			// temperature: 0.6,
			// top_p: 1, // if not set to 1, select tokens with probabilities adding up to less than this number. Higher value = higher range of possible random results.
			min_p: 0.2, // Tokens with probability smaller than `(min_p) * (probability of the most likely token)` are discarded. This is the same as top_a but without squaring the probability.
			// top_k: 1, // Similar to top_p, but select instead only the top_k most likely tokens. Higher value = higher range of possible random results.
			typical_p: 1, // If not set to 1, select only tokens that are at least this much more likely to appear than random tokens, given the prior text.
			tfs: 0.5, // Tries to detect a tail of low-probability tokens in the distribution and removes those tokens. See this [blog post](https://www.trentonbricken.com/Tail-Free-Sampling/) for details. The closer to 0, the more discarded tokens.
			// repetition_penalty: 1.1, // Penalty factor for repeating prior tokens. 1 means no penalty, higher value = less repetition, lower value = more repetition.
			frequency_penalty: 0.0, // Repetition penalty that scales based on how many times the token has appeared in the context. Be careful with this; there's no limit to how much a token can be penalized.
			// presence_penalty: 0.0, // Similar to repetition_penalty, but with an additive offset on the raw token scores instead of a multiplicative factor. It may generate better results. 0 means no penalty, higher value = less repetition, lower value = more repetition. Previously called "additive_repetition_penalty".

			...options,
		}),
		headers: {
			"Content-Type": "application/json",
		},
	});
	const parsedResponse: LLMResponseShape = await response.json();

	const body = parsedResponse.choices[0];
	const message = body.message;
	const result = message.content;

	return { response: parsedResponse, message, result };
}