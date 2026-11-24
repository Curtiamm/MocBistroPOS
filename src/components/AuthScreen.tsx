import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LogIn, UserPlus } from 'lucide-react';
import { UserProfile } from '../types/pos';

interface AuthScreenProps {
  onAuthenticated: (token: string, user: UserProfile) => void;
}

type AuthTab = 'login' | 'register' | 'setup_admin';

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [tab, setTab] = useState<AuthTab>('login');

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register staff state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPosition, setRegPosition] = useState('Thu ngân / Phục vụ');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // First-run admin setup state
  const [setupFullName, setSetupFullName] = useState('Quản lý Mộc Bistro');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (!res.ok) return;
        const data = (await res.json()) as {
          needsAdminSetup?: boolean;
          adminUsername?: string;
        };
        if (!active) return;
        if (data.adminUsername) setAdminUsername(data.adminUsername);
        if (data.needsAdminSetup) {
          setNeedsAdminSetup(true);
          setTab('setup_admin');
        }
      } catch {
        // Fallback to login tab
      } finally {
        if (active) setCheckingStatus(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginUsername.trim() || !loginPassword) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: UserProfile;
        error?: string;
        needsAdminSetup?: boolean;
      };
      if (!res.ok) {
        if (data.needsAdminSetup) {
          setNeedsAdminSetup(true);
          setTab('setup_admin');
        }
        setError(data.error ?? 'Đăng nhập thất bại.');
        return;
      }
      if (data.token && data.user) {
        onAuthenticated(data.token, data.user);
      }
    } catch {
      setError('Không thể kết nối máy chủ xác thực.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regFullName.trim() || !regUsername.trim() || !regPassword) {
      setError('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          username: regUsername.trim(),
          phone: regPhone.trim(),
          position: regPosition.trim(),
          password: regPassword,
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: UserProfile;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Đăng ký không thành công.');
        return;
      }
      if (data.token && data.user) {
        onAuthenticated(data.token, data.user);
      }
    } catch {
      setError('Không thể kết nối máy chủ đăng ký.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (setupPassword.length < 6) {
      setError('Mật khẩu quản trị phải có ít nhất 6 ký tự.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: setupFullName.trim(),
          password: setupPassword,
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: UserProfile;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Không thể khởi tạo tài khoản quản trị.');
        return;
      }
      if (data.token && data.user) {
        onAuthenticated(data.token, data.user);
      }
    } catch {
      setError('Không thể kết nối máy chủ khởi tạo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F7F4EE] text-[#231D19]">
      {/* LEFT EDITORIAL BISTRO PANEL */}
      <div className="lg:col-span-5 bg-[#1E4D3B] text-[#F7F4EE] p-10 xl:p-14 flex flex-col justify-between relative overflow-hidden">
        <div className="space-y-8 relative z-10">
          <div>
            <p className="text-xs font-medium text-[#F7F4EE]/70">
              Hệ thống thu ngân & vận hành tại bàn
            </p>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white mt-2">
              Mộc Bistro POS
            </h1>
          </div>

          <div className="rounded-xl overflow-hidden border border-white/15 aspect-[4/3] max-w-md relative">
            <img
              src="/src/assets/images/dish_beef_steak_1795529869230.jpg"
              alt="Món chính tại Mộc Bistro"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#163B2D]/85 via-[#163B2D]/20 to-transparent flex items-end p-5">
              <p className="text-xs text-[#F7F4EE]/95 leading-relaxed">
                Phân tách rõ ràng không gian phục vụ của nhân viên và quyền quản trị của chủ quán.
              </p>
            </div>
          </div>

          <div className="space-y-4 max-w-md pt-2">
            <div className="border-t border-white/15 pt-4">
              <p className="text-sm font-semibold text-white">Tài khoản Nhân viên</p>
              <p className="text-xs text-[#F7F4EE]/75 mt-1 leading-relaxed">
                Thao tác Sơ đồ bàn, Gọi món tại bàn, theo dõi Thực đơn & tình trạng hết món, chốt Doanh thu & Ca làm.
              </p>
            </div>
            <div className="border-t border-white/15 pt-4">
              <p className="text-sm font-semibold text-white">Tài khoản Quản lý ({adminUsername})</p>
              <p className="text-xs text-[#F7F4EE]/75 mt-1 leading-relaxed">
                Quản lý hồ sơ nhân viên, thêm/sửa/xóa thực đơn và sơ đồ bàn, đối soát toàn bộ doanh thu & hủy hóa đơn.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#F7F4EE]/60 relative z-10 pt-8">
          48 Nguyễn Thị Minh Khai, Quận 1 · Mộc Bistro
        </p>
      </div>

      {/* RIGHT AUTHENTICATION WORKSPACE */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-[#E5DDD2] rounded-xl p-8 space-y-6">
          {/* Segmented Mode Switcher */}
          <div
            className={`grid gap-1 p-1 bg-[#EFEAE0] rounded-lg ${
              needsAdminSetup ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {needsAdminSetup && (
              <button
                type="button"
                onClick={() => {
                  setTab('setup_admin');
                  setError(null);
                }}
                className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  tab === 'setup_admin'
                    ? 'bg-white text-[#231D19] shadow-xs'
                    : 'text-[#6B6056] hover:text-[#231D19]'
                }`}
              >
                Khởi tạo Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'login'
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'register'
                  ? 'bg-white text-[#231D19] shadow-xs'
                  : 'text-[#6B6056] hover:text-[#231D19]'
              }`}
            >
              Đăng ký nhân viên
            </button>
          </div>

          {checkingStatus ? (
            <div className="py-12 text-center text-sm text-[#6B6056]">
              Đang kiểm tra trạng thái hệ thống...
            </div>
          ) : tab === 'setup_admin' && needsAdminSetup ? (
            <form onSubmit={handleSetupAdmin} className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#231D19]">
                  Thiết lập quản trị viên lần đầu
                </h2>
                <p className="text-xs text-[#6B6056] mt-1 leading-relaxed">
                  Đặt mật khẩu cho tài khoản quản lý <strong className="font-tabular text-[#231D19]">{adminUsername}</strong>. Mật khẩu sẽ được băm an toàn trên máy chủ và khóa bước thiết lập này sau khi hoàn tất.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Tên đăng nhập quản trị
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  disabled
                  className="w-full px-3.5 py-2.5 text-sm font-tabular bg-[#F7F4EE] border border-[#E5DDD2] rounded-lg text-[#6B6056]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Tên hiển thị quản lý
                </label>
                <input
                  type="text"
                  value={setupFullName}
                  onChange={(e) => setSetupFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  placeholder="Quản lý Mộc Bistro"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Mật khẩu quản trị (tối thiểu 6 ký tự)
                </label>
                <input
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Nhập mật khẩu bạn muốn đặt cho admin"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#231D19]">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  value={setupConfirmPassword}
                  onChange={(e) => setSetupConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu quản trị"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="text-xs font-semibold text-[#9E2A2B]">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] disabled:opacity-50 rounded-lg transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                <span>{submitting ? 'Đang khởi tạo...' : 'Lưu mật khẩu & Vào trang Quản lý'}</span>
              </button>
            </form>
          ) : tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#231D19]">
                  Đăng nhập ca làm việc
                </h2>
                <p className="text-xs text-[#6B6056] mt-1">
                  Sử dụng tài khoản Nhân viên hoặc Quản lý ({adminUsername}) để truy cập hệ thống.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-username" className="text-xs font-semibold text-[#231D19]">
                  Tên đăng nhập
                </label>
                <input
                  id="login-username"
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="VD: admin hoặc tên đăng nhập nhân viên"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-xs font-semibold text-[#231D19]">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    autoComplete="current-password"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B6056] hover:text-[#231D19]"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs font-semibold text-[#9E2A2B]">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] disabled:opacity-50 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>{submitting ? 'Đang xác thực...' : 'Đăng nhập'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#231D19]">
                  Đăng ký tài khoản nhân viên
                </h2>
                <p className="text-xs text-[#6B6056] mt-1">
                  Tài khoản tự đăng ký được cấp quyền Nhân viên (Sơ đồ bàn, Gọi món, Thực đơn, Doanh thu & Ca).
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#231D19]">Họ và tên *</label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="VD: Lê Hoàng Nam"
                  className="w-full px-3.5 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#231D19]">Tên đăng nhập *</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="VD: hoangnam"
                    autoComplete="username"
                    className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#231D19]">Số điện thoại</label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0909 123 456"
                    className="w-full px-3 py-2 text-sm font-tabular border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#231D19]">Vị trí công việc</label>
                <select
                  value={regPosition}
                  onChange={(e) => setRegPosition(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                >
                  <option value="Thu ngân / Phục vụ">Thu ngân / Phục vụ</option>
                  <option value="Thu ngân quầy">Thu ngân quầy</option>
                  <option value="Phục vụ bàn">Phục vụ bàn</option>
                  <option value="Pha chế (Barista)">Pha chế (Barista)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#231D19]">Mật khẩu *</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#231D19]">Nhập lại *</label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Xác nhận mật khẩu"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 text-sm border border-[#E5DDD2] rounded-lg focus:outline-none focus:border-[#1E4D3B]"
                  />
                </div>
              </div>

              {error && <p className="text-xs font-semibold text-[#9E2A2B]">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] disabled:opacity-50 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>{submitting ? 'Đang tạo tài khoản...' : 'Đăng ký & Đăng nhập'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
