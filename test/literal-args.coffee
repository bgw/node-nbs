sh = require "../index.js"
echo = sh "echo"

describe "literal arguments", ->

    it "are passed through untouched", (done) ->
        echo "-n", "simple spaced", "--long", (err, res) ->
            if err then throw err
            res.should.equal "simple spaced --long"
            done()

    it "works when passed non-string arguments", (done) ->
        echo 1234, true, (err, res) ->
            if err then throw err
            res.should.equal "1234 true\n"
            done()
