// @ts-ignore
if (window._cp) window._cp('main.tsx: module evaluation start');

import './polyfills';
import { preloadAppImages } from './lib/preloadImages';

preloadAppImages();

// @ts-ignore
if (window._cp) window._cp('main.tsx: polyfills imported');

import { StrictMode } from 'react';

// @ts-ignore
if (window._cp) window._cp('main.tsx: react imported');
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// @ts-ignore
if (window._cp) window._cp('main.tsx: all imports done, about to createRoot');

const rootEl = document.getElementById('root');
// @ts-ignore
if (window._cp) window._cp('main.tsx: root element = ' + (rootEl ? 'FOUND' : 'MISSING'));

try {
  createRoot(rootEl!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // @ts-ignore
  if (window._cp) window._cp('main.tsx: render() called successfully');
} catch (e: any) {
  // @ts-ignore
  if (window._cp) window._cp('main.tsx: RENDER THREW: ' + e.message);
  throw e;
}
