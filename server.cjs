const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=__dirname,levelDir=path.join(root,'levels');
const port=Number(process.env.PORT)||5173;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
let writes=Promise.resolve();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(data))};
async function atomic(file,data){const temp=file+'.tmp';await fs.writeFile(temp,data,'utf8');await fs.rename(temp,file)}
async function readBody(req){let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000)throw new Error('Файл надто великий.')}return JSON.parse(body)}
http.createServer(async(req,res)=>{
 try{
  if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host)){json(res,403,{error:'Лише локальні запити.'});return}
  const url=new URL(req.url,'http://'+req.headers.host);let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400).end();return}
   const isLocal=(req.headers['x-local-editor']==='1'||req.headers['x-requested-with']==='local')&&req.headers['content-type']==='application/json'&&(!req.headers.origin||req.headers.origin==='http://'+req.headers.host);
   if(pathname==='/api/status'&&req.method==='GET'){json(res,200,{local:true});return}
   if(pathname==='/api/structure'&&req.method==='GET'){
    try{
      let cats;try{cats=JSON.parse(await fs.readFile(path.join(levelDir,'categories.json'),'utf8'))}catch{const {categories}=await import('./logic.mjs');cats=categories}
      const ids=JSON.parse(await fs.readFile(path.join(levelDir,'index.json'),'utf8'));
      const lvls=[];
      for(const id of ids){
        try{
          const data=JSON.parse(await fs.readFile(path.join(levelDir,id+'.json'),'utf8'));
          lvls.push(data);
        }catch{}
      }
      json(res,200,{categories:cats,levels:lvls});
    }catch(err){json(res,500,{error:err.message})}
    return;
   }
   if(pathname==='/api/settings'&&req.method==='GET'){
    try{
      let s;try{s=JSON.parse(await fs.readFile(path.join(levelDir,'settings.json'),'utf8'))}catch{s={footerDayText:'Місто чекає на твою програму.',footerNightText:'Ніч чекає на твою програму.',developerText:''}}
      json(res,200,s);
    }catch(err){json(res,500,{error:err.message})}
    return;
   }
   if(pathname==='/api/settings'&&req.method==='POST'){
    if(!isLocal){json(res,403,{error:'Збереження дозволене тільки з локального редактора.'});return}
    const body=await readBody(req);
    const settings={
      footerDayText:typeof body.footerDayText==='string'?body.footerDayText.slice(0,200):'Місто чекає на твою програму.',
      footerNightText:typeof body.footerNightText==='string'?body.footerNightText.slice(0,200):'Ніч чекає на твою програму.',
      developerText:typeof body.developerText==='string'?body.developerText.slice(0,200):''
    };
    const operation=async()=>{
      await atomic(path.join(levelDir,'settings.json'),JSON.stringify(settings,null,2)+'\n');
      json(res,200,{saved:true,settings});
    };
    const task=writes.then(operation);writes=task.catch(()=>{});await task;return;
   }
   if(pathname==='/api/categories'&&req.method==='POST'){
    if(!isLocal){json(res,403,{error:'Збереження дозволене тільки з локального редактора.'});return}
    const body=await readBody(req);
    if(!Array.isArray(body.categories)||!body.categories.length){json(res,400,{error:'Категорії мають бути непорожнім масивом.'});return}
    for(const c of body.categories){
      if(!c.id||!/^[a-z0-9-]+$/.test(c.id)||!c.title||typeof c.title!=='string'){json(res,400,{error:'Некоректна категорія: потрібні валідний ID та назва.'});return}
    }
    const operation=async()=>{
      await atomic(path.join(levelDir,'categories.json'),JSON.stringify(body.categories,null,2)+'\n');
      json(res,200,{saved:true,count:body.categories.length});
    };
    const task=writes.then(operation);writes=task.catch(()=>{});await task;return;
   }
   if(pathname==='/api/levels/reorder'&&req.method==='POST'){
    if(!isLocal){json(res,403,{error:'Дія дозволена тільки з локального редактора.'});return}
    const body=await readBody(req);
    if(!Array.isArray(body.ids)||!body.ids.every(id=>typeof id==='string'&&/^[a-z0-9-]+$/.test(id))){json(res,400,{error:'Некоректний список ID рівнів.'});return}
    const operation=async()=>{
      await atomic(path.join(levelDir,'index.json'),JSON.stringify(body.ids,null,2)+'\n');
      json(res,200,{saved:true,ids:body.ids});
    };
    const task=writes.then(operation);writes=task.catch(()=>{});await task;return;
   }
   if(pathname==='/api/levels/meta'&&req.method==='POST'){
    if(!isLocal){json(res,403,{error:'Дія дозволена тільки з локального редактора.'});return}
    const body=await readBody(req);
    const {id,category,hidden,name}=body;
    if(!id||!/^[a-z0-9-]+$/.test(id)||id==='index'||id==='categories'){json(res,400,{error:'Некоректний ID рівня.'});return}
    const file=path.join(levelDir,id+'.json');
    const operation=async()=>{
      let lvl;try{lvl=JSON.parse(await fs.readFile(file,'utf8'))}catch{json(res,404,{error:'Рівень не знайдено.'});return}
      if(category!==undefined)lvl.category=category;
      if(hidden!==undefined){if(hidden)lvl.hidden=true;else delete lvl.hidden;}
      if(typeof name==='string'&&name.trim())lvl.name=name.trim();
      const {validateLevel}=await import('./logic.mjs');
      const errors=validateLevel(lvl);
      if(errors.length){json(res,400,{error:errors.join(' ')});return}
      await atomic(file,JSON.stringify(lvl,null,2)+'\n');
      json(res,200,{updated:id,level:lvl});
    };
    const task=writes.then(operation);writes=task.catch(()=>{});await task;return;
   }
   if(pathname==='/api/levels/delete'&&req.method==='POST'){
    if(!isLocal){json(res,403,{error:'Дія дозволена тільки з локального редактора.'});return}
    const body=await readBody(req);
    const id=body.id;
    if(!id||!/^[a-z0-9-]+$/.test(id)||id==='index'||id==='categories'){json(res,400,{error:'Некоректний ID для видалення.'});return}
    const operation=async()=>{
      const ids=JSON.parse(await fs.readFile(path.join(levelDir,'index.json'),'utf8'));
      const newIds=ids.filter(i=>i!==id);
      await atomic(path.join(levelDir,'index.json'),JSON.stringify(newIds,null,2)+'\n');
      await fs.unlink(path.join(levelDir,id+'.json')).catch(()=>{});
      json(res,200,{deleted:id});
    };
    const task=writes.then(operation);writes=task.catch(()=>{});await task;return;
   }
   if(pathname==='/api/levels'&&req.method==='POST'){
    if(req.headers['x-local-editor']!=='1'||req.headers['content-type']!=='application/json'||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)){json(res,403,{error:'Збереження дозволене тільки з локального редактора.'});return}
    const body=await readBody(req);const {validateLevel}=await import('./logic.mjs');const errors=validateLevel(body.level);if(errors.length){json(res,400,{error:errors.join(' ')});return}
    const l=body.level;if(l.id==='index'||l.id==='categories'){json(res,400,{error:'Ім’я '+l.id+' зарезервоване.'});return}
     const operation=async()=>{
       let file=path.join(levelDir,l.id+'.json');
       let exists=false;
       try{await fs.access(file);exists=true}catch{}
       if(exists&&body.overwrite!==true){
         let num=2,prefix=l.id;
         const m=l.id.match(/^(.*?)-(\d+)$/);
         if(m){prefix=m[1];num=parseInt(m[2],10)+1}
         let newId=`${prefix}-${num}`;
         while(true){
           try{await fs.access(path.join(levelDir,newId+'.json'));num++;newId=`${prefix}-${num}`}catch{break}
         }
         l.id=newId;
         file=path.join(levelDir,l.id+'.json');
       }
       const ids=JSON.parse(await fs.readFile(path.join(levelDir,'index.json'),'utf8'));
       await atomic(file,JSON.stringify(l,null,2)+'\n');
       if(!ids.includes(l.id))ids.push(l.id);
       await atomic(path.join(levelDir,'index.json'),JSON.stringify(ids,null,2)+'\n');
       json(res,200,{saved:l.id,level:l});
     };
     const task=writes.then(operation);writes=task.catch(()=>{});await task;return;
    }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return}
   if(pathname==='/admin'){res.writeHead(302,{Location:'/admin/'}).end();return}
   if(pathname==='/admin/categories'){res.writeHead(302,{Location:'/admin/categories.html'}).end();return}
   if(pathname==='/admin/levels'){res.writeHead(302,{Location:'/admin/levels.html'}).end();return}
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(root,'.'+pathname);const relative=path.relative(root,file);
    const allowed=/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(html|js|mjs|css|json)$/.test(relative)||/^(levels|vendor|admin)[\\/][a-zA-Z0-9._-]+$/.test(relative);
  if(!file.startsWith(root+path.sep)||!allowed||!types[path.extname(file)]){res.writeHead(404).end('Not found');return}
  let data;try{data=await fs.readFile(file)}catch{res.writeHead(404).end('Not found');return}
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){json(res,400,{error:e instanceof SyntaxError?'Некоректний JSON.':e.message})}
}).listen(port,'127.0.0.1',()=>console.log(`Game: http://localhost:${port}\nEditor: http://localhost:${port}/admin/`));
