/* eslint-disable no-console */
const scallop = require('./lib/index.js');
const git = scallop('git');
const curl = scallop('curl', {silent: true});
const ls = scallop('ls', '-1');

(async () => {
  git.defineSubcommands('status', 'add', 'rm', 'clone');
  let out, err;
  void err; // silence eslint about this not being used anywhere yet

  console.log('$ git status');
  [out, err] = await git.status();
  console.log(out);

  console.log('$ git status -s');
  [out, err] = await git.status('-s');
  console.log(out);

  console.log("$ curl --silent 'http://httpbin.org/user-agent'");
  [out, err] = await curl('http://httpbin.org/user-agent');
  console.log(out);

  console.log('$ ' + ls);
  [out, err] = await ls();
  console.log(out);

  console.log('$ false');
  try {
    [out, err] = await scallop('false')();
  } catch (ex) {
    console.trace(ex);
    console.log();
  }

  // if node is run with `--harmony` or `--harmony-proxies`
  if (typeof Proxy !== 'undefined') {
    console.log('$ git status # using harmony proxies');
    [out, err] = await scallop.git.status();
    console.log(out);
  } else {
    console.log('$ # Run with `--harmony-proxies` to test proxy functionality');
  }
})();
