import { registerComponent, Signal } from "@venajs/core";
import project, { sessions } from "./project.js";
import { executeAction, filterActionsByTypes, getActionsContext } from "./actions.js";

const commonStyles = `
border: 1px solid #e0e0e0;
border-width: 1px 0;
padding: 12px 0;
`

const ChatSessionConfig = registerComponent('l-chat-session-config', ({ render, element, refs }) => {
  Object.defineProperty(element, 'value', {
    get() {
      return {
        type: 'chat',
        who: refs.persona.value
      };
    }
  });

  render`
    <style>
      :host {
        display: block;
        ${commonStyles}
      }
    </style>
    Who do you want to chat with?
    <l-persona-selector id="persona"/>
  `;
});

const PairingSessionConfig = registerComponent('l-pairing-session-config', ({ render, element, refs }) => {
  Object.defineProperty(element, 'value', {
    get() {
      return {
        type: 'pairing',
        executor: refs.executor.value,
        pairer: refs.pairer.value,
      };
    }
  });

  render`
    <style>
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        ${commonStyles}
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

export const sessionDefinitions = [
  {
    type: 'chat',
    configElement: ChatSessionConfig,
    getSystemMessage({ who }) {
      return `You are a helpful assistant named ${who.name}.`;
    },
    getContext({ who }) {
      return `
The following is an interaction log between ${who.name} and their boss. They are working on the following project:

Project name: ${project.name}
Project is located at: ${project.directory}

## About

${project.context}

## Existing issues

${project.issues.value.map(({ id, name, closed }) => `* (${id}) ${name}${closed ? ' (closed)' : ' (open)'}`).join('\n')}

## Knowledge base

${project.knowledgeBase ?? "no knowledge base set"}

# Messaging
    
${getActionsContext()}

Notice how intelligent and concise ${who.name} is, applying their wealth of experience and insight to deal with any issue.
However, when getting stuck in a task they ask for input, never making something up.
They are a self-starter, using the available tools and actions to solve problems and understand hurdles, iterating to get to the right solution.
      `.trim();
    }
  },
  {
    type: 'pairing',
    configElement: PairingSessionConfig,
  },
];

function refreshSessions() {
  sessions.dirty = true;
  activeSession.dirty = true;
}

export const activeSession = new Signal(sessions.value[0]);

export const startSession = (parent, type, config) => {
  const sessionDef = sessionDefinitions.find(session => session.type === type);

  const meta = {
    parent,
    type,
    context: sessionDef.getContext(config),
    config,
  };

  const session = {
    meta,
    messages: getInitialMessages(sessionDef.getSystemMessage(config)),

    busy: false,
    autorun: type !== 'chat',
    tokensUsed: null,
  };
  sessions.push(session);
  return session;
}

export const addMessageWithoutSending = (session, message) => {
  session.messages.push(message);
  refreshSessions();
}

export const continueSession = (session, message, forceSend) => {
  if (message.content) {
    session.messages.push(message);
    refreshSessions();
  }

  if (session.autorun || forceSend) {
    sendMessages(session);
  }
}

export const resetSession = (session) => {
  const sessionDef = sessionDefinitions.find(sessionDef => sessionDef.type === session.meta.type);
  session.messages = getInitialMessages(sessionDef.getSystemMessage(session.meta.config));
  refreshSessions();
}

export const closeSession = (session) => {
  const idx = sessions.value.findIndex(s => s === session);
  if (idx !== -1) {
    sessions.value.splice(idx, 1);
    refreshSessions();
  }
}

function getInitialMessages(systemMessage) {
  const messages = [];

  if (systemMessage) messages.push({ role: 'system', content: systemMessage });

  messages.push({
    role: 'assistant',
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
        text: "How can I help today?"
      }
    ],
    actionResults: []
  });

  return messages;
}

const parser = new DOMParser();
const sendMessages = async (session) => {
  session.busy = true;
  refreshSessions();

  const sessionDef = sessionDefinitions.find(def => def.type === session.meta.type);

  const response = await fetch(
    'http://10.0.0.77:5000/v1/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        // https://github.com/oobabooga/text-generation-webui/blob/main/extensions/openai/typing.py#L55
        mode: "chat-instruct",
        context: session.meta.context,
        messages: session.messages,
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

        // stop: ["</action>"],

        grammar_string: `
# support deepseek r1 format (and compatible with other models), and then force the xml response payload:
# <think>...</think>
# <?xml version="1.0" encoding="UTF-8"?>
# <action reason="

# root specifies the pattern for the overall output
root ::= (
    # it must start with the characters "<think>" followed by some lines of thought,
    # followed by the closing "</think>" and a trailing newline
    "<think>\\n" think-line{1,5} "</think>\\n"

    # then an XML declaration and start of document
    "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n"

    # finally the action block
    "<action reason=\\"" .{10,100} "\\">"

    .+

    "</action>"
)

think-line ::= [^<]{25,100} "\\n"
`,
        ...(sessionDef.getApiParams?.(session.meta, session) ?? {}),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const parsed = await response.json();
  session.tokensUsed = parsed.usage.total_tokens;
  refreshSessions();

  const message = parsed.choices[0].message;
  // message.content += "</action>" // re-add since it's a stop word;

  const persistedMessage = {
    role: message.role,
    content: message.content,
    actions: [],
    actionResults: [],
    think: '',
  };

  function respondWithError(msg) {
    addMessageWithoutSending(session, persistedMessage);
    continueSession(session, { role: 'user', content: msg }, true /* force it to send */);
  }

  // match two groups: think and xml
  // think is everything before the xml declaration
  const regexResult = message.content.match(/(?<think>.*?)(```xml[\r\n+](?<xml>.+)[\r\n+]```|(?<xml><\?xml.+))$/s);
  try {
    if (!regexResult) {
      respondWithError('Invalid response format, could not find xml declaraction');
      return;
    }

    // invariant
    regexResult.groups.think.length;
    regexResult.groups.xml.length;
  } catch (e) {
    respondWithError(`Invalid response format: ${e.message}`);
    return;
  }
  const { think, xml } = regexResult.groups;
  persistedMessage.think = think;

  let xmldoc;
  try {
    xmldoc = parser.parseFromString(xml, 'text/xml');
  } catch (e) {
    respondWithError(`Error parsing XML: ${e.message}`);
    return;
  }

  // check invariants:
  // 1. there is a root element named "action"
  // 2. it has a reason attribute
  if (xmldoc.documentElement.nodeName !== 'action') {
    respondWithError(`Invalid root element: found ${xmldoc.documentElement.nodeName}, expected "action"`);
    return;
  } else if (!xmldoc.documentElement.hasAttribute('reason')) {
    respondWithError(`Missing reason attribute on root element`);
    return;
  }

  const actionNodes = [xmldoc.documentElement];

  let actions = persistedMessage.actions;
  let actionResults = persistedMessage.actionResults;
  let speakResults = '';

  if (actionNodes[0].children.length > 1) {
    respondWithError('Multiple elements found inside <action />, only one item is allowed at a time');
    return;
  }

  for (let i = 0; i < actionNodes.length; i++) {
    const actionDef = actionNodeToObject(actionNodes[i]);
    actions.push(actionDef);

    if (actionDef.action === 'parsererror') {
      respondWithError(xmldoc.documentElement.textContent);
      return;
    } else if (actionDef.action === 'speak') {
      speakResults += actionDef.text + '\n';
    } else if (actionDef.action === 'complete') {
      speakResults += '-=: assistant has ended the conversation :=-'
    } else {
      try {
        actionResults.push(await executeAction(session, actionDef));
      } catch (e) {
        console.error(e);
        actionResults.push(`Error: ${e.message}`);
      }
    }
  }

  session.messages.push(persistedMessage);
  session.busy = false;
  refreshSessions();

  if (actionResults.length) {
    addMessageWithoutSending(
      session,
      {
        role: 'user',
        content: `action results\n----------\n${actionResults.join('\n----------\n')}`
      }
    );
  }
  continueSession(session);
}

function actionNodeToObject(node) {
  const reason = node.getAttribute('reason');
  const actionNode = node.children[0];
  const action = actionNode.nodeName;
  const text = actionNode.textContent;
  const args = {};
  for (let i = 0; i < actionNode.attributes.length; i++) {
    const attr = actionNode.attributes[i];
    args[attr.name] = attr.value;
  }
  return { reason, action, args, text };
}