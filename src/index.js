const _ = require('lodash');
const childProcess = require('child_process');
const events = require('events');
const buffer = require('buffer');
const glob = require('glob');
const {proxyCreate} = require('./proxy');

const sh = proxyCreate(function _sh(command) {
  // Argument Parsing
  const partials = [].slice.call(arguments, 1);
  const partialKwargs = _.isPlainObject(_.last(partials)) ? partials.pop() : {};
  let wrapperInstance;

  wrapperInstance = function(...args) {
    // late binding
    wrapper.apply(wrapperInstance, args);
  };
  _.extend(wrapperInstance, {command, partials, partialKwargs}, wrapperProto);

  if (typeof Proxy !== 'undefined') {
    wrapperInstance = proxyCreate(wrapperInstance, wrapperProxyHandler);
  }

  return wrapperInstance;
}, {
  has(target, name) {
    return true;
  },
  get(target, name) {
    return name in target ?
      target[name] :
      target(dasherize(name));
  },
});

const wrapperProxyHandler = {
  has(target, name) {
    return true;
  },
  get(target, name) {
    return name in target ?
      target[name] :
      target.partial(dasherize(name));
  },
};

// Uses `glob.sync` to expand a patterned argument. For example,
// `sh.glob("*.js")` would return an array of all JavaScript files in the
// current directory. A [list of options can be found on the node-glob github
// page](https://github.com/isaacs/node-glob#options).
sh.glob = function(pattern, options) {
  return glob.sync(pattern, options);
};

sh.ExitCodeError = function(code, stdout, stderr) {
  this.name = 'sh.ExitCodeError';
  this.code = code;
  this.codeDescription = sh.exitCodeDescriptions['' + code];
  this.stdout = stdout;
  this.stderr = stderr;
    // Try to give something human-friendly.
  this.message = 'Error Code: ' + code +
        // Attach the `codeDescription` if there is one.
        (this.codeDescription ? (' (' + this.codeDescription + ')') : '') +
        // Any contents of stderr that exist could be useful
        strip(stderr) ? ('\n' + strip(stderr)) : '';
};

sh.ExitCodeError.prototype = new Error();
sh.ExitCodeError.constructor = sh.ExitCodeError;

// Try to describe some return codes: http://stackoverflow.com/q/1101957
sh.exitCodeDescriptions = {
  1: 'general error',
  2: 'misuse of shell builtin',
  64: 'command line usage error',
  65: 'data format error',
  66: 'cannot open input',
  67: 'addressee unknown',
  68: 'host name unknown',
  69: 'service unavailable',
  70: 'internal software error',
  71: "system error (e.g., can't fork)",
  72: 'critical OS file missing',
  73: "can't create (user) output file",
  74: 'input/output error',
  75: 'temp failure; user is invited to retry',
  76: 'remote error in protocol',
  77: 'permission denied',
  78: 'configuration error',
  255: 'exit status out of range',
};

function wrapper(...args) {
  const parsed = this.parseArgs(...args);
  const subprocess = childProcess.spawn(parsed.command, parsed.args);
  if (parsed.encoding) {
    subprocess.stdout.setEncoding(parsed.encoding);
    subprocess.stderr.setEncoding(parsed.encoding);
  }
  if (parsed.stdin) {
    // Pipe from passed in `ChildProcess` to our stdin
    parsed.stdin.pipe(subprocess.stdin);
  }
  if (parsed.callback) {
    const stdoutData = [];
    const stderrData = [];
    let errorObj = null;
    let exitCode = 0;
    let callbackCounter = 3; // Callbacks to wait for before exiting

    // Decrement `callbackCounter`. Once the counter is zero, call our
    // `parsed.callback` function.
    function doCallback() {
      if (--callbackCounter !== 0) {
        // We're still waiting on some more information to come in
        return null;
      }

      // Error Handling
      if (errorObj !== null) { return parsed.callback(errorObj); }

      // Decode stdout, stderr
      function decode(data) {
        return parsed.encoding ?
          data.join('') :
          buffer.Buffer.concat(stdoutData);
      }
      const stdoutStr = decode(stdoutData);
      const stderrStr = decode(stderrData);

      // Treat non-zero (or otherwise configured) exit codes as an error.
      if (!_.contains(parsed.okCodes, exitCode)) {
        return parsed.callback(
          new sh.ExitCodeError(exitCode, stdoutStr, stderrStr)
        );
      }

      return parsed.callback(null, stdoutStr, stderrStr);
    }

    // Every subprocess should either error or exit.
    subprocess.on('error', err => {
      errorObj = err;
      callbackCounter = 1; // Immediately call `parsed.callback`
      doCallback();
    });
    subprocess.on('exit', (code, signal) => {
      exitCode = code;
      doCallback();
    });

    // If given a `callback`, we record the output streams from the subprocess
    // and then feed it to the `callback` on exit. **There is no limit to how
    // much memory is allocated,** making using a callback potentially unsafe.
    subprocess.stdout.on('data', d => stdoutData.push(d));
    subprocess.stderr.on('data', d => stderrData.push(d));
    subprocess.stdout.on('end', doCallback);
    subprocess.stderr.on('end', doCallback);
  }
}

