import React, { useState } from 'react';
import { WorkersPage } from './pages/WorkersPage';
import { DailyEntryPage } from './pages/DailyEntryPage';
import { ReportsPage } from './pages/ReportsPage';
import { Users, CalendarDays, FileText } from 'lucide-react';
import { cn } from './components/ui';

export default function App() {
  const [activeTab, setActiveTab] = useState<'daily' | 'workers' | 'reports'>('daily');

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-24">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 border-b border-gray-100/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            {activeTab === 'daily' && 'บันทึกรายวัน'}
            {activeTab === 'workers' && 'จัดการช่าง'}
            {activeTab === 'reports' && 'รายงาน'}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'daily' && <DailyEntryPage />}
        {activeTab === 'workers' && <WorkersPage />}
        {activeTab === 'reports' && <ReportsPage />}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 z-20 pb-safe">
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
