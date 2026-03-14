import React, { useState, useMemo } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Card, Label } from '../components/ui';
import { parseISO, startOfMonth, endOfMonth, isWithinInterval, format, isSunday, eachDayOfInterval } from 'date-fns';
import { FileSpreadsheet, Copy, Check, Image as ImageIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SlipModal } from '../components/SlipModal';


export function ReportsPage() {
  const { workers, entries, advances } = useStore();

  // Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSlipData, setSelectedSlipData] = useState<any>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  const reportData = useMemo(() => {
    const filteredEntries = entries.filter(entry => {
      const entryDate = parseISO(entry.date);
      return isWithinInterval(entryDate, {
        start: parseISO(startDate),
        end: parseISO(endDate)
      });
    });

    const summary = workers.map(worker => {
      const workerEntries = filteredEntries.filter(e => e.workerId === worker.id);

      const totalDays = workerEntries.filter(e => !e.isLeave).length;
      const leaveDays = workerEntries.filter(e => e.isLeave).length;
      const sickDays = workerEntries.filter(e => e.isLeave && e.leaveType === 'ลาป่วย').length;
      const personalDays = workerEntries.filter(e => e.isLeave && (e.leaveType === 'ลากิจ' || !e.leaveType || (e.leaveType as any) === 'ลาพักผ่อน')).length;
      const absentDays = workerEntries.filter(e => e.isLeave && e.leaveType === 'ขาดงาน').length;
      const totalBaseWage = workerEntries.reduce((sum, e) => sum + e.baseWage, 0);
      const totalTravel = workerEntries.reduce((sum, e) => sum + e.travelAllowance, 0);
      const totalToll = workerEntries.reduce((sum, e) => sum + e.tollFee, 0);
      const totalLate = workerEntries.reduce((sum, e) => sum + e.lateDeduction, 0);
      const totalOT = workerEntries.reduce((sum, e) => sum + e.overtimePay, 0);

      const totalAdditions = workerEntries.reduce((sum, e) =>
        sum + (e.adjustments?.filter(a => a.type === 'add').reduce((s, a) => s + Number(a.amount), 0) || 0)
        , 0);
      const totalDeductions = workerEntries.reduce((sum, e) =>
        sum + (e.adjustments?.filter(a => a.type === 'deduct').reduce((s, a) => s + Number(a.amount), 0) || 0)
        , 0);
      const netAdjustments = totalAdditions - totalDeductions;

      const grandTotal = workerEntries.reduce((sum, e) => sum + e.totalPay, 0);

      const guaranteeTotal = (worker.historicalGuarantee || 0) + entries
        .filter(e => e.workerId === worker.id && !e.isDraft)
        .reduce((sum, e) => sum + (e.guaranteeDeduction || 0), 0);

      // Extract guarantee deduction specifically within current range (just for reference if needed, though they want accumulated)
      const rangeGuaranteeDeduction = workerEntries.reduce((sum, e) => sum + (e.guaranteeDeduction || 0), 0);

      // Current active advance debt for the worker
      const workerAdvances = advances.filter(a => a.workerId === worker.id);
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
        grandTotal,
        leaveDays,
        sickDays,
        personalDays,
        absentDays,
        guaranteeTotal,
        rangeGuaranteeDeduction,
        advanceDeduction,
        finalPay
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

    if (row.guaranteeTotal > 0) {
      text += `\n(🔒 มีเงินประกันสะสมรวมทั้งหมด: ฿${row.guaranteeTotal})`;
    }

    handleCopy(text, row.worker.id);
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
        workerText += ` (ประกันสะสม ฿${row.guaranteeTotal})`;
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
      return isWithinInterval(entryDate, {
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
        const entry = workerEntries.find(e => e.date === dateStr);
        const isSun = isSunday(dateObj);
        const displayDate = format(dateObj, 'dd/MM/yyyy') + (isSun ? ' (อาทิตย์)' : '');

        if (!entry) {
          const row: any = {
            'วันที่': displayDate,
            'ชื่อช่าง': worker.name,
            'เวลาทำงาน': isSun ? 'หยุดวันอาทิตย์' : 'ไม่มีบันทึกเวลาทำงาน',
            'ประเภทการลา': '',
            'ค่าแรง': '',
            'ค่ารถ': '',
          };
          PRESETS.forEach(p => row[p] = '');
          row['ทางด่วน'] = '';
          row['โอที'] = '';
          row['เริ่มทำโอที'] = '';
          row['ทำโอทีถึงเวลา'] = '';
          row['หักสาย (นาที/บาท)'] = '';
          row['หักประกันสะสม'] = '';
          row['รวมอื่นๆ'] = '';
          row['ยอดสุทธิ(ก่อนหักเบิก)'] = '';
          row['หมายเหตุอื่นๆ'] = '';
          row['สลิปโอนเงิน'] = '';
          row['สลิปทางด่วน'] = '';
          workerRows.push(row);
          return;
        }

        const presetSums: Record<string, number> = {};
        PRESETS.forEach(p => presetSums[p] = 0);
        let otherSums = 0;

        entry.adjustments?.forEach(a => {
          const amount = a.type === 'add' ? Number(a.amount) : -Number(a.amount);
          const note = (a.note || '').trim();
          if (PRESETS.includes(note)) {
            presetSums[note] += amount;
          } else {
            otherSums += amount;
          }
        });

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

        workerTotal += entry.totalPay;

        const getLeaveText = (e: typeof entry) => {
          let str = e.leaveType || 'ลาพักผ่อน';
          if (e.leaveNote) str += ` (${e.leaveNote})`;
          return str;
        };

        const wStart = worker.shiftStart || '07:00';
        const wEnd = worker.shiftEnd || '16:00';
        const actualStart = entry.clockIn > wStart ? entry.clockIn : wStart;
        const actualEnd = entry.clockOut < wEnd ? entry.clockOut : wEnd;

        const row: any = {
          'วันที่': displayDate,
          'ชื่อช่าง': worker.name,
          'เวลาทำงาน': entry.isLeave ? 'ลาหยุด' : `${actualStart} - ${actualEnd}`,
          'ประเภทการลา': entry.isLeave ? getLeaveText(entry) : '',
          'ค่าแรง': entry.isLeave ? '' : (entry.baseWage || ''),
          'ค่ารถ': entry.isLeave ? '' : (entry.travelAllowance || ''),
        };

        PRESETS.forEach(p => {
          row[p] = entry.isLeave || !presetSums[p] ? '' : presetSums[p];
        });

        row['ทางด่วน'] = entry.isLeave || !entry.tollFee ? '' : entry.tollFee;
        row['โอที'] = entry.isLeave || !entry.overtimePay ? '' : entry.overtimePay;
        row['เริ่มทำโอที'] = entry.isLeave || !entry.overtimePay ? '' : worker.shiftEnd || '16:00';
        row['ทำโอทีถึงเวลา'] = entry.isLeave || !entry.overtimePay ? '' : entry.clockOut;
        
        let lateText = '';
        if (!entry.isLeave && entry.lateDeduction > 0) {
           const inMins = timeToMins(entry.clockIn);
           const startMins = timeToMins(worker.shiftStart || '07:00');
           const outMins = timeToMins(entry.clockOut);
           let endMins = timeToMins(worker.shiftEnd || '16:00');
           if (endMins < startMins) endMins += 24 * 60;
           let actualOutMins = outMins;
           if (actualOutMins < inMins) actualOutMins += 24 * 60;
           
           let lateMins = 0;
           let earlyLeaveMins = 0;
           if (inMins > startMins) lateMins += (inMins - startMins);
           if (actualOutMins < endMins) earlyLeaveMins += (endMins - actualOutMins);
           
           const totalMissingMins = (entry.lateRateRule || worker.lateRateRule) === 'special' ? lateMins : lateMins + earlyLeaveMins;
           
           lateText = `${totalMissingMins} นาที / -฿${entry.lateDeduction}`;
        }
        
        row['หักสาย (นาที/บาท)'] = lateText;
        row['หักประกันสะสม'] = entry.isLeave || !entry.guaranteeDeduction ? '' : -(entry.guaranteeDeduction || 0);
        row['รวมอื่นๆ'] = entry.isLeave || !otherSums ? '' : otherSums;
        row['ยอดสุทธิประจำวัน'] = entry.isLeave ? '' : entry.totalPay;
        row['หมายเหตุอื่นๆ'] = entry.isLeave ? getLeaveText(entry) : notes;
        row['สลิปโอนเงิน'] = entry.isLeave || !entry.transferSlipUrl ? '' : formatSlipUrl(entry.transferSlipUrl);
        row['สลิปทางด่วน'] = entry.isLeave || !entry.tollFee || !entry.tollReceiptUrl ? '' : formatSlipUrl(entry.tollReceiptUrl);

        workerRows.push(row);
      });

      const workerTotalRow: any = {
        'วันที่': '',
        'ชื่อช่าง': `รวมยอด ${worker.name}`,
        'เวลาทำงาน': '',
        'ประเภทการลา': '',
        'ค่าแรง': '',
        'ค่ารถ': '',
      };

      PRESETS.forEach(p => {
        workerTotalRow[p] = '';
      });

      workerTotalRow['ทางด่วน'] = '';
      workerTotalRow['โอที'] = '';
      workerTotalRow['เริ่มทำโอที'] = '';
      workerTotalRow['ทำโอทีถึงเวลา'] = '';
      workerTotalRow['หักสาย (นาที/บาท)'] = '';
      workerTotalRow['หักประกันสะสม'] = summaryData.guaranteeTotal > 0 ? `สะสมรวม: ฿${summaryData.guaranteeTotal}` : '';
      workerTotalRow['รวมอื่นๆ'] = '';
      workerTotalRow['ยอดสุทธิประจำวัน'] = workerTotal;
      workerTotalRow['หมายเหตุอื่นๆ'] = '';
      workerTotalRow['สลิปโอนเงิน'] = '';
      workerTotalRow['สลิปทางด่วน'] = '';

      workerRows.push(workerTotalRow);

      // Dynamically remove empty columns
      const alwaysShow = ['วันที่', 'ชื่อช่าง', 'เวลาทำงาน', 'ประเภทการลา', 'ค่าแรง', 'ยอดสุทธิประจำวัน'];
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
          'วันที่': 110, 'ชื่อช่าง': 100, 'เวลาทำงาน': 100, 'ประเภทการลา': 120, 'ค่าแรง': 80, 'ค่ารถ': 60,
          'ทางด่วน': 60, 'โอที': 60, 'เริ่มทำโอที': 100, 'ทำโอทีถึงเวลา': 100, 'หักสาย (นาที/บาท)': 120, 'หักประกันสะสม': 90, 'รวมอื่นๆ': 80,
          'ยอดสุทธิประจำวัน': 100, 'หมายเหตุอื่นๆ': 180, 'สลิปโอนเงิน': 100, 'สลิปทางด่วน': 100
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
                    
                    // Add simple grey styling note (xlsx lib doesn't fully support styles without xlsx-js-style, but we can try)
                    wsWorker[cellAddress].s = {
                        fill: { fgColor: { rgb: "FFE0E0E0" } }, // light gray as "black" background might be too dark, but let's try a dark gray or black
                        font: { color: { rgb: "FF000000" } }
                    };
                    
                    // Actually, let's just make the text explicitly state it's a Sunday
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={handleCopyAll} disabled={reportData.length === 0} className="w-full sm:w-auto gap-2 bg-red-600 hover:bg-red-700 shadow-red-200 text-white">
            {copiedId === 'all' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copiedId === 'all' ? 'คัดลอกแล้ว' : 'คัดลอกสรุปทุกคน'}
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleExportExcel} disabled={reportData.length === 0} className="flex-1 sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white border-0 px-4">
              <FileSpreadsheet className="w-5 h-5" /> Export Excel
            </Button>
          </div>
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
                    <th scope="col" className="py-3.5 px-3 text-right text-[13px] font-semibold text-orange-600 uppercase tracking-wide">ประกันสะสมรวม</th>
                    <th scope="col" className="py-3.5 px-3 text-right text-[13px] font-semibold text-red-600 uppercase tracking-wide">หักเบิก</th>
                    <th scope="col" className="py-3.5 px-3 text-right text-[13px] font-semibold text-blue-600 uppercase tracking-wide">สุทธิ</th>
                    <th scope="col" className="py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">คัดลอก</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {reportData.map((row) => (
                    <tr key={row.worker.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 sm:pl-6">{row.worker.name}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-center">
                        {row.totalDays}
                        {row.leaveDays > 0 && <span className="text-red-500 ml-1 text-xs">(ลา {row.leaveDays})</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">฿{row.totalBaseWage}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">฿{row.totalTravel}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">฿{row.totalOT}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-red-500 text-right">-฿{row.totalLate}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">
                        <span className={row.netAdjustments > 0 ? 'text-emerald-600' : row.netAdjustments < 0 ? 'text-red-600' : ''}>
                          {row.netAdjustments > 0 ? '+' : ''}{row.netAdjustments !== 0 ? `฿${row.netAdjustments}` : '-'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-orange-600 text-right">
                        {row.guaranteeTotal > 0 ? `฿${row.guaranteeTotal}` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-red-500 text-right">
                        {row.advanceDeduction > 0 ? `-฿${row.advanceDeduction}` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-blue-600 text-right">
                        <div className="flex flex-col items-end">
                            {row.advanceDeduction > 0 && <span className="text-[10px] text-zinc-400 line-through">฿{row.grandTotal}</span>}
                            <span>฿{row.finalPay}</span>
                        </div>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedSlipData(row);
                              setIsSlipModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px]"
                            title="สร้างรูปสลิป"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopySingle(row)}
                            className="inline-flex items-center justify-center text-red-600 hover:text-gray-900 bg-sky-50 p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px]"
                            title="คัดลอกสรุป"
                          >
                            {copiedId === row.worker.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          </button>
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
    </div>
  );
}
