import { registerComponent, element, Signal } from '@venajs/core';

const sanitize = x => he.encode(x ? typeof x === 'string' ? x : JSON.stringify(x, null, 2) : "");

registerComponent('l-message', ({ render, attributes }) => {
  const message = attributes.message;
  const debugging = new Signal(false);

  render`
    <style>
      :host {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
      }

      strong {
        color: #666;
        cursor: pointer;
      }

      pre {
        margin: 5px 0;
        font-size: 12px;
      }

      .lineWrap {
        white-space: pre-wrap;
      }

      .actionBlock {
        display: flex;
        flex-direction: row;
        gap: 10px;
        align-items: center;
      }

      .action {
        cursor: pointer;
        width: fit-content;
        margin-left: 10px;
        margin-bottom: 5px;
        padding: 5px;
        background-color:rgb(174, 174, 254);
      }

       .reason {
         color: #999;
       }

      .think {
        display: block;
        color: #999;
        font-style: italic;
        
        cursor: pointer;
        max-height: 1.5em;
        overflow: hidden;
        background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1));
        background-clip: text;
        -webkit-background-clip: text;

        &[data-open] {
          max-height: unset;
          overflow: visible;
        }
      }
    </style>

    ${message.map(({ role, think, content, actions, actionResults }) => {

    if (role === 'system') {
      return element`<section>
          <strong>${role}</strong>
          <pre class="lineWrap">[context]</pre>
        </section>`;
    }

    if (role === 'user' && content.startsWith('action results\n----------\n')) {
      return "";
    }

    if (role === 'user') {
      return element`<section>
          <strong onclick=${() => debugging.value = !debugging.value}>${role}</strong>
          <pre class="lineWrap">${sanitize(content)}</pre>
        </section>`;
    }

    const isThinkExpanded = new Signal(false);

    return element`
          <section>
            <strong onclick=${() => debugging.value = !debugging.value}>${role}</strong>
            ${Signal.from(message, debugging, isThinkExpanded).map(() => {
      if (debugging.value) {
        return element`<pre>${sanitize(content)}</pre>`;
      }

      const spokenWords = actions?.filter(action => action.action === 'speak').map(action => action.text).join('\n');
      const remainingActions = actions?.filter(action => action.action !== 'speak');

      const taskResult = actions?.[0]?.action === 'task.success' || actions?.[0]?.action === 'task.failure' ? element`<pre>${actions?.[0].text}</span>` : "";

      return element`<div>
                <pre class="think" data-open=${isThinkExpanded} onclick=${() => isThinkExpanded.value = !isThinkExpanded.value}>${sanitize(think)}</pre>
                <pre class="lineWrap">${sanitize(spokenWords)}</pre>
                ${remainingActions?.map(({ reason, action, args }, idx) => {
        const isExpanded = new Signal(false);
        return element`
                  <div>
                    <div class="actionBlock">
                      <div class="action" onclick=${() => isExpanded.value = !isExpanded.value}>
                        ${sanitize(action)}
                      </div>
                      <span class="reason">
                        ${sanitize(reason)}
                      </span>
                    </div>
                    ${taskResult}
                    ${isExpanded.map(isExpanded => isExpanded ? element`<pre>${sanitize(JSON.stringify(args, null, 2))}\n\n${sanitize(actionResults[idx])}</pre>` : "")}
                  </div>
                `;
      })}
            </div>`;
    })}
          </section>
        `;
  })}
  `;
});