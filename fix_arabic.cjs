const fs = require('fs');
let content = fs.readFileSync('screens/control/EnvelopeOpeningView.tsx', 'utf8');

// The tags were stripped. Let's find them by their class names.
content = content.replace(/<h2 className="text-4xl font-black mb-2 flex items-center gap-4">[\s\S]*?<\/h2>/g,
  '<h2 className="text-4xl font-black mb-2 flex items-center gap-4">' +
  '\n              <PackageOpen className="text-emerald-400" size={40} />' +
  '\n              فتح مظاريف الأسئلة' +
  '\n            </h2>');

content = content.replace(/<p className="text-slate-400 font-bold max-w-lg">[\s\S]*?<\/p>/g,
  '<p className="text-slate-400 font-bold max-w-lg">' +
  '\n              وثق عملية فتح المظاريف بمسح رمز المظروف وتحديد حالته، وإصدار المحاضر الرسمية لكل مظروف.' +
  '\n            </p>');

content = content.replace(/<button\s*onClick={startScanner}[^>]*>[\s\S]*?<\/button>/g,
  '<button onClick={startScanner} disabled={isScanning || !!scannedData} className="px-8 py-5 rounded-[2rem] font-black text-2xl flex items-center gap-4 transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/30">' +
  '\n            <Camera size={32} /> توثيق فتح مظروف أسئلة' +
  '\n          </button>');

content = content.replace(/<h3 className="text-3xl font-black text-slate-900">[\s\S]*?<\/h3>/g,
  '<h3 className="text-3xl font-black text-slate-900">توثيق فتح مظروف أسئلة</h3>');

content = content.replace(/<p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1"><\/p>\s*<p className="text-2xl font-black text-slate-800">\{scannedData\.subject\}<\/p>/g,
  '<p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">المادة</p>' +
  '\n              <p className="text-2xl font-black text-slate-800">{scannedData.subject}</p>');

content = content.replace(/<p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1"><\/p>\s*<p className="text-2xl font-black text-slate-800">\{scannedData\.grade\}<\/p>/g,
  '<p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">الصف</p>' +
  '\n              <p className="text-2xl font-black text-slate-800">{scannedData.grade}</p>');

content = content.replace(/<p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1"> <\/p>\s*<p className="text-2xl font-black text-blue-900">/g,
  '<p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">معلم المادة المقترح</p>' +
  '\n              <p className="text-2xl font-black text-blue-900">');

content = content.replace(/<p className="font-black text-xl text-slate-800 text-center">[\s\S]*?<\/p>/g,
  '<p className="font-black text-xl text-slate-800 text-center">حالة المظروف عند الاستلام والفتح:</p>');

content = content.replace(/<button onClick=\{handleSave\}[\s\S]*?<\/button>/g,
  '<button onClick={handleSave} className="w-full py-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-[2rem] font-black text-2xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all">اعتماد وتوثيق الفتح</button>');

content = content.replace(/<p className="text-white text-center font-black mt-8 text-xl animate-pulse">[\s\S]*?<\/p>/g,
  '<p className="text-white text-center font-black mt-8 text-xl animate-pulse">جاري قراءة المظروف...</p>');

// Wait, the "لا توجد مظاريف مفتوحة" text was also lost probably? Let's check:
content = content.replace(/<h3 className="text-xl font-black text-slate-800 mb-2">[\s\S]*?<\/h3>/g,
  '<h3 className="text-xl font-black text-slate-800 mb-2">لا توجد مظاريف مفتوحة</h3>');
content = content.replace(/<p className="text-slate-500 font-bold">[\s\S]*?<\/p>/g,
  '<p className="text-slate-500 font-bold">لم يتم تسجيل فتح أي مظروف في النظام لهذا اليوم.</p>');

// Also remove the activeDate filter so previous records show
content = content.replace(/setOpenings\(openingsData\.filter\(d => d\.date === activeDate\)\);/,
  'setOpenings(openingsData.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));');

content = content.replace(/setExamEnvelopes\(envelopesData\.filter\(d => d\.exam_date\.startsWith\(activeDate\)\)\);/,
  'setExamEnvelopes(envelopesData);');

fs.writeFileSync('screens/control/EnvelopeOpeningView.tsx', content);
