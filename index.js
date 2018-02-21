const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rmFile = promisify(fs.unlink);
const rimraf = promisify(require('rimraf'));
const yaml = require('js-yaml');
app.use(express.json());
const startTime = new Date();
const Executor = require('./lib/serverless-executor');
const rootDir = buildPath();
try { // TODO: refactor
  fs.mkdirSync(rootDir);
} catch (err) {
  console.log('path exists', rootDir);
}
if (!fs.existsSync('~/.kube/config')) {
  // then we are running in container as root
  fs.mkdirSync('/root/.kube');
  const tmpl = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'kube-config.template.json')));

  // This is localtion of credentials for service account running pod (default if not set)
  const ca = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');
  const token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token');

  tmpl.clusters[0].cluster['certificate-authority-data'] = ca;
  tmpl.users[0].user.token = token;
  fs.writeFileSync('/root/.kube/config', yaml.dump(tmpl));
}
app.post('/:id/service', async (req, res) => {
  const exectutor = new Executor();
  const servicePath = buildPath(req.params.id);
  try {
    await exectutor.createFromTemplate({ servicePath });
    const folderInfo = await collectFiles(servicePath);
    res.json(folderInfo);
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: err.message, info: 'recreate or update service' });
  }
});

app.get('/:id/service', async (req, res, next) => {
  const servicePath = buildPath(req.params.id);
  try {
    const folderInfo = await collectFiles(servicePath);
    res.json(folderInfo);
  } catch (err) {
    next(err);
  }
});

app.delete('/:id/service', async (req, res, next) => {
  const servicePath = buildPath(req.params.id);
  try {
    await rimraf(servicePath);
    res.json({ok: true});
  } catch (err) {
    next(err);
  }
});
app.put('/:id/service', async (req, res, next) => {
  const servicePath = buildPath(req.params.id);
  try {
    await updateFiles(servicePath, req.body);
    const freshState = await collectFiles(servicePath);
    res.json(freshState);
  } catch (err) {
    next(err);
  }
});

app.post('/:id/deploy', async (req, res) => {
  const exectutor = new Executor();
  const servicePath = buildPath(req.params.id);

  try {
    const r = await exectutor.deploy({ servicePath });
    res.send('Hello World!' + r);
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: err.message, info: 'deploy failed', err });
  }
});
app.delete('/:id/deploy', async (req, res) => {
  const exectutor = new Executor();
  const servicePath = buildPath(req.params.id);
  try {
    const r = await exectutor.removeDeployment({ servicePath });
    res.json({ok: true, result: r});
  } catch (err) {
    res.status(400).json({ message: err.message, info: 'deploy failed' });
  }
});

app.get('/ping', (req, res) => res.json({uptime: (new Date() - startTime) / 1000}));

app.listen(4444, () => console.log('Serverless API is running port 4444'));

function updateFiles (dirname, data) {
  const rootPath = path.join(__dirname, dirname);
  yaml.dump(data.serverless, { filename: path.join(rootPath, 'serverless.yml') });
  const promises = data.files.map(filename => {
    const filePath = path.join(rootPath, filename);
    if (!data.files[filename]) { // if key is present but falsy do delete the file
      return rmFile(filePath);
    }
    return writeFile(filePath, data.files[filename]);
  });

  return promises;
  // TODO: git commit
}

async function collectFiles (dirname) {
  const folderInfo = {
    files: {},
    serverless: {}
  };
  let filenames = await readdir(path.join(__dirname, dirname));
  // rm .gitignore, .serverless etc.
  filenames = filenames.filter(name => name.indexOf('.') > 0);

  const results = await Promise.all(filenames.map((filename) => {
    return readFile(path.join(__dirname, dirname, filename), 'utf-8')
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

function buildPath (parts = []) {
  if (!Array.isArray(parts)) {
    parts = [parts];
  }
  parts.unshift('workspace');
  const dirPath = path.join.apply(path.join, parts);
  return dirPath;
}
