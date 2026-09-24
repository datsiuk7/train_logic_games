// Original, procedurally composed nocturne. No audio downloads or autoplay.
export function setupMusic(button){
  let context,master,timer,isPlaying=false,index=0,nextTime=0,pending=false;
  const melody=[69,72,76,72,67,71,74,71,65,69,72,76,64,67,71,67,69,76,79,76,67,74,77,74,65,72,76,72,64,71,76,71];

  function note(midi,time,duration,volume){
    if(!context)return;
    try{
      const osc=context.createOscillator(),gain=context.createGain();
      osc.type='sine';
      osc.frequency.value=440*2**((midi-69)/12);
      gain.gain.setValueAtTime(0,time);
      gain.gain.linearRampToValueAtTime(volume,time+.04);
      gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(time);
      osc.stop(time+duration+.1);
      osc.onended=()=>{
        try{osc.disconnect();gain.disconnect()}catch{}
      };
    }catch{}
  }

  function schedule(){
    if(!context||!isPlaying)return;
    while(nextTime<context.currentTime+.3){
      note(melody[index%melody.length],nextTime,2,.12);
      if(index%4===0){
        const bass=[45,43,41,40][Math.floor(index/4)%4];
        note(bass,nextTime,3.8,.1);
        note(bass+7,nextTime,3.5,.045);
      }
      index++;
      nextTime+=.65;
    }
  }

  function savePreference(value){try{localStorage.setItem('lamplighter-music',String(value))}catch{}}

  function updateButton(){
    if(!button)return;
    button.textContent=(isPlaying||pending)?'♫ Музика: увімк.':'♫ Музика: вимк.';
    button.setAttribute('aria-pressed',String(isPlaying||pending));
  }

  async function start(){
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx){
        if(button)button.textContent='Музика недоступна';
        return;
      }
      if(!context){
        context=new AudioCtx();
        master=context.createGain();
        master.gain.value=.5;
        master.connect(context.destination);
      }
      if(context.state==='suspended'){
        context.resume().catch(()=>{});
      }
      nextTime=context.currentTime+.05;
      isPlaying=true;
      pending=false;
      schedule();
      clearInterval(timer);
      timer=setInterval(schedule,120);
      savePreference(true);
      updateButton();
    }catch(err){
      console.warn('AudioContext start error:',err);
      if(button)button.textContent='Музика недоступна';
    }
  }

  async function stop(){
    clearInterval(timer);
    pending=false;
    isPlaying=false;
    if(context&&context.state!=='closed'){
      try{await context.suspend()}catch{}
    }
    savePreference(false);
    updateButton();
  }

  function restore(){try{const v=localStorage.getItem('lamplighter-music');return v===null?true:v==='true'}catch{return true}}

  if(button){
    button.onclick=async()=>{
      if(isPlaying||pending){
        await stop();
      }else{
        await start();
      }
    };
  }

  if(restore()){
    pending=true;
    updateButton();
    const resume=async(e)=>{
      if(!pending)return;
      if(e?.target===button||button?.contains(e?.target))return;
      document.removeEventListener('pointerdown',resume);
      document.removeEventListener('keydown',resume);
      await start();
    };
    document.addEventListener('pointerdown',resume);
    document.addEventListener('keydown',resume);
  }else{
    isPlaying=false;
    pending=false;
    updateButton();
  }

  document.addEventListener('visibilitychange',()=>{
    if(!context||!isPlaying)return;
    if(document.hidden){
      clearInterval(timer);
      try{context.suspend()}catch{}
    }else{
      context.resume().then(()=>{
        if(!isPlaying)return;
        nextTime=context.currentTime+.1;
        schedule();
        clearInterval(timer);
        timer=setInterval(schedule,120);
      }).catch(()=>{});
    }
  });
}

export function setupEffects(button){
  let context, on = true;
  function savePreference(value){try{localStorage.setItem('lamplighter-sound',String(value))}catch{}}
  function restore(){try{const v=localStorage.getItem('lamplighter-sound');return v===null?true:v==='true'}catch{return true}}
  on = restore();
  function updateButton(){
    if(!button)return;
    button.textContent=on?'🔊 Звуки: увімк.':'🔊 Звуки: вимк.';
    button.setAttribute('aria-pressed',String(on));
  }
  updateButton();
  if(button){
    button.onclick=()=>{
      on=!on;
      savePreference(on);
      updateButton();
    };
  }
  function getContext(){
    if(!on)return null;
    try{
      context??=new AudioContext();
      if(context.state==='suspended')context.resume();
      return context;
    }catch{return null}
  }
  function tone(start,frequency,duration,volume,type='sine',endFrequency=frequency){
    if(!on)return;
    const audio=getContext();if(!audio)return;
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),start+duration);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+duration+.03);
  }
  return {
    step(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,180,.05,.08,'triangle',90)},
    turn(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,420,.035,.06,'sine',310)},
    jump(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,260,.14,.09,'sine',520);tone(now+.18,140,.06,.08,'triangle',70)},
    pickup(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,587,.09,.08,'sine',880);tone(now+.07,880,.12,.07,'sine',1175)},
    repair(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,320,.08,.1,'sawtooth',480);tone(now+.09,880,.18,.07,'sine',1320)},
    call(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,660,.06,.06,'sine',990)},
    spark(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,820,.04,.08,'sawtooth',140);tone(now+.03,1200,.03,.07,'sawtooth',220)},
    shock(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;
      for(const [index,frequency] of [1180,720,1320,640,960,510].entries()){
        tone(now+index*.075,frequency,.09,.105,'sawtooth',frequency*.22);
      }
      tone(now,145,.55,.09,'triangle',48);
      tone(now+.28,90,.22,.07,'sawtooth',35);
    },
    light(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,880,.16,.08,'sine',1320);tone(now+.07,1320,.2,.055,'sine',1760)},
    unscrew(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,650,.1,.09,'triangle',320);tone(now+.08,440,.14,.07,'sine',220);tone(now+.18,280,.18,.05,'sine',140)},
    fall(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;
      // Scream: high-pitched glide falling fast (cartoon "AAAAH!")
      tone(now,1100,.9,.13,'sine',180);
      tone(now,.05,.85,.11,'sine',160);
      tone(now+.02,1050,.88,.09,'triangle',170);
      // Air whoosh
      tone(now,.08,.7,.06,'sawtooth',55);
      // Thud on impact
      tone(now+.82,120,.22,.18,'sawtooth',28);
      tone(now+.82,60,.25,.14,'triangle',20);
    },
    win(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;[523,659,784,1047].forEach((frequency,index)=>tone(now+index*.12,frequency,.32,.09,'sine',frequency*1.04));tone(now+.48,1047,.65,.12,'sine',1319)},
    angry(){if(!on)return;const audio=getContext();if(!audio)return;const now=audio.currentTime;tone(now,260,.14,.11,'sawtooth',170);tone(now+.12,210,.16,.13,'sawtooth',130);tone(now+.26,160,.24,.15,'sawtooth',80)}
  };
}
