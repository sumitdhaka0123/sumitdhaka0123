import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, Database, Download, Upload, RotateCcw, Clock, 
  CheckCircle2, AlertTriangle, Sparkles, RefreshCw, 
  Trash2, HardDrive, ShieldAlert, FileText, Cloud, CloudOff, ExternalLink, Settings
} from 'lucide-react';
import { User as SessionUser } from '../types';

export interface BackupItem {
  filename: string;
  createdTimestamp: string;
  sizeBytes: number;
  isAuto: boolean;
  label: string;
  ageDays: number;
  expiresDays: number;
  counts: {
    scooterUnits: number;
    salesOrders: number;
    buyers: number;
    products: number;
    warrantyClaims: number;
    batterySales: number;
    chargerSales: number;
    stockLogs: number;
  };
}


export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  webViewLink: string;
}

export interface DriveConfig {
  clientId: string;
  connectedEmail: string;
  autoSync: boolean;
}

interface BackupRecoveryPanelProps {
  currentUser: SessionUser;
  onRefreshData?: () => void;
}

export default function BackupRecoveryPanel({ currentUser, onRefreshData }: BackupRecoveryPanelProps) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);

  // Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Custom manual snapshot label
  const [customLabel, setCustomLabel] = useState('');
  const [creating, setCreating] = useState(false);

  // Restore Modal State
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  // File Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const triggerAlert = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMsg(message);
      setErrorMsg('');
    } else {
      setErrorMsg(message);
      setSuccessMsg('');
    }
    setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 6000);
  };


  // Drive State
  const [driveConfig, setDriveConfig] = useState<DriveConfig | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [showDriveSettings, setShowDriveSettings] = useState(false);
  const [tempClientId, setTempClientId] = useState('');
  const [tempClientSecret, setTempClientSecret] = useState('');
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [restoringDrive, setRestoringDrive] = useState(false);

  const fetchDriveConfig = async () => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/drive-config');
      if (res.ok) {
        const data = await res.json();
        setDriveConfig(data);
      }
    } catch (e) {}
  };

  const fetchDriveFiles = async () => {
    setLoadingDrive(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/backups/drive/list');
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      }
    } catch (e) {} finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    fetchDriveConfig();
    fetchDriveFiles();
  }, []);

  const handleSaveDriveSettings = async () => {
    try {
      await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/drive-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: tempClientId, clientSecret: tempClientSecret })
      });
      setShowDriveSettings(false);
      fetchDriveConfig();
      triggerAlert('success', 'Google OAuth credentials saved.');
    } catch (e) {
      triggerAlert('error', 'Failed to save credentials.');
    }
  };

  const handleConnectDrive = async () => {
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/drive/auth-url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        triggerAlert('error', data.error || 'Failed to get auth URL. Have you configured Client ID/Secret?');
        setShowDriveSettings(true);
      }
    } catch (e) {}
  };

  const handleDisconnectDrive = async () => {
    try {
      await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/drive/disconnect', { method: 'POST' });
      fetchDriveConfig();
      setDriveFiles([]);
      triggerAlert('success', 'Disconnected from Google Drive.');
    } catch (e) {}
  };

  const handleToggleAutoSync = async () => {
    if (!driveConfig) return;
    try {
      await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/drive-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSync: !driveConfig.autoSync })
      });
      fetchDriveConfig();
    } catch (e) {}
  };

  const handleSyncToDriveNow = async () => {
    setSyncingDrive(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/backups/drive/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', data.message);
        fetchDriveFiles();
        fetchLocalBackups();
      } else {
        triggerAlert('error', data.error || 'Failed to sync to Drive.');
      }
    } catch (e) {
      triggerAlert('error', 'Error connecting to server.');
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string) => {
    if (!confirm('Are you sure you want to download and restore this database from Google Drive? A safety snapshot will be taken first.')) return;
    setRestoringDrive(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/backups/drive/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', data.message);
        fetchLocalBackups();
        if (onRefreshData) onRefreshData();
      } else {
        triggerAlert('error', data.error || 'Failed to restore from Drive.');
      }
    } catch (e) {
      triggerAlert('error', 'Error restoring from Drive.');
    } finally {
      setRestoringDrive(false);
    }
  };

  // Fetch local 14-day backups
  const fetchLocalBackups = async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      } else {
        setErrorMsg('Failed to load local backup snapshots.');
      }
    } catch (err) {
      setErrorMsg('Error connecting to local backup server.');
    } finally {
      setLoadingLocal(false);
    }
  };

  useEffect(() => {
    fetchLocalBackups();
  }, []);

  // Create manual local backup snapshot
  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: currentUser.name,
          label: customLabel.trim() || 'Manual User Snapshot'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `✨ Backup snapshot created: ${data.filename}`);
        setCustomLabel('');
        fetchLocalBackups();
      } else {
        triggerAlert('error', data.error || 'Failed to create snapshot.');
      }
    } catch (err) {
      triggerAlert('error', 'Error creating backup snapshot.');
    } finally {
      setCreating(false);
    }
  };

  // Restore from local snapshot
  const handleConfirmRestore = async () => {
    if (!selectedBackupForRestore) return;
    setRestoring(true);
    try {
      const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedBackupForRestore.filename,
          operator: currentUser.name
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerAlert('success', `🎉 ${data.message}`);
        setSelectedBackupForRestore(null);
        fetchLocalBackups();
        if (onRefreshData) onRefreshData();
      } else {
        triggerAlert('error', data.error || 'Failed to restore snapshot.');
      }
    } catch (err) {
      triggerAlert('error', 'Error restoring data from local snapshot.');
    } finally {
      setRestoring(false);
    }
  };

  // Download snapshot file to local phone/computer
  const handleDownload = (filename: string) => {
    const url = ((import.meta as any).env.VITE_API_BASE_URL || '') + `/api/backups/download/${encodeURIComponent(filename)}`;
    window.open(url, '_blank');
  };

  // Upload offline JSON file to restore
  const handleUploadAndRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonContent = JSON.parse(event.target?.result as string);
          const res = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/backups/upload-restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              backupData: jsonContent,
              operator: currentUser.name
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            triggerAlert('success', `✅ Offline JSON backup imported! ${data.message}`);
            setUploadFile(null);
            fetchLocalBackups();
            if (onRefreshData) onRefreshData();
          } else {
            triggerAlert('error', data.error || 'Invalid backup file format.');
          }
        } catch (parseErr) {
          triggerAlert('error', 'The uploaded file is not a valid JSON database file.');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsText(uploadFile);
    } catch (err) {
      triggerAlert('error', 'Error reading uploaded file.');
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 font-sans max-w-7xl mx-auto px-1 sm:px-0" id="backup-recovery-panel">
      
      {/* PHONE-OPTIMIZED HEADER BANNER */}
      <div className="p-4 sm:p-6 bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/30 inline-flex items-center gap-1 font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                14-DAY AUTOMATED RETENTION & DISASTER RECOVERY
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Database Backup & Disaster Recovery</h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Database state is safely snapshot and retained locally for <strong>14 days</strong> with automatic rolling purging. Download JSON backup files to your device or restore from any point in time.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
            <button
              onClick={fetchLocalBackups}
              className="w-full sm:w-auto min-h-[44px] px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <RefreshCw className={`h-4 w-4 text-cyan-400 ${loadingLocal ? 'animate-spin' : ''}`} />
              <span>Refresh List</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW (Responsive 1-col on mobile, 3-col on desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl sm:rounded-2xl flex items-center gap-3">
            <Clock className="h-5 w-5 text-cyan-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Retention Window</span>
              <span className="font-extrabold text-white text-xs sm:text-sm truncate">Last 14 Days Rolling</span>
            </div>
          </div>

          <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl sm:rounded-2xl flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Saved Local Snapshots</span>
              <span className="font-extrabold text-emerald-300 text-xs sm:text-sm truncate">
                {backups.length} Available Point(s)
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl sm:rounded-2xl flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Auto-Purge Policy</span>
              <span className="font-extrabold text-amber-300 text-xs sm:text-sm truncate">Deletes Snapshots &gt;14 Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* ALERT NOTIFICATIONS */}
      {successMsg && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="leading-snug">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span className="leading-snug">{errorMsg}</span>
        </div>
      )}

      {/* TWO MAIN ACTION CARDS (Instant Snapshot & Import Offline File) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* ACTION 1: CREATE INSTANT SNAPSHOT NOW */}
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-3">
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-600" />
              <span>1. Create Local Manual Snapshot</span>
            </h3>
            <p className="text-xs text-slate-500">
              Save an instant local database snapshot before performing batch edits, stock imports, or major system updates.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Snapshot label (e.g. Before Batch Edit)..."
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="flex-1 min-h-[44px] bg-slate-50 border border-slate-200 focus:border-cyan-500 text-slate-900 placeholder-slate-400 px-3.5 py-2 rounded-xl text-xs font-medium outline-none"
            />
            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="min-h-[44px] px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 active:scale-[0.98] text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{creating ? 'Saving...' : 'Create Snapshot'}</span>
            </button>
          </div>
        </div>

        {/* ACTION 2: IMPORT & RESTORE OFFLINE JSON FILE */}
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-3">
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Upload className="h-4 w-4 text-indigo-600" />
              <span>2. Import Offline JSON Backup File</span>
            </h3>
            <p className="text-xs text-slate-500">
              Select a downloaded JSON database backup file from your phone or PC to recover system data.
            </p>
          </div>

          <form onSubmit={handleUploadAndRestore} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <input
              type="file"
              accept=".json"
              onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
              className="flex-1 min-h-[44px] text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            <button
              type="submit"
              disabled={!uploadFile || uploading}
              className="min-h-[44px] px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 active:scale-[0.98] text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{uploading ? 'Importing...' : 'Import & Recover'}</span>
            </button>
          </form>
        </div>
      </div>

      
      {/* GOOGLE DRIVE CLOUD BACKUP SYSTEM */}
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 font-sans">Google Drive Cloud Backup</h3>
              <p className="text-[11px] text-slate-500 font-bold">Secure off-site disaster recovery</p>
            </div>
          </div>
          <button
            onClick={() => setShowDriveSettings(!showDriveSettings)}
            className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>OAuth Credentials</span>
          </button>
        </div>

        <AnimatePresence>
          {showDriveSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 mb-4">
                <p className="text-[11px] text-slate-600 font-bold">
                  Provide your Google OAuth 2.0 Client ID and Secret if you are configuring a custom app.
                  Required scopes: <code className="bg-slate-200 px-1 rounded">https://www.googleapis.com/auth/drive.file</code>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Client ID (e.g. 123-abc.apps.googleusercontent.com)"
                    value={tempClientId}
                    onChange={(e) => setTempClientId(e.target.value)}
                    className="min-h-[44px] w-full bg-white border border-slate-300 rounded-xl px-3 text-xs font-mono"
                  />
                  <input
                    type="password"
                    placeholder="Client Secret (e.g. GOCSPX-...)"
                    value={tempClientSecret}
                    onChange={(e) => setTempClientSecret(e.target.value)}
                    className="min-h-[44px] w-full bg-white border border-slate-300 rounded-xl px-3 text-xs font-mono"
                  />
                </div>
                <button
                  onClick={handleSaveDriveSettings}
                  className="min-h-[44px] w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Save Credentials
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CONNECTION STATUS */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 p-4 rounded-2xl border bg-slate-50 border-slate-200 flex flex-col justify-center space-y-3">
            {driveConfig?.connectedEmail ? (
              <>
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-xs font-bold">Connected to Drive</span>
                </div>
                <p className="text-sm font-black text-slate-800">{driveConfig.connectedEmail}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleConnectDrive}
                    className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    Switch Account
                  </button>
                  <button
                    onClick={handleDisconnectDrive}
                    className="min-h-[44px] px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-xl transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-slate-500">
                  <CloudOff className="h-5 w-5" />
                  <span className="text-xs font-bold">Google Drive Not Connected</span>
                </div>
                <p className="text-[11px] text-slate-600 max-w-sm">
                  Connect any Google account to enable secure, automated off-site database backups to a dedicated folder.
                </p>
                <div className="pt-1">
                  <button
                    onClick={handleConnectDrive}
                    className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
                  >
                    <Cloud className="h-4 w-4" />
                    <span>Connect Google Drive</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* BACKUP CONTROLS */}
          {driveConfig?.connectedEmail && (
            <div className="flex-1 p-4 rounded-2xl border border-slate-200 bg-white space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Backup Controls</h4>
                <p className="text-[11px] text-slate-500">Manage synchronization to "Inventory_Database_Backups" folder</p>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Automatic Background Sync</span>
                <button
                  onClick={handleToggleAutoSync}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${driveConfig.autoSync ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${driveConfig.autoSync ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <button
                onClick={handleSyncToDriveNow}
                disabled={syncingDrive}
                className="min-h-[44px] w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${syncingDrive ? 'animate-spin' : ''}`} />
                <span>{syncingDrive ? 'Syncing to Drive...' : 'Sync Live Database to Drive Now'}</span>
              </button>
            </div>
          )}
        </div>

        {/* DRIVE BACKUP LIST */}
        {driveConfig?.connectedEmail && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Drive Snapshots ({driveFiles.length})</h4>
              <button onClick={fetchDriveFiles} className="min-h-[44px] p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg">
                <RefreshCw className={`h-4 w-4 ${loadingDrive ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {driveFiles.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {driveFiles.map(f => (
                  <div key={f.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{f.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                        <span>{new Date(f.createdTime).toLocaleString()}</span>
                        <span>{((parseInt(f.size) || 0) / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">View</span>
                      </a>
                      <button
                        onClick={() => handleRestoreFromDrive(f.id)}
                        disabled={restoringDrive}
                        className="min-h-[44px] px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-extrabold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${restoringDrive ? 'animate-spin' : ''}`} />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">No backups found in Drive.</p>
                <p className="text-[10px]">Click Sync Now to create your first cloud backup.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 14-DAY LOCAL TIMELINE SNAPSHOTS */}
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 font-sans flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            <span>Local 14-Day Rolling Snapshots ({backups.length})</span>
          </span>
          <span className="text-xs font-bold text-slate-400">
            Auto-Purge &gt;14 days
          </span>
        </div>

        {backups.length > 0 ? (
          <div className="space-y-3">
            {backups.map((item) => (
              <div
                key={item.filename}
                className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all hover:bg-slate-100/80"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                      item.isAuto ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {item.isAuto ? '🤖 AUTOMATED SNAPSHOT' : '👤 MANUAL SNAPSHOT'}
                    </span>

                    <span className="text-xs font-black text-slate-900">
                      {item.label}
                    </span>

                    <span className="text-[10px] font-mono text-slate-400 font-bold ml-auto sm:ml-0">
                      ({(item.sizeBytes / 1024).toFixed(1)} KB)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-sans">
                    <p className="font-bold text-slate-800">
                      📅 Date: {new Date(item.createdTimestamp).toLocaleString()}
                    </p>
                    <p className="text-slate-500">
                      ⏱️ Age: <strong>{item.ageDays} day(s) ago</strong>
                    </p>
                    <p className="text-amber-700 font-semibold">
                      ⌛ Auto-Purge in: <strong>{item.expiresDays} day(s)</strong>
                    </p>
                  </div>

                  {/* COUNTS BADGES */}
                  <div className="flex flex-wrap items-center gap-1 pt-1 font-mono text-[10px] text-slate-700">
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                      🛴 Scooters: {item.counts.scooterUnits}
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                      🛒 Orders: {item.counts.salesOrders}
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                      👤 Buyers: {item.counts.buyers}
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                      🛡️ Claims: {item.counts.warrantyClaims}
                    </span>
                  </div>
                </div>

                {/* ACTION BUTTONS (PHONE TOUCH FRIENDLY) */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                  <button
                    onClick={() => handleDownload(item.filename)}
                    className="min-h-[42px] px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Download offline JSON file"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-700" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => setSelectedBackupForRestore(item)}
                    className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-extrabold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore Data</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 space-y-2">
            <Database className="h-9 w-9 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">No local backup snapshots created yet</p>
            <p className="text-[11px]">Click "Create Snapshot" above to generate your first manual backup.</p>
          </div>
        )}
      </div>

      {/* CONFIRM RESTORE MODAL */}
      <AnimatePresence>
        {selectedBackupForRestore && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <ShieldAlert className="h-7 w-7 shrink-0" />
                <div>
                  <h3 className="text-base font-black text-slate-900">Confirm Database Recovery</h3>
                  <p className="text-xs text-slate-500">Restore system data to a previous snapshot point</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-2">
                <p className="font-bold">
                  Are you sure you want to restore the system to this snapshot?
                </p>
                <div className="font-mono text-[11px] bg-white p-2.5 rounded-xl border border-amber-200 text-slate-800 space-y-1">
                  <p>📅 Snapshot Date: <strong>{new Date(selectedBackupForRestore.createdTimestamp).toLocaleString()}</strong></p>
                  <p>🏷️ Label: <strong>{selectedBackupForRestore.label}</strong></p>
                  <p>🛴 Scooter Count: <strong>{selectedBackupForRestore.counts.scooterUnits}</strong></p>
                  <p>🛒 Orders Count: <strong>{selectedBackupForRestore.counts.salesOrders}</strong></p>
                </div>
                <p className="text-[11px] text-amber-800 italic">
                  * A safety snapshot of your current database state will automatically be saved before this restore proceeds.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBackupForRestore(null)}
                  disabled={restoring}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={restoring}
                  className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{restoring ? 'Restoring Data...' : 'Yes, Restore Now'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
