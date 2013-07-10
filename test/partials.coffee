_ = require "lodash"
sh = require "../index.js"

arrayEq = (a, b) -> _.all _.zip(a, b), (el) -> el[0] == el[1]

describe "partial application", ->

    describe "via the sh function", ->

        it "works with literals", (done) ->
            echo = sh "echo", "-n", "parially applied argument!"
            echo "not a partial", (err, res) ->
                if err then throw err
                res.should.equal "parially applied argument! not a partial"
                done()

        it "works with keyword arguments", (done) ->
            echo = sh "echo", "-n", f: "fizz", bar: "buzz"
            echo "literal", yep: "nope", n: 5, (err, res) ->
                if err then throw err
                arrayEq(res.split(/\s/).sort(), [
                    "--bar=buzz", "--yep=nope", "-f=fizz", "-n=5", "literal"
                ]).should.be.true
                done()

    describe "via the partial function", ->

        it "works with literals", (done) ->
            echo = sh("echo", "-n").partial "parially applied argument!"
            echo "not a partial", (err, res) ->
                if err then throw err
                res.should.equal "parially applied argument! not a partial"
                done()

        it "works with keyword arguments", (done) ->
            echo = sh("echo", "-n").partial f: "fizz", bar: "buzz"
            echo "literal", yep: "nope", n: 5, (err, res) ->
                if err then throw err
                arrayEq(res.split(/\s/).sort(), [
                    "--bar=buzz", "--yep=nope", "-f=fizz", "-n=5", "literal"
                ]).should.be.true
                done()

    describe "the bake function", ->

        it "is an alias for the partial function", ->
            echo = sh "echo"
            echo.bake.should.equal echo.partial
