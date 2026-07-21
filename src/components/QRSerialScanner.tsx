import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRSerialScannerProps {
  title: string;
  type: 'battery' | 'charger';
  onScanSuccess: (serial: string) => void;
  onClose: () => void;
  existingSerials?: string[];
  targetQuantity?: number;
}

export default function QRSerialScanner({
  title,
  type,
  onScanSuccess,
  onClose,
  existingSerials = [],
  targetQuantity
}: QRSerialScannerProps) {
  const [scannedList, setScannedList] = useState<string[]>(existingSerials);
  const [manualInput, setManualInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [tintState, setTintState] = useState<'none' | 'success' | 'error'>('none');
  
  const [seriesPrefix, setSeriesPrefix] = useState(type === 'battery' ? 'LIT-BAT-' : 'CHG-');
  const [seriesStart, setSeriesStart] = useState('');
  const [seriesEnd, setSeriesEnd] = useState('');
  
  const tintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scannedListRef = useRef<string[]>(existingSerials);
  const isScanningRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedTextRef = useRef<string>('');
  
  const qrReaderId = 'qr-reader-viewport';

  useEffect(() => {
    scannedListRef.current = scannedList;
  }, [scannedList]);

  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  const triggerTint = (status: 'success' | 'error') => {
    if (tintTimeoutRef.current) {
      clearTimeout(tintTimeoutRef.current);
    }
    setTintState(status);
    tintTimeoutRef.current = setTimeout(() => {
      setTintState('none');
    }, 800);
  };

  const addSerial = (serial: string) => {
    const cleanSerial = serial.trim().toUpperCase();
    if (!cleanSerial) return false;

    const now = Date.now();
    if (cleanSerial === lastScannedTextRef.current && now - lastScannedTimeRef.current < 2500) {
      return false;
    }
    lastScannedTextRef.current = cleanSerial;
    lastScannedTimeRef.current = now;

    if (scannedListRef.current.includes(cleanSerial)) {
      setErrorMessage(`Duplicate Code: "${cleanSerial}" is already in your current scan list!`);
      triggerTint('error');
      return false;
    }

    if (targetQuantity && scannedListRef.current.length >= targetQuantity) {
      setErrorMessage(`Limit Reached: Already scanned the target quantity of ${targetQuantity} units.`);
      triggerTint('error');
      return false;
    }

    setScannedList(prev => [...prev, cleanSerial]);
    onScanSuccess(cleanSerial);
    setSuccessMessage(`Scanned successfully: "${cleanSerial}"`);
    triggerTint('success');
    return true;
  };

  const handleAddSeries = (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = parseInt(seriesStart, 10);
    const endNum = parseInt(seriesEnd, 10);
    
    if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
      setErrorMessage('Invalid range: Start number must be less than or equal to End number.');
      triggerTint('error');
      return;
    }

    let addedCount = 0;
    for (let i = startNum; i <= endNum; i++) {
      const numStr = i.toString().padStart(seriesStart.length, '0');
      const serial = `${seriesPrefix}${numStr}`;
      
      const success = addSerial(serial);
      if (success) addedCount++;
      else break; 
    }

    if (addedCount > 0) {
      setSuccessMessage(`Successfully added ${addedCount} serials in range.`);
      setSeriesStart('');
      setSeriesEnd('');
    }
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (cameraActive) {
      setCameraError(null);
      const timer = setTimeout(() => {
        try {
          const element = document.getElementById(qrReaderId);
          if (!element) return;
          
          html5QrCode = new Html5Qrcode(qrReaderId);
          
          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 24,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.8;
                return { width: Math.floor(size), height: Math.floor(size) };
              },
              videoConstraints: {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                facingMode: "environment"
              }
            },
            (decodedText) => {
              addSerial(decodedText);
            },
            () => {}
          ).then(() => {
            isScanningRef.current = true;
            setIsScanning(true);
          }).catch((err) => {
            console.warn("Failing back to user/default camera facing mode:", err);
            html5QrCode?.start(
              { facingMode: "user" },
              {
                fps: 24,
                qrbox: (width, height) => {
                  const size = Math.min(width, height) * 0.8;
                  return { width: Math.floor(size), height: Math.floor(size) };
                },
                videoConstraints: {
                  width: { min: 640, ideal: 1280, max: 1920 },
                  height: { min: 480, ideal: 720, max: 1080 },
                  facingMode: "user"
                }
              },
              (decodedText) => {
                addSerial(decodedText);
              },
              () => {}
            ).then(() => {
              isScanningRef.current = true;
              setIsScanning(true);
            }).catch((fallbackErr) => {
              console.error("Camera access failed entirely:", fallbackErr);
              setCameraError("Camera access failed. Please ensure camera permissions are granted.");
            });
          });
        } catch (e: any) {
          console.error("Scanner instantiation failed:", e);
          setCameraError("Failed to initialize system camera scanner.");
        }
      }, 400);

      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          const cleanupScanner = async () => {
            try {
              if (isScanningRef.current) {
                isScanningRef.current = false;
                setIsScanning(false);
                await html5QrCode?.stop();
              }
            } catch (e) {
              console.warn("Camera scan stop call deferred:", e);
            }
          };
          cleanupScanner();
        }
      };
    } else {
      setIsScanning(false);
    }
  }, [cameraActive]);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (addSerial(manualInput)) {
      setManualInput('');
    }
  };

  const removeScannedItem = (index: number) => {
    setScannedList(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-w-2xl w-full">
      <div className="bg-slate-900 text-white px-5 py-4 pt-10 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider font-sans">
            📷 {title}
          </h3>
          {targetQuantity && (
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Scan Target: {scannedList.length} of {targetQuantity} units verified
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-sm p-1 rounded hover:bg-slate-800 transition bg-slate-800/50"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
        <div className="space-y-3">
          <div className="relative aspect-square md:aspect-video bg-slate-950 rounded-lg overflow-hidden flex flex-col justify-center items-center border border-slate-800">
            {tintState !== 'none' && (
              <div 
                className={`absolute inset-0 z-50 pointer-events-none flex items-center justify-center transition-all duration-75 ${
                  tintState === 'success' ? 'bg-emerald-500/20 ring-4 ring-emerald-500 ring-inset' : 'bg-rose-500/20 ring-4 ring-rose-500 ring-inset'
                }`}
              >
                <div className="bg-slate-900/90 text-white font-mono text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  {tintState === 'success' ? '⚡ SCANNED OK' : '⚠️ SCAN REJECTED'}
                </div>
              </div>
            )}

            {cameraActive && !cameraError ? (
              <div 
                id={qrReaderId} 
                className="absolute inset-0 w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover" 
              />
            ) : null}

            {cameraActive && !cameraError && isScanning && (
              <>
                <div className="absolute inset-4 border-2 border-emerald-500 rounded border-dashed opacity-40 pointer-events-none z-10" />
                <motion.div 
                  className="absolute left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_10px_#10b981] pointer-events-none z-10"
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[9px] font-bold tracking-wider uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live Video
                </div>
              </>
            )}

            {cameraError && (
              <div className="absolute inset-0 z-40 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center space-y-2">
                <span className="text-2xl animate-bounce">⚠️</span>
                <p className="text-xs font-mono text-rose-400 font-bold max-w-[85%]">{cameraError}</p>
                <p className="text-[10px] text-slate-400">Please verify camera permissions in your browser or switch to Manual input.</p>
              </div>
            )}

            {!cameraActive && (
              <div className="text-center text-slate-500 space-y-1 z-10">
                <div className="text-3xl">🚫</div>
                <div className="text-xs font-mono">Camera Paused</div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCameraActive(!cameraActive)}
              className={`w-full text-xs py-1.5 px-3 rounded font-medium transition cursor-pointer ${
                cameraActive ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {cameraActive ? '🔌 Pause Camera' : '⚡ Start Camera'}
            </button>
          </div>
          
          <div className="border border-slate-100 bg-slate-50/50 rounded-lg p-3 mt-4">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Scan by Range:</h4>
            <form onSubmit={handleAddSeries} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={seriesPrefix}
                  onChange={(e) => setSeriesPrefix(e.target.value)}
                  placeholder="Prefix"
                  className="w-16 text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                />
                <input
                  type="number"
                  value={seriesStart}
                  onChange={(e) => setSeriesStart(e.target.value)}
                  placeholder="Start"
                  className="w-16 text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  required
                />
                <span className="text-slate-400 self-center text-xs">to</span>
                <input
                  type="number"
                  value={seriesEnd}
                  onChange={(e) => setSeriesEnd(e.target.value)}
                  placeholder="End"
                  className="w-16 text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded font-medium transition cursor-pointer"
              >
                Add Range
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-col h-full space-y-3">
          <form onSubmit={handleManualAdd} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or enter serial code manually..."
              className="flex-1 bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer"
            >
              Add
            </button>
          </form>

          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-rose-50 border border-rose-100 text-rose-600 px-3 py-2 rounded-lg text-[11px] font-semibold"
              >
                ⚠️ {errorMessage}
              </motion.div>
            )}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-2 rounded-lg text-[11px] font-semibold"
              >
                ✓ {successMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col min-h-[140px] border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Scanned Items ({scannedList.length})</span>
              {targetQuantity && <span>Target: {targetQuantity}</span>}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[180px]">
              {scannedList.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-400 font-mono italic">
                  No items scanned yet.
                </div>
              ) : (
                scannedList.map((code, index) => (
                  <div
                    key={`${code}-${index}`}
                    className="flex items-center justify-between bg-white border border-slate-150 px-2.5 py-1.5 rounded-md shadow-sm"
                  >
                    <span className="text-[11px] font-mono font-bold text-slate-800">
                      {index + 1}. <span className="text-emerald-600">{code}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeScannedItem(index)}
                      className="text-slate-400 hover:text-rose-500 text-[10px] font-bold transition px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          >
            🏁 Confirm {scannedList.length} Scanned Serial(s)
          </button>
        </div>
      </div>
    </div>
  );
}
