const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rmFile = promisify(fs.unlink);
const yaml = require('js-yaml');
app.use(express.json());

const Executor = require('./lib/serverless-executor');
const rootDir = buildPath();
try { // TODO: refactor
  fs.mkdirSync(rootDir);
} catch (err) {
  console.log('path exists', rootDir);
}
app.post('/:id/service', async (req, res) => {
  const exectutor = new Executor();
  const servicePath = buildPath(req.params.id);
  try {
    await exectutor.createFromTemplate({servicePath});
  } catch (err) {
    console.log(err.message);
    res.status(400).json({message: err.message, info: 'recreate or update service'});
  }
  const folderInfo = await collectFiles(servicePath);
  res.json(folderInfo);
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
app.put('/:id/service', async (req, res, next) => {
  const servicePath = buildPath(req.params.id);
  try {
    updateFiles(servicePath, req.body);
    res.json(collectFiles(servicePath));
  } catch (err) {
    next(err);
  }
});

app.post('/:id/deploy', async (req, res) => {
  const exectutor = new Executor();
  const servicePath = buildPath(req.params.id);
  try {
    const r = await exectutor.deploy({servicePath});
    res.send('Hello World!' + r);
  } catch (err) {
    console.log(err.message);
    res.status(400).json({message: err.message, info: 'deploy failed'});
  }
});
app.listen(4444, () => console.log('Serverless API is running'));

async function updateFiles (dirname, data) {
  const rootPath = path.join(__dirname, dirname);
  yaml.dump(data.serverless, {filename: path.join(rootPath, 'serverless.yml')});
  for (const filename in data.files) {
    const filePath = path.join(__dirname, filename);
    if (!data.files[filename]) { // if key is present but falsy do delete the file
      rmFile(filePath);
      continue;
    }
    writeFile(filePath);
  }
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
