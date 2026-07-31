const fs = require('fs');
const appFile = 'C:\\Users\\shakti\\Documents\\GitHub\\sumitdhaka0123\\src\\App.tsx';
let code = fs.readFileSync(appFile, 'utf8');

// Add imports
if (!code.includes('import { AttendanceScreen }')) {
  code = code.replace(/import React[^;]+;/g, `$&
import { AttendanceScreen } from './components/AttendanceScreen';
import { AdminAttendanceMap } from './components/AdminAttendanceMap';`);
}

// Add state for active tab if it's admin or salesperson
// Wait, to safely inject, I can just look for the sidebar menu arrays
// For Admin:
if (code.includes("{ id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' }")) {
  code = code.replace(/{ id: 'dashboard', icon: <LayoutDashboard size=\{20\} \/>, label: 'Dashboard' }/g, 
  `$&, { id: 'live_tracking', icon: <MapPin size={20} />, label: 'Live Tracking' }`);
}

// Render logic for Admin:
if (code.includes("activeAdminTab === 'dashboard' &&")) {
  code = code.replace(/\{activeAdminTab === 'dashboard' && \([^)]+\)\}/g, 
  `$&
  {activeAdminTab === 'live_tracking' && <AdminAttendanceMap />}
  `);
}

// For Salesperson/Manufacturer (Clock In):
if (code.includes("{ id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' }")) {
  // It's the same string for all roles usually, so let's check
}
// We'll just append it to the role tabs
code = code.replace(/(const (salespersonTabs|manufacturerTabs) = \[\s*\{[^\}]+\},)/g, `$1 { id: 'attendance', icon: <Clock size={20} />, label: 'Clock In' },`);

code = code.replace(/\{active(Salesperson|Manufacturer)Tab === 'dashboard' && \([^)]+\)\}/g, 
`$&
{active$1Tab === 'attendance' && <AttendanceScreen currentUser={currentUser} />}
`);

fs.writeFileSync(appFile, code);
console.log('App patched!');
