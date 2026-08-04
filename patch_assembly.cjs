const fs = require('fs');
let content = fs.readFileSync('src/components/AssemblyPipeline.tsx', 'utf8');

// 1. Add state hooks for prefixes right after `s1IsBulk`
const prefixStates = `  const [s1ChassisPrefix, setS1ChassisPrefix] = useState<string>('');
  const [s1MotorPrefix, setS1MotorPrefix] = useState<string>('');
  const [s1ControllerPrefix, setS1ControllerPrefix] = useState<string>('');

  const combineWithPrefix = (prefix: string, rawVal: string) => {
    const p = prefix.trim().toUpperCase();
    const v = rawVal.trim().toUpperCase();
    if (!v) return '';
    if (p && !v.startsWith(p)) {
      return \`\${p}\${v}\`;
    }
    return v;
  };`;

content = content.replace(
  "const [s1BulkControllerList, setS1BulkControllerList] = useState<string>(initialDraft?.s1BulkControllerList || '');",
  "const [s1BulkControllerList, setS1BulkControllerList] = useState<string>(initialDraft?.s1BulkControllerList || '');\n" + prefixStates
);

// 2. Modify `handleStage1BulkSubmit` payload
const searchItems = `          items: activeItems.map(item => ({
            chassisNo: item.chassisNo,
            motorNo: item.motorNo,
            controllerNo: item.controllerNo
          }))`;
const replaceItems = `          items: activeItems.map(item => ({
            chassisNo: combineWithPrefix(s1ChassisPrefix, item.chassisNo),
            motorNo: combineWithPrefix(s1MotorPrefix, item.motorNo),
            controllerNo: combineWithPrefix(s1ControllerPrefix, item.controllerNo)
          }))`;
content = content.replace(searchItems, replaceItems);

// 3. Add 3-column prefix assistant bar in the UI
const uiBar = `                    {/* Prefix Assistant Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl mb-2">
                      <div>
                        <label className="block text-[9px] font-bold text-indigo-700 uppercase tracking-wide mb-1 font-sans">
                          Starting Chassis Prefix
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ME4CH"
                          value={s1ChassisPrefix}
                          onChange={(e) => setS1ChassisPrefix(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-900 font-sans uppercase focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-indigo-700 uppercase tracking-wide mb-1 font-sans">
                          Starting Motor Prefix
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. MOT"
                          value={s1MotorPrefix}
                          onChange={(e) => setS1MotorPrefix(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-900 font-sans uppercase focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-indigo-700 uppercase tracking-wide mb-1 font-sans">
                          Starting Controller Prefix
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CTRL"
                          value={s1ControllerPrefix}
                          onChange={(e) => setS1ControllerPrefix(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-900 font-sans uppercase focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>`;

const searchUiAnchor = `<div className="space-y-3.5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">`;
content = content.replace(searchUiAnchor, uiBar + '\n                    ' + searchUiAnchor);

// 4. Update the input slots to include prefix badges
const chassisInputOriginal = `                                <input
                                  type="text"
                                  placeholder={\`CHASSIS-\${1001 + idx}\`}
                                  value={scoot.chassisNo}
                                  onChange={(e) => handleBulkScooterChange(idx, 'chassisNo', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none"
                                  required
                                />`;
const chassisInputNew = `                                <div className="flex rounded-xl shadow-sm">
                                  {s1ChassisPrefix && (
                                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-xs font-bold uppercase">
                                      {s1ChassisPrefix}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    placeholder={\`CHASSIS-\${1001 + idx}\`}
                                    value={scoot.chassisNo}
                                    onChange={(e) => handleBulkScooterChange(idx, 'chassisNo', e.target.value)}
                                    className={\`w-full bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none \${s1ChassisPrefix ? 'rounded-r-xl' : 'rounded-xl'}\`}
                                    required
                                  />
                                </div>`;
content = content.replace(chassisInputOriginal, chassisInputNew);

const motorInputOriginal = `                                <input
                                  type="text"
                                  placeholder={\`MOTOR-\${5550 + idx}\`}
                                  value={scoot.motorNo}
                                  onChange={(e) => handleBulkScooterChange(idx, 'motorNo', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none"
                                  required
                                />`;
const motorInputNew = `                                <div className="flex rounded-xl shadow-sm">
                                  {s1MotorPrefix && (
                                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-xs font-bold uppercase">
                                      {s1MotorPrefix}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    placeholder={\`MOTOR-\${5550 + idx}\`}
                                    value={scoot.motorNo}
                                    onChange={(e) => handleBulkScooterChange(idx, 'motorNo', e.target.value)}
                                    className={\`w-full bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none \${s1MotorPrefix ? 'rounded-r-xl' : 'rounded-xl'}\`}
                                    required
                                  />
                                </div>`;
content = content.replace(motorInputOriginal, motorInputNew);

const controllerInputOriginal = `                                <input
                                  type="text"
                                  placeholder={\`CTRL-\${9900 + idx}\`}
                                  value={scoot.controllerNo}
                                  onChange={(e) => handleBulkScooterChange(idx, 'controllerNo', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none"
                                  required
                                />`;
const controllerInputNew = `                                <div className="flex rounded-xl shadow-sm">
                                  {s1ControllerPrefix && (
                                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-xs font-bold uppercase">
                                      {s1ControllerPrefix}
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    placeholder={\`CTRL-\${9900 + idx}\`}
                                    value={scoot.controllerNo}
                                    onChange={(e) => handleBulkScooterChange(idx, 'controllerNo', e.target.value)}
                                    className={\`w-full bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-xs text-slate-800 font-sans uppercase focus:border-cyan-500 outline-none \${s1ControllerPrefix ? 'rounded-r-xl' : 'rounded-xl'}\`}
                                    required
                                  />
                                </div>`;
content = content.replace(controllerInputOriginal, controllerInputNew);

fs.writeFileSync('src/components/AssemblyPipeline.tsx', content);
console.log("Patched AssemblyPipeline.tsx");
