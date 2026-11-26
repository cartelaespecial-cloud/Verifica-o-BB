import React, { useState } from 'react';
import { Check, Copy, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { AuthorizedCodePair, FormConfig } from '../types';
import { BrandLogo } from './BrandLogo';

interface FormBuilderViewProps {
  config: FormConfig;
  onSaveConfig: (next: FormConfig) => Promise<void>;
  authorizedPairs: AuthorizedCodePair[];
  onSavePairs: (next: AuthorizedCodePair[]) => Promise<void>;
}

function generateRandomDigits(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
}

export const FormBuilderView: React.FC<FormBuilderViewProps> = ({
  config,
  onSaveConfig,
  authorizedPairs,
  onSavePairs,
}) => {
  const [draft, setDraft] = useState<FormConfig>(config);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newCode8, setNewCode8] = useState('');
  const [newCode4, setNewCode4] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const updateField = <K extends keyof FormConfig>(key: K, value: FormConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSavedNotice(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setLogoError('Envie uma imagem PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > 480 * 1024) {
      setLogoError('A imagem deve ter no máximo 480 KB.');
      return;
    }

    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('logoUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleExtraField = (id: string, prop: 'enabled' | 'required') => {
    setDraft((prev) => ({
      ...prev,
      extraFields: prev.extraFields.map((f) =>
        f.id === id ? { ...f, [prop]: !f[prop] } : f
      ),
    }));
    setSavedNotice(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfig(draft);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPair = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean8 = newCode8.replace(/\D/g, '');
    const clean4 = newCode4.replace(/\D/g, '');

    if (clean8.length !== 8) {
      setPairError('O código principal deve conter exatamente 8 dígitos.');
      return;
    }
    if (clean4.length !== 4) {
      setPairError('O código complementar deve conter exatamente 4 dígitos.');
      return;
    }
    if (authorizedPairs.some((p) => p.code8 === clean8)) {
      setPairError('Já existe um registro cadastrado com este código de 8 dígitos.');
      return;
    }

    setPairError(null);
    const created: AuthorizedCodePair = {
      id: `pair-${Date.now()}`,
      label: newLabel.trim() || `Credencial ${authorizedPairs.length + 1}`,
      code8: clean8,
      code4: clean4,
      active: true,
    };

    await onSavePairs([created, ...authorizedPairs]);
    setNewLabel('');
    setNewCode8('');
    setNewCode4('');
  };

  const handleGenerateRandomPair = () => {
    setNewCode8(generateRandomDigits(8));
    setNewCode4(generateRandomDigits(4));
    setPairError(null);
  };

  const handleTogglePairActive = async (id: string) => {
    await onSavePairs(
      authorizedPairs.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  const handleDeletePair = async (id: string) => {
    await onSavePairs(authorizedPairs.filter((p) => p.id !== id));
  };

  const handleCopyPair = (pair: AuthorizedCodePair) => {
    navigator.clipboard?.writeText(`${pair.code8} / ${pair.code4}`);
    setCopiedId(pair.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      {/* Left Column: Brand Identity (Name & Logo) + Texts & Flow */}
      <div className="xl:col-span-7 bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-200">
        <div className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-black">
              Identidade, Textos e Fluxo do Site
            </h2>
            <p className="text-sm text-neutral-600 mt-0.5">
              Coloque o nome, a logo e salve para atualizar o site online na hora.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-xs font-semibold hover:bg-[#2F48E8] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {savedNotice ? (
              <>
                <Check className="w-4 h-4 text-[#FCFC30]" aria-hidden="true" />
                <span>Publicado no site!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{saving ? 'Salvando...' : 'Salvar e publicar no site'}</span>
              </>
            )}
          </button>
        </div>

        {/* Brand Name & Logo Section */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-black">
              Nome e Logo do Site
            </h3>
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#FCFC30] text-black text-xs font-semibold">
              <BrandLogo
                brandName={draft.brandName || 'Sua Marca'}
                logoUrl={draft.logoUrl}
                size="sm"
              />
              <span className="truncate max-w-[180px]">
                {draft.brandName || 'Sua Marca'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cfg-brand" className="block text-xs font-medium text-black">
              Nome da plataforma / empresa
            </label>
            <input
              id="cfg-brand"
              type="text"
              value={draft.brandName}
              onChange={(e) => updateField('brandName', e.target.value)}
              placeholder="Ex.: Minha Empresa"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="cfg-logo-url" className="block text-xs font-medium text-black">
              Logo do site (enviar arquivo ou colar URL da imagem)
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-[#3D5AFF] hover:bg-neutral-50 cursor-pointer whitespace-nowrap shrink-0">
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>Enviar imagem (PNG/JPG)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleLogoUpload}
                  className="sr-only"
                />
              </label>

              {draft.logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    updateField('logoUrl', '');
                    setLogoError(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remover logo</span>
                </button>
              )}
            </div>

            <input
              id="cfg-logo-url"
              type="url"
              value={draft.logoUrl.startsWith('data:') ? '' : draft.logoUrl}
              onChange={(e) => {
                setLogoError(null);
                updateField('logoUrl', e.target.value);
              }}
              placeholder={
                draft.logoUrl.startsWith('data:')
                  ? 'Imagem enviada do computador (ou cole uma URL https://...)'
                  : 'https://exemplo.com/sua-logo.png'
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black placeholder:text-neutral-400 focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
            />
            {logoError && <p className="text-xs text-red-600">{logoError}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cfg-auth-loading" className="block text-xs font-medium text-black">
              Texto da animação inicial e de verificação
            </label>
            <input
              id="cfg-auth-loading"
              type="text"
              value={draft.authLoadingText}
              onChange={(e) => updateField('authLoadingText', e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
            />
          </div>
        </div>

        {/* General Heading */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-black">Cabeçalho do formulário</h3>
          <div className="space-y-1.5">
            <label htmlFor="cfg-title" className="block text-xs font-medium text-black">
              Título do formulário
            </label>
            <input
              id="cfg-title"
              type="text"
              value={draft.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cfg-desc" className="block text-xs font-medium text-black">
              Descrição inicial
            </label>
            <textarea
              id="cfg-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
            />
          </div>
        </div>

        {/* Step 1 Texts */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-black">
            Etapa 1 — Código de 8 dígitos e confirmação
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="cfg-s1-title" className="block text-xs font-medium text-black">
                Pergunta da etapa 1
              </label>
              <input
                id="cfg-s1-title"
                type="text"
                value={draft.step1Title}
                onChange={(e) => updateField('step1Title', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cfg-s1-ok" className="block text-xs font-medium text-black">
                Título ao verificar
              </label>
              <input
                id="cfg-s1-ok"
                type="text"
                value={draft.step1SuccessTitle}
                onChange={(e) => updateField('step1SuccessTitle', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cfg-s1-msg" className="block text-xs font-medium text-black">
              Mensagem exibida após verificar os 8 dígitos
            </label>
            <input
              id="cfg-s1-msg"
              type="text"
              value={draft.step1SuccessMessage}
              onChange={(e) => updateField('step1SuccessMessage', e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
            />
          </div>
        </div>

        {/* Step 2 Texts */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-black">
            Etapa 2 — Código de 4 dígitos e conclusão
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="cfg-s2-title" className="block text-xs font-medium text-black">
                Pergunta da etapa 2
              </label>
              <input
                id="cfg-s2-title"
                type="text"
                value={draft.step2Title}
                onChange={(e) => updateField('step2Title', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cfg-final-title" className="block text-xs font-medium text-black">
                Título da confirmação final
              </label>
              <input
                id="cfg-final-title"
                type="text"
                value={draft.finalSuccessTitle}
                onChange={(e) => updateField('finalSuccessTitle', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
              />
            </div>
          </div>
        </div>

        {/* Validation & Behavior */}
        <div className="p-6 space-y-5">
          <h3 className="text-sm font-semibold text-black">Regras e campos extras</h3>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-black">Modo de validação</span>
            <div className="inline-flex p-1 bg-neutral-100 rounded-lg">
              <button
                type="button"
                onClick={() => updateField('validationMode', 'any')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  draft.validationMode === 'any'
                    ? 'bg-[#3D5AFF] text-white shadow-sm'
                    : 'text-black hover:bg-neutral-200/60'
                }`}
              >
                Aceitar qualquer código completo
              </button>
              <button
                type="button"
                onClick={() => updateField('validationMode', 'strict')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  draft.validationMode === 'strict'
                    ? 'bg-[#3D5AFF] text-white shadow-sm'
                    : 'text-black hover:bg-neutral-200/60'
                }`}
              >
                Exigir códigos da lista autorizada
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-black">
                  Avançar automaticamente após verificar 8 dígitos
                </span>
                <span className="block text-xs text-neutral-600">
                  Exibe &ldquo;{draft.step1SuccessTitle}&rdquo; e segue para os 4 dígitos.
                </span>
              </div>
              <input
                type="checkbox"
                checked={draft.autoAdvance}
                onChange={(e) => updateField('autoAdvance', e.target.checked)}
                className="w-4 h-4 accent-[#3D5AFF] rounded"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-black">
                  Ocultar dígitos do código de 4 dígitos por padrão
                </span>
                <span className="block text-xs text-neutral-600">
                  O usuário ainda pode alternar a visualização ao digitar.
                </span>
              </div>
              <input
                type="checkbox"
                checked={draft.maskCode4}
                onChange={(e) => updateField('maskCode4', e.target.checked)}
                className="w-4 h-4 accent-[#3D5AFF] rounded"
              />
            </label>
          </div>

          <div className="pt-3 border-t border-neutral-200 space-y-2.5">
            <span className="block text-xs font-medium text-black">
              Campos extras na etapa de 4 dígitos
            </span>
            {draft.extraFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between gap-4 py-1.5 text-sm"
              >
                <label className="flex items-center gap-2.5 cursor-pointer text-black">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={() => toggleExtraField(field.id, 'enabled')}
                    className="w-4 h-4 accent-[#3D5AFF] rounded"
                  />
                  <span>{field.label}</span>
                </label>

                {field.enabled && (
                  <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={() => toggleExtraField(field.id, 'required')}
                      className="w-3.5 h-3.5 accent-[#3D5AFF] rounded"
                    />
                    <span>Obrigatório</span>
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Authorized Code Pairs */}
      <div className="xl:col-span-5 bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-black">
            Códigos Autorizados (8 + 4 dígitos)
          </h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            {draft.validationMode === 'strict'
              ? 'Modo restrito ativo: apenas os pares ativos abaixo serão aceitos.'
              : 'Para exigir um destes códigos, selecione "Exigir códigos da lista autorizada" e salve.'}
          </p>
        </div>

        <form onSubmit={handleAddPair} className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-black">Cadastrar novo par</span>
            <button
              type="button"
              onClick={handleGenerateRandomPair}
              className="text-xs font-semibold text-[#3D5AFF] hover:opacity-80 whitespace-nowrap shrink-0"
            >
              Gerar números aleatórios
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Identificação (ex.: Cliente VIP)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="Código 8 dígitos"
                value={newCode8}
                onChange={(e) => setNewCode8(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
              />
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="PIN 4 dígitos"
                value={newCode4}
                onChange={(e) => setNewCode4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-neutral-300 text-black focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20"
              />
            </div>
          </div>

          {pairError && <p className="text-xs text-red-600">{pairError}</p>}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#3D5AFF] text-white text-sm font-semibold hover:bg-[#2F48E8] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Adicionar par de códigos</span>
          </button>
        </form>

        <div className="divide-y divide-neutral-200 max-h-[420px] overflow-y-auto">
          {authorizedPairs.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              Nenhum par de códigos cadastrado.
            </div>
          ) : (
            authorizedPairs.map((pair) => (
              <div
                key={pair.id}
                className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-black truncate">
                    <span className="truncate">{pair.label}</span>
                    <span aria-hidden="true" className="text-neutral-300">·</span>
                    <span
                      className={`text-xs font-medium ${
                        pair.active ? 'text-emerald-700' : 'text-neutral-400'
                      }`}
                    >
                      {pair.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-xs text-neutral-600 mt-0.5">
                    {pair.code8.slice(0, 4)}-{pair.code8.slice(4)}
                    <span aria-hidden="true" className="mx-1.5 text-neutral-300">/</span>
                    {pair.code4}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePairActive(pair.id)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-200 text-[#3D5AFF] hover:bg-neutral-100 whitespace-nowrap"
                  >
                    {pair.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPair(pair)}
                    aria-label={`Copiar código ${pair.label}`}
                    className="p-1.5 rounded-md text-[#3D5AFF] hover:bg-neutral-100"
                  >
                    {copiedId === pair.id ? (
                      <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePair(pair.id)}
                    aria-label={`Excluir código ${pair.label}`}
                    className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
