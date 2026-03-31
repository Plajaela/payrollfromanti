import React, { useState } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Label, Card, Modal } from '../components/ui';
import { Plus, Trash2, UserPlus, CalendarOff, PlusCircle, Sparkles, Check, Settings2, Wallet, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../components/ui';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

const THAI_PUBLIC_HOLIDAYS_2025 = [
  { date: '2025-01-01', name: 'วันปีใหม่' },
  { date: '2025-04-06', name: 'วันจักรี' },
  { date: '2025-04-13', name: 'วันสงกรานต์ วัน 1' },
  { date: '2025-04-14', name: 'วันสงกรานต์ วัน 2' },
  { date: '2025-04-15', name: 'วันสงกรานต์ วัน 3' },
  { date: '2025-05-01', name: 'วันแรงงานแห่งชาติ' },
  { date: '2025-05-05', name: 'วันฉัตรมงคล' },
  { date: '2025-06-03', name: 'วันเฉลิมฯ สมเด็จพระราชินี' },
  { date: '2025-07-28', name: 'วันเฉลิมฯ ร.10' },
  { date: '2025-08-12', name: 'วันแม่แห่งชาติ' },
  { date: '2025-10-13', name: 'วันนวมินทรมหาราช' },
  { date: '2025-10-23', name: 'วันปิยมหาราช' },
  { date: '2025-12-05', name: 'วันพ่อแห่งชาติ' },
  { date: '2025-12-10', name: 'วันรัฐธรรมนูญ' },
  { date: '2025-12-31', name: 'วันสิ้นปี' },
  // 2026
  { date: '2026-01-01', name: 'วันปีใหม่' },
  { date: '2026-04-06', name: 'วันจักรี' },
  { date: '2026-04-13', name: 'วันสงกรานต์ วัน 1' },
  { date: '2026-04-14', name: 'วันสงกรานต์ วัน 2' },
  { date: '2026-04-15', name: 'วันสงกรานต์ วัน 3' },
  { date: '2026-05-01', name: 'วันแรงงานแห่งชาติ' },
  { date: '2026-05-04', name: 'วันฉัตรมงคล' },
  { date: '2026-06-03', name: 'วันเฉลิมฯ สมเด็จพระราชินี' },
  { date: '2026-07-28', name: 'วันเฉลิมฯ ร.10' },
  { date: '2026-08-12', name: 'วันแม่แห่งชาติ' },
  { date: '2026-10-23', name: 'วันปิยมหาราช' },
  { date: '2026-12-05', name: 'วันพ่อแห่งชาติ' },
  { date: '2026-12-10', name: 'วันรัฐธรรมนูญ' },
  { date: '2026-12-31', name: 'วันสิ้นปี' },
];

export function WorkersPage({ onNavigateToDate }: { onNavigateToDate?: (date: string) => void }) {
  const { workers, addWorker, updateWorker, deleteWorker, holidays, addHoliday, deleteHoliday } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [presetLoaded, setPresetLoaded] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [editingHolidayName, setEditingHolidayName] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    baseWage: '',
    defaultTravelAllowance: '',
    shiftStart: '07:00',
    shiftEnd: '16:00',
    paymentType: 'day' as 'day' | 'month' | 'half-month',
    monthlyWage: '',
    hasSocialSecurity: false,
    hasGuarantee: false,
    lateRateRule: 'normal' as 'normal' | 'special',
  });

  const resetForm = () => {
    setFormData({ name: '', baseWage: '', defaultTravelAllowance: '', shiftStart: '07:00', shiftEnd: '16:00', paymentType: 'day', monthlyWage: '', hasSocialSecurity: false, hasGuarantee: false, lateRateRule: 'normal' });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleEdit = (worker: any) => {
    setFormData({
      name: worker.name,
      baseWage: worker.baseWage.toString(),
      defaultTravelAllowance: worker.defaultTravelAllowance.toString(),
      shiftStart: worker.shiftStart || '07:00',
      shiftEnd: worker.shiftEnd || '16:00',
      paymentType: worker.paymentType || 'day',
      monthlyWage: (worker.monthlyWage || '').toString(),
      hasSocialSecurity: worker.hasSocialSecurity || false,
      hasGuarantee: worker.hasGuarantee || false,
      lateRateRule: worker.lateRateRule || 'normal',
    });
    setEditingId(worker.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.baseWage) return;

    const workerData = {
      name: formData.name,
      baseWage: Number(formData.baseWage) || 0,
      defaultTravelAllowance: Number(formData.defaultTravelAllowance) || 0,
      shiftStart: formData.shiftStart,
      shiftEnd: formData.shiftEnd,
      paymentType: formData.paymentType,
      monthlyWage: formData.paymentType === 'month' ? (Number(formData.monthlyWage) || 0) : 0,
      hasSocialSecurity: formData.paymentType === 'month' ? formData.hasSocialSecurity : false,
      hasGuarantee: formData.hasGuarantee,
      lateRateRule: formData.lateRateRule,
    };

    if (editingId) {
      updateWorker(editingId, workerData);
    } else {
      addWorker(workerData);
    }
    resetForm();
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-500 text-sm">จำนวนช่างทั้งหมด {workers.length} คน</div>
      </div>

      <div className="space-y-6">
        {workers.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-dashed border-gray-200">
            <UserPlus className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>ยังไม่มีข้อมูลช่าง</p>
            <p className="text-sm mt-1">กดปุ่ม + ด้านล่างเพื่อเพิ่มช่าง</p>
          </div>
        ) : (
          <>
            {['day', 'half-month', 'month'].map((paymentTypeGroup) => {
              const groupWorkers = workers.filter(w => (w.paymentType || 'day') === paymentTypeGroup);

              if (groupWorkers.length === 0) return null;

              const translatePaymentType = (type: string) => {
                switch (type) {
                  case 'day': return 'รายวัน';
                  case 'half-month': return 'ทุก 15 วัน (วิก)';
                  case 'month': return 'สิ้นเดือน';
                  default: return 'ไม่ระบุ';
                }
              };

              return (
                <div key={paymentTypeGroup} className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-700 bg-gray-100/50 px-3 py-1.5 rounded-lg inline-block">
                    รับเงิน{translatePaymentType(paymentTypeGroup)} <span className="text-gray-400 font-normal">({groupWorkers.length})</span>
                  </h3>
                  {groupWorkers.map((worker) => (
                    <Card key={worker.id} className="p-4 flex items-center justify-between active:scale-[0.98] transition-transform">
                      <div className="flex-1" onClick={() => handleEdit(worker)}>
                        <h4 className="font-semibold text-gray-900 text-lg">{worker.name}</h4>
                        <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-2">
                          <span className="bg-gray-100 px-2 py-0.5 rounded-md">ค่าแรง ฿{worker.baseWage}</span>
                          {worker.defaultTravelAllowance > 0 && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded-md">ค่ารถ ฿{worker.defaultTravelAllowance}</span>
                          )}
                          <span className="bg-sky-50 text-red-700 px-2 py-0.5 rounded-md">เวลา {worker.shiftStart || '07:00'} - {worker.shiftEnd || '16:00'}</span>
                          {worker.hasGuarantee && (
                            <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md shrink-0">หักประกัน</span>
                          )}
                          {worker.monthlyWage > 0 && (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Wallet className="w-3 h-3" />
                              ฿{worker.monthlyWage.toLocaleString()}
                            </span>
                          )}
                          {worker.hasSocialSecurity && (
                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              ประกันสังคม
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md shrink-0 ${worker.lateRateRule === 'special' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                            หักสาย{worker.lateRateRule === 'special' ? 'อัตราพิเศษ' : 'ปกติ'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 pl-2 border-l border-gray-100 ml-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2.5 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`ต้องการลบช่าง ${worker.name} ใช่หรือไม่?`)) {
                              deleteWorker(worker.id);
                            }
                          }}
                        >
                          <Trash2 className="w-5 h-5 stroke-[2.2px]" fill="currentColor" fillOpacity={0.1} />
                        </motion.button>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ========= HOLIDAY MANAGEMENT ========= */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-purple-500" />
            วันหยุดนักขัตฤกษ์
          </h3>
          <span className="text-xs text-gray-400">{holidays.length} วัน</span>
        </div>

        {/* Preset loader */}
        <button
          onClick={async () => {
            setIsLoadingPreset(true);
            setPresetLoaded(false);
            for (const h of THAI_PUBLIC_HOLIDAYS_2025) {
              await addHoliday(h.date, h.name);
            }
            setIsLoadingPreset(false);
            setPresetLoaded(true);
            setTimeout(() => setPresetLoaded(false), 3000);
          }}
          disabled={isLoadingPreset}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 transition-all text-sm font-semibold disabled:opacity-60"
        >
          <Sparkles className="w-4 h-4" />
          {isLoadingPreset ? 'กำลังโหลด...' : presetLoaded ? `✅ โหลดแล้ว ${THAI_PUBLIC_HOLIDAYS_2025.length} วันหยุด` : 'ตั้งค่าวันหยุดไทยอัตโนมัติ ปี 2568-2569'}
        </button>

        {/* Add custom holiday */}
        <div className="flex gap-2">
          <Input
            type="date"
            value={newHolidayDate}
            onChange={e => setNewHolidayDate(e.target.value)}
            className="w-40 shrink-0 h-10 text-sm"
          />
          <Input
            placeholder="ชื่อวันหยุด เช่น สงกรานต์วัน 1"
            value={newHolidayName}
            onChange={e => setNewHolidayName(e.target.value)}
            className="flex-1 h-10 text-sm"
          />
          <button
            onClick={() => {
              if (!newHolidayDate || !newHolidayName.trim()) return;
              addHoliday(newHolidayDate, newHolidayName.trim());
              setNewHolidayDate('');
              setNewHolidayName('');
            }}
            className="shrink-0 px-3 h-10 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Holiday list */}
        {holidays.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            ยังไม่มีวันหยุด — กดปุ่มด้านบนเพื่อตั้งค่าวันหยุดไทยอัตโนมัติ
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between bg-purple-50/60 border border-purple-100 rounded-2xl px-3 py-2">
                <button
                  className="flex-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onNavigateToDate?.(h.date)}
                  title="กดเพื่อไปหน้ารายวัน"
                >
                  {editingHolidayId === h.id ? (
                    <input
                      autoFocus
                      className="w-full text-sm font-semibold text-purple-900 bg-white border border-purple-300 rounded-lg px-2 py-0.5 outline-none"
                      value={editingHolidayName}
                      onChange={e => setEditingHolidayName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          addHoliday(h.date, editingHolidayName);
                          setEditingHolidayId(null);
                        } else if (e.key === 'Escape') {
                          setEditingHolidayId(null);
                        }
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div className="font-semibold text-purple-900 text-sm">🎌 {h.name}</div>
                  )}
                  <div className="text-[11px] text-purple-400">{format(parseISO(h.date), 'd MMMM yyyy', { locale: th })} — กดเพื่อไปหน้ารายวัน</div>
                </button>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (editingHolidayId === h.id) {
                        addHoliday(h.date, editingHolidayName);
                        setEditingHolidayId(null);
                      } else {
                        setEditingHolidayId(h.id);
                        setEditingHolidayName(h.name);
                      }
                    }}
                    className="p-1.5 rounded-xl bg-purple-100 text-purple-500 hover:bg-purple-200 transition-colors"
                  >
                    {editingHolidayId === h.id ? <Check className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteHoliday(h.id)}
                    className="p-1.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          resetForm();
          setIsModalOpen(true);
        }}
        className="fixed bottom-28 right-6 w-16 h-16 bg-red-600 text-white rounded-[2rem] shadow-xl shadow-red-200 flex items-center justify-center hover:bg-red-700 transition-all z-10 border-4 border-white dark:border-zinc-900"
      >
        <Plus className="w-8 h-8 stroke-[2.5px]" />
      </motion.button>

      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
        title={editingId ? 'แก้ไขข้อมูลช่าง' : 'เพิ่มช่างใหม่'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อช่าง</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="เช่น ช่างสมชาย"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseWage">ค่าแรงพื้นฐาน (บาท)</Label>
              <Input
                id="baseWage"
                type="number"
                min="0"
                value={formData.baseWage}
                onChange={(e) => setFormData({ ...formData, baseWage: e.target.value })}
                placeholder="เช่น 500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultTravelAllowance">ค่ารถประจำ (บาท)</Label>
              <Input
                id="defaultTravelAllowance"
                type="number"
                min="0"
                value={formData.defaultTravelAllowance}
                onChange={(e) => setFormData({ ...formData, defaultTravelAllowance: e.target.value })}
                placeholder="เช่น 100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shiftStart">เวลาเข้างาน</Label>
              <Input
                id="shiftStart"
                type="time"
                value={formData.shiftStart}
                onChange={(e) => setFormData({ ...formData, shiftStart: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shiftEnd">เวลาเลิกงาน</Label>
              <Input
                id="shiftEnd"
                type="time"
                value={formData.shiftEnd}
                onChange={(e) => setFormData({ ...formData, shiftEnd: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentType">รอบการจ่ายเงิน</Label>
            <select
              id="paymentType"
              value={formData.paymentType}
              onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as 'half-month' | 'month' | 'day' })}
              className="w-full rounded-2xl border-0 bg-gray-100/80 px-4 py-3 text-base text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all appearance-none"
            >
              <option value="day">จ่ายรายวัน (จบวันเคลียร์เลย)</option>
              <option value="half-month">จ่ายแบบวิก (ทุก 15 วัน)</option>
              <option value="month">จ่ายสิ้นเดือน (ทุก 30 วัน)</option>
            </select>
          </div>

          {formData.paymentType === 'month' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="monthlyWage" className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  ฐานเงินเดือนรายเดือน (บาท)
                </Label>
                <Input
                  id="monthlyWage"
                  type="number"
                  min="0"
                  value={formData.monthlyWage}
                  onChange={(e) => setFormData({ ...formData, monthlyWage: e.target.value })}
                  placeholder="เช่น 20000"
                  className="bg-emerald-50 border-emerald-100 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-purple-900">หักประกันสังคม (750 บาท)</div>
                      <div className="text-xs text-purple-500 mt-0.5">หักอัตโนมัติเมื่อสรุปยอดสิ้นเดือน</div>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={formData.hasSocialSecurity} onChange={(e) => setFormData(p => ({ ...p, hasSocialSecurity: e.target.checked }))} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                  </div>
                </label>
              </div>
            </motion.div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lateRateRule">กฎการหักมาสาย/กลับก่อน</Label>
            <select
              id="lateRateRule"
              value={formData.lateRateRule}
              onChange={(e) => setFormData({ ...formData, lateRateRule: e.target.value as 'normal' | 'special' })}
              className="w-full rounded-2xl border-0 bg-gray-100/80 px-4 py-3 text-base text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all appearance-none cursor-pointer"
            >
              <option value="normal">เรทปกติ (หัก 100 บาท/ชม.)</option>
              <option value="special">เรทพิเศษ {`(ไม่เกิน 15น. = 0บ., ไม่เกิน 45น. = 25บ., ไม่เกิน 60น. = 50บ.)`}</option>
            </select>
          </div>

          <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-semibold text-gray-900">หักเงินประกันสะสมเริ่มต้น</div>
                <div className="text-xs text-gray-500 mt-0.5">เปิดไว้เพื่อหักเงินทุกครั้งที่เพิ่มบิลรายวัน</div>
              </div>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={formData.hasGuarantee} onChange={(e) => setFormData(p => ({ ...p, hasGuarantee: e.target.checked }))} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </div>
            </label>
          </div>

          <div className="pt-4 flex gap-3">
            {editingId && (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (window.confirm(`ต้องการลบช่าง ${formData.name} ใช่หรือไม่?`)) {
                    deleteWorker(editingId);
                    resetForm();
                  }
                }}
                className="bg-red-50 text-red-600 hover:bg-red-100 px-4"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">ยกเลิก</Button>
            <Button type="submit" className="flex-1">บันทึก</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
