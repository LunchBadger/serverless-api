const express = require('express');
const app = express();
const cors = require('cors');
const debug = require('debug')('sls:main');
const Joi = require('joi');
const validate = require('express-validation');
const Executor = require('./lib/serverless-executor');
validate.options({
  status: 422,
  statusText: 'Unprocessable Entity'
});
require('./lib/git-listener')();
const kube = require('./lib/kube');
kube.ensureConfig(); // Loading ~/.kube/config based on k8s run secret for serviceAccount
app.use('/', cors({
  origin: true,
  methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Cache-Control', 'Content-Type', 'Accept', 'Authorization', 'Accept-Encoding', 'Access-Control-Request-Headers', 'User-Agent', 'Access-Control-Request-Method', 'Pragma', 'Connection', 'Host'],
  credentials: true
}));
app.use(express.json());

const startTime = new Date();
const executor = new Executor();
const validation = {
  createService: {
    body: {
      env: Joi.string().required(),
      version: Joi.string().required(),
      name: Joi.string().required()
    }
  },
  getService: {
    body: {
      name: Joi.string().required()
    }
  },
  deployService: {
    body: {
      name: Joi.string().required()
    }
  },
  updateServiceFiles: {
    body: {
      serverless: Joi.object().required(),
      files: Joi.object().required()
    }
  }
};

app.post('/service', validate(validation.createService), async (req, res, next) => {
  const name = req.body.name;
  try {
    await executor.createFromTemplate({
      name,
      template: req.body.env,
      version: req.body.version,
      meta: req.body.lunchbadger
    });
    const folderInfo = await executor.collectFiles(name);
    res.json(folderInfo);
  } catch (err) {
    debug(err);
    return next(err);
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

// remove all services
app.delete('/service', async (req, res, next) => {
  try {
    const result = await executor.deleteServices({author: req.headers.author});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get('/service/:name', async (req, res, next) => {
  try {
    const folderInfo = await executor.collectFiles(req.params.name);
    res.json(folderInfo);
  } catch (err) {
    next(err);
  }
});
app.get('/service/:name/logs', async (req, res, next) => {
  try {
    const folderInfo = await executor.logs({
      name: req.params.name
    });
    res.json({
      logs: folderInfo
    });
  } catch (err) {
    next(err);
  }
});

app.delete('/service/:name', async (req, res, next) => {
  try {
    const rx = await executor.removeService({
      name: req.params.name,
      author: req.headers.author
    });
    res.json(rx);
  } catch (err) {
    next(err);
  }
});
app.put('/service/:name', validate(validation.updateServiceFiles), async (req, res, next) => {
  try {
    await executor.updateFiles({
      name: req.params.name,
      data: req.body,
      author: req.headers.author});
    const freshState = await executor.collectFiles(req.params.name);
    res.json(freshState);
  } catch (err) {
    next(err);
  }
});

app.post('/deploy', validate(validation.deployService), async (req, res) => {
  const name = req.body.name;
  try {
    const r = await executor.deploy({
      name
    });
    res.json({
      processed: true,
      deployed: true,
      result: r
    });
  } catch (err) {
    debug(err);
    // Now we are hiding error instead of
    // res.status(400).json({ message: err.message, info: 'deploy failed', err });
    res.json({
      processed: true,
      deployed: false,
      error: err
    });
  }
});
app.delete('/deploy/:name', async (req, res) => {
  const name = req.params.name;
  try {
    const r = await executor.removeDeployment({
      name
    });
    res.json({
      processed: true,
      deployed: true,
      result: r
    });
  } catch (err) {
    // Now we are hiding error instead of
    // res.status(400).json({ message: err.message, info: `deploy ${name} failed` });
    debug(err);
    res.json({
      processed: true,
      deployed: false,
      error: err
    });
  }
});

app.get('/ping', (req, res) => res.json({
  uptime: (new Date() - startTime) / 1000
}));
app.use((err, req, res, next) => {
  debug(err);
  res.status(err.status || 400).json(err);
});

app.listen(4444, () => debug('Serverless API is running port 4444'));

process.on('unhandledRejection', error => {
  // Won't execute
  debug('unhandledRejection', error);
});
