const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
"app.post('/api/drive/callback', async (req, res) => {",
`app.get('/api/drive/callback', async (req, res) => {
  const { code } = req.query;`
);

server = server.replace(
"    writeDB(db);\n    res.json({ success: true, email: db.driveConfig.connectedEmail });",
`    writeDB(db);\n    res.redirect('/?settings=backup');`
);

server = server.replace(
"    res.status(500).json({ error: error.message });\n  }\n});",
`    res.redirect('/?error=drive_auth_failed');\n  }\n});`
);

fs.writeFileSync('server.ts', server);
console.log('Fixed callback in server.ts');
