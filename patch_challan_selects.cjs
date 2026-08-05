const fs = require('fs');
let code = fs.readFileSync('src/components/ChallanManager.tsx', 'utf8');

const oldModelInput = `<input
                            type="text"
                            value={item.productName || item.batteryType || item.chargerType || ''}
                            onChange={(e) => {
                              if (item.itemType === 'scooter') updateItemField(idx, 'productName', e.target.value);
                              else if (item.itemType === 'battery') updateItemField(idx, 'batteryType', e.target.value);
                              else updateItemField(idx, 'chargerType', e.target.value);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                            placeholder="e.g. City XL / 60V 28Ah"
                          />`;

const newModelInput = `                          {item.itemType === 'scooter' ? (
                            <select
                              value={item.productName || ''}
                              onChange={(e) => {
                                updateItemField(idx, 'productName', e.target.value);
                                // Also update color if the new product has colors and current color isn't in it
                                const prod = products.find(p => p.name === e.target.value);
                                if (prod && prod.colors.length > 0 && !prod.colors.includes(item.color || '')) {
                                  updateItemField(idx, 'color', prod.colors[0]);
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                            >
                              <option value="">Select Model</option>
                              {products.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={item.batteryType || item.chargerType || ''}
                              onChange={(e) => {
                                if (item.itemType === 'battery') updateItemField(idx, 'batteryType', e.target.value);
                                else updateItemField(idx, 'chargerType', e.target.value);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                              placeholder="e.g. 60V 28Ah"
                            />
                          )}`;

code = code.replace(oldModelInput, newModelInput);

const oldColorInput = `<input
                              type="text"
                              value={item.color || ''}
                              onChange={(e) => updateItemField(idx, 'color', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                              placeholder="e.g. Matte Black"
                            />`;

const newColorInput = `{(() => {
                              const prod = products.find(p => p.name === item.productName);
                              if (prod && prod.colors && prod.colors.length > 0) {
                                return (
                                  <select
                                    value={item.color || ''}
                                    onChange={(e) => updateItemField(idx, 'color', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                                  >
                                    <option value="">Select Color</option>
                                    {prod.colors.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                );
                              }
                              return (
                                <input
                                  type="text"
                                  value={item.color || ''}
                                  onChange={(e) => updateItemField(idx, 'color', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold outline-none"
                                  placeholder="e.g. Matte Black"
                                />
                              );
                            })()}`;

code = code.replace(oldColorInput, newColorInput);

fs.writeFileSync('src/components/ChallanManager.tsx', code);
