import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function test() {
  const snap = await getDocs(collection(db, 'scooterUnits'));
  console.log('scooterUnits in Firebase: ' + snap.size);
  snap.forEach(d => {
    const data = d.data();
    console.log(' - ' + data.chassisNo + ' | ' + data.modelName);
  });
}
test();
