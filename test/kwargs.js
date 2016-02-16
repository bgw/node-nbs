import scallop from '../index.js';
const echo = scallop('echo', '-n');

describe('keyword arguments', () => {

  describe('expanding key-value pairs', () => {

    it('happens when the values are strings', async () => {
      const [out, err] = await echo({key: 'value'});
      out.should.equal('--key=value');
    });

    it('converts integers to strings', async () => {
      const [out, err] = await echo({key: 1234});
      out.should.equal('--key=1234');
    });

  });

  describe('single-character keys', () => {

    it('gets prepended a single hyphen', async () => {
      const [out, err] = await echo({g: 'sup'});
      out.should.equal('-g=sup');
    });

  });

  describe('boolean values', () => {

    it('only gives the key when the value is true', async () => {
      const [out, err] = await echo({key: true});
      out.should.equal('--key');
    });

    it('only omits the entry when the value is false', async () => {
      const [out, err] = await echo({key: false});
      out.should.equal('');
    });

  });

});
