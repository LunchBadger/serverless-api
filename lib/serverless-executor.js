const { exec } = require('child_process');
const path = require('path');
const debug = require('debug')('sls:engine');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { commit } = require('./git');
const DirectoryAsObject = require('directory-as-object');

const TARGET_NAMESPACE = process.env.LB_TARGET_NAMESPACE || 'customer';
const PRODUCER = process.env.LB_PRODUCER || 'unknown';

const rootFolder = process.cwd();

class ServerlessExecutor {
  async runCmd ({ cmd, commitMsg, execOptions }) {
    return new Promise((resolve, reject) => {
      exec(cmd, execOptions, (err, stdout, stderr) => {
        if (err) {
          debug(err, stderr, stdout);
          return reject(err);
        }
        resolve(stdout);
      });
    });
  }

  async createFromTemplate ({ name, template, version, meta = {} }) {
    const serverlessTemplateName = resolveTemplateName({template, version});
    await fs.copy(serverlessTemplateName, path.join('..', 'workspace', name));
    await this.runCmd({
      cmd: `sls create --template ${serverlessTemplateName} --path workspace/${name}`,
      execOptions: { cwd: rootFolder }
    });
    const templateFoler = path.join(__dirname, 'templates', template);
    const templateFiles = await fs.readdir(templateFoler);
    for (const fileName of templateFiles) {
      const filePath = path.join(templateFoler, fileName);
      let fileContent = await fs.readFile(filePath, {encoding: 'UTF-8'});
      fileContent = fileContent.replace('FN_NAME', name);
      await fs.writeFile(path.join(rootFolder, 'workspace', name, fileName), fileContent);
    }

    const cfgPath = path.join(rootFolder, 'workspace', name, 'serverless.yml');
    const data = await fs.readFile(cfgPath);
    const serverlessCfg = yaml.load(data);
    serverlessCfg.provider.namespace = TARGET_NAMESPACE;
    serverlessCfg.functions = { };
    serverlessCfg.lunchbadger = meta;
    serverlessCfg.functions[`fn-${PRODUCER}-dev-${name}`] = {
      labels: {
        producer: PRODUCER,
        env: 'dev',
        app: 'kubeless-fn'
      },
      handler: 'handler.' + name
    };

    await fs.writeFile(cfgPath, yaml.dump(serverlessCfg));
    return commit({msg: 'LB: initial template'});
  }
  async deploy ({ name }) {
    return this.runCmd({
      cmd: 'sls deploy',
      execOptions: { cwd: this.getServicePath(name) }
    });
  }
  async deployAll () {
    const srvs = await this.listServices();
    for (const s in srvs) {
      await this.deploy({s});
    }
  }
  async removeDeployment ({ name }) {
    return this.runCmd({
      cmd: 'sls remove -v',
      execOptions: { cwd: path.join(rootFolder, 'workspace', name) }
    });
  }
  async listDeployments () {
    return this.runCmd({
      cmd: 'sls deploy list functions -v',
      execOptions: { cwd: path.join(rootFolder, 'workspace') }
    });
  }

  async removeService ({name}) {
    const servicePath = this.getServicePath(name);
    return new Promise(async (resolve, reject) => {
      if (!fs.existsSync(servicePath)) {
        resolve({msg: 'ALREADY_REMOVED'});
      }

      try {
        await this.removeDeployment({name});
        await fs.remove(servicePath);
        await commit({msg: `LB: service ${name} removed`});
        resolve({msg: 'REMOVED'});
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteServices () {
    const folders = await this.getFolders(path.join(rootFolder, 'workspace'));
    return Promise.all(folders.map(name => this.removeService({name})));
  }

  async listServices () {
    const folders = await this.getFolders(path.join(rootFolder, 'workspace'));
    return Promise.all(folders.map(f => this.collectFiles(f)));
  }

  async getFolders (p) {
    return fs.readdirSync(p).filter(f => {
      if (!fs.statSync(path.join(p, f)).isDirectory()) {
        return false;
      }

      if (f.indexOf('.') === 0) {
        return false;
      }

      return true;
    });
  };

  getServicePath (name) {
    return path.join(rootFolder, 'workspace', name);
  }

  async updateFiles (name, data) {
    const rootPath = this.getServicePath(name);
    if (data.serverless && data.serverless.functions) { // Check to disable empty config rewrite
      await fs.writeFile(path.join(rootPath, 'serverless.yml'), yaml.dump(data.serverless));
    }
    const dirAsObject = new DirectoryAsObject({rootPath});
    return dirAsObject.deserialize(data.files).then(() => commit({msg: 'LB: edit'}));
  }

  async collectFiles (srvName) {
    const folderInfo = {
      serverless: {},
      files: {}
    };
    const dirAsObject = new DirectoryAsObject({
      rootPath: this.getServicePath(srvName),
      ignorePatterns: [/\.serverless/]
    });

    const files = await dirAsObject.serialize();
    if (files['serverless.yml']) {
      folderInfo.serverless = yaml.load(files['serverless.yml']);
      delete files['serverless.yml'];
    }
    folderInfo.files = files;
    return folderInfo;
  }
}

function resolveTemplateName ({template, version}) {
  if (template === 'node') {
    return path.join('templates', 'node', 'v8');
  }
  if (template === 'python') {
    return path.join('templates', 'python', 'v27');
  }
  if (template === 'ruby') {
    return 'kubeless-ruby';
  }
}

module.exports = ServerlessExecutor;
