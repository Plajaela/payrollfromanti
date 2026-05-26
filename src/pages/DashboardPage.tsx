import React, { useMemo, useState } from 'react';
import { useStore } from '../useStore';
import { 
  TrendingUp, 
  Users, 
  Wallet, 
  Banknote, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  Trophy,
  History,
  Activity,
  PieChart,
  ArrowUp,
  ArrowDown,
  Minus,
  UserCheck,
  Timer,
  UserMinus,
  Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, isAfter, startOfDay, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { Card, cn } from '../components/ui';

export function DashboardPage() {
  const { workers, entries, advances, holidays } = useStore();
  const [selectedWorkerDetail, setSelectedWorkerDetail] = useState<{ id: string; name: string } | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const todayStr = format(now, 'yyyy-MM-dd');

    // 1. Total Wages this month – exact same algorithm as Reports page grandTotal.
    //    IMPORTANT: loop per-worker so guarantee self-heal is isolated per worker.
    //    A global Set (the previous bug) would wrongly mark worker B's guarantee as duplicate
    //    if worker A already used the same date.
    const monthEntriesSorted = entries
      .filter(e => !e.isDraft && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let totalWagesMonth = 0;
    workers.forEach(worker => {
      const workerEntries = monthEntriesSorted.filter(e => e.workerId === worker.id);
      const seenDates = new Set<string>();
      let workerMonthTotal = 0;
      workerEntries.forEach(e => {
        let guarantee = e.guaranteeDeduction || 0;
        let isDuplicateRefundNeeded = false;
        
        if (e.isLeave && e.leaveType !== 'ลาครึ่งวัน') {
          guarantee = 0;
        } else {
          if (guarantee > 0) {
            if (seenDates.has(e.date)) isDuplicateRefundNeeded = true;
            else seenDates.add(e.date);
          }
        }
        
        const isHalfDay = e.isLeave && e.leaveType === 'ลาครึ่งวัน';
        let pay = e.totalPay || 0;
        if (isDuplicateRefundNeeded && (e.guaranteeDeduction || 0) > 0) {
          pay += (isHalfDay ? e.guaranteeDeduction / 2 : e.guaranteeDeduction);
        }
        workerMonthTotal += pay;
      });
      
      const workerAdvances = advances.filter(a => {
        const aDate = parseISO(a.date);
        return a.workerId === worker.id && isWithinInterval(aDate, { start: monthStart, end: monthEnd });
      });
      const advanceTotal = workerAdvances.reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);
      const advanceDeduction = advanceTotal > 0 ? advanceTotal : 0;
      
      let finalWorkerMonthTotal = workerMonthTotal;
      if (worker.paymentType === 'month') {
        const ss = worker.hasSocialSecurity ? 750 : 0;
        finalWorkerMonthTotal += (worker.monthlyWage || 0) - ss;
      }
      
      totalWagesMonth += (finalWorkerMonthTotal - advanceDeduction);
    });

    const activeToday = entries.filter(e => e.date === todayStr && !e.isLeave).length;
    const totalDebt = advances.reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);

    const historicalTotal = workers.reduce((sum, w) => sum + (w.historicalGuarantee || 0), 0);
    const entriesGuarantee = entries
      .filter(e => !e.isDraft && !e.isLeave)
      .reduce((sum, e) => sum + (e.guaranteeDeduction || 0), 0);
    const totalGuarantee = historicalTotal + entriesGuarantee;

    const dailyTrail = Array.from({ length: 14 }).map((_, i) => {
      const d = subDays(now, 13 - i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayTotal = entries
        .filter(e => e.date === dStr && !e.isDraft && !e.isLeave)
        .reduce((sum, e) => sum + (e.totalPay || 0), 0);
      return {  date: dStr, label: format(d, 'd MMM', { locale: th }), value: dayTotal };
    });

    const workerStats = workers.map(w => {
      const workerMonthEntries = monthEntriesSorted.filter(e => e.workerId === w.id);
      const seenDates = new Set<string>();
      let workerMonthTotal = 0;
      let daysWorked = 0;
      workerMonthEntries.forEach(e => {
        let guarantee = e.guaranteeDeduction || 0;
        let isDuplicateRefundNeeded = false;
        
        if (e.isLeave && e.leaveType !== 'ลาครึ่งวัน') {
          guarantee = 0;
        } else {
          daysWorked += e.leaveType === 'ลาครึ่งวัน' ? 0.5 : 1;
          if (guarantee > 0) {
            if (seenDates.has(e.date)) isDuplicateRefundNeeded = true;
            else seenDates.add(e.date);
          }
        }
        
        const isHalfDay = e.isLeave && e.leaveType === 'ลาครึ่งวัน';
        let pay = e.totalPay || 0;
        if (isDuplicateRefundNeeded && (e.guaranteeDeduction || 0) > 0) {
          pay += (isHalfDay ? e.guaranteeDeduction / 2 : e.guaranteeDeduction);
        }
        workerMonthTotal += pay;
      });

      const workerAdvances = advances.filter(a => {
        const aDate = parseISO(a.date);
        return a.workerId === w.id && isWithinInterval(aDate, { start: monthStart, end: monthEnd });
      });
      const advanceTotal = workerAdvances.reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);
      const advanceDeduction = advanceTotal > 0 ? advanceTotal : 0;
      
      let finalWorkerMonthTotal = workerMonthTotal;
      if (w.paymentType === 'month') {
        const ss = w.hasSocialSecurity ? 750 : 0;
        finalWorkerMonthTotal += (w.monthlyWage || 0) - ss;
      }
      
      const finalMonthTotal = finalWorkerMonthTotal - advanceDeduction;

      return { ...w, monthTotal: finalMonthTotal, daysWorked };
    }).sort((a, b) => b.monthTotal - a.monthTotal);

    const recentAdjustments = entries
      .filter(e => e.adjustments && e.adjustments.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(e => ({
        id: e.id, workerName: workers.find(w => w.id === e.workerId)?.name || 'Unknown', date: e.date, adjustment: e.adjustments[0]
      }));

    const todayEntries = entries.filter(e => e.date === todayStr && !e.isDraft);
    const attendance = {
      present: todayEntries.filter(e => !e.isLeave).length, late: todayEntries.filter(e => e.lateDeduction > 0).length,
      leave: todayEntries.filter(e => e.isLeave).length, total: workers.length
    };

    const monthEntries = monthEntriesSorted.filter(e => !e.isDraft);
    let totalActualGuaranteeDeduction = 0;
    let totalAdvanceDeduction = 0;
    let totalSocialSecurityDeduction = 0;
    let monthlyBaseWageSum = 0;
    
    workers.forEach(worker => {
      const seenDates = new Set<string>();
      monthEntries.filter(e => e.workerId === worker.id).forEach(e => {
        if ((e.isLeave && e.leaveType !== 'ลาครึ่งวัน')) return;
        const isHalfDay = e.isLeave && e.leaveType === 'ลาครึ่งวัน';
        
        if ((e.guaranteeDeduction || 0) > 0 && !seenDates.has(e.date)) {
          seenDates.add(e.date);
          totalActualGuaranteeDeduction += isHalfDay ? (e.guaranteeDeduction / 2) : e.guaranteeDeduction;
        }
      });
      
      const workerAdvances = advances.filter(a => {
        const aDate = parseISO(a.date);
        return a.workerId === worker.id && isWithinInterval(aDate, { start: monthStart, end: monthEnd });
      });
      const advanceTotal = workerAdvances.reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);
      if (advanceTotal > 0) totalAdvanceDeduction += advanceTotal;
      
      if (worker.paymentType === 'month') {
        monthlyBaseWageSum += (worker.monthlyWage || 0);
        if (worker.hasSocialSecurity) totalSocialSecurityDeduction += 750;
      }
    });
    
    let baseSum = 0; let otSum = 0; let travelSum = 0; let adjSum = 0; let lateSum = 0;
    monthEntries.forEach(e => {
       if (e.isLeave && e.leaveType !== 'ลาครึ่งวัน') return;
       const isHalfDay = e.isLeave && e.leaveType === 'ลาครึ่งวัน';
       
       baseSum += isHalfDay ? (e.baseWage || 0) / 2 : (e.baseWage || 0);
       if (!isHalfDay) {
          otSum += (e.overtimePay || 0);
          travelSum += (e.travelAllowance || 0) + (e.tollFee || 0);
          lateSum += (e.lateDeduction || 0);
          adjSum += e.adjustments?.reduce((s, a) => s + (a.type === 'add' ? Number(a.amount) : -Number(a.amount)), 0) || 0;
       }
    });

    const breakdown = {
      base: baseSum + monthlyBaseWageSum, ot: otSum, travel: travelSum, adjustments: adjSum,
      deductions: lateSum + totalActualGuaranteeDeduction + totalSocialSecurityDeduction, advances: totalAdvanceDeduction,
    };
    const totalBreakdown = totalWagesMonth;

    // 10. Next 3 Upcoming Holidays
    const upcomingHolidays = [...(holidays || [])]
      .filter(h => isAfter(parseISO(h.date), startOfDay(now)) || h.date === todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);

    // 11. Month Comparison (Growth %)
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));
    const prevMonthWages = entries
      .filter(e => !e.isDraft && isWithinInterval(parseISO(e.date), { start: prevMonthStart, end: prevMonthEnd }))
      .reduce((sum, e) => sum + (e.totalPay || 0), 0);
    
    const growth = prevMonthWages > 0 
      ? ((totalWagesMonth - prevMonthWages) / prevMonthWages) * 100 
      : 0;

    return {
      totalWagesMonth,
      activeToday,
      totalDebt,
      totalGuarantee,
      dailyTrail,
      topWorkers: workerStats,
      recentAdjustments,
      attendance,
      breakdown,
      totalBreakdown,
      upcomingHolidays,
      growth
    };
  }, [workers, entries, advances, holidays]);

  const maxDaily = Math.max(...stats.dailyTrail.map(d => d.value), 1);

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'ยอดจ่ายเดือนนี้', value: stats.totalWagesMonth, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: stats.growth !== 0 ? `${stats.growth > 0 ? '+' : ''}${stats.growth.toFixed(1)}%` : null, trendUp: stats.growth > 0 },
          { label: 'มาทำงานวันนี้', value: `${stats.activeToday} / ${workers.length}`, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'หนี้เบิกสะสม', value: stats.totalDebt, icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-50', isMoney: true },
          { label: 'เงินประกันรวม', value: stats.totalGuarantee, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', isMoney: true },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-4 border-none shadow-sm h-full flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className={cn("p-2 rounded-xl", item.bg, item.color)}>
                  <item.icon className="w-5 h-5" />
                </div>
                {item.trend && (
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5",
                    item.trendUp ? "text-red-500 bg-red-50" : "text-emerald-500 bg-emerald-50"
                  )}>
                    {item.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {item.trend}
                  </span>
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-xl font-black text-gray-900 leading-none">
                  {typeof item.value === 'number' ? `฿${item.value.toLocaleString()}` : item.value}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Today's Attendance Snapshot (Integrated Row) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center justify-between gap-4 px-2 py-1"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">มาทำงาน {stats.attendance.present}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" />
            <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">สาย {stats.attendance.late}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]" />
            <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">ลา/ขาด {stats.attendance.leave}</span>
          </div>
        </div>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
          สถานะวันนี้ ({format(new Date(), 'd MMM yyyy', { locale: th })})
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Wage Trend */}
        <Card className="lg:col-span-2 p-6 border-none shadow-sm overflow-visible flex flex-col">
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-500" />
                แนวโน้มยอดจ่ายรายวัน
              </h3>
              <p className="text-xs text-gray-500 font-medium">ข้อมูลย้อนหลัง 14 วันล่าสุด</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-gray-500">ยอดรวม</span>
               </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px] pb-8 pt-8 overflow-x-auto overflow-y-visible scrollbar-none">
            <div className="h-full min-w-[500px] flex items-end justify-between gap-2 relative px-2">
              <div className="absolute inset-x-0 top-0 border-t border-gray-100/50 h-px" />
              <div className="absolute inset-x-0 top-1/4 border-t border-gray-100/50 h-px" />
              <div className="absolute inset-x-0 top-2/4 border-t border-gray-100/50 h-px" />
              <div className="absolute inset-x-0 top-3/4 border-t border-gray-100/50 h-px" />
              
              {stats.dailyTrail.map((day, i) => (
                <div key={day.date} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(day.value / maxDaily) * 100}%` }}
                    transition={{ delay: 0.5 + i * 0.05, type: 'spring', bounce: 0.2 }}
                    className="w-full max-w-[32px] bg-gradient-to-t from-red-600 to-orange-400 rounded-t-lg relative group-hover:from-red-700 group-hover:to-orange-500 transition-all cursor-pointer min-h-[4px] shadow-sm"
                  />
                  {/* Value label above bar — uses absolute positioning relative to column, always inside pt-8 space */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-30 pointer-events-none shadow-lg">
                    ฿{day.value.toLocaleString()}
                  </div>
                  <div className="absolute -bottom-6 whitespace-nowrap text-[10px] font-bold text-gray-400 group-hover:text-gray-600 transition-colors">
                    {day.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Top Performers */}
        <Card className="p-6 border-none shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              ยอดรวมทุกคน
            </h3>
            <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">เดือนนี้</span>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {stats.topWorkers.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedWorkerDetail({ id: w.id, name: w.name })}
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 group hover:bg-white hover:shadow-sm border border-transparent hover:border-orange-200 transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shadow-sm",
                    i === 0 ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white" : 
                    i === 1 ? "bg-gray-200 text-gray-600" :
                    i === 2 ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"
                  )}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900 leading-none">{w.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">มาทำงาน {w.daysWorked} วัน</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-sm font-black text-red-600">฿{w.monthTotal.toLocaleString()}</div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </motion.div>
            ))}
            {stats.topWorkers.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm font-medium border border-dashed rounded-3xl">
                ยังไม่มีข้อมูลในเดือนนี้
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <Card className="p-6 border-none shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              สรุปรายจ่ายเดือนนี้
            </h3>
            <span className="text-[9px] font-black text-indigo-500 bg-white border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Analytics</span>
          </div>
          
          <div className="space-y-6">
            {/* Visual Bar with Enhanced Look */}
            <div className="h-6 w-full bg-gray-100/50 rounded-2xl overflow-hidden flex shadow-inner border border-white p-1">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-xl transition-all duration-1000 ease-out" 
                style={{ width: `${(stats.breakdown.base / stats.totalBreakdown) * 100}%` }} 
              />
              <div 
                className="h-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-1000 ease-out delay-100" 
                style={{ width: `${(stats.breakdown.ot / stats.totalBreakdown) * 100}%` }} 
              />
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-1000 ease-out delay-200" 
                style={{ width: `${(stats.breakdown.travel / stats.totalBreakdown) * 100}%` }} 
              />
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-red-400 rounded-r-xl transition-all duration-1000 ease-out delay-300"
                style={{ width: `${(stats.breakdown.adjustments / stats.totalBreakdown) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { label: 'ค่าแรงปกติ', value: stats.breakdown.base, color: 'bg-emerald-500', positive: true },
                { label: 'OT (โอที)', value: stats.breakdown.ot, color: 'bg-sky-500', positive: true },
                { label: 'ค่ารถ/ทางด่วน', value: stats.breakdown.travel, color: 'bg-amber-500', positive: true },
                { label: 'รายการปรับเพิ่ม/หัก', value: stats.breakdown.adjustments, color: 'bg-violet-500', positive: stats.breakdown.adjustments >= 0 },
                { label: 'หักเงิน (สาย+ประกัน)', value: stats.breakdown.deductions, color: 'bg-rose-400', positive: false },
                { label: 'หักเบิกล่วงหน้า', value: stats.breakdown.advances, color: 'bg-red-500', positive: false },
              ].map(b => (
                <div key={b.label} className="flex flex-col gap-1 p-2 rounded-xl bg-white/50 border border-white shadow-sm">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                    <div className={cn("w-1.5 h-1.5 rounded-full", b.color)} />
                    {b.label}
                  </div>
                  <div className={cn("text-xs font-black leading-none", b.positive ? 'text-gray-900' : 'text-red-600')}>
                    {b.positive ? '' : '-'}฿{Math.abs(b.value).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-indigo-100/50 flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Net Monthly Pay</span>
              <span className="text-xl font-black text-red-600 tracking-tight">฿{stats.totalBreakdown.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Upcoming Holidays - Polished Look */}
        <Card className="p-6 border-none shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-purple-50/30">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2 relative z-10">
              <Calendar className="w-5 h-5 text-purple-500" />
              วันหยุดนักขัตฤกษ์ถัดไป
            </h3>
            <Activity className="w-4 h-4 text-purple-200 animate-pulse relative z-10" />
          </div>

          <div className="space-y-3 relative z-10">
            {stats.upcomingHolidays.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm font-medium">ไม่มีวันหยุดที่กำลังจะมาถึง</div>
            ) : (
              stats.upcomingHolidays.map((h, hi) => (
                <div key={h.id} className="group relative">
                  <div className={cn(
                    "relative z-10 p-3 rounded-2xl border transition-all flex items-center justify-between",
                    hi === 0 ? "bg-white border-purple-200 shadow-md ring-2 ring-purple-50" : "bg-white/50 border-gray-100/50 hover:bg-white hover:border-purple-100 shadow-sm"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black shadow-sm",
                        hi === 0 ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white" : "bg-gray-50 text-gray-400 border border-gray-100"
                      )}>
                        <span className="text-[9px] uppercase leading-none mb-0.5">{format(parseISO(h.date), 'MMM', { locale: th })}</span>
                        <span className="text-sm leading-none">{format(parseISO(h.date), 'd')}</span>
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-900 group-hover:text-purple-700 transition-colors">{h.name}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          {format(parseISO(h.date), 'EEEE', { locale: th })}
                        </div>
                      </div>
                    </div>
                    {hi === 0 && (
                      <div className="text-[9px] font-black text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full shadow-sm">FAST APPROACHING</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 p-8 text-purple-100 -z-0 opacity-20 blur-2xl translate-x-1/3 -translate-y-1/3">
             <Calendar className="w-64 h-64 rotate-12" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-none shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-500" />
              ประวัติการหักเพิ่มเติม (Adjustments)
            </h3>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </div>

          <div className="space-y-4">
            {stats.recentAdjustments.map((item, i) => (
              <div key={item.id} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    item.adjustment.amount > 0 ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  )} />
                  <div>
                    <div className="text-sm font-black text-gray-900">{item.workerName}</div>
                    <div className="text-[10px] text-gray-500 font-bold">{format(parseISO(item.date), 'd MMM yyyy', { locale: th })} • {item.adjustment.type}</div>
                  </div>
                </div>
                <div className={cn("text-sm font-black", item.adjustment.amount > 0 ? "text-red-600" : "text-emerald-600")}>
                  {item.adjustment.amount > 0 ? '-' : '+'}฿{Math.abs(item.adjustment.amount).toLocaleString()}
                </div>
              </div>
            ))}
            {stats.recentAdjustments.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm font-medium">ยังไม่มีรายการปรับปรุง</div>
            )}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-gray-900 to-black text-white border-none shadow-xl relative overflow-hidden group">
           <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-red-600/20 rounded-full blur-[100px] group-hover:bg-red-600/30 transition-all duration-700" />
           <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-black mb-2 flex items-center gap-2">
                   <Calendar className="w-6 h-6 text-red-500" />
                   Payroll Smart Dashboard
                </h3>
                <p className="text-sm text-gray-400 font-medium max-w-[80%]">
                  ยินดีต้อนรับเข้าสู่ระบบจัดการเงินเดือนอัจฉริยะ Padlomdee Payroll ระบบคำนวณเงินและประกันสะสมให้คุณอัตโนมัติ 
                </p>
              </div>
              
              <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status</div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-sm font-black text-emerald-500">System Online</span>
                    </div>
                 </div>
                 <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Database</div>
                    <div className="text-sm font-black text-sky-400 flex items-center gap-2">
                       Synced (Supabase)
                    </div>
                 </div>
              </div>
           </div>
        </Card>
      </div>

      {/* Worker Detail Modal */}
      <AnimatePresence>
        {selectedWorkerDetail && (() => {
          const now = new Date();
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          const workerEntries = entries
            .filter(e =>
              e.workerId === selectedWorkerDetail.id &&
              !e.isDraft &&
              isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd })
            )
            .sort((a, b) => b.date.localeCompare(a.date));

          const grandTotal = workerEntries.reduce((s, e) => s + (e.totalPay || 0), 0);

          return (
            <motion.div
              key="worker-detail-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
              onClick={() => setSelectedWorkerDetail(null)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0.18 }}
                onClick={e => e.stopPropagation()}
                className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">{selectedWorkerDetail.name}</h2>
                      <p className="text-sm text-gray-400 font-medium mt-0.5">รายละเอียดเงินเดือน {format(now, 'MMMM yyyy', { locale: th })}</p>
                    </div>
                    <button
                      onClick={() => setSelectedWorkerDetail(null)}
                      className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors font-bold text-lg"
                    >×</button>
                  </div>
                  {/* Grand total */}
                  <div className="mt-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 flex items-center justify-between text-white">
                    <span className="font-bold text-sm opacity-90">รวมทั้งเดือน ({workerEntries.filter(e => !e.isLeave).length} วัน)</span>
                    <span className="text-2xl font-black">฿{grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Heatmap Calendar */}
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 shrink-0">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                    ความถี่การเข้างาน (Heatmap)
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 max-w-[300px] mx-auto">
                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                      <div key={d} className="text-center text-[9px] font-bold text-gray-400 mb-1">{d}</div>
                    ))}
                    {Array.from({ length: getDay(monthStart) }).map((_, i) => (
                      <div key={`blank-${i}`} className="aspect-square rounded-md bg-transparent" />
                    ))}
                    {eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const entry = workerEntries.find(e => e.date === dayStr);
                      
                      let bgClass = "bg-gray-100";
                      if (entry) {
                        if (entry.isLeave) {
                          bgClass = entry.leaveType === 'ลาครึ่งวัน' ? "bg-orange-300" : "bg-red-300";
                        } else {
                          if (entry.lateDeduction > 0) bgClass = "bg-yellow-400";
                          else if (entry.overtimePay > 0 || (entry.totalPay || 0) > (entry.baseWage || 0) * 1.3) bgClass = "bg-emerald-500 shadow-sm";
                          else bgClass = "bg-emerald-300";
                        }
                      } else if (isAfter(day, now)) {
                        bgClass = "bg-gray-50 border border-gray-100 border-dashed";
                      }

                      return (
                        <div 
                          key={dayStr} 
                          className={cn("aspect-square rounded-md transition-all hover:scale-110 cursor-help relative group", bgClass)}
                        >
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg">
                            {format(day, 'd MMM', { locale: th })}
                            {entry && ` • ฿${(entry.totalPay || 0).toLocaleString()}`}
                            {!entry && !isAfter(day, now) && ' • ไม่มีบันทึก'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-4 text-[9px] font-bold text-gray-500">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-gray-100"/> ว่าง</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-red-300"/> ลา</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-yellow-400"/> สาย</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-300"/> ปกติ</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"/> มี OT</div>
                  </div>
                </div>

                {/* Per-day breakdown */}
                <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
                  {workerEntries.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
                  )}
                  {workerEntries.map(e => (
                    <div key={e.id} className={`rounded-2xl border p-4 space-y-2 ${e.isLeave ? 'bg-red-50/50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                      {/* Day header */}
                      <div className="flex items-center justify-between">
                        <div className="font-black text-gray-900 text-sm">
                          {format(parseISO(e.date), 'EEEE d MMM', { locale: th })}
                          {e.isLeave && (
                            <span className="ml-2 text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{e.leaveType || 'ลา'}</span>
                          )}
                        </div>
                        <div className={`font-black text-sm ${e.totalPay > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ฿{(e.totalPay || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Line items */}
                      <div className="space-y-1 text-[12px]">
                        {e.baseWage > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>ค่าแรงพื้นฐาน</span>
                            <span className="font-semibold text-gray-800">+฿{e.baseWage.toLocaleString()}</span>
                          </div>
                        )}
                        {e.travelAllowance > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>ค่ารถ</span>
                            <span className="font-semibold text-emerald-600">+฿{e.travelAllowance.toLocaleString()}</span>
                          </div>
                        )}
                        {e.tollFee > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>ค่าทางด่วน</span>
                            <span className="font-semibold text-emerald-600">+฿{e.tollFee.toLocaleString()}</span>
                          </div>
                        )}
                        {e.overtimePay > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>OT ({e.overtimeHours}ชม.{e.overtimeMinutes > 0 ? ` ${e.overtimeMinutes}น.` : ''})</span>
                            <span className="font-semibold text-emerald-600">+฿{e.overtimePay.toLocaleString()}</span>
                          </div>
                        )}
                        {(e.adjustments || []).map((adj, ai) => (
                          <div key={ai} className="flex justify-between text-gray-600">
                            <span>{adj.note || (adj.type === 'add' ? 'รายการเพิ่ม' : 'รายการหัก')}</span>
                            <span className={`font-semibold ${adj.type === 'add' ? 'text-emerald-600' : 'text-red-500'}`}>
                              {adj.type === 'add' ? '+' : '-'}฿{adj.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {e.lateDeduction > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>หักมาสาย</span>
                            <span className="font-semibold text-red-500">-฿{e.lateDeduction.toLocaleString()}</span>
                          </div>
                        )}
                        {(e.guaranteeDeduction || 0) > 0 && (
                          <div className="flex justify-between text-gray-600">
                            <span>หักประกันสะสม</span>
                            <span className="font-semibold text-orange-500">-฿{(e.guaranteeDeduction || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {e.clockIn && e.clockOut && (
                          <div className="text-gray-400 pt-1 border-t border-gray-100 text-[11px]">
                            เวลา {e.clockIn} – {e.clockOut}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
