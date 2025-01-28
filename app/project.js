import { ProxySignal } from '@venajs/core';

const { writeFileSync } = require('fs');
const projectFilePath = '/Users/chandlerprall/projects/calc/project.json';
const project = require(projectFilePath)

project.issues = new ProxySignal(project.issues);

export default project

export const writeIssue = (name, definition) => {
  let returnedIssue;

  const existingIdx = project.issues.value.findIndex(issue => issue.name === name);
  if (existingIdx !== -1) {
    project.issues.value[existingIdx].definition = definition;
    returnedIssue = project.issues.value[existingIdx];
  } else {
    const existingIds = new Set(project.issues.value.map(issue => issue.id));

    let id;
    while (id == null || existingIds.has(id)) {
      id = quickRandomId();
    }

    returnedIssue = { id, name, definition };
    project.issues.push(returnedIssue);
  }

  writeProject();

  return returnedIssue;
}

export const closeIssue = (id) => {
  const existingIdx = project.issues.value.findIndex(issue => issue.id === id);
  if (existingIdx !== -1) {
    project.issues.value[existingIdx].closed = true;
  } else {
    throw new Error(`Issue ${id} not found`);
  }

  writeProject();
}

function quickRandomId(length = 6) {
  return Math.random().toString(36).substring(2, 2 + length);
}

export const updateLog = (msg) => {
  project.log.push(msg);
  writeProject();
}

export const clearLog = () => {
  project.log = [];
  writeProject();
}

const writeProject = () => {
  writeFileSync(projectFilePath, JSON.stringify(project, null, 2));
}