import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Fade out the static splash screen once React has mounted.
// Uses a tiny delay so the first paint of the app is ready underneath.
const hideSplash = () => {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('splash-hide');
  // Remove from the DOM after the CSS transition so it never blocks input.
  window.setTimeout(() => splash.remove(), 500);
};

if (typeof requestAnimationFrame !== 'undefined') {
  requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(hideSplash, 80)));
} else {
  window.setTimeout(hideSplash, 120);
}
