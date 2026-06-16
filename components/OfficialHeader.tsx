
import React from 'react';
import { APP_CONFIG } from '../constants';

const OfficialHeader: React.FC = () => {
  return (
    <div className="w-full flex flex-col items-center mb-1 border-b-4 border-double border-slate-900 pb-3 no-print-border">
      <div className="w-full grid grid-cols-3 gap-2 px-1 items-center">
        {/* الجزء الأيمن: البيانات الرسمية */}
        <div className="text-[11px] font-black text-right leading-none space-y-1">
          <p>المملكة العربية السعودية</p>
          <p>{APP_CONFIG.MINISTRY_NAME}</p>
          <p>{APP_CONFIG.ADMINISTRATION_NAME}</p>
          <p>{APP_CONFIG.SCHOOL_NAME}</p>
        </div>
        
        {/* الجزء الأوسط: الشعار */}
        <div className="flex flex-col items-center justify-center">
          <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-16 h-16 object-contain mb-0.5" />
          <div className="text-center leading-none">
             <p className="text-[8px] font-bold text-slate-500 italic">نظام كنترول الاختبارات المطور</p>
          </div>
        </div>

        {/* الجزء الأيسر: التاريخ والمرفقات */}
        <div className="text-[11px] font-bold text-left leading-none space-y-1">
          <p>التاريخ: <span className="font-mono tabular-nums">{new Date().toLocaleDateString('ar-SA')}</span></p>
          <p>المرفقات: .................</p>
          <p>رقم الإدراج: <span className="font-mono tabular-nums">22616</span></p>
        </div>
      </div>
    </div>
  );
};

export default OfficialHeader;
