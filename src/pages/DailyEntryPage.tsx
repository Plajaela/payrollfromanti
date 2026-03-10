import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Label, Card, Modal } from '../components/ui';
import { format, addDays, subDays, isSunday, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, Trash2, Settings2, RefreshCw, Copy, Check, Paperclip, ImagePlus, X, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Adjustment } from '../types';
import { supabase } from '../lib/supabase';

const timeToMins = (time: string) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export function DailyEntryPage() {
  const { workers, entries, addEntry, updateEntry, deleteEntry } = useStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showShiftSettings, setShowShiftSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTabWorkerId, setActiveTabWorkerId] = useState<string | null>(null);
  const [showLalamoveCalc, setShowLalamoveCalc] = useState(false);
  const [lalamoveDist, setLalamoveDist] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Set default tab when workers change or active tab is not set
  useEffect(() => {
    if (workers.length > 0 && (!activeTabWorkerId || (activeTabWorkerId !== 'all' && !workers.find(w => w.id === activeTabWorkerId)))) {
      setActiveTabWorkerId('all');
    }
  }, [workers, activeTabWorkerId]);

  const [formData, setFormData] = useState({
    workerId: '',
    workerName: '',
    shiftStart: '07:00',
    shiftEnd: '16:00',
    clockIn: '07:00',
    clockOut: '16:00',
    baseWage: 0,
    travelAllowance: 0,
    tollFee: 0,
    lateDeduction: 0,
    overtimeHours: 0,
    overtimeMinutes: 0,
    adjustments: [] as Adjustment[],
    note: '',
    transferSlipUrl: '',
    tollReceiptUrl: '',
    tollDate: '',
    tolls: [] as { id: string; amount: number; receiptUrl?: string; date?: string; }[],
    isLeave: false,
    leaveType: 'ลากิจ' as 'ลาป่วย' | 'ลากิจ' | 'ขาดงาน',
    leaveNote: '',
    hasGuaranteeDeduction: false,
    guaranteeDeductionAmount: 100,
  });

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const entriesForDate = useMemo(() => {
    return entries.filter(e => e.date === dateStr);
  }, [entries, dateStr]);

  const totalPayForDay = entriesForDate.reduce((sum, e) => sum + e.totalPay, 0);

  const calculateTotal = () => {
    if (formData.isLeave) return 0;
    const otRatePerHour = 100;
    const otPay = (formData.overtimeHours * otRatePerHour) + (formData.overtimeMinutes / 60 * otRatePerHour);
    const adjustmentsTotal = formData.adjustments.reduce((sum, adj) => {
      return sum + (adj.type === 'add' ? Number(adj.amount) : -Number(adj.amount));
    }, 0);
    const tollTotal = formData.tolls.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const guaranteeDed = formData.hasGuaranteeDeduction ? formData.guaranteeDeductionAmount : 0;
    return formData.baseWage + formData.travelAllowance + tollTotal + otPay + adjustmentsTotal - formData.lateDeduction - guaranteeDed;
  };

  // Auto-calculate late deduction and overtime when times change
  useEffect(() => {
    if (!isModalOpen) return;

    const startMins = timeToMins(formData.shiftStart);
    let endMins = timeToMins(formData.shiftEnd);
    const inMins = timeToMins(formData.clockIn);
    let outMins = timeToMins(formData.clockOut);

    // Handle overnight shifts
    if (endMins < startMins) {
      endMins += 24 * 60;
    }
    if (outMins < inMins) {
      outMins += 24 * 60;
    }

    // Calculate late/early leave minutes
    let missingMins = 0;
    if (inMins > startMins) missingMins += (inMins - startMins);
    if (outMins < endMins) missingMins += (endMins - outMins);

    // Calculate deduction: 100 baht per hour late
    const deductionRatePerHour = 100;
    const deduction = Math.round((deductionRatePerHour / 60) * missingMins);

    // Calculate overtime minutes
    let otRawMins = 0;
    if (outMins > endMins) {
      otRawMins += (outMins - endMins);
    }
    if (inMins < startMins) {
      otRawMins += (startMins - inMins);
    }

    // Snap overtime to nearest 15 minutes (floor)
    const otSnappedMins = Math.floor(otRawMins / 15) * 15;
    const otHours = Math.floor(otSnappedMins / 60);
    const otMins = otSnappedMins % 60;

    setFormData(prev => {
      // Only update if values actually changed to prevent loops/unnecessary renders
      if (
        prev.lateDeduction === (deduction > 0 ? deduction : 0) &&
        prev.overtimeHours === otHours &&
        prev.overtimeMinutes === otMins
      ) {
        return prev;
      }
      return {
        ...prev,
        lateDeduction: deduction > 0 ? deduction : 0,
        overtimeHours: otHours,
        overtimeMinutes: otMins
      };
    });
  }, [formData.clockIn, formData.clockOut, formData.shiftStart, formData.shiftEnd, formData.baseWage, isModalOpen]);

  const resetToShiftTimes = () => {
    setFormData(prev => ({
      ...prev,
      clockIn: prev.shiftStart,
      clockOut: prev.shiftEnd
    }));
  };

  const openModal = (worker: any, existingEntry?: any) => {
    setShowShiftSettings(false);

    // Calculate current guarantee total
    const guaranteeTotal = (worker.historicalGuarantee || 0) + entries
      .filter(e => e.workerId === worker.id && !e.isDraft && (!existingEntry || e.id !== existingEntry.id))
      .reduce((sum, e) => sum + (e.guaranteeDeduction || 0), 0);

    const capRemaining = Math.max(0, 10000 - guaranteeTotal);

    if (existingEntry) {
      let editTolls = existingEntry.tolls || [];
      if (editTolls.length === 0 && existingEntry.tollFee > 0) {
        editTolls = [{
          id: uuidv4(),
          amount: existingEntry.tollFee,
          receiptUrl: existingEntry.tollReceiptUrl,
          date: existingEntry.tollDate || dateStr,
        }];
      }

      setFormData({
        workerId: existingEntry.workerId,
        workerName: worker.name,
        shiftStart: worker.shiftStart || '07:00',
        shiftEnd: worker.shiftEnd || '16:00',
        clockIn: existingEntry.clockIn || worker.shiftStart || '07:00',
        clockOut: existingEntry.clockOut || worker.shiftEnd || '16:00',
        baseWage: existingEntry.baseWage,
        travelAllowance: existingEntry.travelAllowance,
        tollFee: existingEntry.tollFee,
        lateDeduction: existingEntry.lateDeduction,
        overtimeHours: existingEntry.overtimeHours,
        overtimeMinutes: existingEntry.overtimeMinutes,
        adjustments: existingEntry.adjustments || [],
        note: existingEntry.note || '',
        transferSlipUrl: existingEntry.transferSlipUrl || '',
        tollReceiptUrl: existingEntry.tollReceiptUrl || '',
        tollDate: existingEntry.tollDate || dateStr,
        tolls: editTolls,
        isLeave: existingEntry.isLeave || false,
        leaveType: (existingEntry.leaveType === 'ลาพักผ่อน' as any) ? 'ลากิจ' : (existingEntry.leaveType || 'ลากิจ'),
        leaveNote: existingEntry.leaveNote || '',
        hasGuaranteeDeduction: (existingEntry.guaranteeDeduction || 0) > 0,
        guaranteeDeductionAmount: existingEntry.guaranteeDeduction || Math.min(100, capRemaining),
      });
      setEditingId(existingEntry.id);
    } else {
      setFormData({
        workerId: worker.id,
        workerName: worker.name,
        shiftStart: worker.shiftStart || '07:00',
        shiftEnd: worker.shiftEnd || '16:00',
        clockIn: worker.shiftStart || '07:00',
        clockOut: worker.shiftEnd || '16:00',
        baseWage: worker.baseWage,
        travelAllowance: worker.defaultTravelAllowance,
        tollFee: 0,
        lateDeduction: 0,
        overtimeHours: 0,
        overtimeMinutes: 0,
        adjustments: [],
        note: '',
        transferSlipUrl: '',
        tollReceiptUrl: '',
        tollDate: dateStr,
        tolls: [],
        isLeave: false,
        leaveType: 'ลากิจ',
        leaveNote: '',
        hasGuaranteeDeduction: (worker.hasGuarantee || false) && capRemaining > 0,
        guaranteeDeductionAmount: Math.min(100, capRemaining),
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'transferSlipUrl' | 'tollReceiptUrl' | 'adjustments' | 'tolls', adjId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์ภาพมีขนาดใหญ่เกินไป แนะนำให้ใช้ไฟล์ที่เล็กกว่า 5MB');
      return;
    }

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${formData.workerId || 'unknown'}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('slips')
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('slips')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      if (field === 'transferSlipUrl') {
        setFormData(prev => ({ ...prev, transferSlipUrl: publicUrl }));
      } else if (field === 'tollReceiptUrl') {
        setFormData(prev => ({ ...prev, tollReceiptUrl: publicUrl }));
      } else if (field === 'adjustments' && adjId) {
        setFormData(prev => ({
          ...prev,
          adjustments: prev.adjustments.map(a => a.id === adjId ? { ...a, receiptUrl: publicUrl } : a)
        }));
      } else if (field === 'tolls' && adjId) {
        setFormData(prev => ({
          ...prev,
          tolls: prev.tolls.map(t => t.id === adjId ? { ...t, receiptUrl: publicUrl } : t)
        }));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploading(false);
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  const handleSave = (isDraft: boolean) => {
    if (!formData.workerId) return;

    const otRatePerHour = 100;
    const otPay = (formData.overtimeHours * otRatePerHour) + (formData.overtimeMinutes / 60 * otRatePerHour);
    const totalPay = calculateTotal();

    const tollTotal = formData.tolls.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const entryData = {
      workerId: formData.workerId,
      date: dateStr,
      clockIn: formData.clockIn,
      clockOut: formData.clockOut,
      baseWage: formData.baseWage,
      travelAllowance: formData.travelAllowance,
      tollFee: tollTotal,
      tolls: formData.tolls,
      lateDeduction: formData.lateDeduction,
      overtimeHours: formData.overtimeHours,
      overtimeMinutes: formData.overtimeMinutes,
      overtimePay: otPay,
      adjustments: formData.adjustments,
      totalPay,
      note: formData.note,
      isDraft,
      isLeave: formData.isLeave,
      leaveType: formData.isLeave ? formData.leaveType : undefined,
      leaveNote: formData.isLeave ? formData.leaveNote : undefined,
      transferSlipUrl: formData.transferSlipUrl,
      tollReceiptUrl: formData.tollReceiptUrl,
      tollDate: formData.tollDate,
      guaranteeDeduction: formData.hasGuaranteeDeduction ? formData.guaranteeDeductionAmount : 0,
    };

    if (editingId) {
      updateEntry(editingId, entryData);
    } else {
      addEntry(entryData);
    }
    setIsModalOpen(false);
  };
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleCopySingle = (worker: typeof workers[0], entry: typeof entries[0] | undefined, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent modal opening

    const thaiYear = selectedDate.getFullYear() + 543;
    const shortThaiYear = thaiYear.toString().slice(-2);
    const formattedDate = format(selectedDate, `dd/MM/${shortThaiYear}`);

    // Fallbacks to showing only basic wage if there's no entry logged yet
    const baseWage = entry ? entry.baseWage : worker.baseWage;
    const travelAllowance = entry ? entry.travelAllowance : (worker.defaultTravelAllowance || 0);
    const tollFee = entry ? entry.tollFee : 0;
    const overtimePay = entry ? entry.overtimePay : 0;
    const lateDeduction = entry ? entry.lateDeduction : 0;
    const adjustments = entry ? entry.adjustments : [];
    const totalPay = entry ? entry.totalPay : (baseWage + travelAllowance);
    const clockIn = entry ? entry.clockIn : worker.shiftStart || '07:00';
    const clockOut = entry ? entry.clockOut : worker.shiftEnd || '16:00';
    const idToUse = entry ? entry.id : worker.id;

    const wStart = worker.shiftStart || '07:00';
    const wEnd = worker.shiftEnd || '16:00';

    let text = `📝 แจ้งยอดรายวัน ${worker.name} (วันที่ ${formattedDate})\n`;
    if (entry?.isLeave) {
      // Fallback for older data that had 'ลาพักผ่อน'
      let leaveStr = (entry.leaveType as any) === 'ลาพักผ่อน' ? 'ลากิจ' : (entry.leaveType || 'ลากิจ');
      if (entry.leaveNote) leaveStr += ` (${entry.leaveNote})`;
      text += `${leaveStr}\n`;
    } else {
      const actualStart = clockIn > wStart ? clockIn : wStart;
      const actualEnd = clockOut < wEnd ? clockOut : wEnd;
      text += `เวลาทำงาน: ${actualStart} - ${actualEnd}\n`;
      if (lateDeduction > 0) text += `หักมาสาย: -฿${lateDeduction}\n`;
    }
    if (overtimePay > 0) {

      let morningOtMins = 0;
      let eveningOtMins = 0;

      if (clockIn < wStart) {
        const inTime = clockIn.split(':').map(Number);
        const startTime = wStart.split(':').map(Number);
        morningOtMins = (startTime[0] * 60 + startTime[1]) - (inTime[0] * 60 + inTime[1]);
        const mHours = Math.floor(morningOtMins / 60);
        const mMins = morningOtMins % 60;
        const morningPay = (morningOtMins / 60) * 100;
        const durationStr = ` (${mHours} ชม.${mMins > 0 ? ` ${mMins} นาที` : ''})`;
        text += `OT เช้า ${clockIn}-${wStart}${durationStr}: ฿${morningPay.toFixed(0)}\n`;
      }

      if (clockOut > wEnd) {
        const outTime = clockOut.split(':').map(Number);
        const endTime = wEnd.split(':').map(Number);
        eveningOtMins = (outTime[0] * 60 + outTime[1]) - (endTime[0] * 60 + endTime[1]);
        const eHours = Math.floor(eveningOtMins / 60);
        const eMins = eveningOtMins % 60;
        const eveningPay = (eveningOtMins / 60) * 100;
        const durationStr = ` (${eHours} ชม.${eMins > 0 ? ` ${eMins} นาที` : ''})`;
        text += `OT เย็น ${wEnd}-${clockOut}${durationStr}: ฿${eveningPay.toFixed(0)}\n`;
      }

      if (morningOtMins === 0 && eveningOtMins === 0) {
        const otHours = entry?.overtimeHours || 0;
        const otMins = entry?.overtimeMinutes || 0;
        const otDurationInfo = ` (${otHours} ชม.${otMins > 0 ? ` ${otMins} นาที` : ''})`;
        text += `OT${otDurationInfo}: ฿${overtimePay}\n`;
      }
    }
    if (!entry?.isLeave) {
      text += `\n`;
      text += `- ค่าแรง: ฿${baseWage}\n`;
      if (travelAllowance > 0) text += `- ค่ารถ: ฿${travelAllowance}\n`;
      if (tollFee > 0) {
        text += `- ทางด่วน`;
        if (entry?.tollDate && entry.tollDate !== entry.date) {
          text += ` (บิลลงวันที่ ${format(parseISO(entry.tollDate), 'dd/MM/yy')})`;
        }
        text += `: ฿${tollFee}\n`;
      }
      if (entry?.guaranteeDeduction && entry.guaranteeDeduction > 0) text += `- หักเงินประกันสะสม: -฿${entry.guaranteeDeduction}\n`;
    } else {
      text += `\n`;
    }

    if (adjustments && adjustments.length > 0) {
      adjustments.forEach(adj => {
        const amountStr = adj.type === 'add' ? `+฿${Number(adj.amount)}` : `-฿${Math.abs(Number(adj.amount))}`;
        const noteStr = adj.note ? ` (${adj.note})` : '';
        text += `- อื่นๆ: ${amountStr}${noteStr}\n`;
      });
    }

    text += `\n✅ ยอดสุทธิวันนี้: ฿${totalPay}`;

    handleCopy(text, idToUse);
  };

  const handleCopyAllDetailed = () => {
    const thaiYear = selectedDate.getFullYear() + 543;
    const shortThaiYear = thaiYear.toString().slice(-2);
    const formattedDate = format(selectedDate, `dd/MM/${shortThaiYear}`);

    let text = `📋 สรุปยอดรวมประจำวัน (วันที่ ${formattedDate})\n`;
    text += `💰 ยอดรวมทั้งหมด: ฿${totalPayForDay}\n`;
    text += `========================\n\n`;

    workers.forEach(worker => {
      const entry = entriesForDate.find(e => e.workerId === worker.id);

      const baseWage = entry ? entry.baseWage : worker.baseWage;
      const travelAllowance = entry ? entry.travelAllowance : (worker.defaultTravelAllowance || 0);
      const tollFee = entry ? entry.tollFee : 0;
      const overtimePay = entry ? entry.overtimePay : 0;
      const lateDeduction = entry ? entry.lateDeduction : 0;
      const adjustments = entry ? entry.adjustments : [];
      const totalPay = entry ? entry.totalPay : (baseWage + travelAllowance);
      const clockIn = entry ? entry.clockIn : worker.shiftStart || '07:00';
      const clockOut = entry ? entry.clockOut : worker.shiftEnd || '16:00';

      const wStart = worker.shiftStart || '07:00';
      const wEnd = worker.shiftEnd || '16:00';

      text += `👤 ${worker.name.startsWith('ช่าง') ? worker.name : `ช่าง${worker.name}`}\n`;
      if (entry?.isLeave) {
        let leaveStr = (entry.leaveType as any) === 'ลาพักผ่อน' ? 'ลากิจ' : (entry.leaveType || 'ลากิจ');
        if (entry.leaveNote) leaveStr += ` (${entry.leaveNote})`;
        text += `${leaveStr}\n`;
      } else {
        const actualStart = clockIn > wStart ? clockIn : wStart;
        const actualEnd = clockOut < wEnd ? clockOut : wEnd;
        text += `เวลาทำงาน: ${actualStart} - ${actualEnd}\n`;
        if (lateDeduction > 0) text += `หักมาสาย: -฿${lateDeduction}\n`;
      }
      if (overtimePay > 0) {

        let morningOtMins = 0;
        let eveningOtMins = 0;

        if (clockIn < wStart) {
          const inTime = clockIn.split(':').map(Number);
          const startTime = wStart.split(':').map(Number);
          morningOtMins = (startTime[0] * 60 + startTime[1]) - (inTime[0] * 60 + inTime[1]);
          const mHours = Math.floor(morningOtMins / 60);
          const mMins = morningOtMins % 60;
          const morningPay = (morningOtMins / 60) * 100;
          const durationStr = ` (${mHours} ชม.${mMins > 0 ? ` ${mMins} นาที` : ''})`;
          text += `OT เช้า ${clockIn}-${wStart}${durationStr}: ฿${morningPay.toFixed(0)}\n`;
        }

        if (clockOut > wEnd) {
          const outTime = clockOut.split(':').map(Number);
          const endTime = wEnd.split(':').map(Number);
          eveningOtMins = (outTime[0] * 60 + outTime[1]) - (endTime[0] * 60 + endTime[1]);
          const eHours = Math.floor(eveningOtMins / 60);
          const eMins = eveningOtMins % 60;
          const eveningPay = (eveningOtMins / 60) * 100;
          const durationStr = ` (${eHours} ชม.${eMins > 0 ? ` ${eMins} นาที` : ''})`;
          text += `OT เย็น ${wEnd}-${clockOut}${durationStr}: ฿${eveningPay.toFixed(0)}\n`;
        }

        // Handle case where overtimePay is overridden manually but format doesn't match
        if (morningOtMins === 0 && eveningOtMins === 0) {
          const otHours = entry?.overtimeHours || 0;
          const otMins = entry?.overtimeMinutes || 0;
          const otDurationInfo = ` (${otHours} ชม.${otMins > 0 ? ` ${otMins} นาที` : ''})`;
          text += `OT${otDurationInfo}: ฿${overtimePay}\n`;
        }
      }
      if (!entry?.isLeave) {
        text += `- ค่าแรง: ฿${baseWage}\n`;
        if (travelAllowance > 0) text += `- ค่ารถ: ฿${travelAllowance}\n`;
        if (tollFee > 0) {
          text += `- ทางด่วน`;
          if (entry?.tollDate && entry.tollDate !== entry.date) {
            text += ` (บิลลงวันที่ ${format(parseISO(entry.tollDate), 'dd/MM/yy')})`;
          }
          text += `: ฿${tollFee}\n`;
        }
        if (entry?.guaranteeDeduction && entry.guaranteeDeduction > 0) text += `- หักเงินประกันสะสม: -฿${entry.guaranteeDeduction}\n`;
      }

      if (adjustments && adjustments.length > 0) {
        adjustments.forEach(adj => {
          const amountStr = adj.type === 'add' ? `+฿${Number(adj.amount)}` : `-฿${Math.abs(Number(adj.amount))}`;
          const noteStr = adj.note ? ` (${adj.note})` : '';
          text += `- อื่นๆ: ${amountStr}${noteStr}\n`;
        });
      }

      text += `✅ ยอดสุทธิ: ฿${totalPay}\n\n`;
    });

    handleCopy(text, 'all_detailed');
  };

  const activeWorker = workers.find(w => w.id === activeTabWorkerId) || workers[0];
  const activeEntry = activeWorker ? entriesForDate.find(e => e.workerId === activeWorker.id) : undefined;

  const handleQuickLeaveInfo = (e: React.MouseEvent, leaveType: 'ลาป่วย' | 'ลากิจ' | 'ขาดงาน') => {
    e.stopPropagation();
    if (!activeWorker) return;
    const entryData = {
      workerId: activeWorker.id,
      date: dateStr,
      clockIn: activeWorker.shiftStart || '07:00',
      clockOut: activeWorker.shiftEnd || '16:00',
      baseWage: activeWorker.baseWage,
      travelAllowance: activeWorker.defaultTravelAllowance,
      tollFee: 0,
      lateDeduction: 0,
      overtimeHours: 0,
      overtimeMinutes: 0,
      overtimePay: 0,
      adjustments: [],
      totalPay: 0,
      note: '',
      isDraft: false,
      isLeave: true,
      leaveType: leaveType,
      transferSlipUrl: '',
      tollReceiptUrl: '',
      guaranteeDeduction: 0, // No deduction on leave day
    };
    addEntry(entryData);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Date Selector */}
      <div className="flex items-center justify-between bg-white p-2 rounded-3xl shadow-sm border border-gray-100">
        <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="text-center flex-1 relative">
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          <div className="text-sm text-red-600 font-semibold">{format(selectedDate, 'EEEE', { locale: th })}</div>
          <div className="text-lg font-bold text-gray-900">{format(selectedDate, 'd MMM yyyy', { locale: th })}</div>
        </div>
        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
          <ChevronRight className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {isSunday(selectedDate) && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 p-4 rounded-3xl shadow-sm flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-base mb-0.5">วันนี้คือวันอาทิตย์ (วันหยุดประจำสัปดาห์)</p>
            <p className="text-orange-600/90 leading-relaxed">ปกติแล้วไม่ต้องบันทึกเวลาทำงาน แต่หากมีการเข้ามาทำงาน สามารถบันทึกเวลาที่นี่ และบวก "โบนัสพิเศษ" หรือ "ค่าแรงวันหยุด" ในช่อง <span className="font-semibold underline">รายการปรับปรุง</span> ได้เลยครับ</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-5 rounded-3xl shadow-lg shadow-red-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="text-red-100 text-sm font-medium mb-1">ยอดรวมวันนี้</div>
          <div className="text-3xl font-bold tracking-tight">฿{totalPayForDay}</div>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-white p-5 rounded-3xl border border-sky-100 shadow-lg shadow-sky-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-sky-200 rounded-full opacity-30 blur-2xl transition-all duration-500 group-hover:scale-150"></div>
          <div className="text-sky-700 text-sm font-medium mb-1 relative z-10">ช่างที่มาทำงาน</div>
          <div className="text-3xl font-bold text-gray-800 relative z-10">
            {entriesForDate.length} <span className="text-lg font-normal text-gray-400">/ {workers.length}</span>
          </div>
        </div>
      </div>

      {/* Workers List / Tabs */}
      <div className="flex flex-col md:flex-row gap-4 lg:gap-6 items-start">
        {/* Left Tabs (Workers List) */}
        <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-2 overflow-y-auto pb-4 md:pb-0 md:max-h-[calc(100vh-250px)]">
          {workers.length === 0 ? (
            <div className="text-center py-10 md:py-6 text-sm text-gray-400 bg-white rounded-3xl md:rounded-2xl border border-dashed border-gray-200">
              ไม่มีข้อมูลช่าง
            </div>
          ) : (
            <>
              <button
                onClick={() => setActiveTabWorkerId('all')}
                className={`flex items-center justify-between p-3.5 md:p-3 rounded-2xl md:rounded-xl text-left transition-all duration-300 flex-shrink-0 border hover:scale-[1.02] active:scale-[0.98] ${activeTabWorkerId === 'all' ? 'bg-gradient-to-r from-sky-500 to-sky-600 border-sky-500 text-white shadow-md shadow-sky-200' : 'bg-white border-gray-100 text-gray-700 hover:bg-sky-50 hover:border-sky-200'}`}
              >
                <span className="font-semibold text-[15px]">📋 ข้อมูลทุกคน</span>
              </button>
              {workers.map(worker => {
                const entry = entriesForDate.find(e => e.workerId === worker.id);
                const isActive = worker.id === activeTabWorkerId;
                const isDraft = entry?.isDraft;
                return (
                  <button
                    key={worker.id}
                    onClick={() => setActiveTabWorkerId(worker.id)}
                    className={`flex items-center justify-between p-3.5 md:p-3 rounded-2xl md:rounded-xl text-left transition-all duration-300 flex-shrink-0 border hover:scale-[1.02] active:scale-[0.98] ${isActive ? (isDraft ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-500 text-white shadow-md shadow-amber-200' : 'bg-gradient-to-r from-sky-500 to-sky-600 border-sky-500 text-white shadow-md shadow-sky-200') : (isDraft ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 shadow-sm' : 'bg-white border-gray-100 text-gray-700 hover:bg-sky-50 hover:border-sky-200')}`}
                  >
                    <span className="font-semibold text-[15px]">{worker.name}</span>
                    {entry && (
                      <div className="flex items-center gap-1.5 ml-2">
                        {entry.transferSlipUrl && <Paperclip className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white/80' : 'text-sky-400'}`} />}
                        {isDraft ?
                          <Clock className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-100' : 'text-amber-500'}`} /> :
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-sky-100' : 'text-emerald-500'}`} />
                        }
                      </div>
                    )}
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Right Active Content */}
        <div className="w-full md:w-2/3 lg:w-3/4">
          {activeTabWorkerId === 'all' ? (
            <Card className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[200px] text-center bg-white border-gray-100 shadow-sm">
              <div className="mb-6">
                <div className="font-bold text-gray-900 text-2xl mb-2">สรุปข้อมูลช่างทุกคน</div>
                <div className="text-gray-500 text-sm">
                  มาทำงานแล้ว <span className="font-bold text-red-600">{entriesForDate.length}</span> จาก {workers.length} คน
                </div>
              </div>

              <Button
                onClick={handleCopyAllDetailed}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200 gap-2 mb-6"
              >
                {copiedId === 'all_detailed' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                คัดลอกรายละเอียดทุกคน ({workers.length} คน)
              </Button>

              <div className="w-full space-y-3 text-left">
                {workers.map(worker => {
                  const entry = entriesForDate.find(e => e.workerId === worker.id);
                  const totalPay = entry ? entry.totalPay : (worker.baseWage + (worker.defaultTravelAllowance || 0));
                  return (
                    <div key={worker.id} onClick={() => setActiveTabWorkerId(worker.id)} className="flex justify-between items-center p-4 bg-white hover:bg-sky-50 rounded-2xl border border-gray-100 cursor-pointer transition-all duration-300 hover:shadow-md hover:shadow-sky-100 hover:-translate-y-0.5 active:scale-[0.99] group">
                      <div>
                        <div className="font-bold text-gray-900 group-hover:text-sky-700 transition-colors">{worker.name}</div>
                        <div className="text-sm mt-0.5">
                          {entry ? (
                            entry.isDraft ? (
                              <span className="text-amber-600 flex items-center gap-1.5 font-medium bg-amber-50 px-2 py-0.5 rounded-lg inline-flex border border-amber-200/50">
                                <Clock className="w-3.5 h-3.5" /> ฉบับร่าง (ยังไม่เสร็จ)
                              </span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1.5 font-medium bg-emerald-50 px-2 py-0.5 rounded-lg inline-flex">
                                <CheckCircle2 className="w-3.5 h-3.5" /> บันทึกแล้ว
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 font-medium">รอการบันทึก (เวลา {worker.shiftStart || '07:00'}-{worker.shiftEnd || '16:00'})</span>
                          )}
                        </div>
                      </div>
                      <div className={`font-bold text-lg transition-colors ${entry?.isDraft ? 'text-amber-500 group-hover:text-amber-600' : 'text-red-500 group-hover:text-red-600'}`}>
                        ฿{totalPay}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : workers.length > 0 && activeWorker && (
            <Card
              key={activeWorker.id}
              onClick={() => openModal(activeWorker, activeEntry)}
              className={`p-6 md:p-8 flex flex-col items-center justify-center min-h-[200px] text-center active:scale-[0.99] transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${activeEntry ? (activeEntry.isDraft ? 'border-amber-200 bg-gradient-to-b from-amber-50/50 to-white shadow-amber-100' : 'border-sky-200 bg-gradient-to-b from-sky-50/50 to-white shadow-sky-100') : 'bg-white border-gray-100 hover:border-sky-300 shadow-sm'}`}
            >
              <div className="mb-4">
                <div className="font-bold text-gray-900 text-2xl mb-2">{activeWorker.name}</div>
                {activeEntry ? (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-semibold shadow-sm ${activeEntry.isDraft ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                    {activeEntry.isDraft ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {activeEntry.isDraft ? 'ฉบับร่าง' : 'บันทึกแล้ว'}
                    <span className={`${activeEntry.isDraft ? 'text-amber-800' : 'text-sky-800'} ml-1`}>฿{activeEntry.totalPay}</span>
                    <span className={`${activeEntry.isDraft ? 'text-amber-600/70 border-amber-200' : 'text-sky-600/70 border-sky-200'} font-normal ml-1 border-l pl-2`}>
                      {activeEntry.clockIn} - {activeEntry.clockOut}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 inline-block px-3 py-1 rounded-xl border border-gray-100">
                    รอการบันทึก • เวลาปกติ {activeWorker.shiftStart || '07:00'} - {activeWorker.shiftEnd || '16:00'}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                {activeEntry ? (
                  <>
                    <Button
                      variant="primary"
                      className="px-6 py-2.5 rounded-xl shadow-sm"
                    >
                      แก้ไขรายการ
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={(e) => handleCopySingle(activeWorker, activeEntry, e)}
                      className="p-2.5 h-auto rounded-xl bg-sky-50 text-red-600 hover:bg-sky-100 border-sky-100"
                      title="คัดลอกสรุปรายวัน"
                    >
                      {copiedId === activeEntry.id ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                      <span className="ml-1 text-sm font-semibold pr-1">คัดลอก</span>
                    </Button>
                    <Button
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`ต้องการลบรายการของ ${activeWorker.name} ใช่หรือไม่?`)) {
                          deleteEntry(activeEntry.id);
                        }
                      }}
                      className="p-2.5 h-auto rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="primary" className="px-8 py-3 text-base rounded-xl shadow-red-200 pointer-events-none">
                      คลิกเพื่อบันทึกรายการ
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={(e) => handleCopySingle(activeWorker, undefined, e)}
                      className="p-3 h-auto rounded-xl bg-sky-50 text-red-600 hover:bg-sky-100 border-sky-100"
                      title="คัดลอกสรุปรายการ (ค่าแรงปกติ)"
                    >
                      {copiedId === activeWorker.id ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                    </Button>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Button
                        variant="danger"
                        onClick={(e) => handleQuickLeaveInfo(e, 'ลาป่วย')}
                        className="p-3 text-xs h-auto rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-100 font-medium whitespace-nowrap"
                        title="ป่วย"
                      >
                        ลาป่วย
                      </Button>
                      <Button
                        variant="danger"
                        onClick={(e) => handleQuickLeaveInfo(e, 'ลากิจ')}
                        className="p-3 text-xs h-auto rounded-xl bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-100 font-medium whitespace-nowrap"
                        title="ลากิจ"
                      >
                        ลากิจ
                      </Button>
                      <Button
                        variant="danger"
                        onClick={(e) => handleQuickLeaveInfo(e, 'ขาดงาน')}
                        className="p-3 text-xs h-auto rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 font-medium whitespace-nowrap"
                        title="ขาดงาน"
                      >
                        ขาดงาน
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Entry Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.workerName}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-3 bg-red-50 p-4 rounded-2xl border border-red-100">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-semibold text-red-700">ลางาน / ขาดงาน</span>
                <span className="text-xs text-red-500">ติ๊กเพื่อบันทึกว่าช่างไม่ได้มาทำงานในวันนี้</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.isLeave}
                  onChange={(e) => setFormData(p => ({ ...p, isLeave: e.target.checked }))}
                />
                <div className="w-11 h-6 bg-red-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {formData.isLeave && (
              <div className="animate-in fade-in slide-in-from-top-2 pt-3 border-t border-red-200 border-dashed space-y-3">
                <div>
                  <Label className="text-xs text-red-800">ประเภท</Label>
                  <div className="flex gap-2">
                    {[
                      { id: 'ลาป่วย', label: 'ลาป่วย' },
                      { id: 'ลากิจ', label: 'ลากิจ' },
                      { id: 'ขาดงาน', label: 'ขาดงาน' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, leaveType: type.id as any }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border flex-1 ${formData.leaveType === type.id ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-red-700 border-red-200 hover:bg-red-100'}`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-red-800">หมายเหตุ (ถ้ามี)</Label>
                  <Input
                    type="text"
                    value={formData.leaveNote}
                    onChange={(e) => setFormData(p => ({ ...p, leaveNote: e.target.value }))}
                    className="bg-white border-red-200 focus:ring-red-500 h-9 text-sm text-red-900 placeholder:text-red-300"
                    placeholder="เช่น ไปหาหมอ, รถเสีย, ติดธุระ..."
                  />
                </div>
              </div>
            )}
          </div>

          {!formData.isLeave && (
            <>
              {/* Time Inputs */}
              <div className="bg-sky-50/50 p-4 rounded-3xl border border-sky-100">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-500" /> เวลาทำงาน
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetToShiftTimes}
                      className="text-xs text-red-600 bg-white px-2 py-1 rounded-lg border border-sky-100 flex items-center gap-1 hover:bg-sky-50"
                      title="รีเซ็ตเป็นเวลาปกติ"
                    >
                      <RefreshCw className="w-3 h-3" />
                      ปกติ
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowShiftSettings(!showShiftSettings)}
                      className="text-xs text-red-600 bg-white px-2 py-1 rounded-lg border border-sky-100 flex items-center gap-1 hover:bg-sky-50"
                    >
                      <Settings2 className="w-3 h-3" />
                      {showShiftSettings ? 'ซ่อน' : `กะ: ${formData.shiftStart}-${formData.shiftEnd}`}
                    </button>
                  </div>
                </div>

                {showShiftSettings && (
                  <div className="bg-white p-3 rounded-xl border border-sky-100 mb-3 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <Label className="text-[10px] text-gray-500">เริ่มกะ</Label>
                      <Input
                        type="time"
                        value={formData.shiftStart}
                        onChange={(e) => setFormData(p => ({ ...p, shiftStart: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">จบกะ</Label>
                      <Input
                        type="time"
                        value={formData.shiftEnd}
                        onChange={(e) => setFormData(p => ({ ...p, shiftEnd: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-red-700">เวลาเข้างานจริง</Label>
                    <div className="flex gap-1">
                      <select
                        value={formData.clockIn.split(':')[0]}
                        onChange={(e) => {
                          const [, min] = formData.clockIn.split(':');
                          setFormData(p => ({ ...p, clockIn: `${e.target.value}:${min || '00'}` }));
                        }}
                        className="w-full rounded-xl border border-sky-100 bg-white text-center font-bold text-lg focus:ring-2 focus:ring-sky-500 outline-none h-12 appearance-none"
                      >
                        {Array.from({ length: 24 }).map((_, i) => {
                          const hr = i.toString().padStart(2, '0');
                          return <option key={hr} value={hr}>{hr}</option>;
                        })}
                      </select>
                      <span className="text-xl font-bold self-center text-gray-900">:</span>
                      <select
                        value={formData.clockIn.split(':')[1] || '00'}
                        onChange={(e) => {
                          const [hr] = formData.clockIn.split(':');
                          setFormData(p => ({ ...p, clockIn: `${hr || '00'}:${e.target.value}` }));
                        }}
                        className="w-full rounded-xl border border-sky-100 bg-white text-center font-bold text-lg focus:ring-2 focus:ring-sky-500 outline-none h-12 appearance-none"
                      >
                        <option value="00">00</option>
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-red-700">เวลาเลิกงานจริง</Label>
                    <div className="flex gap-1">
                      <select
                        value={formData.clockOut.split(':')[0]}
                        onChange={(e) => {
                          const [, min] = formData.clockOut.split(':');
                          setFormData(p => ({ ...p, clockOut: `${e.target.value}:${min || '00'}` }));
                        }}
                        className="w-full rounded-xl border border-sky-100 bg-white text-center font-bold text-lg focus:ring-2 focus:ring-sky-500 outline-none h-12 appearance-none"
                      >
                        {Array.from({ length: 24 }).map((_, i) => {
                          const hr = i.toString().padStart(2, '0');
                          return <option key={hr} value={hr}>{hr}</option>;
                        })}
                      </select>
                      <span className="text-xl font-bold self-center text-gray-900">:</span>
                      <select
                        value={formData.clockOut.split(':')[1] || '00'}
                        onChange={(e) => {
                          const [hr] = formData.clockOut.split(':');
                          setFormData(p => ({ ...p, clockOut: `${hr || '00'}:${e.target.value}` }));
                        }}
                        className="w-full rounded-xl border border-sky-100 bg-white text-center font-bold text-lg focus:ring-2 focus:ring-sky-500 outline-none h-12 appearance-none"
                      >
                        <option value="00">00</option>
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto Calculated Results */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 p-3 rounded-2xl border border-red-100 transition-all duration-300" style={{ opacity: formData.lateDeduction > 0 ? 1 : 0.7 }}>
                  <Label className="text-red-700 text-xs mb-1 cursor-help" title={`คำนวณหักสาย 100 บาท/ชม.`}>
                    หักสาย/กลับก่อน (อัตโนมัติ)
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-red-600 flex-1">
                      - ฿{formData.lateDeduction}
                    </span>
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-2xl border border-green-100 transition-all duration-300" style={{ opacity: (formData.overtimeHours > 0 || formData.overtimeMinutes > 0) ? 1 : 0.7 }}>
                  <Label className="text-green-700 text-xs mb-1 cursor-help" title={`คำนวณโอที 100 บาท/ชม.`}>
                    โอที (อัตโนมัติ 100บ./ชม.)
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-green-700 flex-1">
                      + ฿{Math.round((formData.overtimeHours * 100) + (formData.overtimeMinutes / 60 * 100))}
                    </span>
                    <span className="text-xs text-green-600 font-medium">
                      ({formData.overtimeHours} ชม. {formData.overtimeMinutes > 0 ? `${formData.overtimeMinutes} นาที` : ''})
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">ค่าแรง</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.baseWage || ''}
                    onChange={(e) => setFormData(p => ({ ...p, baseWage: Number(e.target.value) }))}
                    className="font-semibold px-2"
                  />
                </div>
                <div>
                  <Label className="text-xs">ค่ารถ</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.travelAllowance || ''}
                    onChange={(e) => setFormData(p => ({ ...p, travelAllowance: Number(e.target.value) }))}
                    className="font-semibold px-2"
                  />
                </div>
              </div>

              {/* Tolls section */}
              <div className="bg-sky-50/30 p-3 rounded-2xl border border-sky-100">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs mb-0">ทางด่วน</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-sky-600 px-2 py-1 h-auto text-[10px] bg-sky-100 rounded-lg hover:bg-sky-200"
                    onClick={() => setFormData(p => ({
                      ...p,
                      tolls: [...p.tolls, { id: uuidv4(), amount: 0, date: dateStr }]
                    }))}
                  >
                    <Plus className="w-3 h-3 mr-1" /> เพิ่มบิล
                  </Button>
                </div>
                {formData.tolls.length === 0 && (
                  <div className="text-[10px] text-gray-500 text-center py-2 bg-white rounded-xl border border-dashed border-sky-200">ไม่มีรายการทางด่วน</div>
                )}
                <div className="space-y-2">
                  {formData.tolls.map((toll) => (
                    <div key={toll.id} className="flex gap-2 items-center bg-white p-2 text-sm rounded-xl border border-sky-100 shadow-sm animate-in fade-in slide-in-from-top-1">
                      <div className="flex-1 relative">
                        <Input
                          type="number"
                          min="0"
                          value={toll.amount || ''}
                          onChange={(e) => setFormData(p => ({
                            ...p,
                            tolls: p.tolls.map(t => t.id === toll.id ? { ...t, amount: Number(e.target.value) } : t)
                          }))}
                          className="font-semibold text-sm h-9 px-2"
                          placeholder="ค่าทางด่วน (บาท)"
                        />
                        <label className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-sky-500 transition-colors" title="แนบใบเสร็จ">
                          <ImagePlus className="w-5 h-5" />
                          <input disabled={isUploading} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'tolls', toll.id)} />
                        </label>
                      </div>
                      <div className="shrink-0 w-[110px]">
                        <input
                          type="date"
                          value={toll.date || dateStr}
                          onChange={(e) => setFormData(p => ({
                            ...p,
                            tolls: p.tolls.map(t => t.id === toll.id ? { ...t, date: e.target.value } : t)
                          }))}
                          className="bg-sky-50/80 px-2 py-1.5 h-9 rounded-lg border border-sky-100 text-sky-800 outline-none w-full text-[11px] box-border transition-colors hover:bg-sky-100"
                          title="วันที่ในบิล"
                        />
                      </div>
                      <div className="flex items-center shrink-0 w-8 justify-center">
                        {toll.receiptUrl && (
                          <button type="button" onClick={() => setPreviewImageUrl(toll.receiptUrl || '')} className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-100" title="ดูใบเสร็จ"><Check className="w-4 h-4" /></button>
                        )}
                      </div>
                      <button type="button" onClick={() => setFormData(p => ({ ...p, tolls: p.tolls.filter(t => t.id !== toll.id) }))} className="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 p-1.5 rounded-lg shrink-0 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guarantee Deduction */}
              <div className="bg-orange-50/50 p-4 rounded-3xl border border-orange-100 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-semibold text-orange-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-orange-500" /> หักเงินประกันสะสม</span>
                </div>
                <div className="flex items-center gap-3">
                  {formData.hasGuaranteeDeduction && (
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-orange-700">฿</span>
                      <Input type="number" min="0" value={formData.guaranteeDeductionAmount || ''} onChange={(e) => setFormData(p => ({ ...p, guaranteeDeductionAmount: Number(e.target.value) }))} className="w-20 font-semibold h-9 text-sm px-2 text-right border-orange-200" />
                    </div>
                  )}
                  <label className="relative inline-flex items-center cursor-pointer ml-auto">
                    <input type="checkbox" className="sr-only peer" checked={formData.hasGuaranteeDeduction} onChange={(e) => setFormData(p => ({ ...p, hasGuaranteeDeduction: e.target.checked }))} />
                    <div className="w-11 h-6 bg-orange-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Adjustments */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Label className="mb-0 text-gray-900">รายการอื่นๆ (เพิ่ม/หักเงิน)</Label>
                    <button
                      type="button"
                      onClick={() => setShowLalamoveCalc(!showLalamoveCalc)}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md transition-all font-semibold ${showLalamoveCalc ? 'bg-sky-500 text-white shadow-sm' : 'bg-sky-50 text-sky-600 border border-sky-100 hover:bg-sky-100'}`}
                      title="คำนวณจาก Lalamove 4 ประตู"
                    >
                      📍 Lalamove
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 px-3 py-1.5 h-auto text-xs bg-sky-50 rounded-xl"
                    onClick={() => setFormData(p => ({
                      ...p,
                      adjustments: [...p.adjustments, { id: uuidv4(), type: 'add', amount: 0, note: '' }]
                    }))}
                  >
                    <Plus className="w-3 h-3 mr-1" /> เพิ่มรายการ
                  </Button>
                </div>

                {/* Lalamove Inline Calculator for Adjustments */}
                {showLalamoveCalc && (
                  <div className="bg-gradient-to-r from-sky-50 to-white border border-sky-100 rounded-2xl p-3 animate-in fade-in slide-in-from-top-1 shadow-sm">
                    <div className="text-[11px] text-sky-800 mb-2 font-semibold flex items-center gap-1.5">
                      📍 คำนวณค่ารถ Lalamove (กระบะ 4 ประตู)
                      <span className="text-[9px] font-normal text-sky-600 bg-sky-100/50 px-1.5 py-0.5 rounded-md">เริ่ม 159บ. + 14บ./กม.</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="ระยะทาง (กม.)"
                        value={lalamoveDist}
                        onChange={(e) => setLalamoveDist(e.target.value)}
                        className="h-9 text-sm px-3 flex-1 border-sky-100 bg-white"
                      />
                      {lalamoveDist && Number(lalamoveDist) > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const dist = Number(lalamoveDist);
                            const cost = 159 + Math.round(dist * 14);
                            setFormData(p => ({
                              ...p,
                              adjustments: [...p.adjustments, { id: uuidv4(), type: 'add', amount: cost, note: 'ค่ารถไปหน้างาน' }]
                            }));
                            setShowLalamoveCalc(false);
                            setLalamoveDist('');
                          }}
                          className="bg-sky-500 text-white text-xs font-bold px-4 py-1.5 rounded-xl hover:bg-sky-600 active:scale-[0.98] transition-all whitespace-nowrap shadow-sm shadow-sky-200"
                        >
                          เพิ่มไปรายการอื่นๆ ฿{159 + Math.round(Number(lalamoveDist) * 14)}
                        </button>
                      ) : (
                        <div className="text-xs text-gray-400 px-4 flex items-center bg-gray-50 border border-dashed border-gray-200 rounded-xl whitespace-nowrap">
                          รอระบุระยะทาง...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {formData.adjustments.map((adj, idx) => (
                  <div key={adj.id} className="flex gap-2 items-start bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={adj.type}
                          onChange={(e) => {
                            const newAdjs = [...formData.adjustments];
                            newAdjs[idx].type = e.target.value as 'add' | 'deduct';
                            setFormData(p => ({ ...p, adjustments: newAdjs }));
                          }}
                          className={`h-10 rounded-xl border-0 px-3 text-sm focus:ring-2 focus:ring-sky-500 font-medium ${adj.type === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          <option value="add">เพิ่มเงิน (+)</option>
                          <option value="deduct">หักเงิน (-)</option>
                        </select>
                        <Input
                          type="number"
                          placeholder="จำนวนเงิน"
                          value={adj.amount || ''}
                          onChange={(e) => {
                            const newAdjs = [...formData.adjustments];
                            newAdjs[idx].amount = Number(e.target.value);
                            setFormData(p => ({ ...p, adjustments: newAdjs }));
                          }}
                          className="h-10 text-sm bg-white"
                        />
                      </div>
                      <div className="relative w-full">
                        <Input
                          type="text"
                          list={`note-presets-${adj.id}`}
                          placeholder="ระบุหมายเหตุ (เช่น ค่ารถไปงานที่ 1, อื่นๆ)"
                          value={adj.note}
                          onChange={(e) => {
                            const newAdjs = [...formData.adjustments];
                            newAdjs[idx].note = e.target.value;
                            setFormData(p => ({ ...p, adjustments: newAdjs }));
                          }}
                          className={`h-10 text-sm bg-white w-full ${adj.receiptUrl ? 'pr-20' : 'pr-8'}`}
                        />
                        <datalist id={`note-presets-${adj.id}`}>
                          <option value="ค่ารถไปงานที่ 1" />
                          <option value="ค่ารถไปงานที่ 2" />
                          <option value="ค่ารถไปงานที่ 3" />
                          <option value="ค่ารถไปงานที่ 4" />
                          <option value="เบี้ยเลี้ยง" />
                          <option value="โบนัสพิเศษ" />
                        </datalist>
                        {adj.receiptUrl && (
                          <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white p-0.5 rounded-md shadow-sm border border-emerald-100 transition-colors z-10">
                            <button type="button" onClick={() => setPreviewImageUrl(adj.receiptUrl!)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-1 rounded transition-colors" title="ดูรูปที่แนบ">
                              <ImagePlus className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => {
                              const newAdjs = [...formData.adjustments];
                              newAdjs[idx].receiptUrl = '';
                              setFormData(p => ({ ...p, adjustments: newAdjs }));
                            }} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors" title="ลบรูป">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <label className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer transition-colors text-gray-400 hover:text-sky-500 ${adj.receiptUrl ? 'bg-white p-1 rounded-md' : ''} z-0`} title={adj.receiptUrl ? 'อัพโหลดรูปใหม่' : 'แนบสลิป/ใบเสร็จ'}>
                          <ImagePlus className="w-4 h-4" />
                          <input disabled={isUploading} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'adjustments', adj.id)} />
                        </label>
                      </div>
                      <datalist id={`note-presets-${adj.id}`}>
                        <option value="ค่ารถไปหน้างาน" />
                        <option value="ค่าอาหาร" />
                        <option value="เบิกล่วงหน้า" />
                        <option value="อื่นๆ (ระบุ...)" />
                      </datalist>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newAdjs = formData.adjustments.filter(a => a.id !== adj.id);
                        setFormData(p => ({ ...p, adjustments: newAdjs }));
                      }}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {formData.adjustments.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-2xl">
                    ไม่มีรายการเพิ่มเติม
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col gap-4 pt-4 mt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 font-medium">ยอดสุทธิ</div>
                <div className="text-3xl font-bold text-red-600">฿{calculateTotal()}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {formData.transferSlipUrl && (
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-100 shadow-sm">
                      <button type="button" onClick={() => setPreviewImageUrl(formData.transferSlipUrl)} className="shrink-0 group relative rounded-lg overflow-hidden border border-emerald-200" title="คลิกเพื่อดูสลิปโอนเงิน">
                        <img src={formData.transferSlipUrl} alt="slip" className="w-10 h-10 object-cover group-hover:scale-110 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                          <span className="text-[9px] text-white font-bold tracking-wide">ดูสลิป</span>
                        </div>
                      </button>
                      <button type="button" onClick={() => setFormData(p => ({ ...p, transferSlipUrl: '' }))} className="shrink-0 flex items-center justify-center w-8 h-10 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors" title="ลบสลิปโอนเงิน">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all border ${isUploading ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed' : formData.transferSlipUrl ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600'}`}>
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-semibold">กำลังอัพโหลด...</span>
                      </>
                    ) : formData.transferSlipUrl ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-semibold">แนบสลิปโอนเงินแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Paperclip className="w-4 h-4" />
                        <span className="text-sm font-medium">แนบสลิปโอนเงิน</span>
                      </>
                    )}
                    <input disabled={isUploading} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'transferSlipUrl')} />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full">
              {editingId && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (window.confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) {
                      deleteEntry(editingId);
                      setIsModalOpen(false);
                    }
                  }}
                  className="px-4 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
              <Button
                type="button"
                disabled={isUploading}
                className="px-6 py-4 text-base rounded-2xl shadow-sm bg-orange-500 hover:bg-orange-600 text-white flex-1 disabled:opacity-50"
                onClick={() => handleSave(true)}
              >
                {isUploading ? 'รออัพโหลดรูป...' : 'บันทึกฉบับร่าง'}
              </Button>
              <Button
                type="button"
                disabled={isUploading}
                className="px-6 py-4 text-base rounded-2xl shadow-lg shadow-sky-200 flex-1 bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
                onClick={() => handleSave(false)}
              >
                {isUploading ? 'รออัพโหลดรูป...' : 'บันทึกสมบูรณ์'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewImageUrl(null)}
          title="ดูรูปภาพ"
        >
          <div className="flex flex-col items-center justify-center p-2">
            <img src={previewImageUrl} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-xl border border-gray-200 shadow-sm" />
            <Button
              onClick={() => setPreviewImageUrl(null)}
              className="mt-6 w-full py-3 rounded-2xl shadow-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              ปิดหน้าต่าง
            </Button>
          </div>
        </Modal>
      )}
    </div >
  );
}
