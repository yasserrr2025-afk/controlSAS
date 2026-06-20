import { APP_CONFIG } from '../constants';
import { SupervisorVisit, SystemConfig } from '../types';

export interface SupervisorVisitPrintMetrics {
  students: number;
  committees: number;
  proctors: number;
  absences: number;
  receipts: number;
  requests: number;
  reports: number;
  exams: number;
}

const safe = (value?: string | number) => value === undefined || value === null || value === '' ? '---' : String(value);

export const buildSupervisorMiniPortfolioPrintHtml = (
  visit: SupervisorVisit,
  systemConfig: SystemConfig,
  metrics: SupervisorVisitPrintMetrics,
) => {
  const schoolName = systemConfig?.school_name || APP_CONFIG.SCHOOL_NAME;
  const directorateName = systemConfig?.directorate_name || APP_CONFIG.ADMINISTRATION_NAME;
  const principalName = visit.principal_name || systemConfig?.principal_name || 'مدير المدرسة';
  const academicYear = systemConfig?.academic_year || '1447 / 1448';
  const visitDate = new Date(visit.visit_time).toLocaleDateString('ar-SA');
  const visitTime = new Date(visit.visit_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const signedAt = visit.principal_signed_at ? new Date(visit.principal_signed_at).toLocaleString('ar-SA') : 'معتمد إلكترونياً';

  return `
    <html dir="rtl">
      <head>
        <title>ملف الإنجاز المصغر - ${safe(visit.visitor_name)}</title>
        <style>
          @page { size: A4 portrait; margin: 3mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html, body { width: 204mm; height: 291mm; margin: 0; overflow: hidden; background: white; }
          body { font-family: Arial, sans-serif; color: #0f172a; }
          .sheet {
            position: absolute;
            top: 0;
            right: 0;
            width: 261.5mm;
            transform: scale(.78);
            transform-origin: top right;
          }
          .page {
            width: 261.5mm;
            height: 360mm;
            border: 1.5pt solid #0f172a;
            padding: 8mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: white;
          }
          .header { display: grid; grid-template-columns: 1fr 32mm 1fr; gap: 6mm; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 5mm; margin-bottom: 5mm; }
          .side { font-size: 11pt; font-weight: 900; line-height: 1.65; }
          .left { text-align: left; color: #334155; }
          .logo { width: 26mm; height: 26mm; object-fit: contain; margin: auto; display: block; }
          .title { text-align: center; border: 1.5pt solid #0f172a; background: #eef7fb; padding: 4mm; margin-bottom: 5mm; }
          .title h1 { margin: 0; font-size: 20pt; font-weight: 900; }
          .title p { margin: 2mm 0 0; font-size: 10.5pt; font-weight: 800; color: #475569; }
          .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.8mm; margin-bottom: 5mm; }
          .box { border: 1pt solid #0f172a; min-height: 20mm; }
          .box b { display: block; background: #f1f5f9; border-bottom: 1pt solid #0f172a; padding: 2.2mm; font-size: 9.8pt; }
          .box span { display: block; padding: 2.5mm; font-size: 11pt; font-weight: 900; line-height: 1.35; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin-bottom: 5mm; }
          .metric { border: 1pt solid #cbd5e1; background: #f8fafc; padding: 3mm; text-align: center; min-height: 23mm; }
          .metric strong { display: block; font-size: 20pt; color: #0f172a; line-height: 1; }
          .metric span { display: block; margin-top: 1.5mm; font-size: 9pt; font-weight: 900; color: #64748b; }
          .two { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 5mm; }
          .section { border: 1pt solid #0f172a; min-height: 42mm; }
          .section-title { background: #0f172a; color: white; padding: 2.8mm 3.5mm; font-size: 10.5pt; font-weight: 900; }
          .section-body { padding: 3.5mm; font-size: 11pt; line-height: 1.75; font-weight: 700; white-space: pre-wrap; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 1mm; }
          .sig { border: 1pt solid #cbd5e1; background: #f8fafc; min-height: 38mm; padding: 3mm; text-align: center; }
          .sig b { display: block; font-size: 9.8pt; margin-bottom: 1mm; }
          .sig img { max-height: 28mm; max-width: 92mm; object-fit: contain; }
          .approval { border: 1pt solid #047857; background: #ecfdf5; padding: 3mm 4mm; font-size: 10.5pt; font-weight: 900; line-height: 1.6; color: #065f46; margin-top: 4mm; }
          .footer { margin-top: auto; border-top: 1pt solid #cbd5e1; padding-top: 2.5mm; display: flex; justify-content: space-between; font-size: 9pt; font-weight: 800; color: #475569; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="page">
            <div class="header">
              <div class="side">المملكة العربية السعودية<br/>وزارة التعليم<br/>${directorateName}<br/>${schoolName}</div>
              <img class="logo" src="${APP_CONFIG.LOGO_URL}" />
              <div class="side left">العام الدراسي: ${academicYear}<br/>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}<br/>ملف إنجاز مصغر معتمد<br/>رقم السجل: ${visit.id.slice(0, 8)}</div>
            </div>
            <div class="title">
              <h1>ملف الإنجاز المصغر لزيارة مشرف / إدارة</h1>
              <p>توثيق مختصر لأعمال الاختبارات والمؤشرات الأساسية في يوم الزيارة</p>
            </div>
            <div class="info">
              <div class="box"><b>اسم الزائر</b><span>${safe(visit.visitor_name)}</span></div>
              <div class="box"><b>الصفة / الجهة</b><span>${safe(visit.visitor_role)}</span></div>
              <div class="box"><b>وسيلة التواصل</b><span>${safe(visit.visitor_contact)}</span></div>
              <div class="box"><b>تاريخ الزيارة</b><span>${visitDate}</span></div>
              <div class="box"><b>وقت الزيارة</b><span>${visitTime}</span></div>
              <div class="box"><b>نوع الزيارة</b><span>${safe(visit.visit_reason)}</span></div>
              <div class="box"><b>التقييم العام</b><span>${safe(visit.rating)}</span></div>
              <div class="box"><b>مدير المدرسة</b><span>${principalName}</span></div>
              <div class="box"><b>وقت اعتماد المدير</b><span>${signedAt}</span></div>
            </div>
            <div class="metrics">
              <div class="metric"><strong>${metrics.students}</strong><span>الطلاب</span></div>
              <div class="metric"><strong>${metrics.committees}</strong><span>اللجان</span></div>
              <div class="metric"><strong>${metrics.proctors}</strong><span>المراقبون</span></div>
              <div class="metric"><strong>${metrics.requests}</strong><span>بلاغات اليوم</span></div>
              <div class="metric"><strong>${metrics.absences}</strong><span>الغياب / التأخير</span></div>
              <div class="metric"><strong>${metrics.receipts}</strong><span>استلام مؤكد</span></div>
              <div class="metric"><strong>${metrics.reports}</strong><span>تقارير ميدانية</span></div>
              <div class="metric"><strong>${metrics.exams}</strong><span>اختبارات اليوم</span></div>
            </div>
            <div class="two">
              <div class="section"><div class="section-title">ملاحظات الزيارة</div><div class="section-body">${visit.notes || 'لا توجد ملاحظات.'}</div></div>
              <div class="section"><div class="section-title">التوصيات</div><div class="section-body">${visit.recommendations || 'لا توجد توصيات.'}</div></div>
            </div>
            <div class="signatures">
              <div class="sig"><b>توقيع المشرف / الزائر</b>${visit.signature ? `<img src="${visit.signature}" />` : ''}</div>
              <div class="sig"><b>توقيع مدير المدرسة</b>${visit.principal_signature ? `<img src="${visit.principal_signature}" />` : ''}</div>
            </div>
            <div class="approval">تم اعتماد هذا الملف إلكترونياً من مدير المدرسة: ${principalName}، ويعد التقرير مستنداً مختصراً للزيارة والمؤشرات التشغيلية في يومها.</div>
            <div class="footer">
              <div>نظام الكنترول الرقمي - ${schoolName}</div>
              <div>رابط إنجاز مصغر معتمد إلكترونياً</div>
            </div>
          </div>
        </div>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body>
    </html>
  `;
};
