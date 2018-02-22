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
        console.log('AAAA');

        resolve(commit({ msg: commitMsg || 'LB Edit' }));
      });
    });
  }

  async createFromTemplate ({ name }) {
    return this.runCmd({
      cmd: 'sls create --template kubeless-nodejs --path workspace/' + name,
      commitMsg: 'LB: initial template',
      execOptions: { cwd: rootFolder }
    });
  }
  async deploy ({ name }) {
    return this.runCmd({
      cmd: 'sls deploy',
      commitMsg: 'deploy',
      execOptions: { cwd: path.join(rootFolder, 'workspace', name) }
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
    return fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory());
  };

  getServicePath (name) {
    return path.join(rootFolder, 'workspace', name);
  }

  async updateFiles (dirname, data) {
    const rootPath = path.join(__dirname, dirname);
    yaml.dump(data.serverless, { filename: path.join(rootPath, 'serverless.yml') });
    const promises = data.files.map(filename => {
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
    let filenames = await readdir(path.join(__dirname, srvName));
    // rm .gitignore, .serverless etc.
    filenames = filenames.filter(name => name.indexOf('.') > 0);

    const results = await Promise.all(filenames.map((filename) => {
      return readFile(path.join(__dirname, srvName, filename), 'utf-8')
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
