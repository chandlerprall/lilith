import { ProxySignal } from "@venajs/core";
import { getId } from "./utils/id.mjs";
import { ActionType } from "./actions.mjs";

declare global {
	namespace Project {
		interface SessionTasks {}
		interface SessionTypes {}
	}
}

export type SessionTask = Project.SessionTasks[keyof Project.SessionTasks];
export type SessionType = Project.SessionTypes[keyof Project.SessionTypes];

export interface SessionMeta<Task extends SessionTask = SessionTask, Type extends SessionType = SessionType> {
	parent?: string;
	task: Task;
	type: Type;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ActionNode {
	reason: string;
	action: ActionType;
	args: Record<string, string>;
	text: string;
}

export interface Message {
	role: MessageRole;
	content: string;
	think?: string;
	actions?: Array<ActionNode>;
	actionResults?: Array<string>;
}

export type SendableMessage = Pick<Message, "role" | "content">;

export interface Session {
	id: string;
	meta: SessionMeta;
	messages: Array<Message>;
	busy: boolean;
	autorun: boolean;
	tokensUsed: number | null;
}

interface Issue {
	id: string;
	name: string;
	definition: string;
	closed: boolean;
}

interface Project {
	name: string;
	directory: string;
	context: string;
	issues: any; // typeof ProxySignal<Array<Issue>>;
	sessions: Array<Session>;
	knowledgeBase?: string;
}

const { writeFileSync } = require("fs");
const projectFilePath = "/Users/chandlerprall/projects/lilith-projects/game.json";
const project: Project = require(projectFilePath);

project.issues = new ProxySignal(project.issues);

export const sessions = new ProxySignal(project.sessions);
sessions.on(writeProject);

export const getSessionById = (id: string | undefined) => sessions.value.find((session) => session.id === id);

export default project;

export const writeIssue = (name: string, definition: string) => {
	let returnedIssue;

	const existingIdx = project.issues.value.findIndex((issue: Issue) => issue.name === name);
	if (existingIdx !== -1) {
		project.issues.value[existingIdx].definition = definition;
		returnedIssue = project.issues.value[existingIdx];
	} else {
		const existingIds = new Set(project.issues.value.map((issue: Issue) => issue.id));
		const id = getId(existingIds);
		returnedIssue = { id, name, definition };
		project.issues.push(returnedIssue);
	}

	writeProject();

	return returnedIssue;
};

export const closeIssue = (id: string) => {
	const existingIdx = project.issues.value.findIndex((issue: Issue) => issue.id === id);
	if (existingIdx !== -1) {
		project.issues.value[existingIdx].closed = true;
	} else {
		throw new Error(`Issue ${id} not found`);
	}

	writeProject();
};

function writeProject() {
	writeFileSync(projectFilePath, JSON.stringify(project, null, 2));
}

export const setKnowledgeBase = (knowledgeBase: string) => {
	project.knowledgeBase = knowledgeBase;
	writeProject();
};
