import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
// @ts-ignore
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, CheckCircle2, ShieldAlert, PackageOpen, Printer, Trash2 } from "lucide-react";
import { EnvelopeOpening, User } from "../../types";
import { db } from "../../supabase";
import OfficialHeader from "../../components/OfficialHeader";

interface Props {
  user: User;
  systemConfig: any;
  users: User[];
}

const EnvelopeOpeningView: React.FC<Props> = ({ user, systemConfig, users }) => {
  const [openings, setOpenings] = useState<EnvelopeOpening[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const qrScannerRef = useRef<any>(null);
  const [scannedData, setScannedData] = useState<{ subject: string, grade: string } | null>(null);
  const [status, setStatus] = useState<'INTACT' | 'DAMAGED'>('INTACT');
  const [printRecord, setPrintRecord] = useState<EnvelopeOpening | null>(null);

  const fetchOpenings = async () => {
    try {
      const data = await db.envelopeOpenings.getAll();
      setOpenings(data.filter(d => d.date === (systemConfig.active_exam_date || new Date().toISOString().split('T')[0])));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOpenings();
  }, [systemConfig.active_exam_date]);

  useEffect(() => {
    if (printRecord) {
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintRecord(null), 500);
      }, 500);
    }
  }, [printRecord]);

  const startScanner = async () => {
    setIsScanning(true);
    setScannedData(null);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("envelope-scanner");
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (text) => {
            if (text.startsWith("ENV|")) {
              const [, subject, grade] = text.split("|");
              setScannedData({ subject, grade });
              stopScanner();
            } else {
              alert("الرمز غير صالح لمظروف الأسئلة. يجب أن يكون ملصق مظروف أسئلة معتمد.");
              stopScanner();
            }
          },
          () => { }
        );
      } catch (err) {
        setIsScanning(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      } catch (err) { }
    }
    setIsScanning(false);
  };

  const handleSave = async () => {
    if (!scannedData) return;
    try {
      const activeDate = systemConfig.active_exam_date || new Date().toISOString().split('T')[0];
      const newRecord: Partial<EnvelopeOpening> = {
        id: crypto.randomUUID(),
        date: activeDate,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        subject: scannedData.subject,
        grade: scannedData.grade,
        status,
        opened_by: user.full_name
      };
      await db.envelopeOpenings.upsert(newRecord);
      await fetchOpenings();
      setScannedData(null);
      alert('تم تسجيل عملية فتح المظروف بنجاح.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا السجل؟")) {
      await db.envelopeOpenings.delete(id);
      await fetchOpenings();
    }
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
    return new Intl.DateTimeFormat('ar-SA', options).format(date);
  };

  return (
    <div className="space-y-8 animate-fade-in text-right">
      <div className="bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-b-[8px] border-emerald-600 no-print">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-4xl font-black mb-2 flex items-center gap-4">
              <PackageOpen className="text-emerald-400" size={40} />
              فتح مظاريف الأسئلة
            </h2>
            <p className="text-slate-400 font-bold max-w-lg">
              وثق عملية فتح المظاريف بمسح رمز المظروف وتحديد حالته، وإصدار المحاضر الرسمية لكل مظروف.
            </p>
          </div>
          <button
            onClick={startScanner}
            disabled={isScanning || !!scannedData}
            className="px-8 py-5 rounded-[2rem] font-black text-2xl flex items-center gap-4 transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/30"
          >
            <Camera size={32} />
            مسح المظروف وتوثيقه
          </button>
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in no-print">
          <button onClick={stopScanner} className="absolute top-6 left-6 text-white bg-white/10 p-4 rounded-full"><X size={32} /></button>
          <div className="w-full max-w-sm">
            <div id="envelope-scanner" className="aspect-square w-full rounded-[4rem] overflow-hidden border-8 border-emerald-500 shadow-2xl"></div>
            <p className="text-white text-center font-black mt-8 text-xl animate-pulse">وجه الكاميرا لملصق المظروف...</p>
          </div>
        </div>
      )}

      {scannedData && (
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 animate-slide-up no-print w-full max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
            <h3 className="text-3xl font-black text-slate-900">توثيق فتح مظروف أسئلة</h3>
            <button onClick={() => setScannedData(null)} className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-100"><X size={24} /></button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-6 rounded-[2rem] text-center border border-slate-100">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">المادة</p>
              <p className="text-2xl font-black text-slate-800">{scannedData.subject}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] text-center border border-slate-100">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">الصف</p>
              <p className="text-2xl font-black text-slate-800">{scannedData.grade}</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <p className="font-black text-xl text-slate-800 text-center">حالة المظروف عند الاستلام والفتح:</p>
            <div className="flex gap-4">
              <button onClick={() => setStatus('INTACT')} className={`flex-1 py-6 rounded-[2rem] font-black text-2xl flex flex-col items-center justify-center gap-3 transition-all ${status === 'INTACT' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                <CheckCircle2 size={36} /> سليم
              </button>
              <button onClick={() => setStatus('DAMAGED')} className={`flex-1 py-6 rounded-[2rem] font-black text-2xl flex flex-col items-center justify-center gap-3 transition-all ${status === 'DAMAGED' ? 'bg-rose-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                <ShieldAlert size={36} /> غير سليم
              </button>
            </div>
          </div>

          <button onClick={handleSave} className="w-full py-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-[2rem] font-black text-2xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all">
            اعتماد وتوثيق الفتح
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
        {openings.map(o => (
          <div key={o.id} className="bg-white p-8 rounded-[3rem] shadow-md border border-slate-100 relative overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-6 border-b border-slate-50 pb-6">
              <div>
                <h4 className="text-2xl font-black text-slate-800 mb-1">{o.subject}</h4>
                <p className="text-sm font-bold text-slate-500">{o.grade}</p>
              </div>
              <div className={`px-4 py-2 rounded-full font-black text-xs uppercase border ${o.status === 'INTACT' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-red-100/50 text-rose-600 border-red-200'}`}>
                {o.status === 'INTACT' ? 'سليم' : 'غير سليم'}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold text-sm">الوقت:</span>
                <span className="font-black text-slate-800">{o.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold text-sm">بواسطة:</span>
                <span className="font-black text-slate-800">{o.opened_by}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setPrintRecord(o)} className="flex-1 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-[1.5rem] font-black text-lg flex justify-center items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                <Printer size={20} /> طباعة المحضر
              </button>
              <button onClick={() => handleDelete(o.id)} className="p-4 bg-red-50 text-red-500 rounded-[1.5rem] hover:bg-red-600 hover:text-white transition-all">
                <Trash2 size={24} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Printable Report Only */}
      {printRecord && createPortal(
        <div id="envelope-print-portal">
          <style>{`
               @media screen { #envelope-print-portal { display: none !important; } }
               @media print {
                 @page { size: A4 portrait; margin: 10mm; }
                 body { background: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; color: black !important; }
                 #root, #app-root, header, nav, .no-print { display: none !important; }
                 #envelope-print-portal { display: block !important; position: absolute; top: 0; left: 0; width: 100%; direction: rtl; }
                 .print-container { padding: 0; max-width: 100%; margin: 0 auto; font-family: 'Tajawal', sans-serif; }
               }
             `}</style>
          <div className="print-container">
            <OfficialHeader />

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '20px', backgroundColor: '#e0f2fe', marginTop: '10px' }}>
              <tbody>
                <tr>
                  <td style={{ border: '2px solid #000', padding: '10px', width: '50%', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>
                    اسم النموذج: محضر فتح مظروف أسئلة
                  </td>
                  <td style={{ border: '2px solid #000', padding: '10px', width: '50%', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>
                    رقم النموذج: 27
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', textAlign: 'center', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#e0f2fe' }}>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '15%' }}>اليوم</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '25%' }}>التاريخ</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '15%' }}>الفترة</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '20%' }}>المادة</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '25%' }}>الصف</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>{getDayName(printRecord.date)}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold', direction: 'ltr' }}>{printRecord.date.split('-').reverse().join(' / ')}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>الأولى</td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>{printRecord.subject}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>{printRecord.grade}</td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '20px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>
                    تم فتح مظروف الأسئلة عند الساعة ( <span style={{ fontFamily: 'sans-serif', margin: '0 5px' }}>{printRecord.time}</span> ص بواسطة : <span style={{ margin: '0 5px' }}>{printRecord.opened_by || ''}</span> ) ووجد:
                    <span style={{ margin: '0 10px' }}>
                      {printRecord.status === 'INTACT' ? '☑ سليم' : '☐ سليم'}
                    </span>
                    <span style={{ margin: '0 10px' }}>
                      {printRecord.status === 'DAMAGED' ? '☑ غير سليم' : '☐ غير سليم'}
                    </span>
                    وتم تحرير محضر بذلك.
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>أعضاء اللجنة</td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', textAlign: 'center', marginBottom: '40px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '10%' }}>م</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '30%' }}>الاسم</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '25%' }}>عمله</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '15%' }}>الصفة</th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '20%' }}>التوقيع</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>1</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{users.find(u => u.role === 'CONTROL_MANAGER')?.full_name || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>رئيس الكنترول</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>رئيساً</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>2</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{users.filter(u => u.role === 'CONTROL')[0]?.full_name || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>عضو كنترول</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>عضواً</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>3</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{users.filter(u => u.role === 'CONTROL')[1]?.full_name || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>عضو كنترول</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>عضواً</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>4</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{users.filter(u => u.role === 'CONTROL')[2]?.full_name || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>عضو كنترول</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>عضواً</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', fontWeight: 'bold', fontSize: '18px' }}>
              <div>مدير المدرسة: .......................................</div>
              <div>التوقيع: .......................................</div>
            </div>

            <div style={{ marginTop: '50px', fontSize: '14px', lineHeight: '1.8' }}>
              <ul style={{ paddingRight: '20px' }}>
                <li style={{ color: '#000' }}>تفتح مظاريف الأسئلة قبل بدء الاختبار بـ (15) دقيقة.</li>
                <li style={{ color: '#e11d48', fontWeight: 'bold' }}>يمنع فتح أظرف نماذج الإجابة إلا بعد التأكد من استلام جميع أوراق الإجابة من الطلبة.</li>
                <li style={{ color: '#000' }}>يحفظ بملف أعمال الاختبارات.</li>
              </ul>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnvelopeOpeningView;
