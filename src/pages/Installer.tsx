import React from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Database,
  User,
  Settings,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Server,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Building2
} from 'lucide-react';
import { api } from '../api';
import type { User as UserType } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InstallerProps {
  onInstallComplete?: (user: UserType, token: string) => void;
  onInstalled?: () => void;
}

type StepStatus = 'pending' | 'active' | 'done' | 'error';

interface Step {
  id: number;
  label: string;
  icon: React.ElementType;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  { id: 1, label: 'Welcome',       icon: Sparkles   },
  { id: 2, label: 'Database',      icon: Database   },
  { id: 3, label: 'Setup',         icon: Settings   },
  { id: 4, label: 'Administrator', icon: User       },
  { id: 5, label: 'Business',      icon: Building2  },
  { id: 6, label: 'Finalize',      icon: Lock       },
];

const TOTAL_STEPS = STEPS.length;

// ─── Password Strength ────────────────────────────────────────────────────────

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' };
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { score, label: 'Weak',   color: 'bg-red-500'    };
  if (score <= 4) return { score, label: 'Fair',   color: 'bg-amber-500'  };
  if (score <= 5) return { score, label: 'Good',   color: 'bg-blue-500'   };
  return              { score, label: 'Strong', color: 'bg-emerald-500' };
}

// ─── Components ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
      {children}
    </label>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800
        focus:outline-none focus:border-blue-600 focus:bg-white transition ${props.className || ''}`}
    />
  );
}

function Alert({ type, children }: { type: 'error' | 'success' | 'info' | 'warning'; children: React.ReactNode }) {
  const styles = {
    error:   'bg-red-50   border-red-200   text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info:    'bg-blue-50  border-blue-200  text-blue-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700'
  };
  const icons = {
    error:   <AlertCircle size={15} className="shrink-0" />,
    success: <CheckCircle2 size={15} className="shrink-0" />,
    info:    <Server size={15} className="shrink-0" />,
    warning: <ShieldCheck size={15} className="shrink-0" />
  };
  return (
    <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs font-medium ${styles[type]}`}>
      {icons[type]}
      <span>{children}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const Installer: React.FC<InstallerProps> = ({ onInstallComplete, onInstalled }) => {
  const [step, setStep] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Step 1: system status
  const [status, setStatus] = React.useState<any>(null);

  // Step 2: database
  const [dbUrl, setDbUrl]         = React.useState('');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [dbHost, setDbHost]       = React.useState('localhost');
  const [dbPort, setDbPort]       = React.useState('5432');
  const [dbName, setDbName]       = React.useState('dpm_erp');
  const [dbUser, setDbUser]       = React.useState('postgres');
  const [dbPass, setDbPass]       = React.useState('');
  const [dbSsl, setDbSsl]         = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = React.useState('');
  const [maskedUrl, setMaskedUrl] = React.useState('');
  const [dbConfigured, setDbConfigured] = React.useState(false);

  // Step 3: migrations
  const [migrationsDone, setMigrationsDone] = React.useState(false);
  const [migrationsApplied, setMigrationsApplied] = React.useState<string[]>([]);
  const [migrationsStatus, setMigrationsStatus] = React.useState<'idle' | 'running' | 'done' | 'fail'>('idle');

  // Step 4: admin
  const [adminName, setAdminName]         = React.useState('');
  const [adminUsername, setAdminUsername] = React.useState('');
  const [adminEmail, setAdminEmail]       = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');
  const [adminConfirm, setAdminConfirm]   = React.useState('');
  const [showPass, setShowPass]           = React.useState(false);
  const [adminCreated, setAdminCreated]   = React.useState(false);

  // Step 5: business
  const [companyName, setCompanyName]     = React.useState('');
  const [baseCurrency, setBaseCurrency]   = React.useState('USD');
  const [supportPhone, setSupportPhone]   = React.useState('');

  // Derived helpers
  const passwordStrength = getPasswordStrength(adminPassword);
  const effectiveDbUrl = React.useMemo(() => {
    if (advancedOpen && dbHost) {
      const ssl = dbSsl ? '?sslmode=require' : '';
      const enc = encodeURIComponent(dbPass);
      return `postgresql://${dbUser}:${enc}@${dbHost}:${dbPort}/${dbName}${ssl}`;
    }
    return dbUrl.trim();
  }, [advancedOpen, dbHost, dbPort, dbName, dbUser, dbPass, dbSsl, dbUrl]);

  // Load status on mount
  React.useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const res = await api.getInstallStatus();
      setStatus(res);
      if (res.dbConfigured) {
        setDbConfigured(true);
        // If DB is pre-configured via env, skip DB entry step — mark it done
        setTestStatus('ok');
        setTestMessage('Database pre-configured via environment variable.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check installation status.');
    }
  }

  // ── Step navigation ──────────────────────────────────────────────────────

  function clearError() { setError(null); }

  async function handleNext() {
    clearError();
    if (step === 1) {
      goTo(2);
      return;
    }
    if (step === 2) {
      await handleConfigureDb();
      return;
    }
    if (step === 3) {
      await handleRunMigrations();
      return;
    }
    if (step === 4) {
      await handleCreateAdmin();
      return;
    }
    if (step === 5) {
      goTo(6);
      return;
    }
    if (step === 6) {
      await handleFinalize();
      return;
    }
  }

  function goTo(n: number) {
    setError(null);
    setStep(n);
  }

  // ── Step 2: test + configure DB ──────────────────────────────────────────

  async function handleTestConnection() {
    if (!effectiveDbUrl) {
      setError('Please enter a Database URL.');
      return;
    }
    clearError();
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await api.testConnection(effectiveDbUrl);
      setTestStatus('ok');
      setTestMessage(res.message || 'Connection successful.');
      if (res.maskedUrl) setMaskedUrl(res.maskedUrl);
    } catch (err: any) {
      setTestStatus('fail');
      setTestMessage(err.message || 'Connection failed. Check your database details.');
    }
  }

  async function handleConfigureDb() {
    if (dbConfigured && status?.dbConfigured) {
      // Pre-configured — skip to next step
      goTo(3);
      return;
    }
    if (testStatus !== 'ok') {
      setError('Please test the database connection successfully before continuing.');
      return;
    }
    setBusy(true);
    clearError();
    try {
      await api.configureDb(effectiveDbUrl);
      goTo(3);
    } catch (err: any) {
      setError(err.message || 'Failed to save database configuration.');
    } finally {
      setBusy(false);
    }
  }

  // ── Step 3: run migrations ───────────────────────────────────────────────

  async function handleRunMigrations() {
    if (migrationsDone) { goTo(4); return; }
    setBusy(true);
    clearError();
    setMigrationsStatus('running');
    try {
      const res = await api.runMigrations();
      setMigrationsApplied(res.applied || []);
      setMigrationsDone(true);
      setMigrationsStatus('done');
      setTimeout(() => goTo(4), 800);
    } catch (err: any) {
      setMigrationsStatus('fail');
      setError(err.message || 'Migration failed. Check server logs for details.');
    } finally {
      setBusy(false);
    }
  }

  // ── Step 4: create admin ─────────────────────────────────────────────────

  async function handleCreateAdmin() {
    clearError();
    if (!adminUsername.trim() || !adminEmail.trim() || !adminPassword) {
      setError('Username, email, and password are required.');
      return;
    }
    if (adminPassword !== adminConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(adminPassword) || !/[a-z]/.test(adminPassword) || !/[0-9]/.test(adminPassword)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }
    setBusy(true);
    try {
      await api.createAdmin({
        adminUsername: adminUsername.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
        adminName: adminName.trim() || adminUsername.trim(),
        companyName: companyName.trim(),
        baseCurrency,
        supportPhone: supportPhone.trim()
      });
      setAdminCreated(true);
      goTo(5);
    } catch (err: any) {
      setError(err.message || 'Failed to create administrator account.');
    } finally {
      setBusy(false);
    }
  }

  // ── Step 6: finalize ─────────────────────────────────────────────────────

  async function handleFinalize() {
    setBusy(true);
    clearError();
    try {
      const res = await api.finalizeInstall();
      api.setToken(res.token);
      if (onInstallComplete && res.user) {
        onInstallComplete(res.user, res.token);
      }
      if (onInstalled) {
        onInstalled();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to finalize installation. Please check server logs.');
    } finally {
      setBusy(false);
    }
  }

  // ── Canvases ─────────────────────────────────────────────────────────────

  function canGoBack() {
    return step > 1;
  }

  function canGoNext(): boolean {
    if (step === 2 && !dbConfigured && !status?.dbConfigured && testStatus !== 'ok') return false;
    if (step === 3 && migrationsStatus === 'running') return false;
    if (step === 4 && (!adminUsername || !adminEmail || !adminPassword || !adminConfirm)) return false;
    return true;
  }

  function nextLabel(): string {
    if (busy) return 'Please wait...';
    if (step === 2 && (dbConfigured || status?.dbConfigured)) return 'Continue';
    if (step === 2) return testStatus === 'ok' ? 'Continue →' : 'Continue →';
    if (step === 3 && !migrationsDone) return migrationsStatus === 'running' ? 'Running...' : 'Run Database Setup';
    if (step === 3) return 'Continue';
    if (step === 5) return 'Review & Finalize';
    if (step === 6) return 'Complete Installation';
    return 'Continue';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#151828] to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-slate-900 px-8 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-600/40">
              ⚡
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">DPM Installation</h1>
              <p className="text-[11px] text-slate-400">Digital Product Management System</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-800 text-[11px] text-blue-400 font-semibold border border-slate-700">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        {/* Step progress tabs */}
        <div className="flex border-b border-slate-100">
          {STEPS.map((s) => {
            const done = step > s.id;
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className={`flex-1 flex flex-col items-center py-2.5 gap-1 text-[10px] font-semibold border-b-2 transition-colors
                  ${active  ? 'border-blue-600 text-blue-700'   : ''}
                  ${done    ? 'border-emerald-500 text-emerald-600' : ''}
                  ${!active && !done ? 'border-transparent text-slate-400' : ''}`}
              >
                {done
                  ? <CheckCircle2 size={14} />
                  : <Icon size={14} />}
                <span className="hidden sm:block">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-8 mt-5">
            <Alert type="error">{error}</Alert>
          </div>
        )}

        {/* Step content */}
        <div className="p-8 space-y-6">

          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 mx-auto flex items-center justify-center text-3xl">
                  ⚡
                </div>
                <h2 className="text-xl font-bold text-slate-900">Welcome to DPM</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Let's set up your Digital Product Management System.
                  This wizard takes about 2 minutes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Database, label: 'Connect Database',    desc: 'Link your PostgreSQL database' },
                  { icon: Settings, label: 'Create Schema',       desc: 'Apply database migrations'     },
                  { icon: User,     label: 'Create Admin',        desc: 'Set up your administrator account' },
                  { icon: Lock,     label: 'Secure Installation', desc: 'Generate secrets, lock installer' }
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{label}</p>
                      <p className="text-[11px] text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Alert type="info">
                Your data never leaves your server. DPM connects directly to your PostgreSQL database.
              </Alert>
            </div>
          )}

          {/* ── Step 2: Database ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database size={16} className="text-blue-600" /> Connect Your Database
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  DPM works with any standard PostgreSQL server (local, Railway, Render, Neon, AWS RDS, etc.)
                </p>
              </div>

              {(dbConfigured || status?.dbConfigured) ? (
                <Alert type="success">
                  Database pre-configured via environment variable. No manual entry required.
                </Alert>
              ) : (
                <>
                  {/* URL input */}
                  <div className="space-y-1.5">
                    <FieldLabel>Database URL</FieldLabel>
                    <FieldInput
                      type={testStatus === 'ok' ? 'password' : 'text'}
                      value={dbUrl}
                      onChange={(e) => { setDbUrl(e.target.value); setTestStatus('idle'); }}
                      placeholder="postgresql://user:password@localhost:5432/dpm_erp"
                      disabled={advancedOpen}
                    />
                    <p className="text-[11px] text-slate-400">
                      Format: <code className="bg-slate-100 px-1 rounded">postgresql://user:password@host:port/database</code>
                    </p>
                  </div>

                  {/* Advanced toggle */}
                  <button
                    type="button"
                    onClick={() => { setAdvancedOpen(!advancedOpen); setTestStatus('idle'); }}
                    className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold hover:text-blue-500 transition"
                  >
                    {advancedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>{advancedOpen ? 'Hide' : 'Show'} Advanced Options</span>
                  </button>

                  {advancedOpen && (
                    <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      {[
                        { label: 'Host',     value: dbHost,  set: setDbHost,  placeholder: 'localhost', span: false },
                        { label: 'Port',     value: dbPort,  set: setDbPort,  placeholder: '5432',      span: false },
                        { label: 'Database', value: dbName,  set: setDbName,  placeholder: 'dpm_erp',  span: true  },
                        { label: 'Username', value: dbUser,  set: setDbUser,  placeholder: 'postgres',  span: false },
                        { label: 'Password', value: dbPass,  set: setDbPass,  placeholder: '••••••••', span: false, type: 'password' }
                      ].map(({ label, value, set, placeholder, span, type }) => (
                        <div key={label} className={`space-y-1 ${span ? 'col-span-2' : ''}`}>
                          <FieldLabel>{label}</FieldLabel>
                          <FieldInput
                            type={type || 'text'}
                            value={value}
                            onChange={(e) => { set(e.target.value); setTestStatus('idle'); }}
                            placeholder={placeholder}
                          />
                        </div>
                      ))}
                      <div className="col-span-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="ssl-toggle"
                          checked={dbSsl}
                          onChange={(e) => { setDbSsl(e.target.checked); setTestStatus('idle'); }}
                          className="rounded"
                        />
                        <label htmlFor="ssl-toggle" className="text-xs text-slate-700">
                          Enable SSL / TLS
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Test button */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testStatus === 'testing' || !effectiveDbUrl}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50 transition"
                    >
                      {testStatus === 'testing'
                        ? <><Loader2 size={13} className="animate-spin" /> Testing...</>
                        : <><RefreshCw size={13} /> Test Connection</>}
                    </button>
                    {testStatus === 'ok' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 size={13} /> Connected
                      </span>
                    )}
                    {testStatus === 'fail' && (
                      <span className="text-xs text-red-600 font-semibold">✕ Failed</span>
                    )}
                  </div>

                  {testMessage && (
                    <Alert type={testStatus === 'ok' ? 'success' : 'error'}>
                      {testMessage}
                    </Alert>
                  )}
                </>
              )}

              <Alert type="warning">
                Your database password is sent securely to the server and is never stored in the browser.
              </Alert>
            </div>
          )}

          {/* ── Step 3: Migrations ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Settings size={16} className="text-blue-600" /> Database Setup
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  DPM will create all required tables and indexes in your PostgreSQL database.
                  This is safe to run on an empty database.
                </p>
              </div>

              {migrationsStatus === 'idle' && (
                <Alert type="info">
                  Click "Run Database Setup" to apply the DPM schema to your database.
                  No existing data will be modified.
                </Alert>
              )}

              {migrationsStatus === 'running' && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <Loader2 size={18} className="text-blue-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-800">Applying database schema...</p>
                    <p className="text-[11px] text-blue-600">This usually takes a few seconds.</p>
                  </div>
                </div>
              )}

              {(migrationsStatus === 'done' || migrationsDone) && (
                <div className="space-y-2">
                  <Alert type="success">
                    Database schema applied successfully. DPM is ready.
                  </Alert>
                  {migrationsApplied.length > 0 && (
                    <div className="space-y-1.5">
                      {migrationsApplied.map((m) => (
                        <div key={m} className="flex items-center gap-2 text-[11px] text-slate-600">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {migrationsApplied.length === 0 && (
                    <p className="text-[11px] text-slate-500">Schema was already up to date.</p>
                  )}
                </div>
              )}

              {migrationsStatus === 'fail' && (
                <Alert type="error">
                  Migration failed. No data was modified. Check server logs for details.
                </Alert>
              )}
            </div>
          )}

          {/* ── Step 4: Admin ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <User size={16} className="text-blue-600" /> Create Administrator
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  This account will have full ownership of DPM. Choose a strong, unique password.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Full Name</FieldLabel>
                  <FieldInput
                    type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Username <span className="text-red-500">*</span></FieldLabel>
                  <FieldInput
                    type="text" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin" required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel>Email Address <span className="text-red-500">*</span></FieldLabel>
                  <FieldInput
                    type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@yourdomain.com" required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Password <span className="text-red-500">*</span></FieldLabel>
                  <div className="relative">
                    <FieldInput
                      type={showPass ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Min. 8 characters" required />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {adminPassword && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4,5,6].map((n) => (
                          <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= passwordStrength.score ? passwordStrength.color : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <p className={`text-[11px] font-semibold ${passwordStrength.score <= 2 ? 'text-red-500' : passwordStrength.score <= 4 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {passwordStrength.label}
                        {passwordStrength.score < 4 && ' — add uppercase, numbers, or symbols'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Confirm Password <span className="text-red-500">*</span></FieldLabel>
                  <FieldInput
                    type="password" value={adminConfirm} onChange={(e) => setAdminConfirm(e.target.value)}
                    placeholder="Repeat password" required />
                  {adminConfirm && adminPassword !== adminConfirm && (
                    <p className="text-[11px] text-red-500 font-semibold">Passwords do not match.</p>
                  )}
                </div>
              </div>

              <Alert type="warning">
                <ShieldCheck size={13} className="inline mr-1" />
                Passwords are hashed with PBKDF2-SHA512 (100,000 iterations). They are never stored in plain text.
              </Alert>
            </div>
          )}

          {/* ── Step 5: Business ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" /> Business Settings
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Optional — you can change these any time in Settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel>Company / Store Name</FieldLabel>
                  <FieldInput
                    type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="My Digital Store" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Base Currency</FieldLabel>
                  <select
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                  >
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                    <option value="GBP">GBP (£) — British Pound</option>
                    <option value="CAD">CAD — Canadian Dollar</option>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="SAR">SAR — Saudi Riyal</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Support WhatsApp Number</FieldLabel>
                  <FieldInput
                    type="text" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+1 555 000 0000" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 6: Finalize ── */}
          {step === 6 && (
            <div className="space-y-5 text-center">
              <div>
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 mx-auto flex items-center justify-center">
                  <Lock size={28} className="text-emerald-600" />
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-3">Ready to Complete Installation</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  DPM will generate secure application secrets, lock the installer,
                  and log you in automatically.
                </p>
              </div>

              {/* Summary */}
              <div className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                <SummaryRow label="Administrator" value={`${adminUsername} (${adminEmail})`} />
                {companyName && <SummaryRow label="Company" value={companyName} />}
                <SummaryRow label="Currency" value={baseCurrency} />
                <SummaryRow label="Database" value={maskedUrl || (status?.dbConfigured ? 'Pre-configured ✓' : 'Configured ✓')} />
                <SummaryRow label="Schema" value={`${migrationsApplied.length || 'All'} migration(s) applied ✓`} />
              </div>

              <div className="flex flex-col gap-2">
                {[
                  'Installer locked after completion',
                  'JWT & encryption secrets generated securely',
                  'All passwords hashed with PBKDF2-SHA512'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[11px] text-slate-500">
                    <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-8 pb-6 flex items-center justify-between">
          {canGoBack() ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={busy || migrationsStatus === 'running'}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600
                hover:bg-slate-50 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <ArrowLeft size={13} /> Back
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={handleNext}
            disabled={busy || !canGoNext() || migrationsStatus === 'running'}
            className={`px-6 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-1.5
              shadow-md transition disabled:opacity-50
              ${step === 6
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'}`}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            <span>{nextLabel()}</span>
            {!busy && step < 6 && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-slate-400 shrink-0">{label}:</span>
      <span className="font-semibold text-slate-700 text-right truncate max-w-xs">{value}</span>
    </div>
  );
}
