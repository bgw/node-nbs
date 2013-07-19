var _ = require("lodash"),
    childProcess = require("child_process"),
    events = require("events"),
    buffer = require("buffer");

var sh = function(command) {
    // Argument Parsing
    var partials = [].slice.call(arguments, 1),
        partialKwargs = _.isPlainObject(_.last(partials)) ? partials.pop() : {};

    var wrapperInstance = function() {
        wrapper.apply(wrapperInstance, _.toArray(arguments));
    };
    _.extend(wrapperInstance, {
        command: command,
        partials: partials,
        partialKwargs: partialKwargs
    });
    return _.extend(wrapperInstance, wrapperProto);
};

// Uses `glob.sync` to expand a patterned argument. For example,
// `sh.glob("*.js")` would return an array of all JavaScript files in the
// current directory. A [list of options can be found on the node-glob github
// page](https://github.com/isaacs/node-glob#options).
sh.glob = function(pattern, options) {
    return glob.sync(pattern, options);
};

sh.ExitCodeError = function(code, stdout, stderr) {
    this.name = "sh.ExitCodeError";
    this.code = code;
    this.codeDescription = sh.exitCodeDescriptions["" + code];
    this.stdout = stdout;
    this.stderr = stderr;
    // Try to give something human-friendly.
    this.message = "Error Code: " + code +
        // Attach the `codeDescription` if there is one.
        (this.codeDescription ? (" (" + this.codeDescription + ")") : "") +
        // Any contents of stderr that exist could be useful
        strip(stderr) ? ("\n" + strip(stderr)) : "";
};

sh.ExitCodeError.prototype = new Error();
sh.ExitCodeError.constructor = sh.ExitCodeError;

// Try to describe some return codes: http://stackoverflow.com/q/1101957
sh.exitCodeDescriptions = {
    "1": "general error",
    "2": "misuse of shell builtin",
    "64": "command line usage error",
    "65": "data format error",
    "66": "cannot open input",
    "67": "addressee unknown",
    "68": "host name unknown",
    "69": "service unavailable",
    "70": "internal software error",
    "71": "system error (e.g., can't fork)",
    "72": "critical OS file missing",
    "73": "can't create (user) output file",
    "74": "input/output error",
    "75": "temp failure; user is invited to retry",
    "76": "remote error in protocol",
    "77": "permission denied",
    "78": "configuration error",
    "255": "exit status out of range"
};

var wrapper = function() {
    var parsed = this.parseArgs(arguments),
        subprocess = childProcess.spawn(parsed.command, parsed.args);
    if(parsed.encoding) {
        subprocess.stdout.setEncoding(parsed.encoding);
        subprocess.stderr.setEncoding(parsed.encoding);
    }
    if(parsed.stdin) {
        // Pipe from passed in `ChildProcess` to our stdin
        parsed.stdin.pipe(subprocess.stdin);
    }
    if(parsed.callback) {
        var stdoutData = [],
            stderrData = [],
            errorObj = null,
            exitCode = 0,
            callbackCounter = 3; // Callbacks to wait for before exiting

        // Decrement `callbackCounter`. Once the counter is zero, call our
        // `parsed.callback` function.
        var doCallback = function() {
            if(--callbackCounter !== 0) {
                // We're still waiting on some more information to come in
                return;
            }

            // Error Handling
            if(errorObj !== null) { return parsed.callback(err); }

            // Decode stdout, stderr
            var decode = function(data) {
                if(parsed.encoding) { return data.join(""); }
                else { return buffer.Buffer.concat(stdoutData); }
            };
            var stdoutStr = decode(stdoutData),
                stderrStr = decode(stderrData);

            // Treat non-zero exit codes as an error
            if(exitCode !== 0) {
                return parsed.callback(
                    new ExitCodeError(exitCode, stdoutStr, stderrStr)
                );
            }

            return parsed.callback(null, stdoutStr, stderrStr);
        };

        // Every subprocess should either error or exit.
        subprocess.on("error", function(err) {
            errorObj = err;
            callbackCounter = 1; // Immediately call `parsed.callback`
            doCallback();
        });
        subprocess.on("exit", function(code, signal) {
            exitCode = code;
            doCallback();
        });

        // If given a `callback`, we record the output streams from the
        // subprocess and then feed it to the `callback` on exit. **There is no
        // limit to how much memory is allocated,** making using a callback
        // potentially unsafe.
        subprocess.stdout.on("data", _.bind([].push, stdoutData));
        subprocess.stderr.on("data", _.bind([].push, stderrData));
        subprocess.stdout.on("end", doCallback);
        subprocess.stderr.on("end", doCallback);
    }
};

