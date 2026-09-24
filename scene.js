import * as THREE from './vendor/three.module.js';
import {key} from './logic.mjs';
export class World {
  constructor(host, level, state, theme = (state?.theme || 'dark')) {
    this.host = host;
    this.level = level;
    this.dead = false;
    this.angle = -state.dir * Math.PI / 2;
    this.theme = theme;
    this.speed = 1;

    const isLight = theme === 'light';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(isLight ? '#eef2f5' : '#14212b');

    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 120);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(isLight ? 0xeef2f5 : 0x14212b, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = isLight ? 1.15 : 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.append(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(
      isLight ? 0xffffff : 0xb4d9ff,
      isLight ? 0xe6eaed : 0x34303c,
      isLight ? 2.4 : 2.1
    ));

    const mainLight = new THREE.DirectionalLight(
      isLight ? 0xfffaed : 0xa8c9ff,
      isLight ? 2.2 : 2.3
    );
    mainLight.position.set(-6, isLight ? 13 : 12, isLight ? 6 : 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.radius = isLight ? 2.4 : 1.6;
    Object.assign(mainLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    mainLight.shadow.normalBias = 0.035;
    this.scene.add(mainLight);

    this.lamps = new Map();
    this.bulbs = new Map();
    this.kits = new Map();
    this.boxes = new Map();
    this.boxList = [];
    this.currentSparks = new Set();
    this.tiles = [];

    const mesh = (geometry, color, x, y, z, parent = this.scene) => {
      const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const box = (w, h, d, c, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, parent);
    this.mesh = mesh;
    for(let z=0;z<level.depth;z++)for(let x=0;x<level.width;x++){
      const c=level.cells[z][x];if(!c)continue;const px=x-(level.width-1)/2,pz=z-(level.depth-1)/2,y=c.height*.5;
      const isTarget=Boolean(c.lamp||c.house);
      const tile=box(.94,y+.22,.94,isTarget?'#52605a':c.height%2?'#405361':'#384d5b',px,(y-.22)/2,pz);tile.userData={x,z};this.tiles.push(tile);
      box(.88,.035,.88,isTarget?'#777051':'#536977',px,y+.012,pz);
      if(c.tree){box(.13,.55,.13,'#685549',px,y+.28,pz);mesh(new THREE.ConeGeometry(.42,.85,6),'#31574f',px,y+.8,pz);mesh(new THREE.ConeGeometry(.32,.65,6),'#3e6a5c',px,y+1.2,pz)}
      if(c.bush){
        const bg=new THREE.Group();bg.position.set(px,y,pz);
        // Woody base stem
        box(.07,.18,.07,'#4e3524',0,.09,0,bg);

        // Lush rounded foliage cloud tiers
        mesh(new THREE.SphereGeometry(.26,7,5),'#1d522f',0,.16,0,bg);
        mesh(new THREE.SphereGeometry(.28,8,6),'#2f7e44',0,.26,0,bg);
        mesh(new THREE.SphereGeometry(.22,7,6),'#388e4f',-.14,.23,.06,bg);
        mesh(new THREE.SphereGeometry(.21,7,6),'#388e4f',.14,.22,-.04,bg);
        mesh(new THREE.SphereGeometry(.19,7,6),'#44a05d',.02,.20,.14,bg);
        mesh(new THREE.SphereGeometry(.21,7,6),'#53b86e',-.02,.38,-.02,bg);

        // Cute stylized blooming flowers with golden centers
        const flowerMat=new THREE.MeshStandardMaterial({color:'#fff5f7',roughness:.5});
        const coreMat=new THREE.MeshStandardMaterial({color:'#ffb300',emissive:'#ff8f00',emissiveIntensity:.4});
        const petalGeo=new THREE.SphereGeometry(.026,5,4);
        const coreGeo=new THREE.SphereGeometry(.024,5,4);

        const addFlower=(fx,fy,fz,rx,ry,rz)=>{
          const fl=new THREE.Group();
          fl.position.set(fx,fy,fz);
          fl.rotation.set(rx,ry,rz);
          for(let i=0;i<4;i++){
            const p=new THREE.Mesh(petalGeo,flowerMat);
            const ang=i*Math.PI/2;
            p.position.set(Math.cos(ang)*.032,Math.sin(ang)*.032,0);
            fl.add(p);
          }
          const core=new THREE.Mesh(coreGeo,coreMat);
          core.position.set(0,0,.012);
          fl.add(core);
          bg.add(fl);
        };

        addFlower(-.12,.38,.16,.3,-.4,.1);
        addFlower(.14,.35,.12,.4,.5,-.2);
        addFlower(-.02,.48,.05,.8,0,.3);
        addFlower(.18,.28,-.10,-.3,.8,-.2);

        this.scene.add(bg);
      }
      if(c.rock){
        const rg=new THREE.Group();rg.position.set(px,y,pz);

        // Ground contact shadow & bed stone
        const bed=mesh(new THREE.DodecahedronGeometry(.36,0),'#2c3940',0,.1,0,rg);
        bed.scale.set(1.2,.35,1.25);

        // Main primary boulder: chiseled facets, majestic form
        const rockMain=mesh(new THREE.DodecahedronGeometry(.35,0),'#5d727e',-.02,.27,.02,rg);
        rockMain.scale.set(1.15,.95,1.1);
        rockMain.rotation.set(.25,.4,.15);

        // Side companion rock
        const rockSide=mesh(new THREE.DodecahedronGeometry(.24,0),'#4a5b65',.22,.18,.13,rg);
        rockSide.scale.set(.9,.8,1.05);
        rockSide.rotation.set(.4,-.3,.2);

        // Back crag facet
        const rockBack=mesh(new THREE.DodecahedronGeometry(.22,0),'#3d4c54',-.18,.17,-.15,rg);
        rockBack.scale.set(1,.75,.9);
        rockBack.rotation.set(-.3,.5,-.2);

        // Two small accent pebbles at the base
        const p1=mesh(new THREE.DodecahedronGeometry(.1,0),'#6f8390',.28,.06,-.18,rg);
        p1.scale.set(1.1,.6,.9);
        p1.rotation.set(.2,.8,0);
        const p2=mesh(new THREE.DodecahedronGeometry(.08,0),'#546570',-.24,.05,.22,rg);
        p2.scale.set(.9,.5,1.2);

        // Lush green velvet moss on top of the boulder!
        const moss1=mesh(new THREE.DodecahedronGeometry(.22,0),'#438b4d',-.04,.45,.04,rg);
        moss1.scale.set(1.1,.25,1.05);
        moss1.rotation.set(.2,.4,.15);

        const moss2=mesh(new THREE.DodecahedronGeometry(.14,0),'#5ca366',.06,.47,-.02,rg);
        moss2.scale.set(1,.22,.9);
        moss2.rotation.set(.1,.6,-.1);

        const mossTuft=mesh(new THREE.DodecahedronGeometry(.08,1),'#6dbb77',-.12,.44,.12,rg);
        mossTuft.scale.set(1.2,.4,1.1);

        this.scene.add(rg);
      }
      if(c.box){
        const boxGroup=new THREE.Group();boxGroup.position.set(px,y,pz);
        // Main wooden body
        box(.68,.46,.68,'#a57444',0,.24,0,boxGroup);

        // 4 Vertical corner posts (darker wood)
        const cpCol='#684221';
        box(.08,.48,.08,cpCol,-.31,.24,-.31,boxGroup);
        box(.08,.48,.08,cpCol,.31,.24,-.31,boxGroup);
        box(.08,.48,.08,cpCol,-.31,.24,.31,boxGroup);
        box(.08,.48,.08,cpCol,.31,.24,.31,boxGroup);

        // Top rim frame & Bottom rim frame
        box(.72,.05,.08,cpCol,0,.455,.31,boxGroup);
        box(.72,.05,.08,cpCol,0,.455,-.31,boxGroup);
        box(.08,.05,.56,cpCol,.31,.455,0,boxGroup);
        box(.08,.05,.56,cpCol,-.31,.455,0,boxGroup);

        box(.72,.05,.08,cpCol,0,.025,.31,boxGroup);
        box(.72,.05,.08,cpCol,0,.025,-.31,boxGroup);
        box(.08,.05,.56,cpCol,.31,.025,0,boxGroup);
        box(.08,.05,.56,cpCol,-.31,.025,0,boxGroup);

        // Top lid wooden planks
        box(.54,.02,.14,'#b68350',0,.47,-.18,boxGroup);
        box(.54,.02,.14,'#aa7746',0,.47,0,boxGroup);
        box(.54,.02,.14,'#b68350',0,.47,.18,boxGroup);
        box(.54,.015,.02,'#593516',0,.475,-.09,boxGroup);
        box(.54,.015,.02,'#593516',0,.475,.09,boxGroup);

        // Diagonal "X" cross-slats on the 4 sides!
        const strutCol='#7d4f26';
        // Front face (Z = +0.342)
        const xF1=box(.48,.045,.02,strutCol,0,.24,.342,boxGroup);xF1.rotation.z=Math.PI/4;
        const xF2=box(.48,.045,.02,strutCol,0,.24,.342,boxGroup);xF2.rotation.z=-Math.PI/4;
        // Back face (Z = -0.342)
        const xB1=box(.48,.045,.02,strutCol,0,.24,-.342,boxGroup);xB1.rotation.z=Math.PI/4;
        const xB2=box(.48,.045,.02,strutCol,0,.24,-.342,boxGroup);xB2.rotation.z=-Math.PI/4;
        // Right face (X = +0.342)
        const xR1=box(.02,.045,.48,strutCol,.342,.24,0,boxGroup);xR1.rotation.x=Math.PI/4;
        const xR2=box(.02,.045,.48,strutCol,.342,.24,0,boxGroup);xR2.rotation.x=-Math.PI/4;
        // Left face (X = -0.342)
        const xL1=box(.02,.045,.48,strutCol,-.342,.24,0,boxGroup);xL1.rotation.x=Math.PI/4;
        const xL2=box(.02,.045,.48,strutCol,-.342,.24,0,boxGroup);xL2.rotation.x=-Math.PI/4;

        // Metal corner reinforcements & rivet bolts at the 8 vertices!
        const ironCol='#2d3840';
        box(.09,.05,.09,ironCol,-.315,.46,-.315,boxGroup);
        box(.09,.05,.09,ironCol,.315,.46,-.315,boxGroup);
        box(.09,.05,.09,ironCol,-.315,.46,.315,boxGroup);
        box(.09,.05,.09,ironCol,.315,.46,.315,boxGroup);
        box(.09,.05,.09,ironCol,-.315,.025,-.315,boxGroup);
        box(.09,.05,.09,ironCol,.315,.025,-.315,boxGroup);
        box(.09,.05,.09,ironCol,-.315,.025,.315,boxGroup);
        box(.09,.05,.09,ironCol,.315,.025,.315,boxGroup);

        // Center bronze rivets / studs on corners
        const studCol='#cfa258';
        box(.025,.025,.025,studCol,-.33,.46,.33,boxGroup);
        box(.025,.025,.025,studCol,.33,.46,.33,boxGroup);
        box(.025,.025,.025,studCol,-.33,.46,-.33,boxGroup);
        box(.025,.025,.025,studCol,.33,.46,-.33,boxGroup);

        this.scene.add(boxGroup);
        this.boxes.set(key(x,z),boxGroup);
        this.boxList.push(boxGroup);
      }
      if(c.bulb){
        const bg=new THREE.Group();bg.position.set(px,y+.28,pz);bg.userData={baseY:y+.28};
        box(.09,.08,.09,'#90a4ae',0,-.06,0,bg);
        const bulbSphere=mesh(new THREE.SphereGeometry(0.12,10,10),'#ffe57f',0,.06,0,bg);
        bulbSphere.material.emissive=new THREE.Color('#ffb300');
        bulbSphere.material.emissiveIntensity=0.9;
        this.scene.add(bg);this.bulbs.set(key(x,z),bg);
      }
      if(c.kit){
        const kg=new THREE.Group();kg.position.set(px,y+.12,pz);kg.userData={baseY:y+.12};
        box(.24,.14,.16,'#c62828',0,0,0,kg);
        box(.25,.03,.06,'#cfd8dc',0,.01,0,kg);
        box(.09,.05,.03,'#37474f',0,.09,0,kg);
        box(.06,.02,.01,'#ffffff',0,0,.082,kg);
        box(.02,.06,.01,'#ffffff',0,0,.082,kg);
        this.scene.add(kg);this.kits.set(key(x,z),kg);
      }
      if(c.lamp){const lx=px+.3,lz=pz-.29;box(.17,.09,.17,'#27363d',lx,y+.045,lz);box(.055,.9,.055,'#283a43',lx,y+.5,lz);box(.25,.045,.25,'#293b43',lx,y+1,lz);const bulb=box(.16,.23,.16,'#738481',lx,y+1.13,lz);mesh(new THREE.ConeGeometry(.2,.15,4),'#30424b',lx,y+1.3,lz);const glow=new THREE.PointLight(0xffc46c,0,2.6,1.6);glow.position.set(lx,y+1.14,lz);this.scene.add(glow);this.lamps.set(key(x,z),{bulb,glow,needsBulb:Boolean(c.needsBulb)})}
      if(c.house){
        const hDir=Number.isInteger(c.dir)?c.dir:2;
        const houseGroup=new THREE.Group();
        houseGroup.position.set(px,y,pz);
        const rotMap={2:0,1:Math.PI/2,0:Math.PI,3:-Math.PI/2};
        houseGroup.rotation.y=rotMap[hDir]??0;
        this.scene.add(houseGroup);

        // Foundation & Doorstep
        box(.92,.04,.92,'#36444d',0,.02,0,houseGroup);
        box(.44,.03,.14,'#546570',0,.015,.44,houseGroup);
        box(.76,.02,.76,'#8a6547',0,.04,0,houseGroup);

        // Timber Corner Posts
        box(.08,.60,.08,'#543825',-.38,.33,-.37,houseGroup);
        box(.08,.60,.08,'#543825',.38,.33,-.37,houseGroup);
        box(.08,.60,.08,'#543825',-.38,.33,.37,houseGroup);
        box(.08,.60,.08,'#543825',.38,.33,.37,houseGroup);

        // Walls
        box(.76,.56,.06,'#916e4f',0,.33,-.37,houseGroup);
        box(.06,.56,.74,'#8b684a',-.38,.33,0,houseGroup);
        box(.06,.56,.74,'#8b684a',.38,.33,0,houseGroup);
        box(.20,.56,.06,'#916e4f',-.28,.33,.37,houseGroup);
        box(.20,.56,.06,'#916e4f',.28,.33,.37,houseGroup);

        // Doorframe, Door Ajar & Brass Handle
        box(.04,.52,.08,'#4a301e',-.19,.31,.37,houseGroup);
        box(.04,.52,.08,'#4a301e',.19,.31,.37,houseGroup);
        box(.42,.12,.08,'#543825',0,.57,.37,houseGroup);
        box(.46,.03,.10,'#422919',0,.64,.37,houseGroup);
        const door=box(.03,.48,.30,'#6d4428',-.13,.29,.26,houseGroup);door.rotation.y=-Math.PI/6;
        const handle=box(.02,.05,.03,'#f5c542',-.09,.29,.30,houseGroup);handle.rotation.y=-Math.PI/6;

        // Windows & Shutters
        box(.24,.03,.07,'#543825',0,.32,-.39,houseGroup);
        box(.24,.03,.07,'#543825',0,.52,-.39,houseGroup);
        const backWin=box(.20,.18,.03,'#2d3e48',0,.42,-.39,houseGroup);
        box(.02,.18,.04,'#543825',0,.42,-.395,houseGroup);
        box(.20,.02,.04,'#543825',0,.42,-.395,houseGroup);
        box(.07,.20,.03,'#7d3427',-.135,.42,-.39,houseGroup);
        box(.07,.20,.03,'#7d3427',.135,.42,-.39,houseGroup);

        // Side window & flower planter box
        box(.07,.03,.24,'#543825',.40,.30,0,houseGroup);
        const sideWin=box(.03,.18,.20,'#2d3e48',.40,.40,0,houseGroup);
        box(.04,.18,.02,'#543825',.405,.40,0,houseGroup);
        box(.04,.02,.20,'#543825',.405,.40,0,houseGroup);
        box(.08,.08,.24,'#5c3c26',.42,.25,0,houseGroup);
        box(.09,.06,.22,'#325e3c',.42,.30,0,houseGroup);
        box(.03,.04,.04,'#ff6080',.44,.33,-.06,houseGroup);
        box(.03,.04,.04,'#ffd043',.44,.33,.01,houseGroup);
        box(.03,.04,.04,'#ff6080',.44,.33,.07,houseGroup);

        // Opposite window with shutters
        box(.07,.03,.20,'#543825',-.40,.32,0,houseGroup);
        const leftWin=box(.03,.16,.16,'#2d3e48',-.40,.42,0,houseGroup);
        box(.04,.16,.02,'#543825',-.405,.42,0,houseGroup);
        box(.04,.02,.16,'#543825',-.405,.42,0,houseGroup);
        box(.06,.18,.025,'#7d3427',-.405,.42,-.11,houseGroup);
        box(.06,.18,.025,'#7d3427',-.405,.42,.11,houseGroup);

        // Gables & Terracotta Roof
        box(.46,.20,.05,'#85684f',0,.69,-.37,houseGroup);
        box(.10,.10,.06,'#4e3220',0,.70,-.39,houseGroup);
        box(.46,.18,.05,'#85684f',0,.71,.37,houseGroup);
        box(.11,.11,.06,'#4e3220',0,.72,.39,houseGroup);
        const atticWin=box(.07,.07,.07,'#2d3e48',0,.72,.395,houseGroup);

        const roofL=box(.54,.06,.96,'#b84d39',-.22,.76,0,houseGroup);roofL.rotation.z=Math.PI/6;
        const roofR=box(.54,.06,.96,'#b84d39',.22,.76,0,houseGroup);roofR.rotation.z=-Math.PI/6;
        const trimL=box(.03,.07,.98,'#853022',-.45,.63,0,houseGroup);trimL.rotation.z=Math.PI/6;
        const trimR=box(.03,.07,.98,'#853022',.45,.63,0,houseGroup);trimR.rotation.z=-Math.PI/6;
        box(.09,.08,.98,'#853022',0,.89,0,houseGroup);

        // Stone Chimney Stack & Smoke Puffs
        box(.14,.55,.14,'#6b362d',.22,.55,-.38,houseGroup);
        box(.14,.38,.14,'#783c33',.22,.94,-.18,houseGroup);
        box(.18,.04,.18,'#422621',.22,1.13,-.18,houseGroup);
        box(.08,.06,.08,'#592f28',.22,1.17,-.18,houseGroup);
        box(.07,.07,.07,'#eef2f5',.23,1.24,-.18,houseGroup);
        box(.09,.09,.09,'#f7fafc',.25,1.33,-.15,houseGroup);
        box(.08,.08,.08,'#ffffff',.24,1.42,-.13,houseGroup);

        // Interior Hanging Lantern
        box(.02,.12,.02,'#28343b',0,.72,0,houseGroup);
        box(.12,.03,.12,'#232c32',0,.65,0,houseGroup);
        box(.10,.09,.10,'#2e3940',0,.59,0,houseGroup);
        const bulb=box(.07,.07,.07,'#738481',0,.59,0,houseGroup);
        const glow=new THREE.PointLight(0xffbe58,0,3.5,1.7);
        glow.position.set(0,.56,0);
        houseGroup.add(glow);

        // Porch Lantern above Door
        box(.02,.07,.03,'#28343b',0,.70,.40,houseGroup);
        box(.02,.02,.07,'#28343b',0,.73,.42,houseGroup);
        const porchBulb=box(.05,.06,.05,'#738481',0,.63,.44,houseGroup);
        box(.08,.02,.08,'#1c252a',0,.67,.44,houseGroup);
        box(.04,.02,.04,'#1c252a',0,.685,.44,houseGroup);

        this.lamps.set(key(x,z),{bulb,windows:[backWin,sideWin,leftWin,atticWin,porchBulb],glow,isHouse:true});
      }
    }
    const robot=new THREE.Group();this.robot=robot;this.scene.add(robot);
    box(.32,.34,.26,'#bf945c',0,.35,0,robot);box(.25,.22,.24,'#efcfa4',0,.64,0,robot);
    this.hat=new THREE.Group();this.hat.position.set(0,.77,0);robot.add(this.hat);
    box(.38,.055,.35,'#2b3944',0,0,0,this.hat);box(.25,.13,.25,'#344655',0,.08,0,this.hat);
    box(.2,.075,.02,'#394749',0,.65,-.13,robot);box(.045,.025,.015,'#f8e5b7',-.055,.66,-.145,robot);box(.045,.025,.015,'#f8e5b7',.055,.66,-.145,robot);this.leftLeg=box(.1,.15,.17,'#283744',-.09,.1,0,robot);this.rightLeg=box(.1,.15,.17,'#283744',.09,.1,0,robot);this.leftArm=box(.08,.26,.11,'#9e7b51',-.22,.36,0,robot);this.arm=box(.08,.26,.11,'#9e7b51',.22,.36,0,robot);
    const alertCanvas=document.createElement('canvas');alertCanvas.width=128;alertCanvas.height=128;
    const actx=alertCanvas.getContext('2d');
    actx.shadowColor='rgba(235,30,60,.75)';actx.shadowBlur=14;
    actx.fillStyle='#eb2441';
    actx.beginPath();if(actx.roundRect)actx.roundRect(22,14,84,66,18);else actx.rect(22,14,84,66);actx.fill();
    actx.beginPath();actx.moveTo(52,78);actx.lineTo(64,102);actx.lineTo(76,78);actx.closePath();actx.fill();
    actx.shadowBlur=0;actx.lineWidth=4;actx.strokeStyle='#ffffff';actx.stroke();
    actx.fillStyle='#ffffff';actx.font='900 44px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    actx.textAlign='center';actx.textBaseline='middle';actx.fillText('‼',64,47);
    const alertTex=new THREE.CanvasTexture(alertCanvas);
    this.alertSign=new THREE.Sprite(new THREE.SpriteMaterial({map:alertTex,transparent:true,depthTest:false}));
    this.alertSign.scale.set(0,0,1);this.alertSign.position.set(0,1.42,0);this.alertSign.visible=false;
    robot.add(this.alertSign);
    this.setState(state);
    this.bounds=new THREE.Box3().setFromObject(this.scene);
    this.bounds.max.y=Math.max(this.bounds.max.y,Math.max(...level.cells.flat().filter(Boolean).map(c=>c.height))*.5+1.5);
    this.zoom=1;this.orbit=.28;this.initialOrbit=this.orbit;this.tilt=Math.atan2(11,Math.hypot(9,13));this.initialTilt=this.tilt;this.panX=0;this.panY=0;this.target=this.bounds.getCenter(new THREE.Vector3());this.setView=()=>{const distance=Math.hypot(9,13),offset=new THREE.Vector3(Math.sin(this.orbit)*Math.cos(this.tilt)*distance,Math.sin(this.tilt)*distance,Math.cos(this.orbit)*Math.cos(this.tilt)*distance);this.camera.position.copy(this.target).add(offset);this.camera.lookAt(this.target)};this.setView();
    this.resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.updateMatrixWorld(true);const points=[];for(const x of [this.bounds.min.x,this.bounds.max.x])for(const y of [this.bounds.min.y,this.bounds.max.y])for(const z of [this.bounds.min.z,this.bounds.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),cx=(minX+maxX)/2+this.panX,cy=(minY+maxY)/2+this.panY,aspect=w/h,height=Math.max(maxY-minY+.8,(maxX-minX+.8)/aspect)/this.zoom;Object.assign(this.camera,{left:cx-height*aspect/2,right:cx+height*aspect/2,top:cy+height/2,bottom:cy-height/2});this.camera.updateProjectionMatrix()};
    this.pointer=null;this.onPointerDown=e=>{if((e.button!==0&&e.button!==2)||e.target.closest('.scene-tools'))return;e.preventDefault();try{window.getSelection()?.removeAllRanges()}catch{}this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,mode:e.button===2?'rotate':'pan'};host.setPointerCapture(e.pointerId)};this.onPointerMove=e=>{if(!this.pointer||e.pointerId!==this.pointer.id)return;const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;if(this.pointer.mode==='rotate'){this.orbit-=dx*.01;this.tilt=Math.max(-1.35,Math.min(1.35,this.tilt+dy*.01));this.setView();this.resize()}else{const scale=(this.camera.right-this.camera.left)/host.clientWidth;this.panX-=dx*scale;this.panY+=dy*scale;this.resize()}this.pointer.x=e.clientX;this.pointer.y=e.clientY};this.onPointerEnd=e=>{if(this.pointer?.id===e.pointerId){this.pointer=null;if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId)}};this.onWheel=e=>{if(e.target.closest('.scene-tools'))return;e.preventDefault();this.setZoom(this.zoom+(e.deltaY<0?.1:-.1))};this.onContextMenu=e=>e.preventDefault();host.addEventListener('pointerdown',this.onPointerDown);host.addEventListener('pointermove',this.onPointerMove);host.addEventListener('pointerup',this.onPointerEnd);host.addEventListener('pointercancel',this.onPointerEnd);host.addEventListener('wheel',this.onWheel,{passive:false});host.addEventListener('contextmenu',this.onContextMenu);
    this.observer=new ResizeObserver(this.resize);this.observer.observe(host);this.setState(state);this.resize();
    this.renderer.setAnimationLoop((time)=>{
      const t=(time||performance.now())*0.003;
      if(this.bulbs){
        for(const [,bg] of this.bulbs){
          if(bg.visible&&!bg.userData.pickingUp){
            bg.rotation.y=t*1.5;
            bg.position.y=bg.userData.baseY+Math.sin(t*3)*0.04;
          }
        }
      }
      if(this.kits){
        for(const [,kg] of this.kits){
          if(kg.visible&&!kg.userData.pickingUp){
            kg.rotation.y=t*1.2;
            kg.position.y=kg.userData.baseY+Math.sin(t*2.5+1)*0.03;
          }
        }
      }
      if(this.currentSparks&&this.currentSparks.size>0){
        for(const id of this.currentSparks){
          const item=this.lamps.get(id);
          if(item){
            const sparkOn=Math.random()>0.65;
            const flicker=sparkOn?(0.6+Math.random()*2.2):0.05;
            if(item.bulb){
              item.bulb.material.color.set(sparkOn?'#ffe082':'#2b3338');
              item.bulb.material.emissive.set(sparkOn?(Math.random()>0.5?'#64b5f6':'#ffb74d'):'#000000');
              item.bulb.material.emissiveIntensity=sparkOn?2.5:0;
            }
            if(item.glow){
              item.glow.intensity=flicker;
              item.glow.color.set(Math.random()>0.4?0x82b1ff:0xffc46c);
            }
          }
        }
      }
      this.renderer.render(this.scene,this.camera);
    });
  }
  position(s){
    const h = ((this.level.cells[s.z]?.[s.x]?.height ?? 0) * 0.5) + (s.onBox ? 0.5 : 0) + 0.03;
    return new THREE.Vector3(s.x-(this.level.width-1)/2, h, s.z-(this.level.depth-1)/2);
  }
  lights(s){
    const isLight=s.theme==='light'||this.theme==='light';
    this.currentSparks=new Set(s.sparks||[]);
    if(this.bulbs){
      for(const [id,bg] of this.bulbs){
        bg.visible=Boolean(s.bulbs?s.bulbs.includes(id):true);
      }
    }
    if(this.kits){
      for(const [id,kg] of this.kits){
        kg.visible=Boolean(s.kits?s.kits.includes(id):true);
      }
    }
    for(const [id,item] of this.lamps){
      const {bulb,glow,windows,isHouse,needsBulb}=item;
      glow.color.set(isHouse?0xffbe58:0xffc46c);
      const isFitted=!needsBulb||Boolean(s.fittedLamps?.includes(id));
      const on=Boolean(isFitted&&(s.lit?s.lit.includes(id):!s.unscrewed?.includes(id)));
      if(!isFitted){
        if(bulb){
          bulb.scale.set(0.45,0.2,0.45);
          bulb.material.color.set('#202930');
          bulb.material.emissive.set('#000000');
          bulb.material.emissiveIntensity=0;
        }
        glow.intensity=0;
      }else{
        if(bulb)bulb.scale.set(1,1,1);
        if(isLight){
          if(bulb){
            bulb.material.color.set(on?'#ffe199':'#4d5a62');
            bulb.material.emissive.set(on?'#ffa834':'#000000');
            bulb.material.emissiveIntensity=on?1.7:0;
          }
          if(windows){
            for(const win of windows){
              win.material.color.set(on?'#ffea9f':'#34444e');
              win.material.emissive.set(on?'#ffa834':'#000000');
              win.material.emissiveIntensity=on?1.8:0;
            }
          }
          glow.intensity=on?1.8:0;
        }else{
          if(bulb){
            bulb.material.color.set(on?'#ffdc92':'#738481');
            bulb.material.emissive.set(on?'#ffc064':'#000000');
            bulb.material.emissiveIntensity=on?2:0;
          }
          if(windows){
            for(const win of windows){
              win.material.color.set(on?'#ffe58f':'#2d3e48');
              win.material.emissive.set(on?'#ff9900':'#000000');
              win.material.emissiveIntensity=on?2.2:0;
            }
          }
          glow.intensity=on?2.2:0;
        }
      }
    }
  }
  resetFrustratedState(baseY=null){
    if(baseY!=null)this.robot.position.y=baseY;
    this.robot.rotation.z=0;
    this.leftLeg.rotation.x=0;this.rightLeg.rotation.x=0;
    this.leftLeg.rotation.z=0;this.rightLeg.rotation.z=0;
    this.leftArm.rotation.x=0;this.leftArm.rotation.z=0;
    this.arm.rotation.x=0;this.arm.rotation.z=0;
    if(this.hat){this.hat.position.set(0,.77,0);this.hat.rotation.set(0,0,0)}
    if(this.alertSign){this.alertSign.visible=false;this.alertSign.scale.set(0,0,1);this.alertSign.position.set(0,1.42,0)}
  }
  setState(s){
    this.resetFrustratedState();
    this.angle=-s.dir*Math.PI/2;
    this.robot.position.copy(this.position(s));
    this.robot.rotation.set(0,this.angle,0);
    this.lights(s);
    if(this.boxList?.length && s.boxes){
      this.boxes.clear();
      for(let i=0; i<this.boxList.length; i++){
        const bg = this.boxList[i];
        const k = s.boxes[i];
        if(!k) continue;
        const [bx, bz] = k.split(',').map(Number);
        const bpx = bx - (this.level.width - 1) / 2;
        const bpz = bz - (this.level.depth - 1) / 2;
        const by = (this.level.cells[bz]?.[bx]?.height ?? 0) * 0.5;
        bg.position.set(bpx, by, bpz);
        this.boxes.set(k, bg);
      }
    }
  }
  createPickupEffect(next){
    const id=key(next.x,next.z);
    const bulb=this.bulbs.get(id);
    const kit=this.kits.get(id);
    const item=bulb?.visible&&!next.bulbs?.includes(id)?bulb:
      kit?.visible&&!next.kits?.includes(id)?kit:null;
    if(!item)return null;

    const start=item.position.clone(),startScale=item.scale.clone(),startRotation=item.rotation.clone();
    const color=item===bulb?0xffdf75:0x9cf4d3;
    const geometry=new THREE.SphereGeometry(.045,6,4);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false});
    const sparkles=new THREE.Group();
    for(let i=0;i<7;i++)sparkles.add(new THREE.Mesh(geometry,material));
    const glow=new THREE.PointLight(color,0,1.8,1.5);
    this.scene.add(sparkles,glow);
    item.userData.pickingUp=true;

