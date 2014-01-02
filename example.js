var sh = require("./index.js"),
    git = sh("git"),
    curl = sh("curl", {silent: true}),
    ls = sh("ls", "-1");

git.defineSubcommands("status", "add", "rm", "clone");

git.status(function(err, res) {
    console.log("$ git status");
    console.log(res);
});

git.status("-s", function(err, res) {
    console.log("$ git status -s");
    console.log(res);
});

curl("http://httpbin.org/user-agent", function(err, res) {
    console.log("$ curl --silent 'http://httpbin.org/user-agent'");
    console.log(res);
});

ls(function(err, res) {
    console.log("$ " + ls);
    console.log(res);
});

sh("false")(function(err, res) {
    console.log("$ false");
    console.trace(err);
    console.log();
});

// if node is run with `--harmony` or `--harmony-proxies`
if(typeof Proxy !== "undefined") {
    sh.git.status(function(err, res) {
        console.log("$ git status # using harmony proxies");
        console.log(res);
    });
} else {
    console.log("$ # Run with `--harmony-proxies` to test proxy functionality");
}
