import { registerComponent, Signal } from '@venajs/core';
import { activeSession, continueSession, sessionDefinitions, startSession } from '../session.js';
import { taskDefinitions } from '../tasks.js';

registerComponent('l-newchat', ({ render, refs, emit }) => {
  const taskElement = new Signal(taskDefinitions[0].configElement);
  taskElement.on(rerender);
  const configureElement = new Signal(sessionDefinitions[0].configElement);
  configureElement.on(rerender);
  rerender();

  async function triggerSession() {
    const task = refs.taskSelection.value;
    const type = refs.selection.value;
    const newSession = await startSession({ task, type });
    activeSession.value = newSession;

    emit('create', newSession);

    continueSession(newSession);
  }

  function rerender() {
    const selected = sessionDefinitions.find(session => session.configElement === configureElement.value);
    const selectedTask = taskDefinitions.find(task => task.configElement === taskElement.value);

    render`
      <style>
        :host {
          width: 100%;
          height: 100%;
        }

        section {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 50%;
          min-width: fit-content;
          margin: 0 auto;
          height: 100%;
          justify-content: center;
          align-items: center;
        }

        hr {
          width: 100%;
          color: #e0e0e0;
        }
      </style>
      <section>
        <strong><slot name="title">Create session</slot></strong>

        <span>
          <label for="task">task</label>
          <select id="task" onchange=${e => taskElement.value = taskDefinitions.find(task => task.type === e.target.value).configElement}>
            ${taskDefinitions.map(task => `<option value="${task.type}" ${selectedTask.type === task.type ? "selected" : ''}>${task.type}</option>`)}
          </select>
        </span>

        <${`${taskElement}`} id="taskSelection"></${`${taskElement}`}>

        <hr />

        <span>
          <label for="sessionType">session type</label>
          <select id="sessionType" onchange=${e => configureElement.value = sessionDefinitions.find(session => session.type === e.target.value).configElement}>
            ${sessionDefinitions.map(session => `<option value="${session.type}" ${selected.type === session.type ? "selected" : ''}>${session.type}</option>`)}
          </select>
        </span>

        <${`${configureElement}`} id="selection"></${`${configureElement}`}>

        <hr />

        <button onclick=${triggerSession}>start new session</button>
      </section>`;
  }
});