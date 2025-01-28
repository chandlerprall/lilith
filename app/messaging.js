import { ProxySignal, Signal } from '@venajs/core';
import project, { clearLog, updateLog } from './project.js';
import { actionContext, executeAction } from './actions.js';

export const isBusy = new Signal(false);

function generateContext() {
  return `The following is an interface log between a staff software engineer and their boss.

They are working on the following project

# ${project.name}

Files are located at ${project.directory}

## About

${project.context}


## Existing issues

${project.issues.value.map(({ id, name, closed }) => `* (${id}) ${name}${closed ? ' (closed)' : ' (open)'}`).join('\n')}

# Messaging
    
All of the engineer's responses are a valid JSON array containing the responses and/or actions to take. There is no free text before or after the JSON array. The JSON array contains objects with the shape:

\`\`\`typescript
interface SpeakResponse {
  type: "speak";
  reason: string; // describe the thought behind or reason for saying this
  response: string;
}
interface ActionResponse {
  type: "action";
  reason: string; // describe the thought behind or reason for taking this action
  action: Action;
}

${actionContext}

type Response = Array<SpeakResponse | ActionResponse>;
\`\`\`

SpeakResponse responses are delivered back to the engineer's boss for him to respond, while the results of actions are delivered back to the staff engineer for them to continue on.

Notice how intelligent and concise the staff eng is, applying their wealth of experience and insight to deal with any issue.`;
}

export const messages = new ProxySignal(getInitialMessages());
messages.push(...project.log);

export const sendMessages = async () => {
  isBusy.value = true;

  messages.value[0].content = generateContext();

  const response = await fetch(
    'http://10.0.0.77:5000/v1/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        mode: "instruct",
        messages: messages.value,
        max_tokens: 4096,
        temperature: 0.0,
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

  let actionResults = persistedMessage.actionResults;
  let speakResults = '';
  const trimmedMessage = message.content.trim();
  let actions;
  try {
    actions = JSON.parse(trimmedMessage);
  } catch (error) {
    messages.push(persistedMessage);
    updateLog(persistedMessage);
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

  messages.push(persistedMessage);
  updateLog(persistedMessage);
  isBusy.value = false;

  if (actionResults.length) {
    sendMessage(`action results\n----------\n${actionResults.join('\n----------\n')}`);
    return;
  }
}

export const sendMessage = async content => {
  const message = { role: 'user', content };
  updateLog(message);
  messages.push(message);
  sendMessages();
}

export const resetMessages = () => {
  messages.value = getInitialMessages();
  project.log.value = [];
  clearLog();
}

function getInitialMessages() {
  return [
    {
      role: 'system',
      extracted: '[context]',
      content: ''
    },
    {
      role: 'assistant',
      extracted: 'How can I help today?',
      content: `[
    {
      "type": "speak",
      "reason": "I want to appear friendly, helpful, and cheerful to my boss. I should greet them and offer my help.",
      "response": "How can I help today?"
    }
  ]`
    }
  ]
}