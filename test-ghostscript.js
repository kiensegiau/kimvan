const { execSync } = require('child_process');

try {
  const pdfPath = 'C:/Users/Admin/AppData/Local/Temp/sample.pdf';
  const gsPath = 'C:/Program Files/gs/gs10.05.0/bin/gswin64c.exe';
  
  // Properly escape the file path for GhostScript
  const command = `"${gsPath}" -q -dNODISPLAY -c "(${pdfPath.replace(/\\/g, '/')}) (r) file runpdfbegin pdfpagecount = quit"`;
  
  console.log(`Running command: ${command}`);
  const output = execSync(command, { encoding: 'utf8' }).trim();
  console.log(`Number of pages: ${output}`);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Full error:', error);
} 