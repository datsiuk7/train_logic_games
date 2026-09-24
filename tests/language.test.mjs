import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialState,step,won,conditionValue,valueOf,validateProgram,createMemory,executeProgram,blockCount,commands} from '../logic.mjs';

const load=async()=>JSON.parse(await readFile(new URL('./fixtures/number-route.json',import.meta.url),'utf8'));
const sensor=(s,not=false)=>({kind:'sensor',sensor:s,not});
const condition=(...terms)=>({mode:'and',terms});
const number=value=>({kind:'number',value});

function run(l,program,functions=[]){
  validateProgram(l,program,functions);
  let state=initialState(l);
  const memory=createMemory();
  let checks=0;
  for(const b of executeProgram(l,program,functions,()=>state,memory)){
    if(!b.control)state=step(l,state,b.type);
    checks++;
  }
  return {state,memory,checks};
}

test('simplified if executes body when true and elseBody when false',async()=>{
  const l=await load();
  const pTrue=[{type:'if',condition:sensor('obstacleAhead',true),body:[{type:'forward'}],elseBody:[{type:'right'}]}];
  assert.equal(run(l,pTrue).state.z,2);
  const pFalse=[{type:'if',condition:sensor('onLamp'),body:[{type:'left'}],elseBody:[{type:'right'}]}];
  assert.equal(run(l,pFalse).state.dir,1);
});

test('while rechecks current state, if lights each visited lamp',async()=>{
  const l=await load();
  const p=[{
    type:'while',
    condition:condition(sensor('obstacleAhead',true)),
    body:[
      {type:'forward'},
      {type:'if',branches:[{condition:condition(sensor('onLamp'),sensor('lampLit',true)),body:[{type:'light'}]}]}
    ]
  }];
  assert.ok(won(l,run(l,p).state));
});

test('if / elif / else chooses exactly the first true branch',async()=>{
  const l=await load();
  const p=[{
    type:'if',
    branches:[
      {condition:condition(sensor('onLamp')),body:[{type:'left'}]},
      {condition:condition(sensor('obstacleAhead',true)),body:[{type:'forward'}]},
      {condition:condition(sensor('canJump')),body:[{type:'right'}]}
    ],
    elseBody:[{type:'right'}]
  }];
  assert.equal(run(l,p).state.z,2);
  assert.equal(run(l,p).state.dir,0);
  p[0].branches.forEach(b=>b.condition=condition(sensor('lampLit')));
  assert.equal(run(l,p).state.dir,1);
});

test('all six comparisons and and/or/not short circuit',async()=>{
  const l=await load(),s=initialState(l),m=createMemory();
  for(const [op,a,b,result] of [['==',2,2,true],['!=',2,3,true],['<',2,3,true],['<=',3,3,true],['>',3,2,true],['>=',3,3,true],['==',2,3,false]]){
    assert.equal(conditionValue(condition({kind:'compare',left:number(a),op,right:number(b)}),l,s,m),result);
  }
  assert.equal(conditionValue({mode:'or',terms:[sensor('obstacleAhead',true),{kind:'compare',left:number(1),op:'==',right:number(0)}]},l,s,m),true);
  assert.equal(conditionValue(condition(sensor('onLamp',true),sensor('obstacleAhead',true)),l,s,m),true);
});

test('functions run commands and recursive calls are rejected',async()=>{
  const l=await load(),functions=[{id:'f',body:[{type:'forward'},{type:'light'}]}],p=[{type:'loop',times:3,body:[{type:'call',functionId:'f'}]}];
  assert.ok(won(l,run(l,p,functions).state));
  functions[0].body=[{type:'call',functionId:'f'}];
  assert.throws(()=>validateProgram(l,p,functions),/сама себе/);
  assert.throws(()=>validateProgram(l,[{type:'call',functionId:'missing'}],[]),/Обери функцію/);
});

test('endless while is bounded even with control-only body',async()=>{
  const l=await load(),p=[{type:'while',condition:condition(sensor('lampLit',true)),body:[{type:'if',branches:[{condition:condition(sensor('onLamp')),body:[]}]}]}];
  assert.throws(()=>run(l,p),/while|1500/);
});

test('nested blocks and function bodies count towards limit; disabled commands rejected',async()=>{
  const l=await load();
  assert.equal(blockCount([{type:'if',branches:[{body:[{type:'forward'}]}],elseBody:[{type:'right'}]}]),3);
  l.limit=2;
  assert.throws(()=>validateProgram(l,[{type:'call',functionId:'f'}],[{id:'f',body:[{type:'forward'},{type:'light'}]}]),/Ліміт/);
  l.limit=0;
  l.allowed=['light'];
  assert.throws(()=>validateProgram(l,[{type:'while',body:[]}]),/недоступна/);
});
