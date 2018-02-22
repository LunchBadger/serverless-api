const express = require('express');
const app = express();
const cors = require('cors');
const debug = require('debug')('sls:main');
const kube = require('./lib/kube');
kube.ensureConfig(); // Loading ~/.kube/config based on k8s run secret for serviceAccount

const git = require('./lib/git');
git.clone();

app.use('/', cors({
  origin: true,
  methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Cache-Control', 'Content-Type', 'Accept', 'Authorization', 'Accept-Encoding', 'Access-Control-Request-Headers', 'User-Agent', 'Access-Control-Request-Method', 'Pragma', 'Connection', 'Host'],
  credentials: true
}));
app.use(express.json());

const startTime = new Date();
const executor = new (require('./lib/serverless-executor'))();

app.post('/service', async (req, res) => {
  const name = req.body.name;
  try {
    await executor.createFromTemplate({name, template: req.body.template});
    const folderInfo = await executor.collectFiles(name);
    res.json(folderInfo);
  } catch (err) {
    debug(err);
    res.status(400).json({ message: 'FAILED_RECREATE_OR_UPDATE_SERVICE' });
  }
});

app.get('/service', async (req, res, next) => {
  try {
    const folders = await executor.listServices();
    res.json(folders);
  } catch (err) {
    next(err);
  }
});

app.get('/:name/service', async (req, res, next) => {
  try {
    const folderInfo = await executor.collectFiles(req.params.name);
    res.json(folderInfo);
  } catch (err) {
    next(err);
  }
});

app.delete('/:name/service', async (req, res, next) => {
  try {
    const rx = await executor.removeService({name: req.params.name});
    res.json(rx);
  } catch (err) {
    next(err);
  }
});
app.put('/:name/service', async (req, res, next) => {
  try {
    await executor.updateFiles(req.params.name, req.body);
    const freshState = await executor.collectFiles(req.params.name);
    res.json(freshState);
  } catch (err) {
    next(err);
  }
});

app.post('/:name/deploy', async (req, res) => {
  const name = req.params.name;
  try {
    const r = await executor.deploy({ name });
    res.send('Hello World!' + r);
  } catch (err) {
    res.status(400).json({ message: err.message, info: 'deploy failed', err });
  }
});
app.delete('/:name/deploy', async (req, res) => {
  const name = req.params.name;
  try {
    const r = await executor.removeDeployment({ name });
    res.json({ok: true, result: r});
  } catch (err) {
    res.status(400).json({ message: err.message, info: `deploy ${name} failed` });
  }
});

app.get('/ping', (req, res) => res.json({uptime: (new Date() - startTime) / 1000}));

app.listen(4444, () => console.log('Serverless API is running port 4444'));

process.on('unhandledRejection', error => {
  // Won't execute
  console.log('unhandledRejection', error);
});
