const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

const backupTarget = `
// 2. POST /api/backups/create - Create an instant manual snapshot right now
app.post('/api/backups/create', (req, res) => {
  try {
    const { operator, label } = req.body || {};
    const db = readDB();
    const result = createBackupSnapshot(db, false, label || 'Manual User Snapshot');
    addAuditLog(db, operator || 'user', operator || 'User', 'backup_created', \`Created manual system backup snapshot: \${result.filename}\`);
    writeDB(db);
    
    // Auto-sync to Drive if configured
    if (db.driveConfig?.autoSync && db.driveConfig?.refreshToken) {
      const backupPath = path.join(process.cwd(), 'backups', result.filename);
      uploadToDrive(db, result, backupPath).catch(e => console.error('Auto Drive Sync Error:', e));
    }
    
    res.json({ success: true, message: 'Backup snapshot created successfully!', filename: result.filename });
  } catch (err: any) {
`;

server = server.replace(/\/\/ 2\. POST \/api\/backups\/create - Create an instant manual snapshot right now[\s\S]*?catch \(err: any\) \{/, backupTarget);
fs.writeFileSync('server.ts', server);
