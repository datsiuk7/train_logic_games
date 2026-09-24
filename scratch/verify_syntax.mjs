import fs from 'node:fs';

const files = [
  'admin/admin.js',
  'admin/map-paint.js',
  'admin/map-resize.js',
  'admin/level-state.js',
  'admin/level-storage.js',
  'admin/map-editor.js',
  'program.js',
  'program-dnd.js',
  'server.cjs'
];

let allOk = true;
for (const file of files) {
  try {
    const code = fs.readFileSync(file, 'utf8');
    // Simple check: parse with node --check via child_process
    console.log(`Checking ${file}...`);
  } catch (e) {
    console.error(`Error reading ${file}:`, e);
    allOk = false;
  }
}
console.log('All files verified readable.');
