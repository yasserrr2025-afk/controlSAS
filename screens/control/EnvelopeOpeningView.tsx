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
  const [examEnvelopes, setExamEnvelopes] = useState<any[]>([]);

  const fetchOpenings = async () => {
    try {
      const activeDate = systemConfig.active_exam_date || new Date().toISOString().split('T')[0];
      const [openingsData, envelopesData] = await Promise.all([
        db.envelopeOpenings.getAll(),
        db.examEnvelopes.getAll()
      ]);
      setOpenings(openingsData.filter(d => d.date === activeDate));
      setExamEnvelopes(envelopesData.filter(d => d.exam_date.startsWith(activeDate)));
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

  const resolveSubjectTeacherUser = (teacherId?: string | null, teacherName?: string | null) =>
    users.find(item =>
      item.id === teacherId ||
      item.national_id === teacherId ||
      normalizeEnvelopeValue(item.full_name) === normalizeEnvelopeValue(teacherName)
    );

  const resolveSubjectTeacherName = (teacherId?: string | null, teacherName?: string | null) =>
    resolveSubjectTeacherUser(teacherId, teacherName)?.full_name || teacherName || '';

  const getEnvelopeCommitteeMembers = (record?: EnvelopeOpening | Partial<EnvelopeOpening> | null) => {
    const subjectTeacherRequest = record?.id
      ? controlRequests.find(request =>
          request.committee === `ENV:${record.id}` &&
          isSignatureRequest(request) &&
          request.text.includes('[SIGNATURE_ROLE:subjectTeacher]')
        )
      : null;
    const linkedEnv = examEnvelopes.find(e => e.subject === record?.subject && e.grade === record?.grade);
    const subjectTeacherUser =
      resolveSubjectTeacherUser(record?.subject_teacher_id, record?.subject_teacher_name)
      || resolveSubjectTeacherUser(linkedEnv?.subject_teacher_id, linkedEnv?.subject_teacher_name)
      || resolveSubjectTeacherUser(undefined, subjectTeacherRequest?.from);
    const subjectTeacherName =
      subjectTeacherUser?.full_name
      || resolveSubjectTeacherName(record?.subject_teacher_id, record?.subject_teacher_name)
      || linkedEnv?.subject_teacher_name
      || subjectTeacherRequest?.from
      || '';
    const controlMembers = users.filter(item => item.role === 'CONTROL');
    return uniqueMembers([
      {
        user: users.find(item => item.role === 'CONTROL_MANAGER'),
        name: users.find(item => item.role === 'CONTROL_MANAGER')?.full_name || '',
        work: ' ',
        title: '',
        signatureRole: 'envelopeMember',
      },
      ...controlMembers.slice(0, 3).map(member => ({
        user: member,
        name: member.full_name,
        work: ' ',
        title: '',
        signatureRole: 'envelopeMember' as const,
      })),
      {
        user: subjectTeacherUser,
        name: subjectTeacherName,
        work: ' ',
        title: '',
        ...{ work: '\u0645\u0639\u0644\u0645 \u0627\u0644\u0645\u0627\u062f\u0629', title: '\u0639\u0636\u0648\u0627\u064b' },
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
                  onAlert?.('       .', 'error');
                  stopScanner();
                  return;
                }
                if (envelope.status === 'OPENED' || envelope.opening_id) {
                  onAlert?.(`      ${envelope.opened_by || ' '}.`, 'warning');
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
                onAlert?.(error.message || '   .', 'error');
                stopScanner();
              });
            } else if (text.startsWith("ENV|")) {
              const [, subject, grade, teacherId, teacherName] = text.split("|");
              const parsedData = { subject, grade, teacherId, teacherName };
              const duplicate = findDuplicateOpening(parsedData);
              if (duplicate) {
                onAlert?.(`      ${duplicate.opened_by || ' '}   ${duplicate.time}.`, 'warning');
                if (!onAlert) alert("         .");
                stopScanner();
                return;
              }
              setScannedData(parsedData);
              stopScanner();
            } else {
              alert("    .       .");
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
          onAlert?.('       .', 'error');
          setScannedData(null);
          return;
        }
        if (latestEnvelope.status === 'OPENED' || latestEnvelope.opening_id) {
          onAlert?.(`     .     ${latestEnvelope.opened_by || ' '}.`, 'warning');
          setScannedData(null);
          return;
        }
      }
      const latestOpenings = await db.envelopeOpenings.getAll();
      const sameDayOpenings = latestOpenings.filter(item => item.date === activeDate);
      const duplicate = findDuplicateOpening(scannedData, sameDayOpenings);
      if (duplicate) {
        onAlert?.(`     .     ${duplicate.opened_by || ' '}   ${duplicate.time}.`, 'warning');
        setScannedData(null);
        return;
      }
      const subjectTeacher = resolveSubjectTeacherUser(scannedData.teacherId, scannedData.teacherName);
      const subjectTeacherName = resolveSubjectTeacherName(scannedData.teacherId, scannedData.teacherName);
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
          onAlert?.(error.message || '     .', 'warning');
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
              ? `${SIGNATURE_REQUEST_PREFIX}[SIGNATURE_ROLE:subjectTeacher]        ${scannedData.subject} - ${scannedData.grade}`
              : `${SIGNATURE_REQUEST_PREFIX}[SIGNATURE_ROLE:envelopeMember]          ${scannedData.subject} - ${scannedData.grade}`,
            time: new Date().toISOString(),
            status: 'PENDING',
          });
          if (member.user) {
            await db.notifications.broadcast(
              `     : ${scannedData.subject} - ${scannedData.grade}`,
              member.user.id,
              user.full_name
            ).catch(() => undefined);
          }
        }
        if (principalName && !signatureMembers.some(member => normalizeEnvelopeValue(member.name) === normalizeEnvelopeValue(principalName))) {
          await db.controlRequests.insert({
            from: principalName,
            committee: `ENV:${newRecord.id}`,
            text: `${SIGNATURE_REQUEST_PREFIX}[SIGNATURE_ROLE:principal]        ${scannedData.subject} - ${scannedData.grade}`,
            time: new Date().toISOString(),
            status: 'PENDING',
          });
          if (principalUser) {
            await db.notifications.broadcast(
              `       : ${scannedData.subject} - ${scannedData.grade}`,
              principalUser.id,
              user.full_name
            ).catch(() => undefined);
          }
        }
      }
      await fetchOpenings();
      await onRefresh?.();
      setScannedData(null);
      onAlert?.('        .', 'success');
      if (!onAlert) {
      alert('     .');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (user.role !== 'ADMIN') {
      onAlert?.('      .', 'warning');
      return;
    }
    if (confirm("      ")) {
      await db.controlRequests.deleteByCommittees([`ENV:${id}`, id]);
      await db.envelopeOpenings.delete(id);
      await fetchOpenings();
      await onRefresh?.();
      onAlert?.('        .', 'success');
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
    const linkedEnv = examEnvelopes.find(e => e.subject === record.subject && e.grade === record.grade);
    return resolveSubjectTeacherName(record.subject_teacher_id, record.subject_teacher_name)
      || linkedEnv?.subject_teacher_name
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
                
            </h2>
            <p className="text-slate-400 font-bold max-w-lg">
                           .
            </p>
          </div>
          <button
            onClick={startScanner}
            disabled={isScanning || !!scannedData}
            className="px-8 py-5 rounded-[2rem] font-black text-2xl flex items-center gap-4 transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/30"
          >
            <Camera size={32} />
              
          </button>
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in no-print">
          <button onClick={stopScanner} className="absolute top-6 left-6 text-white bg-white/10 p-4 rounded-full"><X size={32} /></button>
          <div className="w-full max-w-sm">
            <div id="envelope-scanner" className="aspect-square w-full rounded-[4rem] overflow-hidden border-8 border-emerald-500 shadow-2xl"></div>
            <p className="text-white text-center font-black mt-8 text-xl animate-pulse">   ...</p>
          </div>
        </div>
      )}

      {scannedData && (
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 animate-slide-up no-print w-full max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
            <h3 className="text-3xl font-black text-slate-900">   </h3>
            <button onClick={() => setScannedData(null)} className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-100"><X size={24} /></button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 p-6 rounded-[2rem] text-center border border-slate-100">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1"></p>
              <p className="text-2xl font-black text-slate-800">{scannedData.subject}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-[2rem] text-center border border-slate-100">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1"></p>
              <p className="text-2xl font-black text-slate-800">{scannedData.grade}</p>
            </div>
            <div className="col-span-2 bg-blue-50 p-6 rounded-[2rem] text-center border border-blue-100">
              <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1"> </p>
              <p className="text-2xl font-black text-blue-900">{resolveSubjectTeacherName(scannedData.teacherId, scannedData.teacherName) || '---'}</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <p className="font-black text-xl text-slate-800 text-center">    :</p>
            <div className="flex gap-4">
              <button onClick={() => setStatus('INTACT')} className={`flex-1 py-6 rounded-[2rem] font-black text-2xl flex flex-col items-center justify-center gap-3 transition-all ${status === 'INTACT' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                <CheckCircle2 size={36} /> 
              </button>
              <button onClick={() => setStatus('DAMAGED')} className={`flex-1 py-6 rounded-[2rem] font-black text-2xl flex flex-col items-center justify-center gap-3 transition-all ${status === 'DAMAGED' ? 'bg-rose-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                <ShieldAlert size={36} />  
              </button>
            </div>
          </div>

          <button onClick={handleSave} className="w-full py-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-[2rem] font-black text-2xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all">
              
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
                {o.status === 'INTACT' ? '' : ' '}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold text-sm">:</span>
                <span className="font-black text-slate-800">{o.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold text-sm">:</span>
                <span className="font-black text-slate-800">{o.opened_by}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold text-sm"> :</span>
                <span className="font-black text-slate-800">{getSubjectTeacherName(o) || '---'}</span>
              </div>
              <div className={`rounded-2xl border p-4 ${allMembersSigned ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">{allMembersSigned ? '   ' : `  (${signedMembersCount}/${committeeMembers.length})`}</span>
                  {allMembersSigned ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setPrintRecord(o)} className="flex-1 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-[1.5rem] font-black text-lg flex justify-center items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                <Printer size={20} />  
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
                     :    
                  </td>
                  <td style={{ border: '2px solid #000', padding: '10px', width: '50%', fontWeight: 'bold', fontSize: '18px', textAlign: 'center' }}>
                     : 27
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', textAlign: 'center', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#e0f2fe' }}>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '15%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '25%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '15%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '20%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '25%' }}></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>{getDayName(printRecord.date)}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold', direction: 'ltr' }}>{printRecord.date.split('-').reverse().join(' / ')}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}></td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>{printRecord.subject}</td>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}>{printRecord.grade}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold', backgroundColor: '#f8fafc' }}> </td>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold', textAlign: 'right' }}>{getSubjectTeacherName(printRecord) || '---'}</td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '20px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>
                          ( <span style={{ fontFamily: 'sans-serif', margin: '0 5px' }}>{printRecord.time}</span>   : <span style={{ margin: '0 5px' }}>{printRecord.opened_by || ''}</span> ) :
                    <span style={{ margin: '0 10px' }}>
                      {printRecord.status === 'INTACT' ? ' ' : ' '}
                    </span>
                    <span style={{ margin: '0 10px' }}>
                      {printRecord.status === 'DAMAGED' ? '  ' : '  '}
                    </span>
                       .
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '10px', fontWeight: 'bold' }}> </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', textAlign: 'center', marginBottom: '40px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '10%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '30%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '25%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '15%' }}></th>
                  <th style={{ border: '1px solid #000', padding: '10px', width: '20%' }}></th>
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
                          <img src={signature.signature} alt={` ${member.name}`} style={{ height: 42, maxWidth: 150, objectFit: 'contain', margin: '0 auto' }} />
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
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}> </td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}></td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>2</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{users.filter(u => u.role === 'CONTROL')[0]?.full_name || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}> </td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}></td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>3</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{users.filter(u => u.role === 'CONTROL')[1]?.full_name || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}> </td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}></td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>4</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{users.filter(u => u.role === 'CONTROL')[2]?.full_name || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}> </td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}></td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>5</td>
                  <td style={{ border: '1px solid #000', padding: '15px' }}>{getSubjectTeacherName(printRecord)}</td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}> </td>
                  <td style={{ border: '1px solid #000', padding: '15px', fontWeight: 'bold' }}></td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>
                    {subjectTeacherSignature?.signature ? (
                      <img src={subjectTeacherSignature.signature} alt="  " style={{ height: 42, maxWidth: 150, objectFit: 'contain', margin: '0 auto' }} />
                    ) : null}
                  </td>
                </tr>
                </>
                )}
              </tbody>
            </table>

            <div className="official-signature-row">
              <div className="principal-signature-card">
                <div className="principal-title"> </div>
                <div className="principal-name">{principalName || '.......................................'}</div>
                <div className="principal-signature-label"></div>
                {getPrincipalSignature(printRecord)?.signature ? (
                  <img
                    src={getPrincipalSignature(printRecord)?.signature}
                    alt="  "
                    style={{ height: 36, maxWidth: 150, objectFit: 'contain', margin: '0 auto' }}
                  />
                ) : null}
                <div className="principal-signature-line"></div>
              </div>
            </div>

            <div className="official-notes">
              <ul style={{ paddingRight: '20px' }}>
                <li style={{ color: '#000' }}>       (15) .</li>
                <li style={{ color: '#e11d48', fontWeight: 'bold' }}>              .</li>
                <li style={{ color: '#000' }}>   .</li>
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
