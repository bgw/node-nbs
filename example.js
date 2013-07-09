var sh = require("./index.js"),
    git = sh("git"),
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

ls(function(err, res) {
    console.log("$ " + ls);
    console.log(res);
});
