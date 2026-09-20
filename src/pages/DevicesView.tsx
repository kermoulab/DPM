import React from 'react';
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  Trash2,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import type { PairedDevice } from '../types';

export const DevicesView: React.FC = () => {
  const [devices, setDevices] = React.useState<PairedDevice[]>([]);
  const [pairingData, setPairingData] = React.useState<{
    deviceId: string;
    pairingCode: string;
    expiresAt: string;
    qrDataUrl: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmDevice, setConfirmDevice] = React.useState<PairedDevice | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadDevices(true);
  }, []);

  // Keyboard shortcut to dismiss pairing dialog or confirmation modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDevice) setConfirmDevice(null);
        else if (pairingData) setPairingData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pairingData, confirmDevice]);

  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Real-time detection when Android device completes pairing scan while modal is open
  React.useEffect(() => {
    if (!pairingData) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.getDevices();
        setDevices(res.devices);
        const current = res.devices.find((d) => d.id === pairingData.deviceId);
        if (current && current.status === 'paired') {
          setPairingData(null);
          setToastMessage(`Device "${current.device_name}" connected successfully!`);
          window.dispatchEvent(new CustomEvent('app:data-mutated'));
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pairingData]);

  const loadDevices = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const res = await api.getDevices();
      setDevices(res.devices);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await api.generatePairingCode();
      setPairingData(res);
      loadDevices(false);
    } catch (err: any) {
      alert(err.message || 'Failed to generate pairing token');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteDevice = async (device: PairedDevice) => {
    const isPending = device.status === 'pending';

    if (isPending) {
      // Pending scan: immediately delete from UI and DB without confirm prompt
      setDeletingId(device.id);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      try {
        await api.revokeDevice(device.id);
        setToastMessage('Pending pairing request deleted.');
        window.dispatchEvent(new CustomEvent('app:data-mutated'));
      } catch (err: any) {
        setToastMessage(err.message || 'Failed to delete pending pairing.');
        await loadDevices(false);
      } finally {
        setDeletingId(null);
      }
    } else {
      // Connected / scanned / success / paired: show confirm/cancel dialog
      setConfirmDevice(device);
    }
  };

  const handleConfirmUnpair = async () => {
    if (!confirmDevice) return;
    const target = confirmDevice;
    setDeletingId(target.id);
    // Optimistically remove from UI
    setDevices((prev) => prev.filter((d) => d.id !== target.id));
    setConfirmDevice(null);

    try {
      const res = await api.revokeDevice(target.id);
      setToastMessage(res.message || `Device "${target.device_name}" deleted and unpaired on Android side.`);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to unpair device');
      await loadDevices(false);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* QR Code & Pairing Screen if active (With explicit close and cancel buttons) */}
      {pairingData && (
        <div
          id="pairing-modal-overlay"
          onClick={() => setPairingData(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            id="pairing-modal-card"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl shadow-2xl border border-blue-500/30 overflow-hidden relative"
          >
            {/* Top Close Button */}
            <button
              id="close-pairing-modal-btn"
              onClick={() => setPairingData(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition z-10"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>

            <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 max-w-md">
                <span className="px-3 py-1 rounded-full bg-blue-500/25 text-blue-200 text-[11px] font-semibold uppercase tracking-wider border border-blue-400/30">
                  One-Time Handshake Token
                </span>
                <h3 className="text-2xl font-bold tracking-tight">
                  Scan with Reseller Terminal App
                </h3>
                <p className="text-xs text-blue-200 leading-relaxed">
                  Open the Reseller ERP Android App, tap "Pair Device", and scan this QR code or enter the numerical code below.
                </p>

                <div className="pt-2">
                  <span className="text-xs text-blue-300 block mb-1">6-Digit Numerical Code:</span>
                  <div className="font-mono text-3xl font-bold tracking-widest bg-white/10 px-4 py-2 rounded-2xl inline-block border border-white/20">
                    {pairingData.pairingCode}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl shadow-2xl shrink-0 flex flex-col items-center">
                <img
                  src={pairingData.qrDataUrl}
                  alt="Pairing QR Code"
                  className="w-56 h-56 object-contain rounded-xl"
                />
                <p className="text-[10px] text-slate-400 font-mono mt-2">
                  Expires: {new Date(pairingData.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authorized Devices Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Smartphone size={16} className="text-blue-600" />
            Authorized Devices ({devices.length})
          </h3>
          <div className="flex items-center gap-2.5">
            <button
              id="pair-new-device-btn"
              onClick={handleGenerateCode}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <QrCode size={15} />
              <span>{generating ? 'Generating...' : 'Pair New Android Device'}</span>
            </button>
            <button
              onClick={() => loadDevices(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading authorized devices...</div>
        ) : devices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <p>No devices currently linked.</p>
            <button
              onClick={handleGenerateCode}
              disabled={generating}
              className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <QrCode size={14} />
              <span>Pair New Android Device</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5 font-semibold">Device Model</th>
                  <th className="py-3 px-4 font-semibold">Paired By Staff</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Last Heartbeat</th>
                  <th className="py-3 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5 font-semibold text-slate-800">
                      {d.status === 'paired' ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <Smartphone size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block text-xs truncate">
                              {d.device_name}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                              Connected Device
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                            <QrCode size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-700 block text-xs">
                              Awaiting Device Handshake
                            </span>
                            <span className="text-[10px] text-amber-600 font-medium">
                              Token: {d.pairing_code || 'Pending'}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{d.paired_by_user || 'Admin'}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] border inline-flex items-center gap-1 ${
                          d.status === 'paired'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                            : 'bg-amber-50 text-amber-700 border-amber-200/60'
                        }`}
                      >
                        {d.status === 'paired' ? (
                          <>
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            <span>Connected</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block"></span>
                            <span>Pending Scan</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{d.last_seen || (d.status === 'paired' ? 'Active Now' : 'Not yet connected')}</td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        id={`delete-device-${d.id}`}
                        onClick={() => handleDeleteDevice(d)}
                        disabled={deletingId === d.id}
                        className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition inline-flex items-center gap-1.5 font-semibold text-[11px] disabled:opacity-50 cursor-pointer"
                        title={d.status === 'paired' ? `Unpair & Delete ${d.device_name}` : 'Delete pending pairing token'}
                      >
                        <Trash2 size={13} />
                        <span>{deletingId === d.id ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Unpair / Delete Modal for Connected Devices */}
      {confirmDevice && (
        <div
          id="unpair-confirm-modal-overlay"
          onClick={() => setConfirmDevice(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            id="unpair-confirm-modal-card"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 space-y-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Unpair & Delete Device?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to delete and unpair <strong className="text-slate-800 font-semibold">{confirmDevice.device_name}</strong>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                id="cancel-unpair-btn"
                onClick={() => setConfirmDevice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-unpair-btn"
                onClick={handleConfirmUnpair}
                disabled={deletingId === confirmDevice.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {deletingId === confirmDevice.id ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                <span>{deletingId === confirmDevice.id ? 'Unpairing...' : 'Confirm Unpair & Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-3 duration-150 border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-2 transition"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
