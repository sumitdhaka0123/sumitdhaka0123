const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');

const oldLogic = `    // Update items if provided
    if (items && Array.isArray(items)) {
      order.items = items.map((it: any) => ({
        id: it.id || \`soi-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
        itemType: it.itemType || 'scooter',
        productName: it.productName,
        color: it.color,
        batteryType: it.batteryType,
        chargerType: it.chargerType,
        quantity: Math.max(1, Number(it.quantity) || 1),
        chassisNumbers: Array.isArray(it.chassisNumbers) ? it.chassisNumbers.filter(Boolean) : [],
        serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers.filter(Boolean) : [],
        startNo: it.startNo || '',
        endNo: it.endNo || '',
        isUnderWarranty: Boolean(it.isUnderWarranty),
        warrantyMonths: Number(it.warrantyMonths) || 0
      }));
    }

    // If finalization requested or both challan and bill numbers are being set`;

const newLogic = `    // Find old chassis numbers to revert if they are removed
    const oldChassis = [];
    if (order.items) {
      order.items.forEach(it => {
        if (it.itemType === 'scooter' && it.chassisNumbers) {
          oldChassis.push(...it.chassisNumbers.filter(Boolean));
        }
      });
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      order.items = items.map((it: any) => ({
        id: it.id || \`soi-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
        itemType: it.itemType || 'scooter',
        productName: it.productName,
        color: it.color,
        batteryType: it.batteryType,
        chargerType: it.chargerType,
        quantity: Math.max(1, Number(it.quantity) || 1),
        chassisNumbers: Array.isArray(it.chassisNumbers) ? it.chassisNumbers.filter(Boolean) : [],
        serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers.filter(Boolean) : [],
        startNo: it.startNo || '',
        endNo: it.endNo || '',
        isUnderWarranty: Boolean(it.isUnderWarranty),
        warrantyMonths: Number(it.warrantyMonths) || 0
      }));
    }

    const newChassis = [];
    if (order.items) {
      order.items.forEach(it => {
        if (it.itemType === 'scooter' && it.chassisNumbers) {
          newChassis.push(...it.chassisNumbers.filter(Boolean));
        }
      });
    }

    // Revert chassis that are no longer in the order
    const removedChassis = oldChassis.filter(c => !newChassis.includes(c));
    removedChassis.forEach(chassis => {
      const uIdx = db.scooterUnits.findIndex(u => u.chassisNo === chassis);
      if (uIdx !== -1) {
        db.scooterUnits[uIdx].status = 'available';
        db.scooterUnits[uIdx].buyerName = '';
        db.scooterUnits[uIdx].buyerContact = '';
        db.scooterUnits[uIdx].deliveryChallanNo = undefined;
        db.scooterUnits[uIdx].salesBillNo = undefined;
        db.scooterUnits[uIdx].challanStatus = undefined;
        db.scooterUnits[uIdx].saleDate = undefined;
      }
    });

    // If finalization requested or both challan and bill numbers are being set`;

server = server.replace(oldLogic, newLogic);
fs.writeFileSync('server.ts', server);
console.log('Patched manager-update in server.ts');
