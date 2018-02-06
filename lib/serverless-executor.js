const S = require('serverless');

class ServerlessExecutor {
  async createTemplate () {
    const s = this.initiateServerless();
    s.inputArray = ['create', '--template', 'kubeless-nodejs', '--path', './x'];
    s.init().then(res => {
      console.log(res);
      return s.run();
    });
  }
  async deploy (config) {
    const s = this.initiateServerless(config);
    s.inputArray = ['deploy'];
    s.init(config).then(res => {
      console.log(res);
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
