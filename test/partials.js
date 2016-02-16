import scallop from '../index.js';

function arrayEq(a, b) {
  return a.length === b.length && a.every((el, i) => el === b[i]);
}

describe('partial application', () => {

  describe('via the scallop function', () => {

    it('works with literals', async () => {
      const echo = scallop('echo', '-n', 'parially applied argument!');
      const [out, err] = await echo('not a partial');
      out.should.equal('parially applied argument! not a partial');
    });

    it('works with keyword arguments', async () => {
      const echo = scallop('echo', '-n', {f: 'fizz', bar: 'buzz'});
      const [out, err] = await echo('literal', {yep: 'nope', n: 5});
      arrayEq(out.split(/\s/).sort(), [
        '--bar=buzz', '--yep=nope', '-f=fizz', '-n=5', 'literal',
      ]).should.be.true();
    });

  });

  describe('via the partial function', () => {

    it('works with literals', async () => {
      const echo = scallop('echo', '-n').partial('parially applied argument!');
      const [out, err] = await echo('not a partial');
      out.should.equal('parially applied argument! not a partial');
    });

    it('works with keyword arguments', async () => {
      const echo = scallop('echo', '-n').partial({f: 'fizz', bar: 'buzz'});
      const [out, err] = await echo('literal', {yep: 'nope', n: 5});
      arrayEq(out.split(/\s/).sort(), [
        '--bar=buzz', '--yep=nope', '-f=fizz', '-n=5', 'literal',
      ]).should.be.true();
    });

  });

});
