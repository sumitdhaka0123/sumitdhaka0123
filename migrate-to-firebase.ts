import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, writeBatch } from 'firebase/firestore/lite';

const DB_FILE = path.join(process.cwd(), 'warehouse_db.json');
const FIREBASE_CONFIG = path.join(process.cwd(), 'firebase-applet-config.json');

async function migrate() {
  if (!fs.existsSync(DB_FILE)) {
    console.error("warehouse_db.json not found!");
    process.exit(1);
  }
  if (!fs.existsSync(FIREBASE_CONFIG)) {
    console.error("firebase-applet-config.json not found!");
    process.exit(1);
  }

  const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const config = JSON.parse(fs.readFileSync(FIREBASE_CONFIG, 'utf8'));

  const firebaseApp = initializeApp(config);
  const firebaseDb = getFirestore(firebaseApp);
  console.log("Connected to Firebase.");

  async function pushCollection(collName: string, items: any[]) {
    if (!items || items.length === 0) return;
    console.log(`Pushing ${items.length} items to collection '${collName}'...`);
    
    let batch = writeBatch(firebaseDb);
    let count = 0;
    let total = 0;

    for (const item of items) {
      if (!item.id) continue;
      const docRef = doc(firebaseDb, collName, item.id);
      batch.set(docRef, item, { merge: true });
      count++;
      total++;
      if (count >= 400) {
        await batch.commit();
        console.log(`  Committed ${total} / ${items.length}`);
        batch = writeBatch(firebaseDb);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`  Committed ${total} / ${items.length}`);
    }
  }

  // Push users
  if (dbData.users) {
    const userKeys = Object.keys(dbData.users);
    console.log(`Pushing ${userKeys.length} users to 'users'...`);
    let batch = writeBatch(firebaseDb);
    let count = 0;
    for (const username of userKeys) {
      const u = dbData.users[username];
      const docRef = doc(firebaseDb, 'users', username.toLowerCase());
      batch.set(docRef, u, { merge: true });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(firebaseDb);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  }

  // Arrays
  const collections = [
    { name: 'products', data: dbData.products },
    { name: 'buyers', data: dbData.buyers },
    { name: 'scooterUnits', data: dbData.scooterUnits },
    { name: 'stockLogs', data: dbData.stockLogs },
    { name: 'batterySales', data: dbData.batterySales },
    { name: 'batteryImports', data: dbData.batteryImports },
    { name: 'chargerSales', data: dbData.chargerSales },
    { name: 'chargerImports', data: dbData.chargerImports },
    { name: 'auditLogs', data: dbData.auditLogs },
    { name: 'warrantyClaims', data: dbData.warrantyClaims },
    { name: 'salesOrders', data: dbData.salesOrders }
  ];

  for (const c of collections) {
    await pushCollection(c.name, c.data || []);
  }

  console.log("Migration Complete! All data uploaded to Firestore.");
}

migrate().catch(console.error);
