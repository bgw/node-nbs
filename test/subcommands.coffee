sh = require("../index.js")
echo = sh("echo", "-n")

describe "defineSubcommands()", ->

    it "defines new functions", ->
        echo.defineSubcommands "something", "another"
        echo.should.have.property "something"
        echo.something.should.be.a "function"
        echo.should.have.property "another"
        echo.another.should.be.a "function"

    it "transforms multi-word arguments", ->
        echo.defineSubcommands "ab-cd-ef", "--gh-ij-kl", "mn_op_qr", "stUvWx"
        echo.should.have.property "abCdEf"
        echo.should.have.property "ghIjKl"
        echo.should.have.property "mnOpQr"
        echo.should.have.property "stUvWx"

    it "accepts an array of subcommands", ->
        echo.defineSubcommands ["wassup", "bro"]
        echo.should.have.property "wassup"
        echo.should.have.property "bro"

    it "forms a tree from an object of subcommands", ->
        echo.defineSubcommands one: {two: "three", another: null}, yellow: []
        echo.should.have.property("one")
            .with.property("two")
            .with.property("three")
        echo.one.should.have.property "another"
        echo.should.have.property "yellow"

    it "applies the subcommand as a partial application", (done) ->
        echo.one.two.three "four", (err, res) ->
            if err then throw err
            res.should.equal "one two three four"
            echo.abCdEf (err, res) ->
                res.should.equal "ab-cd-ef"
                done()
