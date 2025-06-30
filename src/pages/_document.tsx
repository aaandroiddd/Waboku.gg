import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Waboku.gg - Local Trading Card Game Marketplace" />
        
        {/* Favicon and App Icons */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Theme and App Metadata */}
        <meta name="theme-color" content="#38bdf8" />
        <meta name="application-name" content="Waboku" />
        <meta name="apple-mobile-web-app-title" content="Waboku" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Open Graph / Social Media */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Waboku.gg - Trading Card Marketplace" />
        <meta property="og:description" content="Mobile-first trading card marketplace for buying and selling TCG cards" />
        <meta property="og:image" content="/icon-512.svg" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Waboku.gg - Trading Card Marketplace" />
        <meta name="twitter:description" content="Mobile-first trading card marketplace for buying and selling TCG cards" />
        <meta name="twitter:image" content="/icon-512.svg" />
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
      </Head>
      <body>
        <Main />
        <Script src="https://assets.co.dev/files/codevscript.js" strategy="afterInteractive" />
        <NextScript />
      </body>
    </Html>
  );
}