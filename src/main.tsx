import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Auto-recover if dynamic chunk loading fails following a production deployment
window.addEventListener('vite:preloadError', () => {
  const LOCK_KEY = 'chunk_reload_lock';
  const lastReload = sessionStorage.getItem(LOCK_KEY);
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 15_000) {
    sessionStorage.setItem(LOCK_KEY, now.toString());
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

