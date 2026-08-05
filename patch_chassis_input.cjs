const fs = require('fs');
let code = fs.readFileSync('src/components/ChallanManager.tsx', 'utf8');

const oldBlock = `                            {(item.chassisNumbers || []).map((chassis, cIdx) => (
                              <div key={cIdx} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400 shrink-0 w-6">#{cIdx + 1}</span>
                                <input
                                  type="text"
                                  placeholder={\`Chassis No \${cIdx + 1}\`}
                                  value={chassis}
                                  onChange={(e) => updateChassisNumber(idx, cIdx, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-mono font-bold text-xs uppercase outline-none focus:border-cyan-500"
                                />`;

const newBlock = `                            {(item.chassisNumbers || []).map((chassis, cIdx) => {
                              const availableForModel = scooterUnits.filter(u => 
                                (u.status === 'available' || u.chassisNo === chassis) && 
                                (!item.productName || u.modelName === item.productName) &&
                                (!item.color || u.color === item.color)
                              );
                              return (
                              <div key={cIdx} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400 shrink-0 w-6">#{cIdx + 1}</span>
                                <select
                                  value={chassis}
                                  onChange={(e) => updateChassisNumber(idx, cIdx, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-mono font-bold text-xs outline-none focus:border-cyan-500 cursor-pointer"
                                >
                                  <option value="">-- Select Chassis --</option>
                                  {availableForModel.map(u => (
                                    <option key={u.id} value={u.chassisNo}>
                                      {u.chassisNo} {u.motorNo ? \`(Motor: \${u.motorNo})\` : ''}
                                    </option>
                                  ))}
                                </select>`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/components/ChallanManager.tsx', code);
console.log('Patched chassis input in ChallanManager.tsx');
