const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const debug = require('debug')('sls:engine');
const fs = require('fs');
const writeFile = promisify(fs.writeFile);
const rmFile = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const rimraf = promisify(require('rimraf'));
const yaml = require('js-yaml');

const { commit } = require('./git');

const rootFolder = process.cwd();

// TODO fail if not cloned

class ServerlessExecutor {
  async runCmd ({ cmd, commitMsg, execOptions }) {
    return new Promise((resolve, reject) => {
      exec(cmd, execOptions, (err, stdout, stderr) => {
        if (err) {
          debug(err, stderr, stdout);
          return reject(err);
        }
        resolve(commit({ msg: commitMsg || 'LB Edit' }));
      });
    });
  }

  async createFromTemplate ({ name }) {
    await this.runCmd({
      cmd: 'sls create --template kubeless-nodejs --path workspace/' + name,
      commitMsg: 'LB: initial template',
      execOptions: { cwd: rootFolder }
    });
    const cfgPath = path.join(rootFolder, 'workspace', name, 'serverless.yml');
    const data = await readFile(cfgPath);
    const serverlessCfg = yaml.load(data);
    serverlessCfg.provider.namespace = 'customer';
    return writeFile(cfgPath, yaml.dump(serverlessCfg));
  }
  async deploy ({ name }) {
    return this.runCmd({
      cmd: 'sls deploy',
      commitMsg: 'deploy',
      execOptions: { cwd: this.getServicePath(name) }
    });
  }
  async removeDeployment ({ name }) {
    return this.runCmd({
      cmd: 'sls remove -v',
      commitMsg: 'Deployment removed',
      execOptions: { cwd: path.join(rootFolder, 'workspace', name) }
    });
  }

  async removeService ({name}) {
    const servicePath = this.getServicePath(name);
    return new Promise(async (resolve, reject) => {
      if (!fs.existsSync(servicePath)) {
        resolve({msg: 'ALREADY_REMOVED'});
      }

      try {
        await rimraf(servicePath);
        await commit({msg: `LB: service ${name} removed`});
        resolve({msg: 'REMOVED'});
      } catch (err) {
        reject(err);
      }
    });
  }

  async listServices () {
    return this.getFolders(path.join(rootFolder, 'workspace'));
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
    yaml.dump(data.serverless, { filename: path.join(rootPath, 'serverless.yml') });
    const promises = Object.keys(data.files).map(filename => {
      const filePath = path.join(rootPath, filename);
      if (!data.files[filename]) { // if key is present but falsy do delete the file
        return rmFile(filePath);
      }
      return writeFile(filePath, data.files[filename]);
    });

    return Promise.all(promises);
    // TODO: git commit
  }

  async collectFiles (srvName) {
    const folderInfo = {
      files: {},
      serverless: {}
    };
    let filenames = await readdir(this.getServicePath(srvName));
    // rm .gitignore, .serverless etc.
    filenames = filenames.filter(name => name.indexOf('.') > 0);

    const results = await Promise.all(filenames.map((filename) => {
      return readFile(path.join(this.getServicePath(srvName), filename), 'utf-8')
        .then(content => { return { filename, content }; });
    }));

    for (const r of results) {
      // TBD, potentially some other files are special cases
      if (r.filename === 'serverless.yml') {
        folderInfo.serverless = yaml.load(r.content);
        continue;
      }

      folderInfo.files[r.filename] = r.content;
    }
    return folderInfo;
  }
}

module.exports = ServerlessExecutor;
