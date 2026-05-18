import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;"><div><h1>⚠️ Root element not found</h1><p>Please check your index.html file.</p></div></div>';
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Global error handler to prevent white screen
window.addEventListener('error', (event) => {
  console.error('🔴 Global Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🔴 Unhandled Promise Rejection:', event.reason);
});
