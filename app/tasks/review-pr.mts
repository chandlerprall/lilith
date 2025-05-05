import { registerComponent } from "@venajs/core";
import { SessionTaskDefinition } from "../tasks.mjs";
import { Session, SessionMeta } from "../project.mjs";
import { filterActionsByTypes, startTask } from "../actions.mjs";
import { addMessageWithoutSending } from "../session.mjs";

const { execSync } = require("child_process");
const { mkdirSync } = require("fs");
const path = require("path");
const os = require("os");

declare global {
	namespace Vena {
		interface Elements {
			"l-task-review-pr-config": {};
		}
	}

	namespace Project {
		interface SessionTasks {
			"review-pr": {
				type: "review-pr";
				step: "orchestrate" | "analyze" | "reviewFile" | "finished";
				title: string;
				url: string;
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
				analyzeResults?: string;
				fileResults?: Record<string, string>;
			};
		}
	}
}

const ReviewPRTaskConfig = registerComponent("l-task-review-pr-config", ({ render, element, refs }) => {
	Object.defineProperty(element, "value", {
		get() {
			const url = (refs.url as HTMLInputElement).value;
			return {
				type: "review-pr",
				step: "orchestrate",
				title: `Review PR: ${url}`,
				url,
			} satisfies Project.SessionTasks["review-pr"];
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
  `;
});

export default {
	type: "review-pr",
	configElement: ReviewPRTaskConfig,
	initializeSession: async (session) => {
		if (session.meta.parent) return; // sub-sessions don't need initialization

		const start = Date.now();
		const prDetailsString = execSync(`gh pr view ${session.meta.task.url} --json title,body,files,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,headRepositoryOwner`).toString();
		const prDetails = JSON.parse(prDetailsString);

		// const repo = `${prDetails.headRepositoryOwner.login}/${prDetails.headRepository.name}`;
		// const repoUrl = `git@github.com:${repo}.git`;
		const sourceBranch = prDetails.headRefName;

		const tmpDir = path.join(os.tmpdir(), "__lilith_git");

		console.log("readying git repo");
		console.log(`\t${tmpDir}`);

		// if (existsSync(tmpDir)) {
		// 	readdirSync(tmpDir).forEach((f: string) => rmSync(path.join(tmpDir, f), { recursive: true }));
		// }

		mkdirSync(tmpDir, { recursive: true });

		// clone the commit from the repo
		// execSync(`git clone ${repoUrl} --branch ${sourceBranch} --single-branch .`, { cwd: tmpDir });

		// check out the commit
		console.log(`\tchecking out ${sourceBranch}`);
		execSync(`git fetch origin`, { cwd: tmpDir });
		execSync(`git checkout ${sourceBranch}`, { cwd: tmpDir });

		session.meta.task.checkoutDirectory = tmpDir;
		session.meta.task.prDetails = prDetails;

		const end = Date.now();
		console.log("\ttime taken:", end - start, "ms");
	},
	getActions: (session) => {
		if (session.meta.task.step === "analyze") {
			return filterActionsByTypes(["task.success"]);
		}
	},
	continueSession: async (session) => {
		if (session.meta.task.step === "orchestrate") {
			await doAnalyze(session);

			for (const file of session.meta.task.prDetails!.files) {
				await reviewFile(session, file);
			}

			session.meta.task.step = "finished";
			return false;
		} else if (session.meta.task.step === "analyze") {
			return true;
		} else if (session.meta.task.step === "reviewFile") {
			return true;
		} else if (session.meta.task.step === "finished") {
			return true;
		} else {
			assertNever(session.meta.task.step);
		}
	},
} satisfies SessionTaskDefinition<"review-pr">;

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${value}`);
}

async function doAnalyze(session: Session & { meta: SessionMeta<Project.SessionTasks["review-pr"]> }) {
	if (!session.meta.task.checkoutDirectory || !session.meta.task.prDetails) {
		throw new Error("PR details not initialized, was the task's start step performed?");
	}

	const { prDetails, checkoutDirectory } = session.meta.task;

	const diffString = execSync(`git diff ${prDetails.baseRefOid}...${prDetails.headRefOid}`, { cwd: checkoutDirectory }).toString();

	const result = await startTask(
		session,
		{
			...session.meta.task,
			title: `Summarize PR "${prDetails.title}"`,
			step: "analyze",
		},
		{
			copyMessages: false,
			newMessages: [
				{
					role: "user",
					content: `
Summarize the following PR details. This summary will be used as a reference during for reviewers as they go over changes at a more granular level. The description and entire diff is provided so you can get a sense of the context of the changes and do a high-level check. Please provide a summary of the changes, the context of the changes, and any areas of interest reviewers should pay special attention to.

Title: ${prDetails.title}
---

${prDetails.body}

---

${diffString}
      `,
				},
			],
		}
	);

	session.meta.task.analyzeResults = result.result;
	addMessageWithoutSending(session, { content: `PR analysis\n---\n${result.result}` });

	return;
}

async function reviewFile(session: Session & { meta: SessionMeta<Project.SessionTasks["review-pr"]> }, file: Required<Project.SessionTasks["review-pr"]>["prDetails"]["files"][number]) {
	if (!session.meta.task.checkoutDirectory || !session.meta.task.prDetails) {
		throw new Error("PR details not initialized, was the task's start step performed?");
	}

	const { prDetails, checkoutDirectory } = session.meta.task;

	const diffString = execSync(`git diff ${prDetails.baseRefOid}...${prDetails.headRefOid} -- ${file.path}`, { cwd: checkoutDirectory }).toString();
	console.log(`git diff ${prDetails.baseRefOid}...${prDetails.headRefOid} -- ${file.path}`);
	console.log(diffString);

	const result = await startTask(
		session,
		{
			...session.meta.task,
			title: `Review file "${file.path}"`,
			step: "reviewFile",
		},
		{
			copyMessages: false,
			newMessages: [
				{
					role: "user",
					content: `Review the file's changes in detail. Have a critical eye and consider all important aspects in the code review process, from blocking issues to nit suggestions, from design token use to algorithm design. Feel free to look around in the code base, dependency docs, or anything else of use to determine the quality and accuracy of the changes.
## PR analysis

${session.meta.task.analyzeResults}

## File diff to analyze

File: ${file.path}

\`\`\`diff
${diffString}
\`\`\`
      `,
				},
			],
		}
	);

	session.meta.task.fileResults = session.meta.task.fileResults || {};
	session.meta.task.fileResults[file.path] = result.result;

	addMessageWithoutSending(session, { content: `Analysis of ${file.path}\n---\n${result.result}` });
}