    return {
      frame:(t)=>{
        const p=Math.max(0,Math.min(1,(t-.2)/.5));
        const ease=p*p*(3-2*p);
        const hand=this.robot.localToWorld(new THREE.Vector3(.27,.37,.04));
        item.position.lerpVectors(start,hand,ease);
        item.position.y+=Math.sin(Math.PI*p)*.24;
        item.rotation.y=startRotation.y+t*Math.PI*3;
        let shrink=0;
        if(t>.7){
          shrink=Math.min(1,(t-.7)/.3);
          const pocket=this.robot.localToWorld(new THREE.Vector3(0,.45,.06));
          item.position.lerp(pocket,shrink);
        }
        item.scale.copy(startScale).multiplyScalar((1-shrink)*(1+.15*Math.sin(Math.PI*t)));
        sparkles.position.copy(item.position);
        material.opacity=Math.sin(Math.PI*t)*.9;
        sparkles.children.forEach((particle,i)=>{
          const angle=i*Math.PI*2/7+t*Math.PI*4;
          const radius=.09+.14*t;
          particle.position.set(Math.cos(angle)*radius,.04+Math.sin(t*Math.PI)*.12+i*.015,Math.sin(angle)*radius);
        });
        glow.position.copy(item.position);
        glow.intensity=Math.sin(Math.PI*t)*1.6;
      },
      cleanup:()=>{
        item.position.copy(start);
        item.scale.copy(startScale);
        item.rotation.copy(startRotation);
        delete item.userData.pickingUp;
        this.scene.remove(sparkles,glow);
        geometry.dispose();material.dispose();glow.dispose();
      }
    };
  }
  async animate(next,command,cancelled){
    const from=this.robot.position.clone(),to=this.position(next),old=this.angle;
    this.angle+=command==='left'?Math.PI/2:command==='right'?-Math.PI/2:0;
    const end=this.angle,duration=(matchMedia('(prefers-reduced-motion: reduce)').matches?100:command==='light'?550:command==='fix'?600:command==='take'?850:460)/this.speed;
    const pickup=command==='take'?this.createPickupEffect(next):null;

    const pushed = next.pushedBox;
    let boxMesh = null;
    let fromBoxPos = null;
    let toBoxPos = null;
    if (pushed) {
      boxMesh = this.boxes.get(key(pushed.from.x, pushed.from.z));
      const fromY = (this.level.cells[pushed.from.z]?.[pushed.from.x]?.height ?? 0) * 0.5;
      const toY = (this.level.cells[pushed.to.z]?.[pushed.to.x]?.height ?? 0) * 0.5;
      fromBoxPos = new THREE.Vector3(
        pushed.from.x - (this.level.width - 1) / 2,
        fromY,
        pushed.from.z - (this.level.depth - 1) / 2
      );
      toBoxPos = new THREE.Vector3(
        pushed.to.x - (this.level.width - 1) / 2,
        toY,
        pushed.to.z - (this.level.depth - 1) / 2
      );
    }

    return new Promise(resolve=>{
      const start=performance.now();
      const tick=now=>{
        if(this.dead||cancelled()){pickup?.cleanup();resolve(false);return}
        const t=Math.min((now-start)/duration,1),ease=t*t*(3-2*t),moving=command==='forward'||command==='jump';
        this.robot.position.lerpVectors(from,to,ease);
        if(command==='jump')this.robot.position.y+=Math.sin(Math.PI*t)*.55;
        if(boxMesh && fromBoxPos && toBoxPos){
          boxMesh.position.lerpVectors(fromBoxPos, toBoxPos, ease);
        }
        if(moving){
          const walk=Math.sin(Math.PI*t);
          this.robot.position.y+=walk*(command==='jump'?.02:.055);
          this.robot.rotation.z=walk*.045;
          if(command==='forward' && pushed){
            this.leftArm.rotation.x=-0.85+walk*.12;
            this.arm.rotation.x=-0.85-walk*.12;
          }else{
            this.leftArm.rotation.x=-walk*.42;
            this.arm.rotation.x=walk*.42;
          }
          this.leftLeg.rotation.x=walk*.65;
          this.rightLeg.rotation.x=-walk*.65;
        }
        this.robot.rotation.y=old+(end-old)*ease;
        if(command==='light')this.arm.rotation.x=-Math.sin(Math.PI*t)*2;
        if(command==='take'){
          const crouch=t<.8?Math.sin(Math.PI*t/.8):0;
          this.robot.position.y=from.y-crouch*.12;
          this.leftLeg.rotation.x=-crouch*.35;
          this.rightLeg.rotation.x=-crouch*.35;
          this.leftLeg.rotation.z=-crouch*.12;
          this.rightLeg.rotation.z=crouch*.12;
          this.leftArm.rotation.x=-crouch*.55;
          this.leftArm.rotation.z=crouch*.1;
          this.arm.rotation.x=-crouch*1.5;
          this.arm.rotation.z=-crouch*.2;
          this.hat.position.y=.77-crouch*.025;
          pickup?.frame(t);
        }
        if(command==='fix'){
          const wrench=Math.sin(t*Math.PI*6);
          this.arm.rotation.x=-1.2+wrench*.7;
          this.arm.rotation.z=-.3+wrench*.3;
          this.leftArm.rotation.x=-.5;
          this.robot.rotation.z=wrench*.05;
        }
        if(t<1)requestAnimationFrame(tick);
        else{
          if(boxMesh && toBoxPos && pushed){
            boxMesh.position.copy(toBoxPos);
            this.boxes.delete(key(pushed.from.x, pushed.from.z));
            this.boxes.set(key(pushed.to.x, pushed.to.z), boxMesh);
          }
          this.robot.rotation.z=0;
          this.robot.rotation.x=0;
          this.leftLeg.rotation.x=0;
          this.rightLeg.rotation.x=0;
          this.leftLeg.rotation.z=0;
          this.rightLeg.rotation.z=0;
          this.leftArm.rotation.x=0;
          this.leftArm.rotation.z=0;
          this.arm.rotation.x=0;
          this.arm.rotation.z=0;
          this.hat.position.y=.77;
          pickup?.cleanup();
          this.lights(next);
          resolve(true);
        }
      };
      requestAnimationFrame(tick);
    });
  }
  async celebrate(cancelled){return new Promise(resolve=>{const start=performance.now(),duration=1400,base=this.robot.position.y;const tick=now=>{if(this.dead||cancelled()){resolve(false);return}const t=Math.min((now-start)/duration,1),wave=Math.sin(t*Math.PI*6),bounce=Math.abs(Math.sin(t*Math.PI*3));this.robot.position.y=base+bounce*.12;this.robot.rotation.z=wave*.08;this.leftArm.rotation.z=wave*.8;this.arm.rotation.z=-wave*.8;this.leftLeg.rotation.x=-wave*.25;this.rightLeg.rotation.x=wave*.25;if(t<1)requestAnimationFrame(tick);else{this.robot.position.y=base;this.robot.rotation.z=0;this.leftArm.rotation.z=0;this.arm.rotation.z=0;this.leftLeg.rotation.x=0;this.rightLeg.rotation.x=0;resolve(true)}};requestAnimationFrame(tick)})}
  async shocked(cancelled){
    const base=this.robot.position.clone();
    const flash=new THREE.PointLight(0x8ad8ff,0,3,1.5);
    flash.position.copy(base).add(new THREE.Vector3(0,.6,0));
    this.scene.add(flash);
    const materials=[];
    this.robot.traverse((part)=>{
      if(part.isMesh&&part.material?.emissive){
        materials.push([part.material,part.material.emissive.clone(),part.material.emissiveIntensity]);
      }
    });
    const targets=[[-.2,.33,.1],[.08,.7,0],[.3,.38,.12]];
    const bolts=targets.map((_,i)=>{
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(21),3));
      const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:i===1?0xffffff:0x77d9ff,transparent:true,opacity:1,depthTest:false}));
      line.frustumCulled=false;
      this.scene.add(line);
      return line;
    });
    const clean=(restorePose)=>{
      if(restorePose){
        this.robot.position.copy(base);
        this.robot.rotation.x=0;
        this.resetFrustratedState(base.y);
      }
      for(const [material,color,intensity] of materials){material.emissive.copy(color);material.emissiveIntensity=intensity}
      for(const line of bolts){this.scene.remove(line);line.geometry.dispose();line.material.dispose()}
      this.scene.remove(flash);
      flash.dispose();
    };
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=(reduced?420:1100)/this.speed;
    return new Promise(resolve=>{
      const start=performance.now();
      const tick=now=>{
        if(this.dead||cancelled()){clean(false);resolve(false);return}
        const t=Math.min((now-start)/duration,1);
        const strength=Math.min(1,t*7,(1-t)*6);
        const pulse=Math.sin(t*Math.PI*23);
        flash.intensity=strength*(2.5+Math.random()*2.5);
        for(const [material] of materials){
          material.emissive.set('#76d9ff');
          material.emissiveIntensity=strength*(1.4+Math.random()*1.8);
        }
        if(!reduced){
          this.robot.position.x=base.x+Math.sin(now*.09)*.055*strength;
          this.robot.position.y=base.y+Math.abs(pulse)*.07*strength;
          this.robot.rotation.z=pulse*.16*strength;
          this.leftArm.rotation.x=-1.2+pulse*.6;
          this.arm.rotation.x=-1.2-pulse*.6;
          this.leftLeg.rotation.x=pulse*.35;
          this.rightLeg.rotation.x=-pulse*.35;
          this.hat.position.y=.77+Math.abs(pulse)*.1;
        }
        bolts.forEach((line,i)=>{
          line.visible=strength>.05&&Math.random()>.16;
          const target=targets[i],positions=line.geometry.attributes.position;
          for(let j=0;j<7;j++){
            const p=j/6,jitter=j===0||j===6?0:(Math.random()-.5)*.28;
            positions.setXYZ(j,
              base.x+.3+((target[0]-.3)*p)+jitter,
              base.y+1.12+((target[1]-1.12)*p)+jitter*.6,
              base.z-.29+((target[2]+.29)*p)+jitter
            );
          }
          positions.needsUpdate=true;
        });
        if(t<1)requestAnimationFrame(tick);
        else{clean(true);resolve(true)}
      };
      requestAnimationFrame(tick);
    });
  }
  async frustrated(cancelled){
    return new Promise(resolve=>{
      const start=performance.now(),duration=1650,baseY=this.robot.position.y;
      this.alertSign.visible=true;
      const tick=now=>{
        if(this.dead||cancelled()){this.resetFrustratedState(baseY);resolve(false);return}
        const t=Math.min((now-start)/duration,1);
        if(t<.18){
          const p=t/.18,s=Math.sin(p*Math.PI*.75)*1.25;
          this.alertSign.scale.set(s*.8,s*.8,1);
          this.alertSign.position.x=Math.sin(now*.08)*.04;
          this.leftArm.rotation.x=-p*2.2;this.arm.rotation.x=-p*2.2;
          this.leftArm.rotation.z=-p*.4;this.arm.rotation.z=p*.4;
        }else if(t<.48){
          const p=(t-.18)/.3;
          this.alertSign.scale.set(.85+Math.sin(now*.05)*.08,.85+Math.sin(now*.05)*.08,1);
          this.alertSign.position.x=Math.sin(now*.08)*.04;
          this.leftArm.rotation.x=-2.2+p*3.1;this.arm.rotation.x=-2.2+p*3.1;
          this.leftArm.rotation.z=-.4*(1-p);this.arm.rotation.z=.4*(1-p);
          const arcY=Math.sin(p*Math.PI)*.45;
          this.hat.position.y=.77+arcY-p*.72;
          this.hat.position.z=-p*.55;
          this.hat.rotation.x=p*Math.PI*2.8;
          this.hat.rotation.z=p*.6;
        }else if(t<.78){
          const p=(t-.48)/.3,stomp=Math.sin(p*Math.PI*10);
          this.leftLeg.rotation.x=stomp*.45;this.rightLeg.rotation.x=-stomp*.45;
          this.robot.position.y=baseY+Math.abs(stomp)*.05;
          this.robot.rotation.z=stomp*.08;
          this.leftArm.rotation.x=.4+stomp*.25;this.arm.rotation.x=.4-stomp*.25;
          this.alertSign.position.x=stomp*.06;
          this.hat.position.set(0,.05+Math.abs(stomp)*.02,-.55);
        }else{
          const p=(t-.78)/.22,ease=p*p*(3-2*p);
          this.leftLeg.rotation.x*=0.8;this.rightLeg.rotation.x*=0.8;
          this.robot.rotation.z*=0.8;this.robot.position.y=baseY;
          this.leftArm.rotation.x*=0.8;this.arm.rotation.x*=0.8;
          const arcY=Math.sin(p*Math.PI)*.5;
          this.hat.position.y=(.05+(.77-.05)*ease)+arcY;
          this.hat.position.z=-.55*(1-ease);
          this.hat.rotation.x=(1-ease)*Math.PI*2;
          this.hat.rotation.z=(1-ease)*.6;
          const s=(1-ease)*.8;
          this.alertSign.scale.set(s,s,1);
        }
        if(t<1)requestAnimationFrame(tick);
        else{this.resetFrustratedState(baseY);resolve(true)}
      };
      requestAnimationFrame(tick);
    });
  }
  async fall(state,cancelled,onFall){
    const from=this.robot.position.clone();
    const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][state.dir];
    const to=from.clone().add(new THREE.Vector3(dx,0,dz));
    return new Promise(resolve=>{
      const start=performance.now(),stepDuration=320/this.speed,fallDuration=900/this.speed;
      let falling=false;
      const tick=now=>{
        if(this.dead||cancelled()){resolve(false);return}
        const elapsed=now-start;
        if(elapsed<stepDuration){
          // Stumble phase: lurch forward, arms fly up in panic
          const t=elapsed/stepDuration,ease=t*t*(3-2*t);
          this.robot.position.lerpVectors(from,to,ease);
          this.robot.rotation.x=ease*.6; // lean forward
          this.robot.rotation.z=Math.sin(t*Math.PI*3)*.15; // wobble
          this.leftArm.rotation.x=-ease*2.4; // arms fly up
          this.arm.rotation.x=-ease*2.4;
          this.leftArm.rotation.z=-ease*.6;
          this.arm.rotation.z=ease*.6;
        }else{
          if(!falling){falling=true;onFall?.()}
          const t=Math.min((elapsed-stepDuration)/fallDuration,1),ease=t*t*(3-2*t);
          // Fall phase: forward tumble spin + shrink + lateral wobble
          this.robot.position.copy(to);
          this.robot.position.y=from.y-ease*2.2;
          this.robot.rotation.x=.6+ease*Math.PI*2.2; // full forward tumble
          this.robot.rotation.z=Math.sin(t*Math.PI*4)*.35*(1-ease); // wild wobble
          // Shrink as if falling into hole
          const scale=1-ease*.85;
          this.robot.scale.set(scale,scale,scale);
          this.leftArm.rotation.x=Math.sin(t*Math.PI*5)*1.2;
          this.arm.rotation.x=Math.sin(t*Math.PI*5+1)*1.2;
        }
        if(elapsed<stepDuration+fallDuration)requestAnimationFrame(tick);
        else{
          // Reset robot transform
          this.robot.scale.set(1,1,1);
          this.robot.rotation.set(0,this.angle,0);
          this.leftArm.rotation.set(0,0,0);
          this.arm.rotation.set(0,0,0);
          resolve(true);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  setZoom(value){this.zoom=Math.max(.7,Math.min(1.5,value));this.resize();this.onZoom?.()}
  resetView(){this.zoom=1;this.orbit=this.initialOrbit;this.tilt=this.initialTilt;this.panX=0;this.panY=0;this.setView();this.resize();this.onZoom?.()}
  rotate(value){this.orbit+=value;this.setView();this.resize()}
  setTop(top){this.camera.position.copy(this.target).add(new THREE.Vector3(top?0:9,top?18:11,top?.001:13));this.camera.lookAt(this.target);this.resize()}
  dispose(){this.dead=true;this.observer.disconnect();this.renderer.setAnimationLoop(null);this.host.removeEventListener('pointerdown',this.onPointerDown);this.host.removeEventListener('pointermove',this.onPointerMove);this.host.removeEventListener('pointerup',this.onPointerEnd);this.host.removeEventListener('pointercancel',this.onPointerEnd);this.host.removeEventListener('wheel',this.onWheel);this.host.removeEventListener('contextmenu',this.onContextMenu);this.scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});this.renderer.dispose();this.renderer.domElement.remove()}
}
