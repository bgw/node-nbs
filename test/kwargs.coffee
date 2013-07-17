sh = require "../index.js"
echo = sh "echo", "-n"

describe "keyword arguments", ->

    describe "expanding key-value pairs", ->

        it "happens when the values are strings", (done) ->
            echo key: "value", (err, res) ->
                res.should.equal "--key=value"
                done()

        it "converts integers to strings", (done) ->
            echo key: 1234, (err, res) ->
                res.should.equal "--key=1234"
                done()

    describe "single-character keys", ->

        it "gets prepended a single hyphen", (done) ->
            echo g: "sup", (err, res) ->
                res.should.equal "-g=sup"
                done()

    describe "boolean values", ->

        it "only gives the key when the value is true", (done) ->
            echo key: true, (err, res) ->
                res.should.equal "--key"
                done()

        it "only omits the entry when the value is false", (done) ->
            echo key: false, (err, res) ->
                res.should.equal ""
                done()
