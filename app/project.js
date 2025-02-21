import { ProxySignal } from '@venajs/core';
import { getId } from './utils/id.js';

const { writeFileSync } = require('fs');
const projectFilePath = '/Users/chandlerprall/projects/lilith-projects/game.json';
const project = require(projectFilePath)

project.issues = new ProxySignal(project.issues);

export const sessions = new ProxySignal(project.sessions);
sessions.on(writeProject);

export const getSessionById = id => sessions.value.find(session => session.id === id);

export default project

export const writeIssue = (name, definition) => {
  let returnedIssue;

  const existingIdx = project.issues.value.findIndex(issue => issue.name === name);
  if (existingIdx !== -1) {
    project.issues.value[existingIdx].definition = definition;
    returnedIssue = project.issues.value[existingIdx];
  } else {
    const existingIds = new Set(project.issues.value.map(issue => issue.id));
    const id = getId(existingIds);
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

export const updateLog = (msg) => {
  project.log.push(msg);
  writeProject();
}

export const clearLog = () => {
  project.log = [];
  writeProject();
}

function writeProject() {
  writeFileSync(projectFilePath, JSON.stringify(project, null, 2));
}

export const setKnowledgeBase = (knowledgeBase) => {
  project.knowledgeBase = knowledgeBase;
  writeProject();
}