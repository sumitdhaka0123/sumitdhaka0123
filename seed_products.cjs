const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCdwa6qFipM-4S3lx1DptvZeBc711IT-uQ",
  authDomain: "senzo-electric-sndia.firebaseapp.com",
  projectId: "senzo-electric-sndia",
  storageBucket: "senzo-electric-sndia.firebasestorage.app",
  messagingSenderId: "511120877886",
  appId: "1:511120877886:web:744c8f30689d65a123a46f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedProducts() {
  const dbPath = 'C:\\Users\\shakti\\Documents\\GitHub\\sumitdhaka0123\\warehouse_db.json';
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const products = data.products || [];

  if (products.length === 0) {
    console.log("No products found in local JSON.");
    process.exit(1);
  }

  console.log(`Uploading ${products.length} products to Firebase...`);
  const promises = [];
  
  for (const prod of products) {
    promises.push(setDoc(doc(db, 'products', prod.id), prod));
  }
  
  await Promise.all(promises);
  console.log("Successfully uploaded products to Firebase!");
}

seedProducts().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
