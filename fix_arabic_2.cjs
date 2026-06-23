const fs = require('fs');
let content = fs.readFileSync('screens/control/EnvelopeOpeningView.tsx', 'utf8');

content = content.replace(/<span className="text-slate-400 font-bold text-sm">:<\/span>\s*<span className="font-black text-slate-800">\{o\.time\}<\/span>/g,
  '<span className="text-slate-400 font-bold text-sm">الوقت:</span>\n                <span className="font-black text-slate-800">{o.time}</span>');

content = content.replace(/<span className="text-slate-400 font-bold text-sm">:<\/span>\s*<span className="font-black text-slate-800">\{o\.opened_by\}<\/span>/g,
  '<span className="text-slate-400 font-bold text-sm">بواسطة:</span>\n                <span className="font-black text-slate-800">{o.opened_by}</span>');

content = content.replace(/<span className="text-slate-400 font-bold text-sm">:<\/span>\s*<span className="font-black text-slate-800">\{getSubjectTeacherName\(o\) \|\| '-.*?'\}<\/span>/g,
  '<span className="text-slate-400 font-bold text-sm">معلم المادة:</span>\n                <span className="font-black text-slate-800">{getSubjectTeacherName(o) || \'---\'}</span>');

content = content.replace(/\{o\.status === 'INTACT' \? '' : ' '\}/g,
  "{o.status === 'INTACT' ? 'سليم' : 'تالف'}");

fs.writeFileSync('screens/control/EnvelopeOpeningView.tsx', content);
