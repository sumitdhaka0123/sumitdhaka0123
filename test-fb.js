import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function test() {
  try {
    console.log('Testing Firestore read...');
    const snap = await getDocs(collection(db, 'products'));
    console.log('Read success. Found ' + snap.size + ' documents.');
    
    console.log('Testing Firestore write...');
    await addDoc(collection(db, 'test_connection'), { time: new Date() });
    console.log('Write success.');
  } catch (err) {
    console.error('Firestore Error:', err);
  }
}
test();
