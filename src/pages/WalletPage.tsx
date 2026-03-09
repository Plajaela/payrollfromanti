import React, { useState } from 'react';
import { useStore } from '../useStore';
import { Card, Button, Modal, Input, Label } from '../components/ui';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Wallet, History, ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from 'lucide-react';
import { Worker, AdvancePayment } from '../types';

export function WalletPage() {
    const { workers, entries, advances, addAdvance, deleteAdvance, updateWorker } = useStore();
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddMode, setIsAddMode] = useState(false);
    const [isEditingGuarantee, setIsEditingGuarantee] = useState(false);
    const [editGuaranteeAmount, setEditGuaranteeAmount] = useState('');

    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'borrow' as 'borrow' | 'repay',
        amount: '',
        note: ''
    });

    const getWorkerStats = (workerId: string) => {
        const worker = workers.find(w => w.id === workerId);

        // Calculate Guarantee Deduction
        const entriesSum = entries
            .filter(e => e.workerId === workerId && !e.isDraft)
            .reduce((sum, e) => sum + (e.guaranteeDeduction || 0), 0);

        const guaranteeTotal = (worker?.historicalGuarantee || 0) + entriesSum;

        // Calculate Advance Balance
        const workerAdvances = advances.filter(a => a.workerId === workerId);
        const advanceTotal = workerAdvances.reduce((sum, a) => {
            return sum + (a.type === 'borrow' ? a.amount : -a.amount);
        }, 0);

        return {
            entriesSum,
            guaranteeTotal,
            advanceTotal,
            workerAdvances
        };
    };

    const openWorkerDetails = (worker: Worker) => {
        setSelectedWorker(worker);
        setIsModalOpen(true);
        setIsAddMode(false);
        setIsEditingGuarantee(false);
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWorker || !formData.amount) return;

        addAdvance({
            workerId: selectedWorker.id,
            date: formData.date,
            type: formData.type,
            amount: Number(formData.amount),
            note: formData.note
        });

        setFormData(p => ({ ...p, amount: '', note: '' }));
        setIsAddMode(false);
    };

    const renderAddForm = () => (
        <form onSubmit={handleAddSubmit} className="space-y-4 bg-gray-50 p-4 rounded-xl mt-4">
            <h4 className="font-semibold text-gray-900 border-b pb-2">ทำรายการเบิก/คืนเงิน</h4>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>วันที่</Label>
                    <Input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label>ประเภท</Label>
                    <select
                        value={formData.type}
                        onChange={e => setFormData(p => ({ ...p, type: e.target.value as 'borrow' | 'repay' }))}
                        className="w-full h-12 rounded-2xl border-0 bg-white px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                    >
                        <option value="borrow">เบิกเงินล่วงหน้า</option>
                        <option value="repay">คืนเงิน/หักคืนเงิน</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>จำนวนเงิน (บาท)</Label>
                <Input
                    type="number"
                    min="1"
                    placeholder="ระบุจำนวนเงิน"
                    value={formData.amount}
                    onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label>หมายเหตุ (ถ้ามี)</Label>
                <Input
                    type="text"
                    placeholder="เช่น ค่าเดินทางล่วงหน้า"
                    value={formData.note}
                    onChange={e => setFormData(p => ({ ...p, note: e.target.value }))}
                />
            </div>

            <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsAddMode(false)} className="flex-1">ยกเลิก</Button>
                <Button type="submit" className="flex-1 bg-sky-500 hover:bg-sky-600 shadow-sky-200 shadow-lg text-white">บันทึกรายการ</Button>
            </div>
        </form>
    );

    return (
        <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between mb-2">
                <div className="text-gray-500 text-sm">สรุปยอดบัญชีสะสมรายบุคคล</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                    const filteredWorkers = workers
                        .map(worker => ({ worker, stats: getWorkerStats(worker.id) }))
                        .filter(({ stats }) => stats.guaranteeTotal > 0 || stats.workerAdvances.length > 0)
                        .sort((a, b) => {
                            // Sort by active advance debt first, then by guarantee total
                            if (a.stats.advanceTotal > 0 && b.stats.advanceTotal <= 0) return -1;
                            if (b.stats.advanceTotal > 0 && a.stats.advanceTotal <= 0) return 1;
                            return b.stats.guaranteeTotal - a.stats.guaranteeTotal;
                        });

                    if (filteredWorkers.length === 0) {
                        return (
                            <div className="col-span-full text-center py-10 bg-white border border-dashed border-gray-200 rounded-3xl text-gray-400">
                                ไม่มีประวัติบัญชีสะสม
                            </div>
                        );
                    }

                    return filteredWorkers.map(({ worker, stats }) => (
                        <Card
                            key={worker.id}
                            className="p-5 cursor-pointer hover:border-sky-200 transition-colors active:scale-[0.98]"
                            onClick={() => openWorkerDetails(worker)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Wallet className="w-5 h-5 text-sky-500" />
                                    {worker.name}
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <div className="text-[10px] text-gray-500 font-medium mb-1">หักเงินประกันสะสมแล้ว</div>
                                    <div className="text-xl font-bold text-gray-900">฿{stats.guaranteeTotal.toLocaleString()}</div>
                                </div>
                                <div className={`rounded-xl p-3 border ${stats.advanceTotal > 0 ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <div className={`text-[10px] font-medium mb-1 ${stats.advanceTotal > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>ยอดหนี้เบิกล่วงหน้า</div>
                                    <div className={`text-xl font-bold ${stats.advanceTotal > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>฿{stats.advanceTotal.toLocaleString()}</div>
                                </div>
                            </div>
                        </Card>
                    ));
                })()}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`บัญชีของ ${selectedWorker?.name}`}
            >
                {selectedWorker && (() => {
                    const stats = getWorkerStats(selectedWorker.id);
                    const advancesList = stats.workerAdvances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    return (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col items-center justify-center relative group">
                                    <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                                        หักประกันสะสมรวม
                                        {!isEditingGuarantee && (
                                            <button
                                                onClick={() => {
                                                    setEditGuaranteeAmount(stats.guaranteeTotal.toString());
                                                    setIsEditingGuarantee(true);
                                                }}
                                                className="text-sky-500 hover:text-sky-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="แก้ไขเงินประกันสะสม"
                                            >
                                                ✎
                                            </button>
                                        )}
                                    </div>
                                    {isEditingGuarantee ? (
                                        <div className="flex flex-col items-center gap-2 w-full mt-1">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={editGuaranteeAmount}
                                                onChange={(e) => setEditGuaranteeAmount(e.target.value)}
                                                className="w-full text-center text-lg py-1 h-auto font-bold"
                                                autoFocus
                                            />
                                            <div className="flex gap-1 w-full">
                                                <Button size="sm" variant="secondary" className="flex-1 py-1 text-xs" onClick={() => setIsEditingGuarantee(false)}>ยกเลิก</Button>
                                                <Button size="sm" className="flex-1 py-1 text-xs bg-sky-500 hover:bg-sky-600 border-none text-white" onClick={() => {
                                                    const newTotal = Number(editGuaranteeAmount);
                                                    if (!isNaN(newTotal)) {
                                                        const newHistorical = newTotal - stats.entriesSum;
                                                        updateWorker(selectedWorker.id, { historicalGuarantee: newHistorical });
                                                    }
                                                    setIsEditingGuarantee(false);
                                                }}>บันทึก</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-2xl font-bold text-gray-900">฿{stats.guaranteeTotal.toLocaleString()}</div>
                                    )}
                                </div>
                                <div className={`rounded-xl p-3 border flex flex-col items-center justify-center ${stats.advanceTotal > 0 ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <div className={`text-xs mb-1 ${stats.advanceTotal > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>ยอดหนี้คงค้าง</div>
                                    <div className={`text-2xl font-bold ${stats.advanceTotal > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>฿{stats.advanceTotal.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Transactions Area */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-semibold text-gray-900 flex items-center gap-1.5">
                                        <History className="w-4 h-4 text-gray-500" />
                                        ประวัติเบิกล่วงหน้า
                                    </h4>
                                    {!isAddMode && (
                                        <button
                                            onClick={() => setIsAddMode(true)}
                                            className="text-xs font-semibold text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full hover:bg-sky-100 transition-colors flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> เพิ่มรายการเบิก
                                        </button>
                                    )}
                                </div>

                                {isAddMode ? (
                                    renderAddForm()
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {advancesList.length === 0 ? (
                                            <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-xl">
                                                ยังไม่มีประวัติการเบิกเงิน
                                            </div>
                                        ) : (
                                            advancesList.map(adv => (
                                                <div key={adv.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                                                    <div className="flex items-center gap-3">
                                                        {adv.type === 'borrow' ? (
                                                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                                                <ArrowDownCircle className="w-5 h-5" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                                <ArrowUpCircle className="w-5 h-5" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-semibold text-gray-900">
                                                                {adv.type === 'borrow' ? 'เบิกล่วงหน้า' : 'คืนเงิน'}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500">
                                                                {format(new Date(adv.date), 'd MMM yyyy', { locale: th })}
                                                                {adv.note && ` • ${adv.note}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <span className={`font-bold ${adv.type === 'borrow' ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                            {adv.type === 'borrow' ? '+' : '-'}฿{adv.amount.toLocaleString()}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) {
                                                                    deleteAdvance(adv.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
}
