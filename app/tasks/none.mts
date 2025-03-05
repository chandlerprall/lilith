import { registerComponent } from "@venajs/core";
import { SessionTaskDefinition } from "../tasks.mjs";

declare global {
	namespace Vena {
		interface Elements {
			"l-task-none-config": {};
		}
	}

	namespace Project {
		interface SessionTasks {
			none: {
				type: "none";
			};
		}
	}
}

const NoneTaskConfig = registerComponent("l-task-none-config", ({ render, element }) => {
  Object.defineProperty(element, "value", {
    get() {
      return {
        type: "none",
      };
    },
  });

  render`
    <style>
      :host {
        display: none;
      }
    </style>
  `;
});

export default {
  type: "none",
  configElement: NoneTaskConfig,
} as SessionTaskDefinition<"none">;