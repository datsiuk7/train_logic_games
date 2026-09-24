import fs from 'fs';

const html = fs.readFileSync('admin/index.html', 'utf8');
const css = fs.readFileSync('admin/editor.css', 'utf8');
const adminJs = fs.readFileSync('admin/admin.js', 'utf8');
const resizeJs = fs.readFileSync('admin/map-resize.js', 'utf8');

console.log('Tools has repeat(9):', css.includes('grid-template-columns:repeat(9,minmax(0,1fr))'));
console.log('Matrix has repeat(9):', css.includes('grid-template-columns: repeat(9, 1fr)'));
console.log('Has steppers CSS:', css.includes('.size-steppers'));
console.log('Has #width input:', html.includes('id="width"'));
console.log('Has #depth input:', html.includes('id="depth"'));
console.log('Has #btn-width-dec:', html.includes('id="btn-width-dec"'));
console.log('Has #btn-width-inc:', html.includes('id="btn-width-inc"'));
console.log('Has #btn-depth-dec:', html.includes('id="btn-depth-dec"'));
console.log('Has #btn-depth-inc:', html.includes('id="btn-depth-inc"'));
console.log('Has #size-matrix:', html.includes('id="size-matrix"'));
console.log('Admin JS has stepper listeners:', adminJs.includes('#btn-width-dec') && adminJs.includes('updateStepButtonsState'));
console.log('Resize JS handles didResizeOnPointerUp:', resizeJs.includes('didResizeOnPointerUp'));
