import { registerComponent } from "@venajs/core";

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

export const taskDefinitions = [
  {
    type: 'none',
    configElement: NoneTaskConfig,
  },
  {
    type: 'freeform',
    configElement: FreeformTaskConfig,
  },
];