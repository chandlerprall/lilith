import { registerComponent } from "@venajs/core";
import { SessionTaskDefinition } from "../tasks.mjs";

declare global {
	namespace Vena {
		interface Elements {
			"l-task-freeform-config": {};
		}
	}

	namespace Project {
		interface SessionTasks {
			freeform: {
				type: "freeform";
				title: string;
				description: string;
			};
		}
	}
}

const FreeformTaskConfig = registerComponent("l-task-freeform-config", ({ render, element, refs }) => {
	Object.defineProperty(element, "value", {
		get() {
			return {
				type: "freeform",
				title: (refs.title as HTMLInputElement).value,
				description: (refs.description as HTMLInputElement).value,
			};
		},
	});

	render`
    <style>
      :host {
        display: block;
        width: 100%;
      }

      input {
        width: 100%;
      } 
      textarea {
        width: 100%;
        height: 130px;
      }
    </style>
    <input id="title" placeholder="What do you want to call this task?" />
    <textarea id="description" placeholder="What is the task?"></textarea>
  `;
});

export default {
	type: "freeform",
	configElement: FreeformTaskConfig,
} as SessionTaskDefinition<"freeform">;
