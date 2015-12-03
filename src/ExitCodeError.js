export default class ExitCodeError extends Error {
  constructor(code, stdout, stderr) {
    const codeDescription = exitCodeDescriptions['' + code];
    // Try to give something human-friendly.
    super('Error Code: ' + code +
          // Attach the `codeDescription` if there is one.
          (codeDescription ? (' (' + codeDescription + ')') : '') +
          // Any contents of stderr that exist could be useful
          isPrintable(stderr) ? ('\n' + stderr.trim()) : '');
    Object.assign(this, {code, codeDescription, stdout, stderr});
  }
}

function isPrintable(stringish) {
  return typeof stringish === 'string' && stringish.trim();
}

// Try to describe some return codes: http://stackoverflow.com/q/1101957
const exitCodeDescriptions = {
  1: 'general error',
  2: 'misuse of shell builtin',
  64: 'command line usage error',
  65: 'data format error',
  66: 'cannot open input',
  67: 'addressee unknown',
  68: 'host name unknown',
  69: 'service unavailable',
  70: 'internal software error',
  71: "system error (e.g., can't fork)",
  72: 'critical OS file missing',
  73: "can't create (user) output file",
  74: 'input/output error',
  75: 'temp failure; user is invited to retry',
  76: 'remote error in protocol',
  77: 'permission denied',
  78: 'configuration error',
  255: 'exit status out of range',
};
