const fs = require('fs');
const file = 'screens/control/EnvelopeOpeningView.tsx';
const content = fs.readFileSync(file, 'utf8');

let fixedContent;
try {
  const iconv = require('iconv-lite');
  let buf = iconv.encode(content, 'windows-1256');
  fixedContent = buf.toString('utf8');
} catch (e) {
  // fallback if iconv-lite isn't available
  fixedContent = Buffer.from(content, 'latin1').toString('utf8');
}

fs.writeFileSync('screens/control/EnvelopeOpeningView.fixed.tsx', fixedContent, 'utf8');
console.log('Fixed encoding generated.');
