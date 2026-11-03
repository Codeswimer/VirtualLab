import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    // ADR-005: never reload in the middle of a practical without consent.
    const accepted = window.confirm(
      'A new version of the virtual lab is ready. Reload now? Your saved readings are kept.',
    );
    if (accepted) void updateServiceWorker?.(true);
  },
  onOfflineReady() {
    console.info('[vlab] Offline cache ready');
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary title="The virtual lab hit a problem">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
