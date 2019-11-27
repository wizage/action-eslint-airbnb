const core = require('@actions/core');
const github = require('@actions/github');
//const fs = require('fs');
const { GITHUB_WORKSPACE } = process.env
const eslint = require('eslint');

try {
  // var files = fs.readdirSync(GITHUB_WORKSPACE);

  const cli = new eslint.CLIEngine();
  console.log("here");

  const report = cli.executeOnFiles(['.']);

  console.log(report);
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  console.log(`Hello ${nameToGreet}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}