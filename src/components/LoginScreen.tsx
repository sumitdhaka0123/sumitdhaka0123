import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, User as UserIcon, Lock, Key, Battery, Compass, ShoppingCart } from 'lucide-react';
import { User } from '../types';
import SenzoLogo from './SenzoLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'manufacturer' | 'salesperson'>('manufacturer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Server URL State for Capacitor / Android Native deployment
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('SENZO_API_SERVER_URL') || 'https://ais-pre-ok3o3tltxmte4gbcr2v3di-403794027483.asia-east1.run.app';
  });
  const [tempServerUrl, setTempServerUrl] = useState(serverUrl);

  const handleSaveServerUrl = () => {
    let formatted = tempServerUrl.trim();
    if (formatted) {
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = 'http://' + formatted;
      }
      localStorage.setItem('SENZO_API_SERVER_URL', formatted);
      setServerUrl(formatted);
      setTempServerUrl(formatted);
      setShowServerConfig(false);
      setSuccess('API Server connection updated successfully!');
      setError('');
    }
  };

  const handleResetServerUrl = () => {
    localStorage.removeItem('SENZO_API_SERVER_URL');
    const defaultUrl = 'https://ais-pre-ok3o3tltxmte4gbcr2v3di-403794027483.asia-east1.run.app';
    setServerUrl(defaultUrl);
    setTempServerUrl(defaultUrl);
    setShowServerConfig(false);
    setSuccess('API Server connection reset to default production server.');
    setError('');
  };

  // Quick-login helper values
  const quickLogins = [
    { label: 'Manufacturer: Production Specialist', user: 'manufacturer', pass: 'manu123', color: 'border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70' },
    { label: 'Salesperson: Sales & POS Advisor', user: 'sales', pass: 'sales123', color: 'border-cyan-200 text-cyan-800 bg-cyan-50 hover:bg-cyan-100/70' },
    { label: 'Admin: Warehouse Supervisor', user: 'admin', pass: 'admin123', color: 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100/70' },
  ];

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setSuccess('');
    handleSubmit(null, user, pass);
  };

  const handleSubmit = async (e: React.FormEvent | null, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const loginUser = customUser || username;
    const loginPass = customPass || password;

    if (!loginUser || !loginPass) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        if (!name) {
          setError('Full name is required for registration');
          setLoading(false);
          return;
        }

        const regRes = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginUser, password: loginPass, role, name }),
        });

        let regData: any = null;
        const regContentType = regRes.headers.get('content-type');
        if (regContentType && regContentType.includes('application/json')) {
          regData = await regRes.json();
        } else {
          const text = await regRes.text();
          throw new Error(text || `Registration failed with status ${regRes.status}`);
        }

        if (!regRes.ok) throw new Error(regData?.error || 'Registration failed');

        // Registration successful - show positive guidance and switch back to login mode
        setSuccess(`Registration successful! Account "@${loginUser}" has been registered and is pending approval from the Warehouse Owner. Please wait for the owner to grant access.`);
        setIsRegistering(false);
        setPassword('');
        setLoading(false);
        return;
      }

      // Perform Login
      const loginRes = await fetch(((import.meta as any).env.VITE_API_BASE_URL || '') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });

      let loginData: any = null;
      const loginContentType = loginRes.headers.get('content-type');
      if (loginContentType && loginContentType.includes('application/json')) {
        loginData = await loginRes.json();
      } else {
        const text = await loginRes.text();
        throw new Error(text || `Authentication failed with status ${loginRes.status}`);
      }

      if (!loginRes.ok) throw new Error(loginData?.error || 'Authentication failed');

      onLoginSuccess(loginData.user, loginData.token);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 relative overflow-hidden" id="login-container">
      {/* Background Decorative Rings */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl relative z-10"
        id="login-card"
      >
        {/* Brand / Logo */}
        <div className="flex flex-col items-center mb-8">
          <SenzoLogo layout="full" className="mb-1" />
          <p className="text-slate-500 text-xs mt-2 text-center font-sans font-medium">
            Warehouse Terminal & Production System 📦
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 text-xs font-sans font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-rose-500" id="login-error-shield" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-sans font-semibold flex items-start gap-2.5 shadow-sm">
            <span className="text-emerald-500 text-sm mt-0.5" id="login-success-checkmark">✅</span>
            <div className="flex-1 leading-relaxed">
              {success}
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                Full Name / Station Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <UserIcon className="h-4.5 w-4.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex - Assembly Station 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <UserIcon className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                required
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
              Security Pin / Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all font-sans"
              />
            </div>
          </div>

          {isRegistering && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                Assigned Role
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setRole('manufacturer')}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-xs font-sans transition-all text-center cursor-pointer ${
                    role === 'manufacturer'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                  }`}
                  id="reg-role-manufacturer"
                >
                  <Battery className="h-4.5 w-4.5 mb-1 text-emerald-600" />
                  <span className="font-bold text-[11px]">Manufacturer</span>
                  <span className="text-[9px] opacity-80">Assembly Logging</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('salesperson')}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-xs font-sans transition-all text-center cursor-pointer ${
                    role === 'salesperson'
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                      : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                  }`}
                  id="reg-role-salesperson"
                >
                  <ShoppingCart className="h-4.5 w-4.5 mb-1 text-cyan-600" />
                  <span className="font-bold text-[11px]">Salesperson</span>
                  <span className="text-[9px] opacity-80">POS & Warranties</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-4 rounded-2xl font-sans font-bold text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
            id="login-submit-btn"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Key className="h-4.5 w-4.5" />
                <span>{isRegistering ? 'Create My Account! ✨' : 'Sign In Now! 🔓'}</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccess('');
            }}
            className="text-xs font-bold text-cyan-600 hover:underline transition-all"
            id="toggle-register-btn"
          >
            {isRegistering
              ? 'Already have an account? Sign In here'
              : "Need a new station ID? Register in 2 seconds"}
          </button>
        </div>

        {/* Server Connection Configuration (especially for Capacitor Android) */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center">
          {!showServerConfig ? (
            <button
              type="button"
              onClick={() => setShowServerConfig(true)}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-all flex items-center gap-1.5"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Server: {serverUrl ? new URL(serverUrl).hostname : 'Default Cloud Server'}</span>
              <span className="underline">(Change)</span>
            </button>
          ) : (
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  API Server Connection
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowServerConfig(false);
                    if (!tempServerUrl.trim()) {
                      setTempServerUrl('https://ais-pre-ok3o3tltxmte4gbcr2v3di-403794027483.asia-east1.run.app');
                    }
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:underline"
                >
                  Close
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                When running as an Android App, it must connect to a remote server. Enter your server's IP address or Domain.
              </p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="https://your-server-address.com"
                  value={tempServerUrl}
                  onChange={(e) => setTempServerUrl(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="bg-slate-900 text-white font-sans font-bold text-xs px-3 py-1.5 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Save
                </button>
              </div>
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={handleResetServerUrl}
                  className="text-[9px] font-semibold text-slate-400 hover:text-slate-600 transition-all"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
