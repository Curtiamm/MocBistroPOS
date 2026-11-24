import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

type UserRole = 'manager' | 'staff';
type UserStatus = 'active' | 'locked';

interface StoredUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  position: string;
  phone: string;
  shiftSchedule: string;
  status: UserStatus;
  createdAt: string;
  passwordSalt: string;
  passwordHash: string;
  isPrimaryAdmin?: boolean;
}

interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  position: string;
  phone: string;
  shiftSchedule: string;
  status: UserStatus;
  createdAt: string;
  isPrimaryAdmin?: boolean;
}

interface AuthStoreData {
  adminClaimedSalt: string | null;
  adminClaimedHash: string | null;
  users: StoredUser[];
}

interface TokenPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti: string;
}

interface AuthedRequest extends Request {
  authUser?: PublicUser;
  authTokenJti?: string;
}

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const BASE_DIR = process.cwd();
const DATA_DIR = path.resolve(BASE_DIR, 'data');
const AUTH_STORE_FILE = resolveConfinedPath('auth-store.json');
const POS_STATE_FILE = resolveConfinedPath('pos-state.json');

const revokedJtis = new Set<string>();

function resolveConfinedPath(filename: string): string {
  const safeName = path.basename(filename);
  const resolved = path.resolve(DATA_DIR, safeName);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid storage path');
  }
  return resolved;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPasswordHash(password: string, salt: string, expectedHash: string): boolean {
  if (!salt || !expectedHash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function verifySecretString(input: string, secret: string): boolean {
  const a = crypto.createHash('sha256').update(input, 'utf8').digest();
  const b = crypto.createHash('sha256').update(secret, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

function getEnvAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

function createInitialAuthStore(): AuthStoreData {
  const now = new Date().toISOString();
  return {
    adminClaimedSalt: null,
    adminClaimedHash: null,
    users: [
      {
        id: 'usr-admin',
        username: ADMIN_USERNAME,
        fullName: 'Quản lý Mộc Bistro',
        role: 'manager',
        position: 'Quản lý nhà hàng',
        phone: '0908 112 233',
        shiftSchedule: 'Toàn thời gian',
        status: 'active',
        createdAt: now,
        passwordSalt: '',
        passwordHash: '',
        isPrimaryAdmin: true,
      },
      {
        id: 'usr-staff-01',
        username: 'minhanh',
        fullName: 'Nguyễn Minh Anh',
        role: 'staff',
        position: 'Thu ngân ca sáng',
        phone: '0912 345 678',
        shiftSchedule: 'Ca sáng (08:00 - 15:00)',
        status: 'active',
        createdAt: now,
        passwordSalt: '',
        passwordHash: '',
      },
      {
        id: 'usr-staff-02',
        username: 'giahuy',
        fullName: 'Trần Gia Huy',
        role: 'staff',
        position: 'Phục vụ bàn',
        phone: '0938 776 543',
        shiftSchedule: 'Ca tối (15:00 - 22:30)',
        status: 'active',
        createdAt: now,
        passwordSalt: '',
        passwordHash: '',
      },
    ],
  };
}

function readAuthStore(): AuthStoreData {
  ensureDataDir();
  if (!fs.existsSync(AUTH_STORE_FILE)) {
    const initial = createInitialAuthStore();
    fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_STORE_FILE, 'utf8')) as AuthStoreData;
    if (!parsed || !Array.isArray(parsed.users)) {
      const initial = createInitialAuthStore();
      fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    return parsed;
  } catch {
    const initial = createInitialAuthStore();
    fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function writeAuthStore(store: AuthStoreData): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    position: user.position,
    phone: user.phone,
    shiftSchedule: user.shiftSchedule,
    status: user.status,
    createdAt: user.createdAt,
    isPrimaryAdmin: user.isPrimaryAdmin,
  };
}

function signToken(user: PublicUser): string {
  const now = Date.now();
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_MS,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!payload || !payload.sub || !payload.exp || !payload.jti) return null;
    if (Date.now() > payload.exp) return null;
    if (revokedJtis.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

function readPosState(): Record<string, unknown> | null {
  ensureDataDir();
  if (!fs.existsSync(POS_STATE_FILE)) return null;
  try {
    const raw = fs.readFileSync(POS_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function writePosState(state: Record<string, unknown>): void {
  ensureDataDir();
  fs.writeFileSync(POS_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('/src/assets/images/') && !trimmed.includes('..')) {
    return true;
  }
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= 700_000;
  }
  return false;
}

function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(username);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    return;
  }

  const store = readAuthStore();
  const user = store.users.find((u) => u.id === payload.sub);
  if (!user || user.status !== 'active') {
    res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
    return;
  }

  req.authUser = toPublicUser(user);
  req.authTokenJti = payload.jti;
  next();
}

function requireManager(req: AuthedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.authUser?.role !== 'manager') {
      res.status(403).json({ error: 'Chỉ tài khoản Quản lý mới có quyền thực hiện thao tác này.' });
      return;
    }
    next();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // ============================================
  // AUTH ROUTES
  // ============================================

  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const store = readAuthStore();
    const envAdminPwd = getEnvAdminPassword();
    const needsAdminSetup = !envAdminPwd && !store.adminClaimedHash;
    res.json({
      needsAdminSetup,
      adminUsername: ADMIN_USERNAME,
    });
  });

  app.post('/api/auth/setup-admin', (req: Request, res: Response) => {
    const store = readAuthStore();
    if (getEnvAdminPassword() || store.adminClaimedHash) {
      res.status(409).json({
        error: 'Tài khoản quản trị đã được thiết lập trước đó.',
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const fullName =
      typeof req.body?.fullName === 'string' && req.body.fullName.trim().length >= 2
        ? req.body.fullName.trim().slice(0, 80)
        : 'Quản lý Mộc Bistro';

    if (password.length < 6 || password.length > 100) {
      res.status(400).json({ error: 'Mật khẩu quản trị phải có từ 6 đến 100 ký tự.' });
      return;
    }

    const { salt, hash } = hashPassword(password);
    store.adminClaimedSalt = salt;
    store.adminClaimedHash = hash;

    let adminUser = store.users.find((u) => u.isPrimaryAdmin || u.username === ADMIN_USERNAME);
    if (!adminUser) {
      adminUser = {
        id: 'usr-admin',
        username: ADMIN_USERNAME,
        fullName,
        role: 'manager',
        position: 'Quản lý nhà hàng',
        phone: '',
        shiftSchedule: 'Toàn thời gian',
        status: 'active',
        createdAt: new Date().toISOString(),
        passwordSalt: salt,
        passwordHash: hash,
        isPrimaryAdmin: true,
      };
      store.users.unshift(adminUser);
    } else {
      adminUser.fullName = fullName;
      adminUser.role = 'manager';
      adminUser.status = 'active';
      adminUser.passwordSalt = salt;
      adminUser.passwordHash = hash;
    }

    writeAuthStore(store);
    const publicUser = toPublicUser(adminUser);
    const token = signToken(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 20) : '';
    const position =
      typeof req.body?.position === 'string' && req.body.position.trim()
        ? req.body.position.trim().slice(0, 60)
        : 'Nhân viên phục vụ';

    if (!isValidUsername(rawUsername)) {
      res.status(400).json({
        error: 'Tên đăng nhập phải từ 3–30 ký tự, chỉ gồm chữ, số, dấu chấm hoặc gạch dưới.',
      });
      return;
    }
    if (rawUsername === ADMIN_USERNAME) {
      res.status(400).json({ error: 'Tên đăng nhập này dành riêng cho quản trị viên.' });
      return;
    }
    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({ error: 'Họ tên nhân viên phải từ 2 đến 80 ký tự.' });
      return;
    }
    if (password.length < 6 || password.length > 100) {
      res.status(400).json({ error: 'Mật khẩu phải có từ 6 đến 100 ký tự.' });
      return;
    }

    const store = readAuthStore();
    if (store.users.some((u) => u.username.toLowerCase() === rawUsername)) {
      res.status(409).json({ error: `Tên đăng nhập "${rawUsername}" đã tồn tại.` });
      return;
    }

    const { salt, hash } = hashPassword(password);
    const newUser: StoredUser = {
      id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      username: rawUsername,
      fullName,
      // Public self-registration ALWAYS creates a staff account
      role: 'staff',
      position,
      phone,
      shiftSchedule: 'Linh hoạt theo phân công',
      status: 'active',
      createdAt: new Date().toISOString(),
      passwordSalt: salt,
      passwordHash: hash,
    };

    store.users.push(newUser);
    writeAuthStore(store);

    const publicUser = toPublicUser(newUser);
    const token = signToken(publicUser);
    res.status(201).json({ token, user: publicUser });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
      return;
    }

    const store = readAuthStore();
    const user = store.users.find((u) => u.username.toLowerCase() === username);
    if (!user) {
      res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Tài khoản này đã bị quản lý tạm khóa.' });
      return;
    }

    let isValid = false;
    if (user.isPrimaryAdmin || user.username.toLowerCase() === ADMIN_USERNAME) {
      const envAdminPwd = getEnvAdminPassword();
      if (envAdminPwd) {
        isValid = verifySecretString(password, envAdminPwd);
      } else if (store.adminClaimedSalt && store.adminClaimedHash) {
        isValid = verifyPasswordHash(password, store.adminClaimedSalt, store.adminClaimedHash);
      } else {
        res.status(409).json({
          error: 'Tài khoản admin chưa được khởi tạo mật khẩu. Vui lòng thiết lập mật khẩu lần đầu.',
          needsAdminSetup: true,
        });
        return;
      }
    } else {
      isValid = verifyPasswordHash(password, user.passwordSalt, user.passwordHash);
    }

    if (!isValid) {
      res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      return;
    }

    const publicUser = toPublicUser(user);
    const token = signToken(publicUser);
    res.json({ token, user: publicUser });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.authTokenJti) {
      revokedJtis.add(req.authTokenJti);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  // ============================================
  // STAFF PROFILE MANAGEMENT (MANAGER ONLY)
  // ============================================

  app.get('/api/staff', requireManager, (_req: AuthedRequest, res: Response) => {
    const store = readAuthStore();
    res.json({ users: store.users.map(toPublicUser) });
  });

  app.post('/api/staff', requireManager, (req: AuthedRequest, res: Response) => {
    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const role: UserRole = req.body?.role === 'manager' ? 'manager' : 'staff';
    const position =
      typeof req.body?.position === 'string' && req.body.position.trim()
        ? req.body.position.trim().slice(0, 60)
        : role === 'manager'
          ? 'Quản lý ca'
          : 'Nhân viên phục vụ';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 20) : '';
    const shiftSchedule =
      typeof req.body?.shiftSchedule === 'string' && req.body.shiftSchedule.trim()
        ? req.body.shiftSchedule.trim().slice(0, 80)
        : 'Ca sáng (08:00 - 15:00)';

    if (!isValidUsername(rawUsername)) {
      res.status(400).json({ error: 'Tên đăng nhập phải từ 3–30 ký tự hợp lệ.' });
      return;
    }
    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({ error: 'Họ tên phải từ 2 đến 80 ký tự.' });
      return;
    }
    if (password.length < 6 || password.length > 100) {
      res.status(400).json({ error: 'Mật khẩu khởi tạo phải có ít nhất 6 ký tự.' });
      return;
    }

    const store = readAuthStore();
    if (store.users.some((u) => u.username.toLowerCase() === rawUsername)) {
      res.status(409).json({ error: `Tên đăng nhập "${rawUsername}" đã tồn tại.` });
      return;
    }

    const { salt, hash } = hashPassword(password);
    const created: StoredUser = {
      id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      username: rawUsername,
      fullName,
      role,
      position,
      phone,
      shiftSchedule,
      status: 'active',
      createdAt: new Date().toISOString(),
      passwordSalt: salt,
      passwordHash: hash,
    };

    store.users.push(created);
    writeAuthStore(store);
    res.status(201).json({ user: toPublicUser(created) });
  });

  app.patch('/api/staff/:id', requireManager, (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const store = readAuthStore();
    const target = store.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: 'Không tìm thấy hồ sơ nhân viên.' });
      return;
    }

    if (typeof req.body?.fullName === 'string') {
      const trimmed = req.body.fullName.trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        res.status(400).json({ error: 'Họ tên phải từ 2 đến 80 ký tự.' });
        return;
      }
      target.fullName = trimmed;
    }
    if (typeof req.body?.position === 'string') {
      target.position = req.body.position.trim().slice(0, 60) || target.position;
    }
    if (typeof req.body?.phone === 'string') {
      target.phone = req.body.phone.trim().slice(0, 20);
    }
    if (typeof req.body?.shiftSchedule === 'string') {
      target.shiftSchedule = req.body.shiftSchedule.trim().slice(0, 80);
    }

    if (!target.isPrimaryAdmin) {
      if (req.body?.role === 'manager' || req.body?.role === 'staff') {
        target.role = req.body.role;
      }
      if (req.body?.status === 'active' || req.body?.status === 'locked') {
        if (target.id === req.authUser?.id && req.body.status === 'locked') {
          res.status(400).json({ error: 'Không thể tự khóa tài khoản đang đăng nhập.' });
          return;
        }
        target.status = req.body.status;
      }
    }

    if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length > 0) {
      if (req.body.newPassword.length < 6 || req.body.newPassword.length > 100) {
        res.status(400).json({ error: 'Mật khẩu mới phải từ 6 đến 100 ký tự.' });
        return;
      }
      const { salt, hash } = hashPassword(req.body.newPassword);
      target.passwordSalt = salt;
      target.passwordHash = hash;
      if (target.isPrimaryAdmin && !getEnvAdminPassword()) {
        store.adminClaimedSalt = salt;
        store.adminClaimedHash = hash;
      }
    }

    writeAuthStore(store);
    res.json({ user: toPublicUser(target) });
  });

  app.delete('/api/staff/:id', requireManager, (req: AuthedRequest, res: Response) => {
    const id = req.params.id;
    const store = readAuthStore();
    const target = store.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: 'Không tìm thấy nhân viên cần xóa.' });
      return;
    }
    if (target.isPrimaryAdmin) {
      res.status(400).json({ error: 'Không thể xóa tài khoản quản trị viên gốc.' });
      return;
    }
    if (target.id === req.authUser?.id) {
      res.status(400).json({ error: 'Không thể tự xóa tài khoản đang đăng nhập.' });
      return;
    }
    store.users = store.users.filter((u) => u.id !== id);
    writeAuthStore(store);
    res.json({ ok: true });
  });

  // ============================================
  // SHARED POS STATE ROUTES WITH SERVER RBAC
  // ============================================

  app.get('/api/pos/state', requireAuth, (_req: AuthedRequest, res: Response) => {
    const posState = readPosState();
    res.json({ state: posState });
  });

  // Operational state sync (both staff and manager can take orders, checkout, open/close shift, toggle stock)
  // Server protects manager-only fields (table structure, menu catalog CRUD, voiding invoices) when caller is staff
  app.put('/api/pos/state', requireAuth, (req: AuthedRequest, res: Response) => {
    const incoming = req.body?.state;
    if (
      !incoming ||
      typeof incoming !== 'object' ||
      !Array.isArray(incoming.tables) ||
      !Array.isArray(incoming.menu) ||
      typeof incoming.orders !== 'object' ||
      !Array.isArray(incoming.invoices) ||
      !Array.isArray(incoming.shifts)
    ) {
      res.status(400).json({ error: 'Dữ liệu POS không hợp lệ.' });
      return;
    }

    // Validate image URLs on menu items to prevent unsafe URL schemes
    for (const m of incoming.menu) {
      if (typeof m?.imageUrl === 'string' && !isSafeImageUrl(m.imageUrl)) {
        res.status(400).json({ error: 'Đường dẫn hình ảnh món ăn không hợp lệ.' });
        return;
      }
    }

    const existing = readPosState();
    const isManager = req.authUser?.role === 'manager';

    if (!existing || isManager) {
      writePosState(incoming as Record<string, unknown>);
      res.json({ ok: true });
      return;
    }

    // Staff permission enforcement: keep existing table definitions (only allow status/activeOrderId changes),
    // keep existing menu definitions (only allow `available` toggle), and prevent voiding paid invoices.
    const existingTables = Array.isArray(existing.tables)
      ? (existing.tables as Array<Record<string, unknown>>)
      : [];
    const incomingTablesById = new Map<string, Record<string, unknown>>();
    for (const t of incoming.tables as Array<Record<string, unknown>>) {
      if (typeof t?.id === 'string') incomingTablesById.set(t.id, t);
    }
    const mergedTables = existingTables.map((et) => {
      const inc = typeof et.id === 'string' ? incomingTablesById.get(et.id) : undefined;
      if (!inc) return et;
      return {
        ...et,
        status: inc.status === 'occupied' ? 'occupied' : 'available',
        activeOrderId: typeof inc.activeOrderId === 'string' ? inc.activeOrderId : null,
      };
    });

    const existingMenu = Array.isArray(existing.menu)
      ? (existing.menu as Array<Record<string, unknown>>)
      : [];
    const incomingMenuById = new Map<string, Record<string, unknown>>();
    for (const m of incoming.menu as Array<Record<string, unknown>>) {
      if (typeof m?.id === 'string') incomingMenuById.set(m.id, m);
    }
    const mergedMenu = existingMenu.map((em) => {
      const inc = typeof em.id === 'string' ? incomingMenuById.get(em.id) : undefined;
      if (!inc) return em;
      return {
        ...em,
        available: Boolean(inc.available),
      };
    });

    const existingInvoicesById = new Map<string, Record<string, unknown>>();
    if (Array.isArray(existing.invoices)) {
      for (const inv of existing.invoices as Array<Record<string, unknown>>) {
        if (typeof inv?.id === 'string') existingInvoicesById.set(inv.id, inv);
      }
    }
    const mergedInvoices = (incoming.invoices as Array<Record<string, unknown>>).map((inc) => {
      const prev = typeof inc?.id === 'string' ? existingInvoicesById.get(inc.id) : undefined;
      // Staff cannot void previously paid invoices
      if (prev && prev.status === 'paid' && inc.status === 'voided') {
        return prev;
      }
      return inc;
    });

    const sanitizedState: Record<string, unknown> = {
      ...existing,
      tables: mergedTables,
      menu: mergedMenu,
      orders: incoming.orders,
      invoices: mergedInvoices,
      shifts: incoming.shifts,
      activeShiftId: incoming.activeShiftId ?? null,
      invoiceCounter:
        typeof incoming.invoiceCounter === 'number'
          ? incoming.invoiceCounter
          : existing.invoiceCounter,
    };

    writePosState(sanitizedState);
    res.json({ ok: true });
  });

  // ============================================
  // VITE / STATIC SERVING
  // ============================================

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(BASE_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Moc Bistro POS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
