import React, { StrictMode, Suspense } from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

// Route /result to standalone PublicResult page (no App, no login, no hooks conflict)
const isResultPage = window.location.pathname.toLowerCase().startsWith('/result');

// Lazy-load both main components — only the needed one is downloaded
const App = React.lazy(() => import('./App.tsx'));
const PublicResult = React.lazy(() => import('./components/PublicResult.tsx'));

// Minimal loading fallback (splash screen handles the visual, this is just for Suspense)
const SuspenseFallback = () => null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<SuspenseFallback />}>
      {isResultPage ? <PublicResult /> : <App />}
    </Suspense>
  </StrictMode>,
);

// Expose the dismiss function globally so React can hide the splash screen when it's fully ready.
(window as any).hideAppSplash = () => {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('splash-hide');
  // Remove from the DOM after the CSS transition so it never blocks input.
  window.setTimeout(() => splash.remove(), 500);
};

// Safety fallback: if React fails to mount or hide the splash screen, dismiss it after 6 seconds anyway
window.setTimeout(() => {
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.classList.add('splash-hide');
    window.setTimeout(() => splash.remove(), 500);
  }
}, 6000);
