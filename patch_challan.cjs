const fs = require('fs');
let code = fs.readFileSync('src/components/ChallanManager.tsx', 'utf8');

code = code.replace(
"function salesOrderToGroupedChallan(order: SalesOrder): GroupedChallan {",
"function salesOrderToGroupedChallan(order: SalesOrder, allScooters: ScooterUnit[] = []): GroupedChallan {"
);

const oldScooterPush = `        scooters.push({
          id: \`\${order.id}-scoot-\${i}\`,
          modelName: it.productName || 'Scooter',
          color: it.color || 'Standard',
          chassisNo: chassis,
          motorNo: 'N/A',
          controllerNo: 'N/A',
          tireSize: '10-inch',
          batterySerials: it.serialNumbers || [],
          status: order.status === 'challan_generated' ? 'sold' : 'hold',
          scooterWarrantyStatus: 'None',
          batteryWarrantyStatus: 'None',
          buyerName: order.buyerName,
          buyerContact: order.buyerContact,
          deliveryChallanNo: order.challanNo,
          salesBillNo: order.salesBillNo,
          createdOperator: order.salespersonName || 'sales',
          createdTimestamp: order.createdTimestamp,
          lastUpdatedTimestamp: order.createdTimestamp
        });`;

const newScooterPush = `        const realScooter = allScooters.find(u => u.chassisNo === chassis);
        scooters.push({
          id: \`\${order.id}-scoot-\${i}\`,
          modelName: it.productName || 'Scooter',
          color: it.color || 'Standard',
          chassisNo: chassis,
          motorNo: realScooter?.motorNo || 'N/A',
          controllerNo: realScooter?.controllerNo || 'N/A',
          tireSize: realScooter?.tireSize || '10-inch',
          batterySerials: realScooter?.batterySerials?.length ? realScooter.batterySerials : (it.serialNumbers || []),
          status: order.status === 'challan_generated' ? 'sold' : 'hold',
          scooterWarrantyStatus: realScooter?.scooterWarrantyStatus || 'None',
          batteryWarrantyStatus: realScooter?.batteryWarrantyStatus || 'None',
          buyerName: order.buyerName,
          buyerContact: order.buyerContact,
          deliveryChallanNo: order.challanNo,
          salesBillNo: order.salesBillNo,
          createdOperator: order.salespersonName || 'sales',
          createdTimestamp: order.createdTimestamp,
          lastUpdatedTimestamp: order.createdTimestamp
        });`;
        
code = code.replace(oldScooterPush, newScooterPush);

code = code.replace(
"        groupedRepresentation: salesOrderToGroupedChallan(order)",
"        groupedRepresentation: salesOrderToGroupedChallan(order, scooterUnits)"
);

fs.writeFileSync('src/components/ChallanManager.tsx', code);
console.log('Patched ChallanManager.tsx');
