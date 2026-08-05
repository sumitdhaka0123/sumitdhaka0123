const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  "<ChallanManager\n                scooterUnits={scooterUnits}",
  "<ChallanManager\n                products={products}\n                scooterUnits={scooterUnits}"
);
fs.writeFileSync('src/App.tsx', app);

let challan = fs.readFileSync('src/components/ChallanManager.tsx', 'utf8');
challan = challan.replace(
  "interface ChallanManagerProps {",
  "interface ChallanManagerProps {\n  products: Product[];"
);
challan = challan.replace(
  "  salesOrders = [],\n  onRefresh\n}) => {",
  "  salesOrders = [],\n  products = [],\n  onRefresh\n}) => {"
);
fs.writeFileSync('src/components/ChallanManager.tsx', challan);
