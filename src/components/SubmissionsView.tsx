import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  Search,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { FormConfig, OnlineVisitor, SubmissionRecord } from '../types';

interface SubmissionsViewProps {
  submissions: SubmissionRecord[];
  onlineVisitors: OnlineVisitor[];
  config: FormConfig;
  onClearAll: () => void;
  onDeleteRecord: (id: string) => void;
  onOpenForm: () => void;
}

export const SubmissionsView: React.FC<SubmissionsViewProps> = ({
  submissions,
  onlineVisitors,
  config,
  onClearAll,
  onDeleteRecord,
  onOpenForm,
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'Concluído' | 'Etapa 1 verificada' | 'Recusado'
  >('all');
  const [revealCodes, setRevealCodes] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        item.protocol.toLowerCase().includes(q) ||
        item.code8.includes(q) ||
        item.code4.includes(q) ||
        Object.values(item.extraData).some((v) => v.toLowerCase().includes(q))
      );
    });
  }, [submissions, query, statusFilter]);

  const completedCount = submissions.filter((s) => s.status === 'Concluído').length;
  const partialCount = submissions.filter((s) => s.status === 'Etapa 1 verificada').length;

  const selectedRecord = useMemo(
    () => submissions.find((s) => s.id === selectedId) ?? null,
    [submissions, selectedId]
  );

  const handleExportCsv = () => {
    const headers = [
      'Protocolo',
      'Status',
      'Codigo_8_Digitos',
      'Codigo_4_Digitos',
      'Dados_Extras',
      'Data_Hora',
    ];
    const rows = filtered.map((s) => [
      s.protocol,
      s.status,
      s.code8,
      s.code4,
      Object.entries(s.extraData)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | '),
      new Date(s.createdAt).toLocaleString('pt-BR'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `registros-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maskCode = (code: string, visibleTail: number) => {
    if (revealCodes) return code;
    if (code === '----') return code;
    return `${'•'.repeat(Math.max(0, code.length - visibleTail))}${code.slice(-visibleTail)}`;
  };

  return (
    <div className="space-y-6">
      {/* Compact Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <span className="block text-xs font-medium text-neutral-600">Online agora</span>
          <span className="block text-2xl font-bold font-mono tabular-nums text-[#3D5AFF] mt-1">
            {onlineVisitors.length}
          </span>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <span className="block text-xs font-medium text-neutral-600">Total preenchidos</span>
          <span className="block text-2xl font-bold font-mono tabular-nums text-black mt-1">
            {submissions.length}
          </span>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <span className="block text-xs font-medium text-neutral-600">Concluídos (8 + 4)</span>
          <span className="block text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {completedCount}
          </span>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <span className="block text-xs font-medium text-neutral-600">Aguardando 4 dígitos</span>
          <span className="block text-2xl font-bold font-mono tabular-nums text-black mt-1">
            {partialCount}
          </span>
        </div>
      </div>

      {/* Online Visitors Live Feed */}
      {onlineVisitors.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between gap-4 bg-[#FCFC30]/35">
            <div className="flex items-center gap-2 text-sm font-semibold text-black">
              <Users className="w-4 h-4 text-[#3D5AFF]" aria-hidden="true" />
              <span>Visitantes ativos no momento</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-black">
              {onlineVisitors.length} online
            </span>
          </div>
          <div className="divide-y divide-neutral-200">
            {onlineVisitors.map((visitor) => (
              <div
                key={visitor.sessionId}
                className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-neutral-500">
                    {visitor.sessionId.slice(0, 10)}
                  </span>
                  <span aria-hidden="true" className="text-neutral-300">·</span>
                  <span className="font-medium text-black">{visitor.step}</span>
                </div>
                {visitor.code8Preview && (
                  <span className="font-mono tabular-nums text-[#3D5AFF] font-semibold">
                    {visitor.code8Preview.length > 4
                      ? `${visitor.code8Preview.slice(0, 4)}-${visitor.code8Preview.slice(4)}`
                      : visitor.code8Preview}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Data Grid */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Buscar protocolo, código ou nome..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-3.5 py-2 text-sm rounded-lg border border-neutral-300 text-black placeholder:text-neutral-400 focus:outline-none focus:border-[#3D5AFF] focus:ring-4 focus:ring-[#3D5AFF]/20 w-64"
              />
            </div>

            <div className="inline-flex p-1 bg-neutral-100 rounded-lg">
              {(['all', 'Concluído', 'Etapa 1 verificada', 'Recusado'] as const).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === status
                        ? 'bg-[#3D5AFF] text-white shadow-sm'
                        : 'text-black hover:bg-neutral-200/60'
                    }`}
                  >
                    {status === 'all'
                      ? 'Todos'
                      : status === 'Etapa 1 verificada'
                      ? 'Só 8 dígitos'
                      : status}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setRevealCodes((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-[#3D5AFF] hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
            >
              {revealCodes ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ocultar códigos</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mostrar códigos</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-[#3D5AFF] hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exportar CSV</span>
            </button>

            {submissions.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="px-3 py-2 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
              >
                Limpar lista
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-black">
              {submissions.length === 0
                ? 'Nenhum preenchimento registrado ainda.'
                : 'Nenhum registro encontrado para este filtro.'}
            </p>
            <p className="text-xs text-neutral-600 max-w-sm mx-auto">
              {submissions.length === 0
                ? 'Assim que alguém informar os 8 dígitos e os 4 dígitos no site, o registro aparecerá aqui automaticamente.'
                : 'Tente alterar os termos da busca ou selecionar outro filtro.'}
            </p>
            {submissions.length === 0 && (
              <button
                type="button"
                onClick={onOpenForm}
                className="mt-2 inline-flex items-center px-4 py-2 rounded-lg bg-[#3D5AFF] text-white text-xs font-semibold hover:bg-[#2F48E8] transition-colors"
              >
                Abrir site principal
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-600">
                  <th className="py-3 px-5">Protocolo</th>
                  <th className="py-3 px-4">Código 8 dígitos</th>
                  <th className="py-3 px-4">Código 4 dígitos</th>
                  <th className="py-3 px-4">Dados informados</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Data e hora</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-sm">
                {filtered.map((row) => {
                  const extraEntries = Object.entries(row.extraData);
                  const isSelected = selectedId === row.id;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(isSelected ? null : row.id)}
                      className={`cursor-pointer transition-colors h-11 ${
                        isSelected ? 'bg-[#FCFC30]/25' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <td className="py-2.5 px-5 font-mono tabular-nums text-xs font-semibold text-black">
                        {row.protocol}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-medium text-black">
                        {row.code8.length === 8
                          ? `${maskCode(row.code8.slice(0, 4), 4)}-${maskCode(
                              row.code8.slice(4),
                              4
                            )}`
                          : row.code8}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs font-medium text-black">
                        {maskCode(row.code4, 4)}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-neutral-700 max-w-[220px] truncate">
                        {extraEntries.length > 0
                          ? extraEntries.map(([, val]) => val).join(' · ')
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {row.status === 'Concluído' ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Concluído</span>
                          </span>
                        ) : row.status === 'Etapa 1 verificada' ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#3D5AFF]">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Etapa 1 verificada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Recusado</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-neutral-600 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td
                        className="py-2.5 px-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(row.id)}
                          aria-label={`Remover protocolo ${row.protocol}`}
                          className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Submission Inspection Panel */}
      {selectedRecord && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <span className="text-xs font-medium text-neutral-500">
                Detalhes do registro
              </span>
              <h3 className="text-base font-semibold font-mono tabular-nums text-black mt-0.5">
                {selectedRecord.protocol}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-xs font-semibold text-[#3D5AFF] hover:opacity-80 px-3 py-1.5 rounded-md border border-neutral-200"
            >
              Fechar detalhes
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div>
              <span className="block text-xs text-neutral-500">Código de 8 dígitos</span>
              <span className="block font-mono tabular-nums font-semibold text-black mt-1">
                {selectedRecord.code8.length === 8
                  ? `${selectedRecord.code8.slice(0, 4)}-${selectedRecord.code8.slice(4)}`
                  : selectedRecord.code8}
              </span>
            </div>
            <div>
              <span className="block text-xs text-neutral-500">Código de 4 dígitos</span>
              <span className="block font-mono tabular-nums font-semibold text-black mt-1">
                {selectedRecord.code4}
              </span>
            </div>
            <div>
              <span className="block text-xs text-neutral-500">Status</span>
              <span className="block font-medium text-black mt-1">
                {selectedRecord.status}
              </span>
            </div>
            <div>
              <span className="block text-xs text-neutral-500">Enviado em</span>
              <span className="block font-mono tabular-nums text-neutral-700 text-xs mt-1.5">
                {new Date(selectedRecord.createdAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {Object.keys(selectedRecord.extraData).length > 0 && (
            <div className="pt-4 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {Object.entries(selectedRecord.extraData).map(([key, val]) => {
                const meta = config.extraFields.find((f) => f.id === key);
                return (
                  <div key={key}>
                    <span className="block text-xs text-neutral-500">
                      {meta?.label ?? key}
                    </span>
                    <span className="block font-medium text-black mt-0.5">{val}</span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedRecord.reason && (
            <div className="pt-3 border-t border-neutral-200 text-xs text-red-700">
              Motivo da recusa: {selectedRecord.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
