const S = require('serverless');
const path = require('path');
const wdPath = path.join(__dirname, '..', 'workspace');
console.log(wdPath);
try {
  require('fs').mkdirSync(wdPath);
} catch (err) {
  console.log(err); // fine if exits
}

const simpleGit = require('simple-git')(wdPath);
simpleGit.clone(process.env.GIT_URL, wdPath);
// TODO fail if not cloned

async function commit (msg) {
  console.log('Running git');

  await simpleGit.add('-A');
  await simpleGit.commit(msg);
  return simpleGit.push(['origin', 'master']);
}

class ServerlessExecutor {
  async createFromTemplate (config) {
    const s = this.initiateServerless();
    s.inputArray = ['create', '--template', 'kubeless-nodejs', '--path', config.servicePath];
    return s.init().then(res => {
      return s.run();
    }).then(commit('initial template'));
  }
  async deploy (config) {
    config.servicePath = path.join(__dirname, '..', config.servicePath);
    const s = this.initiateServerless(config);
    s.inputArray = ['deploy'];
    return s.init(config).then(res => {
      return s.run();
    }).then(commit('deployed'));
  }
  async removeDeployment (config) {
    config.servicePath = path.join(__dirname, '..', config.servicePath);
    const s = this.initiateServerless(config);
    s.inputArray = ['remove -v'];
    return s.init(config).then(res => {
      return s.run();
    }).then(commit('deployement removed'));
  }
  initiateServerless (config) {
    const s = new S(config);
    const OriginalCLI = s.classes.CLI;
    s.classes.CLI = function (_this) {
      return new OriginalCLI(_this, _this.inputArray);
    };
    return s;
  }
}

module.exports = ServerlessExecutor;
