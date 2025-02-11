import { registerComponent, Signal } from '@venajs/core';
import { activeSession, sessionDefinitions, startSession } from '../session.js';

registerComponent('l-chatview-empty', ({ render, refs }) => {
  const configureElement = new Signal(sessionDefinitions[0].configElement);
  configureElement.on(rerender);
  rerender();

  function triggerSession() {
    const sessionDef = sessionDefinitions.find(session => session.configElement === configureElement.value);
    const config = refs.selection.value;

    const newSession = startSession(null, sessionDef.type, config);
    activeSession.value = newSession;
  }

  function rerender() {
    const selected = sessionDefinitions.find(session => session.configElement === configureElement.value);

    render`
      <style>
        :host {
          width: 100%;
          height: 100%;
        }

        section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          height: 100%;
          justify-content: center;
          align-items: center;
        }
      </style>
      <section>
        <strong>No sessions</strong>
          <select onchange=${e => configureElement.value = sessionDefinitions.find(session => session.type === e.target.value).configElement}>
            ${sessionDefinitions.map(session => `<option value="${session.type}" ${selected.type === session.type ? "selected" : ''}>${session.type}</option>`)}
          </select>
        <${`${configureElement}`} id="selection"></${`${configureElement}`}>
        <button onclick=${triggerSession}>start new session</button>
      </section>`;
  }
});