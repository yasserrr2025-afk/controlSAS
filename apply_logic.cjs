const fs = require('fs');
let content = fs.readFileSync('screens/control/EnvelopeOpeningView.tsx', 'utf8');

// 1. Add examEnvelopes state
content = content.replace(
  /const \[openings, setOpenings\] = useState<EnvelopeOpening\[\]>\(\[\]\);/,
  "const [openings, setOpenings] = useState<EnvelopeOpening[]>([]);\n  const [examEnvelopes, setExamEnvelopes] = useState<any[]>([]);"
);

// 2. Modify fetchOpenings
content = content.replace(
  /const fetchOpenings = async \(\) => \{[\s\S]*?catch \(e\) \{/m,
  `const fetchOpenings = async () => {
    try {
      const [data, envs] = await Promise.all([
        db.envelopeOpenings.getAll(),
        db.examEnvelopes.getAll()
      ]);
      setOpenings(
        data.sort((a, b) =>
          String(b.date + ' ' + b.time).localeCompare(String(a.date + ' ' + a.time))
        )
      );
      setExamEnvelopes(envs);
    } catch (e) {`
);

// 3. Modify getSubjectTeacherName
content = content.replace(
  /const getSubjectTeacherName = \(record\?: EnvelopeOpening \| null\) => \{[\s\S]*?return resolveSubjectTeacherName\(record\.subject_teacher_id, record\.subject_teacher_name\)[\s\S]*?\|\| subjectTeacherRequest\?\.from[\s\S]*?\|\| '';\n  \};/m,
  `const getSubjectTeacherName = (record?: EnvelopeOpening | null) => {
    if (!record) return '';
    const subjectTeacherRequest = controlRequests.find(req =>
      req.committee === \`ENV:\${record.id}\` &&
      isSignatureRequest(req) &&
      req.text.includes('[SIGNATURE_ROLE:subjectTeacher]')
    );
    const linkedEnv = examEnvelopes.find(e => e.subject === record.subject && e.grade === record.grade);
    return resolveSubjectTeacherName(record.subject_teacher_id, record.subject_teacher_name)
      || linkedEnv?.subject_teacher_name
      || subjectTeacherRequest?.from
      || '';
  };`
);

// 4. Modify getEnvelopeCommitteeMembers
content = content.replace(
  /const getEnvelopeCommitteeMembers = \(record\?: EnvelopeOpening \| Partial<EnvelopeOpening> \| null\) => \{[\s\S]*?const subjectTeacherUser = users\.find\(item =>[\s\S]*?item\.full_name === subjectTeacherRequest\?\.from\n    \);[\s\S]*?const subjectTeacherName = subjectTeacherUser\?\.full_name \|\| record\?\.subject_teacher_name \|\| subjectTeacherRequest\?\.from \|\| '';/m,
  `const getEnvelopeCommitteeMembers = (record?: EnvelopeOpening | Partial<EnvelopeOpening> | null) => {
    const subjectTeacherRequest = record?.id
      ? controlRequests.find(request =>
          request.committee === \`ENV:\${record.id}\` &&
          isSignatureRequest(request) &&
          request.text.includes('[SIGNATURE_ROLE:subjectTeacher]')
        )
      : null;
      
    const linkedEnv = examEnvelopes.find(e => e.subject === record?.subject && e.grade === record?.grade);

    const subjectTeacherUser = users.find(item =>
      item.id === record?.subject_teacher_id ||
      item.national_id === record?.subject_teacher_id ||
      item.full_name === record?.subject_teacher_name ||
      item.id === linkedEnv?.subject_teacher_id ||
      item.national_id === linkedEnv?.subject_teacher_id ||
      item.full_name === linkedEnv?.subject_teacher_name ||
      item.full_name === subjectTeacherRequest?.from
    );

    const subjectTeacherName = subjectTeacherUser?.full_name || record?.subject_teacher_name || linkedEnv?.subject_teacher_name || subjectTeacherRequest?.from || '';`
);

fs.writeFileSync('screens/control/EnvelopeOpeningView.tsx', content);
console.log('Transform complete.');
