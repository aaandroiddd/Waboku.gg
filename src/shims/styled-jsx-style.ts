/**
 * Shim for 'styled-jsx/style' to prevent runtime crashes in serverless/API routes.
 * This provides a no-op JSXStyle component with a static 'dynamic' helper.
 * It’s safe as long as the app isn’t relying on styled-jsx for critical styles.
 */
import React from 'react';

type JSXStyleComponent = React.FC<any> & { dynamic: (info: any) => string };

// No-op component: renders nothing
const JSXStyle = (() => null) as unknown as JSXStyleComponent;

// styled-jsx expects a static helper; return a stable string
JSXStyle.dynamic = (info: any) => {
  try {
    if (Array.isArray(info)) {
      return info.join('');
    }
    if (typeof info === 'string') return info;
    return JSON.stringify(info);
  } catch {
    return 'jsx-style-dynamic';
  }
};

export default JSXStyle;