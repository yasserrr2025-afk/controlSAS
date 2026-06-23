import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
// @ts-ignore
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, CheckCircle2, ShieldAlert, PackageOpen, Printer, Trash2 } from "lucide-react";
import { ControlRequest, EnvelopeOpening, User } from "../../types";
import { db, supabase } from "../../supabase";
import OfficialHeader from "../../components/OfficialHeader";
import { findStoredSignatureBySourceRequest, isSignatureRequest, SIGNATURE_REQUEST_PREFIX } from "../../services/signatures";

interface Props {
  user: User;
  systemConfig: any;
  users: User[];
  controlRequests?: ControlRequest[];
  onRefresh?: () => Promise<void>;
  onAlert?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const EnvelopeOpeningView: React.FC<Props> = ({ user, systemConfig, users, controlRequests = [], onRefresh, onAlert }) => {
  const [openings, setOpenings] = useState<EnvelopeOpening[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const qrScannerRef = useRef<any>(null);
  const [scannedData, setScannedData] = useState<{ subject: string, grade: string, teacherId?: string, teacherName?: string, envelopeId?: string } | null>(null);
  const [status, setStatus] = useState<'INTACT' | 'DAMAGED'>('INTACT');
  const [printRecord, setPrintRecord] = useState<EnvelopeOpening | null>(null);

  const fetchOpenings = async () => {
    try {
      const data = await db.envelopeOpenings.getAll();
      setOpenings(
        data.sort((a, b) =>
          String(b.time || b.date || '').localeCompare(String(a.time || a.date || ''))
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOpenings();
    const channel = supabase
      .channel(`envelope-openings-live-${systemConfig.active_exam_date || 'today'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'envelope_openings' }, () => fetchOpenings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_envelopes' }, () => fetchOpenings())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [systemConfig.active_exam_date]);

  const normalizeEnvelopeValue = (value?: string | null) =>
    String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const findDuplicateOpening = (
    data: { subject: string, grade: string, teacherId?: string, teacherName?: string },
    source: EnvelopeOpening[] = openings
  ) => {
    const subject = normalizeEnvelopeValue(data.subject);
    const grade = normalizeEnvelopeValue(data.grade);
    const teacherKey = normalizeEnvelopeValue(data.teacherId || data.teacherName);
    return source.find(opening => {
      const sameSubject = normalizeEnvelopeValue(opening.subject) === subject;
      const sameGrade = normalizeEnvelopeValue(opening.grade) === grade;
      const openingTeacherKey = normalizeEnvelopeValue(opening.subject_teacher_id || opening.subject_teacher_name);
      const sameTeacher = !teacherKey || !openingTeacherKey || teacherKey === openingTeacherKey;
      return sameSubject && sameGrade && sameTeacher;
    });
  };

  const uniqueMembers = (members: Array<{ user?: User; name: string; work: string; title: string; signatureRole: 'subjectTeacher' | 'envelopeMember' }>) => {
    const byName = new Map<string, { user?: User; name: string; work: string; title: string; signatureRole: 'subjectTeacher' | 'envelopeMember' }>();
    members.filter(member => Boolean(member.name)).forEach(member => {
      const key = normalizeEnvelopeValue(member.name);
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, member);
        return;
      }
      const works = Array.from(new Set([...existing.work.split(' / '), member.work])).filter(Boolean);
      byName.set(key, {
        user: existing.user || member.user,
        name: existing.name,
        work: works.join(' / '),
        title: existing.title === member.title ? existing.title : `${existing.title} / ${member.title}`,
        signatureRole: existing.signatureRole === 'subjectTeacher' || member.signatureRole === 'subjectTeacher'
          ? 'subjectTeacher'
          : 'envelopeMember',
      });
    });
    return Array.from(byName.values());
  };

  const getPrincipalUser = () => {
    const principalName = normalizeEnvelopeValue(systemConfig?.principal_name);
    return users.find(item => principalName && normalizeEnvelopeValue(item.full_name) === principalName)
      || users.find(item => item.role === 'ADMIN');
  };

  const getPrincipalName = () => systemConfig?.principal_name || getPrincipalUser()?.full_name || '';

  const getEnvelopeCommitteeMembers = (record?: EnvelopeOpening | Partial<EnvelopeOpening> | null) => {
    const subjectTeacherRequest = record?.id
      ? controlRequests.find(request =>
          request.committee === `ENV:${record.id}` &&
          isSignatureRequest(request) &&
          request.text.includes('[SIGNATURE_ROLE:subjectTeacher]')
        )
      : null;
    const subjectTeacherUser = users.find(item =>
      item.id === record?.subject_teacher_id ||
      item.national_id === record?.subject_teacher_id ||
      item.full_name === record?.subject_teacher_name ||
      item.full_name === subjectTeacherRequest?.from
    );
    const subjectTeacherName = subjectTeacherUser?.full_name || record?.subject_teacher_name || subjectTeacherRequest?.from || '';
    const controlMembers = users.filter(item => item.role === 'CONTROL');
    return uniqueMembers([
      {
        user: users.find(item => item.role === 'CONTROL_MANAGER'),
        name: users.find(item => item.role === 'CONTROL_MANAGER')?.full_name || '',
        work: 'رئيس الكنترول',
        title: 'رئيساً',
        signatureRole: 'envelopeMember',
      },
      ...controlMembers.slice(0, 3).map(member => ({
        user: member,
        name: member.full_name,
        work: 'عضو كنترول',
        title: 'عضواً',
        signatureRole: 'envelopeMember' as const,
      })),
      {
        user: subjectTeacherUser,
        name: subjectTeacherName,
        work: 'معلم المادة',
        title: 'عضواً',
        signatureRole: 'subjectTeacher',
      },
    ]);
  };

  const findMemberSignatureRequest = (record: EnvelopeOpening, member: { name: string; signatureRole: 'subjectTeacher' | 'envelopeMember' }) => {
    const memberName = normalizeEnvelopeValue(member.name);
    const roleTag = `[SIGNATURE_ROLE:${member.signatureRole}]`;
    return controlRequests.find(request =>
      request.committee === `ENV:${record.id}` &&
      isSignatureRequest(request) &&
      request.text.includes(roleTag) &&
      normalizeEnvelopeValue(request.from) === memberName
    );
  };

  const getMemberSignature = (record: EnvelopeOpening, member: { name: string; signatureRole: 'subjectTeacher' | 'envelopeMember' }) => {
    const signatureRequest = findMemberSignatureRequest(record, member);
    return findStoredSignatureBySourceRequest(controlRequests, signatureRequest?.id);
  };

  const findPrincipalSignatureRequest = (record: EnvelopeOpening) => {
    const principalName = normalizeEnvelopeValue(getPrincipalName());
    return controlRequests.find(request =>
      request.committee === `ENV:${record.id}` &&
      isSignatureRequest(request) &&
      request.text.includes('[SIGNATURE_ROLE:principal]') &&
      (!principalName || normalizeEnvelopeValue(request.from) === principalName)
    );
  };

  const getPrincipalSignature = (record: EnvelopeOpening) => {
    const signatureRequest = findPrincipalSignatureRequest(record);
    return findStoredSignatureBySourceRequest(controlRequests, signatureRequest?.id);
  };

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
            if (text.startsWith("ENV2|")) {
              const [, envelopeId] = text.split("|");
              db.examEnvelopes.getById(envelopeId).then(envelope => {
                if (!envelope) {
                  onAlert?.('لم يتم العثور على المظروف في قاعدة البيانات.', 'error');
                  stopScanner();
                  return;
                }
                if (envelope.status === 'OPENED' || envelope.opening_id) {
                  onAlert?.(`هذا المظروف تم فتحه مسبقاً بواسطة ${envelope.opened_by || 'مستخدم آخر'}.`, 'warning');
                  stopScanner();
                  return;
                }
                setScannedData({
                  envelopeId: envelope.id,
                  subject: envelope.subject,
                  grade: envelope.grade,
                  teacherId: envelope.subject_teacher_id,
                  teacherName: envelope.subject_teacher_name,
                });
                stopScanner();
              }).catch((error: any) => {
                onAlert?.(error.message || 'تعذر قراءة بيانات المظروف.', 'error');
                stopScanner();
              });
            } else if (text.startsWith("ENV|")) {
              const [, subject, grade, teacherId, teacherName] = text.split("|");
              const parsedData = { subject, grade, teacherId, teacherName };
              const duplicate = findDuplicateOpening(parsedData);
              if (duplicate) {
                onAlert?.(`هذا المظروف تم فتحه مسبقاً بواسطة ${duplicate.opened_by || 'مستخدم آخر'} عند الساعة ${duplicate.time}.`, 'warning');
                if (!onAlert) alert("هذا المظروف تم فتحه مسبقاً ولا يمكن فتحه مرة أخرى.");
                stopScanner();
                return;
              }
              setScannedData(parsedData);
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
      if (scannedData.envelopeId) {
        const latestEnvelope = await db.examEnvelopes.getById(scannedData.envelopeId);
        if (!latestEnvelope) {
          onAlert?.('لم يتم العثور على المظروف في قاعدة البيانات.', 'error');
          setScannedData(null);
          return;
        }
        if (latestEnvelope.status === 'OPENED' || latestEnvelope.opening_id) {
          onAlert?.(`لا يمكن تكرار فتح هذا المظروف. تم فتحه مسبقاً بواسطة ${latestEnvelope.opened_by || 'مستخدم آخر'}.`, 'warning');
          setScannedData(null);
          return;
        }
      }
      const latestOpenings = await db.envelopeOpenings.getAll();
      const sameDayOpenings = latestOpenings.filter(item => item.date === activeDate);
      const duplicate = findDuplicateOpening(scannedData, sameDayOpenings);
      if (duplicate) {
        onAlert?.(`لا يمكن تكرار فتح هذا المظروف. تم فتحه مسبقاً بواسطة ${duplicate.opened_by || 'مستخدم آخر'} عند الساعة ${duplicate.time}.`, 'warning');
        setScannedData(null);
        return;
      }
      const subjectTeacher = users.find(item =>
        item.id === scannedData.teacherId ||
        item.national_id === scannedData.teacherId ||
        item.full_name === scannedData.teacherName
      );
      const subjectTeacherName = subjectTeacher?.full_name || scannedData.teacherName || '';
      const newRecord: Partial<EnvelopeOpening> = {
        id: crypto.randomUUID(),
        date: activeDate,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        subject: scannedData.subject,
        grade: scannedData.grade,
        status,
        opened_by: user.full_name,
        subject_teacher_id: subjectTeacher?.id || scannedData.teacherId,
        subject_teacher_name: subjectTeacherName,
      };
      try {
        await db.envelopeOpenings.upsert(newRecord);
      } catch {
        const { subject_teacher_id, subject_teacher_name, ...legacyRecord } = newRecord;
        await db.envelopeOpenings.upsert(legacyRecord);
      }
      if (scannedData.envelopeId && newRecord.id) {
        try {
          await db.examEnvelopes.markOpened(scannedData.envelopeId, newRecord.id, user.full_name);
        } catch (error: any) {
          await db.envelopeOpenings.delete(newRecord.id).catch(() => undefined);
          onAlert?.(error.message || 'لا يمكن تكرار فتح هذا المظروف.', 'warning');
          setScannedData(null);
          return;
        }
      }
      if (newRecord.id) {
        const signatureMembers = getEnvelopeCommitteeMembers(newRecord);
        const principalUser = getPrincipalUser();
        const principalName = getPrincipalName();
        for (const member of signatureMembers) {
          const isSubjectTeacher = member.signatureRole === 'subjectTeacher';
          await db.controlRequests.insert({
            from: member.name,
            committee: `ENV:${newRecord.id}`,
            text: isSubjectTeacher
              ? `${SIGNATURE_REQUEST_PREFIX}[SIGNATURE_ROLE:subjectTeacher] توقيع معلم المادة على محضر فتح مظروف ${scannedData.subject} - ${scannedData.grade}`
              : `${SIGNATURE_REQUEST_PREFIX}[SIGNATURE_ROLE:envelopeMember] توقيع عضو لجنة فتح المظروف على محضر فتح مظروف ${scannedData.subject} - ${scannedData.grade}`,
            time: new Date().toISOString(),
            status: 'PENDING',
          });
          if (member.user) {
            await db.notifications.broadcast(
              `لديك محضر فتح مظروف بانتظار توقيعك: ${scannedData.subject} - ${scannedData.grade}`,
              member.user.id,
              user.full_name
            ).catch(() => undefined);
          }
        }
        if (principalName && !signatureMembers.some(member => normalizeEnvelopeValue(member.name) === normalizeEnvelopeValue(principalName))) {
          await db.controlRequests.insert({
            from: principalName,
            committee: `ENV:${newRecord.id}`,
            text: `${SIGNATURE_REQUEST_PREFIX}[SIGNATURE_ROLE:principal] توقيع مدير المدرسة على محضر فتح مظروف ${scannedData.subject} - ${scannedData.grade}`,
            time: new Date().toISOString(),
            status: 'PENDING',
          });
          if (principalUser) {
            await db.notifications.broadcast(
              `لديك محضر فتح مظروف بانتظار توقيع مدير المدرسة: ${scannedData.subject} - ${scannedData.grade}`,
              principalUser.id,
              user.full_name
            ).catch(() => undefined);
          }
        }
      }
      await fetchOpenings();
      await onRefresh?.();
      setScannedData(null);
      onAlert?.('تم تسجيل فتح المظروف وإرسال طلب توقيع معلم المادة.', 'success');
      if (!onAlert) {
      alert('تم تسجيل عملية فتح المظروف بنجاح.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (user.role !== 'ADMIN') {
      onAlert?.('حذف فتح المظروف متاح فقط لمدير النظام.', 'warning');
      return;
    }
    if (confirm("هل أنت متأكد من حذف هذا السجل؟")) {
      await db.controlRequests.deleteByCommittees([`ENV:${id}`, id]);
      await db.envelopeOpenings.delete(id);
      await fetchOpenings();
      await onRefresh?.();
      onAlert?.('تم حذف سجل فتح المظروف وطلبات التوقيع المرتبطة به.', 'success');
    }
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
    return new Intl.DateTimeFormat('ar-SA', options).format(date);
  };

  const getSubjectTeacherName = (record?: EnvelopeOpening | null) => {
    if (!record) return '';
    const subjectTeacherRequest = controlRequests.find(req =>
      req.committee === `ENV:${record.id}` &&
      isSignatureRequest(req) &&
      req.text.includes('[SIGNATURE_ROLE:subjectTeacher]')
    );
    return record.subject_teacher_name
      || subjectTeacherRequest?.from
      || '';
  };
  const principalName = systemConfig?.principal_name || users.find(u => u.role === 'ADMIN')?.full_name || '';

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
            <div className="col-span-2 bg-blue-50 p-6 rounded-[2rem] text-center border border-blue-100">
              <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">معلم المادة</p>
              <p className="text-2xl font-black text-blue-900">{scannedData.teacherName || 'غير محدد'}</p>
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
        {openings.map(o => {
          const committeeMembers = getEnvelopeCommitteeMembers(o);
          const signedMembersCount = committeeMembers.filter(member => Boolean(getMemberSignature(o, member)?.signature)).length;
          const allMembersSigned = committeeMembers.length > 0 && signedMembersCount === committeeMembers.length;
          return (
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
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold text-sm">معلم المادة:</span>
                <span className="font-black text-slate-800">{getSubjectTeacherName(o) || '---'}</span>
              </div>
              <div className={`rounded-2xl border p-4 ${allMembersSigned ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">{allMembersSigned ? 'تم اكتمال توقيعات المحضر' : `بانتظار التوقيعات (${signedMembersCount}/${committeeMembers.length})`}</span>
                  {allMembersSigned ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setPrintRecord(o)} className="flex-1 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-[1.5rem] font-black text-lg flex justify-center items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                <Printer size={20} /> طباعة المحضر
              </button>
              {user.role === 'ADMIN' && (
                <button onClick={() => handleDelete(o.id)} className="p-4 bg-red-50 text-red-500 rounded-[1.5rem] hover:bg-red-600 hover:text-white transition-all">
                  <Trash2 size={24} />
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* Printable Report Only */}
      {printRecord && createPortal(
        <div id="envelope-print-portal">
          <style>{`
               @media screen { #envelope-print-portal { display: none !important; } }
               @media print {
                 @page { size: A4 portrait; margin: 8mm; }
                 body { background: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; color: black !important; }
                 #root, #app-root, header, nav, .no-print { display: none !important; }
                 #envelope-print-portal { display: block !important; position: absolute; top: 0; left: 0; width: 100%; direction: rtl; }
                 .print-container {
                   padding: 4mm;
                   max-width: 100%;
                   margin: 0 auto;
                   font-family: 'Tajawal', sans-serif;
                   font-size: 13px;
                   line-height: 1.45;
                   color: #111827;
                   border: 1.2pt solid #111827;
                   box-sizing: border-box;
                   min-height: 274mm;
                   display: flex;
                   flex-direction: column;
                 }
                 #envelope-print-portal .report-body {
                   flex: 1;
                   display: flex;
                   flex-direction: column;
                 }
                 #envelope-print-portal table { margin-bottom: 11px !important; border-color: #111827 !important; }
                 #envelope-print-portal th,
                 #envelope-print-portal td {
                   padding: 7px 8px !important;
                   font-size: 13px !important;
                   line-height: 1.45 !important;
                   border-color: #111827 !important;
                 }
                 #envelope-print-portal .print-container > table:first-of-type td {
                   font-size: 15px !important;
                   padding: 9px !important;
                   background: #eef7fb !important;
                   font-weight: 900 !important;
                 }
                 #envelope-print-portal .print-container > table:nth-of-type(2) th {
                   font-size: 13.5px !important;
                   background: #edf8fc !important;
                 }
                 #envelope-print-portal .print-container > table:nth-of-type(2) td {
                   font-size: 13.5px !important;
                 }
                 #envelope-print-portal .print-container > table:nth-of-type(3) th {
                   background: #f3f6f8 !important;
                   font-size: 13px !important;
                 }
                 #envelope-print-portal .print-container > table:nth-of-type(3) td {
                   padding: 8px !important;
                   font-size: 12.5px !important;
                 }
                 #envelope-print-portal .w-16 { width: 54px !important; height: 54px !important; }
                 #envelope-print-portal .text-\\[11px\\] { font-size: 12px !important; }
                 #envelope-print-portal ul { margin: 0 !important; }
                 #envelope-print-portal li { margin: 1px 0 !important; line-height: 1.55 !important; font-size: 13px !important; }
                 #envelope-print-portal table[style*="margin-bottom: 40px"] { margin-bottom: 18px !important; }
                 #envelope-print-portal div[style*="font-size: 14px"] { font-size: 14px !important; }
                 #envelope-print-portal .official-signature-row {
                   margin-top: 16mm;
                   padding: 0 24mm;
                   display: flex;
                   justify-content: flex-start;
                   direction: ltr;
                   font-size: 14px;
                   font-weight: 900;
                 }
                 #envelope-print-portal .principal-signature-card {
                   width: 78mm;
                   min-height: 28mm;
                   text-align: center;
                   display: flex;
                   flex-direction: column;
                   align-items: center;
                   justify-content: flex-start;
                   gap: 2.5mm;
                   direction: rtl;
                 }
                 #envelope-print-portal .principal-title {
                   font-size: 14px;
                   font-weight: 900;
                 }
                 #envelope-print-portal .principal-name {
                   font-size: 14px;
                   font-weight: 900;
                 }
                 #envelope-print-portal .principal-signature-label {
                   margin-top: 2mm;
                   font-size: 13px;
                   font-weight: 900;
                 }
                 #envelope-print-portal .principal-signature-line {
                   width: 62mm;
                   border-bottom: 1.6pt dotted #111827;
                   height: 5mm;
                 }
                 #envelope-print-portal .official-notes {
                   margin-top: auto;
                   border-top: 1.4pt solid #111827;
                   padding-top: 4mm;
                   font-size: 13px;
                   line-height: 1.8;
                 }
               }
             `}</style>
          <div className="print-container">
            <OfficialHeader systemConfig={systemConfig} date={printRecord.date} />
            <div className="report-body">

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
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>معلم المادة</td>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold', textAlign: 'right' }}>{getSubjectTeacherName(printRecord) || '---'}</td>
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
                {getEnvelopeCommitteeMembers(printRecord).map((member, index) => {
                  const signature = getMemberSignature(printRecord, member);
                  return (
                    <tr key={`${member.name}-${member.work}`}>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>{index + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>{member.name}</td>
                      <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>{member.work}</td>
                      <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>{member.title}</td>
                      <td style={{ border: '1px solid #000', padding: '8px' }}>
                        {signature?.signature ? (
                          <img src={signature.signature} alt={`توقيع ${member.name}`} style={{ height: 42, maxWidth: 150, objectFit: 'contain', margin: '0 auto' }} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {false && (
                <>
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
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>5</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{getSubjectTeacherName(printRecord)}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>معلم المادة</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}>عضواً</td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>
                    {null ? (
                      <img src={''} alt="توقيع معلم المادة" style={{ height: 42, maxWidth: 150, objectFit: 'contain', margin: '0 auto' }} />
                    ) : null}
                  </td>
                </tr>
                </>
                )}
              </tbody>
            </table>

            <div className="official-signature-row">
              <div className="principal-signature-card">
                <div className="principal-title">مدير المدرسة</div>
                <div className="principal-name">{principalName || '.......................................'}</div>
                <div className="principal-signature-label">التوقيع</div>
                {getPrincipalSignature(printRecord)?.signature ? (
                  <img
                    src={getPrincipalSignature(printRecord)?.signature}
                    alt="توقيع مدير المدرسة"
                    style={{ height: 36, maxWidth: 150, objectFit: 'contain', margin: '0 auto' }}
                  />
                ) : null}
                <div className="principal-signature-line"></div>
              </div>
            </div>

            <div className="official-notes">
              <ul style={{ paddingRight: '20px' }}>
                <li style={{ color: '#000' }}>تفتح مظاريف الأسئلة قبل بدء الاختبار بـ (15) دقيقة.</li>
                <li style={{ color: '#e11d48', fontWeight: 'bold' }}>يمنع فتح أظرف نماذج الإجابة إلا بعد التأكد من استلام جميع أوراق الإجابة من الطلبة.</li>
                <li style={{ color: '#000' }}>يحفظ بملف أعمال الاختبارات.</li>
              </ul>
            </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnvelopeOpeningView;
