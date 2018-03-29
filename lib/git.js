const path = require('path');
const debug = require('debug')('sls:git');
const wdPath = path.join(process.cwd(), 'workspace');
const simpleGit = require('simple-git')(wdPath);
const fs = require('fs');

module.exports = {
  async commit ({msg, targetBranch = 'master'}) {
    debug(`Running ga -A; gcam msg; gp ${targetBranch}`);
    return new Promise((resolve, reject) => {
      simpleGit.add('-A', (err) => {
        if (err) return reject(err);

        simpleGit.commit(msg, (commitErr) => {
          if (commitErr) reject(commitErr);
          simpleGit.push('origin', targetBranch, pushErr => {
            if (pushErr) reject(pushErr);
            resolve({ok: true});
          });
        });
      });
    });
  },
  async clone () {
    try { // TODO: refactor
      fs.mkdirSync(wdPath);
    } catch (err) {
      debug('path exists skipping folder creation', wdPath, err);
    }
    // TODO: bugfix: this can clone into too deep /workpsace/workspace/...
    return simpleGit.clone(process.env.GIT_URL, wdPath);
  }
};
