/**
 * Essentially `underscore.string`'s `camelize`, if you always passed true for
 * the decapitalize argument.
 */
export function camelize(str) {
  str = str.replace(/[-_\s]+(.)?/g, (match, c) => (c ? c.toUpperCase() : ''));
  // Ensure we don't start with a capital letter
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Based loosely on `underscore.string`'s `dasherize`. Unlike
 * `underscore.string`'s implementation, this does nothing if the string
 * contains a dash or underscore already.
 */
export function dasherize(str) {
  return str.indexOf('-') >= 0 || str.indexOf('_') >= 0 ?
    str :
    str.replace(/([A-Z])/g, '-$1').replace(/\s+/g, '-').toLowerCase();
}
