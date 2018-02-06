const express = require('express');
const app = express();
const Executor = require('./lib/serverless-executor');
// const config = {
//   servicePath: '/Users/apple/lb/serverless-kubeless/examples/post-nodejs'
// };
const exectutor = new Executor();
exectutor.deploy({servicePath: '/Users/apple/lb/serverless-api/x'});
// exectutor.createTemplate({}).then(r => {
//   console.log(r);
//   exectutor = new Executor();
//   return exectutor.deploy({servicePath: '/Users/apple/lb/serverless-api/x'});
// }).then(r => console.log(r));
app.get('/', (req, res) => res.send('Hello World!'));

app.listen(4444, () => console.log('Serverless API is running'));
