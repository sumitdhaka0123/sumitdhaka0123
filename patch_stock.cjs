const fs = require('fs');
let content = fs.readFileSync('src/components/StockAdjustment.tsx', 'utf8');

// 1. Add state hooks for supplierName
content = content.replace(
  "const [scooterStockInNo, setScooterStockInNo] = useState('');",
  "const [scooterStockInNo, setScooterStockInNo] = useState('');\n  const [scooterSupplierName, setScooterSupplierName] = useState('');"
);
content = content.replace(
  "const [batteryStockInNo, setBatteryStockInNo] = useState('');",
  "const [batteryStockInNo, setBatteryStockInNo] = useState('');\n  const [batterySupplierName, setBatterySupplierName] = useState('');"
);
content = content.replace(
  "const [chargerStockInNo, setChargerStockInNo] = useState('');",
  "const [chargerStockInNo, setChargerStockInNo] = useState('');\n  const [chargerSupplierName, setChargerSupplierName] = useState('');"
);
content = content.replace(
  "const [localStockInNo, setLocalStockInNo] = useState('');",
  "const [localStockInNo, setLocalStockInNo] = useState('');\n  const [localSupplierName, setLocalSupplierName] = useState('');"
);

// 2. Add supplierName to API payloads
// Scooter
content = content.replace(
  "notes: scooterNotes,",
  "notes: scooterNotes,\n        supplierName: scooterSupplierName,"
);
// Battery
content = content.replace(
  "notes: batteryNotes,",
  "notes: batteryNotes,\n        supplierName: batterySupplierName,"
);
// Charger
content = content.replace(
  "notes: chargerNotes,",
  "notes: chargerNotes,\n        supplierName: chargerSupplierName,"
);
// Local Parts
content = content.replace(
  "notes: localNotes,",
  "notes: localNotes,\n        supplierName: localSupplierName,"
);

// 3. Clear state on success
content = content.replace("setScooterBillNo('');", "setScooterBillNo('');\n        setScooterSupplierName('');");
content = content.replace("setBatteryBillNo('');", "setBatteryBillNo('');\n        setBatterySupplierName('');");
content = content.replace("setChargerBillNo('');", "setChargerBillNo('');\n        setChargerSupplierName('');");
content = content.replace("setLocalBillNo('');", "setLocalBillNo('');\n        setLocalSupplierName('');");

// 4. Update the UI Grid to be 3 columns instead of 2 for Bill / Stock In / Supplier
content = content.replace(/<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">/g, '<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">');

// 5. Add UI Inputs
// Scooter UI
const scooterInputHTML = `                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Supplier / Vendor
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Senzo Main"
                      value={scooterSupplierName}
                      onChange={(e) => setScooterSupplierName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-indigo-500 outline-none font-sans"
                    />
                  </div>
                </div>`;
content = content.replace(/onChange=\{\(e\) => setScooterStockInNo\(e\.target\.value\)\}[\s\S]*?<\/div>\s*<\/div>/, match => {
  return match.replace(/<\/div>\s*<\/div>$/, `</div>\n${scooterInputHTML}`);
});

// Battery UI
const batteryInputHTML = `                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Supplier / Vendor
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Batteries"
                      value={batterySupplierName}
                      onChange={(e) => setBatterySupplierName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-cyan-500 outline-none font-sans"
                    />
                  </div>
                </div>`;
content = content.replace(/onChange=\{\(e\) => setBatteryStockInNo\(e\.target\.value\)\}[\s\S]*?<\/div>\s*<\/div>/, match => {
  return match.replace(/<\/div>\s*<\/div>$/, `</div>\n${batteryInputHTML}`);
});

// Charger UI
const chargerInputHTML = `                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                      Supplier / Vendor
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PowerCorp"
                      value={chargerSupplierName}
                      onChange={(e) => setChargerSupplierName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:border-red-500 outline-none font-sans"
                    />
                  </div>
                </div>`;
content = content.replace(/onChange=\{\(e\) => setChargerStockInNo\(e\.target\.value\)\}[\s\S]*?<\/div>\s*<\/div>/, match => {
  return match.replace(/<\/div>\s*<\/div>$/, `</div>\n${chargerInputHTML}`);
});

// Local Parts UI uses grid-cols-2 gap-2
content = content.replace('<div className="grid grid-cols-2 gap-2">', '<div className="grid grid-cols-3 gap-2">');

const localInputHTML = `                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                        Supplier
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Local Auto"
                        value={localSupplierName}
                        onChange={(e) => setLocalSupplierName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-base sm:text-xs text-slate-800 focus:border-amber-500 outline-none font-sans"
                      />
                    </div>
                  </div>`;
content = content.replace(/onChange=\{\(e\) => setLocalStockInNo\(e\.target\.value\)\}[\s\S]*?<\/div>\s*<\/div>/, match => {
  return match.replace(/<\/div>\s*<\/div>$/, `</div>\n${localInputHTML}`);
});

fs.writeFileSync('src/components/StockAdjustment.tsx', content);
console.log("Patched StockAdjustment.tsx");
