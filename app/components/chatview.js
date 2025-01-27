import { registerComponent, element } from '@venajs/core';
import { isBusy as isMessagingBusy, sendMessage, messages } from '../messaging.js';

registerComponent('pm-chatview', ({ render, refs }) => {
  const handleMessageKeyDown = (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
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
        
        .message {
          strong {
            color: #666;
          }
          pre {
              
          }
        }
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
    
    <h2>chat</h2>
    <div id="messages">
      ${messages.map(messages => {
        console.log('::', messages)
        return messages.map(({ role, content }) => {
          return element`<div class="message">
            <strong>${role}</strong>
            <pre>${content}</pre>
          </div>`
        })
      })}    
    </div>
    <textarea
      id="message"
      placeholder="your message"
      onkeydown=${handleMessageKeyDown}></textarea>
  `;

  isMessagingBusy.on(x => console.log('isMessagingBusy?', x))
});