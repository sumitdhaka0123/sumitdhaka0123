const fs = require('fs');

// Patch server.ts
const serverFile = 'C:\\Users\\shakti\\Documents\\GitHub\\sumitdhaka0123\\server.ts';
let serverCode = fs.readFileSync(serverFile, 'utf8');

const versionEndpoint = `
app.get('/api/version', (req, res) => {
  // When you build a new APK, change the version here and upload the new app-release.apk to Render
  res.json({
    version: "1.0.1",
    apkUrl: "https://sumitdhaka0123.onrender.com/app-release.apk"
  });
});
`;

if (!serverCode.includes('/api/version')) {
  serverCode = serverCode.replace(/app\.get\('\*', \(req, res\) => \{/, versionEndpoint + '\n    app.get(\'*\', (req, res) => {');
  fs.writeFileSync(serverFile, serverCode);
  console.log('Server patched for versioning!');
}

// Patch App.tsx
const appFile = 'C:\\Users\\shakti\\Documents\\GitHub\\sumitdhaka0123\\src\\App.tsx';
let appCode = fs.readFileSync(appFile, 'utf8');

if (!appCode.includes('import { AutoUpdater }')) {
  appCode = appCode.replace(/import React[^;]+;/g, `$&
import { AutoUpdater } from './components/AutoUpdater';`);
}

if (!appCode.includes('<AutoUpdater />')) {
  // Insert AutoUpdater just inside the main div or routing wrapper
  // We'll put it right after <div className="min-h-screen
  appCode = appCode.replace(/(<div className="min-h-screen[^>]*>)/, `$1\n      <AutoUpdater />`);
  fs.writeFileSync(appFile, appCode);
  console.log('App patched for AutoUpdater!');
}
