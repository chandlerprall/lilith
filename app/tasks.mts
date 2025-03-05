import { Session, SessionMeta, SessionTask } from "./project.mjs";
import taskNone from "./tasks/review-pr.mjs";
import taskFreeform from "./tasks/review-pr.mjs";
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
};

export const taskDefinitions = [taskNone, taskFreeform, taskReviewpr];
