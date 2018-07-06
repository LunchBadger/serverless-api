
const EventSource = require('eventsource');
const debug = require('debug')('sls:git-listener');
const { revs, reset } = require('./git');
const executor = new (require('./lib/serverless-executor'))();
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

    if (statusUpdate.type === 'push' && statusUpdate.repoName === 'functions') {
        // Copy paste of exact same logic from lbws
        // The idea is to filter out events that have same commit hash as local
        // If commit was not driven by LB, then local version will not have such hash
        // And we expect that notification will arrive in reasonable time to compare with latest commits only
        // Local version can be ahead of master, that is ok and will be resolved on next push cycle
        // That is why we can't compare only top local commit
      debug(`local ${branch}`);
      if (statusUpdate.ref.indexOf('/' + branch) >= 0) {
        const revisions = revs();
        debug(`branch matched ${statusUpdate.ref}`);
          // revisions.length === 0 means that there were no local commits in the nearest past
          // and with events arrive in reasonable time we assume it is new
          // revisions.indexOf(statusUpdate.after) === -1 // no such commit found locally
        if (revisions.length === 0 || revisions.indexOf(statusUpdate.after) === -1) {
          debug('upstream revision changed, updating local repo');
          reset(branch);

          // now redeploy all services to be sure code propagated to k8s
          executor.deployAll();
        } else {
          debug('upstream version is the same as local');
        }
      }
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
