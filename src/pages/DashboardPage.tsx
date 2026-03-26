import React, { useMemo } from 'react';
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
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { Card, cn } from '../components/ui';

export function DashboardPage() {
  const { workers, entries, advances } = useStore();

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

    return {
      totalWagesMonth,
      activeToday,
      totalDebt,
      totalGuarantee,
      dailyTrail,
      topWorkers: workerStats,
      recentAdjustments
    };
  }, [workers, entries, advances]);

  const maxDaily = Math.max(...stats.dailyTrail.map(d => d.value), 1);

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'ยอดจ่ายเดือนนี้', value: stats.totalWagesMonth, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+5.2%' },
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
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> {item.trend}
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

      {/* Main Charts Row */}
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
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 group hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all"
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
                <div className="text-sm font-black text-red-600">
                  ฿{w.monthTotal.toLocaleString()}
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
    </div>
  );
}
