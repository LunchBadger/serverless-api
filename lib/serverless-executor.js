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

const TARGET_NAMESPACE = process.env.LB_TARGET_NAMESPACE || 'customer';
const PRODUCER = process.env.LB_PRODUCER || 'unknown';

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
        resolve(stdout);
      });
    });
  }

  async createFromTemplate ({ name, template, version, meta = {} }) {
    const serverlessTemplateName = resolveTemplateName({template, version});
    await this.runCmd({
      cmd: `sls create --template ${serverlessTemplateName} --path workspace/${name}`,
      execOptions: { cwd: rootFolder }
    });
    const templateFoler = path.join(__dirname, 'templates', template);
    const templateFiles = await readdir(templateFoler);
    for (const fileName of templateFiles) {
      const filePath = path.join(templateFoler, fileName);
      let fileContent = await readFile(filePath, {encoding: 'UTF-8'});
      fileContent = fileContent.replace('FN_NAME', name);
      await writeFile(path.join(rootFolder, 'workspace', name, fileName), fileContent);
    }

    const cfgPath = path.join(rootFolder, 'workspace', name, 'serverless.yml');
    const data = await readFile(cfgPath);
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

    await writeFile(cfgPath, yaml.dump(serverlessCfg));
    return commit({msg: 'LB: initial template'});
  }
  async deploy ({ name }) {
    return this.runCmd({
      cmd: 'sls deploy',
      execOptions: { cwd: this.getServicePath(name) }
    }).then(x => commit({msg: 'LB: deploy'}));
  }
  async removeDeployment ({ name }) {
    return this.runCmd({
      cmd: 'sls remove -v',
      execOptions: { cwd: path.join(rootFolder, 'workspace', name) }
    }).then(x => commit({msg: 'LB: Deployment removed'}));
  }

  async removeService ({name}) {
    const servicePath = this.getServicePath(name);
    return new Promise(async (resolve, reject) => {
      if (!fs.existsSync(servicePath)) {
        resolve({msg: 'ALREADY_REMOVED'});
      }

      try {
        await this.removeDeployment({name});
        await rimraf(servicePath);
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
      await writeFile(path.join(rootPath, 'serverless.yml'), yaml.dump(data.serverless));
    }
    const promises = Object.keys(data.files).map(filename => {
      const filePath = path.join(rootPath, filename);
      if (!data.files[filename]) { // if key is present but falsy do delete the file
        return rmFile(filePath);
      }
      return writeFile(filePath, data.files[filename]);
    });

    return Promise.all(promises, commit({msg: 'LB: edit'}));
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

function resolveTemplateName ({template, version}) {
  if (template === 'node') {
    return 'kubeless-nodejs';
  }
  if (template === 'python') {
    return 'kubeless-python';
  }
  if (template === 'ruby') {
    return 'kubeless-ruby';
  }
}

module.exports = ServerlessExecutor;
