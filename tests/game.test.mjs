import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateLevel,initialState,step,won,compile,blockCount} from '../logic.mjs';
const load=async id=>JSON.parse(await readFile(new URL(`./fixtures/${id}.json`,import.meta.url),'utf8'));
 const solutions={
  'first-light':['forward','forward','light'],
  'garden-turn':['light'],
  'small-stairs':['jump','jump','jump','light'],
  'zigzag-street':['forward','right','jump','left','forward','right','forward','left','jump','right','forward','light'],
  'twin-lights':['jump','forward','light','right','right','forward','jump','left','forward','forward','left','jump','forward','light'],
  'lantern-street':[{type:'loop',times:3,body:[{type:'forward'},{type:'light'}]}],
  'high-watch':[{type:'loop',times:5,body:[{type:'jump'}]},'light']
 };
for(const [id,solution] of Object.entries(solutions))test(`${id}: valid and solvable with allowed commands`,async()=>{const l=await load(id);assert.deepEqual(validateLevel(l),[]);const p=solution.map((s,i)=>typeof s==='string'?{type:s,id:String(i)}:s);let state=initialState(l);for(const b of compile(l,p))state=step(l,state,b.type);assert.ok(won(l,state))});
test('height, tree, missing tile and light rules',async()=>{const l=await load('small-stairs');let s=initialState(l);assert.throws(()=>step(l,s,'forward'),/висота/);s=step(l,s,'jump');assert.equal(s.z,2);l.cells[1][1].height=5;assert.throws(()=>step(l,s,'jump'),/перепад/);l.cells[1][1].height=2;l.cells[1][1].tree=true;assert.throws(()=>step(l,s,'jump'),/Дерево/);l.cells[1][1]=null;assert.throws(()=>step(l,s,'jump'),/плитки/);assert.throws(()=>step(l,s,'light'),/немає ліхтаря/)});
test('downhill requires jump; lighting toggles state',async()=>{const l=await load('small-stairs');const s={x:1,z:0,dir:2,lit:[]};assert.throws(()=>step(l,s,'forward'),/висота/);assert.equal(step(l,s,'jump').z,1);const lit=step(l,s,'light');assert.ok(lit.lit.includes('1,0'));assert.equal(step(l,lit,'light').lit.includes('1,0'),false)});
test('validation rejects conflicts and out-of-range heights',async()=>{const l=await load('first-light');const lamp=l.cells.flat().find(c=>c?.lamp);lamp.tree=true;assert.ok(validateLevel(l).length);lamp.tree=false;lamp.height=6;assert.ok(validateLevel(l).length);l.id='../bad';assert.ok(validateLevel(l).some(s=>s.startsWith('ID:')))});
test('loop limits, empty and nested loops',async()=>{const l=await load('lantern-street');assert.throws(()=>compile(l,[{type:'loop',times:2,body:[]}]),/Цикл/);assert.throws(()=>compile(l,[{type:'loop',times:2,body:[{type:'loop',times:2,body:[]}]}]),/Вкладені/);assert.equal(blockCount([{type:'loop',body:[{type:'forward'},{type:'light'}]}]),3);assert.throws(()=>compile(l,[{type:'left'}]),/недоступна/)});
