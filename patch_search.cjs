const fs = require('fs');
let content = fs.readFileSync('src/components/SearchConsole.tsx', 'utf8');

// 1. Group by billNo needs supplierName
content = content.replace(
  "operator: string;",
  "operator: string;\n        supplierName: string;"
);

// 2. Set supplierName when creating stockInGroup
content = content.replace(
  "dateLogged: log.timestamp,",
  "dateLogged: log.timestamp,\n            supplierName: log.supplierName || 'Unknown',"
);

// 3. Search filter matching
content = content.replace(
  "return b.billNo.includes(q)",
  "return b.billNo.includes(q) || b.stockInList.some(s => s.supplierName.toUpperCase().includes(q))"
);

// 4. UI Display for Supplier Name inside the Bill Card
const uiTarget = `<div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200 font-mono">
                          {b.stockInList.length} Stock IN / Invoices
                        </span>`;
const uiReplacement = `<div className="flex items-center gap-2 text-xs">
                        {b.stockInList[0]?.supplierName && b.stockInList[0].supplierName !== 'Unknown' && (
                          <span className="font-bold text-slate-700 bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-200 font-sans">
                            {b.stockInList[0].supplierName}
                          </span>
                        )}
                        <span className="font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200 font-mono">
                          {b.stockInList.length} Stock IN / Invoices
                        </span>`;
if (content.includes(uiTarget)) {
  content = content.replace(uiTarget, uiReplacement);
  console.log("Patched SearchConsole UI");
} else {
  console.log("Failed to patch SearchConsole UI");
}

fs.writeFileSync('src/components/SearchConsole.tsx', content);
console.log("Patched SearchConsole.tsx");