// Functions to append onto the generated `wrapper` function
const wrapperProto = {};

// Parses `...args` the way `wrapper` would, returning an object with all the
// processed data.
wrapperProto.parseArgs = function(...args) {
  let kwargs = {};
  let callback = null;
  let stdin = null;
  const childProcessOptions = {};
  let encoding = 'utf8';
  let okCodes = [0];

  // Handle piping like: `wc(ls("/etc", "-1"), "-l")`
  if (_.first(args) instanceof events.EventEmitter) {
    stdin = args.shift().stdout;
  }

  if (_.isFunction(_.last(args))) {
    callback = args.pop();
  }

  if (_.isPlainObject(_.last(args))) {
    kwargs = args.pop();
  }

  // Extend `args` and `kwargs` with `this.partials` and `this.partialKwargs`
  [].unshift.apply(args, this.partials);
  _.defaults(kwargs, this.partialKwargs);

  // Handle kwargs and all its edge-cases
  _.forOwn(kwargs, (value, key) => {
        // Keyword arguments starting with an underscore are "special"
    if (key.charAt(0) === '_') {
      key = key.slice(1);
      switch (key) {
        case 'cwd':
        case 'env':
        case 'uid':
        case 'gid':
          childProcessOptions[key] = value;
          return;
        case 'encoding':
          encoding = value;
          return;
        case 'okCode':
        case 'ok_code':
        case 'okCodes':
        case 'ok_codes':
          okCodes = _.isArray(value) ? value : [value];
          return;
        default:
          throw new Error("Unsupported '_special' keyword: " + key);
      }
    }
    // Transform `kwargs` and append onto `args`
    const dasherizedKey = (key.length > 1 ? '--' : '-') + dasherize(key);
    if (_.isBoolean(value)) {
      if (value) {
        args.push(dasherizedKey);
      }
      return;
    }
    args.push(dasherizedKey + '=' + value);
  });

  // You can pass an array of arguments, such as in the case of `glob`
  args = _.flatten(args);

  // Ensure all values in `args` are strings
  args = _.map(args, a => '' + a);

  return {
    command: this.command,
    args,
    callback,
    stdin,
    childProcessOptions,
    encoding,
    okCodes,
  };
};

wrapperProto.toString = function() {
  const parsed = this.parseArgs();
  const command = parsed.command;
  const args = parsed.args;
  return _.map([command].concat(args), a =>
    // Quote some things (Doesn't handle everything, but this is good enough for
    // logging).
    a.search(/[\s\$'";]/) >= 0 ?
      "'" + a + "'" :
      a
  ).join(' ');
};

// Wouldn't it be cool to "bake in" some arguments to a command? How about a
// version of `ssh` specifically for your server?
//
//     const example = sh("ssh").partial("example.com", {p: 1234});
//     example("hostname"); // "example.com"
//
// Alternatively, you can apply partial arguments straight to `sh`:
//
//     const example = sh("ssh", "example.com", {p: 1234});
//     example("hostname"); // "example.com"
wrapperProto.partial = wrapperProto.bake = function(...args) {
  const kwargs = _.isPlainObject(_.last(args)) ? args.pop() : {};
  _.defaults(kwargs, this.partialKwargs);
  return sh(this.command, ...this.partials, ...args, kwargs);
};

// It's handy to predefine different subcommands for some tools, such as `git`.
// Some commands may have nested subcommands, such as the `ip` tool. Eg.
// `ip addr show dev eth0` would be cool to call as `ip.addr.show.dev("eth0")`.
//
// Call it with an array, multiple string arguments to specify a group of
// subcommands to support.
//
// Call it with an object to specify a tree structure of subcommands (eg.
// `ip.defineSubcommands({addr: {show: {dev: {}}}})`). A terminal can be
// marked with any "falsy" value, `[]`, or `{}`.
//
// If given a subcommand with dashes or underscores, the resulting API will be
// in `camelCase`. eg. `git get-tar-commit-id` becomes `git.getTarCommitId()`
wrapperProto.defineSubcommands = function(subcommands) {
  if (_.isPlainObject(subcommands)) {
    _.forOwn(subcommands, (value, key) => {
      this[camelize(key)] = this.partial(key);
      if (value) {
        this[camelize(key)].defineSubcommands(value);
      }
    });
  } else {
    if (!_.isArray(subcommands)) {
      subcommands = _.toArray(arguments);
    }
    _.each(subcommands, key => {
      this[key] = this[camelize(key)] = this.partial(key);
    });
  }
  return this;
};


// Helper functions
// ----------------

// Based loosely on `underscore.string`'s `camelize`
function camelize(str) {
  str = str.replace(/[-_\s]+(.)?/g, (match, c) => (c ? c.toUpperCase() : ''));
    // Ensure we don't start with a capital letter
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Based loosely on `underscore.string`'s `dasherize`
function dasherize(str) {
  return str.indexOf('-') >= 0 || str.indexOf('_') >= 0 ?
    str :
    str.replace(/([A-Z])/g, '-$1').replace(/[-_\s]+/g, '-').toLowerCase();
}

function strip(str) {
  return str.replace(/^\s+|\s+$/g, '');
}

module.exports = sh;
