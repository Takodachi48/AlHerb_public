import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { ToastProvider } from './components/providers/ToastProvider';
import { ConfirmationProvider } from './components/providers/ConfirmationProvider';
import GlobalLoader from './components/GlobalLoader';
import { LoaderProvider } from './loader/LoaderContext';
import { loaderService } from './loader/loaderService';
import { SYSTEM_NAME, SYSTEM_SHORT_NAME, APP_DESCRIPTION, APP_AUTHOR, APP_URL, APP_KEYWORDS } from '../../shared/constants/app.js';
import { HerbFilterProvider } from './context/HerbFilterContext';
import App from './App';
import './styles/globals.css';
import './styles/Components.css';

const BOOT_LOADER_ID = 'app-boot-loader';
let bootLoaderUnsubscribe = null;

const renderBootLoader = () => {
  const existing = document.getElementById(BOOT_LOADER_ID);
  if (existing) return existing;

  const el = document.createElement('div');
  el.id = BOOT_LOADER_ID;
  el.setAttribute(
    'style',
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--base-primary,#0b1114);font-family:var(--font-core,sans-serif);transition:opacity 250ms ease;overflow:hidden;',
  );
  el.innerHTML = `
    <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--interactive-brand-primary,#0ea5a4);opacity:.95"></div>
    <div style="position:absolute;inset:0;opacity:.55;background-image:linear-gradient(var(--border-weak,rgba(255,255,255,.06)) 1px, transparent 1px),linear-gradient(90deg,var(--border-weak,rgba(255,255,255,.06)) 1px, transparent 1px);background-size:28px 28px;"></div>
    <div style="position:relative;z-index:1;width:min(420px,90vw);padding:24px 20px">
      <div style="text-align:center;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:var(--text-tertiary,#8f9aa3);margin-bottom:10px">Botanical Systems</div>
      <div style="text-align:center;font-size:32px;font-weight:700;letter-spacing:-.02em;color:var(--text-strong,#e8edf0);line-height:1;margin-bottom:10px">${SYSTEM_NAME}</div>
      <div style="height:2px;margin:0 auto 20px auto;width:min(280px,100%);background:repeating-linear-gradient(90deg,var(--border-brand,#0ea5a4) 0,var(--border-brand,#0ea5a4) 10px,transparent 10px,transparent 17px)"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border-primary,rgba(255,255,255,.12))">
        <span style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--text-tertiary,#8f9aa3)">Loading application...</span>
        <span data-boot-progress-pct style="font-family:var(--font-mono,monospace);font-size:24px;line-height:1;color:var(--text-primary,#d6dde2)">0%</span>
      </div>
      <div style="position:relative;height:3px;background:var(--border-primary,rgba(255,255,255,.14));overflow:hidden">
        <div data-boot-progress-fill style="position:absolute;left:0;top:0;bottom:0;width:0%;background:var(--interactive-brand-primary,#0ea5a4);box-shadow:inset 3px 0 0 var(--border-brand,#0ea5a4);transition:width 90ms linear"></div>
      </div>
    </div>
  `;
  const styleTag = document.createElement('style');
  styleTag.textContent = '';
  el.appendChild(styleTag);
  document.body.appendChild(el);
  return el;
};

const syncBootLoaderWithService = () => {
  if (bootLoaderUnsubscribe) return;
  const apply = () => {
    const el = document.getElementById(BOOT_LOADER_ID);
    if (!el) return;
    const pctEl = el.querySelector('[data-boot-progress-pct]');
    const fillEl = el.querySelector('[data-boot-progress-fill]');
    if (!pctEl || !fillEl) return;

    const state = loaderService.getState();
    const rawPercent = Math.round((state.progress || 0) * 100);
    const safePercent = state.isFinishing ? 100 : Math.min(99, rawPercent);
    pctEl.textContent = `${safePercent}%`;
    fillEl.style.width = `${safePercent}%`;
  };

  bootLoaderUnsubscribe = loaderService.subscribe(apply);
  apply();
};

const removeBootLoader = () => {
  const el = document.getElementById(BOOT_LOADER_ID);
  if (!el) return;
  const pctEl = el.querySelector('[data-boot-progress-pct]');
  if (pctEl) pctEl.textContent = '100%';
  const fillEl = el.querySelector('[data-boot-progress-fill]');
  if (fillEl) fillEl.style.width = '100%';
  if (bootLoaderUnsubscribe) {
    bootLoaderUnsubscribe();
    bootLoaderUnsubscribe = null;
  }
  el.style.opacity = '0';
  window.setTimeout(() => el.remove(), 260);
};

const isLandingPath = window.location.pathname === '/' || window.location.pathname === '/landing';
const shouldUseBootLoader = false;
if (isLandingPath && shouldUseBootLoader) {
  renderBootLoader();
  syncBootLoaderWithService();
  loaderService.start({ mode: 'fullscreen', message: 'Loading application...' });
}

// Update document title and meta tags
document.title = SYSTEM_SHORT_NAME;
document.querySelector('meta[name="description"]').content = `${APP_DESCRIPTION} - ${SYSTEM_SHORT_NAME}`;
document.querySelector('meta[name="keywords"]').content = APP_KEYWORDS.join(', ');
document.querySelector('meta[name="author"]').content = APP_AUTHOR;
document.querySelector('meta[property="og:url"]').content = APP_URL;
document.querySelector('meta[property="og:title"]').content = SYSTEM_SHORT_NAME;
document.querySelector('meta[property="og:description"]').content = APP_DESCRIPTION;
document.querySelector('meta[property="twitter:url"]').content = APP_URL;
document.querySelector('meta[property="twitter:title"]').content = SYSTEM_SHORT_NAME;
document.querySelector('meta[property="twitter:description"]').content = APP_DESCRIPTION;

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <LoaderProvider>
      <ThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <NotificationProvider>
              <ToastProvider>
                <ConfirmationProvider>
                  <HerbFilterProvider>
                    <App />
                    <GlobalLoader />
                  </HerbFilterProvider>
                </ConfirmationProvider>
              </ToastProvider>
            </NotificationProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </LoaderProvider>
  </BrowserRouter>
);

if (isLandingPath && shouldUseBootLoader) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(removeBootLoader);
  });
}
