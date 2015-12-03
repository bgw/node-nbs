// Defines passthrough to the Proxy constructor, if it exists, otherwise a
// no-op.
//
// <https://github.com/lukehoban/es6features#proxies>
//
// Uses harmony-reflect to polyfill using V8's old pre-es6 Proxy API if it
// exists.

export let proxyCreate;

if (typeof Proxy !== 'undefined') {
  require('harmony-reflect');
  proxyCreate = function(target, handler) {
    return new Proxy(target, handler);
  };
} else {
  proxyCreate = function(target, handler) {
    return target;
  };
}
