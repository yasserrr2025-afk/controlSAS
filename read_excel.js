import * as XLSX from 'xlsx';
import * as fs from 'fs';

function dumpExcel(filename) {
  try {
    const wb = XLSX.readFile(filename);
    console.log(`=== ${filename} ===`);
    wb.SheetNames.forEach(name => {
      console.log(`Sheet: ${name}`);
      const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
      console.log(JSON.stringify(data.slice(0, 30), null, 2)); // Print first 30 rows
    });
  } catch(e) {
    console.error(e);
  }
}

dumpExcel('test/توزيع اللجان.xlsx');
dumpExcel('test/كروكي اللجان.xlsx');
