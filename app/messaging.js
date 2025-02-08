import { ProxySignal, Signal } from '@venajs/core';
import project, { clearLog, updateLog } from './project.js';
import { getActionNames, getActionDefinitions, executeAction } from './actions.js';

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
    
All of the engineer's responses are **only ever** a XML document containing the singular action to take, making great use of CDATA. There is no text before or after the XML document. An example document is:

\`\`\`document
<?xml version="1.0" encoding="UTF-8"?>
<action reason="I want to say hi">
  <speak><![CDATA[my message]]></speak>
</action>
\`\`\`

More formally, the document follows this definition:

\`\`\`dtd
<!ELEMENT action (${getActionNames()})>
<!ATTLIST action
reason CDATA #REQUIRED <!-- describe why you are taking this action -->
>

${getActionDefinitions()}
\`\`\`

<speak /> content is delivered back to the engineer's boss for him to respond, while the results of any action(s) are delivered back to the staff engineer for them to continue on. Also note how there is always exactly one child element of <action />.

Notice how intelligent and concise the staff eng is, applying their wealth of experience and insight to deal with any issue.
However, when getting stuck in a task they ask for input, never making something up.
They are a self-starter, using the available tools and actions to solve problems and understand hurdles, iterating to get to the right solution.
`;
}

export const messages = new ProxySignal(getInitialMessages());
messages.push(...project.log);

const parser = new DOMParser();

export const sendMessages = async () => {
  isBusy.value = true;

  messages.value[0].content = generateContext();

  const response = await fetch(
    'http://10.0.0.77:5000/v1/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify({


        // https://github.com/oobabooga/text-generation-webui/blob/main/extensions/openai/typing.py#L55
        mode: "instruct",
        messages: messages.value,
        max_tokens: 4096,
        temperature: 0.6,
        top_p: 1,
        min_p: 0,
        top_k: 1,
        typical_p: 1,
        tfs: 1,
        repetition_penalty: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,

        stop: ["</action>"],

        grammar_string: `
# support deepseek r1 format (and compatible with other models), and then force the xml response payload:
# <think>...</think>
# <?xml version="1.0" encoding="UTF-8"?>
# <action reason="

# root specifies the pattern for the overall output
root ::= (
    # it must start with the characters "<think>" followed by some lines of thought,
    # followed by the closing "</think>" and a trailing newline
    "<think>" think-line{3,7} "</think>\\n"

    # then an XML declaration and start of document
    "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n"

    # finally the action block
    "<action reason=\\"" .{10,50} "\\">"

    .+

    "</action>"
)


think-line ::= [^<]{50,200} "\\n"
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
  message.content += "</action>" // re-add since it's a stop word;

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
      speakResult += ' -=: assistant has ended the conversation :=-'
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
    sendMessage();
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
      role: 'user',
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
