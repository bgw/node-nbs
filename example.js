/* eslint-disable no-console, handle-callback-err */
const sh = require('./lib/index.js');
const git = sh('git');
const curl = sh('curl', {silent: true});
const ls = sh('ls', '-1');

git.defineSubcommands('status', 'add', 'rm', 'clone');

git.status((err, res) => {
  console.log('$ git status');
  console.log(res);
});

git.status('-s', (err, res) => {
  console.log('$ git status -s');
  console.log(res);
});

curl('http://httpbin.org/user-agent', (err, res) => {
  console.log("$ curl --silent 'http://httpbin.org/user-agent'");
  console.log(res);
});

ls((err, res) => {
  console.log('$ ' + ls);
  console.log(res);
});

sh('false')((err, res) => {
  console.log('$ false');
  console.trace(err);
  console.log();
});

// if node is run with `--harmony` or `--harmony-proxies`
if (typeof Proxy !== 'undefined') {
  sh.git.status((err, res) => {
    console.log('$ git status # using harmony proxies');
    console.log(res);
  });
} else {
  console.log('$ # Run with `--harmony-proxies` to test proxy functionality');
}
