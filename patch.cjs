const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Patch 1: Add uploadToDrive into createBackupSnapshot
const target1 = `    fs.writeFileSync(filePath, JSON.stringify(snapshotPayload, null, 2), 'utf8');
    cleanupOldBackups();
    console.log(\`[Backup System] Created snapshot: \${filename}\`);

    return { filename, filePath };`;

const replacement1 = `    fs.writeFileSync(filePath, JSON.stringify(snapshotPayload, null, 2), 'utf8');
    cleanupOldBackups();
    console.log(\`[Backup System] Created snapshot: \${filename}\`);

    if (db.driveConfig?.autoSync && db.driveConfig?.refreshToken) {
      const stats = fs.statSync(filePath);
      const backupItem = {
        filename,
        createdTimestamp: now.toISOString(),
        sizeBytes: stats.size,
        isAuto,
        label: customLabel || (isAuto ? 'Automated Rolling Snapshot' : 'Manual User Snapshot'),
        counts: { scooterUnits: db.scooterUnits?.length || 0, salesOrders: db.salesOrders?.length || 0, buyers: db.buyers?.length || 0, products: db.products?.length || 0, warrantyClaims: db.warrantyClaims?.length || 0, batterySales: db.batterySales?.length || 0, chargerSales: db.chargerSales?.length || 0, stockLogs: db.stockLogs?.length || 0 }
      };
      
      // Fire and forget so we don't block synchronous callers
      uploadToDrive(db, backupItem, filePath).then(success => {
        if (success) console.log(\`[Backup System] Successfully synced \${filename} to Google Drive.\`);
        else console.warn(\`[Backup System] Failed to sync \${filename} to Google Drive.\`);
      }).catch(err => {
        console.error(\`[Backup System] Exception during Drive sync for \${filename}:\`, err);
      });
    }

    return { filename, filePath };`;

// Patch 2: Add setupBackgroundCron()
const target2 = `}

startServer();`;

const replacement2 = `}

let lastDailyCronDate = new Date().toDateString();
function setupBackgroundCron() {
  setInterval(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = now.toDateString();
    
    // Check if it is 2 AM or later and we haven't fired today
    if (currentHour >= 2 && lastDailyCronDate !== currentDate) {
      console.log(\`[Cron] Triggering 2 AM Daily Background Backup...\`);
      lastDailyCronDate = currentDate;
      
      try {
        const db = readDB();
        if (db.driveConfig?.autoSync && db.driveConfig?.refreshToken) {
           createBackupSnapshot(db, true, 'Auto-2AM-Snapshot');
        }
      } catch (err) {
        console.error('[Cron] Error running daily background backup:', err);
      }
    }
  }, 60 * 1000); // Check every minute
}

setupBackgroundCron();
startServer();`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log("Patch 1 applied");
} else {
  console.log("Target 1 not found");
}

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log("Patch 2 applied");
} else {
  console.log("Target 2 not found");
}

fs.writeFileSync('server.ts', content);
