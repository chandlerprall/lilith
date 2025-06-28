import { writeFileSync } from 'fs';
import { llmRequest } from '../build/index.js';
import { executor as executorContext } from '../build/contexts/index.js';

const context = executorContext;

// prompt for plan
const prompt_create_plan_for_dns = `Create a script to retrieve the DNS records of a website specified by the user`;
const prompt_dns = void(0);

// prompt for execution

const variations = {
	instruct: {
		mode: 'instruct',
		messageHistory: [{ role: 'system', content: context }],
	},
	instruct_nocontext: {
		mode: 'instruct',
		messageHistory: [{ role: 'system', content: context }],
		context: undefined,
	},

	// ** Sneakily bad at following direction
	// chatinstruct_context_only: {
	// 	mode: 'chat-instruct',
	// 	messageHistory: [],
	// },

	// ** Reliably bad at following direction
	// chatinstruct_no_context: {
	// 	mode: 'chat-instruct',
	// 	messageHistory: [{ role: 'system', content: context }],
	// 	context: undefined,
	// },
	chatinstruct_context_and_history: {
		mode: 'chat-instruct',
		messageHistory: [{ role: 'system', content: context }],
	},
	// no `mode: 'chat'` because those are chatty and don't follow response shape direction
}

const seeds = [2691616148, 3144772383, 1707607805,
	3057556176, 436137364, 1163482581, 4225306958, 3825201850, 609290361,  994669050
];
evaluate();

async function evaluate() {
	const results = {};

	for (const [variationName, variationDetails] of Object.entries(variations)) {
		const variationResults = results[variationName] = {};

		const { messageHistory = [], ...variationOptions } = variationDetails;
		const messages = [...messageHistory, { role: 'user', content: prompt }];

		for (let seed of seeds) {
			const { result } = await llmRequest(context, messages, { seed, enable_thinking: false, ...variationOptions });
			variationResults[seed] = result;
		}

		console.log(Object.keys(results).length, ' / ', Object.keys(variations).length)
	}

	const resultsBySeed = {};
	seeds.forEach(seed => {
		const seedResults = {};

		Object.entries(results).forEach(([variation, results]) => {
			seedResults[variation] = results[seed];
		})

		resultsBySeed[seed] = seedResults;
	})

	saveTemplate('results.html', resultsBySeed);
}

function saveTemplate(filePath, results) {
	writeFileSync(
		filePath,
`<!DOCTYPE html>
<html>
<head>
<style>
td {
	vertical-align: top;
}
</style>
</head>
<body>
<table>
${Object.entries(results).map(([heading, results]) => {
	const rows = [];
	
	rows.push(`<tr><td>${heading}</td><td></td><td></td></tr>`);
	Object.entries(results).forEach(([label, result]) => {
		rows.push(`<tr><td></td><td>${label}</td><td><pre>${result.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre></td></tr>`);
	});
	
	return rows;
}).flat(Infinity).join('\n')}
</table>
</body>
</html>`
	);
}