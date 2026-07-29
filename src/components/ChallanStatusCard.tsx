import React from 'react';
import { Lock, AlertCircle, CheckCircle2, ClipboardList, User, FileText, Package, ShieldAlert } from 'lucide-react';
import { ChallanInfoResult, isChallanRestrictedForUser } from '../utils/challanUtils';

interface ChallanStatusCardProps {
  info: ChallanInfoResult;
  currentUser?: any;
}

export const ChallanStatusCard: React.FC<ChallanStatusCardProps> = ({ info, currentUser }) => {
  if (!info.cleanNo) return null;

  if (info.isFinished) {
    return (
      <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-sans space-y-1 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-rose-700">
          <Lock className="h-4 w-4 text-rose-600 shrink-0" />
          <span>⛔ Delivery Challan #{info.cleanNo} is FINISHED &amp; VERIFIED!</span>
        </div>
        <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
          This challan is locked and closed. You <strong>CANNOT</strong> attach new items or reuse this challan number. Please enter a <strong>NEW, unique Delivery Challan Number</strong>.
        </p>
      </div>
    );
  }

  const isRestricted = isChallanRestrictedForUser(info, currentUser);

  if (info.exists) {
    return (
      <div className={`mt-2 p-3 border rounded-xl font-sans space-y-1.5 text-xs shadow-xs ${
        isRestricted ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
      }`}>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 font-bold ${isRestricted ? 'text-amber-800' : 'text-cyan-800'}`}>
            {isRestricted ? <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" /> : <ClipboardList className="h-4 w-4 text-cyan-600 shrink-0" />}
            <span>📋 Existing Pending Delivery Challan Found: #{info.cleanNo}</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
            isRestricted ? 'bg-amber-200 text-amber-900' : 'bg-cyan-200 text-cyan-900'
          }`}>
            {isRestricted ? 'Restricted' : 'Pending Stage'}
          </span>
        </div>

        {isRestricted && (
          <div className="p-2 bg-amber-100/80 border border-amber-300 rounded-lg text-[11px] font-bold text-amber-950 space-y-0.5">
            <p>⚠️ Created by Salesperson: <strong>{info.createdBy}</strong></p>
            <p className="font-normal text-[10px] text-amber-800">
              Only <strong>{info.createdBy}</strong>, Managers, or Admins can attach new items to this Delivery Challan.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/80 p-2 rounded-lg border border-slate-200 text-[11px]">
          {info.buyerName && (
            <div className="flex items-center gap-1 text-slate-700">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              <span>Buyer: <strong className="text-slate-900">{info.buyerName}</strong></span>
            </div>
          )}
          {info.billNo && (
            <div className="flex items-center gap-1 text-slate-700">
              <FileText className="h-3.5 w-3.5 text-cyan-600" />
              <span>Bill No: <strong className="text-slate-900">{info.billNo}</strong></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
          <Package className="h-3.5 w-3.5 text-cyan-600" />
          <span>
            Current Items inside #{info.cleanNo}: {' '}
            <strong className="text-slate-900">
              {info.scooterCount} Scooter(s), {info.batteryCount} Battery Pack(s), {info.chargerCount} Charger(s)
            </strong>
          </span>
        </div>

        {!isRestricted && (
          <p className="text-[10px] text-cyan-700 italic font-medium">
            ✅ Buyer details &amp; Bill Number auto-filled. Newly dispatched items will be appended into this Delivery Challan.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-sans flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 font-bold">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>✨ New Unique Delivery Challan: #{info.cleanNo}</span>
      </div>
      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
        Available
      </span>
    </div>
  );
};
