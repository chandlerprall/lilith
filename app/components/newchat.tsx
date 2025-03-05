import { registerComponent, Signal, element } from "@venajs/core";
import { continueSession, sessionDefinitions, startSession } from "../session.mjs";
import { taskDefinitions } from "../tasks.mjs";
import { SessionTask, SessionType } from "../project.mjs";

declare global {
	namespace Vena {
		interface Elements {
			"l-newchat": {};
		}
	}
}

registerComponent("l-newchat", ({ render, refs, emit, element: me }) => {
	const selectedTask = new Signal(taskDefinitions[0]);
	const selectedType = new Signal(sessionDefinitions[0]);
	rerender();

	async function triggerSession() {
		// @ts-expect-error
		const task: SessionTask = me.shadowRoot.getElementById("taskSelection").value;
		// @ts-expect-error
		const type: SessionType = me.shadowRoot.getElementById("typeSelection").value;

		const newSession = await startSession({ task, type }, true);

		emit("create", newSession);

		continueSession(newSession);
	}

	function rerender() {
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
						<select id="task" onchange={(e) => (selectedTask.value = taskDefinitions.find((task) => task.type === (e.target as HTMLSelectElement).value)!)}>
							{taskDefinitions.map((task) => (
								<option value={task.type}>{task.type}</option>
							))}
						</select>
					</span>

					{selectedTask.map((selectedTask) => element`<${`${selectedTask.configElement}`} id="taskSelection"></${`${selectedTask.configElement}`}>`)}

					<hr />

					<span>
						<label htmlFor="sessionType">session type</label>
						<select id="sessionType" onchange={(e) => (selectedType.value = sessionDefinitions.find((session) => session.type === (e.target as HTMLSelectElement).value)!)}>
							{sessionDefinitions.map((session) => (
								<option value={session.type}>{session.type}</option>
							))}
						</select>
					</span>

					{selectedType.map((selectedType) => element`<${`${selectedType.configElement}`} id="typeSelection"></${`${selectedType.configElement}`}>`)}

					<hr />

					<button onclick={triggerSession}>start new session</button>
				</section>
			</>
		);
	}
});
