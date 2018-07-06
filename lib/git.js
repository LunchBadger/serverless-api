const path = require('path');
const debug = require('debug')('sls:git');
const wdPath = path.join(process.cwd(), 'workspace');
const simpleGit = require('simple-git')(wdPath);

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
  revs () {
    return new Promise((resolve, reject) => {
      simpleGit.log('--format="format:%H" --since="20 minutes"', (err, output) => {
        debug('local revisions log', output);
        if (err) return reject(err);

        resolve(output ? output.split('\n') : []);
      });
    });
  },
  reset () {
    return new Promise((resolve, reject) => {
      simpleGit.reset('hard', (err, output) => {
        debug('reset done', output);
        if (err) return reject(err);
        resolve(true);
      });
    });
  }
};
