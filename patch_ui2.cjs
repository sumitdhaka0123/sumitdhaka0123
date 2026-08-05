const fs = require('fs');
let code = fs.readFileSync('src/components/BackupRecoveryPanel.tsx', 'utf8');

// 1. Add lucide icons
code = code.replace("Trash2, HardDrive, ShieldAlert, FileText", "Trash2, HardDrive, ShieldAlert, FileText, Cloud, CloudOff, ExternalLink, Settings");

// 2. Add Drive types
const typesInjection = `
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
`;
code = code.replace("interface BackupRecoveryPanelProps {", typesInjection + "\ninterface BackupRecoveryPanelProps {");

// 3. Add states for Drive
const statesInjection = `
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
`;
code = code.replace("  // Fetch local 14-day backups", statesInjection + "\n  // Fetch local 14-day backups");

// 4. Add UI for Drive
const uiInjection = `
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
                  className={\`w-12 h-6 rounded-full p-1 transition-colors \${driveConfig.autoSync ? 'bg-emerald-500' : 'bg-slate-300'}\`}
                >
                  <div className={\`w-4 h-4 bg-white rounded-full shadow-sm transition-transform \${driveConfig.autoSync ? 'translate-x-6' : 'translate-x-0'}\`} />
                </button>
              </div>

              <button
                onClick={handleSyncToDriveNow}
                disabled={syncingDrive}
                className="min-h-[44px] w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className={\`h-4 w-4 \${syncingDrive ? 'animate-spin' : ''}\`} />
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
                <RefreshCw className={\`h-4 w-4 \${loadingDrive ? 'animate-spin' : ''}\`} />
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
                        <RotateCcw className={\`h-3.5 w-3.5 \${restoringDrive ? 'animate-spin' : ''}\`} />
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

`;
code = code.replace("{/* 14-DAY LOCAL TIMELINE SNAPSHOTS */}", uiInjection + "      {/* 14-DAY LOCAL TIMELINE SNAPSHOTS */}");

fs.writeFileSync('src/components/BackupRecoveryPanel.tsx', code);
console.log('Patched UI');
