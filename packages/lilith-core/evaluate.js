import { execute } from './build/index.js';
import { planner, planManager, programmer, executor } from './build/persona.js';
import { calculator } from './build/tools.js';

// const result = await execute({
// 	persona: planner,
// 	prompt: 'I need a plan that describes building a calculator webapp. This is a simple app, there is no need for upfront planning, designs, etc. This is a stand-alone side project to demonstrate the efficiency of AI coding.',
// 	availablePersonas: [],
// });
// console.log(result.message.content);

// const result = await execute({
// 	persona: planManager,
// 	prompt: 'Follow this plan:\n\n' + getPlan('calculator'),
// 	availablePersonas: [programmer]
// });
// console.log(result.message.content);

const result = await execute({
	persona: executor,
	prompt: `
{
current_line=1
}
1: find the first 5 fibonacci numbers
2: square each number
3: add the sum of the first 2 squares together
4: add the sum of the last 3 squares together
5: subtract the first sum from the second  
6: create a javascript terminal app that asks the user to guess a number, and only reports they are correct if they guess the result from the previous step
  `,
	availablePersonas: [programmer],
	availableTools: [calculator],
});


function getPlan(id) {
	return {
		calculator: `1. Set up a new directory for the calculator webapp project
2. Initialize a new Git repository in the project directory
3. Create an HTML file named \`index.html\`
4. Add basic HTML structure to \`index.html\` including \`<!DOCTYPE html>\`, \`<html>\`, \`<head>\`, and \`<body>\` tags
5. Inside the \`<head>\` tag, add a \`<title>\` element with the text "Simple Calculator"
6. Inside the \`<body>\` tag, create a \`<div>\` element with an id of "calculator"
7. Within the "calculator" div, add an \`<input>\` element of type "text" with an id of "display" for showing calculations
8. Below the display input, add buttons for digits 0-9 using \`<button>\` elements within the "calculator" div
9. Add operation buttons (+, -, *, /) next to the digit buttons inside the "calculator" div
10. Include an equals button (=) and a clear button (C) at the bottom of the button grid inside the "calculator" div
11. Create a CSS file named \`styles.css\`
12. Link the \`styles.css\` file to the \`index.html\` file within the \`<head>\` section using a \`<link>\` tag
13. In \`styles.css\`, style the body to have a font-family of Arial and center the calculator div horizontally
14. Style the calculator div to have a border, padding, and background color
15. Style the display input to span the full width of the calculator div and have appropriate padding and font size
16. Style the buttons to have consistent sizing, spacing, and hover effects
17. Create a JavaScript file named \`script.js\`
18. Link the \`script.js\` file to the \`index.html\` file just before the closing \`</body>\` tag using a \`<script>\` tag
19. In \`script.js\`, declare variables for the display input and all buttons
20. Add event listeners to each button to handle click events
21. Implement logic in the click event handlers to update the display input based on button clicks
22. Write functions for addition, subtraction, multiplication, and division operations in \`script.js\`
23. Implement logic to evaluate expressions when the equals button is clicked
24. Add functionality to clear the display input when the clear button is clicked
25. Test the calculator webapp thoroughly to ensure all buttons work correctly and perform expected operations
26. Commit changes to the Git repository with a descriptive commit message
27. Push the committed changes to a remote Git repository if desired`,
	}[id];
}