import React, { useState, useMemo } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Card, Label } from '../components/ui';
import { parseISO, startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';
import { FileSpreadsheet, Copy, Check, Table2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export function ReportsPage() {
  const { workers, entries } = useStore();

  // Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        guaranteeTotal,
        rangeGuaranteeDeduction
      };
    });

    return summary.filter(s => s.totalDays > 0 || s.leaveDays > 0);
  }, [entries, workers, startDate, endDate]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleCopySingle = (row: typeof reportData[0]) => {
    const dateRangeStr = startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`;
    const text = `สรุปยอด ${row.worker.name} (วันที่ ${dateRangeStr})\n` +
      `- วันทำงาน: ${row.totalDays} วัน${row.leaveDays > 0 ? ` (ลาหยุด ${row.leaveDays} วัน)` : ''}\n` +
      `- ค่าแรง: ฿${row.totalBaseWage}\n` +
      `- ค่ารถ: ฿${row.totalTravel}\n` +
      `- โอที: ฿${row.totalOT}\n` +
      `- หักสาย: -฿${row.totalLate}\n` +
      `- อื่นๆ: ฿${row.netAdjustments}\n` +
      `📌 ยอดสุทธิ: ฿${row.grandTotal}`;

    handleCopy(text, row.worker.id);
  };

  const handleCopyAll = () => {
    const dateRangeStr = startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`;
    let text = `📋 สรุปยอดช่างทุกคน (วันที่ ${dateRangeStr})\n\n`;

    reportData.forEach((row, index) => {
      text += `${index + 1}. ช่าง${row.worker.name}: ทำงาน ${row.totalDays} วัน${row.leaveDays > 0 ? ` (+ ลาหยุด ${row.leaveDays} วัน)` : ''} | สุทธิ ฿${row.grandTotal}\n`;
    });

    const grandTotal = reportData.reduce((sum, r) => sum + r.grandTotal, 0);
    text += `\n💰 รวมยอดทั้งหมด: ฿${grandTotal}`;

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
        'จำนวนวันทำงาน': `${row.totalDays}${row.leaveDays > 0 ? ` (ลา ${row.leaveDays})` : ''}`,
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
      baseRow['ยอดสุทธิ(ในรอบ)'] = row.grandTotal;
      baseRow['หักประกันสะสม(ในรอบ)'] = row.rangeGuaranteeDeduction;
      baseRow['ยอดประกันสะสมรวมทั้งหมด'] = row.guaranteeTotal || 0;

      return baseRow;
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

    // Add Grand Total row for summary
    const grandTotalRow: any = {
      'ชื่อช่าง': 'รวมทั้งหมด',
      'จำนวนวันทำงาน': reportData.reduce((sum, r) => sum + r.totalDays, 0),
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
    grandTotalRow['ยอดสุทธิ(ในรอบ)'] = reportData.reduce((sum, r) => sum + r.grandTotal, 0);
    grandTotalRow['หักประกันสะสม(ในรอบ)'] = reportData.reduce((sum, r) => sum + r.rangeGuaranteeDeduction, 0);
    grandTotalRow['ยอดประกันสะสมรวมทั้งหมด'] = reportData.reduce((sum, r) => sum + r.guaranteeTotal, 0);

    XLSX.utils.sheet_add_json(wsSummary, [grandTotalRow], { skipHeader: true, origin: -1 });

    // 2. Details Sheet
    const detailRows: any[] = [];

    const groupedByWorker: Record<string, typeof entries[number][]> = {};
    filteredEntries.forEach(entry => {
      if (!groupedByWorker[entry.workerId]) {
        groupedByWorker[entry.workerId] = [];
      }
      groupedByWorker[entry.workerId].push(entry);
    });

    const sortedWorkers = [...workers].sort((a, b) => a.name.localeCompare(b.name));

    sortedWorkers.forEach(worker => {
      const workerEntries = groupedByWorker[worker.id] || [];
      if (workerEntries.length === 0) return;

      workerEntries.sort((a, b) => a.date.localeCompare(b.date));

      let workerTotal = 0;

      workerEntries.forEach(entry => {
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

        const notes = entry.adjustments?.map(a => {
          let s = `${a.note || 'ไม่มีหมายเหตุ'} (${a.type === 'add' ? '+' : '-'}${a.amount})`;
          if (a.receiptUrl && a.receiptUrl.startsWith('http')) {
            s += ` ${a.receiptUrl}`;
          } else if (a.receiptUrl) {
            s += ' (มีรูปเก่า)';
          }
          return s;
        }).join(', ') || '';

        workerTotal += entry.totalPay;

        const detailRow: any = {
          'วันที่': format(parseISO(entry.date), 'dd/MM/yyyy'),
          'ชื่อช่าง': worker.name,
          'เวลาทำงาน': entry.isLeave ? 'ลาหยุด' : `${entry.clockIn} - ${entry.clockOut}`,
          'ค่าแรง': entry.isLeave ? '' : (entry.baseWage || ''),
          'ค่ารถ': entry.isLeave ? '' : (entry.travelAllowance || ''),
        };

        PRESETS.forEach(p => {
          detailRow[p] = entry.isLeave || !presetSums[p] ? '' : presetSums[p];
        });

        detailRow['ทางด่วน'] = entry.isLeave || !entry.tollFee ? '' : entry.tollFee;
        detailRow['โอที'] = entry.isLeave || !entry.overtimePay ? '' : entry.overtimePay;
        detailRow['หักสาย'] = entry.isLeave || !entry.lateDeduction ? '' : -entry.lateDeduction; // Show as negative
        detailRow['หักประกันสะสม'] = entry.isLeave || !entry.guaranteeDeduction ? '' : -(entry.guaranteeDeduction || 0);
        detailRow['รวมอื่นๆ'] = entry.isLeave || !otherSums ? '' : otherSums;
        detailRow['ยอดสุทธิประจำวัน'] = entry.isLeave ? '' : entry.totalPay;
        detailRow['หมายเหตุอื่นๆ'] = entry.isLeave ? 'ลาหยุด' : notes;
        detailRow['สลิปโอนเงิน'] = entry.isLeave || !entry.transferSlipUrl ? '' : formatSlipUrl(entry.transferSlipUrl);
        detailRow['สลิปทางด่วน'] = entry.isLeave || !entry.tollFee || !entry.tollReceiptUrl ? '' : formatSlipUrl(entry.tollReceiptUrl);

        detailRows.push(detailRow);
      });

      const workerTotalRow: any = {
        'วันที่': '',
        'ชื่อช่าง': `รวมยอด ${worker.name}`,
        'เวลาทำงาน': '',
        'ค่าแรง': '',
        'ค่ารถ': '',
      };

      PRESETS.forEach(p => {
        workerTotalRow[p] = '';
      });

      workerTotalRow['ทางด่วน'] = '';
      workerTotalRow['โอที'] = '';
      workerTotalRow['หักสาย'] = '';
      workerTotalRow['หักประกันสะสม'] = '';
      workerTotalRow['รวมอื่นๆ'] = '';
      workerTotalRow['ยอดสุทธิประจำวัน'] = workerTotal;
      workerTotalRow['หมายเหตุอื่นๆ'] = '';
      workerTotalRow['สลิปโอนเงิน'] = '';
      workerTotalRow['สลิปทางด่วน'] = '';

      detailRows.push(workerTotalRow);

      detailRows.push({});
    });

    const wsDetails = XLSX.utils.json_to_sheet(detailRows);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปยอดรวม");
    XLSX.utils.book_append_sheet(wb, wsDetails, "รายละเอียดรายบุคคล");

    // Adjust column widths basic
    const detailCols = [{ wpx: 90 }, { wpx: 120 }, { wpx: 100 }, { wpx: 80 }, { wpx: 60 }];
    PRESETS.forEach(() => detailCols.push({ wpx: 90 }));
    detailCols.push({ wpx: 60 }, { wpx: 60 }, { wpx: 60 }, { wpx: 90 }, { wpx: 80 }, { wpx: 100 }, { wpx: 180 }, { wpx: 100 }, { wpx: 100 });
    wsDetails['!cols'] = detailCols;

    const summaryCols = [{ wpx: 150 }, { wpx: 100 }, { wpx: 100 }, { wpx: 100 }];
    PRESETS.forEach(() => summaryCols.push({ wpx: 90 }));
    summaryCols.push({ wpx: 100 }, { wpx: 100 }, { wpx: 100 }, { wpx: 100 }, { wpx: 150 });
    wsSummary['!cols'] = summaryCols;

    // Save File
    XLSX.writeFile(wb, `Payroll_Report_${startDate}_to_${endDate}.xlsx`);
  };

  const handleExportCSV = () => {
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

    const csvData: any[] = [];

    // --- SUMMARY PART ---
    csvData.push({ 'ชื่อช่าง': '--- สรุปยอดรวม ---', 'วันที่': '', 'เวลาทำงาน': '', 'ค่าแรง': '', 'ค่ารถ': '' });

    // Header for Summary
    const summaryHeader: any = {
      'ชื่อช่าง': 'ชื่อช่าง',
      'วันที่': 'จำนวนวันทำงาน',
      'เวลาทำงาน': 'รวมค่าแรง',
      'ค่าแรง': 'รวมค่ารถ',
      'ค่ารถ': 'รวมค่าทางด่วน',
      'โอที': 'รวมโอที',
      'หักสาย': 'รวมหักมาสาย',
      'หักประกันสะสม': 'รวมอื่นๆ (สุทธิ)',
      'รวมอื่นๆ': 'ยอดสุทธิ',
      'ยอดสุทธิประจำวัน': 'ยอดประกันสะสมรวมทั้งหมด'
    };
    PRESETS.forEach(p => summaryHeader[p] = p);
    csvData.push(summaryHeader);

    reportData.forEach(row => {
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

      const summaryRow: any = {
        'ชื่อช่าง': row.worker.name,
        'วันที่': `${row.totalDays}${row.leaveDays > 0 ? ` (ลา ${row.leaveDays})` : ''}`,
        'เวลาทำงาน': row.totalBaseWage,
        'ค่าแรง': row.totalTravel,
        'ค่ารถ': row.totalToll,
        'ทางด่วน': row.totalOT,
        'โอที': row.totalOT, // just shifting columns for alignment
        'หักสาย': row.totalLate,
        'หักประกันสะสม': otherSums,
        'รวมอื่นๆ': row.grandTotal,
        'ยอดสุทธิประจำวัน': row.guaranteeTotal || 0
      };
      PRESETS.forEach(p => summaryRow[p] = presetSums[p]);
      csvData.push(summaryRow);
    });

    csvData.push({});
    csvData.push({});

    // --- DETAILS PART ---
    csvData.push({ 'ชื่อช่าง': '--- รายละเอียดรายบุคคล ---', 'วันที่': '', 'เวลาทำงาน': '', 'ค่าแรง': '', 'ค่ารถ': '' });

    const detailsHeader: Record<string, string> = {
      'วันที่': 'วันที่',
      'ชื่อช่าง': 'ชื่อช่าง',
      'เวลาทำงาน': 'เวลาทำงาน',
      'ค่าแรง': 'ค่าแรง',
      'ค่ารถ': 'ค่ารถ',
    };
    PRESETS.forEach(p => detailsHeader[p] = p);

    Object.assign(detailsHeader, {
      'ทางด่วน': 'ทางด่วน',
      'โอที': 'โอที',
      'หักสาย': 'หักสาย',
      'หักประกันสะสม': 'หักประกันสะสม',
      'รวมอื่นๆ': 'รวมอื่นๆ',
      'ยอดสุทธิประจำวัน': 'ยอดสุทธิประจำวัน',
      'หมายเหตุอื่นๆ': 'หมายเหตุอื่นๆ',
      'สลิปโอนเงิน': 'สลิปโอนเงิน',
      'สลิปทางด่วน': 'สลิปทางด่วน'
    });
    csvData.push(detailsHeader);

    const groupedByWorker: Record<string, typeof entries[number][]> = {};
    filteredEntries.forEach(entry => {
      if (!groupedByWorker[entry.workerId]) {
        groupedByWorker[entry.workerId] = [];
      }
      groupedByWorker[entry.workerId].push(entry);
    });

    const sortedWorkers = [...workers].sort((a, b) => a.name.localeCompare(b.name));

    sortedWorkers.forEach(worker => {
      const workerEntries = groupedByWorker[worker.id] || [];
      if (workerEntries.length === 0) return;

      workerEntries.sort((a, b) => a.date.localeCompare(b.date));
      let workerTotal = 0;

      workerEntries.forEach(entry => {
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

        const notes = entry.adjustments?.map(a => `${a.note || 'ไม่มีหมายเหตุ'} (${a.type === 'add' ? '+' : '-'}${a.amount})`).join(', ') || '';

        workerTotal += entry.totalPay;

        const detailRow: Record<string, any> = {
          'วันที่': format(parseISO(entry.date), 'dd/MM/yyyy'),
          'ชื่อช่าง': worker.name,
          'เวลาทำงาน': entry.isLeave ? 'ลาหยุด' : `${entry.clockIn} - ${entry.clockOut}`,
          'ค่าแรง': entry.isLeave ? '' : (entry.baseWage || ''),
          'ค่ารถ': entry.isLeave ? '' : (entry.travelAllowance || ''),
        };
        PRESETS.forEach(p => detailRow[p] = entry.isLeave || !presetSums[p] ? '' : presetSums[p]);

        Object.assign(detailRow, {
          'ทางด่วน': entry.isLeave || !entry.tollFee ? '' : entry.tollFee,
          'โอที': entry.isLeave || !entry.overtimePay ? '' : entry.overtimePay,
          'หักสาย': entry.isLeave || !entry.lateDeduction ? '' : -entry.lateDeduction,
          'หักประกันสะสม': entry.isLeave || !entry.guaranteeDeduction ? '' : -(entry.guaranteeDeduction || 0),
          'รวมอื่นๆ': entry.isLeave || !otherSums ? '' : otherSums,
          'ยอดสุทธิประจำวัน': entry.isLeave ? '' : entry.totalPay,
          'หมายเหตุอื่นๆ': entry.isLeave ? 'ลาหยุด' : notes,
          'สลิปโอนเงิน': entry.isLeave || !entry.transferSlipUrl ? '' : (entry.transferSlipUrl.startsWith('http') ? entry.transferSlipUrl : 'มีสลิป'),
          'สลิปทางด่วน': entry.isLeave || !entry.tollFee || !entry.tollReceiptUrl ? '' : (entry.tollReceiptUrl.startsWith('http') ? entry.tollReceiptUrl : 'มีสลิป')
        });
        csvData.push(detailRow);
      });

      const workerTotalRow: any = {
        'วันที่': '',
        'ชื่อช่าง': `รวมยอด ${worker.name}`,
        'ยอดสุทธิประจำวัน': workerTotal,
      };
      csvData.push(workerTotalRow);
      csvData.push({});
    });

    const csvOutput = Papa.unparse(csvData);

    // Download logic with BOM for UTF-8 Excel/Google Sheets support
    const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Payroll_GoogleSheets_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <Button onClick={handleExportCSV} disabled={reportData.length === 0} className="flex-1 sm:w-auto gap-2 bg-[#0F9D58] hover:bg-[#0d8a4d] shadow-green-200 text-white border-0 px-4">
              <Table2 className="w-5 h-5" /> Export Google Sheets (CSV)
            </Button>
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
                    <th scope="col" className="py-3.5 px-3 text-right text-[13px] font-semibold text-blue-600 uppercase tracking-wide">ยอดสุทธิ</th>
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
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-blue-600 text-right">฿{row.grandTotal}</td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => handleCopySingle(row)}
                          className="inline-flex items-center justify-center text-red-600 hover:text-gray-900 bg-sky-50 p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px]"
                          title="คัดลอกสรุป"
                        >
                          {copiedId === row.worker.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
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
                    <td className="px-3 py-3 text-sm font-bold text-blue-700 text-right">฿{reportData.reduce((sum, r) => sum + r.grandTotal, 0)}</td>
                    <td className="py-3 pl-3 pr-4 sm:pr-6"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
