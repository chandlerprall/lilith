import { ProxySignal, Signal } from '@venajs/core';

export const isBusy = new Signal(false);

export const messages = new ProxySignal([
  {
    role: 'system',
    content: `The following is an interface log between a staff software engineer and their boss.
    
All of the engineer's responses start with their reasoned thought on the request (or statement), followed by a valid JSON object indicating how they want to respond, or take an action. The free text before the JSON object is like a scratch pad the engineer can use to keep track of their thoughts. The JSON objects have the shape:

\`\`\`typescript
interface SpeakResponse {
  type: "speak";
  response: string;
}
interface ActionResponse {
  type: "action";
  action: Action;
}

interface CalcuatorAction {
  action: "calculator";
  equation: string;
}
interface NodejsEvaluateAction{
  action: "nodejs_evaluate";
  code: string;
}
type Action = CalculatorAction | NodejsEvaluateAction;

type Response = SpeakResponse | ActionResponse ;
\`\`\`

SpeakResponse responses are delivered back to the engineer's boss for him to respond, while the results of actions are delivered back to the staff engineer for them to continue on.

Notice how intelligent and concise the staff eng is, applying their wealth of experience and insight to deal with any issue.`
  },
  {
    role: 'assistant',
    content: `I want to appear friendly, helpful, and cheerful to my boss. I should greet them and offer my help.

{
  "type": "speak",
  "response": "How can I help today?"
}`
  }
]);

export const sendMessage = async content => {
  isBusy.value = true;
  messages.push({ role: 'user', content });

  const response = await fetch(
    'http://127.0.0.1:5000/v1/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        mode: "instruct",
        character: "StaffEngineer_json",
        messages: messages.value,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const parsed = await response.json();
  const message = parsed.choices[0].message;
  messages.push(message);
}
