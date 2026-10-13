import React from 'react';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, ShieldAlert, Clock } from 'lucide-react';
import { api } from '../api';
import type { User as UserType } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserType, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Failed login attempt tracking & lockout timer
  const [remainingAttempts, setRemainingAttempts] = React.useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = React.useState<number>(0);

  // Live countdown timer for lockout
  React.useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setError(null);
          setRemainingAttempts(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const formatLockoutTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (loading || lockoutSeconds > 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ username: username.trim(), password });
      api.setToken(res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      // Clear password field on failed attempt
      setPassword('');

      const errData = err.data;
      if (err.status === 429 || errData?.locked) {
        const secs = Number(errData?.retry_after_seconds) || 900;
        setLockoutSeconds(secs);
        setRemainingAttempts(0);
        setError(err.message || `Account temporarily locked. Please wait before retrying.`);
      } else {
        if (typeof errData?.remaining_attempts === 'number') {
          setRemainingAttempts(errData.remaining_attempts);
        }
        setError(err.message || 'Invalid username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#131728] to-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit(e);
          }}
          action="javascript:void(0);"
          method="POST"
          className="p-8 space-y-4"
        >
          <div className="flex flex-col items-center justify-center pt-1 pb-3 text-center">
            <img src="/logo.png?v=latest" alt="Vectis" className="w-16 h-16 object-contain mb-2 drop-shadow-md" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Vectis ERP</h2>
            <p className="text-xs text-slate-500 font-medium">Universal Digital Products Reseller</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs space-y-2">
              <div className="flex items-center gap-2">
                {lockoutSeconds > 0 ? (
                  <ShieldAlert size={16} className="shrink-0 text-red-600" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                )}
                <span className="font-semibold">{error}</span>
              </div>
              {(error.includes('DATABASE_URL') || error.includes('ECONNREFUSED') || error.includes('Database is not configured')) && (
                <div className="pt-1 flex justify-end">
                  <a
                    href="/install"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition shadow-xs"
                  >
                    Open Database Installer →
                  </a>
                </div>
              )}
            </div>
          )}

          {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts <= 3 && lockoutSeconds === 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="shrink-0 text-amber-600" />
                <span>
                  {remainingAttempts === 1
                    ? 'Final attempt before 15-minute security lockout.'
                    : `${remainingAttempts} attempts remaining before temporary lockout.`}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-blue-600" />
                Username
              </label>
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or email"
              disabled={lockoutSeconds > 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={13} className="text-blue-600" />
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={lockoutSeconds > 0}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition pr-10 disabled:opacity-60 disabled:cursor-not-allowed"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                lockoutSeconds > 0
                  ? 'bg-rose-100 text-rose-700 border border-rose-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-lg shadow-blue-600/30 cursor-pointer'
              }`}
            >
              {loading ? (
                <span>Signing in...</span>
              ) : lockoutSeconds > 0 ? (
                <>
                  <Clock size={14} className="animate-spin text-rose-600" />
                  <span>Locked: Retry in {formatLockoutTime(lockoutSeconds)}</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>

          <div className="pt-2 text-center">
            <a
              href="/install"
              className="text-[11px] text-slate-400 hover:text-blue-600 font-medium transition"
            >
              Need to configure or install database? Run Setup Wizard →
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

