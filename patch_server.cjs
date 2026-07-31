const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

if (!server.includes("import { google } from 'googleapis';")) {
  server = server.replace("import express from 'express';", "import express from 'express';\nimport { google } from 'googleapis';");
}

if (!server.includes('driveConfig: {')) {
  server = server.replace("sheetConfig: state.sheetConfig || { webhookUrl: '', enabled: false },", 
`sheetConfig: state.sheetConfig || { webhookUrl: '', enabled: false },
      driveConfig: state.driveConfig || { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' },`);
      
  server = server.replace("sheetConfig: { webhookUrl: '', enabled: false },", 
`sheetConfig: { webhookUrl: '', enabled: false },
      driveConfig: { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' },`);
}

if (!server.includes('app.get(\'/api/drive-config\'')) {
  const routes = `
// ==========================================
// GOOGLE DRIVE CLOUD BACKUP ROUTES
// ==========================================

const getDriveAuth = (db) => {
  const config = db.driveConfig || {};
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    (process.env.APP_URL || 'http://localhost:3000') + '/api/drive/callback'
  );
};

app.get('/api/drive-config', (req, res) => {
  const db = readDB();
  const config = db.driveConfig || { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' };
  res.json({
    clientId: config.clientId,
    connectedEmail: config.connectedEmail,
    autoSync: config.autoSync
  });
});

app.post('/api/drive-config', (req, res) => {
  const db = readDB();
  const { clientId, clientSecret, autoSync } = req.body;
  if (!db.driveConfig) db.driveConfig = { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' };
  
  if (clientId !== undefined) db.driveConfig.clientId = clientId.trim();
  if (clientSecret !== undefined) db.driveConfig.clientSecret = clientSecret.trim();
  if (autoSync !== undefined) db.driveConfig.autoSync = !!autoSync;
  
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/drive/auth-url', (req, res) => {
  const db = readDB();
  if (!db.driveConfig?.clientId || !db.driveConfig?.clientSecret) {
    return res.status(400).json({ error: 'Please configure Google OAuth Client ID and Secret first.' });
  }
  const oauth2Client = getDriveAuth(db);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email']
  });
  res.json({ url });
});

app.post('/api/drive/callback', async (req, res) => {
  const { code } = req.body;
  const db = readDB();
  try {
    const oauth2Client = getDriveAuth(db);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    
    if (!db.driveConfig) db.driveConfig = { clientId: '', clientSecret: '', refreshToken: '', connectedEmail: '', autoSync: false, folderId: '' };
    db.driveConfig.refreshToken = tokens.refresh_token || db.driveConfig.refreshToken;
    db.driveConfig.connectedEmail = userInfo.data.email || 'Unknown Email';
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const q = "mimeType='application/vnd.google-apps.folder' and name='Inventory_Database_Backups' and trashed=false";
    const { data: { files } } = await drive.files.list({ q, fields: 'files(id, name)' });
    
    if (files && files.length > 0) {
      db.driveConfig.folderId = files[0].id;
    } else {
      const folderMetadata = { name: 'Inventory_Database_Backups', mimeType: 'application/vnd.google-apps.folder' };
      const folder = await drive.files.create({ resource: folderMetadata, fields: 'id' });
      db.driveConfig.folderId = folder.data.id;
    }
    
    writeDB(db);
    res.json({ success: true, email: db.driveConfig.connectedEmail });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/drive/disconnect', (req, res) => {
  const db = readDB();
  if (db.driveConfig) {
    db.driveConfig.refreshToken = '';
    db.driveConfig.connectedEmail = '';
    writeDB(db);
  }
  res.json({ success: true });
});

async function uploadToDrive(db, backupItem, filePath) {
  if (!db.driveConfig?.refreshToken || !db.driveConfig?.folderId) return false;
  try {
    const oauth2Client = getDriveAuth(db);
    oauth2Client.setCredentials({ refresh_token: db.driveConfig.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const fileMetadata = { name: backupItem.filename, parents: [db.driveConfig.folderId] };
    const media = { mimeType: 'application/json', body: fs.createReadStream(filePath) };
    
    await drive.files.create({ resource: fileMetadata, media: media, fields: 'id' });
    return true;
  } catch (error) {
    console.error('Drive Upload Error:', error);
    return false;
  }
}

// Modify existing create backup to hook into uploadToDrive if autoSync is enabled
app.post('/api/backups/drive/sync', async (req, res) => {
  const db = readDB();
  if (!db.driveConfig?.refreshToken) return res.status(400).json({ error: 'Google Drive is not connected.' });
  
  const timestamp = new Date();
  const safeDateString = timestamp.toISOString().replace(/[:.]/g, '-');
  const filename = \`backup-manual-\${safeDateString}.json\`;
  const backupPath = path.join(process.cwd(), 'backups', filename);
  
  if (!fs.existsSync(path.join(process.cwd(), 'backups'))) fs.mkdirSync(path.join(process.cwd(), 'backups'), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf8');
  
  const stats = fs.statSync(backupPath);
  const backupItem = {
    filename,
    createdTimestamp: timestamp.toISOString(),
    sizeBytes: stats.size,
    isAuto: false,
    label: 'Manual Drive Sync',
    counts: { scooterUnits: db.scooterUnits?.length || 0, salesOrders: db.salesOrders?.length || 0, buyers: db.buyers?.length || 0, products: db.products?.length || 0, warrantyClaims: db.warrantyClaims?.length || 0, batterySales: db.batterySales?.length || 0, chargerSales: db.chargerSales?.length || 0, stockLogs: db.stockLogs?.length || 0 }
  };
  
  const success = await uploadToDrive(db, backupItem, backupPath);
  if (success) {
    res.json({ success: true, message: 'Snapshot created and synced to Google Drive.' });
  } else {
    res.status(500).json({ error: 'Failed to upload to Google Drive.' });
  }
});

app.get('/api/backups/drive/list', async (req, res) => {
  const db = readDB();
  if (!db.driveConfig?.refreshToken || !db.driveConfig?.folderId) return res.status(400).json({ error: 'Google Drive is not connected.' });
  
  try {
    const oauth2Client = getDriveAuth(db);
    oauth2Client.setCredentials({ refresh_token: db.driveConfig.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      q: \`'\${db.driveConfig.folderId}' in parents and trashed=false\`,
      fields: 'files(id, name, createdTime, size, webViewLink)',
      orderBy: 'createdTime desc'
    });
    
    res.json({ files: response.data.files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backups/drive/restore', async (req, res) => {
  const { fileId } = req.body;
  const db = readDB();
  
  if (!db.driveConfig?.refreshToken) return res.status(400).json({ error: 'Google Drive is not connected.' });
  
  try {
    const oauth2Client = getDriveAuth(db);
    oauth2Client.setCredentials({ refresh_token: db.driveConfig.refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const timestamp = new Date();
    const safeDateString = timestamp.toISOString().replace(/[:.]/g, '-');
    const safetyFilename = \`backup-safety-pre-restore-\${safeDateString}.json\`;
    const safetyPath = path.join(process.cwd(), 'backups', safetyFilename);
    if (!fs.existsSync(path.join(process.cwd(), 'backups'))) fs.mkdirSync(path.join(process.cwd(), 'backups'), { recursive: true });
    fs.writeFileSync(safetyPath, JSON.stringify(db, null, 2), 'utf8');
    
    const response = await drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' });
    
    let dbData = '';
    response.data.on('data', chunk => dbData += chunk);
    response.data.on('end', () => {
      try {
        const parsed = JSON.parse(dbData);
        parsed.driveConfig = db.driveConfig;
        parsed.sheetConfig = db.sheetConfig;
        writeDB(parsed);
        res.json({ success: true, message: 'Database successfully restored from Google Drive.' });
      } catch (e) {
        res.status(500).json({ error: 'Downloaded file was not valid JSON.' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

  if (process.env.NODE_ENV !== 'production') {
`;
  server = server.replace("  if (process.env.NODE_ENV !== 'production') {", routes);
}
fs.writeFileSync('server.ts', server);
console.log('Patched server.ts');
