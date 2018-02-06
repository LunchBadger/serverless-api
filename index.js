const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
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

app.post('/:id/deploy', async (req, res) => {
  const exectutor = new Executor();
  const servicePath = buildPath(req.params.id);
  const r = await exectutor.deploy({servicePath});
  res.send('Hello World!' + r);
});
app.listen(4444, () => console.log('Serverless API is running'));

async function collectFiles (dirname) {
  const folderInfo = {};
  console.log(__dirname);

  const filenames = await readdir(path.join(__dirname, dirname));
  const results = await Promise.all(filenames.map((filename) => {
    return readFile(path.join(__dirname, dirname, filename), 'utf-8').then(content => { return { filename, content }; });
  }));

  for (const r of results) {
    folderInfo[r.filename] = r.content;
  }
  return folderInfo;
}

function buildPath (parts = []) {
  if (!Array.isArray(parts)) {
    parts = [parts];
  }
  parts.unshift('./workspace');
  const dirPath = path.join.apply(path.join, parts);
  return dirPath;
}
