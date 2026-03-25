import React, { useState, useEffect } from 'react';
import { WorkersPage } from './pages/WorkersPage';
import { DailyEntryPage } from './pages/DailyEntryPage';
import { ReportsPage } from './pages/ReportsPage';
import { WalletPage } from './pages/WalletPage';
import { DashboardPage } from './pages/DashboardPage';
import { Users, CalendarDays, FileText, Wallet, Moon, Sun, Snowflake, RefreshCw, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Snowfall from 'react-snowfall';
import { cn } from './components/ui';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'daily' | 'workers' | 'reports' | 'wallet'>('dashboard');

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const [isSnowing, setIsSnowing] = useState(() => {
    return localStorage.getItem('snow') === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('snow', isSnowing.toString());
  }, [isSnowing]);

  // Prevent scroll wheel from changing number input values globally
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        e.preventDefault();
      }
    };

    // { passive: false } is required to allow e.preventDefault()
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className="min-h-screen relative bg-gray-50/50 dark:bg-zinc-950 font-sans text-gray-900 pb-24 transition-colors duration-300 isolate">
      {/* Background patterns */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-40 dark:opacity-20 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-200/20 dark:bg-red-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/20 dark:bg-sky-900/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>
      {isSnowing && (
        <Snowfall
          snowflakeCount={isDarkMode ? 150 : 80}
          color={isDarkMode ? '#ffffff' : '#c3d5f0'}
          style={{
            position: 'fixed',
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-gray-100/80 dark:border-zinc-800 backdrop-blur-md transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-md shadow-red-200 flex items-center justify-center border-2 border-white dark:border-zinc-800"
            >
              <span className="text-white font-black text-xl italic select-none">P</span>
            </motion.div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tight text-gray-900 dark:text-zinc-100 leading-none">
                {activeTab === 'dashboard' && 'ภาพรวมระบบ'}
                {activeTab === 'daily' && 'บันทึกรายวัน'}
                {activeTab === 'workers' && 'จัดการช่าง'}
                {activeTab === 'wallet' && 'บัญชีสะสม'}
                {activeTab === 'reports' && 'รายงาน'}
              </h1>
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-0.5 opacity-80">Padlomdee Payroll</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.reload()}
              className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
              title="Refresh / อัปเดตข้อมูล"
            >
              <RefreshCw className="w-5 h-5 stroke-[2.2px]" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, rotate: isSnowing ? 12 : 0 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSnowing(!isSnowing)}
              className={cn(
                "p-2.5 rounded-2xl transition-all duration-300", 
                isSnowing 
                  ? "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400 shadow-sm" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-zinc-800 dark:text-zinc-400"
              )}
              title="Let it snow!"
            >
              <Snowflake className={cn("w-5 h-5 stroke-[2.2px]", isSnowing && "animate-pulse")} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-2xl bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-zinc-800 dark:text-zinc-400 transition-colors"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5 stroke-[2.2px]" /> : <Moon className="w-5 h-5 stroke-[2.2px]" />}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {activeTab === 'dashboard' && <DashboardPage />}
            {activeTab === 'daily' && <DailyEntryPage />}
            {activeTab === 'workers' && <WorkersPage />}
            {activeTab === 'wallet' && <WalletPage />}
            {activeTab === 'reports' && <ReportsPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-20 pb-safe transition-all duration-500">
        <div className="max-w-5xl mx-auto flex justify-around px-2 py-3">
          {[
            { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
            { id: 'daily', label: 'รายวัน', icon: CalendarDays },
            { id: 'workers', label: 'ช่าง', icon: Users },
            { id: 'wallet', label: 'บัญชีสะสม', icon: Wallet },
            { id: 'reports', label: 'รายงาน', icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className="relative flex flex-col items-center group w-20 transition-all active:scale-90"
              >
                <div className={cn(
                  "relative p-2 rounded-2xl mb-1.5 transition-all duration-300 overflow-hidden",
                  isActive 
                    ? "bg-red-50 dark:bg-red-900/20 shadow-[0_0_20px_rgba(239,68,68,0.15)] scale-110" 
                    : "bg-transparent text-gray-400 group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/50"
                )}>
                  {isActive && (
                    <motion.div
                      layoutId="nav-glow"
                      className="absolute inset-0 bg-gradient-to-br from-red-100/50 to-orange-100/50 dark:from-red-900/40 dark:to-orange-900/40"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  <Icon 
                    className={cn(
                      "w-6 h-6 relative z-10 transition-all duration-300",
                      isActive ? "text-red-600 stroke-[2.2px]" : "text-gray-400 group-hover:text-gray-600"
                    )} 
                    fill={isActive ? "currentColor" : "none"}
                    fillOpacity={isActive ? 0.15 : 0}
                  />
                </div>
                <span className={cn(
                  "text-[11px] font-bold tracking-tight transition-all duration-300 relative z-10",
                  isActive ? "text-red-600 translate-y-[-2px]" : "text-gray-400 group-hover:text-gray-600"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
