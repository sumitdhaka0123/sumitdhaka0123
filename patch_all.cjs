const fs = require('fs');
let code = fs.readFileSync('src/components/ChallanManager.tsx', 'utf8');

// Patch 1: salesOrderToGroupedChallan signature and scooter lookup
code = code.replace(
"function salesOrderToGroupedChallan(order: SalesOrder): GroupedChallan {",
"function salesOrderToGroupedChallan(order: SalesOrder, allScooters: ScooterUnit[] = []): GroupedChallan {"
);

const oldScooterPush = `        scooters.push({
          id: \`\${order.id}-scoot-\${i}\`,
          modelName: it.productName || 'Scooter',
          color: it.color || 'Standard',
          chassisNo: chassis,
          motorNo: 'N/A',
          controllerNo: 'N/A',
          tireSize: '10-inch',
          batterySerials: it.serialNumbers || [],
          status: order.status === 'challan_generated' ? 'sold' : 'hold',
          scooterWarrantyStatus: 'None',
          batteryWarrantyStatus: 'None',
          buyerName: order.buyerName,
          buyerContact: order.buyerContact,
          deliveryChallanNo: order.challanNo,
          salesBillNo: order.salesBillNo,
          createdOperator: order.salespersonName || 'sales',
          createdTimestamp: order.createdTimestamp,
          lastUpdatedTimestamp: order.createdTimestamp
        });`;

const newScooterPush = `        const realScooter = allScooters.find(u => u.chassisNo === chassis);
        scooters.push({
          id: \`\${order.id}-scoot-\${i}\`,
          modelName: it.productName || 'Scooter',
          color: it.color || 'Standard',
          chassisNo: chassis,
          motorNo: realScooter?.motorNo || 'N/A',
          controllerNo: realScooter?.controllerNo || 'N/A',
          tireSize: realScooter?.tireSize || '10-inch',
          batterySerials: realScooter?.batterySerials?.length ? realScooter.batterySerials : (it.serialNumbers || []),
          status: order.status === 'challan_generated' ? 'sold' : 'hold',
          scooterWarrantyStatus: realScooter?.scooterWarrantyStatus || 'None',
          batteryWarrantyStatus: realScooter?.batteryWarrantyStatus || 'None',
          buyerName: order.buyerName,
          buyerContact: order.buyerContact,
          deliveryChallanNo: order.challanNo,
          salesBillNo: order.salesBillNo,
          createdOperator: order.salespersonName || 'sales',
          createdTimestamp: order.createdTimestamp,
          lastUpdatedTimestamp: order.createdTimestamp
        });`;
        
code = code.replace(oldScooterPush, newScooterPush);

code = code.replace(
"        groupedRepresentation: salesOrderToGroupedChallan(order)",
"        groupedRepresentation: salesOrderToGroupedChallan(order, scooterUnits)"
);

// Patch 2: The chassis edit input to select

const oldBlock = `                            {(item.chassisNumbers || []).map((chassis, cIdx) => (
                              <div key={cIdx} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400 shrink-0 w-6">#{cIdx + 1}</span>
                                <input
                                  type="text"
                                  placeholder={\`Chassis No \${cIdx + 1}\`}
                                  value={chassis}
                                  onChange={(e) => updateChassisNumber(idx, cIdx, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-mono font-bold text-xs uppercase outline-none focus:border-cyan-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeChassisSlot(idx, cIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>`;

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
                                </select>
                                <button
                                  type="button"
                                  onClick={() => removeChassisSlot(idx, cIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              );
                            })}
                          </div>`;

code = code.replace(oldBlock, newBlock);

fs.writeFileSync('src/components/ChallanManager.tsx', code);
console.log('Patched ChallanManager.tsx completely');
