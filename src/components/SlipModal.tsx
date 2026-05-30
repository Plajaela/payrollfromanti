import React, { useRef, useState, useEffect } from 'react';
import { Modal, Button } from './ui';
import * as htmlToImage from 'html-to-image';
import { Download, Loader2, Share2, Image as ImageIcon, Copy, Eraser, Cloud, CheckCircle } from 'lucide-react';
import { Worker } from '../types';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const SimpleSignaturePad = ({ onEnd, clearRef }: { onEnd: () => void, clearRef: React.MutableRefObject<(() => void) | null> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    clearRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    return () => { clearRef.current = null; };
  }, [clearRef]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    const { x, y } = getCoordinates(e);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "black";
    ctx.stroke();

    setIsDrawing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    onEnd();
  };

  return (
    <canvas
      ref={canvasRef}
      width={400} // Higher internal resolution for better lines
      height={200}
      className="w-full h-full cursor-crosshair touch-none"
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={stopDrawing}
      onPointerCancel={stopDrawing}
    />
  );
};

interface SlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRangeStr: string;
  data: {
    worker: Worker;
    totalDays: number;
    leaveDays: number;
    sickDays?: number;
    personalDays?: number;
    absentDays?: number;
    totalBaseWage: number;
    totalTravel: number;
    totalToll: number;
    totalLate: number;
    totalOT: number;
    netAdjustments: number;
    grandTotal: number;
    guaranteeTotal: number;
    rangeGuaranteeDeduction: number;
    advanceDeduction?: number;
    socialSecurityDeduction?: number;
    finalPay?: number;

  } | null;
}

