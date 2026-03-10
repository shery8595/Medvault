// @ts-ignore
if (window.LOG_DEBUG) window.LOG_DEBUG('main.tsx: Starting execution...');

import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// @ts-ignore
if (window.LOG_DEBUG) window.LOG_DEBUG('main.tsx: Mounting React...');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// @ts-ignore
if (window.LOG_DEBUG) window.LOG_DEBUG('main.tsx: Render call finished.');
