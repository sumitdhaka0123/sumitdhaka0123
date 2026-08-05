const fs = require('fs');
const crypto = require('crypto');
let server = fs.readFileSync('server.ts', 'utf8');

if (!server.includes("import * as crypto")) {
  server = server.replace("import { z } from 'zod';", "import { z } from 'zod';\nimport * as crypto from 'crypto';");
}

if (!server.includes("function hashPassword")) {
  const hashFunc = `
function hashPassword(password: string): string {
  if (!password) return '';
  // If it's already a 64-char hex string (sha256 hash), don't double hash it (for migration)
  if (/^[a-f0-9]{64}$/.test(password)) return password;
  return crypto.createHash('sha256').update(password).digest('hex');
}
`;
  server = server.replace("const app = express();", hashFunc + "\nconst app = express();");
}

// 1. Hash the default users
server = server.replace(/passwordHash: 'admin123'/g, "passwordHash: hashPassword('admin123')");
server = server.replace(/passwordHash: 'manager123'/g, "passwordHash: hashPassword('manager123')");
server = server.replace(/passwordHash: 'manu123'/g, "passwordHash: hashPassword('manu123')");
server = server.replace(/passwordHash: 'sales123'/g, "passwordHash: hashPassword('sales123')");
server = server.replace(/passwordHash: 'dispatch123'/g, "passwordHash: hashPassword('dispatch123')");

// 2. Hash on login
const oldLoginCheck = `    if (user.passwordHash !== password) {
      // Record failed attempt to trigger/increase exponential backoff
      recordAuthFailure(normalizedUserKey);
      const record = authAccountTracker.get(normalizedUserKey)!;
      const power = Math.max(0, record.failedCount - 1);
      const nextDelayMs = Math.min(AUTH_MAX_BACKOFF_MS, AUTH_BACKOFF_BASE_MS * Math.pow(AUTH_BACKOFF_FACTOR, power));
      const nextDelaySecs = Math.ceil(nextDelayMs / 1000);
      const errorMsg = \`Invalid username or password. Due to consecutive failed attempts, your next login attempt will be delayed by \${nextDelaySecs} seconds.\`;

      addAuditLog(db, user.username, user.name, 'login_failed_wrong_password', \`Wrong password attempt. Successive failed count is now \${record.failedCount}.\`);
      
      // Update failedAttempts to align with backoff tracker count
      user.failedAttempts = record.failedCount;
      db.users[normalizedUserKey] = user;
      writeDB(db);

      return res.status(401).json({ error: errorMsg });
    }`;

const newLoginCheck = `    if (user.passwordHash !== hashPassword(password) && user.passwordHash !== password) {
      // Record failed attempt to trigger/increase exponential backoff
      recordAuthFailure(normalizedUserKey);
      const record = authAccountTracker.get(normalizedUserKey)!;
      
      user.failedAttempts = record.failedCount;
      
      if (record.failedCount >= 3) {
        user.locked = true;
        db.users[normalizedUserKey] = user;
        addAuditLog(db, user.username, user.name, 'account_locked', \`Account locked due to 3 failed login attempts.\`);
        writeDB(db);
        return res.status(401).json({ error: 'This account has been locked due to 3 failed login attempts. Please contact the warehouse owner to unlock it.' });
      }

      const power = Math.max(0, record.failedCount - 1);
      const nextDelayMs = Math.min(AUTH_MAX_BACKOFF_MS, AUTH_BACKOFF_BASE_MS * Math.pow(AUTH_BACKOFF_FACTOR, power));
      const nextDelaySecs = Math.ceil(nextDelayMs / 1000);
      const errorMsg = \`Invalid username or password. Due to consecutive failed attempts, your next login attempt will be delayed by \${nextDelaySecs} seconds.\`;

      addAuditLog(db, user.username, user.name, 'login_failed_wrong_password', \`Wrong password attempt. Successive failed count is now \${record.failedCount}.\`);
      
      db.users[normalizedUserKey] = user;
      writeDB(db);

      return res.status(401).json({ error: errorMsg });
    }`;

server = server.replace(oldLoginCheck, newLoginCheck);

// 3. Hash on register
server = server.replace(
  "passwordHash: password,",
  "passwordHash: hashPassword(password),"
);

// 4. Hash on update
server = server.replace(
  "updatedUser.passwordHash = password;",
  "updatedUser.passwordHash = hashPassword(password);"
);

fs.writeFileSync('server.ts', server);
console.log('Patched auth in server.ts');
