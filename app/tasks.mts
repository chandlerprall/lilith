import { registerComponent } from "@venajs/core";
import { Session, SessionMeta, SessionTask } from "./project.mjs";

const { execSync } = require("child_process");
const { existsSync, mkdirSync, readdirSync, rmSync } = require("fs");
const path = require("path");
const os = require("os");

declare global {
	namespace Vena {
		interface Elements {
			"l-task-none-config": {};
			"l-task-freeform-config": {};
			"l-task-review-pr-config": {};
		}
	}

	namespace Project {
		interface SessionTasks {
			none: {
				type: "none";
			};

			freeform: {
				type: "freeform";
				title: string;
				description: string;
			};

			"review-pr": {
				type: "review-pr";
				title: string;
				url: string;
				instructions: string;
				checkoutDirectory?: string;
				prDetails?: {
					title: string;
					body: string;
					files: Array<{ path: string; additions: number; deletions: number }>;
					baseRefOid: string;
					headRefName: string;
					headRefOid: string;
					headRepository: {
						name: string;
						owner: {
							login: string;
						};
					};
				};
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

const ReviewPRTaskConfig = registerComponent("l-task-review-pr-config", ({ render, element, refs }) => {
	Object.defineProperty(element, "value", {
		get() {
			return {
				type: "review-pr",
				url: (refs.url as HTMLInputElement).value,
				instructions: (refs.instructions as HTMLInputElement).value,
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
    <input id="url" placeholder="URL of the Github PR" />
    <textarea id="instructions" placeholder="Any specific instructions?"></textarea>
  `;
});

export type SessionTaskDefinition<T extends SessionTask["type"], MappedTask = Project.SessionTasks[T]> = {
	type: T;
	configElement: string;
	initializeSession?: (session: Session & { meta: MappedTask extends SessionTask ? SessionMeta<MappedTask> : never }) => Promise<void>;
};

export const taskDefinitions = [
	{
		type: "none",
		configElement: NoneTaskConfig,
	} as SessionTaskDefinition<"none">,
	{
		type: "freeform",
		configElement: FreeformTaskConfig,
	} as SessionTaskDefinition<"freeform">,
	{
		type: "review-pr",
		configElement: ReviewPRTaskConfig,
		initializeSession: async (session) => {
			const start = Date.now();
			const prDetailsString = execSync(`gh pr view ${session.meta.task.url} --json title,body,files,baseRefOid,headRefName,headRefOid,headRepository,headRepositoryOwner`).toString();
			const prDetails = JSON.parse(prDetailsString);

			const repo = `${prDetails.headRepositoryOwner.login}/${prDetails.headRepository.name}`;
			const repoUrl = `git@github.com:${repo}.git`;
			const sourceBranch = prDetails.headRefName;

			const tmpDir = path.join(os.tmpdir(), "__lilith_git");

			if (existsSync(tmpDir)) {
				readdirSync(tmpDir).forEach((f: string) => rmSync(path.join(tmpDir, f), { recursive: true }));
			}

			mkdirSync(tmpDir, { recursive: true });

			// clone the commit from the repo
			execSync(`git clone ${repoUrl} --branch ${sourceBranch} --single-branch .`, { cwd: tmpDir });

			session.meta.task.checkoutDirectory = tmpDir;
			session.meta.task.prDetails = prDetails;
			console.log(session.meta.task);

			const end = Date.now();
			console.log("Time taken:", end - start, "ms");
		},
	} as SessionTaskDefinition<"review-pr">,
];
