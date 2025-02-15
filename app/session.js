import { registerComponent, Signal } from "@venajs/core";
import project, { sessions } from "./project.js";
import { executeAction, getActionsContext } from "./actions.js";
import { taskDefinitions } from "./tasks.js";

const sessionPromises = new Map();

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

function getTaskTitle(session) {
  switch (session.meta.task.type) {
    case 'none':
      return '[no task for this session, follow the user\'s lead]';
    case 'freeform':
      return session.meta.task.title;
    default:
      return `[task type "${session.meta.task.type}" not understood, please report this to a supervisor ASAP]`;
  }
}

function getTaskContext(session) {
  let task;

  switch (session.meta.task.type) {
    case 'none':
      task = '[no task for this session, follow the user\'s lead]';
      break;

    case 'freeform':
      task = `
**${session.meta.task.title}**

${session.meta.task.description}
      `;
      break;

    default:
      task = `[task type "${session.meta.task.type}" not understood, please report this to a supervisor ASAP]`;
      break;
  }

  let parentStack = [];
  let parent = session.meta.parent;
  while (parent) {
    parentStack.unshift(getTaskTitle(parent));
    parent = parent.meta.parent;
  }

  if (parentStack.length) {
    return `${task}\n\n# Which has the parent tasks:\n${parentStack.join('\n')}`;
  } else {
    return task;
  }
}

function getContext(session) {
  let introduction;

  switch (session.meta.type.type) {
    case 'chat':
      introduction = `The following is an interaction log between ${session.meta.type.who.name} and their boss.`;
      break;
    case 'pairing':
      introduction = `The following is an interaction log between ${session.meta.type.executor.name} and ${session.meta.type.pairer.name}.`;
      break;
  }

  return `
${introduction}

# Project description

Name: ${project.name}
Directory: ${project.directory}

${project.context}

While the project as a whole is important to keep in mind, the task at hand is the most important thing to focus on. Make sure you dedicate actions to the task at hand, and not the project as a whole.

# Task

This conversation takes place in the context of the above project. More specifically, this conversation is about the task:

${getTaskContext(session)}

## Task completion

The intention of breaking operations into discrete tasks is to help the AI LLM agent focus on the task at hand. If the message history grows too long it will cause slow downs and eventually information dropping out of the context window.
Due to the this, to help faciliate your current task it may be necessary to create new tasks. To do this, use the \`task.create\` action and include information about the task you want to create.
If you need information that will likely span multiple actions or process lengths of content, it is best to split those into smaller tasks and compose the results.

Do not over-optimize for this, e.g. creating tasks for every thing, as that will lead to a task creating a task creating a task creating a task, all tasked with the same thing without ever achieving a result.

### Creating new tasks

Be explicit in what you need returned from the task. For example, asking for "a javascript function" that adds two numbers may result in the function being authored and saved to a file, instead of responding with the function body.
Instead, explicitly ask for "a javascript function" be returned as the task result. It's also important to remember LLMs halucinate and err on being overly agreeable, it is important to either have the task verify the output, or check yourself.

### Completion

To complete the task, use the \`task.complete\` action and include information completing the task. Do not take actions that are not neccessary for returning the requisite information.

### Failure

If you cannot fulfill the task for any reason, use the \`task.failure\` action and include information explaining why the task failed.

# Messages

## Format

${getActionsContext()}

## Content

Notice how intelligent and concise both parties are, applying their wealth of experience and insight to deal with any issue.
However, when getting stuck in a task they ask for input, never making something up.
They are self-starters, using the available tools and actions to solve problems and understand hurdles, iterating to find the right solution.
        `.trim();
}

export const sessionDefinitions = [
  {
    type: 'chat',
    configElement: ChatSessionConfig,
    getSystemMessage({ type: { who } }) {
      return `You are Qwen, created by Alibaba Cloud. You are a helpful assistant.

You must respond and act as if you are a person named ${who.name}: ${who.bio}`;
    }
  },
  {
    type: 'pairing',
    configElement: PairingSessionConfig,
    getSystemMessage({ type: { executor, pairer } }) {
      return `You are a helpful assistant named ${executor.name} and you are paired with ${pairer.name}.`;
    }
  },
];

function refreshSessions() {
  sessions.dirty = true;
  activeSession.dirty = true;
}

export const activeSession = new Signal(sessions.value[0]);

class ExternallyResolvablePromise {
  constructor() {
    this.promise = new Promise(resolve => {
      this.resolve = resolve;
    });
  }

  then(...args) {
    return this.promise.then(...args);
  }

  catch(...args) {
    return this.promise.catch(...args);
  }

  finally(...args) {
    return this.promise.finally(...args);
  }
}
export const startSession = ({ parent = null, task, type }) => {
  const typeDef = sessionDefinitions.find(def => def.type === type.type);

  const meta = {
    parent,
    task,
    type,
  };

  const session = {
    meta,
    messages: getInitialMessages(typeDef.getSystemMessage(meta)),

    busy: false,
    autorun: type.type !== 'chat',
    tokensUsed: null,
  };

  sessions.push(session);
  sessionPromises.set(session, new ExternallyResolvablePromise());

  return session;
}

export const awaitSession = (session) => {
  return sessionPromises.get(session);
}

export const addMessageWithoutSending = (session, message) => {
  session.messages.push(message);
  refreshSessions();
}

