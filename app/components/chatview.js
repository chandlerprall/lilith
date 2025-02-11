import { registerComponent, element } from '@venajs/core';
import { sessions } from '../project.js';
import { activeSession, continueSession, resetSession, closeSession } from '../session.js';

import './chatview-empty.js';

const isActiveSessionBusy = activeSession.map(session => {
  return session.busy;
});

function refreshSessions() {
  sessions.dirty = true;
}

registerComponent('l-chatview', ({ render, element: me }) => {
  const handleMessageKeyDown = (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      const msgEl = me.shadowRoot.querySelector('#message');
      const content = msgEl.value;
      msgEl.value = '';
      continueSession(
        activeSession.value,
        {
          role: 'user',
          content,
        },
        true // force it to send, even if autorun is disabled
      );
    }
  }

  render`
    <style>
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      section {
        display: grid;
        grid: auto 1fr auto / auto;
        width: 100%;
        height: 100%;
      }
      
      h2 {
        margin: 0;
        padding-top: 10px;
        text-align: center;
      }
      
      #messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }
      
      textarea {
        box-sizing: border-box;
        width: 100%;
        height: 8.5lh;
        border: 1px solid #e0e0e0;
        
        &:focus {
          outline: none;
        }
      }

      .meta {
        font-weight: normal;
        display: inline-block;
        font-size: 12px;
      }
    </style>
    
    ${sessions.map(sessions => {
    return sessions.length === 0 ? element`<l-chatview-empty/>` : element`
        <section>
          ${activeSession.map((activeSession) => {
      return element`
            <h2>
              chat
              <div class="meta">
                <button onclick=${() => resetSession(activeSession)}>reset</button>
                <button onclick=${e => {
          const btn = e.target;
          if (btn.innerText === 'close') {
            btn.innerText = 'are you sure?';

            setTimeout(() => {
              btn.innerText = 'close';
            }, 2500);
          } else {
            closeSession(activeSession);
          }
        }}>close</button>
                tokens used: ${activeSession.tokensUsed}
                <input type="checkbox" checked=${activeSession.autorun} onchange=${e => {
          activeSession.autorun = e.target.checked;
          refreshSessions();
        }} /> auto-run
              </div>
            </h2>`;
    })}
          <div id="messages">
            ${activeSession.map(({ messages }) => {
      return messages.map(message => {
        return element`<l-message message=${message}></l-message>`;
      })
    })}
          </div>
          <textarea
            id="message"
            disabled=${isActiveSessionBusy}
            placeholder=${isActiveSessionBusy.map(busy => busy ? 'processing...' : 'type a message')}
            onkeydown=${handleMessageKeyDown}></textarea>
        </section>
      `
  })}
  `;
});