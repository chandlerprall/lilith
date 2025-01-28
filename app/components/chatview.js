import { registerComponent, element } from '@venajs/core';
import { isBusy as isMessagingBusy, sendMessage, messages, resetMessages } from '../messaging.js';

registerComponent('pm-chatview', ({ render, refs }) => {
  const handleMessageKeyDown = (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      const message = refs.message.value;
      refs.message.value = '';
      sendMessage(message);
    }
  }

  render`
    <style>
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: scroll;
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
    </style>
    
    <h2>
      chat
      <button onclick=${resetMessages}>clear</button>
    </h2>
    <div id="messages">
      ${messages.map(messages => {
    return messages.map((message) => {
      return element`<pm-message message=${message}></pm-message>`;
    })
  })}    
    </div>
    <textarea
      id="message"
      disabled=${isMessagingBusy}
      placeholder=${isMessagingBusy.map(busy => busy ? 'sending...' : 'type a message')}
      onkeydown=${handleMessageKeyDown}></textarea>
  `;
});