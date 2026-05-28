import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Label, Card, Modal, Toast, Skeleton } from '../components/ui';
import { format, addDays, subDays, isSunday, parseISO, endOfMonth, previousSaturday, isSaturday } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, Trash2, Settings2, RefreshCw, Copy, Check, Paperclip, ImagePlus, X, AlertTriangle, Loader2, Share2, Wallet, ArrowDownCircle, Send, Activity, CalendarOff, UserMinus, ChevronDown, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';
import { Adjustment } from '../types';
import { supabase } from '../lib/supabase';
import { toPng } from 'html-to-image';

const timeToMins = (time: string) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export function DailyEntryPage({ pendingDate, onPendingDateConsumed }: { pendingDate?: string | null; onPendingDateConsumed?: () => void }) {
  const { workers: allWorkers, entries, advances, addEntry, updateEntry, deleteEntry, addAdvance, holidays, addHoliday, deleteHoliday, isWorkersLoading, isEntriesLoading } = useStore();
  const workers = useMemo(() => allWorkers.filter(w => !w.isResigned), [allWorkers]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = sessionStorage.getItem('dailyEntrySelectedDate');
    if (saved) {
      const d = new Date(saved);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dailySlipsViewer, setDailySlipsViewer] = useState<{ workerName: string, images: string[] } | null>(null);
  const [isCopyingImageId, setIsCopyingImageId] = useState<string | null>(null);
  const [isCopyingPreviewUrl, setIsCopyingPreviewUrl] = useState<string | null>(null);
  const [lastCopiedUrl, setLastCopiedUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showShiftSettings, setShowShiftSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTabWorkerId, setActiveTabWorkerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLalamoveCalc, setShowLalamoveCalc] = useState(false);
  const [lalamoveDist, setLalamoveDist] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const isUploadingRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isCopyingAllSlips, setIsCopyingAllSlips] = useState(false);
  const [shareProgress, setShareProgress] = useState<{current: number, total: number} | null>(null);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);
  const [customAllowanceMessage, setCustomAllowanceMessage] = useState<string | null>(null);
  const [autoDraftPending, setAutoDraftPending] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    workerId: '',
    workerName: '',
    amount: '',
    note: ''
  });

  const activeCardRef = useRef<HTMLDivElement>(null);

  // Save selected date to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('dailyEntrySelectedDate', selectedDate.toISOString());
  }, [selectedDate]);

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
    transferSlips: [] as string[],
    tollReceiptUrl: '',
    tollDate: '',
    tolls: [] as { id: string; amount: number; receiptUrl?: string; date?: string; }[],
    isLeave: false,
    leaveType: 'ลากิจ' as 'ลาป่วย' | 'ลากิจ' | 'ขาดงาน' | 'ลาครึ่งวัน',
    leaveNote: '',
    hasGuaranteeDeduction: false,
    guaranteeDeductionAmount: 100,
    lateRateRule: 'normal' as 'normal' | 'special',
  });

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const currentHoliday = holidays.find(h => h.date === dateStr);
  const isHoliday = !!currentHoliday;

  // Consume pending date from navigation (e.g., clicked holiday in WorkersPage)
  useEffect(() => {
    if (pendingDate) {
      const d = new Date(pendingDate + 'T00:00:00');
      if (!isNaN(d.getTime())) setSelectedDate(d);
      onPendingDateConsumed?.();
    }
  }, [pendingDate]);

  const entriesForDate = useMemo(() => {
    return entries.filter(e => e.date === dateStr);
  }, [entries, dateStr]);

  const totalPayForDay = entriesForDate.reduce((sum, e) => sum + e.totalPay, 0);

  const workersWithSlips = useMemo(() => {
    return workers.map(worker => {
      const entry = entriesForDate.find(e => e.workerId === worker.id);
      if (!entry) return null;
      const images: string[] = [];
      // Collect all possible slip types
      if (entry.transferSlips && entry.transferSlips.length > 0) {
        images.push(...entry.transferSlips);
      } else if (entry.transferSlipUrl) {
        images.push(entry.transferSlipUrl);
      }
      if (entry.tollReceiptUrl) images.push(entry.tollReceiptUrl);
      if (entry.tolls) entry.tolls.forEach(t => { if (t.receiptUrl) images.push(t.receiptUrl); });
      if (entry.adjustments) entry.adjustments.forEach(a => { if (a.receiptUrl) images.push(a.receiptUrl); });
      
      const uniqueImages = [...new Set(images)].filter(url => url);
      if (uniqueImages.length === 0) return null;
      
      return { worker, images: uniqueImages };
    }).filter((w): w is { worker: any, images: string[] } => w !== null);
  }, [workers, entriesForDate]);

  // Pre-load slip images into memory cache as soon as workersWithSlips changes
  // This means the button press is near-instant (no network wait)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const allUrls = workersWithSlips.flatMap(w => w.images);
    allUrls.forEach(url => {
      if (!imageCacheRef.current.has(url) && url) {
        const img = new Image();
        if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.onload = () => imageCacheRef.current.set(url, img);
        img.src = url;
      }
    });
  }, [workersWithSlips]);

  const totalSlipsCount = useMemo(() => {
    return workersWithSlips.reduce((sum, w) => sum + w.images.length, 0);
  }, [workersWithSlips]);

  const calculateTotal = () => {
    if (formData.isLeave && formData.leaveType !== 'ลาครึ่งวัน') return 0;
    
    const guaranteeDed = (formData.hasGuaranteeDeduction && (!formData.isLeave || formData.leaveType === 'ลาครึ่งวัน')) 
      ? formData.guaranteeDeductionAmount
      : 0;

    // If half-day: (baseWage - guaranteeDeduction) / 2
    if (formData.isLeave && formData.leaveType === 'ลาครึ่งวัน') {
      return (formData.baseWage - guaranteeDed) / 2;
    }

    const otRatePerHour = 100;
    const otPay = (formData.overtimeHours * otRatePerHour) + (formData.overtimeMinutes / 60 * otRatePerHour);
    const adjustmentsTotal = formData.adjustments.reduce((sum, adj) => {
      return sum + (adj.type === 'add' ? Number(adj.amount) : -Number(adj.amount));
    }, 0);
    const tollTotal = formData.tolls.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    
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
    let lateMins = 0;
    let earlyLeaveMins = 0;
    if (inMins > startMins) lateMins += (inMins - startMins);
    if (outMins < endMins) earlyLeaveMins += (endMins - outMins);

    // Calculate late deduction
    let deduction = 0;
    
    if (formData.lateRateRule === 'special') {
      // Special rate: only deduct for late arrival, ignore early leave
      const missingMinsToDeduct = lateMins; // ignore early leave
      const hours = Math.floor(missingMinsToDeduct / 60);
      const remainder = missingMinsToDeduct % 60;
      let remainderDeduction = 0;
      
      if (remainder > 0 && remainder <= 15) {
        remainderDeduction = 0;
      } else if (remainder >= 16 && remainder <= 45) {
        remainderDeduction = 25;
      } else if (remainder >= 46 && remainder < 60) {
        remainderDeduction = 50;
      }
      
      deduction = (hours * 50) + remainderDeduction;
    } else {
      // Normal rate: 100 baht per hour, calculated proportionally based on BOTH late and early leave
      const missingMinsToDeduct = lateMins + earlyLeaveMins;
      const deductionRatePerHour = 100;
      deduction = Math.round((deductionRatePerHour / 60) * missingMinsToDeduct);
    }

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
  }, [formData.clockIn, formData.clockOut, formData.shiftStart, formData.shiftEnd, formData.baseWage, isModalOpen, formData.lateRateRule]);

  const resetToShiftTimes = () => {
    setFormData(prev => ({
      ...prev,
      clockIn: prev.shiftStart,
      clockOut: prev.shiftEnd
    }));
  };

  const getWorkerGuaranteeTotal = (workerId: string, excludeEntryId?: string) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return 0;
    
    const processedDates = new Set<string>();
    let entriesSum = 0;
    
    entries
      .filter(e => e.workerId === workerId && !e.isDraft && e.id !== excludeEntryId)
      .sort((a,b) => b.date.localeCompare(a.date))
      .forEach(e => {
        if (e.isLeave && e.leaveType !== 'ลาครึ่งวัน') return;
        const dedAmount = Number(e.guaranteeDeduction || 0);
        if (dedAmount > 0) {
          if (!processedDates.has(e.date)) {
            processedDates.add(e.date);
            entriesSum += dedAmount;
          }
        }
      });

    const refundTotal = advances
      .filter(a => a.workerId === workerId && a.type === 'guarantee_refund')
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    return Number(worker.historicalGuarantee || 0) + entriesSum - refundTotal;
  };

  const openModal = (worker: any, existingEntry?: any) => {
    setShowShiftSettings(false);

    // Calculate current guarantee total
    const guaranteeTotal = getWorkerGuaranteeTotal(worker.id, existingEntry?.id);

    const limit = worker.guaranteeLimit ?? 10000;
    const capRemaining = Math.max(0, limit - guaranteeTotal);

    const currentDateParsed = parseISO(dateStr);
    const lastSat = isSaturday(endOfMonth(currentDateParsed)) ? endOfMonth(currentDateParsed) : previousSaturday(endOfMonth(currentDateParsed));
    const isLastSaturday = format(lastSat, 'yyyy-MM-dd') === dateStr;
    const currentMonthPrefix = dateStr.substring(0, 7);

    const hasAutoAllowanceThisMonth = entries.find(e => 
      e.workerId === worker.id && 
      e.date.startsWith(currentMonthPrefix) && 
      e.adjustments?.some((a: any) => a.note?.startsWith('[อัตโนมัติ]'))
    );

    let autoAddedMessage = null;
    let injectedAdjustments: any[] = [];
    let isAutoAddingNow = false;

    if (hasAutoAllowanceThisMonth) {
      autoAddedMessage = `เพิ่มค่าอื่นๆ ประจำเดือนอัตโนมัติไปแล้วเมื่อวันที่ ${format(parseISO(hasAutoAllowanceThisMonth.date), 'd MMM yyyy', { locale: th })}`;
    } else if (isLastSaturday && worker.customAllowances && worker.customAllowances.length > 0) {
      injectedAdjustments = worker.customAllowances.map((ca: any) => ({
        id: uuidv4(),
        type: 'add' as const,
        amount: Number(ca.amount),
        note: `[อัตโนมัติ] ${ca.name}`
      }));
      autoAddedMessage = `เพิ่มค่าอื่นๆ ประจำเดือน ${worker.customAllowances.length} รายการ (บันทึกเป็นแบบร่างอัตโนมัติ)`;
      isAutoAddingNow = true;
    }

    setCustomAllowanceMessage(autoAddedMessage);

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
        baseWage: (existingEntry.baseWage === 0 && worker.paymentType === 'day' && (!existingEntry.isLeave || existingEntry.leaveType === 'ลาครึ่งวัน')) ? worker.baseWage : existingEntry.baseWage,
        travelAllowance: existingEntry.travelAllowance,
        tollFee: existingEntry.tollFee,
        lateDeduction: existingEntry.lateDeduction,
        overtimeHours: existingEntry.overtimeHours,
        overtimeMinutes: existingEntry.overtimeMinutes,
        adjustments: existingEntry.adjustments ? [...existingEntry.adjustments, ...injectedAdjustments] : injectedAdjustments,
        note: existingEntry.note || '',
        transferSlipUrl: existingEntry.transferSlipUrl || '',
        transferSlips: (existingEntry.transferSlips && existingEntry.transferSlips.length > 0) ? existingEntry.transferSlips : (existingEntry.transferSlipUrl ? [existingEntry.transferSlipUrl] : []),
        tollReceiptUrl: existingEntry.tollReceiptUrl || '',
        tollDate: existingEntry.tollDate || dateStr,
        tolls: editTolls,
        isLeave: existingEntry.isLeave || false,
        leaveType: (existingEntry.leaveType === 'ลาพักผ่อน' as any) ? 'ลากิจ' : (existingEntry.leaveType || 'ลากิจ'),
        leaveNote: existingEntry.leaveNote || '',
        hasGuaranteeDeduction: existingEntry.isDraft 
          ? ((worker.hasGuarantee || false) && capRemaining > 0)
          : ((existingEntry.guaranteeDeduction || 0) > 0),
        guaranteeDeductionAmount: existingEntry.guaranteeDeduction || Math.min(100, capRemaining),
        lateRateRule: existingEntry.lateRateRule || worker.lateRateRule || 'normal',
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
        baseWage: worker.paymentType === 'month' ? 0 : worker.baseWage,
        travelAllowance: worker.defaultTravelAllowance,
        tollFee: 0,
        lateDeduction: 0,
        overtimeHours: 0,
        overtimeMinutes: 0,
        adjustments: injectedAdjustments,
        note: '',
        transferSlipUrl: '',
        transferSlips: [],
        tollReceiptUrl: '',
        tollDate: dateStr,
        tolls: [],
        isLeave: false,
        leaveType: 'ลากิจ',
        leaveNote: '',
        hasGuaranteeDeduction: (worker.hasGuarantee || false) && capRemaining > 0,
        guaranteeDeductionAmount: Math.min(100, capRemaining),
        lateRateRule: worker.lateRateRule || 'normal',
      });
      setEditingId(null);
    }
    hasUserEditedRef.current = false;
    setIsModalOpen(true);
    if (isAutoAddingNow) {
      setAutoDraftPending(true);
    }
  };

  useEffect(() => {
    if (autoDraftPending && isModalOpen) {
      handleSave(true, false);
      setAutoDraftPending(false);
    }
  }, [autoDraftPending, isModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(false);
  };



  const handleQuickUploadSlip = async (e: React.ChangeEvent<HTMLInputElement>, worker: typeof workers[0], entry: typeof entries[0] | undefined) => {
    e.stopPropagation();
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;

    try {
      setIsUploading(true);
      isUploadingRef.current = true;
      const publicUrls: string[] = [];
      const files = Array.from(filesList) as File[];

      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        if (file.type.startsWith('image/')) {
          file = await compressImage(file);
        }

        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${worker.id}/${fileName}`;

        const { error } = await supabase.storage
          .from('slips')
          .upload(filePath, file);

        if (error) {
          throw error;
        }

        const { data: publicUrlData } = supabase.storage
          .from('slips')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;
        publicUrls.push(publicUrl);

        // --- GOOGLE DRIVE WEBHOOK TRIGGER ---
        const webhookUrl = import.meta.env.VITE_GOOGLE_DRIVE_WEBHOOK_URL;
        if (webhookUrl) {
          try {
            const driveFormData = new URLSearchParams();
            driveFormData.append('workerName', worker.name || 'Unknown');
            driveFormData.append('date', dateStr);
            driveFormData.append('imageUrl', publicUrl);
            
            fetch(webhookUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: driveFormData.toString()
            }).catch(err => console.error("Webhook error:", err));
          } catch(err) {
            console.error("Webhook setup error:", err);
          }
        }
        // -------------------------------------
      }

      if (entry) {
        // Read the LATEST entry data from state to avoid stale closure reads
        const latestEntry = entries.find(ent => ent.id === entry.id);
        const existingSlips = latestEntry?.transferSlips || entry.transferSlips || [];
        const newSlips = [...existingSlips, ...publicUrls];
        await updateEntry(entry.id, { 
          transferSlipUrl: newSlips[0] || '',
          transferSlips: newSlips 
        });
      } else {
        const entryData = {
          workerId: worker.id,
          date: dateStr,
          clockIn: worker.shiftStart || '07:00',
          clockOut: worker.shiftEnd || '16:00',
          baseWage: worker.paymentType === 'month' ? 0 : worker.baseWage,
          travelAllowance: worker.defaultTravelAllowance || 0,
          tollFee: 0,
          tolls: [],
          lateDeduction: 0,
          overtimeHours: 0,
          overtimeMinutes: 0,
          overtimePay: 0,
          adjustments: [],
          totalPay: worker.baseWage + (worker.defaultTravelAllowance || 0),
          note: '',
          isDraft: true,
          transferSlipUrl: publicUrls[0] || '',
          transferSlips: publicUrls,
          tollReceiptUrl: '',
          tollDate: dateStr,
          guaranteeDeduction: 0,
        };
        await addEntry(entryData);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
      e.target.value = '';
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1200;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              // Convert to jpeg to ensure good compression, retain original extension logic
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file); // Fallback
            }
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(file); // Fallback
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file); // Fallback
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'transferSlipUrl' | 'tollReceiptUrl' | 'adjustments' | 'tolls', adjId?: string) => {
    let file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    isUploadingRef.current = true;

    if (file.type.startsWith('image/')) {
      file = await compressImage(file);
    }

    try {
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
        // Use functional update to always read the LATEST transferSlips array,
        // preventing stale reads when multiple files are uploaded rapidly.
        let latestSlips: string[] = [];
        setFormData(prev => {
          latestSlips = [...prev.transferSlips, publicUrl];
          return { ...prev, transferSlipUrl: latestSlips[0] || '', transferSlips: latestSlips };
        });
        
        // Wait one tick for setFormData to flush so latestSlips is populated
        await new Promise(r => setTimeout(r, 0));

        if (editingId) {
          await updateEntry(editingId, { 
            transferSlipUrl: latestSlips[0] || '',
            transferSlips: latestSlips 
          });
        }

        // --- GOOGLE DRIVE WEBHOOK TRIGGER ---
        const webhookUrl = import.meta.env.VITE_GOOGLE_DRIVE_WEBHOOK_URL;
        if (webhookUrl) {
          try {
            const driveFormData = new URLSearchParams();
            driveFormData.append('workerName', formData.workerName || 'Unknown');
            driveFormData.append('date', dateStr);
            driveFormData.append('imageUrl', publicUrl);
            
            fetch(webhookUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: driveFormData.toString()
            }).catch(e => console.error("Webhook error:", e));
          } catch(e) {
            console.error("Webhook setup error:", e);
          }
        }
        // -------------------------------------
      } else if (field === 'tollReceiptUrl') {
        setFormData(prev => ({ ...prev, tollReceiptUrl: publicUrl }));
        if (editingId) await updateEntry(editingId, { tollReceiptUrl: publicUrl });
      } else if (field === 'adjustments' && adjId) {
        let latestAdjustments: any[] = [];
        setFormData(prev => {
          latestAdjustments = prev.adjustments.map(a => a.id === adjId ? { ...a, receiptUrl: publicUrl } : a);
          return { ...prev, adjustments: latestAdjustments };
        });
        await new Promise(r => setTimeout(r, 0));
        if (editingId) await updateEntry(editingId, { adjustments: latestAdjustments });
      } else if (field === 'tolls' && adjId) {
        let latestTolls: any[] = [];
        setFormData(prev => {
          latestTolls = prev.tolls.map(t => t.id === adjId ? { ...t, receiptUrl: publicUrl } : t);
          return { ...prev, tolls: latestTolls };
        });
        await new Promise(r => setTimeout(r, 0));
        if (editingId) await updateEntry(editingId, { tolls: latestTolls });
      }

      // Auto-save logic if it's a new entry (not yet saved)
      if (!editingId) {
        // Use functional getter approach to get the true latest form state
        let currentForm = formData; // fallback
        setFormData(prev => { currentForm = prev; return prev; }); // read-only peek
        await new Promise(r => setTimeout(r, 0));

        const updatedTransferSlips = field === 'transferSlipUrl' ? [...currentForm.transferSlips] : currentForm.transferSlips;
        const updatedTollReceiptUrl = field === 'tollReceiptUrl' ? publicUrl : currentForm.tollReceiptUrl;
        const updatedAdjustments = field === 'adjustments' && adjId ? currentForm.adjustments : currentForm.adjustments;
        const updatedTolls = field === 'tolls' && adjId ? currentForm.tolls : currentForm.tolls;
        
        const otRatePerHour = 100;
        const otPay = (currentForm.overtimeHours * otRatePerHour) + (currentForm.overtimeMinutes / 60 * otRatePerHour);
        const tollTotal = updatedTolls.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const entryData = {
          workerId: currentForm.workerId,
          date: dateStr,
          clockIn: currentForm.clockIn,
          clockOut: currentForm.clockOut,
          baseWage: currentForm.baseWage,
          travelAllowance: currentForm.travelAllowance,
          tollFee: tollTotal,
          tolls: updatedTolls,
          lateDeduction: currentForm.lateDeduction,
          overtimeHours: currentForm.overtimeHours,
          overtimeMinutes: currentForm.overtimeMinutes,
          overtimePay: otPay,
          adjustments: updatedAdjustments,
          totalPay: currentForm.baseWage + currentForm.travelAllowance + tollTotal + otPay + updatedAdjustments.reduce((s, a) => s + (a.type==='add'?Number(a.amount):-Number(a.amount)), 0) - currentForm.lateDeduction - 0,
          note: currentForm.note,
          isDraft: true,
          isLeave: currentForm.isLeave,
          leaveType: currentForm.isLeave ? currentForm.leaveType : undefined,
          leaveNote: currentForm.isLeave ? currentForm.leaveNote : undefined,
          transferSlipUrl: updatedTransferSlips[0] || '',
          transferSlips: updatedTransferSlips,
          tollReceiptUrl: updatedTollReceiptUrl,
          tollDate: currentForm.tollDate,
          guaranteeDeduction: 0,
          lateRateRule: currentForm.lateRateRule,
        };
        
        const newId = await addEntry(entryData);
        setEditingId(newId);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
      e.target.value = '';
    }
  };

  const handleSave = async (isDraft: boolean, closeModal = true, showToast = true) => {
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
      transferSlipUrl: formData.transferSlips[0] || formData.transferSlipUrl || '', // fallback legacy string
      transferSlips: formData.transferSlips,
      tollReceiptUrl: formData.tollReceiptUrl,
      tollDate: formData.tollDate,
      guaranteeDeduction: (!isDraft && formData.hasGuaranteeDeduction && (!formData.isLeave || formData.leaveType === 'ลาครึ่งวัน')) 
        ? formData.guaranteeDeductionAmount
        : 0, 
      lateRateRule: formData.lateRateRule,
    };

    if (editingId) {
      await updateEntry(editingId, entryData);
    } else {
      const newId = await addEntry(entryData);
      setEditingId(newId);
    }
    
    if (showToast) {
      // Trigger save animation & toast
      setIsSaving(true);
      setSaveToastVisible(true);
      setTimeout(() => setIsSaving(false), 300);
      setTimeout(() => setSaveToastVisible(false), 1000);
    }
    if (closeModal) setIsModalOpen(false);
  };

  // Auto-save draft when form changes
  useEffect(() => {
    if (!isModalOpen || !formData.workerId || isUploading) return;
    if (!hasUserEditedRef.current) return;

    const timer = setTimeout(() => {
      // Double-check ref as a synchronous guard against React batching edge cases
      if (isUploadingRef.current) return;
      // Only auto-save if it doesn't revert a finalized entry to a draft
      const isCurrentlyDraft = editingId ? (entries.find(e => e.id === editingId)?.isDraft ?? true) : true;
      handleSave(isCurrentlyDraft, false, false);
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isModalOpen, isUploading]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 800);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const formatDailyCopyText = (
    worker: typeof workers[0],
    entry: typeof entries[0] | undefined,
    formattedDate: string,
    isAllDetailed = false
  ) => {
    const isEnglish = worker.copyLanguage === 'en';

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

    const wStart = worker.shiftStart || '07:00';
    const wEnd = worker.shiftEnd || '16:00';

    let text = '';
    if (isAllDetailed) {
      text += `👤 ${worker.name}\n`;
    } else {
      text += isEnglish
        ? `📝 Daily payroll for ${worker.name} (Date: ${formattedDate})\n`
        : `📝 แจ้งยอดรายวัน ${worker.name} (วันที่ ${formattedDate})\n`;
    }

    if (entry?.isLeave) {
      let leaveTypeRaw = (entry.leaveType as any) === 'ลาพักผ่อน' ? 'ลากิจ' : (entry.leaveType || 'ลากิจ');
      if (leaveTypeRaw === 'ลาครึ่งวัน') {
        text += isEnglish
          ? `Half-day Leave: Wage ฿${baseWage / 2}\n`
          : `ลาครึ่งวัน: ค่าแรง ฿${baseWage / 2}\n`;
        if (entry.guaranteeDeduction > 0) {
          text += isEnglish
            ? `- Accumulate Guarantee: -฿${entry.guaranteeDeduction}\n`
            : `- หักสะสม: ฿${entry.guaranteeDeduction}\n`;
        }
      } else {
        let leaveStr = '';
        if (isEnglish) {
          if (leaveTypeRaw === 'ลาป่วย') leaveStr = 'Sick Leave';
          else if (leaveTypeRaw === 'ลากิจ') leaveStr = 'Personal Leave';
          else if (leaveTypeRaw === 'ขาดงาน') leaveStr = 'Absent';
          else leaveStr = leaveTypeRaw;
        } else {
          leaveStr = leaveTypeRaw;
        }

        if (entry.leaveNote) {
          leaveStr += ` (${entry.leaveNote})`;
        }
        text += `${leaveStr}\n`;
      }
    } else {
      const actualStart = clockIn > wStart ? clockIn : wStart;
      const actualEnd = clockOut < wEnd ? clockOut : wEnd;
      text += isEnglish
        ? `Working hrs. : ${actualStart} - ${actualEnd}  Total: ฿${baseWage}\n`
        : `เวลาทำงาน: ${actualStart} - ${actualEnd}  ค่าแรง: ฿${baseWage}\n`;
      if (lateDeduction > 0) {
        text += isEnglish
          ? `Late Deduction: -฿${lateDeduction}\n`
          : `หักมาสาย: -฿${lateDeduction}\n`;
      }
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
        const durationStr = isEnglish
          ? ` (${mHours} hr${(mHours === 0 || mHours === 1) ? '' : 's'}${mMins > 0 ? ` ${mMins} min${mMins === 1 ? '' : 's'}` : ''})`
          : ` (${mHours} ชม.${mMins > 0 ? ` ${mMins} นาที` : ''})`;
        text += isEnglish
          ? `OT ${clockIn}-${wStart}${durationStr}: ฿${morningPay.toFixed(0)}\n`
          : `OT เช้า ${clockIn}-${wStart}${durationStr}: ฿${morningPay.toFixed(0)}\n`;
      }

      if (clockOut > wEnd) {
        const outTime = clockOut.split(':').map(Number);
        const endTime = wEnd.split(':').map(Number);
        eveningOtMins = (outTime[0] * 60 + outTime[1]) - (endTime[0] * 60 + endTime[1]);
        const eHours = Math.floor(eveningOtMins / 60);
        const eMins = eveningOtMins % 60;
        const eveningPay = (eveningOtMins / 60) * 100;
        const durationStr = isEnglish
          ? ` (${eHours} hr${(eHours === 0 || eHours === 1) ? '' : 's'}${eMins > 0 ? ` ${eMins} min${eMins === 1 ? '' : 's'}` : ''})`
          : ` (${eHours} ชม.${eMins > 0 ? ` ${eMins} นาที` : ''})`;
        text += isEnglish
          ? `OT ${wEnd}-${clockOut}${durationStr}: ฿${eveningPay.toFixed(0)}\n`
          : `OT เย็น ${wEnd}-${clockOut}${durationStr}: ฿${eveningPay.toFixed(0)}\n`;
      }

      if (morningOtMins === 0 && eveningOtMins === 0) {
        const otHours = entry?.overtimeHours || 0;
        const otMins = entry?.overtimeMinutes || 0;
        const otDurationInfo = isEnglish
          ? ` (${otHours} hr${(otHours === 0 || otHours === 1) ? '' : 's'}${otMins > 0 ? ` ${otMins} min${otMins === 1 ? '' : 's'}` : ''})`
          : ` (${otHours} ชม.${otMins > 0 ? ` ${otMins} นาที` : ''})`;
        text += `OT${otDurationInfo}: ฿${overtimePay}\n`;
      }
    }

    if (!entry?.isLeave || entry?.leaveType === 'ลาครึ่งวัน') {
      text += `\n`;
      if (travelAllowance > 0) {
        text += isEnglish
          ? `- Travel Allowance: ฿${travelAllowance}\n`
          : `- ค่ารถ: ฿${travelAllowance}\n`;
      }
      if (tollFee > 0) {
        text += isEnglish ? `- Toll Fee` : `- ทางด่วน`;
        const tollDates: string[] = [];
        if (entry?.tolls && entry.tolls.length > 0) {
          entry.tolls.forEach(t => {
            if (t.date) {
              const fDate = format(parseISO(t.date), 'dd/MM/yy');
              if (!tollDates.includes(fDate)) tollDates.push(fDate);
            }
          });
        } else if (entry?.tollDate) {
          tollDates.push(format(parseISO(entry.tollDate), 'dd/MM/yy'));
        }

        if (tollDates.length > 0) {
          text += isEnglish
            ? ` (Receipt date ${tollDates.join(', ')})`
            : ` (บิลลงวันที่ ${tollDates.join(', ')})`;
        }
        text += `: ฿${tollFee}\n`;
      }
      if (entry?.guaranteeDeduction && entry.guaranteeDeduction > 0) {
        text += isEnglish
          ? `- Guarantee Deduction: -฿${entry.guaranteeDeduction}\n`
          : `- หักเงินประกันสะสม: -฿${entry.guaranteeDeduction}\n`;
      }
    } else {
      text += `\n`;
    }

    if (adjustments && adjustments.length > 0) {
      adjustments.forEach(adj => {
        const amountStr = adj.type === 'add' ? `+฿${Number(adj.amount)}` : `-฿${Math.abs(Number(adj.amount))}`;
        if (isEnglish) {
          text += `- ${adj.note || 'Other'}: ${amountStr}\n`;
        } else {
          text += `- ${adj.note || 'อื่นๆ'}: ${amountStr}\n`;
        }
      });
    }

    if (isAllDetailed) {
      text += isEnglish
        ? `✅ Net Total: ฿${totalPay}`
        : `✅ ยอดสุทธิ: ฿${totalPay}`;
    } else {
      text += isEnglish
        ? `✅ Net Total Today: ฿${totalPay}`
        : `✅ ยอดสุทธิวันนี้: ฿${totalPay}`;
    }

    const paymentType = worker.paymentType || 'day';
    if (paymentType === 'month') {
      text += isEnglish ? `\n*Paid at end of month*` : `\n*รับเงินทุกสิ้นเดือน*`;
    } else if (paymentType === 'half-month') {
      text += isEnglish ? `\n*Paid mid-month*` : `\n*รับเงินกลางเดือน*`;
    }

    return text;
  };

  const handleCopySingle = async (worker: typeof workers[0], entry: typeof entries[0] | undefined, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent modal opening

    const idToUse = entry ? entry.id : worker.id;

    const thaiYear = selectedDate.getFullYear() + 543;
    const shortThaiYear = thaiYear.toString().slice(-2);
    const formattedDate = format(selectedDate, `dd/MM/${shortThaiYear}`);

    const text = formatDailyCopyText(worker, entry, formattedDate, false);

    handleCopy(text, idToUse);
  };

  const handleCopySlipImage = async (worker: typeof workers[0], entry: typeof entries[0] | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!entry) return;

    const images: string[] = [];
    if (entry?.transferSlipUrl) images.push(entry.transferSlipUrl);
    if (entry?.transferSlips) images.push(...entry.transferSlips);
    if (entry?.tollReceiptUrl) images.push(entry.tollReceiptUrl);
    if (entry?.tolls) {
      entry.tolls.forEach(t => { if (t.receiptUrl) images.push(t.receiptUrl); });
    }
    if (entry?.adjustments) {
      entry.adjustments.forEach(a => { if (a.receiptUrl) images.push(a.receiptUrl); });
    }

    const uniqueImages = [...new Set(images)].filter(url => url && !url.startsWith('data:'));
    if (uniqueImages.length === 0) return;

    // Use handleCopySingleImage for the first image found
    // This ensures consistency and uses the new robust logic
    await handleCopySingleImage(uniqueImages[0], e);
  };

  const handleCopyTollSlip = async (entry: typeof entries[0], e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const tollImages: string[] = [];
    if (entry?.tollReceiptUrl) tollImages.push(entry.tollReceiptUrl);
    if (entry?.tolls) entry.tolls.forEach(t => { if (t.receiptUrl) tollImages.push(t.receiptUrl); });
    const unique = [...new Set(tollImages)].filter(u => u && !u.startsWith('data:'));
    if (unique.length === 0) return;
    await handleCopySingleImage(unique[0], e);
  };

  const handleCopyAllSlips = async () => {
    if (workersWithSlips.length === 0) return;
    
    setIsCopyingAllSlips(true);
    setCopiedId('all_slips_loading');

    try {
      const slipsToProcess: { workerName: string, url: string }[] = [];
      
      workersWithSlips.forEach(w => {
        w.images.forEach((url, index) => {
          const label = w.images.length > 1 ? `${w.worker.name}_${index + 1}` : w.worker.name;
          slipsToProcess.push({ workerName: label, url });
        });
      });

      // Use pre-cached images first (should be instant if already loaded in background)
      setShareProgress({ current: 0, total: slipsToProcess.length });
      let doneCount = 0;

      const loadedImages: { name: string; img: HTMLImageElement }[] = [];

      for (const slip of slipsToProcess) {
        const cached = imageCacheRef.current.get(slip.url);
        if (cached && cached.complete && cached.naturalWidth > 0) {
          // Already in memory — instant!
          doneCount++;
          setShareProgress({ current: doneCount, total: slipsToProcess.length });
          loadedImages.push({ name: slip.workerName, img: cached });
        } else {
          // Not cached yet — load it now (and also cache for next time)
          try {
            const img = new Image();
            if (!slip.url.startsWith('data:')) img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
              img.onload = () => { imageCacheRef.current.set(slip.url, img); doneCount++; setShareProgress({ current: doneCount, total: slipsToProcess.length }); resolve(); };
              img.onerror = reject;
              img.src = slip.url;
            });
            loadedImages.push({ name: slip.workerName, img });
          } catch {
            doneCount++;
            setShareProgress({ current: doneCount, total: slipsToProcess.length });
          }
        }
      }

      if (loadedImages.length === 0) throw new Error('ไม่สามารถโหลดรูปภาพได้');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        const padding = 20;
        const labelHeight = 40;
        // Reduce target width to 600 to enable instant PNG encoding and prevent browser freezes
        const targetWidth = 600;
        
        const totalHeight = loadedImages.reduce((sum, li) => {
          const aspectRatio = li.img.height / li.img.width;
          const drawHeight = targetWidth * aspectRatio;
          return sum + drawHeight + labelHeight + padding;
        }, padding);

        canvas.width = targetWidth + (padding * 2);
        canvas.height = Math.min(totalHeight, 16384); 

        ctx.fillStyle = '#f8fafc'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let currentY = padding;
        loadedImages.forEach((li) => {
          const aspectRatio = li.img.height / li.img.width;
          const drawHeight = targetWidth * aspectRatio;
          ctx.fillStyle = '#f1f5f9'; 
          ctx.fillRect(padding - 10, currentY - 5, targetWidth + 20, 36);
          ctx.fillStyle = '#1e293b'; 
          ctx.font = 'bold 24px sans-serif';
          ctx.fillText(`👤 ${li.name.replace('_', ' ')}`, padding, currentY + 22);
          ctx.drawImage(li.img, padding, currentY + labelHeight, targetWidth, drawHeight);
          currentY += drawHeight + labelHeight + padding;
        });

        const blobPromise = new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('บีบอัดรูปภาพไม่สำเร็จ'));
          }, 'image/png');
        });

        const item = new ClipboardItem({ 'image/png': blobPromise });
        await navigator.clipboard.write([item]);
        
        setLastCopiedUrl('merged_slips_daily');
        setCopiedId('all_slips');

        setTimeout(() => {
          setLastCopiedUrl(null);
          setCopiedId(null);
        }, 1000);

    } catch (err) {
      // Ignore AbortError (user cancelled) and NotAllowedError (permission denied or no user gesture)
      if ((err as Error).name === 'AbortError' || (err as Error).name === 'NotAllowedError') {
        console.log('Share action cancelled by user or not allowed');
      } else {
        console.error('Share/Merge error:', err);
        alert('เกิดข้อผิดพลาด: ' + (err as Error).message);
      }
    } finally {
      setIsCopyingAllSlips(false);
      setShareProgress(null);
    }
  };

  const handleCopyAllDetailed = () => {
    const thaiYear = selectedDate.getFullYear() + 543;
    const shortThaiYear = thaiYear.toString().slice(-2);
    const formattedDate = format(selectedDate, `dd/MM/${shortThaiYear}`);

    let calculatedTotal = 0;
    
    // Pre-calculate the total sum of the workers that will be printed
    workers.forEach(worker => {
      const entry = entriesForDate.find(e => e.workerId === worker.id);
      if (!entry) return;
      const baseWage = entry ? entry.baseWage : worker.baseWage;
      const travelAllowance = entry ? entry.travelAllowance : (worker.defaultTravelAllowance || 0);
      calculatedTotal += entry ? entry.totalPay : (baseWage + travelAllowance);
    });

    let text = `📋 สรุปยอดรวมประจำวัน (วันที่ ${formattedDate})\n`;
    text += `💰 ยอดรวมทั้งหมด: ฿${calculatedTotal}\n`;
    text += `========================\n\n`;

    workers.forEach(worker => {
      const entry = entriesForDate.find(e => e.workerId === worker.id);
      
      // Only show people who came to work (have an entry)
      if (!entry) return;

      const workerText = formatDailyCopyText(worker, entry, formattedDate, true);
      text += workerText + '\n\n';
    });

    handleCopy(text, 'all_detailed');
  };

  const activeWorker = workers.find(w => w.id === activeTabWorkerId) || workers[0];
  const activeEntry = activeWorker ? entriesForDate.find(e => e.workerId === activeWorker.id) : undefined;
  
  const activeAdvanceTotal = useMemo(() => {
    if (!activeWorker) return 0;
    return advances
      .filter(a => a.workerId === activeWorker.id)
      .reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);
  }, [advances, activeWorker]);

  const handleOpenAdvanceModal = (worker: typeof workers[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setAdvanceFormData({
      workerId: worker.id,
      workerName: worker.name,
      amount: '',
      note: ''
    });
    setIsAdvanceModalOpen(true);
  };

  const handleAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceFormData.workerId || !advanceFormData.amount) return;

    addAdvance({
      workerId: advanceFormData.workerId,
      date: dateStr,
      type: 'borrow',
      amount: Number(advanceFormData.amount),
      note: advanceFormData.note
    });

    setIsAdvanceModalOpen(false);
  };

  const handleQuickLeaveInfo = (e: React.MouseEvent, leaveType: 'ลาป่วย' | 'ลากิจ' | 'ขาดงาน' | 'ลาครึ่งวัน') => {
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
      totalPay: leaveType === 'ลาครึ่งวัน' ? (activeWorker.baseWage - (activeWorker.hasGuarantee ? 100 : 0)) / 2 : 0,
      note: '',
      isDraft: false,
      isLeave: true,
      leaveType: leaveType,
      leaveNote: '',
      transferSlipUrl: '',
      transferSlips: [],
      tollReceiptUrl: '',
      tollDate: dateStr,
      guaranteeDeduction: leaveType === 'ลาครึ่งวัน' ? (activeWorker.hasGuarantee ? 100 : 0) : 0,
      lateRateRule: activeWorker.lateRateRule || 'normal',
    };
    addEntry(entryData);
  };

  const handleCopySingleImage = async (imageUrl: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setIsCopyingPreviewUrl(imageUrl);
    try {
      if (typeof ClipboardItem === 'undefined') {
        throw new Error('ClipboardItem not supported');
      }

      // Using Promise-based ClipboardItem for maximum reliability (Safari support)
      const data = [
        new ClipboardItem({
          'image/png': (async () => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const imgLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error('Image load failed'));
              img.src = imageUrl;
            });
            const loadedImg = await imgLoadPromise;
            const canvas = document.createElement('canvas');
            canvas.width = loadedImg.width;
            canvas.height = loadedImg.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas error');
            ctx.drawImage(loadedImg, 0, 0);
            return new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Blob error'));
              }, 'image/png', 1.0);
            });
          })()
        })
      ];

      await navigator.clipboard.write(data);
      setLastCopiedUrl(imageUrl);
      setTimeout(() => setLastCopiedUrl(null), 1000);
    } catch (err: any) {
      console.warn("Direct copy failed", err);
      // We only show alert if it truly fails to provide fallback instructions
      alert('ไม่สามารถคัดลอกรูปได้อัตโนมัติ กรุณากดแตะค้างที่รูปภาพแล้วเลือกคัดลอกแทนครับ');
    } finally {
      setIsCopyingPreviewUrl(null);
    }
  };

  const renderAllSummaryCard = () => {
    // group the workers
    const savedWorkers: typeof workers = [];
    const draftWorkers: typeof workers = [];
    const leaveWorkers: typeof workers = [];
    const pendingWorkers: typeof workers = [];

    workers.forEach(worker => {
      const entry = entriesForDate.find(e => e.workerId === worker.id);
      if (!entry) {
        pendingWorkers.push(worker);
      } else if (entry.isLeave) {
        leaveWorkers.push(worker);
      } else if (entry.isDraft) {
        draftWorkers.push(worker);
      } else {
        savedWorkers.push(worker);
      }
    });

    const renderWorkerRow = (worker: typeof workers[0]) => {
      const entry = entriesForDate.find(e => e.workerId === worker.id);
      const totalPay = entry ? entry.totalPay : (worker.baseWage + (worker.defaultTravelAllowance || 0));
      return (
        <div key={worker.id} onClick={() => { 
          setActiveTabWorkerId(worker.id); 
          if (window.innerWidth < 768) {
            setTimeout(() => {
              activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }
        }} className="flex justify-between items-center p-3 bg-white hover:bg-sky-50 rounded-xl border border-gray-100 cursor-pointer transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.99] group">
          <div className="flex-1 min-w-0 pr-2">
            <div className="font-semibold text-gray-900 group-hover:text-sky-700 transition-colors truncate">{worker.name}</div>
            <div className="text-xs mt-0.5 text-gray-500 truncate">
              {entry ? (
                entry.isLeave ? (
                  <span className="text-red-600 flex items-center gap-1 font-medium">
                    <X className="w-3 h-3" /> {entry.leaveType || 'ลากิจ'}
                  </span>
                ) : entry.isDraft ? (
                  <span className="text-amber-600 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3" /> ฉบับร่าง
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> {entry.clockIn} - {entry.clockOut}
                  </span>
                )
              ) : (
                <span className="text-gray-400 font-medium">รอการบันทึก ({worker.shiftStart || '07:00'}-{worker.shiftEnd || '16:00'})</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Slip image copy — icon only */}
            {entry && (entry.transferSlipUrl || entry.tolls?.some(t => t.receiptUrl) || entry.adjustments?.some(a => a.receiptUrl)) && (
              <button
                type="button"
                onClick={(e) => handleCopySlipImage(worker, entry, e)}
                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${lastCopiedUrl === entry.transferSlipUrl ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-violet-50 border-violet-100 text-violet-600 hover:bg-violet-100'}`}
                title="คัดลอกรูปสลิป"
              >
                {isCopyingImageId === entry.id || isCopyingPreviewUrl === entry.transferSlipUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : lastCopiedUrl === entry.transferSlipUrl ? <Check className="w-4 h-4" /> : <ImagePlus className="w-4 h-4 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />}
              </button>
            )}
            {/* Toll receipt copy — icon only, show when any toll receipt exists */}
            {entry && (entry.tollReceiptUrl || entry.tolls?.some(t => t.receiptUrl)) && (
              <button
                type="button"
                onClick={(e) => handleCopyTollSlip(entry, e)}
                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${lastCopiedUrl === entry.tollReceiptUrl || entry.tolls?.some(t => t.receiptUrl && lastCopiedUrl === t.receiptUrl) ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100'}`}
                title="คัดลอกบิลทางด่วน"
              >
                {lastCopiedUrl === entry.tollReceiptUrl || entry.tolls?.some(t => t.receiptUrl && lastCopiedUrl === t.receiptUrl) ? <Check className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
              </button>
            )}
            <div className={`font-bold text-base transition-colors ml-1 w-16 text-right ${entry?.isDraft ? 'text-amber-500 group-hover:text-amber-600' : 'text-red-500 group-hover:text-red-600'}`}>
              ฿{totalPay}
            </div>
          </div>
        </div>
      );
    };

    return (
      <Card className="p-4 md:p-6 flex flex-col items-stretch justify-start min-h-[200px] bg-white border-gray-100 shadow-sm animate-in fade-in zoom-in-95 duration-200 mt-2 mb-4 md:mt-0 md:mb-0">
        <div className="mb-4 text-center">
          <div className="font-bold text-gray-900 text-xl mb-1">สรุปข้อมูลช่างทุกคน</div>
          <div className="text-gray-500 text-sm">
            มาทำงานแล้ว <span className="font-bold text-red-600">{entriesForDate.length}</span> จาก {workers.length} คน
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full justify-center mb-6">
          <Button
            onClick={handleCopyAllDetailed}
            className="w-full sm:w-auto px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200 gap-1.5"
          >
            {copiedId === 'all_detailed' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            คัดลอกรายละเอียด ({workers.length})
          </Button>

          <Button
            onClick={handleCopyAllSlips}
            disabled={isCopyingAllSlips || totalSlipsCount === 0}
            className={`w-full sm:w-auto px-4 py-2 text-sm rounded-xl shadow-sm gap-1.5 transition-all ${lastCopiedUrl === 'merged_slips_daily' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-violet-600 hover:bg-violet-700 shadow-violet-200'} text-white`}
          >
            {isCopyingAllSlips ? <Loader2 className="w-4 h-4 animate-spin" /> : lastCopiedUrl === 'merged_slips_daily' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            คัดลอกรูป ({totalSlipsCount})
          </Button>
        </div>

        <div className="w-full space-y-5">
          {pendingWorkers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1 flex items-center gap-1.5 border-b pb-1.5">
                <Clock className="w-4 h-4" /> รอการบันทึก <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs ml-1">{pendingWorkers.length}</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {pendingWorkers.map(renderWorkerRow)}
              </div>
            </div>
          )}

          {draftWorkers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-600 mb-2 px-1 flex items-center gap-1.5 border-b border-amber-100 pb-1.5">
                <Clock className="w-4 h-4" /> ฉบับร่าง <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs ml-1">{draftWorkers.length}</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {draftWorkers.map(renderWorkerRow)}
              </div>
            </div>
          )}

          {savedWorkers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-emerald-600 mb-2 px-1 flex items-center gap-1.5 border-b border-emerald-100 pb-1.5">
                <CheckCircle2 className="w-4 h-4" /> บันทึกแล้ว <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs ml-1">{savedWorkers.length}</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {savedWorkers.map(renderWorkerRow)}
              </div>
            </div>
          )}

          {leaveWorkers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-600 mb-2 px-1 flex items-center gap-1.5 border-b border-red-100 pb-1.5">
                <X className="w-4 h-4" /> ลาหยุด / ขาดงาน <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs ml-1">{leaveWorkers.length}</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {leaveWorkers.map(renderWorkerRow)}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  const renderActiveWorkerCard = () => {
    if (!activeWorker) return null;
    return (
      <Card
        key={activeWorker.id}
        onClick={() => openModal(activeWorker, activeEntry)}
              className={`p-6 md:p-8 mt-2 mb-4 md:mt-0 md:mb-0 animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center justify-center min-h-[200px] text-center active:scale-[0.99] transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${activeEntry ? (activeEntry.isLeave ? (activeEntry.leaveType === 'ลาครึ่งวัน' ? 'border-pink-200 bg-gradient-to-b from-pink-50/50 to-white shadow-pink-100' : 'border-red-200 bg-gradient-to-b from-red-50/50 to-white shadow-red-100') : activeEntry.isDraft ? 'border-amber-200 bg-gradient-to-b from-amber-50/50 to-white shadow-amber-100' : 'border-sky-200 bg-gradient-to-b from-sky-50/50 to-white shadow-sky-100') : 'bg-white border-gray-100 hover:border-sky-300 shadow-sm'}`}
            >
              <div className="mb-4">
                <div className="font-bold text-gray-900 text-2xl mb-2">{activeWorker.name}</div>
                <div className="flex flex-col items-center gap-2">
                  {activeEntry ? (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-semibold shadow-sm ${activeEntry.isLeave ? (activeEntry.leaveType === 'ลาครึ่งวัน' ? 'bg-pink-100 text-pink-700' : 'bg-red-100 text-red-700') : activeEntry.isDraft ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                      {activeEntry.isLeave ? (activeEntry.leaveType === 'ลาครึ่งวัน' ? <Activity className="w-4 h-4" /> : <X className="w-4 h-4" />) : activeEntry.isDraft ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      {activeEntry.isLeave ? (activeEntry.leaveType || 'ลากิจ') : activeEntry.isDraft ? 'ฉบับร่าง' : 'บันทึกแล้ว'}
                      <span className={`${activeEntry.isLeave ? (activeEntry.leaveType === 'ลาครึ่งวัน' ? 'text-pink-800' : 'text-red-800') : activeEntry.isDraft ? 'text-amber-800' : 'text-sky-800'} ml-1`}>฿{activeEntry.totalPay}</span>
                      <span className={`${activeEntry.isLeave ? (activeEntry.leaveType === 'ลาครึ่งวัน' ? 'text-pink-600/70 border-pink-200' : 'text-red-600/70 border-red-200') : activeEntry.isDraft ? 'text-amber-600/70 border-amber-200' : 'text-sky-600/70 border-sky-200'} font-normal ml-1 border-l pl-2`}>
                        {activeEntry.isLeave ? (activeEntry.leaveType === 'ลาครึ่งวัน' ? 'มาทำงานครึ่งวัน' : 'ลาหยุด') : `${activeEntry.clockIn} - ${activeEntry.clockOut}`}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 flex items-center justify-center px-3 py-1 rounded-xl border border-gray-100">
                      รอการบันทึก • เวลาปกติ {activeWorker.shiftStart || '07:00'} - {activeWorker.shiftEnd || '16:00'}
                    </div>
                  )}

                  {activeAdvanceTotal > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                      <Wallet className="w-3.5 h-3.5" /> หนี้เบิกล่วงหน้าคงค้าง: ฿{activeAdvanceTotal.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center items-center w-full mb-3 pb-3 border-b border-gray-100 border-dashed">
                <div className="relative inline-block w-auto">
                  <Button 
                    variant="secondary" 
                    className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-sky-50 to-sky-100 text-sky-700 hover:from-sky-100 hover:to-sky-200 border-sky-200 shadow-sm flex items-center gap-1.5"
                    disabled={isUploading}
                    title="อัพโหลดสลิป"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />} 
                    อัพโหลดสลิป
                  </Button>
                  <input 
                    type="file" 
                    accept="image/*"
                    multiple
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleQuickUploadSlip(e, activeWorker, activeEntry)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-2">
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
                      className="p-2.5 h-auto rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 border-sky-100 min-w-[90px]"
                      title="คัดลอกสรุปรายการเป็นข้อความ"
                    >
                      {copiedId === activeEntry.id ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />}
                      <span className="ml-1 text-sm font-semibold pr-1">พิมพ์ข้อความ</span>
                    </Button>
                    {/* Per-slip thumbnail strip — one thumbnail + copy button per image */}
                    {(() => {
                      const slips: { url: string; isOrange: boolean }[] = [];
                      if (activeEntry?.transferSlips && activeEntry.transferSlips.length > 0) {
                        activeEntry.transferSlips.forEach(url => slips.push({ url, isOrange: false }));
                      } else if (activeEntry?.transferSlipUrl) { // Fallback for old data not migrated
                        slips.push({ url: activeEntry.transferSlipUrl, isOrange: false });
                      }
                      if (activeEntry?.tollReceiptUrl) slips.push({ url: activeEntry.tollReceiptUrl, isOrange: true });
                      if (activeEntry?.tolls) activeEntry.tolls.forEach(t => { if (t.receiptUrl) slips.push({ url: t.receiptUrl, isOrange: true }); });
                      if (activeEntry?.adjustments) activeEntry.adjustments.forEach(a => { if (a.receiptUrl) slips.push({ url: a.receiptUrl, isOrange: false }); });
                      if (slips.length === 0) return null;
                      return slips.map((slip, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImageUrl(slip.url);
                            }}
                            className="w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm hover:scale-105 transition-transform"
                          >
                            <img src={slip.url} alt="slip" className="w-full h-full object-cover" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopySingleImage(slip.url, e)}
                            className={`flex items-center justify-center h-9 px-2.5 rounded-xl border transition-all ${
                              lastCopiedUrl === slip.url
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                : slip.isOrange
                                  ? 'bg-orange-50 border-orange-100 text-orange-500 hover:bg-orange-100'
                                  : 'bg-violet-50 border-violet-100 text-violet-500 hover:bg-violet-100'
                            }`}
                          >
                            {lastCopiedUrl === slip.url ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            <span className="ml-1 text-[11px] font-bold">คัดลอกรูป</span>
                          </button>
                        </div>
                      ));
                    })()}
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
                      <Trash2 className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
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
                      {copiedId === activeWorker.id ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />}
                    </Button>
                    <div className="relative">
                      <Button
                        variant="danger"
                        onClick={(e) => { e.stopPropagation(); setShowLeaveDropdown(!showLeaveDropdown); }}
                        className="p-3 text-sm h-auto rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 font-medium whitespace-nowrap flex items-center gap-1.5"
                      >
                        <UserMinus className="w-4 h-4" />
                        ลา / ขาดงาน
                        <ChevronDown className={`w-4 h-4 transition-transform ${showLeaveDropdown ? 'rotate-180' : ''}`} />
                      </Button>
                      
                      {showLeaveDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowLeaveDropdown(false); }}></div>
                          <div className="absolute bottom-[calc(100%+8px)] left-0 p-2 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 z-50 flex flex-col gap-1 min-w-[140px] origin-bottom animate-in fade-in slide-in-from-bottom-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleQuickLeaveInfo(e, 'ลาป่วย'); setShowLeaveDropdown(false); }}
                              className="text-left px-3 py-2.5 text-sm rounded-lg hover:bg-orange-50 text-orange-600 font-medium transition-colors"
                            >
                              ลาป่วย
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleQuickLeaveInfo(e, 'ลากิจ'); setShowLeaveDropdown(false); }}
                              className="text-left px-3 py-2.5 text-sm rounded-lg hover:bg-yellow-50 text-yellow-600 font-medium transition-colors"
                            >
                              ลากิจ
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleQuickLeaveInfo(e, 'ขาดงาน'); setShowLeaveDropdown(false); }}
                              className="text-left px-3 py-2.5 text-sm rounded-lg hover:bg-red-50 text-red-600 font-medium transition-colors"
                            >
                              ขาดงาน
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleQuickLeaveInfo(e, 'ลาครึ่งวัน'); setShowLeaveDropdown(false); }}
                              className="text-left px-3 py-2.5 text-sm rounded-lg hover:bg-pink-50 text-pink-600 font-medium transition-colors"
                            >
                              ลาครึ่งวัน
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
    );
  };

  const isLoading = isWorkersLoading || isEntriesLoading;

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Save success Toast */}
      <Toast
        isVisible={saveToastVisible}
        message="บันทึกข้อมูลสำเร็จแล้ว! ✓"
        type="success"
        duration={1000}
      />
      {/* Copy / Upload Toast */}
      <Toast 
        isVisible={!saveToastVisible && (!!lastCopiedUrl || !!copiedId || !!shareProgress)}
        message={
          shareProgress ? `กำลังเตรียมรูป ${shareProgress.current}/${shareProgress.total} ⏳` :
          lastCopiedUrl === 'merged_slips_daily' ? 'คัดลอกรูปภาพทุกคนสำเร็จ!' :
          lastCopiedUrl ? 'คัดลอกรูปภาพสำเร็จ!' : 
          copiedId === 'all_slips_loading' ? 'กำลังประมวลผลรูปภาพ...' :
          'คัดลอกข้อความสำเร็จ!'
        }
        type={(copiedId === 'all_slips_loading' || shareProgress) ? 'info' : 'success'}
        icon={(copiedId === 'all_slips_loading' || shareProgress) ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}
      />

      {/* ─── Skeleton Loading Screen ─── */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <Skeleton className="h-14 w-full rounded-[2rem]" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-10 rounded-2xl" />
            <Skeleton className="h-10 rounded-2xl" />
            <Skeleton className="h-10 rounded-2xl" />
          </div>
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3 rounded-xl" />
                <Skeleton className="h-3 w-1/2 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-20 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* ─── Main Content (hidden while loading) ─── */}
      {!isLoading && (
      <>
      {/* Date Selector */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-2 rounded-[2rem] shadow-sm border border-white">
        <motion.button 
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setSelectedDate(subDays(selectedDate, 1))} 
          className="p-3 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-2xl transition-colors"
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.2px]" />
        </motion.button>
        <div className="text-center flex-1 relative group py-1">
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${isHoliday ? 'text-purple-500' : 'text-red-500'}`}>
            {isHoliday ? `🎌 ${currentHoliday!.name}` : format(selectedDate, 'EEEE', { locale: th })}
          </div>
          <div className="text-lg font-extrabold text-gray-900 group-hover:scale-105 transition-transform">{format(selectedDate, 'd MMM yyyy', { locale: th })}</div>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1, x: 2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setSelectedDate(addDays(selectedDate, 1))} 
          className="p-3 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-2xl transition-colors"
        >
          <ChevronRight className="w-6 h-6 stroke-[2.2px]" />
        </motion.button>
      </div>

      {isSunday(selectedDate) && !isHoliday && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 p-4 rounded-3xl shadow-sm flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-base mb-0.5">วันนี้คือวันอาทิตย์ (วันหยุดประจำสัปดาห์)</p>
            <p className="text-orange-600/90 leading-relaxed">ปกติแล้วไม่ต้องบันทึกเวลาทำงาน แต่หากมีการเข้ามาทำงาน สามารถบันทึกเวลาที่นี่ และบวก "โบนัสพิเศษ" หรือ "ค่าแรงวันหยุด" ในช่อง <span className="font-semibold underline">รายการปรับปรุง</span> ได้เลยครับ</p>
          </div>
        </div>
      )}

      {/* Public Holiday Banner */}
      {isHoliday && (
        <div className="bg-purple-50 border border-purple-200 text-purple-700 p-4 rounded-3xl shadow-sm flex items-start justify-between gap-3 text-sm">
          <div className="flex items-start gap-3">
            <CalendarOff className="w-5 h-5 shrink-0 mt-0.5 text-purple-500" />
            <div>
              <p className="font-bold text-base mb-0.5">🎌 {currentHoliday!.name}</p>
              <p className="text-purple-600/90 leading-relaxed">วันหยุดนักขัตฤกษ์ — ไม่ต้องบันทึกงานในวันนี้ หากมีช่างมาทำงาน สามารถบันทึกได้ตามปกติ</p>
            </div>
          </div>
          <button
            onClick={() => deleteHoliday(currentHoliday!.id)}
            className="shrink-0 text-purple-400 hover:text-purple-600 text-xs underline whitespace-nowrap mt-0.5"
          >
            ยกเลิกวันหยุด
          </button>
        </div>
      )}

      {/* Mark as holiday button (shown when not already a holiday) */}
      {!isHoliday && !isSunday(selectedDate) && (
        <button
          onClick={() => {
            const name = prompt('ระบุชื่อวันหยุด เช่น สงกรานต์วัน 1');
            if (name && name.trim()) addHoliday(dateStr, name.trim());
          }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-2xl border border-dashed border-purple-200 text-purple-500 hover:bg-purple-50 hover:border-purple-400 transition-all text-sm font-medium"
        >
          <CalendarOff className="w-4 h-4" />
          ตั้งค่าวันหยุด
        </button>
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
        <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-2 pb-4 md:pb-0">
          {workers.length === 0 ? (
            <div className="text-center py-10 md:py-6 text-sm text-gray-400 bg-white rounded-3xl md:rounded-2xl border border-dashed border-gray-200">
              ไม่มีข้อมูลช่าง
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm pt-0 pb-2">
                <input
                  type="text"
                  placeholder="🔍 ค้นหาชื่อช่าง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 bg-white shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 text-sm transition-all"
                />
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto pr-1 pb-2 md:max-h-[calc(100vh-270px)] custom-scrollbar">
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTabWorkerId('all')}
                    className={`flex items-center justify-between p-3.5 md:p-3 rounded-2xl md:rounded-xl text-left transition-all duration-300 flex-shrink-0 border hover:scale-[1.02] active:scale-[0.98] ${activeTabWorkerId === 'all' ? 'bg-gradient-to-r from-sky-500 to-sky-600 border-sky-500 text-white shadow-md shadow-sky-200' : 'bg-white border-gray-100 text-gray-700 hover:bg-sky-50 hover:border-sky-200'}`}
                  >
                    <span className="font-semibold text-[15px]">📋 ข้อมูลทุกคน</span>
                  </button>
                )}
                
                {activeTabWorkerId === 'all' && (
                  <div className="md:hidden relative z-10 w-full mb-4">
                    {renderAllSummaryCard()}
                  </div>
                )}
                {(() => {
                  const filteredWorkers = workers.filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()));
                  const pendingW: typeof workers = [];
                  const draftW: typeof workers = [];
                  const savedW: typeof workers = [];
                  const leaveW: typeof workers = [];

                  filteredWorkers.forEach(w => {
                    const entry = entriesForDate.find(e => e.workerId === w.id);
                    if (!entry) pendingW.push(w);
                    else if (entry.isLeave) leaveW.push(w);
                    else if (entry.isDraft) draftW.push(w);
                    else savedW.push(w);
                  });

                  const renderWorkerButton = (worker: typeof workers[0]) => {
                    const entry = entriesForDate.find(e => e.workerId === worker.id);
                    const isActive = worker.id === activeTabWorkerId;
                    const isDraft = entry?.isDraft;
                    return (
                      <React.Fragment key={worker.id}>
                        <button
                          onClick={() => setActiveTabWorkerId(worker.id)}
                          className={`flex items-center justify-between p-3.5 md:p-3 rounded-2xl md:rounded-xl text-left transition-all duration-300 flex-shrink-0 border hover:scale-[1.02] active:scale-[0.98] ${isActive ? (entry?.isLeave ? (entry.leaveType === 'ลาครึ่งวัน' ? 'bg-gradient-to-r from-pink-500 to-pink-600 border-pink-500 text-white shadow-md shadow-pink-200' : 'bg-gradient-to-r from-red-500 to-red-600 border-red-500 text-white shadow-md shadow-red-200') : isDraft ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-500 text-white shadow-md shadow-amber-200' : 'bg-gradient-to-r from-sky-500 to-sky-600 border-sky-500 text-white shadow-md shadow-sky-200') : (entry?.isLeave ? (entry.leaveType === 'ลาครึ่งวัน' ? 'bg-pink-50 border-pink-200 text-pink-900 hover:bg-pink-100 shadow-sm' : 'bg-red-50 border-red-200 text-red-900 hover:bg-red-100 shadow-sm') : isDraft ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 shadow-sm' : 'bg-white border-gray-100 text-gray-700 hover:bg-sky-50 hover:border-sky-200')}`}
                        >
                          <span className="font-semibold text-[15px]">{worker.name}</span>
                          {entry && (
                            <div className="flex items-center gap-1 ml-2">
                              {/* Transfer slip indicator */}
                              {entry.transferSlipUrl && <Paperclip className={`w-3.5 h-3.5 flex-shrink-0 stroke-[2.5px] ${isActive ? 'text-white/80' : 'text-sky-400'}`} />}
                              {/* Toll status indicator */}
                              {(() => {
                                const hasTollFee = (entry.tollFee > 0) || entry.tolls?.some(t => t.amount > 0);
                                const hasTollReceipt = !!(entry.tollReceiptUrl || entry.tolls?.some(t => t.receiptUrl));
                                if (!hasTollFee) return null;
                                if (hasTollReceipt) {
                                  // Uploaded ✓
                                  return <Wallet className="w-3.5 h-3.5 flex-shrink-0 stroke-[2.5px] " />;
                                } else {
                                  // Missing receipt ?
                                  return <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 stroke-[2.5px] ${isActive ? 'text-yellow-200' : 'text-yellow-500'}`} />;
                                }
                              })()}
                              {entry.isLeave ? (entry.leaveType === 'ลาครึ่งวัน' ?
                                <Activity className={`w-4 h-4 flex-shrink-0 stroke-[3px] ${isActive ? 'text-pink-100' : 'text-pink-500'}`} /> :
                                <X className={`w-4 h-4 flex-shrink-0 stroke-[3px] ${isActive ? 'text-red-100' : 'text-red-500'}`} />) :
                                isDraft ?
                                  <Clock className={`w-4 h-4 flex-shrink-0 stroke-[3px] ${isActive ? 'text-amber-100' : 'text-amber-500'}`} /> :
                                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 stroke-[3px] ${isActive ? 'text-sky-100' : 'text-emerald-500'}`} />
                              }
                            </div>
                          )}
                        </button>
                        {isActive && (
                          <div className="md:hidden relative z-10 w-full mb-4">
                            {renderActiveWorkerCard()}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  };

                  return (
                    <div className="flex flex-col gap-5 mt-2">
                      {pendingW.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> รอการบันทึก ({pendingW.length})</div>
                          {pendingW.map(renderWorkerButton)}
                        </div>
                      )}
                      {draftW.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider px-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> ฉบับร่าง ({draftW.length})</div>
                          {draftW.map(renderWorkerButton)}
                        </div>
                      )}
                      {savedW.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider px-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> บันทึกแล้ว ({savedW.length})</div>
                          {savedW.map(renderWorkerButton)}
                        </div>
                      )}
                      {leaveW.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="text-[11px] font-bold text-red-500 uppercase tracking-wider px-2 flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> ลาหยุด / ขาดงาน ({leaveW.length})</div>
                          {leaveW.map(renderWorkerButton)}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {/* Right Active Content (Desktop Only) */}
        <div className="hidden md:block w-full md:w-2/3 lg:w-3/4">
          {activeTabWorkerId === 'all' ? renderAllSummaryCard() : (workers.length > 0 && activeWorker ? renderActiveWorkerCard() : null)}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.workerName}
        maxWidth="max-w-4xl"
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          onChange={() => {
            hasUserEditedRef.current = true;
          }}
          onInput={() => {
            hasUserEditedRef.current = true;
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (
              target.closest('button') ||
              target.closest('input') ||
              target.closest('label') ||
              target.closest('select') ||
              target.closest('textarea')
            ) {
              hasUserEditedRef.current = true;
            }
          }}
        >
          {customAllowanceMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 p-4 rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center gap-4 border border-emerald-400/50"
            >
              <div className="bg-white/20 backdrop-blur-md p-2.5 rounded-xl text-white shadow-inner shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <span className="text-white font-medium text-base tracking-wide drop-shadow-sm">
                {customAllowanceMessage}
              </span>
            </motion.div>
          )}
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
                      { id: 'ขาดงาน', label: 'ขาดงาน' },
                      { id: 'ลาครึ่งวัน', label: 'ลาครึ่งวัน' }
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-6">
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

              {(() => {
                const w = workers.find(w => w.id === formData.workerId);
                if (!w?.hasGuarantee || (formData.isLeave && formData.leaveType !== 'ลาครึ่งวัน')) return null;

                const limit = w.guaranteeLimit ?? 10000;
                const total = getWorkerGuaranteeTotal(w.id, editingId || undefined);
                const cap = Math.max(0, limit - total);
                const isReached = cap <= 0;
                const isNear = cap > 0 && cap <= 300;

                return (
                  <div className="bg-orange-50/50 p-4 rounded-3xl border border-orange-100 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold text-orange-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-orange-500" /> หักเงินประกันสะสม</span>
                        <span className="text-[11px] text-orange-600 mt-0.5">ยอดสะสม: ฿{total.toLocaleString()} / ลิมิต: ฿{limit.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {formData.hasGuaranteeDeduction && !isReached && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold text-orange-700">฿</span>
                            <Input type="number" min="0" max={cap} value={formData.guaranteeDeductionAmount || ''} onChange={(e) => setFormData(p => ({ ...p, guaranteeDeductionAmount: Math.min(Number(e.target.value), cap) }))} className="w-20 font-semibold h-9 text-sm px-2 text-right border-orange-200" />
                          </div>
                        )}
                        <label className={`relative inline-flex items-center ml-auto ${isReached ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input type="checkbox" className="sr-only peer" disabled={isReached} checked={formData.hasGuaranteeDeduction && !isReached} onChange={(e) => setFormData(p => ({ ...p, hasGuaranteeDeduction: e.target.checked }))} />
                          <div className="w-11 h-6 bg-orange-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                    </div>
                    {isReached && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded-xl flex items-center gap-2 font-medium border border-red-100">
                        เงินประกันครบกำหนดแล้ว - ระบบหยุดหักเงินอัตโนมัติ
                      </div>
                    )}
                    {isNear && !isReached && (
                      <div className="text-xs text-orange-700 bg-orange-100/50 p-2 rounded-xl flex items-center gap-2 font-medium border border-orange-200">
                        ข้อควรระวัง: เงินประกันใกล้ครบกำหนดแล้ว (เหลืออีก {cap.toLocaleString()} ฿)
                      </div>
                    )}
                  </div>
                );
              })()}



            </div>

            <div className="space-y-6">

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
                    <Plus className="w-3 h-3 mr-1 stroke-[2.5px]" /> เพิ่มบิล
                  </Button>
                </div>
                {formData.tolls.length === 0 && (
                  <div className="text-[10px] text-gray-500 text-center py-2 bg-white rounded-xl border border-dashed border-sky-200">ไม่มีรายการทางด่วน</div>
                )}
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 pb-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
                  {formData.tolls.map((toll) => (
                    <div key={toll.id} className="flex gap-2 items-center bg-white p-2 text-sm rounded-xl border border-sky-100 shadow-sm animate-in fade-in slide-in-from-top-1">
                      <div className="flex-1 relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={toll.amount || ''}
                          onChange={(e) => setFormData(p => ({
                            ...p,
                            tolls: p.tolls.map(t => t.id === toll.id ? { ...t, amount: Number(e.target.value.replace(/[^0-9]/g, '')) } : t)
                          }))}
                          className="font-semibold text-sm h-9 px-2"
                          placeholder="ค่าทางด่วน (บาท)"
                        />
                        <label className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-sky-500 transition-colors" title="แนบใบเสร็จ">
                          <ImagePlus className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
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
                      <div className="flex items-center shrink-0 w-auto justify-center gap-1">
                        {toll.receiptUrl && (
                          <>
                            <button type="button" onClick={() => setPreviewImageUrl(toll.receiptUrl || '')} className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-100" title="ดูใบเสร็จ">
                              <ImagePlus className="w-4 h-4 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
                            </button>
                            <button type="button" onClick={(e) => handleCopySingleImage(toll.receiptUrl!, e)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${lastCopiedUrl === toll.receiptUrl ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-100'}`} title="คัดลอกรูป">
                              {lastCopiedUrl === toll.receiptUrl ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />}
                            </button>
                            <button
                              type="button"
                              title="ลบรูปบิล"
                              className="p-1.5 rounded-lg text-red-400 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
                              onClick={async () => {
                                const newTolls = formData.tolls.map(t => t.id === toll.id ? { ...t, receiptUrl: undefined } : t);
                                setFormData(p => ({ ...p, tolls: newTolls }));
                                if (editingId) await updateEntry(editingId, { tolls: newTolls });
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                      <button type="button" onClick={() => setFormData(p => ({ ...p, tolls: p.tolls.filter(t => t.id !== toll.id) }))} className="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 p-1.5 rounded-lg shrink-0 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adjustments */}
              <div className="flex flex-col gap-3">
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
                    <Plus className="w-3 h-3 mr-1 stroke-[2.5px]" /> เพิ่มรายการ
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

                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 pb-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
                  {formData.adjustments.map((adj) => (
                  <div key={adj.id} className="flex gap-2 items-start bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-2">
                        <select
                          value={adj.type}
                          onChange={(e) => {
                            const newAdjs = formData.adjustments.map(a => a.id === adj.id ? { ...a, type: e.target.value as 'add' | 'deduct' } : a);
                            setFormData(p => ({ ...p, adjustments: newAdjs }));
                          }}
                          className={`h-9 rounded-xl border-0 px-3 text-sm focus:ring-2 focus:ring-sky-500 font-medium ${adj.type === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          <option value="add">เพิ่มเงิน (+)</option>
                          <option value="deduct">หักเงิน (-)</option>
                        </select>
                        <Input
                          type="number"
                          placeholder="จำนวนเงิน"
                          value={adj.amount || ''}
                          onChange={(e) => {
                            const newAdjs = formData.adjustments.map(a => a.id === adj.id ? { ...a, amount: Number(e.target.value) } : a);
                            setFormData(p => ({ ...p, adjustments: newAdjs }));
                          }}
                          className="h-9 text-sm bg-white"
                        />
                      </div>
                      <div className="relative w-full">
                        <Input
                          type="text"
                          list={`note-presets-${adj.id}`}
                          placeholder="ระบุหมายเหตุ (เช่น ค่ารถไปงานที่ 1, อื่นๆ)"
                          value={adj.note}
                          onChange={(e) => {
                            const newAdjs = formData.adjustments.map(a => a.id === adj.id ? { ...a, note: e.target.value } : a);
                            setFormData(p => ({ ...p, adjustments: newAdjs }));
                          }}
                          className={`h-9 text-sm bg-white w-full ${adj.receiptUrl ? 'pr-20' : 'pr-8'}`}
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
                            <button type="button" onClick={(e) => handleCopySingleImage(adj.receiptUrl!, e)} className={`p-1 rounded transition-all ${lastCopiedUrl === adj.receiptUrl ? 'text-emerald-600 bg-emerald-50' : 'text-violet-600 hover:text-violet-700 hover:bg-violet-50'}`} title="คัดลอกรูป">
                              {lastCopiedUrl === adj.receiptUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button type="button" onClick={() => {
                              const newAdjs = formData.adjustments.map(a => a.id === adj.id ? { ...a, receiptUrl: '' } : a);
                              setFormData(p => ({ ...p, adjustments: newAdjs }));
                            }} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors" title="ลบรูป">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <label className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer transition-colors text-gray-400 hover:text-sky-500 ${adj.receiptUrl ? 'bg-white p-1 rounded-md' : ''} z-0`} title={adj.receiptUrl ? 'อัพโหลดรูปใหม่' : 'แนบสลิป/ใบเสร็จ'}>
                          <ImagePlus className="w-4 h-4 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
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
                      <Trash2 className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
                    </button>
                  </div>
                ))}
                {formData.adjustments.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-2xl">
                    ไม่มีรายการเพิ่มเติม
                  </div>
                )}
                </div>
              </div>
            </div>
            </div>
          )}

          <div className="flex flex-col gap-4 pt-4 mt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 font-medium">ยอดสุทธิ</div>
                <div className="text-3xl font-bold text-red-600">฿{calculateTotal()}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-col gap-2 relative">
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {/* Map all transfer slips */}
                    {formData.transferSlips && formData.transferSlips.map((slipUrl, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-100 shadow-sm relative pr-2">
                        <button type="button" onClick={() => setPreviewImageUrl(slipUrl)} className="shrink-0 group relative rounded-lg overflow-hidden border border-emerald-200" title="คลิกเพื่อดูสลิปโอนเงิน">
                          <img src={slipUrl} alt={`slip-${idx}`} className="w-10 h-10 object-cover group-hover:scale-110 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                            <span className="text-[9px] text-white font-bold tracking-wide">ดูสลิป</span>
                          </div>
                        </button>
                        <button type="button" onClick={(e) => handleCopySingleImage(slipUrl, e)} className={`flex items-center justify-center w-10 h-10 rounded-xl ml-1 transition-all border ${lastCopiedUrl === slipUrl ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-100'}`} title="คัดลอกรูปสลิป">
                          {lastCopiedUrl === slipUrl ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />}
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            if (window.confirm('ต้องการลบสลิปโอนเงินรูปนี้ใช่หรือไม่?')) {
                              const newSlips = formData.transferSlips.filter((_, index) => index !== idx);
                              setFormData(p => ({ 
                                ...p, 
                                transferSlips: newSlips,
                                transferSlipUrl: newSlips[0] || ''
                              }));
                            }
                          }} 
                          className="absolute -top-1 -right-1 bg-white flex items-center justify-center w-5 h-5 rounded-full text-red-500 border border-gray-100 shadow-sm hover:bg-red-50 hover:text-red-600 hover:scale-110 transition-all z-10" 
                          title="ลบสลิปนี้"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    
                    <label className={`flex shrink-0 items-center justify-center gap-2 h-[50px] px-3 rounded-xl cursor-pointer transition-all border ${isUploading ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed' : formData.transferSlips.length > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600'}`} title="เพิ่มสลิปโอนเงิน">
                      {isUploading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-semibold whitespace-nowrap hidden sm:inline">กำลังอัพ...</span>
                        </>
                      ) : formData.transferSlips.length > 0 ? (
                        <>
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-semibold whitespace-nowrap">เพิ่มสลิป</span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="w-4 h-4 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
                          <span className="text-sm font-medium whitespace-nowrap">แนบสลิปโอนเงิน</span>
                        </>
                      )}
                      <input disabled={isUploading} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'transferSlipUrl')} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center items-center w-full pb-3 mt-1">
              <Button 
                type="button"
                variant="secondary" 
                onClick={(e) => {
                  const worker = workers.find(w => w.id === formData.workerId);
                  if (worker) handleOpenAdvanceModal(worker, e);
                }}
                className="w-full px-4 py-3 text-sm rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 shadow-sm flex items-center justify-center gap-1.5"
                title="ทำรายการเบิกเงินล่วงหน้า"
              >
                <ArrowDownCircle className="w-5 h-5 mb-0.5" /> ทำรายการเบิกเงินล่วงหน้า
              </Button>
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
                  <Trash2 className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
                </Button>
              )}
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                animate={isSaving ? { scale: [1, 1.07, 1], transition: { duration: 0.35 } } : {}}
                disabled={isUploading}
                className="px-6 py-4 text-base rounded-2xl shadow-sm bg-orange-500 hover:bg-orange-600 text-white flex-1 disabled:opacity-50 inline-flex items-center justify-center font-semibold"
                onClick={() => handleSave(true)}
              >
                {isUploading ? 'รออัพโหลดรูป...' : 'บันทึกฉบับร่าง'}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                animate={isSaving ? { scale: [1, 1.09, 1], transition: { duration: 0.4 } } : {}}
                disabled={isUploading}
                className="px-6 py-4 text-base rounded-2xl shadow-lg shadow-sky-200 flex-1 bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50 inline-flex items-center justify-center font-semibold"
                onClick={() => handleSave(false)}
              >
                {isUploading ? 'รออัพโหลดรูป...' : 'บันทึกสมบูรณ์'}
              </motion.button>
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
            <div className="flex w-full gap-2 mt-6">
              <Button
                onClick={(e) => handleCopySingleImage(previewImageUrl, e)}
                disabled={isCopyingPreviewUrl === previewImageUrl}
                className={`flex-1 py-3 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 font-semibold ${lastCopiedUrl === previewImageUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 hover:bg-violet-200 text-violet-700'}`}
              >
                {isCopyingPreviewUrl === previewImageUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : lastCopiedUrl === previewImageUrl ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />}
                {lastCopiedUrl === previewImageUrl ? 'คัดลอกแล้ว!' : 'คัดลอกรูปภาพ'}
              </Button>
              <Button
                onClick={() => setPreviewImageUrl(null)}
                className="flex-1 py-3 rounded-2xl shadow-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
              >
                ปิดหน้าต่าง
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Slip Viewer Modal for Copying */}
      <Modal
        isOpen={!!dailySlipsViewer}
        onClose={() => setDailySlipsViewer(null)}
        title={`สลิปที่แนบ - ${dailySlipsViewer?.workerName}`}
      >
        {dailySlipsViewer && (
          <div className="flex flex-col items-center">
            <div className="text-sm text-gray-600 font-medium mb-3 text-center bg-gray-50 p-3 rounded-xl w-full">
              👉 <span className="text-gray-900 font-bold">วิธีคัดลอกรูปภาพ:</span><br /> แตะค้างที่รูปภาพด้านล่าง <br />แล้วเลือกคำว่า <b>"คัดลอก"</b> (Copy) หรือ <b>"บันทึก"</b> (Save)
            </div>

            <div className="max-h-[50vh] overflow-y-auto mb-4 w-full flex flex-col gap-3 border border-gray-100 bg-gray-50/50 p-2 rounded-xl shadow-inner">
              {dailySlipsViewer.images.map((imgUrl, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white flex flex-col justify-center p-2 gap-2">
                  <img src={imgUrl} alt={`Slip ${i}`} className="max-w-full h-auto object-contain max-h-[400px]" />
                  <Button
                    onClick={(e) => handleCopySingleImage(imgUrl, e)}
                    disabled={isCopyingPreviewUrl === imgUrl}
                    className="w-full py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold flex items-center justify-center gap-2"
                  >
                    {isCopyingPreviewUrl === imgUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    คัดลอกรูปลงคลิปบอร์ด
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={() => setDailySlipsViewer(null)} variant="primary" className="w-full py-3.5 rounded-xl">
              ปิดหน้าต่าง
            </Button>
          </div>
        )}
      </Modal>
      {/* Advance Payment Modal */}
      <Modal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        title={`เบิกเงินล่วงหน้า - ${advanceFormData.workerName}`}
      >
        <form onSubmit={handleAdvanceSubmit} className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm flex items-center justify-between">
            <span className="text-orange-800 font-medium text-sm">วันที่ทำรายการ</span>
            <span className="text-orange-600 font-bold">{format(selectedDate, 'd MMM yyyy', { locale: th })}</span>
          </div>
          
          <div className="space-y-2">
            <Label>จำนวนเงิน (บาท)</Label>
            <Input
              type="number"
              min="1"
              placeholder="ระบุจำนวนเงินเบิกล่วงหน้า"
              value={advanceFormData.amount}
              onChange={e => setAdvanceFormData(p => ({ ...p, amount: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>หมายเหตุ / ช่องทางการรับเงิน (ถ้ามี)</Label>
            <Input
              type="text"
              placeholder="เช่น เบิกค่ากิน, เบิกค่ารถ, รับเงินสด"
              value={advanceFormData.note}
              onChange={e => setAdvanceFormData(p => ({ ...p, note: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsAdvanceModalOpen(false)} className="flex-1 rounded-xl">ยกเลิก</Button>
            <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 shadow-orange-200 shadow-lg text-white rounded-xl flex justify-center items-center gap-1.5">
              <ArrowDownCircle className="w-4 h-4" /> บันทึกเบิกเงิน
            </Button>
          </div>
        </form>
      </Modal>

      </>
      )}
    </div>
  );
}
