import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface QRSerialScannerProps {
  title: string;
  targetQuantity?: number;
  existingSerials?: string[];
  allRegisteredSerials?: string[]; // Serials already registered in DB (to prevent duplicates)
  onConfirm: (serials: string[]) => void;
  onCancel: () => void;
  type: 'battery' | 'charger';
}

export default function QRSerialScanner({
  title,
  targetQuantity,
  existingSerials = [],
  allRegisteredSerials = [],
  onConfirm,
  onCancel,
  type
}: QRSerialScannerProps) {
  const [scannedList, setScannedList] = useState<string[]>(existingSerials);
  const [manualInput, setManualInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [scannerLineDirection, setScannerLineDirection] = useState<'down' | 'up'>('down');
  const [tintState, setTintState] = useState<'none' | 'success' | 'error'>('none');
  const tintTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const triggerTint = (status: 'success' | 'error') => {
    setTintState(status);
    if (tintTimeoutRef.current) {
      clearTimeout(tintTimeoutRef.current);
    }
    tintTimeoutRef.current = setTimeout(() => {
      setTintState('none');
    }, 450); // fast visual flash duration
  };

  const addSerial = (serial: string) => {
    const cleanSerial = serial.trim().toUpperCase();
    if (!cleanSerial) return;

    // Check if duplicate in session
    if (scannedList.includes(cleanSerial)) {
      setErrorMessage(`Duplicate Code: "${cleanSerial}" is already in your current scan list!`);
      triggerTint('error');
      return false;
    }

    // Check if duplicate in registered database
    if (allRegisteredSerials.map(s => s.trim().toUpperCase()).includes(cleanSerial)) {
      setErrorMessage(`System Error: "${cleanSerial}" is already registered in the warehouse database!`);
      triggerTint('error');
      return false;
    }

    // Limit to target quantity if provided
    if (targetQuantity && scannedList.length >= targetQuantity) {
      setErrorMessage(`Limit Reached: Already scanned the target quantity of ${targetQuantity} units.`);
      triggerTint('error');
      return false;
    }

    setScannedList(prev => [...prev, cleanSerial]);
    setSuccessMessage(`Scanned successfully: ${cleanSerial}`);
    setErrorMessage(null);
    triggerTint('success');
    return true;
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (addSerial(manualInput)) {
      setManualInput('');
    }
  };

  const handleRemoveSerial = (index: number) => {
    setScannedList(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoGenerate = () => {
    const prefix = type === 'battery' ? 'LIT-BAT' : 'LIT-CHG';
    const rand = Math.floor(100000 + Math.random() * 900000);
    const newSerial = `${prefix}-${rand}`;
    addSerial(newSerial);
  };

  // Pre-set simulation codes
  const simulationPresets = type === 'battery' 
    ? ['LIT-60V24AH-88219A', 'LIT-60V30AH-41120B', 'LIT-48V30AH-55209X', 'LIT-72V42AH-00128C', 'LIT-60V10AH-22019Y']
    : ['CHG-54V6A-88129B', 'CHG-69V6A-40028C', 'CHG-67V6A-55110X', 'CHG-LA-48V-99218F', 'CHG-LA-72V-01129E'];

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-w-2xl w-full">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg font-sans flex items-center gap-2">
            <span>📷</span> {title}
          </h3>
          <p className="text-xs text-slate-400">
            {targetQuantity ? `Scan matching units: ${scannedList.length} / ${targetQuantity}` : `Scanned list: ${scannedList.length} total units`}
          </p>
        </div>
        <button 
          onClick={onCancel}
          className="text-slate-400 hover:text-white text-sm p-1 rounded hover:bg-slate-800 transition"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
        {/* Left column: Simulated Camera Scanner */}
        <div className="space-y-3">
          <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden flex flex-col justify-center items-center border border-slate-800">
            {tintState !== 'none' && (
              <div 
                className={`absolute inset-0 z-50 pointer-events-none flex items-center justify-center transition-all duration-75 ${
                  tintState === 'success' 
                    ? 'bg-emerald-500/35 ring-8 ring-emerald-500 ring-inset' 
                    : 'bg-rose-500/35 ring-8 ring-rose-500 ring-inset'
                }`}
              >
                <div className={`px-4 py-2 rounded-xl text-white font-extrabold text-sm uppercase tracking-wider shadow-lg flex items-center gap-1.5 animate-bounce ${
                  tintState === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                  {tintState === 'success' ? '✅ OK' : '⚠️ DUPLICATE / ERROR'}
                </div>
              </div>
            )}

            {cameraActive ? (
              <>
                {/* Active scan frame effect */}
                <div className="absolute inset-4 border-2 border-emerald-500 rounded border-dashed opacity-40 pointer-events-none" />
                
                {/* Scanning green line animation */}
                <motion.div 
                  className="absolute left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_10px_#10b981] pointer-events-none"
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />

                <div className="text-center text-slate-400 space-y-1 select-none pointer-events-none z-10">
                  <div className="text-4xl animate-pulse">📷</div>
                  <div className="text-xs font-mono tracking-wider text-emerald-400">CAMERA STREAM ACTIVE</div>
                  <div className="text-[10px] text-slate-500">Position QR code inside bounds</div>
                </div>

                {/* Subtitle with dynamic sensor readout */}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-mono text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded">
                  <span>RES: 1080P</span>
                  <span>FPS: 30</span>
                  <span>DUAL_LEN: OK</span>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 space-y-1">
                <div className="text-3xl">🚫</div>
                <div className="text-xs font-mono">Camera Disconnected</div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCameraActive(!cameraActive)}
              className={`w-full text-xs py-1.5 px-3 rounded font-medium transition ${
                cameraActive ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {cameraActive ? '🔌 Pause Scanner' : '⚡ Start Scanner'}
            </button>
          </div>

          {/* Preset QR triggers */}
          <div className="border border-slate-100 bg-slate-50/50 rounded-lg p-3">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Simulate QR Scan (Click to Scan):</h4>
            <div className="flex flex-wrap gap-1.5">
              {simulationPresets.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => addSerial(code)}
                  className="bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-[10px] font-mono px-2 py-1 rounded transition shadow-sm text-slate-700"
                >
                  📥 {code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Scanned list & manual entry */}
        <div className="flex flex-col h-full space-y-3">
          {/* Manual input fallback */}
          <form onSubmit={handleManualAdd} className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Manual Serial/QR Code:</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Type or paste serial code"
                className="flex-1 text-xs px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1.5 rounded font-medium transition shrink-0"
              >
                Register
              </button>
            </div>
          </form>

          {/* Feedback messages */}
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 p-2.5 rounded text-xs leading-relaxed"
              >
                <strong>⚠️ {errorMessage}</strong>
              </motion.div>
            )}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-2.5 rounded text-xs"
              >
                <strong>✅ {successMessage}</strong>
              </motion.div>
            )}
          </AnimatePresence>

          {/* List display */}
          <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-slate-50 min-h-[160px] max-h-[220px]">
            <div className="bg-slate-100 px-3 py-1.5 text-slate-600 text-[11px] font-bold border-b border-slate-200 flex justify-between">
              <span>Scanned Items ({scannedList.length})</span>
              {targetQuantity && <span>Target: {targetQuantity}</span>}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {scannedList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                  <span>📭</span>
                  <span>No serial numbers registered yet. Scan or type codes to populate.</span>
                </div>
              ) : (
                scannedList.map((serial, idx) => (
                  <div 
                    key={`${serial}-${idx}`} 
                    className="flex justify-between items-center bg-white px-2 py-1.5 rounded border border-slate-200 shadow-sm text-xs font-mono"
                  >
                    <span className="text-slate-800 truncate pr-2">
                      <span className="text-slate-400 select-none mr-1">{idx + 1}.</span>
                      {serial}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSerial(idx)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded font-sans transition"
                      title="Remove"
                    >
                      ❌
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Confirm panel */}
          <button
            type="button"
            onClick={() => onConfirm(scannedList)}
            disabled={targetQuantity ? scannedList.length !== targetQuantity : scannedList.length === 0}
            className={`w-full text-xs py-2 px-4 rounded font-bold transition flex justify-center items-center gap-2 ${
              (targetQuantity ? scannedList.length === targetQuantity : scannedList.length > 0)
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            🏁 Confirm {scannedList.length} Scanned Serial(s)
          </button>
        </div>
      </div>
    </div>
  );
}
