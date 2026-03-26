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
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, isAfter, startOfDay } from 'date-fns';
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

    // 1. Total Wages this month
    const totalWagesMonth = entries
      .filter(e => !e.isDraft && !e.isLeave && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
      .reduce((sum, e) => sum + (e.totalPay || 0), 0);

    // 2. Active workers today
    const activeToday = entries.filter(e => e.date === todayStr && !e.isLeave).length;

    // 3. Total Advance Debt
    const totalDebt = advances.reduce((sum, a) => sum + (a.type === 'borrow' ? a.amount : -a.amount), 0);

    // 4. Total Guarantee Fund
    const historicalTotal = workers.reduce((sum, w) => sum + (w.historicalGuarantee || 0), 0);
    const entriesGuarantee = entries
      .filter(e => !e.isDraft && !e.isLeave)
      .reduce((sum, e) => sum + (e.guaranteeDeduction || 0), 0);
    const totalGuarantee = historicalTotal + entriesGuarantee;

    // 5. Daily Trend (Last 14 days)
    const dailyTrail = Array.from({ length: 14 }).map((_, i) => {
      const d = subDays(now, 13 - i);
      const dStr = format(d, 'yyyy-MM-dd');
      const dayTotal = entries
        .filter(e => e.date === dStr && !e.isDraft && !e.isLeave)
        .reduce((sum, e) => sum + (e.totalPay || 0), 0);
      return {
        date: dStr,
        label: format(d, 'd MMM', { locale: th }),
        value: dayTotal
      };
    });

    // 6. Top Workers (This month)
    const workerStats = workers.map(w => {
      const monthTotal = entries
        .filter(e => e.workerId === w.id && !e.isDraft && !e.isLeave && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
        .reduce((sum, e) => sum + (e.totalPay || 0), 0);
      const daysWorked = entries.filter(e => e.workerId === w.id && !e.isDraft && !e.isLeave && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd })).length;
      return { ...w, monthTotal, daysWorked };
    }).sort((a, b) => b.monthTotal - a.monthTotal);

    // 7. Recent Adjustments
    const recentAdjustments = entries
      .filter(e => e.adjustments && e.adjustments.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        workerName: workers.find(w => w.id === e.workerId)?.name || 'Unknown',
        date: e.date,
        adjustment: e.adjustments[0] // Just show the first one for brevity
      }));

    // 8. Today's Attendance Summary
    const todayEntries = entries.filter(e => e.date === todayStr && !e.isDraft);
    const attendance = {
      present: todayEntries.filter(e => !e.isLeave).length,
      late: todayEntries.filter(e => e.lateDeduction > 0).length,
      leave: todayEntries.filter(e => e.isLeave).length,
      total: workers.length
    };

    // 9. Monthly Expense Breakdown
    const monthEntries = entries.filter(e => !e.isDraft && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }));
    const breakdown = {
      base: monthEntries.reduce((sum, e) => sum + (e.baseWage || 0), 0),
      ot: monthEntries.reduce((sum, e) => sum + (e.overtimePay || 0), 0),
      travel: monthEntries.reduce((sum, e) => sum + (e.travelAllowance || 0) + (e.tollFee || 0), 0),
      others: monthEntries.reduce((sum, e) => {
        const adjs = e.adjustments?.reduce((s, a) => s + (a.type === 'add' ? a.amount : -a.amount), 0) || 0;
        return sum + adjs;
      }, 0)
    };
    const totalBreakdown = breakdown.base + breakdown.ot + breakdown.travel + breakdown.others;

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

      {/* Today's Attendance Snapshot */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-4 border-none shadow-sm flex flex-wrap items-center justify-around gap-4 bg-white/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">ทำงานวันนี้</div>
              <div className="text-lg font-black text-emerald-600 leading-none">{stats.attendance.present} <span className="text-xs text-gray-400 font-bold ml-1">คน</span></div>
            </div>
          </div>
          
          <div className="w-px h-8 bg-gray-100 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-sm border border-orange-100/50">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">มาสาย</div>
              <div className="text-lg font-black text-orange-600 leading-none">{stats.attendance.late} <span className="text-xs text-gray-400 font-bold ml-1">คน</span></div>
            </div>
          </div>

          <div className="w-px h-8 bg-gray-100 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shadow-sm border border-red-100/50">
              <UserMinus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">ลากับขาด</div>
              <div className="text-lg font-black text-red-600 leading-none">{stats.attendance.leave} <span className="text-xs text-gray-400 font-bold ml-1">คน</span></div>
            </div>
          </div>
        </Card>
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
        <Card className="p-6 border-none shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              สรุปรายจ่ายเดือนนี้
            </h3>
            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Budget Allocation</span>
          </div>
          
          <div className="space-y-6">
            {/* Visual Bar */}
            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000 ease-out" 
                style={{ width: `${(stats.breakdown.base / stats.totalBreakdown) * 100}%` }} 
                title={`ค่าแรง: ฿${stats.breakdown.base.toLocaleString()}`}
              />
              <div 
                className="h-full bg-sky-500 transition-all duration-1000 ease-out delay-100" 
                style={{ width: `${(stats.breakdown.ot / stats.totalBreakdown) * 100}%` }} 
                title={`OT: ฿${stats.breakdown.ot.toLocaleString()}`}
              />
              <div 
                className="h-full bg-amber-500 transition-all duration-1000 ease-out delay-200" 
                style={{ width: `${(stats.breakdown.travel / stats.totalBreakdown) * 100}%` }} 
                title={`ค่ารถ/ทางด่วน: ฿${stats.breakdown.travel.toLocaleString()}`}
              />
              <div 
                className="h-full bg-rose-500 transition-all duration-1000 ease-out delay-300" 
                style={{ width: `${(stats.breakdown.others / stats.totalBreakdown) * 100}%` }} 
                title={`อื่นๆ: ฿${stats.breakdown.others.toLocaleString()}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  ค่าแรงปกติ
                </div>
                <div className="text-sm font-black text-gray-900">฿{stats.breakdown.base.toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  OT (โอที)
                </div>
                <div className="text-sm font-black text-gray-900">฿{stats.breakdown.ot.toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  ค่ารถ/ทางด่วน
                </div>
                <div className="text-sm font-black text-gray-900">฿{stats.breakdown.travel.toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  รายการอื่นๆ
                </div>
                <div className="text-sm font-black text-gray-900">฿{stats.breakdown.others.toLocaleString()}</div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">ยอดรวมทั้งหมด</span>
              <span className="text-lg font-black text-red-600">฿{stats.totalBreakdown.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Upcoming Holidays */}
        <Card className="p-6 border-none shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              วันหยุดนักขัตฤกษ์ถัดไป
            </h3>
            <Activity className="w-4 h-4 text-purple-200" />
          </div>

          <div className="space-y-3">
            {stats.upcomingHolidays.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm font-medium">ไม่มีวันหยุดที่กำลังจะมาถึง</div>
            ) : (
              stats.upcomingHolidays.map((h, hi) => (
                <div key={h.id} className="group relative">
                  <div className={cn(
                    "relative z-10 p-4 rounded-2xl border transition-all flex items-center justify-between",
                    hi === 0 ? "bg-purple-50/50 border-purple-100 shadow-sm" : "bg-gray-50 border-gray-100 hover:bg-white hover:border-purple-100"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black",
                        hi === 0 ? "bg-purple-600 text-white" : "bg-white text-gray-400"
                      )}>
                        <span className="text-[10px] uppercase leading-none mb-0.5">{format(parseISO(h.date), 'MMM', { locale: th })}</span>
                        <span className="text-sm leading-none">{format(parseISO(h.date), 'd')}</span>
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-900">{h.name}</div>
                        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">
                          {format(parseISO(h.date), 'EEEE', { locale: th })}
                        </div>
                      </div>
                    </div>
                    {hi === 0 && (
                      <div className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full animate-pulse">เร็วๆ นี้</div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="absolute top-0 right-0 p-8 text-purple-50 -z-0 opacity-10 blur-xl translate-x-1/2 -translate-y-1/2">
               <Calendar className="w-48 h-48" />
            </div>
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
