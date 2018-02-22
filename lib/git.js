const path = require('path');
const debug = require('debug')('sls:git');
const wdPath = path.join(__dirname, '..', 'workspace');
const simpleGit = require('simple-git')(wdPath);
const fs = require('fs');

module.exports = {
  async commit ({msg, targetBranch = ['origin', 'master']}) {
    debug('Running git');
    await simpleGit.add('-A');
    await simpleGit.commit(msg);
    return simpleGit.push(targetBranch);
  },
  async clone () {
    try { // TODO: refactor
      fs.mkdirSync(wdPath);
    } catch (err) {
      debug('path exists skipping folder creation', wdPath);
    }
    return simpleGit.clone(process.env.GIT_URL, wdPath);
  }
};
