import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  Lock,
  LogOut,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AuthorizedCodePair,
  FormConfig,
  OnlineVisitor,
  SubmissionRecord,
} from '../types';
import { FormBuilderView } from './FormBuilderView';
import { SubmissionsView } from './SubmissionsView';

interface AdminPanelProps {
  onNavigateForm: () => void;
  onConfigUpdated: (next: FormConfig) => void;
}

type AdminSection = 'submissions' | 'builder';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onNavigateForm,
  onConfigUpdated,
}) => {
  const [authStatus, setAuthStatus] = useState<'loading' | 'setup' | 'login' | 'ready'>(
    'loading'
  );
  const [token, setToken] = useState<string | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [section, setSection] = useState<AdminSection>('submissions');
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [authorizedPairs, setAuthorizedPairs] = useState<AuthorizedCodePair[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [onlineVisitors, setOnlineVisitors] = useState<OnlineVisitor[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/status');
      const data = (await res.json()) as { configured?: boolean };
      setAuthStatus(data.configured ? 'login' : 'setup');
    } catch {
      setAuthStatus('login');
    }
  }, []);

  const loadDashboard = useCallback(
    async (authToken: string, silent = false) => {
      if (!silent) setLoadingData(true);
      try {
        const res = await fetch('/api/admin/dashboard', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.status === 401) {
          setToken(null);
          setAuthStatus('login');
          return;
        }
        const data = (await res.json()) as {
          config: FormConfig;
          authorizedPairs: AuthorizedCodePair[];
          submissions: SubmissionRecord[];
          onlineVisitors?: OnlineVisitor[];
        };
        setConfig(data.config);
        setAuthorizedPairs(data.authorizedPairs);
        setSubmissions(data.submissions);
        setOnlineVisitors(data.onlineVisitors ?? []);
        onConfigUpdated(data.config);
      } finally {
        if (!silent) setLoadingData(false);
      }
    },
    [onConfigUpdated]
  );

  useEffect(() => {
    if (!token) {
      fetchAuthStatus();
      return;
    }

    setAuthStatus('ready');
    loadDashboard(token);

    // Live auto-refresh every 3 seconds while viewing /painel
    const interval = window.setInterval(() => {
      loadDashboard(token, true);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [token, fetchAuthStatus, loadDashboard]);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passcodeInput.trim();
    if (clean.length < 4) {
      setAuthError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (clean !== confirmInput.trim()) {
      setAuthError('As senhas digitadas não coincidem.');
      return;
    }

    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: clean }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error ?? 'Não foi possível definir a senha.');
        return;
      }
      setPasscodeInput('');
      setConfirmInput('');
      setToken(data.token);
    } catch {
      setAuthError('Erro de conexão ao salvar a senha.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passcodeInput.trim();
    if (!clean) {
      setAuthError('Digite a senha de acesso.');
      return;
    }

    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: clean }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error ?? 'Senha incorreta.');
        return;
      }
      setPasscodeInput('');
      setToken(data.token);
    } catch {
      setAuthError('Erro de conexão ao autenticar.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSaveConfig = async (next: FormConfig) => {
    if (!token) return;
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ config: next }),
    });
    if (res.status === 401) {
      setToken(null);
      return;
    }
    const data = (await res.json()) as { config?: FormConfig };
    if (data.config) {
      setConfig(data.config);
      onConfigUpdated(data.config);
    }
  };

  const handleSavePairs = async (next: AuthorizedCodePair[]) => {
    if (!token) return;
    const res = await fetch('/api/admin/pairs', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ authorizedPairs: next }),
    });
    if (res.status === 401) {
      setToken(null);
      return;
    }
    const data = (await res.json()) as { authorizedPairs?: AuthorizedCodePair[] };
    if (data.authorizedPairs) {
      setAuthorizedPairs(data.authorizedPairs);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!token) return;
    const res = await fetch(`/api/admin/submissions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSubmissions((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleClearAll = async () => {
    if (!token) return;
    const res = await fetch('/api/admin/submissions', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSubmissions([]);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center text-sm text-neutral-600">
        Carregando painel administrativo...
      </div>
    );
  }

  if (authStatus === 'setup' || authStatus === 'login') {
    const isSetup = authStatus === 'setup';
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="h-2 w-full bg-[#FCFC30]" aria-hidden="true" />
          <div className="p-7 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#3D5AFF] text-white flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-black">
                  {isSetup ? 'Configurar Senha do Painel' : 'Painel Administrativo'}
                </h1>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {isSetup
                    ? 'Defina a senha inicial para proteger /painel.'
                    : 'Informe a senha para gerenciar o site e ver os registros.'}
                </p>
              </div>
            </div>

            <form
              onSubmit={isSetup ? handleSetupSubmit : handleLoginSubmit}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-passcode"
                  className="block text-sm font-medium text-black"
                >
                  {isSetup ? 'Nova senha de acesso' : 'Senha de acesso'}
                </label>
                <input
                  id="admin-passcode"
                  type="password"
                  autoFocus
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Digite a senha"
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
                />
              </div>

              {isSetup && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-passcode-confirm"
                    className="block text-sm font-medium text-black"
                  >
                    Confirmar senha
                  </label>
                  <input
                    id="admin-passcode-confirm"
                    type="password"
                    value={confirmInput}
                    onChange={(e) => {
                      setConfirmInput(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    placeholder="Repita a senha"
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
                  />
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] disabled:opacity-60 transition-colors"
              >
                {authSubmitting
                  ? 'Validando...'
                  : isSetup
                  ? 'Salvar senha e entrar no painel'
                  : 'Entrar no painel'}
              </button>
            </form>

            <div className="pt-4 border-t border-neutral-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onNavigateForm}
                className="inline-flex items-center gap-1.5 text-[#3D5AFF] hover:opacity-80 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Voltar ao site</span>
              </button>
              <span className="font-mono text-neutral-400">/painel</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Workspace Subheader */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-black tracking-tight">
            Painel Administrativo
          </h1>
          <p className="text-sm text-neutral-600 mt-0.5">
            Personalize o nome, logo e acompanhe os visitantes online e registros em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex p-1 bg-neutral-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setSection('submissions')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                section === 'submissions'
                  ? 'bg-[#3D5AFF] text-white shadow-sm'
                  : 'text-black hover:bg-white/60'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Registros ({submissions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('builder')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                section === 'builder'
                  ? 'bg-[#3D5AFF] text-white shadow-sm'
                  : 'text-black hover:bg-white/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Nome, Logo e Textos</span>
            </button>
          </div>

          <button
            type="button"
            disabled={loadingData}
            onClick={() => token && loadDashboard(token)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-[#3D5AFF] hover:bg-neutral-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setToken(null);
              setAuthStatus('login');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-black hover:bg-neutral-50 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {section === 'submissions' && config && (
        <SubmissionsView
          submissions={submissions}
          onlineVisitors={onlineVisitors}
          config={config}
          onClearAll={handleClearAll}
          onDeleteRecord={handleDeleteRecord}
          onOpenForm={onNavigateForm}
        />
      )}

      {section === 'builder' && config && (
        <FormBuilderView
          config={config}
          onSaveConfig={handleSaveConfig}
          authorizedPairs={authorizedPairs}
          onSavePairs={handleSavePairs}
        />
      )}
    </div>
  );
};
