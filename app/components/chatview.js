import { registerComponent, element, Signal } from '@venajs/core';
import { sessions } from '../project.js';
import { activeSession, continueSession, resetSession, closeSession } from '../session.js';

import './newchat.js';

const isActiveSessionBusy = activeSession.map(session => {
  return session?.busy ?? true;
});

function refreshSessions() {
  sessions.dirty = true;
}

registerComponent('l-chatview', ({ render, element: me }) => {
  function scrollMessages() {
    setTimeout(() => {
      me.shadowRoot.getElementById('messages').scrollBy(0, Number.MAX_SAFE_INTEGER);
    });
  }
  activeSession.on(scrollMessages);
  scrollMessages();

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

  const showNewSession = new Signal(false);

  const newSessionUI = element`<div id="newSession" data-visible=${showNewSession}>
    <div id="newSessionContent">
      <l-newchat onl-newchat-create=${(e) => {
      showNewSession.value = false;
      e.preventDefault();
    }}></l-newchat>
      <button id="cancelNewSession" onclick=${() => showNewSession.value = false}>cancel</button>
    </div>
  </div>`;

  const sessionTabs = element`
<nav>
  ${sessions.map(sessions => sessions.map(session => {
    return element`
      <button
        data-active=${activeSession.value === session}
        onclick=${() => {
        activeSession.value = session;
        refreshSessions();
      }}>
        ${session.meta.task.title ?? 'untitled'}
      </button>`;
  }
  ))}
</nav>
  `;

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
        grid: auto auto 1fr auto / auto;
        width: 100%;
        height: 100%;
      }

      nav {
        display: flex;
        gap: 0px;
        overflow-x: auto;
        padding: 10px;

        button {
          cursor: pointer;
          padding: 10px;
          border: 1px solid #e0e0e0;
          background-color: #e0e0e0;
          
          &[data-active] {
            background-color: white;
            margin-top: -5px;
            padding-top: 15px;
            border-radius: 5px 5px 0 0;
          }
        }
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

      #newSessionBtn {
        float: right;
        margin-right: 12px;
      }

      #newSession {
        display: none;

        &[data-visible] {
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);

          #newSessionContent {
            background-color: white;
            display: inline-block;
            width: fit-content;
            height: fit-content;
            position: absolute;
            padding: 10px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }

          #cancelNewSession {
            margin: 12px auto 0;
            display: block;
          }
        }
      }
    </style>

    ${newSessionUI}
    
    ${sessions.map(sessions => {
    return sessions.length === 0 ? element`<l-newchat><span slot="title">No sessions</span></l-newchat>` : element`
        <section>
          ${sessionTabs}
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
                tokens used: ${activeSession?.tokensUsed}
                <input type="checkbox" checked=${activeSession?.autorun} onchange=${e => {
          activeSession.autorun = e.target.checked;
          refreshSessions();
        }} /> auto-run
              </div>
              <button id="newSessionBtn" onclick=${() => showNewSession.value = true}>new session</button>
            </h2>`;
    })}
          <div id="messages">
            ${activeSession.map(({ messages } = { messages: [] }) => {
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
    })}
      `
  })}
  `;
});