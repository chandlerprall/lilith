import { Session, SessionMeta, SessionTask } from "./project.mjs";
import taskNone from "./tasks/none.mjs";
import taskFreeform from "./tasks/freeform.mjs";
import taskReviewpr from "./tasks/review-pr.mjs";

declare global {
	namespace Project {
		interface SessionTasks {}
	}
}

export type SessionTaskDefinition<T extends SessionTask["type"], MappedTask = Project.SessionTasks[T]> = {
	type: T;
	configElement: string;
	initializeSession?: (session: Session & { meta: MappedTask extends SessionTask ? SessionMeta<MappedTask> : never }) => Promise<void>;
	continueSession?: (session: Session & { meta: MappedTask extends SessionTask ? SessionMeta<MappedTask> : never }) => Promise<boolean>;
};

export const taskDefinitions = [taskNone, taskFreeform, taskReviewpr];
