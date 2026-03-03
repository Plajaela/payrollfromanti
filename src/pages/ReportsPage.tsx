import React, { useState, useMemo } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Card, Label } from '../components/ui';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { FileSpreadsheet } from 'lucide-react';

export function ReportsPage() {
  const { workers, entries } = useStore();
  
  // Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

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
      
      const totalDays = workerEntries.length;
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

      return {
        worker,
        totalDays,
        totalBaseWage,
        totalTravel,
        totalToll,
        totalLate,
        totalOT,
        netAdjustments,
        grandTotal
      };
    });

    return summary.filter(s => s.totalDays > 0);
  }, [entries, workers, startDate, endDate]);

  const handleExportCSV = () => {
    // CSV Header
    const headers = [
      'ชื่อช่าง',
      'จำนวนวันทำงาน',
      'รวมค่าแรง',
      'รวมค่ารถ',
      'รวมค่าทางด่วน',
      'รวมหักมาสาย',
      'รวมโอที',
      'รวมอื่นๆ (สุทธิ)',
      'ยอดสุทธิ'
    ];

    const rows = reportData.map(row => [
      row.worker.name,
      row.totalDays,
      row.totalBaseWage,
      row.totalTravel,
      row.totalToll,
      row.totalLate,
      row.totalOT,
      row.netAdjustments,
      row.grandTotal
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wage_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Button onClick={handleExportCSV} disabled={reportData.length === 0} className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
          <FileSpreadsheet className="w-5 h-5" /> Export CSV (Excel)
        </Button>
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
                    <th scope="col" className="py-3.5 pl-3 pr-4 text-right text-[13px] font-semibold text-blue-600 sm:pr-6 uppercase tracking-wide">ยอดสุทธิ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {reportData.map((row) => (
                    <tr key={row.worker.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 sm:pl-6">{row.worker.name}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-center">{row.totalDays}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">฿{row.totalBaseWage}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">฿{row.totalTravel}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">฿{row.totalOT}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-red-500 text-right">-฿{row.totalLate}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 text-right">
                        <span className={row.netAdjustments > 0 ? 'text-emerald-600' : row.netAdjustments < 0 ? 'text-red-600' : ''}>
                          {row.netAdjustments > 0 ? '+' : ''}{row.netAdjustments !== 0 ? `฿${row.netAdjustments}` : '-'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 text-sm font-bold text-blue-600 text-right sm:pr-6">฿{row.grandTotal}</td>
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
                    <td className="py-3 pl-3 pr-4 text-sm font-bold text-blue-700 text-right sm:pr-6">฿{reportData.reduce((sum, r) => sum + r.grandTotal, 0)}</td>
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
