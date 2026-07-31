const fs = require('fs');
const appFile = 'C:\\Users\\shakti\\Documents\\GitHub\\sumitdhaka0123\\src\\App.tsx';
let appCode = fs.readFileSync(appFile, 'utf8');

// Add the MapPin icon to the imports
if (!appCode.includes('MapPin')) {
  appCode = appCode.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, MapPin, X } from 'lucide-react';");
}

// Add state
if (!appCode.includes('const [showAttendance, setShowAttendance]')) {
  appCode = appCode.replace(/const \[loading, setLoading\] = useState\(false\);/, "const [loading, setLoading] = useState(false);\n  const [showAttendance, setShowAttendance] = useState(false);");
}

// Add button to header (before refresh button)
const buttonHTML = `
              <button
                onClick={() => setShowAttendance(true)}
                title="Open Location & Attendance"
                className="p-2 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl cursor-pointer transition-colors"
              >
                <MapPin className="h-4 w-4" />
              </button>
`;
if (!appCode.includes('Open Location & Attendance')) {
  appCode = appCode.replace(/(<button[^>]+onClick=\{fetchAllData\}[^>]+>)/, buttonHTML + '\n              $1');
}

// Add the modal at the very end of App component, right before return ( ... ) but inside the outer div or right before the closing main div.
// Wait, we can put it right before the { /* --- SCOOTER UNIT SPECIFICATION MODAL --- */ }
const modalHTML = `
        {/* --- ATTENDANCE & TRACKING MODAL --- */}
        <AnimatePresence>
          {showAttendance && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-transparent max-w-6xl w-full"
              >
                <button
                  onClick={() => setShowAttendance(false)}
                  className="absolute -top-12 right-0 p-2 text-white hover:text-rose-400 bg-white/10 rounded-full"
                >
                  <X size={24} />
                </button>
                {currentUser.role === 'admin' ? (
                  <AdminAttendanceMap />
                ) : (
                  <AttendanceScreen currentUser={currentUser} />
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
`;

if (!appCode.includes('ATTENDANCE & TRACKING MODAL')) {
  appCode = appCode.replace(/\{\/\* --- SCOOTER UNIT SPECIFICATION MODAL --- \*\/\}/, modalHTML + '\n        {/* --- SCOOTER UNIT SPECIFICATION MODAL --- */}');
  fs.writeFileSync(appFile, appCode);
  console.log('UI Patched!');
} else {
  console.log('UI already patched.');
}
