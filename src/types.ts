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
  monthlyWage?: number;
  hasSocialSecurity?: boolean;
  hasGuarantee?: boolean;
  historicalGuarantee?: number;
  guaranteeLimit?: number;
  lateRateRule?: 'normal' | 'special';
  createdAt?: string;
  isResigned?: boolean;
  copyLanguage?: 'th' | 'en';
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
  leaveType?: 'ลาป่วย' | 'ลากิจ' | 'ขาดงาน' | 'ลาครึ่งวัน';
  leaveNote?: string;
  transferSlipUrl?: string; // Legacy
  transferSlips?: string[];
  tollReceiptUrl?: string;
  tollDate?: string;
  tolls?: TollEntry[];
  guaranteeDeduction?: number;
  lateRateRule?: 'normal' | 'special';
}

export interface AdvancePayment {
  id: string;
  workerId: string;
  date: string;
  amount: number;
  type: 'borrow' | 'repay' | 'guarantee_refund';
  note: string;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface SalaryHistory {
  id: string;
  workerId: string;
  oldBaseWage: number;
  newBaseWage: number;
  oldMonthlyWage: number;
  newMonthlyWage: number;
  changeType: 'base' | 'monthly' | 'both';
  createdAt: string;
}