// Functions to append onto the generated `wrapper` function
var wrapperProto = {};

// Parses `args` the way `wrapper` would, returning an object with all the
// processed data.
wrapperProto.parseArgs = function(args) {
    args = _.toArray(args);
    var kwargs = {},
        callback = null,
        stdin = null,
        childProcessOptions = {},
        encoding = "utf8";

    // Handle piping like: `wc(ls("/etc", "-1"), "-l")`
    if(_.first(args) instanceof events.EventEmitter) {
        stdin = args.shift().stdout;
    }

    if(_.isFunction(_.last(args))) {
        callback = args.pop();
    }

    if(_.isPlainObject(_.last(args))) {
        kwargs = args.pop();
    }

    // Extend `args` and `kwargs` with `this.partials` and `this.partialKwargs`
    [].unshift.apply(args, this.partials);
    _.defaults(kwargs, this.partialKwargs);

    // Handle kwargs and all its edge-cases
    _.forOwn(kwargs, function(value, key) {
        // Keyword arguments starting with an underscore are "special"
        if(key.charAt(0) === "_") {
            key = key.slice(1);
            switch(key) {
                case "cwd":
                case "env":
                case "uid":
                case "gid":
                    childProcessOptions[key] = value;
                    return;
                case "encoding":
                    encoding = value;
                    return;
                default:
                    throw new Error("Unsupported '_special' keyword: " + key);
            }
        }
        // Transform `kwargs` and append onto `args`
        var dasherizedKey = (key.length > 1 ? "--" : "-") + key;
        if(_.isBoolean(value)) {
            if(value) {
                args.push(dasherizedKey);
            }
            return;
        }
        args.push(dasherizedKey + "=" + value);
    });

    // You can pass an array of arguments, such as in the case of `glob`
    args = _.flatten(args);

    // Ensure all values in `args` are strings
    args = _.map(args, function(a) { return "" + a; });

    return {
        command: this.command,
        args: args,
        callback: callback,
        stdin: stdin,
        childProcessOptions: childProcessOptions,
        encoding: encoding
    };
};

wrapperProto.toString = function() {
    var parsed = this.parseArgs([]),
        command = parsed.command,
        args = parsed.args;
    return _.map([command].concat(args), function(a) {
        // Quote some things (Doesn't handle everything, but this is good enough
        // for logging).
        return a.search(/[\s\$'";]/) >= 0 ? "'" + a + "'" : a;
    }).join(" ");
};

// Wouldn't it be cool to "bake in" some arguments to a command? How about a
// version of `ssh` specifically for your server?
//
//     var example = sh("ssh").partial("example.com", {p: 1234});
//     example("hostname"); // "example.com"
//
// Alternatively, you can apply partial arguments straight to `sh`:
//
//     var example = sh("ssh", "example.com", {p: 1234});
//     example("hostname"); // "example.com"
wrapperProto.partial = wrapperProto.bake = function() {
    var args = _.toArray(arguments),
        kwargs = _.isPlainObject(_.last(args)) ? args.pop() : {};
    _.defaults(kwargs, this.partialKwargs);
    return sh.apply(
        null,
        [this.command].concat(this.partials).concat(args).concat([kwargs])
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
wrapperProto.defineSubcommands = function(subcommands) {
    var self = this;
    if(_.isPlainObject(subcommands)) {
        _.forOwn(subcommands, function(value, key) {
            self[camelize(key)] = self.partial(key);
            if(value) {
                self[camelize(key)].defineSubcommands(value);
            }
        });
    } else {
        if(!_.isArray(subcommands)) {
            subcommands = _.toArray(arguments);
        }
        _.each(subcommands, function(key) {
            self[camelize(key)] = self.partial(key);
        });
    }
    return this;
};


// Helper functions
// ----------------

// Based loosely on `underscore.string`'s `camelize`
var camelize = function(str) {
    str = str.replace(/[-_\s]+(.)?/g, function(match, c) {
        return c ? c.toUpperCase() : "";
    });
    // Ensure we don't start with a capital letter
    return str.charAt(0).toLowerCase() + str.slice(1);
};

var strip = function(str) {
    return str.replace(/^\s+|\s+$/g, "");
};

module.exports = sh;
