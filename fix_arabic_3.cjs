const fs = require('fs');
let content = fs.readFileSync('screens/control/EnvelopeOpeningView.tsx', 'utf8');

// Find the start of the openings.map block and replace everything until the end of the div grid.
const startMarker = '{openings.map(o => {';
const endMarker = '      {/* Printable Report Only */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{openings.map(o => {
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
              <div className={\`px-4 py-2 rounded-full font-black text-xs uppercase border \${o.status === 'INTACT' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-red-100/50 text-rose-600 border-red-200'}\`}>
                {o.status === 'INTACT' ? 'سليم' : 'تالف'}
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
              <div className={\`rounded-2xl border p-4 \${allMembersSigned ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}\`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">{allMembersSigned ? 'مكتمل التواقيع' : \`بانتظار التواقيع (\${signedMembersCount}/\${committeeMembers.length})\`}</span>
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

`;
  
  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync('screens/control/EnvelopeOpeningView.tsx', newContent);
  console.log('Fixed mapping block');
} else {
  console.log('Could not find markers');
}
