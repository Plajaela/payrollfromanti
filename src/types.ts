export interface Adjustment {
  id: string;
  type: 'add' | 'deduct';
  amount: number;
  note: string;
  receiptUrl?: string;
}

export interface Worker {
  id: string;
  name: string;
  baseWage: number;
  defaultTravelAllowance: number;
  shiftStart: string;
  shiftEnd: string;
  paymentType?: 'half-month' | 'month' | 'day';
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
  transferSlipUrl?: string;
  tollReceiptUrl?: string;
}
