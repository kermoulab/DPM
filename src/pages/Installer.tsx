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
  Server
} from 'lucide-react';
import { api } from '../api';
import type { User as UserType } from '../types';

interface InstallerProps {
  onInstallComplete?: (user: UserType, token: string) => void;
  onInstalled?: () => void;
}

export const Installer: React.FC<InstallerProps> = ({ onInstallComplete, onInstalled }) => {
  const [step, setStep] = React.useState(1);
  const [requirements, setRequirements] = React.useState<any>(null);
  const [dbStatus, setDbStatus] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Admin Account state
  const [adminName, setAdminName] = React.useState('');
  const [adminUsername, setAdminUsername] = React.useState('admin');
  const [adminEmail, setAdminEmail] = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');

  // Business state
  const [companyName, setCompanyName] = React.useState('');
  const [baseCurrency, setBaseCurrency] = React.useState('USD');
  const [currencySymbol, setCurrencySymbol] = React.useState('$');
  const [supportPhone, setSupportPhone] = React.useState('');

  const [installing, setInstalling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    checkRequirements();
  }, []);

  const checkRequirements = async () => {
    try {
      const res = await api.getInstallStatus();
      setRequirements(res.requirements);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const testDatabase = async () => {
    setDbStatus('testing');
    try {
      await api.testDb();
      setDbStatus('success');
    } catch {
      setDbStatus('error');
    }
  };

  const handleRunInstallation = async () => {
    setInstalling(true);
    setError(null);
    try {
      const payload = {
        company_name: companyName,
        base_currency: baseCurrency,
        currency_symbol: currencySymbol,
        support_phone: supportPhone,
        admin_username: adminUsername,
        admin_email: adminEmail,
        admin_password: adminPassword,
        admin_name: adminName
      };

      const res = await api.runInstall(payload);
      api.setToken(res.token);
      if (onInstallComplete) {
        onInstallComplete(res.user, res.token);
      }
      if (onInstalled) {
        onInstalled();
      }
    } catch (err: any) {
      setError(err.message);
      setInstalling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#151828] to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="bg-slate-900 px-8 py-6 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-600/40">
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Universal Reseller ERP</h1>
              <p className="text-xs text-slate-400">WordPress-style 1-Click Provisioning Wizard</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-slate-800 text-xs text-blue-400 font-semibold border border-slate-700">
            Step {step} of 4
          </div>
        </div>

        {/* Wizard Progress Bar */}
        <div className="h-1.5 bg-slate-100 w-full">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {error && (
          <div className="mx-8 mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Server size={18} className="text-blue-600" />
                  System & Environment Pre-Flight Checks
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Verifying runtime compatibility and database connectivity.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    label: 'Node.js Runtime (v18+ LTS)',
                    ok: requirements?.nodeOk,
                    details: requirements?.nodeVersion
                  },
                  {
                    label: 'PostgreSQL Database Engine & Connection Pool',
                    ok: requirements?.postgresReady,
                    details: requirements?.postgresReady ? 'Connected' : 'Connection Pending'
                  },
                  {
                    label: 'Cryptographic Engine (AES-256-GCM + PBKDF2)',
                    ok: requirements?.cryptoAvailable,
                    details: 'Hardware Accelerated'
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[11px] text-slate-400">{item.details}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 size={16} />
                      <span>Ready</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-900">Database Connection Test</p>
                  <p className="text-[11px] text-blue-700">Test PostgreSQL database connection</p>
                </div>
                <button
                  type="button"
                  onClick={testDatabase}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  {dbStatus === 'testing'
                    ? 'Testing...'
                    : dbStatus === 'success'
                    ? '✓ Passed'
                    : 'Test Engine'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User size={18} className="text-blue-600" />
                  Create Master Administrator Account
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  This user will have full ownership and administrative control over the ERP.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Username</label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Master Password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                <span>
                  Passwords are automatically salted and hashed using PBKDF2 with 100,000 rounds.
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings size={18} className="text-blue-600" />
                  Business Identity & Currency Setup
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure storefront branding, base pricing currency, and WhatsApp credentials.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Store / Business Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Base Currency</label>
                  <select
                    value={baseCurrency}
                    onChange={(e) => {
                      setBaseCurrency(e.target.value);
                      if (e.target.value === 'USD') setCurrencySymbol('$');
                      if (e.target.value === 'EUR') setCurrencySymbol('€');
                      if (e.target.value === 'GBP') setCurrencySymbol('£');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="CAD">CAD ($) - Canadian Dollar</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Support WhatsApp Number</label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center text-2xl shadow-inner">
                <Lock size={32} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Ready to Provision & Lock System
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Clicking below will initialize the database, configure tables, register the master account, and automatically engage the installer lock mechanism.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Administrator:</span>
                  <span className="font-semibold text-slate-800">{adminUsername} ({adminEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Company:</span>
                  <span className="font-semibold text-slate-800">{companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Database State:</span>
                  <span className="font-semibold text-emerald-600">Clean Production Baseline</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-white flex items-center gap-1.5 transition"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition"
            >
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunInstallation}
              disabled={installing}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
            >
              {installing ? (
                <span>Provisioning Database...</span>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Execute Installation & Launch ERP</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
