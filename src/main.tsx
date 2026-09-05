import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthBootstrap } from './components/AuthBootstrap';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('YUPOS root element (#root) was not found.');

createRoot(rootElement).render(
  <StrictMode>
    <AuthBootstrap>
      <App />
    </AuthBootstrap>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js?v=4', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn('YUPOS service worker registration failed:', error);
      });
  });
}
