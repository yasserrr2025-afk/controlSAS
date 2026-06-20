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
            width: 204mm;
            height: 286mm;
            overflow: hidden;
          }
          .page {
            width: 204mm;
            height: 286mm;
            border: 1.5pt solid #0f172a;
            padding: 5mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: white;
          }
          .header { display: grid; grid-template-columns: 1fr 24mm 1fr; gap: 4mm; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 3mm; margin-bottom: 3mm; }
          .side { font-size: 8.5pt; font-weight: 900; line-height: 1.45; }
          .left { text-align: left; color: #334155; }
          .logo { width: 20mm; height: 20mm; object-fit: contain; margin: auto; display: block; }
          .title { text-align: center; border: 1.5pt solid #0f172a; background: #eef7fb; padding: 2.5mm; margin-bottom: 3mm; }
          .title h1 { margin: 0; font-size: 15pt; font-weight: 900; }
          .title p { margin: 1mm 0 0; font-size: 8.3pt; font-weight: 800; color: #475569; }
          .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.8mm; margin-bottom: 3mm; }
          .box { border: 1pt solid #0f172a; min-height: 14mm; }
          .box b { display: block; background: #f1f5f9; border-bottom: 1pt solid #0f172a; padding: 1.2mm 1.5mm; font-size: 7.5pt; }
          .box span { display: block; padding: 1.4mm 1.7mm; font-size: 8.8pt; font-weight: 900; line-height: 1.25; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.8mm; margin-bottom: 3mm; }
          .metric { border: 1pt solid #cbd5e1; background: #f8fafc; padding: 1.8mm; text-align: center; min-height: 15mm; }
          .metric strong { display: block; font-size: 15pt; color: #0f172a; line-height: 1; }
          .metric span { display: block; margin-top: .8mm; font-size: 6.8pt; font-weight: 900; color: #64748b; }
          .two { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm; margin-bottom: 3mm; }
          .section { border: 1pt solid #0f172a; min-height: 27mm; }
          .section-title { background: #0f172a; color: white; padding: 1.8mm 2.2mm; font-size: 8.2pt; font-weight: 900; }
          .section-body { padding: 2.2mm; font-size: 8.6pt; line-height: 1.55; font-weight: 700; white-space: pre-wrap; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm; margin-top: .5mm; }
          .sig { border: 1pt solid #cbd5e1; background: #f8fafc; min-height: 25mm; padding: 2mm; text-align: center; }
          .sig b { display: block; font-size: 7.7pt; margin-bottom: .5mm; }
          .sig img { max-height: 18mm; max-width: 70mm; object-fit: contain; }
          .approval { border: 1pt solid #047857; background: #ecfdf5; padding: 2mm 2.5mm; font-size: 8.2pt; font-weight: 900; line-height: 1.45; color: #065f46; margin-top: 2.5mm; }
          .footer { margin-top: auto; border-top: 1pt solid #cbd5e1; padding-top: 1.8mm; display: flex; justify-content: space-between; font-size: 7.2pt; font-weight: 800; color: #475569; }
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
