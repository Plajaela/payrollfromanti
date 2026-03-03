import React, { useState } from 'react';
import { useStore } from '../useStore';
import { Button, Input, Label, Card, Modal } from '../components/ui';
import { Plus, Trash2, UserPlus } from 'lucide-react';

export function WorkersPage() {
  const { workers, addWorker, updateWorker, deleteWorker } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    baseWage: '',
    defaultTravelAllowance: '',
    shiftStart: '07:00',
    shiftEnd: '16:00',
    paymentType: 'month' as 'month' | 'half-month',
  });

  const resetForm = () => {
    setFormData({ name: '', baseWage: '', defaultTravelAllowance: '', shiftStart: '07:00', shiftEnd: '16:00', paymentType: 'month' });
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
      paymentType: worker.paymentType || 'month',
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

      <div className="space-y-3">
        {workers.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-dashed border-gray-200">
            <UserPlus className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>ยังไม่มีข้อมูลช่าง</p>
            <p className="text-sm mt-1">กดปุ่ม + ด้านล่างเพื่อเพิ่มช่าง</p>
          </div>
        ) : (
          workers.map((worker) => (
            <Card key={worker.id} className="p-4 flex items-center justify-between active:scale-[0.98] transition-transform">
              <div className="flex-1" onClick={() => handleEdit(worker)}>
                <h4 className="font-semibold text-gray-900 text-lg">{worker.name}</h4>
                <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-2">
                  <span className="bg-gray-100 px-2 py-0.5 rounded-md">ค่าแรง ฿{worker.baseWage}</span>
                  {worker.defaultTravelAllowance > 0 && (
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md">ค่ารถ ฿{worker.defaultTravelAllowance}</span>
                  )}
                  <span className="bg-sky-50 text-red-700 px-2 py-0.5 rounded-md">เวลา {worker.shiftStart || '07:00'} - {worker.shiftEnd || '16:00'}</span>
                  <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md">รับเงิน{worker.paymentType === 'half-month' ? 'ทุก 15 วัน' : 'สิ้นเดือน'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 pl-2 border-l border-gray-100 ml-2">
                <Button
                  variant="danger"
                  className="p-2 h-auto rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`ต้องการลบช่าง ${worker.name} ใช่หรือไม่?`)) {
                      deleteWorker(worker.id);
                    }
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          resetForm();
          setIsModalOpen(true);
        }}
        className="fixed bottom-24 right-4 w-14 h-14 bg-red-600 text-white rounded-full shadow-lg shadow-red-200 flex items-center justify-center hover:bg-red-700 active:scale-95 transition-all z-10"
      >
        <Plus className="w-6 h-6" />
      </button>

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
              onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as 'half-month' | 'month' })}
              className="w-full rounded-2xl border-0 bg-gray-100/80 px-4 py-3 text-base text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all appearance-none"
            >
              <option value="month">จ่ายสิ้นเดือน (ทุก 30 วัน)</option>
              <option value="half-month">จ่ายแบบวิก (ทุก 15 วัน)</option>
            </select>
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
