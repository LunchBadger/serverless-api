const S = require('serverless');
const path = require('path');
class ServerlessExecutor {
  async createFromTemplate (config) {
    const s = this.initiateServerless();
    s.inputArray = ['create', '--template', 'kubeless-nodejs', '--path', config.servicePath];
    return s.init().then(res => {
      return s.run();
    });
  }
  async deploy (config) {
    config.servicePath = path.join(__dirname, '..', config.servicePath);
    const s = this.initiateServerless(config);
    s.inputArray = ['deploy'];
    return s.init(config).then(res => {
      return s.run();
    });
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
