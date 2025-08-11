/**
 * Shim for 'styled-jsx/style' to prevent runtime crashes in serverless/API routes.
 * CommonJS-compatible to work with Next.js internals that may use require().
 */
function JSXStyle() {
  return null;
}

// styled-jsx expects a static helper; return a stable string
JSXStyle.dynamic = function (info) {
  try {
    if (Array.isArray(info)) return info.join('');
    if (typeof info === 'string') return info;
    return JSON.stringify(info);
  } catch {
    return 'jsx-style-dynamic';
  }
};

// Support both require() and import default
module.exports = JSXStyle;
module.exports.default = JSXStyle;