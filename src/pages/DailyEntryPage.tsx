import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Label, Card, Modal } from '../components/ui';
import { format, addDays, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, Trash2, Settings2, RefreshCw, Copy, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Adjustment } from '../types';

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
  });

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const entriesForDate = useMemo(() => {
    return entries.filter(e => e.date === dateStr);
  }, [entries, dateStr]);

  const totalPayForDay = entriesForDate.reduce((sum, e) => sum + e.totalPay, 0);

  const calculateTotal = () => {
    const otRatePerHour = 100;
    const otPay = (formData.overtimeHours * otRatePerHour) + (formData.overtimeMinutes / 60 * otRatePerHour);
    const adjustmentsTotal = formData.adjustments.reduce((sum, adj) => {
      return sum + (adj.type === 'add' ? Number(adj.amount) : -Number(adj.amount));
    }, 0);
    return formData.baseWage + formData.travelAllowance + formData.tollFee + otPay + adjustmentsTotal - formData.lateDeduction;
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
    if (existingEntry) {
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
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.workerId) return;

    const otRatePerHour = 100;
    const otPay = (formData.overtimeHours * otRatePerHour) + (formData.overtimeMinutes / 60 * otRatePerHour);
    const totalPay = calculateTotal();

    const entryData = {
      workerId: formData.workerId,
      date: dateStr,
      clockIn: formData.clockIn,
      clockOut: formData.clockOut,
      baseWage: formData.baseWage,
      travelAllowance: formData.travelAllowance,
      tollFee: formData.tollFee,
      lateDeduction: formData.lateDeduction,
      overtimeHours: formData.overtimeHours,
      overtimeMinutes: formData.overtimeMinutes,
      overtimePay: otPay,
      adjustments: formData.adjustments,
      totalPay,
      note: formData.note,
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

    const formattedDate = format(selectedDate, 'dd/MM/yyyy');

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

    let text = `📝 แจ้งยอดรายวัน ${worker.name} (วันที่ ${formattedDate})\n`;
    text += `เวลาทำงาน: ${clockIn} - ${clockOut}\n`;
    if (lateDeduction > 0) text += `หักมาสาย: -฿${lateDeduction}\n`;
    if (overtimePay > 0) {
      let otTimeStr = '';
      const wEnd = worker.shiftEnd || '16:00';
      const wStart = worker.shiftStart || '07:00';
      if (clockOut > wEnd) {
        otTimeStr = ` ${wEnd}-${clockOut}`;
      } else if (clockIn < wStart) {
        otTimeStr = ` ${clockIn}-${wStart}`;
      }
      const otHours = entry?.overtimeHours || 0;
      const otMins = entry?.overtimeMinutes || 0;
      const otDurationInfo = ` (${otHours} ชม.${otMins > 0 ? ` ${otMins} นาที` : ''})`;
      text += `OT${otTimeStr}${otDurationInfo}: ฿${overtimePay}\n`;
    }
    text += `\n`;
    text += `- ค่าแรง: ฿${baseWage}\n`;
    if (travelAllowance > 0) text += `- ค่ารถ: ฿${travelAllowance}\n`;
    if (tollFee > 0) text += `- ทางด่วน: ฿${tollFee}\n`;

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
    const formattedDate = format(selectedDate, 'dd/MM/yyyy');

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

      text += `� ช่าง ${worker.name}\n`;
      text += `เวลาทำงาน: ${clockIn} - ${clockOut}\n`;
      if (lateDeduction > 0) text += `หักมาสาย: -฿${lateDeduction}\n`;
      if (overtimePay > 0) {
        let otTimeStr = '';
        const wEnd = worker.shiftEnd || '16:00';
        const wStart = worker.shiftStart || '07:00';
        if (clockOut > wEnd) {
          otTimeStr = ` ${wEnd}-${clockOut}`;
        } else if (clockIn < wStart) {
          otTimeStr = ` ${clockIn}-${wStart}`;
        }
        const otHours = entry?.overtimeHours || 0;
        const otMins = entry?.overtimeMinutes || 0;
        const otDurationInfo = ` (${otHours} ชม.${otMins > 0 ? ` ${otMins} นาที` : ''})`;
        text += `OT${otTimeStr}${otDurationInfo}: ฿${overtimePay}\n`;
      }
      text += `- ค่าแรง: ฿${baseWage}\n`;
      if (travelAllowance > 0) text += `- ค่ารถ: ฿${travelAllowance}\n`;
      if (tollFee > 0) text += `- ทางด่วน: ฿${tollFee}\n`;

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
                return (
                  <button
                    key={worker.id}
                    onClick={() => setActiveTabWorkerId(worker.id)}
                    className={`flex items-center justify-between p-3.5 md:p-3 rounded-2xl md:rounded-xl text-left transition-all duration-300 flex-shrink-0 border hover:scale-[1.02] active:scale-[0.98] ${isActive ? 'bg-gradient-to-r from-sky-500 to-sky-600 border-sky-500 text-white shadow-md shadow-sky-200' : 'bg-white border-gray-100 text-gray-700 hover:bg-sky-50 hover:border-sky-200'}`}
                  >
                    <span className="font-semibold text-[15px]">{worker.name}</span>
                    {entry && <CheckCircle2 className={`w-4 h-4 ml-2 ${isActive ? 'text-sky-100' : 'text-emerald-500'}`} />}
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
                            <span className="text-emerald-600 flex items-center gap-1.5 font-medium bg-emerald-50 px-2 py-0.5 rounded-lg inline-flex">
                              <CheckCircle2 className="w-3.5 h-3.5" /> บันทึกแล้ว
                            </span>
                          ) : (
                            <span className="text-gray-400 font-medium">รอการบันทึก (เวลา {worker.shiftStart || '07:00'}-{worker.shiftEnd || '16:00'})</span>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-lg text-red-500 group-hover:text-red-600 transition-colors">
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
              className={`p-6 md:p-8 flex flex-col items-center justify-center min-h-[200px] text-center active:scale-[0.99] transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${activeEntry ? 'border-sky-200 bg-gradient-to-b from-sky-50/50 to-white shadow-sky-100' : 'bg-white border-gray-100 hover:border-sky-300 shadow-sm'}`}
            >
              <div className="mb-4">
                <div className="font-bold text-gray-900 text-2xl mb-2">{activeWorker.name}</div>
                {activeEntry ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100 text-sky-700 rounded-xl text-sm font-semibold shadow-sm">
                    <CheckCircle2 className="w-4 h-4" /> บันทึกแล้ว
                    <span className="text-sky-800 ml-1">฿{activeEntry.totalPay}</span>
                    <span className="text-sky-600/70 font-normal ml-1 border-l border-sky-200 pl-2">
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

          <div className="grid grid-cols-3 gap-3">
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
            <div>
              <Label className="text-xs">ทางด่วน</Label>
              <Input
                type="number"
                min="0"
                value={formData.tollFee || ''}
                onChange={(e) => setFormData(p => ({ ...p, tollFee: Number(e.target.value) }))}
                className="font-semibold px-2"
              />
            </div>
          </div>

          {/* Adjustments */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="mb-0 text-gray-900">รายการอื่นๆ (เพิ่ม/หักเงิน)</Label>
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
                  <Input
                    type="text"
                    list={`note-presets-${adj.id}`}
                    placeholder="ระบุหมายเหตุ (เช่น ค่ารถไปหน้างาน, อื่นๆ)"
                    value={adj.note}
                    onChange={(e) => {
                      const newAdjs = [...formData.adjustments];
                      newAdjs[idx].note = e.target.value;
                      setFormData(p => ({ ...p, adjustments: newAdjs }));
                    }}
                    className="h-10 text-sm bg-white"
                  />
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

          <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
            <div>
              <div className="text-sm text-gray-500 font-medium">ยอดสุทธิ</div>
              <div className="text-3xl font-bold text-red-600">฿{calculateTotal()}</div>
            </div>
            <div className="flex gap-2">
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
              <Button type="submit" className="px-8 py-4 text-lg rounded-2xl shadow-lg shadow-red-200">
                บันทึก
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
