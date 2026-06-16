import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  GraduationCap,
  Hash,
  IdCard,
  ListChecks,
  MapPinned,
  MessageCircle,
  QrCode,
  School,
  Search,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import { Student } from '../../types';
import { APP_CONFIG } from '../../constants';

interface Props {
  students: Student[];
}

const normalizeId = (value: string) => value.replace(/\s+/g, '').trim();

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const StudentCommitteeInquiry: React.FC<Props> = ({ students }) => {
  const [nationalId, setNationalId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [copied, setCopied] = useState(false);

  const inquiryUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?student_inquiry=1`;
  }, []);

  const qrUrl = useMemo(() => {
    if (!inquiryUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(inquiryUrl)}&color=111827&bgcolor=ffffff&margin=10`;
  }, [inquiryUrl]);

  const whatsappUrl = useMemo(() => {
    const message = [
      'استعلام عن اللجنة',
      'مدرسة عماد الدين زنكي المتوسطة',
      '',
      'يمكن للطلاب معرفة رقم اللجنة وموقعها عبر الرابط:',
      inquiryUrl,
    ].join('\n');

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [inquiryUrl]);

  const student = useMemo(() => {
    const query = normalizeId(nationalId);
    if (!query) return null;
    return students.find(s => normalizeId(s.national_id) === query) || null;
  }, [students, nationalId]);

  const sameCommitteeCount = useMemo(() => {
    if (!student?.committee_number) return 0;
    return students.filter(s => s.committee_number === student.committee_number).length;
  }, [students, student]);

  const studentQrValue = useMemo(() => {
    if (!student) return '';
    return normalizeId(student.parent_phone || '') || normalizeId(student.national_id || '');
  }, [student]);

  const studentQrUrl = useMemo(() => {
    if (!studentQrValue) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(studentQrValue)}&color=111827&bgcolor=ffffff&margin=12`;
  }, [studentQrValue]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasSearched(true);
  };

  const handleCopyLink = async () => {
    if (!inquiryUrl) return;

    try {
      await navigator.clipboard.writeText(inquiryUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.createElement('input');
      input.value = inquiryUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleSaveStudentCard = async () => {
    if (!student) return;

    const canvas = document.createElement('canvas');
    const scale = 2;
    const width = 900;
    const height = 560;
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.direction = 'rtl';

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#111827');
    gradient.addColorStop(0.52, '#7c2d12');
    gradient.addColorStop(1, '#f97316');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    drawRoundRect(ctx, 34, 34, width - 68, height - 68, 34);
    ctx.fill();

    ctx.fillStyle = '#ea580c';
    ctx.font = '800 24px Tajawal, Arial';
    ctx.textAlign = 'right';
    ctx.fillText('مدرسة عماد الدين زنكي المتوسطة', width - 72, 86);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 42px Tajawal, Arial';
    ctx.fillText('بطاقة بيانات اللجنة', width - 72, 142);

    ctx.fillStyle = '#334155';
    ctx.font = '800 28px Tajawal, Arial';
    ctx.fillText(student.name || '-', width - 72, 206);

    const drawField = (label: string, value: string, x: number, y: number) => {
      ctx.fillStyle = '#f8fafc';
      drawRoundRect(ctx, x, y, 280, 88, 22);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '800 18px Tajawal, Arial';
      ctx.textAlign = 'right';
      ctx.fillText(label, x + 246, y + 32);
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 26px Tajawal, Arial';
      ctx.fillText(value || '-', x + 246, y + 66);
    };

    drawField('رقم اللجنة', student.committee_number || '-', 586, 250);
    drawField('رقم الجلوس', student.seating_number || student.national_id || '-', 286, 250);
    drawField('الصف / الفصل', `${student.grade || '-'} ${student.section ? `- ${student.section}` : ''}`, 586, 360);
    drawField('الموقع', student.location || `لجنة رقم ${student.committee_number || '-'}`, 286, 360);

    ctx.fillStyle = '#ffffff';
    drawRoundRect(ctx, 62, 238, 188, 226, 24);
    ctx.fill();
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (studentQrUrl) {
      try {
        const qrImage = await loadImage(studentQrUrl);
        ctx.drawImage(qrImage, 82, 256, 148, 148);
      } catch {
        ctx.fillStyle = '#e2e8f0';
        drawRoundRect(ctx, 82, 256, 148, 148, 18);
        ctx.fill();
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 18px Tajawal, Arial';
    ctx.fillText('QR الجوال', 156, 430);
    ctx.fillStyle = '#64748b';
    ctx.font = '800 15px Tajawal, Arial';
    ctx.fillText(studentQrValue || 'غير مسجل', 156, 454);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#16a34a';
    ctx.font = '900 20px Tajawal, Arial';
    ctx.fillText('يرجى حفظ البطاقة وإبراز بيانات اللجنة عند الحاجة.', width - 72, 508);

    const link = document.createElement('a');
    link.download = `بطاقة-اللجنة-${student.name || student.national_id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const resultCards = student
    ? [
        { icon: Hash, label: 'رقم الجلوس', value: student.seating_number || student.national_id || '-' },
        { icon: GraduationCap, label: 'الصف / الفصل', value: `${student.grade || '-'} ${student.section ? `- ${student.section}` : ''}` },
        { icon: MapPinned, label: 'الموقع', value: student.location || `لجنة رقم ${student.committee_number || '-'}` },
        { icon: Users, label: 'عدد طلاب اللجنة', value: sameCommitteeCount ? `${sameCommitteeCount} طالب` : '-' },
      ]
    : [];

  return (
    <div className="min-h-[100dvh] bg-[#fff7ed] font-['Tajawal'] text-right overflow-hidden" dir="rtl">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(251,146,60,0.32),transparent_34%),linear-gradient(135deg,#111827_0%,#7c2d12_55%,#f97316_100%)]"></div>
        <div className="absolute left-0 top-32 h-72 w-72 rounded-full bg-white/15 blur-3xl"></div>
        <div className="absolute right-[-8rem] bottom-10 h-96 w-96 rounded-full bg-orange-300/30 blur-3xl"></div>
      </div>

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 p-2 shadow-xl backdrop-blur">
              <img src={APP_CONFIG.LOGO_URL} alt="شعار المدرسة" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-orange-100 sm:text-sm">مدرسة عماد الدين زنكي المتوسطة</p>
              <p className="text-[10px] font-bold text-white/60">بوابة الطلاب الذكية</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-orange-50 backdrop-blur sm:flex">
            <Sparkles size={16} />
            تحديث مباشر من الكنترول
          </div>
        </header>

        <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
          <div className="text-white">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black backdrop-blur">
              <School size={16} className="text-orange-200" />
              خدمة آمنة وسريعة للطلاب
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">استعلام عن اللجنة</h1>
            <p className="mt-3 text-lg font-black text-orange-50">مدرسة عماد الدين زنكي المتوسطة</p>
            <p className="mt-4 max-w-xl text-sm font-bold leading-8 text-white/75">
              أدخل رقم الهوية لتظهر بيانات اللجنة ورقم الجلوس وموقع الطالب بشكل واضح ومناسب للجوال والشاشات الكبيرة.
            </p>

            <div className="mt-6 grid gap-4 rounded-[1.75rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur md:grid-cols-[150px_1fr]">
              <div className="rounded-[1.25rem] bg-white p-3 text-center shadow-xl">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR عام لرابط استعلام الطلاب" className="mx-auto aspect-square w-full max-w-[132px]" crossOrigin="anonymous" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-slate-300">
                    <QrCode size={56} />
                  </div>
                )}
                <p className="mt-2 text-[10px] font-black text-slate-500">QR عام للاستعلام</p>
              </div>

              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-orange-100">
                  <ListChecks size={18} />
                  تعليمات مختصرة
                </div>
                <div className="space-y-2 text-xs font-bold leading-6 text-white/80">
                  <p>1. افتح الرابط أو امسح رمز QR.</p>
                  <p>2. أدخل رقم الهوية ثم اضغط عرض بيانات اللجنة.</p>
                  <p>3. احفظ رقم اللجنة والموقع قبل التوجه للمدرسة.</p>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white shadow-lg transition hover:bg-emerald-400"
                  >
                    <MessageCircle size={17} />
                    مشاركة واتساب
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-4 py-3 text-xs font-black text-white transition hover:bg-white/25"
                  >
                    {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                    {copied ? 'تم نسخ الرابط' : 'نسخ الرابط'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/60 bg-white/90 p-4 shadow-2xl backdrop-blur-xl sm:p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs font-black text-slate-500">رقم الهوية</label>
              <div className="relative">
                <IdCard className="absolute right-5 top-1/2 -translate-y-1/2 text-orange-500" size={24} />
                <input
                  value={nationalId}
                  onChange={(event) => setNationalId(event.target.value)}
                  inputMode="numeric"
                  placeholder="اكتب رقم الهوية هنا"
                  className="w-full rounded-3xl border-2 border-orange-100 bg-orange-50/60 py-5 pl-5 pr-14 text-lg font-black text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white"
                />
              </div>
              <button className="flex w-full items-center justify-center gap-3 rounded-3xl bg-slate-950 py-5 text-lg font-black text-white shadow-xl transition hover:bg-orange-600 active:scale-[0.99]">
                <Search size={24} />
                عرض بيانات اللجنة
              </button>
            </form>

            <div className="mt-6 min-h-[340px]">
              {student ? (
                <div className="overflow-hidden rounded-[2rem] border border-orange-100 bg-white shadow-xl">
                  <div className="bg-gradient-to-l from-orange-600 to-amber-500 p-6 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black text-orange-100">بيانات الطالب</p>
                        <h2 className="mt-2 text-2xl font-black leading-tight">{student.name}</h2>
                      </div>
                      <div className="rounded-2xl bg-white/15 px-4 py-2 text-center backdrop-blur">
                        <p className="text-[10px] font-black text-orange-100">اللجنة</p>
                        <p className="text-4xl font-black tabular-nums">{student.committee_number || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {resultCards.map(item => (
                      <div key={item.label} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
                          <item.icon size={22} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400">{item.label}</p>
                        <p className="mt-1 text-lg font-black leading-tight text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mx-4 mb-4 grid gap-3 rounded-3xl border border-orange-100 bg-orange-50/70 p-4 sm:grid-cols-[130px_1fr]">
                    <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                      {studentQrUrl ? (
                        <img src={studentQrUrl} alt="QR الجوال المسجل للطالب" className="mx-auto aspect-square w-full max-w-[104px]" crossOrigin="anonymous" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center text-slate-300">
                          <QrCode size={44} />
                        </div>
                      )}
                      <p className="mt-2 text-[10px] font-black text-slate-500">QR الجوال</p>
                    </div>
                    <div className="flex min-w-0 flex-col justify-center">
                      <p className="text-xs font-black text-orange-700">بطاقة الطالب القابلة للحفظ</p>
                      <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
                        يحتوي الرمز على رقم الجوال المسجل للطالب، ويمكن حفظ البطاقة كصورة في الجهاز.
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveStudentCard}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-orange-600"
                      >
                        <Download size={18} />
                        حفظ صورة البطاقة
                      </button>
                    </div>
                  </div>

                  <div className="mx-4 mb-4 flex items-center gap-3 rounded-3xl bg-emerald-50 p-4 text-emerald-700">
                    <CheckCircle2 size={22} />
                    <p className="text-sm font-black">تم العثور على بياناتك. يرجى التوجه للجنة الموضحة أعلاه.</p>
                  </div>
                </div>
              ) : hasSearched ? (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-orange-200 bg-orange-50/70 p-8 text-center">
                  <AlertCircle size={48} className="text-orange-500" />
                  <h2 className="mt-4 text-2xl font-black text-slate-900">لم يتم العثور على الطالب</h2>
                  <p className="mt-2 max-w-sm text-sm font-bold leading-7 text-slate-500">تحقق من رقم الهوية أو راجع إدارة المدرسة لتحديث البيانات.</p>
                </div>
              ) : (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
                  <Share2 size={48} className="text-slate-300" />
                  <h2 className="mt-4 text-2xl font-black text-slate-900">ابدأ بالبحث</h2>
                  <p className="mt-2 max-w-sm text-sm font-bold leading-7 text-slate-500">النتيجة ستظهر هنا بتصميم واضح مناسب لجميع الشاشات.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default StudentCommitteeInquiry;
