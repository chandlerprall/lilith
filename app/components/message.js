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
    </style>

    ${message.map(({ role, content, actions, actionResults }) => {
      if (role === 'user' && content.startsWith('action results\n----------\n')) {
        return "";
      }

      if (role === 'user') {
        return element`<section>
        <strong onclick=${() => debugging.value = !debugging.value}>${role}</strong>
          <pre>${sanitize(content)}</pre>
        </section>`;
      }
      
      return element`
          <section>
            <strong onclick=${() => debugging.value = !debugging.value}>${role}</strong>
            ${Signal.from(message, debugging).map(() => {
              if (debugging.value) {
                return element`<pre>${sanitize(content)}</pre>`;
              }

              const spokenWords = actions?.filter(action => action.action === 'speak').map(action => action.text).join('\n');
              const remainingActions = actions?.filter(action => action.action !== 'speak');

              return element`<div>
                <pre>${sanitize(spokenWords)}</pre>
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