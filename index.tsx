
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { db } from './services/db';

// Capture Global JS Errors and report to Server Log
window.onerror = function(message, source, lineno, colno, error) {
    const report = `JS ERROR: ${message} at ${source}:${lineno}:${colno}`;
    db.logRemote(report, 'ERROR');
};

window.onunhandledrejection = function(event) {
    const report = `UNHANDLED PROMISE: ${event.reason}`;
    db.logRemote(report, 'ERROR');
};

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
