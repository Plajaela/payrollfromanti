import React, { useRef, useState } from 'react';
import { Modal, Button } from './ui';
import { toPng } from 'html-to-image';
import { Download, Loader2, Share2, Image as ImageIcon } from 'lucide-react';
import { Worker } from '../types';

interface SlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRangeStr: string;
  data: {
    worker: Worker;
    totalDays: number;
    leaveDays: number;
    totalBaseWage: number;
    totalTravel: number;
    totalToll: number;
    totalLate: number;
    totalOT: number;
    netAdjustments: number;
    grandTotal: number;
    guaranteeTotal: number;
    rangeGuaranteeDeduction: number;
  } | null;
}

export function SlipModal({ isOpen, onClose, dateRangeStr, data }: SlipModalProps) {
  const slipRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  if (!data) return null;

  const totalEarnings = data.totalBaseWage + data.totalTravel + data.totalToll + data.totalOT + (data.netAdjustments > 0 ? data.netAdjustments : 0);
  const totalDeductions = data.totalLate + data.rangeGuaranteeDeduction + (data.netAdjustments < 0 ? Math.abs(data.netAdjustments) : 0);

  const handleGenerate = async () => {
    if (!slipRef.current) return;
    try {
      setIsGenerating(true);
      const image = await toPng(slipRef.current, {
        pixelRatio: 2, // Safe scale for mobile
        backgroundColor: '#ffffff'
      });
      setGeneratedImage(image);
    } catch (error) {
      console.error('Error generating slip:', error);
      alert(`เกิดข้อผิดพลาดในการสร้างสลิป: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!generatedImage) return;
    
    try {
      // Try native share first (works great on iOS/Android for sending to LINE)
      const blob = await (await fetch(generatedImage)).blob();
      const file = new File([blob], `slip_${data.worker.name}.png`, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `สลิปเงินเดือน ${data.worker.name}`,
          files: [file]
        });
        return;
      }
      
      // Fallback to regular download if share is not available
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `slip_${data.worker.name}_${dateRangeStr.replace(/ /g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error sharing slip:', error);
      // AbortError is normal when user cancels the share sheet
      if (error instanceof Error && error.name !== 'AbortError') {
        alert('ไม่สามารถเปิดเมนูแชร์ได้ กดค้างที่รูปภาพเพื่อบันทึกแทนนะครับ');
      }
    }
  };

  const resetModal = () => {
    setGeneratedImage(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetModal} title={generatedImage ? "สลิปพร้อมส่งแล้ว!" : "พรีวิวสลิปเงินเดือน"}>
      <div className={`flex flex-col items-center max-h-[70vh] overflow-y-auto w-full max-w-md mx-auto relative ${generatedImage ? 'pb-4' : 'pb-20 sm:pb-4'}`}>
        
        {generatedImage ? (
          <div className="w-full flex justify-center flex-col items-center space-y-4 pt-2">
            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-semibold mb-2">
              ✅ สร้างรูปภาพสำเร็จ!
            </div>
            {/* The generated image ready for long press to save */}
            <img 
              src={generatedImage} 
              alt="Generated Slip" 
              className="w-[350px] shadow-lg border border-gray-200 rounded-xl"
            />
            <div className="text-xs text-gray-500 text-center px-4">
              💡 ทริค: ถ้าปุ่มแชร์ด้านล่างไม่ทำงาน<br/><span className="font-bold text-gray-700">ให้แตะค้างที่รูปภาพนี้แล้วเลือก "บันทึกรูปภาพ" (Save Image)</span> ได้เลยครับ
            </div>
          </div>
        ) : (
          /* The Slip Card (What will be captured) */
          <div 
            ref={slipRef} 
            className="bg-white w-[350px] p-6 shadow-sm border border-gray-100 font-sans relative overflow-hidden shrink-0 transition-opacity"
          >
            {/* Header */}
            <div className="text-center pb-4 border-b-2 border-dashed border-gray-200 relative mb-4">
              <div className="mx-auto w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-3 shadow-sm shadow-red-200">
                P
              </div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">PAYROLL</h2>
              <p className="text-xs font-semibold text-gray-400 mt-1 tracking-widest uppercase">พัดลมดี สรุปยอดเงิน</p>
            </div>

            {/* Worker Info */}
            <div className="mb-5 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500 font-medium">ชื่อช่าง / Name</span>
                <span className="text-sm font-bold text-gray-900">{data.worker.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">รอบวันที่ / Period</span>
                <span className="text-xs font-semibold text-gray-800">{dateRangeStr}</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Earnings */}
              <div>
                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> รายรับ (Earnings)
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ค่าแรง ({data.totalDays} วัน)</span>
                    <span className="font-semibold text-gray-900">฿{data.totalBaseWage}</span>
                  </div>
                  {data.totalOT > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ล่วงเวลา (OT)</span>
                      <span className="font-semibold text-gray-900">฿{data.totalOT}</span>
                    </div>
                  )}
                  {(data.totalTravel + data.totalToll) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ค่ารถ/ทางด่วน</span>
                      <span className="font-semibold text-gray-900">฿{data.totalTravel + data.totalToll}</span>
                    </div>
                  )}
                  {data.netAdjustments > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">โบนัส/อื่นๆ</span>
                      <span className="font-semibold text-emerald-600">+฿{data.netAdjustments}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deductions */}
              {totalDeductions > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1 pt-2 border-t border-gray-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> รายการหัก (Deductions)
                  </div>
                  <div className="space-y-1.5">
                    {data.totalLate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">หักมาสาย</span>
                        <span className="font-semibold text-red-600">-฿{data.totalLate}</span>
                      </div>
                    )}
                    {data.rangeGuaranteeDeduction > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">หักเงินประกัน (สะสม)</span>
                        <span className="font-semibold text-red-600">-฿{data.rangeGuaranteeDeduction}</span>
                      </div>
                    )}
                    {data.netAdjustments < 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">หักอื่นๆ / เบิกล่วงหน้า</span>
                        <span className="font-semibold text-red-600">-฿{Math.abs(data.netAdjustments)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t-2 border-gray-900">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">รวมรายรับสุทธิ</span>
                <span className="text-3xl font-black text-gray-900 tracking-tight">฿{data.grandTotal}</span>
              </div>
              <div className="text-right text-[10px] text-gray-400 font-medium">NET PAY</div>
            </div>

            {/* Footer note */}
            <div className="mt-8 pt-3 border-t border-dashed border-gray-200 text-center">
               {data.leaveDays > 0 && (
                 <div className="text-[10px] text-orange-500 font-medium mb-1">
                   *เดือนนี้มีวันลาหยุดทั้งหมด {data.leaveDays} วัน
                 </div>
               )}
               {data.guaranteeTotal > 0 && (
                 <div className="text-[10px] text-sky-600 font-medium mb-1">
                   ล็อคยอดเงินประกันสะสม: ฿{data.guaranteeTotal}
                 </div>
               )}
               <p className="text-[10px] text-gray-400 font-medium tracking-wide">THANK YOU FOR YOUR HARD WORK</p>
            </div>
            
            {/* Watermark / Decorative shape */}
            <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-gray-100 rounded-full opacity-50 -z-10 pointer-events-none"></div>
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-red-50 rounded-full opacity-80 -z-10 pointer-events-none"></div>

          </div>
        )}
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-100 flex gap-2">
        <Button onClick={resetModal} variant="secondary" className="px-6 py-3.5">
          ปิด
        </Button>
        
        {generatedImage ? (
          <Button onClick={handleShare} className="flex-1 py-3.5 bg-[#00B900] hover:bg-[#009900] shadow-sm text-white flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" />
            แชร์ส่งให้ช่าง
          </Button>
        ) : (
          <Button onClick={handleGenerate} disabled={isGenerating} className="flex-1 py-3.5 bg-sky-600 hover:bg-sky-700 shadow-sky-200 text-white flex items-center justify-center gap-2">
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            {isGenerating ? 'กำลังสร้างรูป...' : 'สร้างเป็นรูปภาพ'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
