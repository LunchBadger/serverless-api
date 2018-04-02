module.exports = {
  FN_NAME (req, res) {
    let body = [];
    req.on('error', (err) => {
      console.error(err);
    }).on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(body).toString();
      res.end('LunchBadger Function' + body);
    });
  }
};
