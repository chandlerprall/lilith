import { registerComponent, Signal, element } from "@venajs/core";
import { activeSession, continueSession, sessionDefinitions, startSession } from "../session.mjs";
import { taskDefinitions } from "../tasks.mjs";
import { SessionTask, SessionType } from "../project.mjs";

declare global {
	namespace Vena {
		interface Elements {
			"l-newchat": {};
		}
	}
}

registerComponent("l-newchat", ({ render, refs, emit }) => {
	const taskElement = new Signal(taskDefinitions[0].configElement);
	taskElement.on(rerender);
	const configureElement = new Signal(sessionDefinitions[0].configElement);
	configureElement.on(rerender);
	rerender();

	async function triggerSession() {
		// @ts-expect-error
		const task: SessionTask = refs.taskSelection.value;
		// @ts-expect-error
		const type: SessionType = refs.selection.value;
		const newSession = await startSession({ task, type });
		activeSession.value = newSession;

		emit("create", newSession);

		continueSession(newSession);
	}

	function rerender() {
		const selected = sessionDefinitions.find((session) => session.configElement === configureElement.value);
		const selectedTask = taskDefinitions.find((task) => task.configElement === taskElement.value);

		render(
			<>
				<style>{`
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
        `}</style>
				<section>
					<strong>
						<slot name="title">Create session</slot>
					</strong>

					<span>
						<label htmlFor="task">task</label>
						<select id="task" onchange={(e) => (taskElement.value = taskDefinitions.find((task) => task.type === (e.target as HTMLSelectElement).value)!.configElement)}>
							{taskDefinitions.map((task) => (
								<option value={task.type} selected={selectedTask!.type === task.type}>
									{task.type}
								</option>
							))}
						</select>
					</span>

					{element`<${`${taskElement}`} id="taskSelection"></${`${taskElement}`}>`}

					<hr />

					<span>
						<label htmlFor="sessionType">session type</label>
						<select id="sessionType" onchange={(e) => (configureElement.value = sessionDefinitions.find((session) => session.type === (e.target as HTMLSelectElement).value)!.configElement)}>
							{sessionDefinitions.map((session) => (
								<option value={session.type} selected={selected!.type === session.type}>
									{session.type}
								</option>
							))}
						</select>
					</span>

					{element`<${`${configureElement}`} id="selection"></${`${configureElement}`}>`}

					<hr />

					<button onclick={triggerSession}>start new session</button>
				</section>
			</>
		);
	}
});
