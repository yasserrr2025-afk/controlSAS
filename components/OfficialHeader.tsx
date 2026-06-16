
import React from 'react';
import { APP_CONFIG } from '../constants';
import { SystemConfig } from '../types';

interface OfficialHeaderProps {
  systemConfig?: SystemConfig & { directorate_name?: string };
  date?: string;
  attachments?: string;
  fileNumber?: string;
}

const OfficialHeader: React.FC<OfficialHeaderProps> = ({ systemConfig, date, attachments, fileNumber }) => {
  const directorateName = systemConfig?.directorate_name
    ? `إدارة التعليم بـ${systemConfig.directorate_name}`
    : APP_CONFIG.ADMINISTRATION_NAME;
  const schoolName = systemConfig?.school_name || APP_CONFIG.SCHOOL_NAME;
  const displayDate = date
    ? new Date(date).toLocaleDateString('ar-SA')
    : new Date().toLocaleDateString('ar-SA');

  return (
    <div className="w-full flex flex-col items-center mb-1 border-b-4 border-double border-slate-900 pb-3 no-print-border" style={{ direction: 'rtl' }}>
      <div className="w-full grid grid-cols-3 gap-2 px-1 items-center">

        {/* الجزء الأيمن: البيانات الرسمية */}
        <div className="text-[11px] font-black text-right leading-[1.7] space-y-0.5">
          <p>المملكة العربية السعودية</p>
          <p>{APP_CONFIG.MINISTRY_NAME}</p>
          <p>{directorateName}</p>
          <p>{schoolName}</p>
        </div>

        {/* الجزء الأوسط: الشعار */}
        <div className="flex flex-col items-center justify-center">
          <img
            src={APP_CONFIG.LOGO_URL}
            alt="شعار وزارة التعليم"
            className="w-16 h-16 object-contain mb-0.5"
          />
          <p className="text-[7.5px] font-bold text-slate-500 italic text-center leading-tight">
            نظام كنترول الاختبارات المطور
          </p>
        </div>

        {/* الجزء الأيسر: التاريخ والبيانات الإدارية */}
        <div className="text-[11px] font-bold text-left leading-[1.7] space-y-0.5">
          <p>التاريخ: <span className="font-black font-mono tabular-nums">{displayDate}</span></p>
          <p>المرفقات: <span className="font-mono">{attachments || '.................'}</span></p>
          <p>رقم الإدراج: <span className="font-black font-mono tabular-nums">{fileNumber || '.................'}</span></p>
        </div>

      </div>
    </div>
  );
};

export default OfficialHeader;
