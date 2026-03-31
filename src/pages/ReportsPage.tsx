import React, { useState, useMemo } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Card, Label, Toast } from '../components/ui';
import { parseISO, startOfMonth, endOfMonth, isWithinInterval, format, isSunday, eachDayOfInterval } from 'date-fns';
import { FileSpreadsheet, Copy, Check, Image as ImageIcon, X, ImagePlus, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../components/ui';
import * as XLSX from 'xlsx-js-style';
import { SlipModal } from '../components/SlipModal';


export function ReportsPage() {
  const { workers, entries, advances } = useStore();

  // Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSlipData, setSelectedSlipData] = useState<any>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [selectedAdjustments, setSelectedAdjustments] = useState<{ workerName: string, list: { note: string, amount: number, type: 'add' | 'deduct', date: string, receiptUrl?: string }[] } | null>(null);
  const [lastCopiedUrl, setLastCopiedUrl] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<{ workerId: string, workerName: string, metricName: string, metricType: 'days' | 'leave' | 'baseWage' | 'travel' | 'ot' | 'late' | 'guarantee' | 'advance' | 'net' } | null>(null);

  const reportData = useMemo(() => {
    const filteredEntries = entries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return !entry.isDraft && isWithinInterval(entryDate, {
        start: parseISO(startDate),
        end: parseISO(endDate)
      });
    });

    const summary = workers.map(worker => {
      const workerEntries = filteredEntries.filter(e => e.workerId === worker.id);

      const totalDays = workerEntries.reduce((sum, e) => {
        if (e.isLeave) return e.leaveType === 'ลาครึ่งวัน' ? sum + 0.5 : sum;
        return sum + 1;
      }, 0);

      const leaveDays = workerEntries.reduce((sum, e) => {
        if (!e.isLeave) return sum;
        return e.leaveType === 'ลาครึ่งวัน' ? sum + 0.5 : sum + 1;
      }, 0);

      const sickDays = workerEntries.filter(e => e.isLeave && e.leaveType === 'ลาป่วย').length;
      const personalDays = workerEntries.filter(e => e.isLeave && (e.leaveType === 'ลากิจ' || !e.leaveType || (e.leaveType as any) === 'ลาพักผ่อน')).length;
      const absentDays = workerEntries.filter(e => e.isLeave && e.leaveType === 'ขาดงาน').length;
      const halfDaysCount = workerEntries.filter(e => e.isLeave && e.leaveType === 'ลาครึ่งวัน').length;
      let totalBaseWage = 0;
      let totalTravel = 0;
      let totalToll = 0;
      let totalLate = 0;
      let totalOT = 0;
      let totalAdditions = 0;
      let totalDeductions = 0;

      const adjustmentsList: { note: string, amount: number, type: 'add' | 'deduct', date: string, receiptUrl?: string }[] = [];

      workerEntries.forEach(e => {
        if (e.isLeave && e.leaveType !== 'ลาครึ่งวัน') {
          return; // Skip component sum for full absence
        }

        if (e.isLeave && e.leaveType === 'ลาครึ่งวัน') {
          totalBaseWage += (e.baseWage || 0) / 2;
          return; // Half day gets only half base wage, skip others
        }

        totalBaseWage += (e.baseWage || 0);
        totalTravel += (e.travelAllowance || 0);
        totalToll += (e.tollFee || 0);
        totalLate += (e.lateDeduction || 0);
        totalOT += (e.overtimePay || 0);

        if (e.tollFee > 0) {
          adjustmentsList.push({
             note: 'ค่าทางด่วน',
             amount: Number(e.tollFee),
             type: 'add',
             date: e.date,
             receiptUrl: e.tollReceiptUrl
          });
        }
        if (e.adjustments && e.adjustments.length > 0) {
          e.adjustments.forEach(a => {
            if (a.type === 'add') {
              totalAdditions += Number(a.amount);
            } else {
              totalDeductions += Number(a.amount);
            }
            adjustmentsList.push({
               note: a.note || (a.type === 'add' ? 'เพิ่มเงิน' : 'หักเงิน'),
               amount: Number(a.amount),
               type: a.type as 'add' | 'deduct',
               date: e.date,
               receiptUrl: a.receiptUrl
            });
          });
        }
      });

      const netAdjustments = totalAdditions - totalDeductions + totalToll;

      let grandTotal = 0;
      let rangeGuaranteeDeduction = 0;
      const processedDates = new Set<string>();

      workerEntries.forEach(e => {
        let guarantee = e.guaranteeDeduction || 0;
        let isDuplicateRefundNeeded = false;

        if ((e.isLeave && e.leaveType !== 'ลาครึ่งวัน') || e.isDraft) {
          guarantee = 0; // leaves/drafts do not deduct guarantee mathematically
        } else if (guarantee > 0) {
          if (processedDates.has(e.date)) {
            isDuplicateRefundNeeded = true;
            guarantee = 0; // Duplicate guarantee! 
          } else {
            processedDates.add(e.date);
          }
        }

        // Half day mathematically cuts the deduction in half in totalPay logic
        const isHalfDay = e.isLeave && e.leaveType === 'ลาครึ่งวัน';
        if (isHalfDay && guarantee > 0) {
           guarantee = guarantee / 2;
        }

        rangeGuaranteeDeduction += guarantee;

        let pay = e.totalPay;
        // Self-heal historical DB data: if DB deducted guarantee duplicate
        if (isDuplicateRefundNeeded && (e.guaranteeDeduction || 0) > 0) {
          const refundAmount = isHalfDay ? (e.guaranteeDeduction / 2) : e.guaranteeDeduction;
          pay += refundAmount;
        }
        grandTotal += pay;
      });

      const guaranteeTotal = rangeGuaranteeDeduction;

      // Advance debt STRICTLY within this date range only
      const workerAdvances = advances.filter(a => {
        const aDate = parseISO(a.date);
        return a.workerId === worker.id && isWithinInterval(aDate, { start: parseISO(startDate), end: parseISO(endDate) });
      });
      const advanceTotal = workerAdvances.reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);
      const advanceDeduction = advanceTotal > 0 ? advanceTotal : 0;
      const finalPay = grandTotal - advanceDeduction;

      return {
        worker,
        totalDays,
        totalBaseWage,
        totalTravel,
        totalToll,
        totalLate,
        totalOT,
        netAdjustments,
        adjustmentsList,
        grandTotal,
        leaveDays,
        sickDays,
        personalDays,
        absentDays,
        halfDaysCount,
        guaranteeTotal,
        rangeGuaranteeDeduction,
        advanceDeduction,
        finalPay,
        allReceiptUrls: [...new Set(workerEntries.flatMap(e => {
          const urls = [];
          if (e.transferSlipUrl) urls.push(e.transferSlipUrl);
          if (e.tollReceiptUrl) urls.push(e.tollReceiptUrl);
          if (e.tolls) e.tolls.forEach(t => { if (t.receiptUrl) urls.push(t.receiptUrl); });
          if (e.adjustments) e.adjustments.forEach(a => { if (a.receiptUrl) urls.push(a.receiptUrl); });
          return urls;
        }))].filter(Boolean) as string[]
      };
    });

    return summary.filter(s => s.totalDays > 0 || s.leaveDays > 0 || s.guaranteeTotal > 0 || s.rangeGuaranteeDeduction !== 0 || s.advanceDeduction > 0);
  }, [entries, workers, advances, startDate, endDate]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const formatDateThai = (dateStr: string) => {
    const d = parseISO(dateStr);
    const thaiYear = d.getFullYear() + 543;
    const shortThaiYear = thaiYear.toString().slice(-2);
    return format(d, `dd/MM/${shortThaiYear}`);
  };

  const handleCopySingle = (row: typeof reportData[0]) => {
    const formattedStart = formatDateThai(startDate);
    const formattedEnd = formatDateThai(endDate);
    const dateRangeStr = startDate === endDate ? formattedStart : `${formattedStart} ถึง ${formattedEnd}`;

    let text = `สรุปยอด ${row.worker.name} (วันที่ ${dateRangeStr})\n` +
      `- วันทำงาน: ${row.totalDays} วัน${row.leaveDays > 0 ? ` (ลาหยุด ${row.leaveDays} วัน)` : ''}\n` +
      `- ค่าแรง: ฿${row.totalBaseWage}\n` +
      `- ค่ารถ: ฿${row.totalTravel}\n` +
      `- โอที: ฿${row.totalOT}\n` +
      `- หักสาย: -฿${row.totalLate}\n`;

    if (row.rangeGuaranteeDeduction > 0) {
      text += `- หักประกันสะสมรอบนี้: -฿${row.rangeGuaranteeDeduction}\n`;
    }

    text += `- อื่นๆ: ฿${row.netAdjustments}\n` +
      `📌 ยอดรวม: ฿${row.grandTotal}`;

    if (row.advanceDeduction > 0) {
      text += `\n❌ หักหนี้เบิกล่วงหน้า: -฿${row.advanceDeduction}\n` +
      `✅ คงเหลือรับสุทธิ: ฿${row.finalPay}`;
    }

    handleCopy(text, row.worker.id);
  };

  const [isCopyingPreviewUrl, setIsCopyingPreviewUrl] = useState<string | null>(null);

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
      setTimeout(() => setLastCopiedUrl(null), 3000);
    } catch (err: any) {
      console.warn("Direct copy failed", err);
      alert('ไม่สามารถคัดลอกรูปได้อัตโนมัติ กรุณากดแตะค้างที่รูปภาพแล้วเลือกคัดลอกแทนครับ');
    } finally {
      setIsCopyingPreviewUrl(null);
    }
  };

  const handleCopyAll = () => {
    const formattedStart = formatDateThai(startDate);
    const formattedEnd = formatDateThai(endDate);
    const dateRangeStr = startDate === endDate ? formattedStart : `${formattedStart} ถึง ${formattedEnd}`;
    let text = `📋 สรุปยอดช่างทุกคน (วันที่ ${dateRangeStr})\n\n`;

    reportData.forEach((row, index) => {
      let workerText = `${index + 1}. ${row.worker.name}: ทำงาน ${row.totalDays} วัน${row.leaveDays > 0 ? ` (+ ลา ${row.leaveDays})` : ''} | รับสุทธิ ${row.finalPay}`;
      if (row.advanceDeduction > 0) {
          workerText += ` (รวม ${row.grandTotal} หักเบิก ${row.advanceDeduction})`;
      }
      if (row.guaranteeTotal > 0) {
        workerText += ` (หักประกันสะสม ฿${row.guaranteeTotal})`;
      }
      text += workerText + '\n';
    });

    const grandFinalPayTotal = reportData.reduce((sum, r) => sum + r.finalPay, 0);
    text += `\n💰 รวมยอดที่ต้องจ่ายจริง: ฿${grandFinalPayTotal}`;

    handleCopy(text, 'all');
  };

  const handleExportExcel = () => {
    const ALL_PRESETS = [
      'ค่ารถไปงานที่ 1',
      'ค่ารถไปงานที่ 2',
      'ค่ารถไปงานที่ 3',
      'ค่ารถไปงานที่ 4',
      'เบี้ยเลี้ยง',
      'โบนัสพิเศษ'
    ];

    const filteredEntries = entries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return !entry.isDraft && isWithinInterval(entryDate, {
        start: parseISO(startDate),
        end: parseISO(endDate)
      });
    });

    const PRESETS = ALL_PRESETS.filter(preset =>
      filteredEntries.some(entry =>
        entry.adjustments?.some(a => (a.note || '').trim() === preset)
      )
    );

    // 1. Summary Sheet
    const summaryRows = reportData.map(row => {
      const workerEntries = filteredEntries.filter(e => e.workerId === row.worker.id);

      const presetSums: Record<string, number> = {};
      PRESETS.forEach(p => presetSums[p] = 0);
      let otherSums = 0;

      workerEntries.forEach(entry => {
        if (entry.isLeave) return; // Skip all adjustments for leaves and half days mathematically

        entry.adjustments?.forEach(adj => {
          const amount = adj.type === 'add' ? Number(adj.amount) : -Number(adj.amount);
          const note = (adj.note || '').trim();
          if (PRESETS.includes(note)) {
            presetSums[note] += amount;
          } else {
            otherSums += amount;
          }
        });
      });

      const baseRow: any = {
        'ชื่อช่าง': row.worker.name,
        'จำนวนวันทำงาน': `${row.totalDays}`,
        'ลาป่วย (วัน)': row.sickDays,
        'ลากิจ (วัน)': row.personalDays,
        'ขาดงาน (วัน)': row.absentDays,
        'รวมค่าแรง': row.totalBaseWage,
        'รวมค่ารถ': row.totalTravel,
      };

      PRESETS.forEach(p => {
        baseRow[p] = presetSums[p];
      });

      baseRow['รวมค่าทางด่วน'] = row.totalToll;
      baseRow['รวมหักมาสาย'] = row.totalLate;
      baseRow['รวมโอที'] = row.totalOT;
      baseRow['รวมอื่นๆ (สุทธิ)'] = otherSums;
      baseRow['หักประกันสะสม(ในรอบ)'] = row.rangeGuaranteeDeduction;
      baseRow['ยอดประกันสะสมรวมทั้งหมด'] = row.guaranteeTotal || 0;
      baseRow['หักเบิกล่วงหน้า'] = row.advanceDeduction;
      baseRow['ยอดสุทธิ(ในรอบ)'] = row.finalPay;

      return baseRow;
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

    // Add Grand Total row for summary
    const grandTotalRow: any = {
      'ชื่อช่าง': 'รวมทั้งหมด',
      'จำนวนวันทำงาน': reportData.reduce((sum, r) => sum + r.totalDays, 0),
      'ลาป่วย (วัน)': reportData.reduce((sum, r) => sum + r.sickDays, 0),
      'ลากิจ (วัน)': reportData.reduce((sum, r) => sum + r.personalDays, 0),
      'ขาดงาน (วัน)': reportData.reduce((sum, r) => sum + r.absentDays, 0),
      'รวมค่าแรง': reportData.reduce((sum, r) => sum + r.totalBaseWage, 0),
      'รวมค่ารถ': reportData.reduce((sum, r) => sum + r.totalTravel, 0),
    };

    PRESETS.forEach(p => {
      grandTotalRow[p] = summaryRows.reduce((sum, r) => sum + (r[p] || 0), 0);
    });

    grandTotalRow['รวมค่าทางด่วน'] = reportData.reduce((sum, r) => sum + r.totalToll, 0);
    grandTotalRow['รวมหักมาสาย'] = reportData.reduce((sum, r) => sum + r.totalLate, 0);
    grandTotalRow['รวมโอที'] = reportData.reduce((sum, r) => sum + r.totalOT, 0);
    grandTotalRow['รวมอื่นๆ (สุทธิ)'] = summaryRows.reduce((sum, r) => sum + (r['รวมอื่นๆ (สุทธิ)'] || 0), 0);
    grandTotalRow['หักประกันสะสม(ในรอบ)'] = reportData.reduce((sum, r) => sum + r.rangeGuaranteeDeduction, 0);
    grandTotalRow['ยอดประกันสะสมรวมทั้งหมด'] = reportData.reduce((sum, r) => sum + r.guaranteeTotal, 0);
    grandTotalRow['หักเบิกล่วงหน้า'] = reportData.reduce((sum, r) => sum + r.advanceDeduction, 0);
    grandTotalRow['ยอดสุทธิ(ในรอบ)'] = reportData.reduce((sum, r) => sum + r.finalPay, 0);

    XLSX.utils.sheet_add_json(wsSummary, [grandTotalRow], { skipHeader: true, origin: -1 });

    // Helper for calculating time distance
    const timeToMins = (time: string) => {
      if (!time) return 0;
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    // 2. Individual Worker Sheets
    const groupedByWorker: Record<string, typeof entries[number][]> = {};
    filteredEntries.forEach(entry => {
      if (!groupedByWorker[entry.workerId]) {
        groupedByWorker[entry.workerId] = [];
      }
      groupedByWorker[entry.workerId].push(entry);
    });

    const sortedWorkers = [...workers].sort((a, b) => a.name.localeCompare(b.name));
    const intervalDays = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปยอดรวม");

    sortedWorkers.forEach(worker => {
      const summaryData = reportData.find(r => r.worker.id === worker.id);
      if (!summaryData) return;

      const workerEntries = groupedByWorker[worker.id] || [];
      const workerRows: any[] = [];
      let workerTotal = 0;

      intervalDays.forEach(dateObj => {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        const dayEntries = workerEntries.filter(e => e.date === dateStr);
        const isSun = isSunday(dateObj);
        
        if (dayEntries.length === 0) {
          const displayDate = format(dateObj, 'dd/MM/yyyy') + (isSun ? ' (อาทิตย์)' : '');
          const row: any = {
            'วันที่': displayDate,
            'ชื่อช่าง': worker.name,
            'เวลาทำงาน': isSun ? 'หยุดวันอาทิตย์' : 'ไม่มีบันทึกเวลาทำงาน',
            'จำนวนเวลาสาย': '',
            'หักสาย': '',
            'ค่าแรง': '',
            'เวลาทำโอที': '',
            'โอที': '',
            'ค่ารถ': '',
            'ยอดสุทธิประจำวัน': '',
            'ประเภทการลา': '',
          };
          PRESETS.forEach(p => row[p] = '');
          row['ทางด่วน'] = '';
          row['หักประกันสะสม'] = '';
          row['รวมอื่นๆ'] = '';
          row['หักเบิกล่วงหน้า'] = '';
          row['ยอดสุทธิ(หลังหักเบิก)'] = '';
          row['หมายเหตุอื่นๆ'] = '';
          row['สลิปโอนเงิน'] = '';
          row['สลิปทางด่วน'] = '';
          workerRows.push(row);
          return;
        }

        dayEntries.forEach((entry, idx) => {
          const displayDate = format(dateObj, 'dd/MM/yyyy') + (isSun ? ' (อาทิตย์)' : '') + (idx > 0 ? ` [ครั้งที่ ${idx + 1}]` : '');

          const presetSums: Record<string, number> = {};
          PRESETS.forEach(p => presetSums[p] = 0);
          let otherSums = 0;

          if (!entry.isLeave) {
            entry.adjustments?.forEach(a => {
              const amount = a.type === 'add' ? Number(a.amount) : -Number(a.amount);
              const note = (a.note || '').trim();
              if (PRESETS.includes(note)) {
                presetSums[note] += amount;
              } else {
                otherSums += amount;
              }
            });
          }

          const formatSlipUrl = (url?: string) => {
            if (!url) return '-';
            if (url.startsWith('http')) return url;
            if (url.startsWith('data:image')) return 'มี(ระบบเก่า)';
            return '-';
          };

          let notes = entry.adjustments?.map(a => {
            let s = `${a.note || 'ไม่มีหมายเหตุ'} (${a.type === 'add' ? '+' : '-'}${a.amount})`;
            if (a.receiptUrl && a.receiptUrl.startsWith('http')) {
              s += ` ${a.receiptUrl}`;
            } else if (a.receiptUrl) {
              s += ' (มีรูปเก่า)';
            }
            return s;
          }).join(', ') || '';

          if (entry.tollFee > 0) {
            const tDates: string[] = [];
            if (entry.tolls && entry.tolls.length > 0) {
              entry.tolls.forEach(t => {
                if (t.date && t.date !== entry.date) {
                  const fDate = format(parseISO(t.date), 'dd/MM/yyyy');
                  if (!tDates.includes(fDate)) tDates.push(fDate);
                }
              });
            } else if (entry.tollDate && entry.tollDate !== entry.date) {
              tDates.push(format(parseISO(entry.tollDate), 'dd/MM/yyyy'));
            }
            if (tDates.length > 0) {
              notes += (notes ? ', ' : '') + `ทางด่วนวันที่ ${tDates.join(', ')}`;
            }
          }

          workerTotal += entry.totalPay || 0;

          const getLeaveText = (e: typeof entry) => {
            let str = e.leaveType || 'ลากิจ';
            if (e.leaveNote) str += ` (${e.leaveNote})`;
            return str;
          };

          const wStart = worker.shiftStart || '07:00';
          const wEnd = worker.shiftEnd || '16:00';
          const actualStart = entry.clockIn > wStart ? entry.clockIn : wStart;
          const actualEnd = entry.clockOut < wEnd ? entry.clockOut : wEnd;

          // Calculate late minutes and deduction first!
          let lateMinsStr = '';
          let lateDeductionValue: number | string = '';

          if (!entry.isLeave && entry.lateDeduction > 0) {
            const inMins = timeToMins(entry.clockIn);
            const startMins = timeToMins(wStart);
            const outMins = timeToMins(entry.clockOut);
            let endMins = timeToMins(wEnd);
            if (endMins < startMins) endMins += 24 * 60;
            let actualOutMins = outMins;
            if (actualOutMins < inMins) actualOutMins += 24 * 60;
            
            let lateMins = 0;
            let earlyLeaveMins = 0;
            if (inMins > startMins) lateMins += (inMins - startMins);
            if (actualOutMins < endMins) earlyLeaveMins += (endMins - actualOutMins);
            
            const totalMissingMins = (entry.lateRateRule || worker.lateRateRule) === 'special' ? lateMins : lateMins + earlyLeaveMins;
            
            lateMinsStr = `${totalMissingMins} นาที`;
            lateDeductionValue = -entry.lateDeduction;
          }

          const isHalfDay = entry.isLeave && entry.leaveType === 'ลาครึ่งวัน';
          const isFullLeave = entry.isLeave && !isHalfDay;

          const row: any = {
            'วันที่': displayDate,
            'ชื่อช่าง': worker.name,
            'เวลาทำงาน': isFullLeave ? 'ลาหยุด' : (isHalfDay ? 'ลาครึ่งวัน' : `${actualStart} - ${actualEnd}`),
            'จำนวนเวลาสาย': lateMinsStr,
            'หักสาย': lateDeductionValue,
            'ค่าแรง': isFullLeave ? '' : (isHalfDay ? (entry.baseWage / 2) : (entry.baseWage || '')),
            'เวลาทำโอที': isFullLeave || !entry.overtimePay ? '' : `${wEnd} - ${entry.clockOut}`,
            'โอที': isFullLeave || !entry.overtimePay ? '' : entry.overtimePay,
            'ค่ารถ': isFullLeave || isHalfDay ? '' : (entry.travelAllowance || ''),
            'ยอดสุทธิประจำวัน': isFullLeave ? '' : entry.totalPay,
            'ประเภทการลา': entry.isLeave ? getLeaveText(entry) : '',
          };

          PRESETS.forEach(p => {
            row[p] = isFullLeave || isHalfDay || !presetSums[p] ? '' : presetSums[p];
          });

          row['ทางด่วน'] = isFullLeave || isHalfDay || !entry.tollFee ? '' : entry.tollFee;
          row['หักประกันสะสม'] = isFullLeave || !entry.guaranteeDeduction ? '' : (isHalfDay ? -(entry.guaranteeDeduction / 2) : -entry.guaranteeDeduction);
          row['รวมอื่นๆ'] = isFullLeave || isHalfDay || !otherSums ? '' : otherSums;
          row['หมายเหตุอื่นๆ'] = entry.isLeave ? getLeaveText(entry) : notes;
          row['หักเบิกล่วงหน้า'] = '';
          row['ยอดสุทธิ(หลังหักเบิก)'] = '';
          row['สลิปโอนเงิน'] = isFullLeave || !entry.transferSlipUrl ? '' : formatSlipUrl(entry.transferSlipUrl);
          row['สลิปทางด่วน'] = isFullLeave || isHalfDay || !entry.tollFee || !entry.tollReceiptUrl ? '' : formatSlipUrl(entry.tollReceiptUrl);

          workerRows.push(row);
        });
      });

      const workerTotalRow: any = {
        'วันที่': '',
        'ชื่อช่าง': `รวมยอด ${worker.name}`,
        'เวลาทำงาน': '',
        'จำนวนเวลาสาย': '',
        'หักสาย': '',
        'ค่าแรง': '',
        'เวลาทำโอที': '',
        'โอที': '',
        'ค่ารถ': '',
        'ประเภทการลา': '',
      };

      PRESETS.forEach(p => {
        workerTotalRow[p] = '';
      });

      workerTotalRow['ทางด่วน'] = '';
      workerTotalRow['หักประกันสะสม'] = summaryData.guaranteeTotal > 0 ? `สะสมรวม: ฿${summaryData.guaranteeTotal}` : '';
      workerTotalRow['รวมอื่นๆ'] = '';
      workerTotalRow['หมายเหตุอื่นๆ'] = '';
      workerTotalRow['ยอดสุทธิประจำวัน'] = workerTotal;
      workerTotalRow['หักเบิกล่วงหน้า'] = summaryData.advanceDeduction > 0 ? -summaryData.advanceDeduction : '';
      workerTotalRow['ยอดสุทธิ(หลังหักเบิก)'] = summaryData.advanceDeduction > 0 ? summaryData.finalPay : '';
      workerTotalRow['สลิปโอนเงิน'] = '';
      workerTotalRow['สลิปทางด่วน'] = '';

      workerRows.push(workerTotalRow);

      // Dynamically remove empty columns
      const alwaysShow = [
        'วันที่', 'ชื่อช่าง', 'เวลาทำงาน', 'จำนวนเวลาสาย', 'หักสาย', 'ค่าแรง',
        'เวลาทำโอที', 'โอที', 'ค่ารถ', 'ยอดสุทธิประจำวัน', 'ประเภทการลา'
      ];
      const allKeys = Object.keys(workerRows[0] || {});

      allKeys.forEach(key => {
        if (alwaysShow.includes(key)) return;

        const isEmpty = workerRows.every(row => row[key] === '' || row[key] === '-' || row[key] === undefined);
        if (isEmpty) {
          workerRows.forEach(row => delete row[key]);
        }
      });

      const wsWorker = XLSX.utils.json_to_sheet(workerRows);

      // Adjust column widths dynamically based on remaining keys
      if (workerRows.length > 0) {
        const remainingKeys = Object.keys(workerRows[0]);
        const customWidths: Record<string, number> = {
          'วันที่': 110, 'ชื่อช่าง': 100, 'เวลาทำงาน': 100, 'จำนวนเวลาสาย': 100, 'หักสาย': 80, 'ค่าแรง': 80,
          'เวลาทำโอที': 110, 'โอที': 60, 'ค่ารถ': 60, 'ยอดสุทธิประจำวัน': 100, 'ประเภทการลา': 120, 
          'ทางด่วน': 60, 'หักประกันสะสม': 90, 'รวมอื่นๆ': 80,
          'หักเบิกล่วงหน้า': 100, 'ยอดสุทธิ(หลังหักเบิก)': 130,
          'หมายเหตุอื่นๆ': 180, 'สลิปโอนเงิน': 100, 'สลิปทางด่วน': 100
        };
        const detailCols = remainingKeys.map(key => ({ wpx: customWidths[key] || 90 }));
        wsWorker['!cols'] = detailCols;
        
        // Apply black styling for Sunday rows with no records
        // Start from row index 1 (skip header)
        for (let R = 1; R <= workerRows.length; R++) {
            const dateCell = wsWorker[XLSX.utils.encode_cell({r: R, c: remainingKeys.indexOf('วันที่')} )];
            // Identify Sunday without record rows
            if (dateCell && typeof dateCell.v === 'string' && dateCell.v.includes('(อาทิตย์)') && workerRows[R-1] && workerRows[R-1]['เวลาทำงาน'] === 'หยุดวันอาทิตย์') {
                for(let C = 0; C < remainingKeys.length; C++) {
                    const cellAddress = XLSX.utils.encode_cell({r: R, c: C});
                    if (!wsWorker[cellAddress]) continue;
                    
                    // Add styling for dark gray background and white text
                    wsWorker[cellAddress].s = {
                        fill: { fgColor: { rgb: "FF808080" } }, // Dark gray
                        font: { color: { rgb: "FFFFFFFF" }, bold: true }
                    };
                    
                    // Explicitly state it's a Sunday with a dash
                    if (C !== remainingKeys.indexOf('วันที่') && C !== remainingKeys.indexOf('ชื่อช่าง')) {
                        wsWorker[cellAddress].v = '-'; 
                    }
                }
            }
        }
      }

      // Ensure tab name doesn't exceed 31 limits and doesn't contain forbidden chars \ / ? * [ ] :
      const safeSheetName = worker.name.replace(/[\\/?*[\]:]/g, ' ').substring(0, 31).trim() || 'ช่าง';
      XLSX.utils.book_append_sheet(wb, wsWorker, safeSheetName);
    });

    const summaryCols = [
      { wpx: 150 }, // ชื่อช่าง
      { wpx: 100 }, // จำนวนวันทำงาน
      { wpx: 80 },  // ลาป่วย
      { wpx: 80 },  // ลากิจ
      { wpx: 80 },  // ขาดงาน
      { wpx: 100 }, // รวมค่าแรง
      { wpx: 100 }, // รวมค่ารถ
    ];
    PRESETS.forEach(() => summaryCols.push({ wpx: 90 })); // Preset Adjustments
    summaryCols.push(
      { wpx: 100 }, // รวมค่าทางด่วน
      { wpx: 100 }, // รวมหักมาสาย
      { wpx: 100 }, // รวมโอที
      { wpx: 100 }, // รวมอื่นๆ
      { wpx: 150 }, // หักประกันสะสม
      { wpx: 150 }, // ยอดประกันสะสมรวม
      { wpx: 120 }, // หักเบิกล่วงหน้า
      { wpx: 150 }  // ยอดสุทธิ
    );
    wsSummary['!cols'] = summaryCols;

    // Save File
    XLSX.writeFile(wb, `Payroll_Report_${startDate}_to_${endDate}.xlsx`);
  };



  return (
    <div className="min-h-screen bg-zinc-50 pb-20 md:pb-8 relative">
      <Toast 
        isVisible={!!lastCopiedUrl || !!copiedId} 
        message={lastCopiedUrl ? 'คัดลอกรูปภาพสำเร็จ!' : 'คัดลอกข้อความสำเร็จ!'}
        icon={<Check className="w-5 h-5" />}
      />
      <div className="max-w-6xl mx-auto px-4 pt-4 md:pt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
              <Button onClick={handleCopyAll} disabled={reportData.length === 0} className="w-full sm:w-auto gap-2 bg-red-600 hover:bg-red-700 shadow-red-200 text-white rounded-2xl">
                {copiedId === 'all' ? <Check className="w-5 h-5 stroke-[2.5px]" /> : <Copy className="w-5 h-5 stroke-[2.2px]" />}
                {copiedId === 'all' ? 'คัดลอกแล้ว' : 'คัดลอกสรุปทุกคน'}
              </Button>
            </motion.div>
            <div className="flex gap-2 w-full sm:w-auto">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 sm:w-auto">
                <Button onClick={handleExportExcel} disabled={reportData.length === 0} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white border-0 px-4 rounded-2xl">
                  <FileSpreadsheet className="w-5 h-5 stroke-[2.2px]" /> Export Excel
                </Button>
              </motion.div>
            </div>
        </div>

      <Card className="p-4 sm:p-6 bg-white">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <Label>ตั้งแต่วันที่</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>ถึงวันที่</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {reportData.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
            ไม่พบข้อมูลในช่วงเวลาที่เลือก
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50/80">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-[13px] font-semibold text-zinc-900 sm:pl-6 uppercase tracking-wide">ชื่อช่าง</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-[13px] font-semibold text-zinc-900 uppercase tracking-wide">วันทำงาน</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-[13px] font-semibold text-zinc-900 uppercase tracking-wide">ค่าแรง</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-[13px] font-semibold text-zinc-900 uppercase tracking-wide">ค่ารถ</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-[13px] font-semibold text-zinc-900 uppercase tracking-wide">โอที</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-[13px] font-semibold text-red-600 uppercase tracking-wide">หักสาย</th>
                    <th scope="col" className="px-3 py-3.5 text-right text-[13px] font-semibold text-zinc-900 uppercase tracking-wide">อื่นๆ</th>
                    <th scope="col" className="py-3.5 px-3 text-right text-[13px] font-semibold text-orange-600 uppercase tracking-wide">หักประกันสะสม</th>
                    <th scope="col" className="py-3.5 px-3 text-right text-[13px] font-semibold text-red-600 uppercase tracking-wide">หักเบิก</th>
                    <th scope="col" className="py-3.5 px-3 text-right text-[13px] font-semibold text-blue-600 uppercase tracking-wide">สุทธิ</th>
                    <th scope="col" className="py-3.5 px-3 text-center text-[13px] font-semibold text-violet-600 uppercase tracking-wide">คัดลอกรูป</th>
                    <th scope="col" className="py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">คัดลอก</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {reportData.map((row) => (
                    <tr key={row.worker.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 sm:pl-6">{row.worker.name}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'วันทำงาน', metricType: 'days' })} className="hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-zinc-100 text-zinc-500">
                          {row.totalDays}
                        </button>
                        {row.leaveDays > 0 && (
                          <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'วันลาหยุด', metricType: 'leave' })} className="hover:underline cursor-pointer transition-colors px-1 py-1 rounded-md hover:bg-red-50 text-red-500 ml-1 text-xs">
                            (ลา {row.leaveDays})
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'ค่าแรง', metricType: 'baseWage' })} className="hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-zinc-100 text-zinc-500">
                          ฿{row.totalBaseWage}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'ค่ารถ', metricType: 'travel' })} className="hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-zinc-100 text-zinc-500">
                          ฿{row.totalTravel}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'โอที', metricType: 'ot' })} className="hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-zinc-100 text-zinc-500">
                          ฿{row.totalOT}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'หักสาย', metricType: 'late' })} className="hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-red-50 text-red-500 font-medium">
                          -฿{row.totalLate}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">
                        {row.adjustmentsList && row.adjustmentsList.length > 0 ? (
                          <button
                            onClick={() => setSelectedAdjustments({ workerName: row.worker.name, list: row.adjustmentsList })}
                            className={`hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-zinc-100 ${row.netAdjustments > 0 ? 'text-emerald-600 font-medium' : row.netAdjustments < 0 ? 'text-red-600 font-medium' : ''}`}
                            title="คลิกเพื่อดูรายการอื่นๆ"
                          >
                            {row.netAdjustments > 0 ? '+' : ''}{row.netAdjustments !== 0 ? `฿${row.netAdjustments}` : '-'}
                          </button>
                        ) : (
                          <span className={row.netAdjustments > 0 ? 'text-emerald-600' : row.netAdjustments < 0 ? 'text-red-600' : ''}>
                            {row.netAdjustments > 0 ? '+' : ''}{row.netAdjustments !== 0 ? `฿${row.netAdjustments}` : '-'}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-right">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'หักประกันสะสมรอบนี้', metricType: 'guarantee' })} className={`hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-orange-50 text-orange-600 ${row.guaranteeTotal > 0 ? '' : 'text-zinc-300 font-normal hover:bg-transparent cursor-default'}`} disabled={row.guaranteeTotal === 0}>
                          {row.guaranteeTotal > 0 ? `฿${row.guaranteeTotal}` : '-'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-right">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'หักเบิก', metricType: 'advance' })} className={`hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-red-50 text-red-500 ${row.advanceDeduction > 0 ? '' : 'text-zinc-300 font-normal hover:bg-transparent cursor-default'}`} disabled={row.advanceDeduction === 0}>
                          {row.advanceDeduction > 0 ? `-฿${row.advanceDeduction}` : '-'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-right">
                        <button onClick={() => setSelectedMetric({ workerId: row.worker.id, workerName: row.worker.name, metricName: 'สุทธิ', metricType: 'net' })} className="hover:underline cursor-pointer transition-colors px-2 py-1 -mr-2 rounded-md hover:bg-blue-50 text-blue-600">
                          <div className="flex flex-col items-end">
                              {row.advanceDeduction > 0 && <span className="text-[10px] text-zinc-400 line-through">฿{row.grandTotal}</span>}
                              <span>฿{row.finalPay}</span>
                          </div>
                        </button>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex justify-end gap-1">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              setSelectedSlipData(row);
                              setIsSlipModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-2.5 rounded-2xl transition-all min-w-[42px] min-h-[42px] shadow-sm"
                            title="สร้างรูปสลิป"
                          >
                            <ImageIcon className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleCopySingle(row)}
                            className={cn(
                              "inline-flex items-center justify-center p-2.5 rounded-2xl transition-all min-w-[42px] min-h-[42px] shadow-sm",
                              copiedId === row.worker.id 
                                ? "text-emerald-600 bg-emerald-50 shadow-emerald-100" 
                                : "text-red-600 bg-red-50 hover:bg-red-100"
                            )}
                            title="คัดลอกสรุป"
                          >
                            {copiedId === row.worker.id ? (
                              <Check className="w-5 h-5 stroke-[2.5px]" />
                            ) : (
                              <Copy className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
                            )}
                          </motion.button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50/50 border-t-2 border-blue-100">
                  <tr>
                    <th scope="row" className="py-3 pl-4 pr-3 text-left text-sm font-bold text-blue-900 sm:pl-6">รวมทั้งหมด</th>
                    <td className="px-3 py-3 text-sm font-bold text-blue-900 text-center">{reportData.reduce((sum, r) => sum + r.totalDays, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-blue-900 text-right">฿{reportData.reduce((sum, r) => sum + r.totalBaseWage, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-blue-900 text-right">฿{reportData.reduce((sum, r) => sum + r.totalTravel, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-blue-900 text-right">฿{reportData.reduce((sum, r) => sum + r.totalOT, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-red-600 text-right">-฿{reportData.reduce((sum, r) => sum + r.totalLate, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-blue-900 text-right">฿{reportData.reduce((sum, r) => sum + r.netAdjustments, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-orange-600 text-right">฿{reportData.reduce((sum, r) => sum + r.guaranteeTotal, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-red-600 text-right">-฿{reportData.reduce((sum, r) => sum + r.advanceDeduction, 0)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-blue-700 text-right">฿{reportData.reduce((sum, r) => sum + r.finalPay, 0)}</td>
                    <td className="py-3 pl-3 pr-4 sm:pr-6"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Card>

      <SlipModal 
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        dateRangeStr={startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`}
        data={selectedSlipData}
      />

      {/* Adjustments Modal */}
      {selectedAdjustments && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <h3 className="font-semibold text-lg text-zinc-900">รายการอื่นๆ - {selectedAdjustments.workerName}</h3>
              <button 
                onClick={() => setSelectedAdjustments(null)}
                className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {selectedAdjustments.list.map((adj, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div>
                    <div className="text-sm font-medium text-zinc-800">{adj.note}</div>
                    <div className="text-xs text-zinc-500 mt-1">{format(parseISO(adj.date), 'dd/MM/yyyy')}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {adj.receiptUrl && (
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => window.open(adj.receiptUrl, '_blank')}
                          className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-colors"
                          title="ดูรูป"
                        >
                          <ImagePlus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleCopySingleImage(adj.receiptUrl!, e)}
                          disabled={isCopyingPreviewUrl === adj.receiptUrl}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${lastCopiedUrl === adj.receiptUrl ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-100'}`}
                          title="คัดลอกรูป"
                        >
                          {isCopyingPreviewUrl === adj.receiptUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : lastCopiedUrl === adj.receiptUrl ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    )}
                    <div className={`font-bold text-sm ${adj.type === 'add' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {adj.type === 'add' ? '+' : '-'}฿{adj.amount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-100">
               <div className="flex justify-between items-center font-bold">
                 <span>รวมยอดอื่นๆสุทธิ</span>
                 <span className={selectedAdjustments.list.reduce((acc, curr) => acc + (curr.type === 'add' ? curr.amount : -curr.amount), 0) > 0 ? 'text-emerald-600' : selectedAdjustments.list.reduce((acc, curr) => acc + (curr.type === 'add' ? curr.amount : -curr.amount), 0) < 0 ? 'text-red-600' : 'text-zinc-900'}>
                    {selectedAdjustments.list.reduce((acc, curr) => acc + (curr.type === 'add' ? curr.amount : -curr.amount), 0) > 0 ? '+' : ''}
                    ฿{selectedAdjustments.list.reduce((acc, curr) => acc + (curr.type === 'add' ? curr.amount : -curr.amount), 0)}
                 </span>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric Details Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50 rounded-t-2xl">
              <div>
                <h3 className="font-semibold text-lg text-zinc-900">{selectedMetric.metricName}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{selectedMetric.workerName}</p>
              </div>
              <button 
                onClick={() => setSelectedMetric(null)}
                className="p-2 bg-white hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors border border-zinc-200 focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-white">
              {(() => {
                const metricEntries = entries.filter(e => {
                  const ed = parseISO(e.date);
                  return e.workerId === selectedMetric.workerId && isWithinInterval(ed, { start: parseISO(startDate), end: parseISO(endDate) });
                }).sort((a, b) => a.date.localeCompare(b.date));

                const items: { date: string; label: string; amount: number; isDeduct?: boolean; color?: string }[] = [];
                const processedModalDates = new Set<string>();

                metricEntries.forEach(e => {
                  if (selectedMetric.metricType === 'days') {
                    if (!e.isLeave) {
                      items.push({ date: e.date, label: 'มาทำงาน', amount: 1 });
                    } else if (e.leaveType === 'ลาครึ่งวัน') {
                      items.push({ date: e.date, label: 'ลาครึ่งวัน (ทำครึ่งวัน)', amount: 0.5 });
                    }
                  } else if (selectedMetric.metricType === 'leave' && e.isLeave) {
                    items.push({ date: e.date, label: e.leaveType || 'ลาหยุด', amount: e.leaveType === 'ลาครึ่งวัน' ? 0.5 : 1, isDeduct: true });
                  } else if (selectedMetric.metricType === 'baseWage' && e.baseWage > 0) {
                    items.push({ date: e.date, label: 'ค่าแรง', amount: e.baseWage });
                  } else if (selectedMetric.metricType === 'travel' && e.travelAllowance > 0) {
                    items.push({ date: e.date, label: 'ค่ารถ', amount: e.travelAllowance });
                  } else if (selectedMetric.metricType === 'ot' && e.overtimePay > 0) {
                    items.push({ date: e.date, label: `โอที (${e.overtimeHours}ช.ม. ${e.overtimeMinutes}น.)`, amount: e.overtimePay });
                  } else if (selectedMetric.metricType === 'late' && e.lateDeduction > 0) {
                    items.push({ date: e.date, label: 'หักสาย', amount: e.lateDeduction, isDeduct: true });
                  } else if (selectedMetric.metricType === 'guarantee' && (!e.isLeave || e.leaveType === 'ลาครึ่งวัน') && !e.isDraft && e.guaranteeDeduction > 0) {
                    if (!processedModalDates.has(e.date)) {
                      processedModalDates.add(e.date);
                      items.push({ date: e.date, label: 'หักประกันสะสมรอบนี้', amount: e.guaranteeDeduction, isDeduct: false });
                    }
                  } else if (selectedMetric.metricType === 'net' && e.totalPay !== 0) {
                    let pay = e.totalPay;
                    let needsRefund = false;
                    
                    if (e.isLeave || e.isDraft) {
                      needsRefund = true;
                    } else if (e.guaranteeDeduction > 0) {
                      if (processedModalDates.has(e.date)) {
                        needsRefund = true;
                      } else {
                        processedModalDates.add(e.date);
                      }
                    }

                    if (needsRefund && (e.guaranteeDeduction || 0) > 0) {
                       pay += e.guaranteeDeduction;
                    }

                    items.push({ 
                      date: e.date, 
                      label: e.isLeave ? (e.leaveType || 'ลาหยุด') : 'ยอดสุทธิรายวัน', 
                      amount: pay,
                      color: e.leaveType === 'ลาครึ่งวัน' ? 'text-pink-600' : (e.isLeave ? 'text-red-600' : 'text-sky-600')
                    });
                  }
                });

                if (selectedMetric.metricType === 'net') {
                   const workerAdvances = advances.filter(a => {
                     const aDate = parseISO(a.date);
                     return a.workerId === selectedMetric.workerId && isWithinInterval(aDate, { start: parseISO(startDate), end: parseISO(endDate) });
                   });
                   const advanceTotal = workerAdvances.reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);
                   const advanceDeduction = advanceTotal > 0 ? advanceTotal : 0;
                   if (advanceDeduction > 0) {
                      items.push({ date: '', label: 'หักเบิก (รวมรอบนี้)', amount: advanceDeduction, isDeduct: true });
                   }
                }

                if (selectedMetric.metricType === 'advance') {
                   const workerAdvances = advances.filter(a => {
                     const aDate = parseISO(a.date);
                     return a.workerId === selectedMetric.workerId && isWithinInterval(aDate, { start: parseISO(startDate), end: parseISO(endDate) });
                   });
                   workerAdvances.forEach(a => {
                      items.push({ date: a.date, label: a.type === 'borrow' ? 'เบิกเงินล่วงหน้า' : 'คืนเงิน', amount: a.amount, isDeduct: a.type === 'borrow' });
                   });
                }

                if (items.length === 0) {
                  return <div className="text-center text-zinc-500 py-8 text-sm bg-zinc-50 rounded-xl border border-dashed border-zinc-200">ไม่พบรายการย่อย</div>
                }

                return (
                  <>
                    <div className="space-y-2">
                        {items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl border border-zinc-100/80 hover:border-zinc-200 transition-colors">
                            <div>
                            <div className="text-[13px] font-medium text-zinc-800">{item.label}</div>
                            {item.date && <div className="text-[11px] text-zinc-500 mt-1">{format(parseISO(item.date), 'dd/MM/yyyy')}</div>}
                            </div>
                             <div className={`font-bold text-sm ${item.isDeduct ? 'text-red-500' : (item.color || 'text-emerald-600')}`}>
                            {selectedMetric.metricType === 'days' || selectedMetric.metricType === 'leave' ? '' : (item.isDeduct ? '-' : '+')}
                            {selectedMetric.metricType === 'days' || selectedMetric.metricType === 'leave' ? `${item.amount} วัน` : `฿${item.amount}`}
                            </div>
                        </div>
                        ))}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-zinc-100 flex justify-between items-center font-bold px-1">
                        <span className="text-zinc-700">รวมทั้งหมด</span>
                        <span className={selectedMetric.metricType === 'advance' ? 'text-red-600' : 'text-blue-600'}>
                            {selectedMetric.metricType === 'days' || selectedMetric.metricType === 'leave' 
                            ? `${items.reduce((s, i) => s + i.amount, 0)} วัน` 
                            : `฿${items.reduce((s, i) => s + (i.isDeduct ? -i.amount : i.amount), 0)}`}
                        </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
  );
}
