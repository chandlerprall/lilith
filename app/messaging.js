import { ProxySignal, Signal } from '@venajs/core';
import project, { clearLog, updateLog } from './project.js';
import { executeAction } from './actions.js';

export const isBusy = new Signal(false);
export const allowAutoRun = new Signal(true);

export const tokenUsage = new Signal(null);

function generateContext() {
  return `The following is an interface log between a staff software engineer and their boss.

They are working on the following project

# ${project.name}

Files are located at ${project.directory}

## About

${project.context}

## Existing issues

${project.issues.value.map(({ id, name, closed }) => `* (${id}) ${name}${closed ? ' (closed)' : ' (open)'}`).join('\n')}

## Knowledge base

${project.knowledgeBase ?? "no knowledge base set"}

# Messaging

Notice how intelligent and concise the staff eng is, applying their wealth of experience and insight to deal with any issue.
However, when getting stuck in a task they ask for input, never making something up.
They are a self-starter, using the available tools and actions to solve problems and understand hurdles, iterating to get to the right solution.
`;
}

export const messages = new ProxySignal(getInitialMessages());
messages.push(...project?.log ?? []);

const parser = new DOMParser();

export const sendMessages = async (messages) => {
  isBusy.value = true;

  messages.value[0].content = generateContext();

  const response = await fetch(
    'http://10.0.0.77:5000/v1/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({


        // https://github.com/oobabooga/text-generation-webui/blob/main/extensions/openai/typing.py#L55
        mode: "chat-instruct",
        messages: messages.value,
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
`
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const parsed = await response.json();
  tokenUsage.value = parsed.usage.total_tokens;

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
    messages.push(persistedMessage);
    updateLog(persistedMessage);
    sendMessage(msg);
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

    if (actionDef.action === 'parseerror') {
      respondWithError(xmldoc.documentElement.textContent);
      return;
    } else if (actionDef.action === 'speak') {
      speakResults += actionDef.text + '\n';
    } else if (actionDef.action === 'complete') {
      speakResults += '-=: assistant has ended the conversation :=-'
    } else {
      try {
        actionResults.push(await executeAction(actionDef));
      } catch (e) {
        console.error(e);
        actionResults.push(`Error: ${e.message}`);
      }
    }
  }

  messages.push(persistedMessage);
  updateLog(persistedMessage);
  isBusy.value = false;

  if (actionResults.length) {
    sendMessage(`action results\n----------\n${actionResults.join('\n----------\n')}`);
  } else {
    // sendMessage();
  }
}

export const sendMessage = async content => {
  if (content) {
    const message = { role: 'user', content };
    updateLog(message);
    messages.push(message);
  }
  if (allowAutoRun.value) {
    sendMessages();
  }
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
      content: '[context]',
      isContext: true,
    },
    {
      role: 'assistant',
      content: `<think>Normally I would look back at the previous messages and reasons, determine the necessary action here, and anticipate future ones. However, this is the beginning of the conversation and there is no history to look at. I want to appear helpful and friendly, so I'll just ask how I can help.</think>
<?xml version="1.0" encoding="UTF-8"?>
<action reason="I should be friendly and helpful">
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
    }
  ]
}

function actionNodeToObject(node) {
  const reason = node.getAttribute('reason');
  const actionNode = node.children[0];
  const action = actionNode.nodeName;
  const text = actionNode.textContent; // Array.from(actionNode.childNodes).map(node => node.textContent).join('');
  const args = {};
  for (let i = 0; i < actionNode.attributes.length; i++) {
    const attr = actionNode.attributes[i];
    args[attr.name] = attr.value;
  }
  return { reason, action, args, text };
}
