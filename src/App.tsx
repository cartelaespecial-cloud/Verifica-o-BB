import { useCallback, useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { BrandLogo } from './components/BrandLogo';
import { LiveVerificationForm } from './components/LiveVerificationForm';
import { DEFAULT_CONFIG, FormConfig } from './types';

function isPainelPath(pathname: string): boolean {
  return pathname === '/painel' || pathname.startsWith('/painel/');
}

export default function App() {
  const [route, setRoute] = useState<'form' | 'painel'>(() =>
    isPainelPath(window.location.pathname) ? 'painel' : 'form'
  );
  const [config, setConfig] = useState<FormConfig>(DEFAULT_CONFIG);

  const navigate = useCallback((target: 'form' | 'painel') => {
    const nextPath = target === 'painel' ? '/painel' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(target);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(isPainelPath(window.location.pathname) ? 'painel' : 'form');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    fetch('/api/form-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { config?: FormConfig } | null) => {
        if (data?.config) {
          setConfig(data.config);
        }
      })
      .catch(() => {
        // Keep default config if initial fetch fails
      });
  }, []);

  useEffect(() => {
    if (config.brandName) {
      document.title =
        route === 'painel' ? `${config.brandName} — Painel` : config.brandName;
    }
  }, [config.brandName, route]);

  if (route === 'painel') {
    return (
      <div className="min-h-screen flex flex-col bg-[#FFFEF2] text-black">
        <header className="bg-[#FCFC30] border-b border-black/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandLogo
                brandName={config.brandName}
                logoUrl={config.logoUrl}
                size="sm"
              />
              <span className="text-lg font-bold tracking-tight text-black whitespace-nowrap truncate">
                {config.brandName}
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate('form')}
              className="px-4 py-2 rounded-lg bg-[#3D5AFF] text-white text-xs font-semibold hover:bg-[#2F48E8] transition-colors whitespace-nowrap shrink-0"
            >
              Ver site ao vivo
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <AdminPanel
            onNavigateForm={() => navigate('form')}
            onConfigUpdated={(next) => setConfig(next)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFEF2] text-black">
      {/* Clean App-Style Public Header (NO admin links, NO "plataforma de formulário") */}
      <header className="bg-[#FCFC30] border-b border-black/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('form');
            }}
            className="flex items-center gap-2.5 min-w-0"
          >
            <BrandLogo
              brandName={config.brandName}
              logoUrl={config.logoUrl}
              size="md"
            />
            <span className="text-lg font-bold tracking-tight text-black whitespace-nowrap truncate">
              {config.brandName}
            </span>
          </a>
        </div>
      </header>

      {/* Main Centered App-Style Website Viewport */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        <LiveVerificationForm config={config} />
      </main>

      {/* Minimal App-Style Footer with Brand Name only */}
      <footer className="py-5 text-center text-xs text-neutral-600">
        <span>{config.brandName}</span>
      </footer>
    </div>
  );
}
