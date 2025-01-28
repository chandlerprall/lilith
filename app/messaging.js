import { ProxySignal, Signal } from '@venajs/core';
import project from './project.js';
import { actionContext, executeAction } from './actions.js';

export const isBusy = new Signal(false);

function generateContext() {
  return `The following is an interface log between a staff software engineer and their boss.

They are working on the following project

# ${project.name}

## About

${project.context}


## Existing issues

${project.issues.value.map(({ id, name, closed }) => `* (${id}) ${name}${closed ? ' (closed)' : ' (open)'}`).join('\n')}

# Messaging
    
All of the engineer's responses always start with their reasoned thought on the request, followed by a valid JSON array indicating the responses and/or actions to take. The free text before the JSON array is like a scratch pad the engineer can use to keep track of their thoughts. The JSON array objects have the shape:

\`\`\`typescript
interface SpeakResponse {
  type: "speak";
  response: string;
}
interface ActionResponse {
  type: "action";
  action: Action;
}

${actionContext}

type Response = Array<SpeakResponse | ActionResponse>;
\`\`\`

SpeakResponse responses are delivered back to the engineer's boss for him to respond, while the results of actions are delivered back to the staff engineer for them to continue on.

Notice how intelligent and concise the staff eng is, applying their wealth of experience and insight to deal with any issue.`;
}

export const messages = new ProxySignal([
  {
    role: 'system',
    extracted: '[context]',
    content: ''
  },
  {
    role: 'assistant',
    extracted: 'How can I help today?',
    content: `I want to appear friendly, helpful, and cheerful to my boss. I should greet them and offer my help.

[
  {
    "type": "speak",
    "response": "How can I help today?"
  }
]`
  }
]);

export const sendMessages = async () => {
  isBusy.value = true;

  messages.value[0].content = generateContext();

  const response = await fetch(
    'http://10.0.0.77:5000/v1/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        mode: "instruct",
        character: "StaffEngineer_json",
        messages: messages.value,
        max_tokens: 4096,
        temperature: 0.0, // temperature is randomness
        top_p: 1,
        top_k: 1,
        typical_p: 1,
        tfs: 1,
        frequency_penalty: 0.0,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const parsed = await response.json();
  const message = parsed.choices[0].message;

  const persistedMessage = {
    role: message.role,
    content: message.content,
    extracted: message.content,
    actions: [],
    actionResults: [],
  };
  messages.push(persistedMessage);

  let actionResults = persistedMessage.actionResults;
  let speakResults = '';
  // reverse parse the JSON array at the end of the message content
  const trimmedMessage = message.content.trim();
  if (trimmedMessage[trimmedMessage.length - 1] !== ']') {
    sendMessage('The JSON array at the end of the message is malformed (no closing bracket)');
    return;
  }
  let json = '';
  let openBrackets = 0; // only need to track brackets, it must be a valid JSON array
  for (let i = trimmedMessage.length - 1; i >= 0; i--) {
    if (trimmedMessage[i] === ']') {
      openBrackets++;
    } else if (trimmedMessage[i] === '[') {
      openBrackets--;
    }
    json = trimmedMessage[i] + json;
    if (openBrackets === 0) {
      break;
    }
  }

  let actions;
  try {
    actions = JSON.parse(json);
  } catch (error) {
    sendMessage(`The JSON array at the end of the message is malformed:\n${error.stack}`);
    return;
  }

  for (let i = 0; i < actions.length; i++) {
    const entry = actions[i];
    if (entry.type === "speak") {
      speakResults += actions[i].response + '\n';
    } else if (entry.type === "action") {
      try {
        actionResults.push(await executeAction(entry.action));
      } catch (e) {
        console.error(e);
        actionResults.push(`Error: ${e.message}`);
      }
    }
  }

  persistedMessage.extracted = speakResults;
  persistedMessage.actions = actions;
  persistedMessage.actionResults = actionResults;

  isBusy.value = false;

  if (actionResults.length) {
    sendMessage(`action results\n----------\n${actionResults.join('\n----------\n')}`);
  }
}

export const sendMessage = async content => {
  messages.push({ role: 'user', content });
  sendMessages();
}
