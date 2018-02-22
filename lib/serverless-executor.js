const { exec } = require('child_process');
const path = require('path');
const debug = require('debug')('sls:engine');
const wdPath = path.join(__dirname, '..', 'workspace');
console.log(wdPath);
try {
  require('fs').mkdirSync(wdPath);
} catch (err) {
  console.log(err); // fine if exits
}
const rootFolder = process.cwd();

const simpleGit = require('simple-git')(wdPath);
simpleGit.clone(process.env.GIT_URL, wdPath);
// TODO fail if not cloned

class ServerlessExecutor {
  async runCmd ({cmd, commitMsg, execOptions}) {
    return new Promise((resolve, reject) => {
      exec(cmd, execOptions, (err, stdout, stderr) => {
        if (err) {
          debug(err, stderr, stdout);
          return reject(err);
        }
        return this.commit(commitMsg || 'LB Edit');
      });
    });
  }
  async commit (msg) {
    console.log('Running git');
    await simpleGit.add('-A');
    await simpleGit.commit(msg);
    return simpleGit.push(['origin', 'master']);
  }
  async createFromTemplate ({ name }) {
    return this.runCmd({
      cmd: 'sls create --template kubeless-nodejs --path workspace/' + name,
      commitMsg: 'LB: initial template',
      execOptions: { cwd: rootFolder }
    });
  }
  async deploy ({name}) {
    return this.runCmd({
      cmd: 'sls deploy',
      commitMsg: 'deploy',
      execOptions: { cwd: path.join(rootFolder, 'workspace', name) }
    });
  }
  async removeDeployment ({name}) {
    return this.runCmd({
      cmd: 'sls remove -v',
      commitMsg: 'Deployment removed',
      execOptions: { cwd: path.join(rootFolder, 'workspace', name) }
    });
  }
}

module.exports = ServerlessExecutor;
