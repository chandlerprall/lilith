import { registerComponent } from "@venajs/core";

const { execSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, rmSync } = require('fs');
const path = require('path');
const os = require('os');

const NoneTaskConfig = registerComponent('l-task-none-config', ({ render, element, refs }) => {
  Object.defineProperty(element, 'value', {
    get() {
      return {
        type: 'none',
      };
    }
  });

  render`
    <style>
      :host {
        display: none;
      }
    </style>
  `;
});

const FreeformTaskConfig = registerComponent('l-task-freeform-config', ({ render, element, refs }) => {
  Object.defineProperty(element, 'value', {
    get() {
      return {
        type: 'freeform',
        title: refs.title.value,
        description: refs.description.value,
      };
    }
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

const ReviewPRTaskConfig = registerComponent('l-task-review-pr-config', ({ render, element, refs }) => {
  Object.defineProperty(element, 'value', {
    get() {
      return {
        type: 'review-pr',
        url: refs.url.value,
        instructions: refs.instructions.value,
      };
    }
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

export const taskDefinitions = [
  {
    type: 'none',
    configElement: NoneTaskConfig,
  },
  {
    type: 'freeform',
    configElement: FreeformTaskConfig,
  },
  {
    type: 'review-pr',
    configElement: ReviewPRTaskConfig,
    initializeSession: async (session) => {
      const start = Date.now();
      const prDetailsString = execSync(`gh pr view ${session.meta.task.url} --json title,body,files,baseRefOid,headRefName,headRefOid,headRepository,headRepositoryOwner`).toString();
      const prDetails = JSON.parse(prDetailsString);

      const repo = `${prDetails.headRepositoryOwner.login}/${prDetails.headRepository.name}`;
      const repoUrl = `git@github.com:${repo}.git`;
      const sourceBranch = prDetails.headRefName;

      const tmpDir = path.join(os.tmpdir(), '__lilith_git');

      if (existsSync(tmpDir)) {
        readdirSync(tmpDir).forEach(f => rmSync(path.join(tmpDir, f), { recursive: true }));
      }

      mkdirSync(tmpDir, { recursive: true });

      // clone the commit from the repo
      execSync(`git clone ${repoUrl} --branch ${sourceBranch} --single-branch .`, { cwd: tmpDir });

      // update instructions
      const originalInstructions = session.meta.task.instructions;

      session.meta.task.checkoutDirectory = tmpDir;
      session.meta.task.prDetails = prDetails;
      console.log(session.meta.task);

      const end = Date.now();
      console.log('Time taken:', end - start, 'ms');
    }
  },
];