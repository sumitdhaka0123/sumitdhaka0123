export interface ChallanInfoResult {
  exists: boolean;
  isFinished: boolean;
  cleanNo: string;
  scooterCount: number;
  batteryCount: number;
  chargerCount: number;
  totalCount: number;
  buyerName: string;
  buyerContact: string;
  billNo: string;
  createdBy: string;
  scooters: any[];
  batteries: any[];
  chargers: any[];
}

export function inspectChallanNumber(
  challanNo: string,
  scooterUnits: any[] = [],
  batterySales: any[] = [],
  chargerSales: any[] = []
): ChallanInfoResult {
  const clean = String(challanNo || '').trim().toUpperCase();
  if (!clean) {
    return {
      exists: false,
      isFinished: false,
      cleanNo: '',
      scooterCount: 0,
      batteryCount: 0,
      chargerCount: 0,
      totalCount: 0,
      buyerName: '',
      buyerContact: '',
      billNo: '',
      createdBy: '',
      scooters: [],
      batteries: [],
      chargers: []
    };
  }

  const scooters = (scooterUnits || []).filter(
    u => u.deliveryChallanNo && String(u.deliveryChallanNo).trim().toUpperCase() === clean
  );
  const batteries = (batterySales || []).filter(
    b => b.deliveryChallanNo && String(b.deliveryChallanNo).trim().toUpperCase() === clean
  );
  const chargers = (chargerSales || []).filter(
    c => c.deliveryChallanNo && String(c.deliveryChallanNo).trim().toUpperCase() === clean
  );

  const standaloneBatteryCount = batteries.reduce((acc, b) => acc + (Number(b.quantity) || 1), 0);
  const scooterBatteryCount = scooters.reduce((acc, s) => acc + (Array.isArray(s.batterySerials) ? s.batterySerials.length : (s.batterySerial ? 1 : 0)), 0);
  const batteryCount = standaloneBatteryCount + scooterBatteryCount;
  const chargerCount = chargers.reduce((acc, c) => acc + (Number(c.quantity) || 1), 0);
  const totalCount = scooters.length + batteryCount + chargerCount;

  if (totalCount === 0) {
    return {
      exists: false,
      isFinished: false,
      cleanNo: clean,
      scooterCount: 0,
      batteryCount: 0,
      chargerCount: 0,
      totalCount: 0,
      buyerName: '',
      buyerContact: '',
      billNo: '',
      createdBy: '',
      scooters: [],
      batteries: [],
      chargers: []
    };
  }

  const isFinished =
    scooters.some(s => s.challanStatus === 'finished') ||
    batteries.some(b => b.challanStatus === 'finished') ||
    chargers.some(c => c.challanStatus === 'finished');

  const firstItem = scooters[0] || batteries[0] || chargers[0];
  const buyerName = firstItem?.buyerName || firstItem?.heldFor || '';
  const buyerContact = firstItem?.buyerContact || '';
  const billNo = firstItem?.salesBillNo || firstItem?.billNo || '';
  const createdBy = firstItem?.soldBy || firstItem?.lastUpdatedBy || firstItem?.operator || firstItem?.assemblerName || '';

  return {
    exists: true,
    isFinished,
    cleanNo: clean,
    scooterCount: scooters.length,
    batteryCount,
    chargerCount,
    totalCount,
    buyerName,
    buyerContact,
    billNo,
    createdBy,
    scooters,
    batteries,
    chargers
  };
}

export function isChallanRestrictedForUser(info: ChallanInfoResult, currentUser?: any): boolean {
  if (!info || !info.exists || info.isFinished || !currentUser) return false;
  const role = (currentUser.role || '').toLowerCase();
  if (role === 'admin' || role === 'manager') return false;
  if (!info.createdBy) return false;
  const currentUserName = (currentUser.name || '').trim().toLowerCase();
  const currentUserUsername = (currentUser.username || '').trim().toLowerCase();
  const creator = info.createdBy.trim().toLowerCase();
  if (creator === currentUserName || creator === currentUserUsername) return false;
  return true;
}
