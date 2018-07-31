
const EventSource = require('eventsource');
const debug = require('debug')('sls:git-listener');
const { reset, latestRev } = require('./git');
const executor = new (require('./serverless-executor'))();
const kube = require('./kube');
module.exports = function () {
  const branch = 'master';
  const watchUrl = (process.env.WATCH_URL ||
    'http://localhost:3002/change-stream/demo');
  let connected = false;
  const es = new EventSource(watchUrl);
  es.addEventListener('data', async message => {
    debug('SSE event inbound');
    const statusUpdate = JSON.parse(message.data);
    debug(statusUpdate);

    if (statusUpdate.type === 'push' && statusUpdate.repoName === 'functions' &&
      statusUpdate.isExternal) {
      try {
        const prevServices = await executor.listServices();
        debug('Prev Services', prevServices);
        await reset(branch);
        debug('reset done to', await latestRev());
        const updatedServices = await executor.listServices();
            // compare and remove functions that were removed in code
        const deletedNames = findDeleted(prevServices, updatedServices);
        debug('functions to deleted ');
        await Promise.all(deletedNames.map(name => kube.deleteFunction({ name })));

        // now redeploy all services to be sure code propagated to k8s
        debug('starting redeployment');
        await executor.deployAll();
      } catch (err) {
        console.log(err);
      }
    } else {
      debug('upstream version is the same as local');
    }
  });

  es.addEventListener('open', () => {
    if (!connected) {
      debug('connected to configstore');
      connected = true;
    }
  });

  es.addEventListener('error', (_err) => {
    if (connected !== false) {
      debug('disconnected from configstore');
      connected = false;
    }
  });
};

function findDeleted (prevServices, updatedServices) {
  const prevFns = prevServices.reduce((acc, x) => acc.concat(Object.keys(x.serverless.functions)), []);
  const updatedFns = updatedServices.reduce((acc, x) => acc.concat(Object.keys(x.serverless.functions)), []);
  return prevFns.filter(f => updatedFns.indexOf(f) === -1);
}