export function SlipModal({ isOpen, onClose, dateRangeStr, data }: SlipModalProps) {
  const slipRef = useRef<HTMLDivElement>(null);
  const clearSignatureRef = useRef<(() => void) | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadSuccess, setIsUploadSuccess] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [useSignature, setUseSignature] = useState(false);
  const [isSignatureEmpty, setIsSignatureEmpty] = useState(true);

  if (!data) return null;

  const isMonthly = data.worker.paymentType === 'month';
  const socialSecurityDeduction = data.socialSecurityDeduction || 0;

  const absentDays = data.absentDays || 0;
  const expectedDays = data.totalDays + absentDays;
  // If monthly, base wage is fixed, so absent deduction usually requires manual adjustment or custom formula (/30).
  // We'll set it to 0 here to keep it simple, since monthlyWage is already the full monthly salary.
  const absentDeduction = isMonthly ? 0 : absentDays * (data.worker.baseWage || 0);
  const expectedBaseWage = isMonthly ? (data.worker.monthlyWage || 0) : data.totalBaseWage + absentDeduction;

  const generalNetAdjustments = data.netAdjustments;
  
  const potentialEarnings = expectedBaseWage + data.totalTravel + data.totalToll + data.totalOT + (generalNetAdjustments > 0 ? generalNetAdjustments : 0);
  const totalDeductions = absentDeduction + data.totalLate + data.rangeGuaranteeDeduction + (generalNetAdjustments < 0 ? Math.abs(generalNetAdjustments) : 0) + (data.advanceDeduction || 0) + socialSecurityDeduction;

  const actualNetPay = data.finalPay !== undefined ? data.finalPay : data.grandTotal;

  const handleGenerate = async () => {
    if (!slipRef.current) return;
    try {
      setIsGenerating(true);
      // Force canvas to image BEFORE generating image to ensure strokes are captured by html-to-image
      const canvases = slipRef.current.querySelectorAll('canvas');
      const originalDisplays: string[] = [];
      const images: HTMLImageElement[] = [];

      canvases.forEach(canvas => {
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/png');
          img.style.width = canvas.style.width || canvas.offsetWidth + 'px';
          img.style.height = canvas.style.height || canvas.offsetHeight + 'px';
          img.className = canvas.className;
          
          originalDisplays.push(canvas.style.display);
          canvas.style.display = 'none';
          canvas.parentNode?.insertBefore(img, canvas);
          images.push(img);
      });

      await new Promise(r => setTimeout(r, 100)); // allow DOM to update

      const dataUrl = await htmlToImage.toPng(slipRef.current, {
        pixelRatio: 4, // Equivalent to scale: 4 for high quality
        style: {
          transform: 'none',
          boxShadow: 'none',
        }
      });

      // Restore canvases
      canvases.forEach((canvas, i) => {
          canvas.style.display = originalDisplays[i];
          images[i].parentNode?.removeChild(images[i]);
      });

      setGeneratedImage(dataUrl);
    } catch (error) {
      console.error('Error generating slip:', error);
      alert(`เกิดข้อผิดพลาดในการสร้างสลิป: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadToDrive = async () => {
    if (!generatedImage) return;

    try {
      setIsUploading(true);
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const file = new File([blob], `slip_${data.worker.name}_${dateRangeStr}.png`, { type: 'image/png' });

      // 1. Upload to Supabase Storage (like in DailyEntryPage)
      const fileName = `${uuidv4()}.png`;
      const filePath = `${data.worker.id}/signed_slips/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slips')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('slips')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 2. Trigger Google Drive Webhook
      const webhookUrl = import.meta.env.VITE_GOOGLE_DRIVE_WEBHOOK_URL;
      if (webhookUrl) {
        const driveFormData = new URLSearchParams();
        driveFormData.append('workerName', data.worker.name || 'Unknown');
        driveFormData.append('mainFolder', 'เซ็นสลิป'); // Requested generic MAIN folder
        driveFormData.append('date', dateRangeStr);
        driveFormData.append('imageUrl', publicUrl);
        driveFormData.append('type', 'signed_slip'); // Metadata hint

        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors', // Ignore CORS block from Google Apps Script
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: driveFormData.toString()
        }).catch(err => console.error("Webhook error:", err));
      }

      setIsUploadSuccess(true);
      setTimeout(() => setIsUploadSuccess(false), 3000);
      alert('บันทึกลง Google Drive เรียบร้อยแล้วครับ!');
    } catch (error) {
      console.error('Error uploading to drive:', error);
      alert(`เกิดข้อผิดพลาดในการบันทึกลง Google Drive: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleShare = async () => {
    if (!generatedImage) return;

    try {
      const blob = await (await fetch(generatedImage)).blob();
      const file = new File([blob], `slip_${data.worker.name}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `สลิปเงินเดือน ${data.worker.name}`,
          files: [file]
        });
        return;
      }

      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `slip_${data.worker.name}_${dateRangeStr.replace(/ /g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error sharing slip:', error);
      if (error instanceof Error && error.name !== 'AbortError') {
        alert('ไม่สามารถเปิดเมนูแชร์ได้ กดค้างที่รูปภาพเพื่อบันทึกแทนนะครับ');
      }
    }
  };

  const handleCopyImage = async () => {
    if (!generatedImage) return;
    try {
      // Feature check for clipboard image copying
      if (!window.ClipboardItem) {
        throw new Error("ClipboardItem not supported");
      }

      // Convert data URL to Blob synchronously to avoid browser blocking async clipboard writes
      const arr = generatedImage.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });

      const item = new ClipboardItem({ [mime]: blob });
      await navigator.clipboard.write([item]);
      alert('คัดลอกรูปภาพเรียบร้อยแล้ว! สามารถกดวาง (Paste) ในแชทไลน์ได้เลยครับ');
    } catch (error) {
      console.error('Error copying image:', error);
      alert('เบราว์เซอร์/อุปกรณ์นี้ไม่รองรับการก๊อปปี้รูปภาพครับ กรุณากดปุ่มแชร์ หรือแตะค้างที่รูปเพื่อบันทึกแทนครับ');
    }
  };

  const resetModal = () => {
    setGeneratedImage(null);
    setIsSignatureEmpty(true);
    setUseSignature(false);
    setIsUploadSuccess(false);
    onClose();
  };

  const clearSignature = () => {
    if (clearSignatureRef.current) clearSignatureRef.current();
    setIsSignatureEmpty(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={resetModal} title={generatedImage ? "สลิปพร้อมส่งแล้ว!" : "พรีวิวสลิปเงินเดือน"}>
      <div className={`flex flex-col items-center max-h-[70vh] overflow-y-auto w-full mx-auto relative ${generatedImage ? 'pb-4' : 'pb-20 sm:pb-4'}`}>

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
              💡 ทริค: ถ้าต้องการส่งในแชท กดปุ่ม <span className="font-bold">คัดลอกรูปภาพ</span> ด้านล่าง แล้วไปกดวางในช่องแชทได้เลย
            </div>
          </div>
        ) : (
          /* The Slip Card (What will be captured) */
          <div
            ref={slipRef}
            style={{ colorScheme: 'light', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', color: '#111827' }}
            className="bg-white w-[350px] p-6 shadow-sm border border-gray-100 font-sans relative overflow-hidden shrink-0 transition-opacity antialiased"
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
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500 font-medium">มาทำงานจริง / Actual Days</span>
                <span className="text-sm font-bold text-emerald-600">{data.totalDays} วัน</span>
              </div>
              {data.leaveDays > 0 && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500 font-medium">ลาทั้งหมด / Leave Days</span>
                  <span className="text-sm font-bold text-orange-500">{data.leaveDays} วัน</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">รอบวันที่ / Period</span>
                <span className="text-xs font-semibold text-gray-800">{dateRangeStr}</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Earnings */}
              <div>
                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> รายรับ
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ค่าแรงเต็มจำนวน ({expectedDays} วัน)</span>
                    <span className="font-semibold text-gray-900">฿{expectedBaseWage.toLocaleString()}</span>
                  </div>

                  {data.totalOT > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ล่วงเวลา (OT)</span>
                      <span className="font-semibold text-gray-900">฿{data.totalOT.toLocaleString()}</span>
                    </div>
                  )}
                  {(data.totalTravel + data.totalToll) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ค่ารถ/ทางด่วน</span>
                      <span className="font-semibold text-gray-900">฿{(data.totalTravel + data.totalToll).toLocaleString()}</span>
                    </div>
                  )}
                  {generalNetAdjustments > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">โบนัส/อื่นๆ</span>
                      <span className="font-semibold text-emerald-600">+฿{generalNetAdjustments.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[15px] pt-2 pb-1 border-t-2 border-emerald-100 mt-2 bg-emerald-50/30 px-2 -mx-2 rounded-lg">
                    <span className="text-emerald-800 font-extrabold tracking-wide">รวมรายรับ </span>
                    <span className="font-black text-emerald-600 text-lg">฿{potentialEarnings.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              {totalDeductions > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1 pt-2 border-t border-gray-50">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> รายการหัก (คุณขาดงาน / สาย / เบิก)
                  </div>
                  <div className="space-y-1.5">
                    {absentDays > 0 && !isMonthly && (
                      <div className="pb-0.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">หักขาดงาน ({absentDays} วัน)</span>
                           <span className="font-semibold text-red-600">-฿{absentDeduction.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {data.totalLate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">หักมาสาย</span>
                        <span className="font-semibold text-red-600">-฿{data.totalLate.toLocaleString()}</span>
                      </div>
                    )}
                    {data.rangeGuaranteeDeduction > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">หักเงินประกัน (สะสม)</span>
                        <span className="font-semibold text-red-600">-฿{data.rangeGuaranteeDeduction.toLocaleString()}</span>
                      </div>
                    )}
                    {generalNetAdjustments < 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">หักอื่นๆ</span>
                        <span className="font-semibold text-red-600">-฿{Math.abs(generalNetAdjustments).toLocaleString()}</span>
                      </div>
                    )}
                    {data.advanceDeduction !== undefined && data.advanceDeduction > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-500">ดึงเงินคืน (เบิกล่วงหน้า)</span>
                        <span className="font-bold text-red-600">-฿{data.advanceDeduction.toLocaleString()}</span>
                      </div>
                    )}
                    {socialSecurityDeduction > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-600">หักประกันสังคม (สปส.)</span>
                        <span className="font-bold text-purple-600">-฿{socialSecurityDeduction.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t-2 border-gray-900">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">ยอดสุทธิ (Net Pay)</span>
                <span className="text-3xl font-black text-gray-900 tracking-tight">฿{actualNetPay.toLocaleString()}</span>
              </div>
            </div>

            {/* Signature Area */}
            <div className="mt-6 pt-6 pb-2">
              <div className="flex flex-col items-center">
                {useSignature ? (
                  <>
                    <span className="text-xs text-gray-500 mb-2 font-medium">ยืนยันการรับเงินถูกต้อง</span>
                    <div className="relative group">
                      <div className="w-64 h-32 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex items-center justify-center overflow-hidden">
                        <SimpleSignaturePad
                          clearRef={clearSignatureRef}
                          onEnd={() => setIsSignatureEmpty(false)}
                        />
                      </div>
                      {!isSignatureEmpty && (
                        <button
                          onClick={clearSignature}
                          className="absolute -top-2 -right-2 bg-red-100 p-1.5 rounded-full text-red-600 hover:bg-red-200 transition-colors shadow-sm"
                          title="ลบเซ็น"
                        >
                          <Eraser className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-48 border-b-2 border-dotted border-gray-300 h-8"></div>
                )}
                
                <div className="mt-4 w-48 border-b-2 border-dotted border-gray-300 relative text-center">
                  <span className="text-[10px] text-gray-400">
                    ({data.worker.name})
                  </span>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="mt-8 pt-3 border-t border-dashed border-gray-200 text-center">
              {data.guaranteeTotal > 0 && (
                <div className="text-[10px] text-sky-600 font-medium mb-1">
                  ล็อคยอดเงินประกันสะสม: ฿{data.guaranteeTotal.toLocaleString()}
                </div>
              )}
              <p className="text-[10px] text-gray-400 font-medium tracking-wide">THANK YOU FOR YOUR HARD WORK</p>
            </div>

            {/* Watermark / Decorative shape */}
            <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-gray-100 rounded-full opacity-50 -z-10 pointer-events-none"></div>
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-red-50 rounded-full opacity-80 -z-10 pointer-events-none"></div>

          </div>
        )}
        {!generatedImage && (
          <div className="w-full flex justify-center py-4 bg-gray-50 mt-4 rounded-2xl border border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={useSignature} 
                onChange={(e) => setUseSignature(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm font-bold text-gray-700">ต้องการให้ช่างเซ็นชื่อ</span>
            </label>
          </div>
        )}
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-100 flex flex-col gap-3 w-full mx-auto relative z-10">
        <Button onClick={resetModal} variant="secondary" className="px-6 py-3.5">
          ปิด
        </Button>

        {generatedImage ? (
          <div className="flex flex-col gap-2 flex-1">
            {useSignature && (
              <div className="flex gap-2">
                <Button 
                  onClick={handleUploadToDrive} 
                  disabled={isUploading || isUploadSuccess}
                  className={`flex-1 py-3.5 ${isUploadSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'} shadow-sm text-white flex items-center justify-center gap-1.5 px-2`}
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isUploadSuccess ? <CheckCircle className="w-5 h-5" /> : <Cloud className="w-5 h-5" />)}
                  <span className="text-sm font-medium">{isUploadSuccess ? 'บันทึกสำเร็จ' : (isUploading ? 'กำลังบันทึก...' : 'บันทึกเข้า Google Drive')}</span>
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleCopyImage} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 shadow-sm text-white flex items-center justify-center gap-1.5 px-2">
                <Copy className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">คัดลอกรูปภาพ</span>
              </Button>
              <Button onClick={handleShare} className="flex-1 py-3.5 bg-[#00B900] hover:bg-[#009900] shadow-sm text-white flex items-center justify-center gap-1.5 px-2">
                <Share2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">แชร์ให้ช่าง</span>
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || (useSignature && isSignatureEmpty)} 
            className="flex-1 py-3.5 bg-sky-600 hover:bg-sky-700 shadow-sky-200 text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            {isGenerating ? 'กำลังสร้างรูป...' : (useSignature && isSignatureEmpty) ? 'กรุณาเซ็นชื่อก่อน' : 'ดูภาพพร้อมลายเซ็น'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
