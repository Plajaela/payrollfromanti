export interface Adjustment {
  id: string;
  type: 'add' | 'deduct';
  amount: number;
  note: string;
  receiptUrl?: string;
}

export interface TollEntry {
  id: string;
  amount: number;
  receiptUrl?: string;
  date?: string;
}

export interface Worker {
  id: string;
  name: string;
  baseWage: number;
  defaultTravelAllowance: number;
  shiftStart: string;
  shiftEnd: string;
  paymentType?: 'half-month' | 'month' | 'day';
  hasGuarantee?: boolean;
  historicalGuarantee?: number;
}

export interface DailyEntry {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  clockIn: string;
  clockOut: string;
  baseWage: number;
  travelAllowance: number;
  tollFee: number;
  lateDeduction: number;
  overtimeHours: number;
  overtimeMinutes: number;
  overtimePay: number;
  adjustments: Adjustment[];
  totalPay: number;
  note: string;
  isDraft?: boolean;
  isLeave?: boolean;
  leaveType?: 'ลาป่วย' | 'ลากิจ' | 'ขาดงาน';
  leaveNote?: string;
  transferSlipUrl?: string;
  tollReceiptUrl?: string;
  tollDate?: string;
  tolls?: TollEntry[];
  guaranteeDeduction?: number;
}

export interface AdvancePayment {
  id: string;
  workerId: string;
  date: string;
  amount: number;
  type: 'borrow' | 'repay';
  note: string;
}
