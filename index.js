/* eslint-disable no-restricted-syntax */
const core = require('@actions/core');
const eslint = require('eslint');
const request = require('./request');

const { GITHUB_SHA, GITHUB_EVENT_PATH, GITHUB_WORKSPACE } = process.env;
const event = require(GITHUB_EVENT_PATH);
const { repository } = event;
const {
  owner: { login: owner },
} = repository;
const { name: repo } = repository;

const checkName = 'ESLint check';

const GITHUB_TOKEN = core.getInput('repo-token');

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github.antiope-preview+json',
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  'User-Agent': 'eslint-action',
};

async function createCheck() {
  const body = {
    name: checkName,
    head_sha: GITHUB_SHA,
    status: 'in_progress',
    started_at: new Date(),
  };

  const { data } = await request(`https://api.github.com/repos/${owner}/${repo}/check-runs`, {
    method: 'POST',
    headers,
    body,
  });
  const { id } = data;
  return id;
}

async function getChangedFiles() {
  const branch = event.pull_request.base.ref;
  const util = require('util'),
			exec = util.promisify(require('child_process').exec),
			{ stdout } = await exec(
				`git diff origin/${branch}... --name-only --diff-filter=d`
			);
		return stdout.trim().split('\n');
}

function runESLint() {
  const cli = new eslint.CLIEngine();
  const files = getChangedFiles();
  const report = cli.executeOnFiles(files);
  // fixableErrorCount, fixableWarningCount are available too
  const { results, errorCount, warningCount } = report;

  const levels = ['', 'warning', 'failure'];

  const annotations = [];
  for (const result of results) {
    const { filePath, messages } = result;
    const path = filePath.substring(GITHUB_WORKSPACE.length + 1);
    for (const msg of messages) {
      const {
        line, severity, ruleId, message,
      } = msg;
      const annotationLevel = levels[severity];
      annotations.push({
        path,
        start_line: line,
        end_line: line,
        annotation_level: annotationLevel,
        message: `[${ruleId}] ${message}`,
      });
    }
  }

  return {
    conclusion: errorCount > 0 ? 'failure' : 'success',
    output: {
      title: checkName,
      summary: `${errorCount} error(s), ${warningCount} warning(s) found`,
      annotations,
    },
  };
}

async function updateCheck(id, conclusion, output) {
  // if (output && 'annotations' in output) {
  //   const { annotations } = output;
  //   while (annotations.length >= 50) {
  //     const newAnnotations = annotations.splice(0, 50);
  //     const newOutput = output;
  //     newOutput.annotations = newAnnotations;
  //     const body = {
  //       name: checkName,
  //       head_sha: GITHUB_SHA,
  //       newOutput,
  //     };

  //     await request(`https://api.github.com/repos/${owner}/${repo}/check-runs/${id}`, {
  //       method: 'PATCH',
  //       headers,
  //       body,
  //     });
  //   }
  //   output.annotations = annotations;
  // }

  const body = {
    name: checkName,
    head_sha: GITHUB_SHA,
    status: 'completed',
    completed_at: new Date(),
    conclusion,
    output,
  };

  await request(`https://api.github.com/repos/${owner}/${repo}/check-runs/${id}`, {
    method: 'PATCH',
    headers,
    body,
  });
}

function exitWithError(err) {
  console.error('Error', err.stack);
  if (err.data) {
    console.error(err.data);
  }
  process.exit(1);
}

async function run() {
  const id = await createCheck();
  try {
    const { conclusion, output } = runESLint();
    console.log(output.summary);
    await updateCheck(id, conclusion, output);
    if (conclusion === 'failure') {
      process.exit(78);
    }
  } catch (err) {
    await updateCheck(id, 'failure');
    exitWithError(err);
  }
}

run().catch(exitWithError);
