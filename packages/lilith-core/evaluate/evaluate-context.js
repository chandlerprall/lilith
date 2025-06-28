import { writeFileSync } from 'fs';
import { llmRequest } from '../build/index.js';
import { executor as executorContext } from '../build/contexts/index.js';

// // console.log(context);
// // process.exit()
//
// // const prompt = `Take some time to think about your instructions, then make specific recommendations to improve them - help align them to your training data to 1. improve accuracy 2. ideally decrease the length of the instructions`;
// // const prompt = `Given your instructions, come up with a small program (around 5 lines for the script) for testing.`;
const prompt_charlie = `
\`\`\`program
current_line=2
names_list=Alice,Bob,Charlie,Diana,Eve
selected_name=Charlie
1: pick a random name from the list
2: generate a greeting message
3: respond with the greeting
\`\`\``;
const prompt_calculator = `
\`\`\`program
current_line=3
triangle_numbers=1,3,6,10
squared_numbers=1,9,36,100
1: take the first four triangle numbers
2: square each number
3: find the average of the squares
\`\`\``;

const prompt_dns = `
\`\`\`program
current_line=1
1: ask the user for a website domain
2: retrieve the A records of the domain
3: retrieve the MX records of the domain
4: retrieve the CNAME records of the domain
5: retrieve the TXT records of the domain
6: display all retrieved records to the user
\`\`\``;

const prompt_create_plan_for_dns = `Create a script to retrieve the DNS records of a website specified by the user`;

const prompt = prompt_dns;
const context = executorContext;

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