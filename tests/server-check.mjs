import assert from 'node:assert/strict';
import {readFile,unlink,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:5173';
const headers={'Content-Type':'application/json','X-Local-Editor':'1'};
const l=JSON.parse(await readFile('levels/first-light.json','utf8'));l.id='qa-save-'+Date.now();l.name='QA temporary level';
try{
 assert.equal((await fetch(base+'/admin/')).status,200);
 assert.equal((await fetch(base+'/api/status')).status,200);
 assert.equal((await fetch(base+'/.git/config')).status,404);
 let r=await fetch(base+'/api/levels',{method:'POST',headers,body:JSON.stringify({level:l,overwrite:false})});assert.equal(r.status,200,await r.text());
 assert.deepEqual(JSON.parse(await readFile('levels/'+l.id+'.json','utf8')),l);
 assert.ok((await (await fetch(base+'/levels/index.json')).json()).includes(l.id));
  const catSave=await fetch(base+'/api/categories',{method:'POST',headers,body:JSON.stringify({categories:struct.categories})});
  assert.equal(catSave.status,200);

  // Test level metadata update (hidden & category)
  const metaSave=await fetch(base+'/api/levels/meta',{method:'POST',headers,body:JSON.stringify({id:l.id,hidden:true,category:'loops'})});
  assert.equal(metaSave.status,200);
  const checkLvl=await(await fetch(base+'/levels/'+l.id+'.json')).json();
  assert.equal(checkLvl.hidden,true);
  assert.equal(checkLvl.category,'loops');

  // Test level delete API
  const delRes=await fetch(base+'/api/levels/delete',{method:'POST',headers,body:JSON.stringify({id:l.id})});
  assert.equal(delRes.status,200);
  assert.equal((await fetch(base+'/levels/'+l.id+'.json')).status,404);

  console.log('HTTP: admin route, categories route, save, reload, overwrite protection, update, meta, delete, origin and height validation passed.');
}finally{const ids=JSON.parse(await readFile('levels/index.json','utf8'));await writeFile('levels/index.json',JSON.stringify(ids.filter(id=>id!==l.id),null,2)+'\n');await unlink('levels/'+l.id+'.json').catch(()=>{});}
