import 'babel-polyfill';
import _ from 'lodash';
import childProcess from 'child_process';
import events from 'events';
import buffer from 'buffer';
import glob from 'glob';

import {proxyCreate} from './proxy';
import ExitCodeError from './ExitCodeError';
import {camelize, dasherize} from './string';

const scallop = proxyCreate((program, ...partials) => {
  // Argument Parsing
  const partialKwargs = _.isPlainObject(_.last(partials)) ? partials.pop() : {};

  let commandInstance = Object.assign((...args) => (
    // late binding
    command.apply(commandInstance, args)
  ), {program, partials, partialKwargs}, commandProto);

  commandInstance = proxyCreate(commandInstance, commandProxyHandler);

  return commandInstance;
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

const commandProxyHandler = {
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
// `scallop.glob("*.js")` would return an array of all JavaScript files in the
// current directory. A [list of options can be found on the node-glob github
// page](https://github.com/isaacs/node-glob#options).
scallop.glob = function(pattern, options) {
  return glob.sync(pattern, options);
};

function command(...args) {
  const parsed = this.parseArgs(...args);
  const subprocess = childProcess.spawn(parsed.program, parsed.args);
  if (parsed.encoding) {
    subprocess.stdout.setEncoding(parsed.encoding);
    subprocess.stderr.setEncoding(parsed.encoding);
  }

  // We lazily construct this 'real' promise only if we're not piping. If we're
  // piping we don't want to execute this code at all because of the overhead of
  // storing the entire program output as a string.
  async function promiseFactory() {
    const stdoutData = [];
    const stderrData = [];
    function decodeData(data) {
      return parsed.encoding ?
        data.join('') :
        buffer.Buffer.concat(data);
    }
    const stdoutPromise = new Promise((resolve, reject) => {
      subprocess.stdout.on('end', () => {
        resolve(decodeData(stdoutData));
      });
    });
    const stderrPromise = new Promise((resolve, reject) => {
      subprocess.stderr.on('end', () => {
        resolve(decodeData(stderrData));
      });
    });

    // TODO: There is no limit to how much memory is allocated, making this
    // potentially unsafe.
    subprocess.stdout.on('data', d => stdoutData.push(d));
    subprocess.stderr.on('data', d => stderrData.push(d));

    // Every subprocess should either error or exit.
    const exitPromise = new Promise((resolve, reject) => {
      subprocess.on('error', err => {
        reject(err);
      });
      subprocess.on('exit', (code, signal) => {
        resolve(code);
      });
    });

    const [stdoutStr, stderrStr, exitCode] =
      await Promise.all([stdoutPromise, stderrPromise, exitPromise]);

    // Treat non-zero (or otherwise configured) exit codes as an error.
    if (!parsed.okCodes.includes(exitCode)) {
      throw new ExitCodeError(exitCode, stdoutStr, stderrStr);
    }

    return [stdoutStr, stderrStr];
  }

  let realPromise = null;
  return Object.assign(
    // make a thenable, and convert it to a real promise
    Promise.resolve({
      then(...thenArgs) {
        if (realPromise === null) {
          realPromise = promiseFactory();
        }
        return realPromise.then(...thenArgs);
      },
    }),
    {
      pipe(nextCommand) {
        this.stdout.pipe(nextCommand.stdin);
      },
      pipeErr(nextCommand) {
        this.stderr.pipe(nextCommand.stdin);
      },
      stdin: subprocess.stdin,
      stdout: subprocess.stdout,
      stderr: subprocess.stderr,
      pid: subprocess.pid,
    },
  );
}

// Functions to append onto the generated `command` function
const commandProto = {};

// Parses `...args` the way `command` would, returning an object with all the
// processed data.
commandProto.parseArgs = function(...args) {
  let kwargs = {};
  let stdin = null;
  const childProcessOptions = {};
  let encoding = 'utf8';
  let okCodes = [0];

  // Handle piping like: `wc(ls("/etc", "-1"), "-l")`
  if (args[0] instanceof events.EventEmitter) {
    stdin = args.shift().stdout;
  }

  if (_.isPlainObject(_.last(args))) {
    kwargs = args.pop();
  }

  // Extend `args` and `kwargs` with `this.partials` and `this.partialKwargs`
  args.unshift(...this.partials);
  kwargs = {...this.partialKwargs, ...kwargs};

  // Handle kwargs and all its edge-cases
  for (let key of Object.keys(kwargs)) {
    const value = kwargs[key];
    // Keyword arguments starting with an underscore are "special"
    if (key.charAt(0) === '_') {
      key = key.slice(1);
      switch (key) {
        case 'cwd':
        case 'env':
        case 'uid':
        case 'gid':
          childProcessOptions[key] = value;
          continue;
        case 'encoding':
          encoding = value;
          continue;
        case 'okCodes':
          okCodes = value;
          continue;
        default:
          throw new Error(`Unsupported '_special' keyword: ${key}`);
      }
    }
    // Transform `kwargs` and append onto `args`
    const dasherizedKey = (key.length > 1 ? '--' : '-') + dasherize(key);
    if (typeof value === 'boolean') {
      if (value) {
        args.push(dasherizedKey);
      }
    } else {
      args.push(`${dasherizedKey}=${value}`);
    }
  }

  // You can pass an array of arguments, such as in the case of `glob`
  args = _.flatten(args);

  // Ensure all values in `args` are strings
  args = args.map(a => '' + a);

  return {
    program: this.program,
    args,
    stdin,
    childProcessOptions,
    encoding,
    okCodes,
  };
};

commandProto.toString = function() {
  const parsed = this.parseArgs();
  const program = parsed.program;
  const args = parsed.args;
  return [program].concat(args).map(a =>
    // Quote some things (Doesn't handle everything, but this is good enough for
    // logging).
    a.search(/[\s$'";]/) >= 0 ?
      "'" + a + "'" :
      a,
  ).join(' ');
};

// Wouldn't it be cool to "bake in" some arguments to a command? How about a
// version of `ssh` specifically for your server?
//
//     const example = scallop("ssh").partial("example.com", {p: 1234});
//     example("hostname"); // "example.com"
//
// Alternatively, you can apply partial arguments straight to `scallop`:
//
//     const example = scallop("ssh", "example.com", {p: 1234});
//     example("hostname"); // "example.com"
commandProto.partial = function(...args) {
  const kwargs = _.isPlainObject(_.last(args)) ? args.pop() : {};
  return scallop(this.program,
    ...this.partials, ...args,
    {...this.partialKwargs, ...kwargs},
  );
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
commandProto.defineSubcommands = function(subcommands) {
  if (_.isPlainObject(subcommands)) {
    for (const key of Object.keys(subcommands)) {
      const value = subcommands[key];
      this[camelize(key)] = this.partial(key);
      if (value) {
        this[camelize(key)].defineSubcommands(value);
      }
    }
  } else {
    if (!Array.isArray(subcommands)) {
      subcommands = [...arguments];
    }
    for (const key of subcommands) {
      this[key] = this[camelize(key)] = this.partial(key);
    }
  }
  return this;
};

// this export has both commonjs *and* babel 6 interop
scallop.default = scallop;
module.exports = scallop;
