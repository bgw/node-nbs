import scallop from '../index.js';
const echo = scallop('echo');

describe('literal arguments', () => {

  it('are passed through untouched', async () => {
    const [out, err] = await echo('-n', 'simple spaced', '--long');
    out.should.equal('simple spaced --long');
  });

  it('works when passed non-string arguments', async () => {
    const [out, err] = await echo(1234, true);
    out.should.equal('1234 true\n');
  });

});
