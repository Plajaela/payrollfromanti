import React, { useState, useEffect } from 'react';
import { WorkersPage } from './pages/WorkersPage';
import { DailyEntryPage } from './pages/DailyEntryPage';
import { ReportsPage } from './pages/ReportsPage';
import { WalletPage } from './pages/WalletPage';
import { Users, CalendarDays, FileText, Wallet, Moon, Sun, Snowflake, RefreshCw } from 'lucide-react';
import Snowfall from 'react-snowfall';
import { cn } from './components/ui';

export default function App() {
  const [activeTab, setActiveTab] = useState<'daily' | 'workers' | 'reports' | 'wallet'>('daily');

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
    <div className="min-h-screen bg-gray-50/50 dark:bg-zinc-950 font-sans text-gray-900 pb-24 transition-colors duration-300">
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
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
            {activeTab === 'daily' && 'บันทึกรายวัน'}
            {activeTab === 'workers' && 'จัดการช่าง'}
            {activeTab === 'wallet' && 'บัญชีสะสม'}
            {activeTab === 'reports' && 'รายงาน'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-xl bg-emerald-100/50 text-emerald-600 hover:bg-emerald-200/50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-800/50 transition-colors"
              title="Refresh / อัปเดตข้อมูล"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsSnowing(!isSnowing)}
              className={cn("p-2 rounded-xl transition-all duration-300", isSnowing ? "bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400 rotate-12 scale-110" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700")}
              title="Let it snow!"
            >
              <Snowflake className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'daily' && <DailyEntryPage />}
        {activeTab === 'workers' && <WorkersPage />}
        {activeTab === 'wallet' && <WalletPage />}
        {activeTab === 'reports' && <ReportsPage />}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg border-t border-gray-100 dark:border-zinc-800 z-20 pb-safe transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex justify-around px-2 py-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={cn(
              "flex flex-col items-center p-2 rounded-2xl w-20 transition-all",
              activeTab === 'daily' ? "text-red-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn("p-1.5 rounded-xl mb-1 transition-colors", activeTab === 'daily' ? "bg-sky-50" : "")}>
              <CalendarDays className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-semibold">รายวัน</span>
          </button>
          <button
            onClick={() => setActiveTab('workers')}
            className={cn(
              "flex flex-col items-center p-2 rounded-2xl w-20 transition-all",
              activeTab === 'workers' ? "text-red-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn("p-1.5 rounded-xl mb-1 transition-colors", activeTab === 'workers' ? "bg-sky-50" : "")}>
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-semibold">ช่าง</span>
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={cn(
              "flex flex-col items-center p-2 rounded-2xl w-20 transition-all",
              activeTab === 'wallet' ? "text-red-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn("p-1.5 rounded-xl mb-1 transition-colors", activeTab === 'wallet' ? "bg-sky-50" : "")}>
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-semibold">บัญชีสะสม</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              "flex flex-col items-center p-2 rounded-2xl w-20 transition-all",
              activeTab === 'reports' ? "text-red-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={cn("p-1.5 rounded-xl mb-1 transition-colors", activeTab === 'reports' ? "bg-sky-50" : "")}>
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-semibold">รายงาน</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
