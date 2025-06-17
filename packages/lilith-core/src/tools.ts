import type { ExecutionHistory } from './execute';

export interface Tool {
	name: string,
	description: string,
	runner: (input: string) => { result: string, history: ExecutionHistory };
}

export const calculator: Tool = {
	name: 'calculator',
	description: 'performs a calculation written in Javascript syntax',
	runner: equation => ({ result: `${eval(equation)}`, history: [] }),
}