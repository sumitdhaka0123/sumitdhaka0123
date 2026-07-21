import React, { useState, useEffect } from 'react';
import { DownloadCloud } from 'lucide-react';

// Hardcode the current APK version of the app. 
// When you build a new APK, you change this to "1.0.1", "1.0.2", etc.
const CURRENT_APP_VERSION = "1.0.7";

export function AutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState("");
  const [apkUrl, setApkUrl] = useState("");

  useEffect(() => {
    // Check the server for the latest version
    fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/version')
      .then(res => res.json())
      .then(data => {
        if (data && data.version && data.version !== CURRENT_APP_VERSION) {
          setServerVersion(data.version);
          setApkUrl(data.apkUrl);
          setUpdateAvailable(true);
        }
      })
      .catch(e => console.error("Could not check for updates", e));
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center animate-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <DownloadCloud className="w-10 h-10 text-emerald-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Update Available!</h2>
        <p className="text-gray-400 mb-8">
          Version {serverVersion} is now available. You must update your app to continue working.
        </p>

        <a 
          href={apkUrl}
          target="_system"
          className="w-full block py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg transition-colors shadow-lg shadow-emerald-500/30"
        >
          Download Update
        </a>
        <p className="text-xs text-gray-500 mt-4">
          After downloading, tap the file to install the new version.
        </p>
      </div>
    </div>
  );
}