export const continueSession = (session, message, forceSend) => {
  if (message && message.content) {
    session.messages.push(message);
    refreshSessions();
  }

  if (session.autorun || forceSend) {
    sendMessages(session);
  }
}

export const resetSession = (session) => {
  const sessionDef = sessionDefinitions.find(sessionDef => sessionDef.type === session.meta.type.type);
  session.messages = getInitialMessages(sessionDef.getSystemMessage(session.meta));
  session.busy = false;
  refreshSessions();
}

export const closeSession = (session) => {
  const idx = sessions.value.findIndex(s => s === session);
  if (idx !== -1) {
    sessions.value.splice(idx, 1);
    refreshSessions();

    if (activeSession.value === session) {
      // load up the previous session, if any
      activeSession.value = sessions.value.at(idx - 1);
    }
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

  const sessionTaskDef = taskDefinitions.find(def => def.type === session.meta.task.type);
  const sessionTypeDef = sessionDefinitions.find(def => def.type === session.meta.type.type);

  /*
  tensorcors and flash attention tracking

  Qwen2.5-Coder-14B-Instruct-Q6_K_L.gguf

  flash attention appears to dramatically increase entropy in the conversation (avoids repetition)

  static, tensor, attention: 3s
  random, tensor, attention: 6s - jumps around quite a bit; slowish growth
  static, tensor: 6s; stable at 5.5->6.5s
  random, tensor: 4.5s; slow growth

  */

  const response = await fetch(
    'http://10.0.0.77:5000/v1/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({
        // https://github.com/oobabooga/text-generation-webui/blob/main/extensions/openai/typing.py#L55
        mode: "chat-instruct",
        context: getContext(session),
        messages: session.messages,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.8, // if not set to 1, select tokens with probabilities adding up to less than this number. Higher value = higher range of possible random results.
        min_p: 0.2, // Tokens with probability smaller than `(min_p) * (probability of the most likely token)` are discarded. This is the same as top_a but without squaring the probability.
        top_k: 20, // Similar to top_p, but select instead only the top_k most likely tokens. Higher value = higher range of possible random results.
        typical_p: 1, // If not set to 1, select only tokens that are at least this much more likely to appear than random tokens, given the prior text.
        tfs: 0.5, // Tries to detect a tail of low-probability tokens in the distribution and removes those tokens. See this [blog post](https://www.trentonbricken.com/Tail-Free-Sampling/) for details. The closer to 0, the more discarded tokens.
        repetition_penalty: 1.1, // Penalty factor for repeating prior tokens. 1 means no penalty, higher value = less repetition, lower value = more repetition.
        frequency_penalty: 0.0, // Repetition penalty that scales based on how many times the token has appeared in the context. Be careful with this; there's no limit to how much a token can be penalized.
        presence_penalty: 0.0, // Similar to repetition_penalty, but with an additive offset on the raw token scores instead of a multiplicative factor. It may generate better results. 0 means no penalty, higher value = less repetition, lower value = more repetition. Previously called "additive_repetition_penalty".

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
        ...(sessionTypeDef.getApiParams?.(session.meta, session) ?? {}),
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

  if (actionNodes[0].children.length > 1) {
    respondWithError('Multiple elements found inside <action />, only one item is allowed at a time');
    return;
  }

  let actionStopsSession = false;
  try {
    for (let i = 0; i < actionNodes.length; i++) {
      const actionDef = actionNodeToObject(actionNodes[i]);
      actions.push(actionDef);

      if (actionDef.action === 'parsererror') {
        respondWithError(xmldoc.documentElement.textContent);
        return;
      } else if (actionDef.action === 'speak') {
        // not a real action
      } else if (actionDef.action === 'task.success' || actionDef.action === 'task.failure') {
        actionStopsSession = true;
        const sessionPromise = sessionPromises.get(session);
        if (sessionPromise) {
          if (actionDef.action === 'task.success') {
            sessionPromise.resolve({ status: 'success', result: actionDef.text });
          } else {
            sessionPromise.resolve({ status: 'failed', result: actionDef.text });
          }
        }
      } else {
        try {
          actionResults.push(await executeAction(session, actionDef));
        } catch (e) {
          console.error(e);
          actionResults.push(`<error><![CDATA[${e.message}]]></error>`);
        }
      }

      // write results back into the message
      //       persistedMessage.content = persistedMessage.content.replace(
      //         /(<\/action>)$/,
      //         `
      //   <result><![CDATA[
      // ${actionResults[0]}
      //   ]]</result>
      // $1`,
      //       );
    }
  } catch (e) {
    console.error(e);
    respondWithError(`Error executing action: ${e.message}\n\nPlease reformat your XML and try again.`);
    return;
  }

  session.messages.push(persistedMessage);
  session.busy = false;
  refreshSessions();

  if (actionResults.length) {
    addMessageWithoutSending(
      session,
      {
        role: 'assistant',
        content: `  <result><![CDATA[
${actionResults[0]}
]]</result>`
      }
    );

    // addMessageWithoutSending(
    //   session,
    //   {
    //     role: 'user',
    //     content: `action results\n----------\n${actionResults.join('\n----------\n')}`
    //   }
    // );
  }
  if (!actionStopsSession) {
    continueSession(session);
  }
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