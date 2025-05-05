import { Session, SessionMeta, SessionTask } from "./project.mjs";
import taskNone from "./tasks/none.mjs";
import taskFreeform from "./tasks/freeform.mjs";
import taskReviewpr from "./tasks/review-pr.mjs";
import { Action } from "./actions.mjs";

declare global {
	namespace Project {
		interface SessionTasks {}
	}
}

export type SessionTaskDefinition<T extends SessionTask["type"], MappedTask = Project.SessionTasks[T], TypedSession = Session & { meta: MappedTask extends SessionTask ? SessionMeta<MappedTask> : never }> = {
	type: T;
	configElement: string;
	initializeSession?: (session: TypedSession) => Promise<void>;
	continueSession?: (session: TypedSession) => Promise<boolean>;
	getActions?: (session: TypedSession) => Array<Action> | undefined;
};

export const taskDefinitions = [taskNone, taskFreeform, taskReviewpr];
