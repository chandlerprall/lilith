import { registerComponent, element, Signal } from '@venajs/core';

registerComponent('pm-message', ({ render, attributes }) => {
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

      .action {
        cursor: pointer;
        width: fit-content;
        margin-left: 10px;
        margin-bottom: 5px;
        padding: 5px;
        background-color:rgb(174, 174, 254);
      }
    </style>
    

    ${message.map(({ role, extracted, content, actions, actionResults }) => {
    if (role === 'user' && content.startsWith('action results\n----------\n')) {
      return "";
    }
    return element`
        <section>
          <strong onclick=${() => debugging.value = !debugging.value}>${role}</strong>
          ${Signal.from(message, debugging).map(() => {
          if (debugging.value) {
            return element`<pre>${content.replace(/ /g, '&nbsp;')}</pre>`;
          }

          return element`<div>
                  <pre>${(extracted ?? content).replace(/ /g, '&nbsp;')}</pre>
                  ${!actions ? "" : actions?.filter(({ action }) => !!action).map(({ action }, idx) => {
                    const isExpanded = new Signal(false);
                    return element`
                      <div>
                        <div class="action" onclick=${() => isExpanded.value = !isExpanded.value}>
                          ${action.action}
                        </div>
                        ${isExpanded.map(isExpanded => isExpanded ? element`<pre>${JSON.stringify(action, null, 2)}\n\n${actionResults[idx]}</pre>` : "")}
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