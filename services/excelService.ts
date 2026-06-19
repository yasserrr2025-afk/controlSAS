
import * as XLSX from 'xlsx';

const normalizeHeader = (value: unknown) => {
  return String(value || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '')
    .toLowerCase();
};

const HEADER_KEYWORDS = [
  'رقمالهويه',
  'الهويه',
  'السجلالمدني',
  'رقمالطالب',
  'اسمالطالب',
  'الاسم',
  'الجوال',
  'رقمجوال',
  'رقمالجوال',
  'جوالوليالامر',
  'الصف',
  'رقمالصف',
  'الفصل',
  'الشعبه',
  'اللجنه',
  'رقماللجنه',
  'رقمالجلوس',
  'جلوس',
  'nationalid',
  'studentid',
  'studentname',
  'name',
  'phone',
  'mobile',
  'grade',
  'section',
  '\u0631\u0642\u0645\u0627\u0644\u0647\u0648\u064a\u0647',
  '\u0627\u0644\u0647\u0648\u064a\u0647',
  '\u0627\u0644\u0633\u062c\u0644\u0627\u0644\u0645\u062f\u0646\u064a',
  '\u0631\u0642\u0645\u0627\u0644\u0637\u0627\u0644\u0628',
  '\u0627\u0633\u0645\u0627\u0644\u0637\u0627\u0644\u0628',
  '\u0627\u0644\u0627\u0633\u0645',
  '\u0627\u0644\u062c\u0648\u0627\u0644',
  '\u0631\u0642\u0645\u062c\u0648\u0627\u0644',
  '\u0631\u0642\u0645\u0627\u0644\u062c\u0648\u0627\u0644',
  '\u062c\u0648\u0627\u0644\u0648\u0644\u064a\u0627\u0644\u0627\u0645\u0631',
  '\u0627\u0644\u0635\u0641',
  '\u0631\u0642\u0645\u0627\u0644\u0635\u0641',
  '\u0627\u0644\u0641\u0635\u0644',
];

const getHeaderScore = (row: unknown[]) => {
  return row.reduce((score, cell) => {
    const header = normalizeHeader(cell);
    if (!header) return score;
    return score + (HEADER_KEYWORDS.some(keyword => header.includes(keyword)) ? 1 : 0);
  }, 0);
};

export const parseExcel = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        let bestSheetName = workbook.SheetNames[0];
        let bestHeaderRow = 0;
        let bestScore = -1;

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as unknown[][];
          rows.forEach((row, index) => {
            const score = getHeaderScore(row);
            if (score > bestScore) {
              bestScore = score;
              bestSheetName = sheetName;
              bestHeaderRow = index;
            }
          });
        });

        const worksheet = workbook.Sheets[bestSheetName];
        const json = XLSX.utils
          .sheet_to_json(worksheet, { range: bestHeaderRow, raw: false, defval: '' })
          .filter((row: any) => Object.values(row).some(value => String(value || '').trim()));
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
