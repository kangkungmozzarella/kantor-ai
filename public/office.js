(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = message => { $('sceneStatus').textContent = message; };
  if (!window.THREE) { status('The 3D office failed to load. Check your internet connection, then reload.'); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas: $('c'), antialias: true}); }
  catch { status('This browser cannot display WebGL yet. Try a browser with graphics acceleration.'); return; }
  // Initials and floor signage are drawn into canvases, so the web fonts must be ready first.
  await Promise.race([
    Promise.all(['700 20px "IBM Plex Mono"', '600 60px Archivo'].map(font => document.fonts.load(font))).catch(() => {}),
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const PAPER = 0xebe5d8, CARD = 0xf7f3eb, INK = 0x2a2622, BALSA = 0xdebd8e, DARK = 0x4a453e, SCREEN = 0xa9c6c9, ACCENT = 0x385747;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 500);
  const ambient=new THREE.HemisphereLight(0xffffff, 0xd9d2c3, .8);scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffeed5, .75);
  sun.position.set(-12, 55, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left:-45, right:45, top:55, bottom:-40, near:1, far:130});
  sun.shadow.bias = -.001; scene.add(sun);
  const FLOOR = {
    1: {name:'Barber & parking', title:'Where every day starts.', description:'A barber on one side, parking on the other.'},
    2: {name:'Kitchen & dining', title:'Meet at the table.', description:'A shared kitchen and long tables where the whole team eats together.'},
    3: {name:'Workspace', title:'Room for everyone.', description:'An open floor with four desk groups, a glass meeting room, phone booths, a pantry, two lounges and a prayer room.'},
    4: {name:'Rooftop', title:'Take a break upstairs.', description:'A garden terrace with a pergola lounge, ping pong, bean bags, a swing, chess, yoga mats, billiards and a coffee bar.'},
  };
  const GROUPS = {
    leadership: {name:'Leadership', x:-5.5, z:-3.5, color:0x2f4a6b},
    marketing: {name:'Marketing & Business', x:5.5, z:-3.5, color:0xb4623a},
    engineering: {name:'Engineering & Design', x:-5.5, z:6.5, color:0x3f7a58},
    service: {name:'Customer Service', x:5.5, z:6.5, color:0x74598c}
  };
  const TEAM = [
    {n:'Koh Arman', initials:'KA', gender:'male', role:'CEO', group:'leadership'},
    {n:'Koh Wira', initials:'KW', gender:'male', role:'CTO', group:'leadership'},
    {n:'Kak Rani', initials:'KR', gender:'female', role:'Social Media Specialist', group:'marketing'},
    {n:'Kak Dewi', initials:'KD', gender:'female', role:'Digital Marketing', group:'marketing'},
    {n:'Mira', initials:'M', gender:'female', role:'Business Development', group:'marketing'},
    {n:'Tari', initials:'T', gender:'female', role:'Social Media Intern', group:'marketing'},
    {n:'Bagas Pratama Putra', initials:'BPP', gender:'male', role:'Frontend Engineer', group:'engineering'},
    {n:'Rizky Hakim', initials:'RH', gender:'male', role:'Backend Engineer', group:'engineering'},
    {n:'Yoga', initials:'Y', gender:'male', role:'Product Design', group:'engineering'},
    {n:'Bang Eko', initials:'BE', gender:'male', role:'Graphic Designer', group:'engineering'},
    {n:'Gilang', initials:'G', gender:'male', role:'Customer Service Leader', group:'service'},
    {n:'Kak Sinta', initials:'KS', gender:'female', role:'Customer Service', group:'service'},
    {n:'Kak Laras', initials:'KL', gender:'female', role:'Customer Service', group:'service'}
  ];
  const softShapes=new Map();
  const floors = {}, materials = new Map(), agents = [];
  let root, activeFloor = 3, selected = null, paused = false, simTime = 0;
  let routineOn = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const linear = color => new THREE.Color(color).convertSRGBToLinear();
  const hex = color => '#' + color.toString(16).padStart(6, '0');
  const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
  const passage = level => level === 3 ? 1.5 : 0;
  // Storey height: the tallest interior (walls, beams, rooftop canopy) is 3.5, plus the 0.48 slab and a little air.
  const FLOOR_GAP=4.4, floorY=level=>(level-1)*FLOOR_GAP;
  const stairways={}, travelRoot=new THREE.Group();scene.add(travelRoot);

  // Paper-model rendering: three flat tone steps plus ink edges on every folded card.
  const toneSteps = new THREE.DataTexture(new Uint8Array([165, 215, 255]), 3, 1, THREE.LuminanceFormat);
  toneSteps.minFilter = toneSteps.magFilter = THREE.NearestFilter; toneSteps.generateMipmaps = false; toneSteps.needsUpdate = true;
  const lineMaterial = new THREE.LineBasicMaterial({color:linear(INK), transparent:true, opacity:.08});
  const glassMaterial = new THREE.MeshToonMaterial({color:linear(0xc4dadb), gradientMap:toneSteps, transparent:true, opacity:.3, depthWrite:false});
  // Roof glass is clearer than wall glass so the rooftop stays readable from above.
  const roofGlassMaterial = new THREE.MeshToonMaterial({color:linear(0xd6e6e8), gradientMap:toneSteps, transparent:true, opacity:.13, depthWrite:false});
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color:linear(color), roughness:.78, metalness:0}));
    return materials.get(color);
  }
  function mesh(geometry, color, x, y, z, parent = root, edges = true) {
    const glass = color === 'glass' || color === 'roofglass';
    const m = new THREE.Mesh(geometry, color === 'roofglass' ? roofGlassMaterial : glass ? glassMaterial : material(color));
    m.position.set(x, y, z); m.castShadow = !glass; m.receiveShadow = true;
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), lineMaterial));
    parent.add(m); return m;
  }
  function box(w,h,d,color,x,y,z,parent) { return mesh(new THREE.BoxGeometry(w,h,d),color,x,y+h/2,z,parent); }
  function cylinder(rt,rb,h,color,x,y,z,parent) { return mesh(new THREE.CylinderGeometry(rt,rb,h,16),color,x,y+h/2,z,parent); }
  function textPlane(text,x,z,width,color='#5c554b',parent=root) {
    const c=document.createElement('canvas'); c.width=1024;c.height=128;
    const ctx=c.getContext('2d');ctx.font='600 60px Archivo, system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,64,980);
    const texture=new THREE.CanvasTexture(c);texture.encoding=THREE.sRGBEncoding;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.set(x,.08,z);parent.add(m);return m;
  }
  function oval(w,h,d,color,x,y,z,parent=root){
    const m=mesh(new THREE.SphereGeometry(1,16,12),color,x,y,z,parent,false);m.scale.set(w/2,h/2,d/2);return m;
  }
  function plant(x,z,scale=1,y=0) {
    cylinder(.32*scale,.24*scale,.55*scale,0xc9ab86,x,y,z);
    box(.04,.9*scale,.04,0x6a5944,x,y+.45*scale,z);
    for(let i=0;i<7;i++){
      const a=i*2.4,leaf=oval(.32*scale,.68*scale,.12*scale,i%2?0x64825b:0x839769,x+Math.cos(a)*.25*scale,y+(.75+i*.1)*scale,z+Math.sin(a)*.25*scale);
      leaf.rotation.set(.35, a,Math.sin(a)*.6);
    }
  }
  function chair(x,z,f,color=DARK) {
    cylinder(.055,.15,.46,0x595d54,x,0,z);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;box(.06,.06,.65,DARK,x,.08,z).rotation.y=a;oval(.13,.13,.13,DARK,x+Math.sin(a)*.3,.08,z+Math.cos(a)*.3);}
    const upholstery=mix(color,0xd5d8bf,.42);
    mesh(softBox(.87,.19,.8),upholstery,x,.52,z,root,false);
    mesh(softBox(.88,.84,.22),upholstery,x,.94,z-f*.37,root,false);
  }
  function table(x,z,w=5,d=1.9) {
    mesh(softBox(w,.16,d),BALSA,x,.91,z,root,false);
    for(const sx of [-1,1])for(const sz of [-1,1])box(.1,.85,.1,DARK,x+sx*(w/2-.25),0,z+sz*(d/2-.2));
  }
  function screen(x,z,f,dual=false) {
    for(const offset of (dual?[-.38,.38]:[0])){
      box(.07,.17,.07,DARK,x+offset,.97,z);box(dual?.7:1.1,.66,.07,DARK,x+offset,1.14,z);
      box(dual?.61:1,.54,.015,SCREEN,x+offset,1.2,z-f*.045);
    }
    box(.65,.03,.23,0x8a8479,x,.97,z-f*.46);
    cylinder(.09,.08,.16,CARD,x+.7,.97,z-f*.42);
  }
  function sofa(x,z,w=4,rotation=0) {
    const g=new THREE.Group();root.add(g);g.position.set(x,0,z);g.rotation.y=rotation;
    mesh(softBox(w,.5,1.1),0xb8c3a6,0,.25,0,g,false);
    mesh(softBox(w,.85,.3),0x9dab90,0,.6,-.48,g,false);
    for(const side of [-1,1]){
      mesh(softBox(.3,.65,1.1),0x9dab90,side*w/2,.4,-.05,g,false);
      const cushion=mesh(softBox(.55,.55,.2),side>0?0xd5b49b:0xe8ddc8,side*(w/2-.55),.75,-.22,g,false);cushion.rotation.z=side*.16;
    }
  }
  const doorPads=[];
  function stairs(level) {
    doorPads.push(box(2,.12,2.6,0xcfc8ba,-16.8,-.12,7));
    textPlane('STAIRS',-14.2,6.9,2.5);
  }
  // Restroom: a closed, roofed box with a door and a WC sign. Nothing inside is modelled, for privacy.
  // (cx, cz) is the centre, (w, d) the size along x and z, and face the side the door is on.
  const wcTexture=(()=>{
    const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
    ctx.fillStyle='#1f2433';ctx.fillRect(0,0,256,128);ctx.fillStyle='#fff';ctx.font='700 72px Archivo, system-ui, sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('WC',128,68);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
  })();
  function restroom(cx,cz,w,d,face){
    const g=new THREE.Group();g.position.set(cx,0,cz);g.rotation.y={'+z':0,'+x':Math.PI/2,'-z':Math.PI,'-x':-Math.PI/2}[face];root.add(g);
    // Local +z is the door side; turning by 90 degrees swaps width and depth.
    const [lw,ld]=face[1]==='x'?[d,w]:[w,d],H=2.4,side=(lw-1)/2;
    box(lw,H,.12,0xefeae0,0,0,-ld/2+.06,g);
    for(const s of [-1,1])box(.12,H,ld,0xefeae0,s*(lw/2-.06),0,0,g);
    for(const s of [-1,1])box(side,H,.12,0xefeae0,s*(lw/2-side/2),0,ld/2-.06,g);
    box(1,H-2.1,.12,0xefeae0,0,2.1,ld/2-.06,g);
    box(lw+.1,.1,ld+.1,0xe2dccf,0,H,0,g);
    box(.94,2.06,.06,BALSA,0,.02,ld/2-.04,g);box(.06,.06,.12,DARK,.34,1,ld/2+.02,g);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(.5,.25),new THREE.MeshBasicMaterial({map:wcTexture}));
    sign.position.set(side>.6?-(.5+side/2):0,side>.6?1.55:2.25,ld/2+.005);g.add(sign);
    // The roof carries the label too, so the box reads as a restroom from above.
    const roofSign=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.65),new THREE.MeshBasicMaterial({map:wcTexture}));
    // Added to the floor, not the rotated box, so it always reads upright from the front camera.
    roofSign.rotation.x=-Math.PI/2;roofSign.position.set(cx,H+.12,cz);root.add(roofSign);
    return g;
  }
  const facing = spot => spot.angle ?? (spot.f>0?0:Math.PI);
  const seat = (x,z,f,floor,aisle,extra={}) => ({x,z,f,floor,route:[[aisle,passage(floor)],[aisle,z]],...extra});
  function shell(level) {
    root=new THREE.Group();floors[level]=root;scene.add(root);
    box(33,.48,25,0xd3cbba,0,-.48,0);
    box(32,.03,24,{1:0xdcd6ca,2:0xefe8da,3:0xf1ece1,4:0xddd3bf}[level],0,0,0);
    if(level!==3){
      box(32,level===4?.85:2.4,.22,CARD,0,0,-12);
      if(level!==4)for(const x of [-12,-4,4,12])box(5.5,1.35,.05,SCREEN,x,.82,-11.86);
    }
    box(.22,level===4?.85:1.1,17.5,CARD,-16,0,-3.25);
    box(.22,level===4?.85:1.1,3.5,CARD,-16,0,10.25);
    box(.22,level===4?.85:1.1,24,CARD,16,0,0);
    // Floor 1 leaves the parking half of the front open for cars.
    if(level===1)box(16,.28,.22,CARD,-8,0,12);else box(32,.28,.22,CARD,0,0,12);
    if(level===2||level===3){
      for(let row=0;row<24;row++)for(let col=0;col<4;col++){
        box(7.98,.003,.985,[0xe2cdb0,0xddc5a5,0xe8d5b9][(row+col)%3],-12+col*8,.032,-11.5+row);
      }
    }
    stairs(level);
  }

  shell(1);
  box(.16,2.4,15,CARD,-2,0,-4.3);
  box(13,.02,23,0xe8e1d3,-9.3,.02,0);
  for(const x of [-11,-6]){
    box(2.5,1.8,.08,DARK,x,.55,-10.9);box(2.28,1.58,.02,SCREEN,x,.66,-10.84);
    box(2.7,.12,.7,BALSA,x,.9,-10.3);
    cylinder(.48,.55,.16,0x8a8479,x,0,-8);cylinder(.09,.09,.55,0xa9a397,x,.16,-8);
    box(1.15,.2,1.2,DARK,x,.6,-8);box(1.15,1,.2,DARK,x,.7,-7.5);
    for(const s of [-1,1])box(.14,.25,1,0x8a8479,x+s*.66,.8,-8);
    box(.85,.12,.6,0xa9a397,x,.23,-9);
  }
  sofa(-7,7,4);table(-7,9,2,.9);plant(-3.5,10.7);
  // Cashier counter near the barber exit.
  box(2.6,1,.8,BALSA,-13.5,0,2.5);box(2.7,.06,.9,CARD,-13.5,1,2.5);box(.5,.35,.4,DARK,-13.1,1.06,2.4);box(.4,.04,.3,0x8a8479,-13.9,1.06,2.6);
  textPlane('CASHIER',-13.5,4.6,3.2);
  cylinder(.16,.16,2,CARD,-3,0,-10.5);
  for(let i=0;i<8;i++)cylinder(.17,.17,.13,i%2?CARD:0xb4523a,-3,.2+i*.21,-10.5);
  textPlane('BARBER',-8,-3,7);textPlane('PARKING',7,8.7,8);
  for(const x of [2,7,12]){
    box(.07,.02,8,CARD,x-2.3,.03,-5);box(4.6,.02,.07,CARD,x,.03,-9);
  }
  function car(x,z,color) {
    box(2.4,.65,4.7,color,x,.45,z);box(2.05,.65,2.5,color,x,1.1,z-.2);
    box(1.88,.5,.03,SCREEN,x,1.18,z+1.07);box(1.88,.5,.03,SCREEN,x,1.18,z-1.47);
    for(const sx of [-1,1])for(const sz of [-1,1]){const w=cylinder(.43,.43,.2,DARK,x+sx*1.22,.2,z+sz*1.4);w.rotation.z=Math.PI/2;}
    for(const sx of [-1,1])box(.5,.2,.05,0xfff1c9,x+sx*.7,.72,z+2.38);
  }
  car(2,-5,0xd6d0c4);car(12,-5,0x6f8580);
  for(const x of [3,6,9]){
    for(const z of [2.8,4.2]){const w=cylinder(.3,.3,.16,DARK,x,.12,z);w.rotation.z=Math.PI/2;}
    box(.45,.4,1.3,0x8a5a3c,x,.42,3.5);box(.48,.12,.8,DARK,x,.85,3.6);box(.8,.06,.08,DARK,x,1.05,2.8);
  }
  textPlane('ENTRANCE',7,11,4);
  restroom(-14.5,10.6,2.7,2.5,'-z');

  // Floor 2: back counter, an island on a terracotta rug, one long table, a coffee bar and a reading corner.
  shell(2);
  const TERRACOTTA=0xc98f72, SAGE=0xb3c0a0, SAGE_DARK=0x7f9a82, RUST=0xc27a52;
  function stool(x,z,h=.75) {
    for(const a of [.8,2.4,4,5.5])box(.05,h,.05,DARK,x+Math.cos(a)*.2,0,z+Math.sin(a)*.2);
    cylinder(.26,.26,.04,DARK,x,h*.35,z);
    mesh(softBox(.56,.12,.56),CARD,x,h+.06,z,root,false);
  }
  function diningChair(x,z,f,color) {
    for(const sx of [-1,1])for(const sz of [-1,1])box(.05,.5,.05,DARK,x+sx*.3,0,z+sz*.3);
    mesh(softBox(.75,.12,.72),color,x,.56,z,root,false);
    mesh(softBox(.75,.62,.14),color,x,.92,z-f*.33,root,false);
  }
  // Floor 2 has no ceiling to hang from, so light stands on the floor.
  function floorLamp(x,z) {
    cylinder(.28,.3,.05,DARK,x,0,z);box(.04,1.9,.04,DARK,x,.05,z);
    cylinder(.18,.32,.36,SAGE_DARK,x,1.85,z);oval(.16,.16,.16,0xfff4d6,x,1.9,z);
  }
  // Back counter with open shelves along the window wall.
  box(24,.95,1.8,0xcdb28a,1,0,-10.5);box(24,.1,1.9,CARD,1,.95,-10.5);
  for(const x of [-9,-6,-3,0,3,6,9,12])box(.03,.85,.03,0x8c7965,x,.05,-9.58);
  box(2,.04,1.3,0x8a8479,-5,1.05,-10.5);box(1.55,.05,.96,0xc9d3d1,-5,1.08,-10.5);
  cylinder(.045,.045,.5,0xa9a397,-5,1.1,-11);
  box(2.3,.05,1.3,DARK,3,1.05,-10.5);
  for(const x of [2.5,3.5])for(const z of [-10.8,-10.2])cylinder(.23,.23,.04,0x8a8479,x,1.1,z);
  box(1.8,2.5,1.8,0xd9d9d0,13.6,0,-10.4);box(1.55,.035,.03,DARK,13.6,1.65,-9.48);
  box(1,.6,.8,DARK,-9,1.05,-10.5);cylinder(.12,.12,.2,CARD,-9,1.05,-9.9);
  for(const x of [-7,5])box(7,.07,.5,BALSA,x,1.95,-11.6);
  for(let i=0;i<7;i++){
    cylinder(.14,.14,.3,i%3?CARD:SAGE,-9.8+i*.55,2.02,-11.6);
    cylinder(.14,.14,.26,i%2?0xa9a397:CARD,3.2+i*.5,2.02,-11.6);
  }
  plant(-4.4,-11.6,.45,2.02);plant(7.8,-11.6,.45,2.02);
  // Island: stone top on a slatted balsa base, stools on the dining side.
  box(9.4,.02,4.6,TERRACOTTA,-3,.035,-5.4);
  box(8,.95,1.5,BALSA,-3,0,-5.6);
  for(let i=0;i<21;i++)box(.05,.9,.03,0xc9a577,-6.8+i*.38,.03,-4.84);
  mesh(softBox(8.4,.12,1.9),0xf1ede4,-3,1.01,-5.6,root,false);
  box(1.2,.03,.8,0x8a8479,-5.2,1.08,-5.8);cylinder(.035,.035,.45,0xa9a397,-5.2,1.1,-6.1);
  cylinder(.35,.25,.16,BALSA,-1.8,1.08,-5.7);for(let i=0;i<4;i++)oval(.2,.2,.2,0xd99a4e,-1.9+(i%2)*.18,1.24+(i>>1)*.08,-5.7+(i%3)*.1-.1);
  plant(1,-5.8,.35,1.08);
  for(const x of [-6,-4.5,-3,-1.5,0])stool(x,-3.9);
  // Coffee bar in the back-right corner.
  box(5,.02,6.4,SAGE,11.6,.035,-5);
  box(1,1,3,BALSA,15.3,0,-5);box(1.1,.06,3.1,CARD,15.3,1,-5);
  box(.7,.55,.55,DARK,15.3,1.06,-5.6);box(.5,.12,.12,0x8a8479,15,1.3,-5.6);
  for(let i=0;i<5;i++)cylinder(.1,.08,.14,CARD,15.2,1.06,-4.8+i*.25);
  box(.9,1,.06,DARK,15.8,1.6,-3.4);
  cylinder(.25,.4,1.02,DARK,11.8,0,-5);
  mesh(softBox(1.2,.1,4.8),0xf1ede4,11.8,1.08,-5,root,false);
  for(const z of [-6.6,-5,-3.4])stool(10.7,z,1);
  cylinder(.07,.07,.24,0xc4dadb,11.9,1.13,-4.2);plant(12,-6.6,.3,1.13);
  // One long table on a sage rug seats the whole team.
  box(15,.02,5.6,SAGE,-1,.035,5);
  const dining=[];
  table(-1,5,12.4,2.2);
  for(let i=0;i<7;i++)for(const side of [-1,1]){
    const x=-6.1+i*1.7,z=5+side*1.75;
    diningChair(x,z,-side,side<0?CARD:0xd9cdb6);
    cylinder(.23,.23,.02,CARD,x,.99,5+side*.6);cylinder(.08,.08,.18,0xc4dadb,x+.45,.99,5+side*.6);
    dining.push(seat(x,z,-side,2,x<-1?-8.8:7));
  }
  plant(-1,5,.4,.99);cylinder(.3,.22,.12,BALSA,1.6,.99,5);for(let i=0;i<3;i++)oval(.2,.2,.2,0x9bb06b,1.5+i*.12,1.12,5);
  floorLamp(-9.4,9.2);floorLamp(9.4,8.8);
  // Reading corner: round rug, two armchairs and a pinned board.
  cylinder(3,3,.02,0xd8cfc0,11.6,.03,6.4);
  for(const [x,z,r] of [[10.2,5.4,.7],[12.8,7.9,-2.3]]){
    const g=new THREE.Group();root.add(g);g.position.set(x,0,z);g.rotation.y=r;
    mesh(softBox(1.1,.45,1),RUST,0,.35,0,g,false);mesh(softBox(1.1,.75,.25),RUST,0,.75,-.42,g,false);
    for(const s of [-1,1])mesh(softBox(.22,.55,.9),mix(RUST,INK,.1),s*.5,.45,-.02,g,false);
    for(const s of [-1,1])for(const t of [-1,1])box(.05,.14,.05,DARK,s*.4,0,t*.35,g);
  }
  cylinder(.55,.55,.06,BALSA,11.6,.5,6.6);cylinder(.06,.1,.5,DARK,11.6,0,6.6);box(.4,.03,.3,DARK,11.5,.56,6.5);
  const board=new THREE.Group();root.add(board);board.position.set(14.2,0,4.4);board.rotation.y=-.9;
  box(2.2,1.4,.06,CARD,0,.9,0,board);for(const s of [-1,1])box(.06,2.3,.06,DARK,s*1.05,0,0,board);
  for(let i=0;i<5;i++)box(.34,.3,.02,[0xf0d27a,0xe8b8a0,0xc9d9c6][i%3],-.7+(i%3)*.6,1.6-(i>>1)*.5-(i%2)*.1,.05,board);
  plant(-12.2,-8.4);plant(15,-1.2,.8);restroom(-14.4,-10.55,2.9,2.6,'+z');plant(-14.3,10.4,.9);plant(15,10.5,.8);plant(7.2,10.6,.7);
  textPlane('SHARED KITCHEN',-3,-1.9,7);textPlane('COFFEE BAR',11.8,-.9,5);textPlane('DINING',-1,9.5,7);

  // Floor 3: one open room, layered by rugs, a board partition, a low shelf, glass rooms and hanging lamps.
  shell(3);
  const P3=passage(3);
  box(6.2,3.5,.22,CARD,-12.9,0,-12);
  box(25.8,.9,.22,CARD,3.1,0,-12);box(25.8,.45,.22,CARD,3.1,3.05,-12);
  for(let i=0;i<=6;i++)box(.2,2.15,.22,CARD,-9.8+i*25.8/6,.9,-12);
  box(25.8,2.15,.04,'glass',3.1,.9,-12.03);
  for(const z of [-3.5,6.5]){for(const x of [-15.8,15.8])box(.4,3.5,.4,CARD,x,0,z);box(31.6,.22,.3,CARD,0,3.28,z);}
  const desks={};
  for(const [key,group] of Object.entries(GROUPS)){
    const people=TEAM.filter(p=>p.group===key),cols=2,full=people.length>2;
    // Each team sits on its own soft-coloured rug: sage, terracotta, lilac, slate.
    mesh(softBox(8.6,.04,full?6.6:4.4),{leadership:0xb7c3cf,marketing:0xe0b8a6,engineering:0xb9c8a6,service:0xcdbfdc}[key],group.x,.02,group.z+(full?0:.9),root,false);
    table(group.x,group.z,6.4,full?2.3:1.7);
    textPlane(group.name.toUpperCase(),group.x,group.z>0?10.35:.35,8);
    people.forEach((person,index)=>{
      const side=people.length===2?1:(index<cols?-1:1),f=-side;
      const x=group.x+(index%cols===0?-1.65:1.65),z=group.z+side*2.05;
      chair(x,z,f,group.color);screen(x,group.z+side*.38,f,key==='engineering');
      const notebook=mesh(softBox(.35,.04,.45),0xe6dbc4,x-.8,.99,group.z+side*.65,root,false);notebook.rotation.y=.12;
      plant(x+.95,group.z+side*.1,.24,.97);
      desks[person.n]=seat(x,z,f,3,group.x<0?-10.5:key==='marketing'?9:10);
    });
    // Pendants hang from the ceiling beam above each team table.
    for(const dx of [-1.6,1.6]){box(.03,.88,.03,DARK,group.x+dx,2.4,group.z);cylinder(.07,.34,.3,0x5f7d68,group.x+dx,2.12,group.z);oval(.16,.16,.16,0xfff1cf,group.x+dx,2.1,group.z);}
  }
  // Task board between Leadership and Marketing, readable from both sides. It lists the real open tasks.
  // It faces the front of the room so the default camera can read it.
  box(2.8,1.5,.1,CARD,0,.55,-3.5);
  for(const x of [-1.2,1.2])box(.08,.55,.08,DARK,x,0,-3.5);
  const boardCanvas=document.createElement('canvas');boardCanvas.width=1024;boardCanvas.height=528;
  const boardTexture=new THREE.CanvasTexture(boardCanvas);boardTexture.encoding=THREE.sRGBEncoding;boardTexture.anisotropy=4;
  for(const side of [-1,1]){
    const face=new THREE.Mesh(new THREE.PlaneGeometry(2.7,1.39),new THREE.MeshBasicMaterial({map:boardTexture}));
    face.position.set(0,1.3,-3.5+side*.056);face.rotation.y=side>0?0:Math.PI;root.add(face);
  }
  // Low shelf between Engineering and Customer Service keeps the room open while giving it a back and front.
  box(.6,1.15,5.2,BALSA,0,0,6.8);
  for(const y of [.38,.76])box(.62,.03,5.22,0xb89c70,0,y,6.8);
  for(let i=0;i<10;i++)box(.4,.26+(i%3)*.04,.1+(i%2)*.06,[0x2f4a6b,CARD,0xb4623a,0x3f7a58,0x74598c][i%5],0,.42,4.6+i*.44);
  plant(0,5.2,.55,1.15);plant(0,8.4,.55,1.15);
  // Glass meeting room, back left.
  box(5.9,.02,5.3,0xe6ded0,-12.9,.02,-9.25);
  box(4.1,2.4,.05,'glass',-13.95,0,-6.5);box(.7,2.4,.05,'glass',-10.15,0,-6.5);box(.05,2.4,5.5,'glass',-9.8,0,-9.25);
  for(const [x,z] of [[-11.9,-6.5],[-10.5,-6.5],[-9.8,-6.5],[-9.8,-11.9]])box(.1,2.45,.1,DARK,x,0,z);
  box(6.2,.08,.1,DARK,-12.9,2.4,-6.5);box(.1,.08,5.5,DARK,-9.8,2.4,-9.25);
  table(-13.2,-9,2.8,1.4);
  box(2.2,1.1,.08,DARK,-13.2,1.1,-11.82);box(2,.95,.02,SCREEN,-13.2,1.17,-11.77);
  textPlane('MEETING ROOM',-12.9,-5.8,4.6);
  // Doors swing open on their own when someone comes within reach, then close again.
  const doors=[];
  function door(hx,hz,width,base,color){
    // Doors swing out of the way, so the walking grid treats them as open.
    const pivot=new THREE.Group();pivot.position.set(hx,0,hz);pivot.rotation.y=base;pivot.userData.walkable=true;root.add(pivot);
    box(width-.04,2.2,.05,color,width/2,0,0,pivot);box(.04,.04,.2,DARK,width-.15,1.05,0,pivot);
    const center=new THREE.Vector3(width/2,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),base).add(new THREE.Vector3(hx,0,hz));
    doors.push({pivot,base,center,floor:3,open:0});
  }
  door(-11.9,-6.5,1.4,0,'glass');
  const hangouts=[];
  for(const x of [-14.2,-13.2,-12.2])for(const [z,f] of [[-10.35,1],[-7.65,-1]]){
    chair(x,z,f,0x8a7a66);
    hangouts.push({x,z,f,floor:3,route:[[-11.2,P3],[-11.2,z]],state:'meet',label:'Heading to the meeting room',occupant:null});
  }
  // Two phone booths, front left.
  for(const x of [-14.6,-12.4]){
    box(1.9,.02,1.9,0xe6ded0,x,.02,10.5);
    box(.05,2.3,1.9,'glass',x-.95,0,10.5);box(.05,2.3,1.9,'glass',x+.95,0,10.5);box(1.9,2.3,.05,'glass',x,0,11.45);
    box(1.95,.08,.08,DARK,x,2.3,9.55);box(1.95,.08,.08,DARK,x,2.3,11.45);
    for(const dx of [-.725,.725])box(.45,2.3,.05,'glass',x+dx,0,9.55);door(x-.5,9.55,1,0,'glass');
    box(.08,.08,1.95,DARK,x-.95,2.3,10.5);box(.08,.08,1.95,DARK,x+.95,2.3,10.5);
    box(1.6,1.1,.04,0x86968a,x,.9,11.38);box(.9,.05,.35,BALSA,x,.95,11.2);
    cylinder(.24,.24,.48,DARK,x,0,10.7);
    hangouts.push({x,z:10.6,f:-1,floor:3,route:[[-11,P3],[-11,8.8],[x,8.8]],state:'call',label:'Heading to a phone booth',occupant:null});
  }
  textPlane('PHONE BOOTH',-13.5,8.9,4.4);
  // Pantry and lounge, back right.
  box(4.6,.9,.8,0xcdb28a,11.8,0,-11.2);box(4.7,.06,.9,CARD,11.8,.9,-11.2);
  box(.45,.55,.45,CARD,10.4,.96,-11.25);cylinder(.2,.2,.45,0xc4dadb,10.4,1.51,-11.25);
  box(.5,.6,.42,DARK,13.2,.96,-11.3);for(const x of [12.1,12.4])cylinder(.08,.07,.16,CARD,x,.96,-11);
  textPlane('PANTRY',11.8,-8.9,3.6);
  // Pantry and lounge share one glass room with its door on the aisle.
  box(.05,2.4,7.8,'glass',9.6,0,-8.1);box(5.2,2.4,.05,'glass',13.4,0,-4.2);
  for(const [x,z] of [[9.6,-4.2],[10.8,-4.2],[9.6,-11.9]])box(.1,2.45,.1,DARK,x,0,z);
  box(.1,.08,7.8,DARK,9.6,2.4,-8.1);box(6.4,.08,.1,DARK,12.8,2.4,-4.2);
  door(9.6,-4.2,1.2,0,'glass');
  box(3.2,.02,4,0xe3d9c6,14.2,.02,-7.5);
  sofa(15,-7.5,3.4,-Math.PI/2);box(.8,.4,1,BALSA,13.1,0,-7.5);
  cylinder(.2,.25,.05,DARK,15.3,0,-4.9);box(.04,1.6,.04,DARK,15.3,.05,-4.9);cylinder(.12,.3,.3,CARD,15.3,1.6,-4.9);
  textPlane('LOUNGE',13.6,-5.3,3.6);
  for(const x of [10.6,12.6])hangouts.push({x,z:-10.2,f:-1,floor:3,route:[[10,P3],[10,-10.2]],state:'drink',label:'Heading to the pantry',occupant:null});
  hangouts.push({x:8.7,z:-10.3,f:-1,angle:Math.PI,floor:3,route:[[9,P3],[9,-10.3]],state:'water',label:'Watering the plant',occupant:null});
  for(const z of [-8.3,-6.7])hangouts.push({x:14.75,z,f:-1,angle:-Math.PI/2,floor:3,route:[[10,P3],[10,z]],state:'lounge',label:'Heading to the lounge',occupant:null});
  // One reader in front of the task board, one behind it (reached around the board's right edge).
  hangouts.push({x:0,z:-2.5,f:-1,angle:Math.PI,floor:3,route:[[0,P3]],state:'look',label:'Heading to the task board',occupant:null});
  hangouts.push({x:0,z:-4.5,f:1,angle:0,floor:3,route:[[1.95,P3],[1.95,-4.5]],state:'look',label:'Heading to the task board',occupant:null});
  // Musholla, front right: low partitions, a door on the aisle side, two rows of prayer mats.
  box(5.3,.02,3.3,0xdfe3d6,13.3,.02,10.15);
  box(.12,1.1,1.1,CARD,10.6,0,9.05);box(.12,1.1,1.1,CARD,10.6,0,11.2);box(5.5,1.1,.12,CARD,13.3,0,8.5);
  door(10.6,9.6,1,-Math.PI/2,BALSA);
  box(.9,.4,.35,BALSA,11.2,0,8.8);
  const prayerSpots=[];
  for(const z of [9.25,11.05])for(const [i,x] of [11.5,12.7,13.9,15.1].entries()){
    box(.7,.03,1.1,i%2?0xa98158:0x86968a,x,.03,z);
    prayerSpots.push({x,z,f:-1,floor:3,route:[[10,P3],[10,10.1],[x,10.1]],state:'pray',label:'Heading to the prayer room',occupant:null});
  }
  textPlane('PRAYER ROOM',13.3,7.9,3.6);
  plant(15,-11,.9);plant(-12.6,-3,.8);restroom(-14.45,-5.05,2.9,2.5,'+x');
  // Back lounge between the meeting room and the pantry: sofa on a round rug, two armchairs, books and a quote panel.
  cylinder(3.1,3.1,.03,0xe8cfc0,-2.6,.02,-9.6);
  sofa(-3.4,-10.9,3.6);
  cylinder(.6,.6,.06,BALSA,-3.4,.42,-8.9);cylinder(.08,.14,.42,DARK,-3.4,0,-8.9);
  box(.5,.06,.36,0x5f7d68,-3.5,.48,-8.95);box(.44,.06,.32,CARD,-3.5,.54,-8.95);cylinder(.1,.08,.16,CARD,-3.05,.48,-8.75);
  for(const [x,z,r,color] of [[.2,-9.8,-1.9,0x6e8f72],[-.2,-7.8,-2.6,0xefe7da]]){
    const g=new THREE.Group();root.add(g);g.position.set(x,0,z);g.rotation.y=r;
    mesh(softBox(1.1,.45,1),color,0,.35,0,g,false);mesh(softBox(1.1,.8,.28),color,0,.8,-.42,g,false);
    for(const s of [-1,1])mesh(softBox(.24,.58,.92),mix(color,INK,.08),s*.5,.46,-.02,g,false);
    for(const s of [-1,1])for(const t of [-1,1])box(.05,.14,.05,DARK,s*.4,0,t*.35,g);
  }
  // Bookshelf against the window wall.
  box(3,2.1,.5,BALSA,4.6,0,-11.55);
  for(const y of [.7,1.4])box(2.9,.04,.46,0xb89c70,4.6,y,-11.5);
  for(let i=0;i<16;i++){const row=i>>3;box(.14+(i%3)*.04,.46+(i%4)*.06,.34,[0x2f4a6b,CARD,0xb4623a,0x3f7a58,0x74598c,0xd9a441][i%6],3.35+(i%8)*.33,.06+row*.7,-11.5);}
  plant(5.4,-11.5,.35,1.44);plant(3.6,-11.5,.3,2.1);
  // Quote panel, painted like the lettering on the reference walls.
  {
    const c=document.createElement('canvas');c.width=512;c.height=384;const ctx=c.getContext('2d');
    ctx.fillStyle='#fbf8f2';ctx.fillRect(0,0,512,384);ctx.fillStyle='#2f3a33';ctx.font='600 58px Archivo, system-ui, sans-serif';
    ['Good people','build great','work.'].forEach((line,i)=>ctx.fillText(line,40,110+i*72));
    ctx.fillStyle='#b4623a';ctx.fillRect(40,316,70,6);
    const texture=new THREE.CanvasTexture(c);texture.encoding=THREE.sRGBEncoding;
    box(2.8,2.2,.14,CARD,-7.6,.4,-11.6);for(const s of [-1,1])box(.1,.4,.1,DARK,-7.6+s*1.2,0,-11.6);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.95),new THREE.MeshBasicMaterial({map:texture}));sign.position.set(-7.6,1.5,-11.52);root.add(sign);
  }
  plant(-9.3,-10.4,.9);plant(8.7,-11.2,1);plant(-.8,-11.3,.8);
  // Wooden planters with trailing leaves along the front windows.
  for(const x of [-6,6]){
    box(3.4,.55,.7,BALSA,x,0,11.35);for(let i=0;i<5;i++)box(.04,.5,.03,0xc9a577,x-1.4+i*.7,.03,11);
    for(const dx of [-1.1,0,1.1])plant(x+dx,11.35,.42,.55);
  }
  // Two lounge seats on the sofa, reached along the back of the Leadership rug.
  for(const x of [-4.4,-2.4])hangouts.push({x,z:-10.7,f:1,floor:3,route:[[-9.3,P3],[-9.3,-8],[x,-8]],state:'lounge',label:'Heading to the back lounge',occupant:null});
  textPlane('LOUNGE',-2.6,-7.3,3.2);

  shell(4);
  // Rooftop garden: a pergola lounge, and a play deck instead of one long table, so a break is something to do.
  for(let row=0;row<24;row++)box(31.8,.025,.98,[0xd9bd98,0xe0c7a5,0xd4b590][row%3],0,.031,-11.5+row);
  const roofSpots=[];
  const ROOF_STATUS={'relaxes in the pergola lounge':'relaxing in the pergola lounge','plays ping pong':'playing ping pong','hangs out on the bean bags':'hanging out on the bean bags',
    'sits on the swing':'sitting on the swing','plays chess':'playing chess','stretches on a yoga mat':'stretching on a yoga mat','plays billiards':'playing billiards','grabs a coffee at the rooftop bar':'having coffee at the rooftop bar'};
  // Every rooftop spot keeps the 'break' state; roofPose picks the pose and fun names the activity.
  const roofSpot=(x,z,angle,fun,extra={})=>{const spot={x,z,f:1,angle,floor:4,route:[[x,0]],state:'break',fun,...extra};roofSpots.push(spot);return spot;};
  box(10,.03,8.7,0xd7c5a7,-6,.06,-6.5);
  for(const x of [-11,-1])for(const z of [-11,-2])box(.22,3.3,.22,BALSA,x,0,z);
  for(let x=-11.2;x<=-.8;x+=.65)box(.18,.16,9.6,BALSA,x,3.3,-6.5);
  sofa(-6.5,-9,5.5);sofa(-10,-5.7,3.7,Math.PI/2);
  cylinder(1,1,.1,BALSA,-6.5,.55,-6.2);cylinder(.14,.3,.55,DARK,-6.5,0,-6.2);plant(-6.5,-6.2,.3,.65);
  cylinder(.5,.5,.5,0x8b9d7d,-4,0,-6);
  for(const x of [-8,-6])roofSpot(x,-8.8,0,'relaxes in the pergola lounge');
  for(const z of [-6.4,-4.8])roofSpot(-9.8,z,Math.PI/2,'relaxes in the pergola lounge');
  const roofGlow=new THREE.MeshStandardMaterial({color:0xffe8b2,emissive:0xffcf83,emissiveIntensity:.8});
  function lantern(x,z){
    box(.42,.06,.42,DARK,x,0,z);box(.42,.06,.42,DARK,x,.65,z);
    const glow=new THREE.Mesh(new THREE.BoxGeometry(.28,.55,.28),roofGlow);glow.position.set(x,.34,z);root.add(glow);
    for(const dx of [-.18,.18])for(const dz of [-.18,.18])box(.035,.6,.035,DARK,x+dx,.05,z+dz);
  }
  for(let x=-10;x<=-2;x+=2){
    box(.02,.35,.02,DARK,x,2.85,-2.1);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),roofGlow);bulb.position.set(x,2.82,-2.1);root.add(bulb);
  }
  for(const [x,z,w,d] of [[-7,11,8,.8],[5,11,8,.8],[7,-11,8,.8],[15,5,.8,6]]){
    box(w,.65,d,0xe7dfce,x,0,z);
    for(let i=-1;i<=1;i++)plant(x+(w>d?i*w*.3:0),z+(d>w?i*d*.3:0),.6,.65);
  }
  for(const [x,z] of [[-11,-11],[-1,-11],[-11,-2],[-1,-2]]){
    for(let i=0;i<4;i++){const leaf=oval(.35,.6,.12,0x718a57,x+.12,2.9-i*.45,z);leaf.rotation.z=i%2?.45:-.45;}
  }
  for(const [x,z] of [[-12,10],[11,10],[-12,-10],[12,-10]])lantern(x,z);
  plant(1,-10.5,1.3);plant(13,-10.5,1.25);restroom(14.55,10.6,2.6,2.5,'-x');
  textPlane('ROOFTOP GARDEN',3,9,8);
  // Rooftop door from the stair core: a white frame with two glass leaves, always open and folded back inside.
  const DOOR_FRAME=0xf6f4ef;
  box(.22,.85,.8,CARD,-16,0,5.9);
  for(const z of [6.3,8.5])box(.14,2.35,.14,DOOR_FRAME,-16,0,z);
  box(.2,.16,2.36,DOOR_FRAME,-16,2.3,7.4);
  for(const [z,dir] of [[6.37,1],[8.43,-1]]){
    const leaf=new THREE.Group();leaf.position.set(-16,0,z);leaf.rotation.y=dir>0?Math.PI/2:-Math.PI/2;root.add(leaf);
    // Hinged at the frame and swung 90 degrees into the rooftop, lying along the edge of the opening.
    box(.06,2.15,1.05,DOOR_FRAME,0,.08,dir*.54,leaf);box(.02,1.9,.86,'glass',0,.2,dir*.54,leaf);box(.08,.05,.3,DARK,.05,1.05,dir*.95,leaf);
  }
  // Ping pong, with a player at each end.
  for(const sx of [-1,1])for(const sz of [-1,1])box(.07,.7,.07,DARK,6+sx*1.2,0,-5.5+sz*.6);
  box(2.74,.05,1.52,0x2f6f8f,6,.7,-5.5);
  for(const z of [-6.24,-4.76])box(2.74,.006,.03,CARD,6,.75,z);box(2.74,.006,.02,CARD,6,.75,-5.5);
  box(.03,.15,1.64,0xf3efe6,6,.75,-5.5);mesh(new THREE.SphereGeometry(.035,10,8),0xf0a531,6.7,1.05,-5.3,root,false);
  roofSpot(4.1,-5.5,Math.PI/2,'plays ping pong',{standing:true,roofPose:'pingpong'});
  roofSpot(7.9,-5.5,-Math.PI/2,'plays ping pong',{standing:true,roofPose:'pingpong'});
  textPlane('PING PONG',6,-3.6,3);
  // Bean bags on a round lawn under a striped parasol.
  cylinder(2.3,2.3,.03,0x9fc17a,4.5,.05,3.2);
  cylinder(.42,.42,.05,BALSA,4.5,.34,3.2);cylinder(.05,.08,.34,DARK,4.5,0,3.2);
  // A tall, narrow cafe parasol, so people on the bean bags stay visible from above.
  cylinder(.035,.035,2.9,CARD,4.5,.39,3.2);
  cylinder(.02,1.05,.4,0xe8634a,4.5,2.95,3.2);cylinder(.02,.6,.22,0xfbf6ee,4.5,3.12,3.2);
  [[0xe8866c,0],[0xe0b04f,Math.PI/2],[0x5f9a94,Math.PI],[0xa594c6,-Math.PI/2]].forEach(([color,a])=>{
    const x=4.5+Math.sin(a)*1.35,z=3.2+Math.cos(a)*1.35;
    oval(1.05,.55,1.05,color,x,.28,z);oval(.9,.7,.4,color,x+Math.sin(a)*.38,.55,z+Math.cos(a)*.38);
    roofSpot(x,z,a+Math.PI,'hangs out on the bean bags',{roofPose:'beanbag'});
  });
  // Swing bench for two, facing the front of the roof.
  for(const x of [9.5,12.1])for(const z of [4.55,5.45])box(.1,2.35,.1,BALSA,x,0,z);
  box(2.75,.12,.12,BALSA,10.8,2.3,5);box(2.75,.12,1,BALSA,10.8,2.35,5);
  for(const x of [9.95,11.65])box(.025,1.72,.025,DARK,x,.6,5.05);
  box(1.9,.08,.6,0xe8866c,10.8,.48,5.05);box(1.9,.55,.07,0xe8866c,10.8,.56,4.78);
  for(const x of [10.35,11.25])roofSpot(x,5.12,0,'sits on the swing');
  // Chess table with two low stools.
  cylinder(.45,.45,.05,BALSA,11.2,.68,-1.3);cylinder(.06,.14,.68,DARK,11.2,0,-1.3);
  {
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    for(let i=0;i<8;i++)for(let j=0;j<8;j++){ctx.fillStyle=(i+j)%2?'#5b4636':'#efe4cf';ctx.fillRect(i*16,j*16,16,16);}
    const texture=new THREE.CanvasTexture(c);texture.encoding=THREE.sRGBEncoding;texture.magFilter=THREE.NearestFilter;
    const board=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),new THREE.MeshBasicMaterial({map:texture}));board.rotation.x=-Math.PI/2;board.position.set(11.2,.735,-1.3);root.add(board);
    for(let i=0;i<6;i++)cylinder(.025,.03,.07+(i%3)*.02,i<3?0xfbf6ee:DARK,11.05+(i%3)*.1,.735,i<3?-1.48:-1.12);
  }
  stool(10.3,-1.3,.45);stool(12.1,-1.3,.45);
  roofSpot(10.3,-1.3,Math.PI/2,'plays chess');roofSpot(12.1,-1.3,-Math.PI/2,'plays chess');
  // Two yoga mats by the back planter.
  for(const [x,color] of [[10.1,0x7fa98a],[11.7,0xd98f7a]]){
    box(.7,.02,1.8,color,x,.06,-8.3);
    roofSpot(x,-8.1,0,'stretches on a yoga mat',{standing:true,roofPose:'stretch'});
  }
  // Flower bed in the middle of the deck.
  box(2.6,.4,.9,0xe7dfce,1.6,0,-1.2);
  for(let i=0;i<9;i++)oval(.26,.26,.26,[0xe8634a,0xf0c24f,0xf3efe6,0xa594c6][i%4],.6+(i%5)*.5,.5+(i%2)*.08,-1.45+Math.floor(i/5)*.5);
  // Billiard table, front left.
  for(const sx of [-1,1])for(const sz of [-1,1])box(.16,.72,.16,0x5a3d2a,-6+sx*1.25,0,6+sz*.6);
  box(2.9,.14,1.6,0x6b4a33,-6,.72,6);box(2.6,.02,1.3,0x3d7a5a,-6,.86,6);
  for(const x of [-7.35,-6,-4.65])for(const z of [5.3,6.7])cylinder(.07,.07,.02,DARK,x,.87,z);
  [[CARD,-5.2,6],[ACCENT,-6.7,6],[0xd8a13a,-6.8,5.93],[0xd8a13a,-6.8,6.07],[0x2f4a6b,-6.9,5.86],[DARK,-6.9,6],[0x3f7a58,-6.9,6.14]]
    .forEach(([color,x,z])=>mesh(new THREE.SphereGeometry(.05,12,8),color,x,.93,z,root,false));
  const spareCue=mesh(new THREE.CylinderGeometry(.012,.02,1.45,8),BALSA,-6,.9,5.25,root,false);spareCue.rotation.z=Math.PI/2;
  textPlane('BILLIARDS',-6,8.1,3);
  roofSpot(-8,6.3,Math.PI/2,'plays billiards',{standing:true,roofPose:'billiard'});
  roofSpot(-4,5.7,-Math.PI/2,'plays billiards',{standing:true,roofPose:'billiard'});
  // Coffee bar along the right parapet.
  box(.8,1,4,0x8a6a4a,15.2,0,-1);box(.9,.06,4.1,CARD,15.2,1,-1);
  box(.5,.6,.45,DARK,15.25,1.06,-2.2);box(.3,.08,.25,0x8a8479,15.1,1.06,-2.2);
  cylinder(.12,.14,.45,DARK,15.25,1.06,-1.5);
  for(const z of [-.7,-.35,0,.35])cylinder(.07,.06,.14,CARD,15,1.06,z);
  for(const z of [-2.4,.4])cylinder(.2,.22,.72,DARK,14.3,0,z);
  textPlane('COFFEE',13.2,2.3,2.4);
  for(let i=0;i<13;i++)box(.06,.85,.035,0xc9a577,14.78,.08,-2.8+i*.3);
  for(const y of [1.8,2.3])box(.65,.07,4.2,BALSA,15.5,y,-1);
  for(const z of [-2.5,-1.5,-.5,.5]){plant(15.5,z,.22,2.37);cylinder(.08,.07,.17,CARD,15.45,1.87,z);}
  roofSpot(14.1,-1,Math.PI/2,'grabs a coffee at the rooftop bar',{standing:true,roofPose:'coffee'});

  function flight(x,z1,z2,y1,y2,parent) {
    const steps=16,run=(z2-z1)/steps,rise=(y2-y1)/steps;
    for(let i=0;i<steps;i++){
      box(2.4,.18,Math.abs(run)+.015,0xcfc8ba,x,y1+rise*(i+1)-.18,z1+run*(i+.5),parent);
      if(i%4===0)for(const side of [-1,1])box(.045,.95,.045,DARK,x+side*1.15,y1+rise*(i+1),z1+run*(i+.5),parent);
    }
    for(const side of [-1,1]){
      const a=new THREE.Vector3(x+side*1.15,y1+.95,z1),b=new THREE.Vector3(x+side*1.15,y2+.95,z2);
      const rail=mesh(new THREE.CylinderGeometry(.035,.035,a.distanceTo(b),8),DARK,0,0,0,parent,false);
      rail.position.copy(a).add(b).multiplyScalar(.5);rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());
    }
  }
  for(let lower=1;lower<=3;lower++){
    const bridge=new THREE.Group();bridge.position.y=floorY(lower);stairways[lower]=bridge;scene.add(bridge);
    box(3.7,.18,2.6,0xcfc8ba,-17.15,-.18,7,bridge);
    const half=FLOOR_GAP/2;
    flight(-18.5,7,1,0,half,bridge);
    box(5.5,.18,2.6,0xcfc8ba,-20,half-.18,1,bridge);
    flight(-21.5,1,7,half,FLOOR_GAP,bridge);
    box(7,.18,2.6,0xcfc8ba,-19,FLOOR_GAP-.18,7,bridge);
    for(const x of [-22.75,-17.25])box(.08,1.05,2.6,DARK,x,half,1,bridge);
  }
  // Glass curtain walls for the whole-building view: floors 1 to 3 are enclosed storeys, the stair core is glazed too.
  const facade=new THREE.Group();scene.add(facade);facade.visible=false;
  // Each storey's glass sits in its own group so it can travel and fade with that floor during camera transitions.
  const facadeLevels={};
  function glazing(w,h,d,x,y,z,parent){box(w,h,d,'roofglass',x,y,z,parent);}
  // White frame, as in the building reference: slab edges and mullions are white, the glass stays clear.
  const FRAME=0xf6f4ef;
  for(let level=1;level<=4;level++){
    const y=floorY(level),h=FLOOR_GAP-.48,lg=new THREE.Group();facade.add(lg);facadeLevels[level]=lg;
    // A white slab edge wraps each storey; it knows its level so a click on it enters that floor.
    const edge=box(33.4,.56,25.4,FRAME,0,y-.54,0,lg);edge.userData.level=level;
    if(level===4){
      // Rooftop: a glass balustrade with a white handrail on the parapet.
      // The left side stops at the stair door (z 5.5 to 8.5), where the rooftop door stands open.
      for(const [w,d,x,z] of [[33,.05,0,12.55],[33,.05,0,-12.55],[.05,25,16.55,0],[.05,18,-16.55,-3.5],[.05,4,-16.55,10.5]]){
        glazing(w,1.15,d,x,y,z,lg);box(Math.max(w,.12),.08,Math.max(d,.12),FRAME,x,y+1.15,z,lg);
      }
      continue;
    }
    if(level===1)glazing(16.5,h,.05,-8.25,y,12.55,lg);else glazing(33,h,.05,0,y,12.55,lg);
    glazing(33,h,.05,0,y,-12.55,lg);glazing(.05,h,25,16.55,y,0,lg);
    glazing(.05,h,12.4,-16.55,y,-6.3,lg);glazing(.05,h,3.6,-16.55,y,10.7,lg);
    for(let x=-16.5;x<=16.51;x+=33/8)for(const z of [-12.55,12.55])if(level!==1||z<0||x<.1)box(.14,h,.14,FRAME,x,y,z,lg);
    // The parking entrance keeps two structural columns and a header beam, wide enough for cars.
    if(level===1){for(const x of [8.25,16.5])box(.3,h,.3,FRAME,x,y,12.55,lg);box(16.5,.35,.3,FRAME,8.25,y+h-.35,12.55,lg);}
    for(let z=-12.5;z<=12.51;z+=25/6)box(.14,h,.14,FRAME,16.55,y,z,lg);
    for(const z of [-12.55,-.1,4.9,8.9,12.55])box(.14,h,.14,FRAME,-16.55,y,z,lg);
  }
  {
    // The stair core rises well above the rooftop floor, so people arriving on the last flight keep their heads inside it.
    const top=floorY(4)+2.7;
    glazing(.05,top,9.6,-23.3,0,3.9,facade);glazing(7,top,.05,-19.8,0,8.7,facade);glazing(7,top,.05,-19.8,0,-.9,facade);
    for(const [x,z] of [[-23.3,-.9],[-23.3,8.7],[-16.6,-.9],[-16.6,8.7]])box(.16,top,.16,FRAME,x,0,z,facade);
    box(7.1,.12,9.9,FRAME,-19.95,top,3.9,facade);
  }
  facade.traverse(o=>{o.castShadow=false;});
  const eveningLights=new THREE.Group();scene.add(eveningLights);eveningLights.visible=false;
  const lampMaterial=new THREE.MeshStandardMaterial({color:0xffdda0,emissive:0xffbb66,emissiveIntensity:1.6,roughness:.5});
  for(let level=1;level<=4;level++){
    const y=floorY(level);
    const strip=new THREE.Mesh(new THREE.BoxGeometry(31,.07,.08),lampMaterial);strip.position.set(0,y+.12,12.15);eveningLights.add(strip);
    const light=new THREE.PointLight(0xffce8c,.9,38,1);light.position.set(0,y+3,1);eveningLights.add(light);
    for(const x of [-15,15]){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.32,.55,.32),lampMaterial);lamp.position.set(x,y+.3,10.5);eveningLights.add(lamp);
    }
  }
  function buildingMood(on){
    // Bright late-morning city: warm sun, soft sky fill, interior lamps still glowing through the glass.
    document.body.classList.toggle('building-view',on);eveningLights.visible=on;
    scene.background.set(on?0xeae6dc:PAPER);scene.fog=on?new THREE.FogExp2(0xeae6dc,.003):null;
    ambient.color.set(on?0xf4f8ff:0xffffff);ambient.intensity=on?.6:.8;
    sun.color.set(on?0xffe6c4:0xffeed5);sun.intensity=on?1.05:.75;
    applyOfficeMood();
  }
  function applyOfficeMood(){
    const hour=new Date().getHours(),choice=window.officeLife.preferences.mood;
    const mood=choice==='auto'?(hour<6||hour>=19?'night':hour<12?'morning':hour<16?'afternoon':'evening'):choice;
    const styles={morning:[0xece9df,0xffeed5,.8,.85],afternoon:[0xebe5d8,0xfff4dd,.85,1],evening:[0xe0c6ae,0xffc185,.6,.55],night:[0x28374a,0xaec6ed,.48,.24]};
    const [sky,tint,fill,direct]=styles[mood];scene.background.set(sky);if(scene.fog)scene.fog.color.set(sky);ambient.intensity=fill;sun.color.set(tint);sun.intensity=direct;
    eveningLights.visible=activeFloor===0||mood==='night'||mood==='evening';
    $('moodDescription').textContent=`${mood[0].toUpperCase()+mood.slice(1)} lighting${choice==='auto'?' · Your device’s local time':''}.`;
    currentMood=mood;
  }
  // Parts that fade during camera transitions get their own material copies, so floors keep full opacity.
  function prepareFade(root){root.traverse(o=>{if(!o.material)return;o.material=o.material.clone();o.material.transparent=true;o.userData.baseOpacity=o.material.opacity;});}
  function setFade(root,alpha){root.visible=alpha>.001;root.traverse(o=>{if(o.userData.baseOpacity!==undefined)o.material.opacity=o.userData.baseOpacity*alpha;});}
  prepareFade(facade);Object.values(stairways).forEach(prepareFade);doorPads.forEach(prepareFade);
  function stairRoute(from,to){
    const lower=Math.min(from,to),base=floorY(lower),half=FLOOR_GAP/2;
    // Door and landing sit at z 7.5, clear of the floor-3 column at z 6.5, so both lanes fit through the doorway.
    const points=[[-16,base,7.5],[-18.5,base,7.5]];
    for(let i=1;i<=16;i++)points.push([-18.5,base+half*i/16,7-6*i/16]);
    points.push([-21.5,base+half,1]);
    for(let i=1;i<=16;i++)points.push([-21.5,base+half+half*i/16,1+6*i/16]);
    points.push([-18.5,base+FLOOR_GAP,7.5],[-16,base+FLOOR_GAP,7.5]);
    // People going up keep to one side of the flights and people coming down to the other, so they pass instead of colliding.
    const lane=to>from?.35:-.35,ordered=to>from?points:points.reverse();
    return ordered.map(([x,y,z],k)=>{
      const [px,,pz]=ordered[Math.max(0,k-1)],[nx,,nz]=ordered[Math.min(ordered.length-1,k+1)],dx=nx-px,dz=nz-pz,d=Math.hypot(dx,dz)||1;
      return new THREE.Vector3(x-dz/d*lane,y,z+dx/d*lane);
    });
  }
  // attach() re-derives Euler angles from the matrix, which turns a yaw past 90 degrees into (PI, PI-yaw, PI). Everything
  // else only turns rotation.y, so that would mirror the person's heading. Floors and stairs never rotate, so the yaw carries over.
  function moveTo(parent,g){const yaw=new THREE.Euler().setFromQuaternion(g.getWorldQuaternion(new THREE.Quaternion()),'YXZ').y;parent.attach(g);g.rotation.set(0,yaw,0);}
  function beginStairs(agent){
    const next=agent.floor+Math.sign(agent.destination.floor-agent.floor);
    floors[agent.floor].updateMatrixWorld(true);moveTo(travelRoot,agent.g);
    agent.stairTrip={from:agent.floor,to:next,points:stairRoute(agent.floor,next)};
    agent.state='stairs';agent.g.visible=true;
  }
  function visibleAgent(agent){
    // The outside stairs only exist in the building view; a single floor shows just that floor.
    return agent.state==='stairs'?stairsShown:floors[agent.floor].visible;
  }


  // Surroundings for the whole-building view only: a round paper base with streets, other buildings, clouds and birds.
  const skyline=new THREE.Group();scene.add(skyline);skyline.visible=false;
  {
    let seed=29;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
    const PAVEMENT=0xe4dfd3,LAWN=0xa9cc7a,SIDEWALK=0xf1eee7,ASPHALT=0xa9a8a3,LINE=0xfbfaf6;
    mesh(new THREE.CylinderGeometry(150,150,.4,64),PAVEMENT,0,-1.1,0,skyline,false);
    // The office sits on its own lawn, bounded by sidewalks on the two streets.
    box(66,.02,46,LAWN,-6,-.9,-4.5,skyline).children.forEach(line=>line.visible=false);
    const flat=(w,d,color,x,y,z)=>{const m=box(w,.02,d,color,x,y,z,skyline);m.children.forEach(line=>line.visible=false);return m;};
    for(const z of [19.8,28.2])flat(290,2.4,SIDEWALK,0,-.89,z);
    for(const x of [29.8,38.2])flat(2.4,290,SIDEWALK,x,-.89,0);
    flat(290,6,ASPHALT,0,-.88,24);flat(6,290,ASPHALT,34,-.875,0);
    // Driveway from the parking entrance down to the street.
    flat(14,8.5,0xd6d1c6,8.25,-.885,16.75);for(const x of [3,13.5])flat(.2,8.5,LINE,x,-.86,16.75);
    for(let i=-140;i<=140;i+=8){if(Math.abs(i-34)>5)flat(3,.25,LINE,i,-.86,24);if(Math.abs(i-24)>5)flat(.25,3,LINE,34,-.86,i);}
    // Zebra crossings at the corner.
    for(let k=0;k<6;k++){flat(.5,5,LINE,27.4-k*.9,-.855,24);flat(5,.5,LINE,34,-.855,17.4-k*.9);}
    const tones=[0xf3eee4,0xe9e2d4,0xf7f3ec,0xe1d9ca];
    for(let placed=0,tries=0;placed<64&&tries<600;tries++){
      const a=rnd()*Math.PI*2,dist=40+rnd()*100,x=Math.cos(a)*dist,z=Math.sin(a)*dist,w=6+rnd()*7,d=6+rnd()*7;
      if(Math.hypot(x,z)+Math.max(w,d)>145)continue;
      if(Math.abs(z-24)<d/2+6||Math.abs(x-34)<w/2+6)continue;
      if(x>-40&&x<28&&z>-28&&z<22)continue;
      // Near blocks stay low so they never hide the office from the default camera; far ones rise higher.
      const h=dist<65?4+rnd()*10:8+rnd()*(dist/140)*42;
      flat(w+3,d+3,rnd()<.5?LAWN:SIDEWALK,x,-.895,z);
      box(w,h,d,tones[placed%4],x,-.9,z,skyline);
      for(let y=2;y<h-1;y+=2.6)box(w+.04,.55,d+.04,0xbfd3d9,x,-.9+y,z,skyline).children.forEach(line=>line.visible=false);
      if(rnd()<.35)flat(w*.8,d*.8,0x9fbf73,x,h-.88,z);else if(rnd()<.5)box(w*.35,1.2,d*.35,0xcfc8ba,x,h-.9,z,skyline);
      placed++;
    }
    // Round, full trees drawn as three instanced batches (trunks and two leaf tones), so hundreds stay cheap.
    const trees=[];
    const clearOfRoads=(x,z)=>Math.abs(z-24)>4.2&&Math.abs(x-34)>4.2;
    for(let x=-140;x<=140;x+=7)for(const z of [18.4,29.6])if(clearOfRoads(x,z)&&(x<0||x>16.5)&&Math.hypot(x,z)<142)trees.push([x,z,.9+rnd()*.3]);
    for(let z=-140;z<=140;z+=7)for(const x of [28.4,39.6])if(clearOfRoads(x,z)&&Math.hypot(x,z)<142)trees.push([x,z,.9+rnd()*.3]);
    // Trees around the office lawn, clear of the building, the outside stairs and the driveway.
    for(const [x,z,s] of [[-30,-20,1.4],[-34,-8,1.2],[-32,6,1.3],[-30,15,1.1],[-24,-22,1.2],[-12,-22,1.3],[0,-23,1.1],[12,-22,1.4],[22,-18,1.2],[23,-6,1.1],[22,6,1.3],[21,15,1],[-8,17,.8],[-14,17,.7],[-2,17.5,.7],[-26,17,.9]])trees.push([x,z,s]);
    for(let placed=0,tries=0;placed<130&&tries<900;tries++){
      const a=rnd()*Math.PI*2,dist=30+rnd()*112,x=Math.cos(a)*dist,z=Math.sin(a)*dist;
      if(x>-40&&x<28&&z>-28&&z<22)continue;
      if(!clearOfRoads(x,z)||Math.abs(z-24)<6.5||Math.abs(x-34)<6.5)continue;
      trees.push([x,z,.8+rnd()*.7]);placed++;
    }
    const PUFFS=[[0,2.3,0,1.25],[.6,1.85,.4,.95],[-.55,1.95,-.35,1]],GREENS=[0x6fa84a,0x8cc05a,0x5f9640];
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.24,1.6,6),material(0x7a5e45),trees.length);
    const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85}),trees.length*PUFFS.length);
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),sc=new THREE.Vector3(),tint=new THREE.Color();
    trees.forEach(([x,z,s],i)=>{
      trunks.setMatrixAt(i,m4.compose(v.set(x,-.9+.8*s,z),q.identity(),sc.set(s,s,s)));
      PUFFS.forEach(([dx,dy,dz,r],k)=>{
        const slot=i*PUFFS.length+k;
        leaves.setMatrixAt(slot,m4.compose(v.set(x+dx*s,-.9+dy*s,z+dz*s),q.identity(),sc.set(r*s,r*s*.92,r*s)));
        leaves.setColorAt(slot,tint.copy(linear(GREENS[(i+k)%3])));
      });
    });
    for(const inst of [trunks,leaves]){inst.instanceMatrix.needsUpdate=true;inst.receiveShadow=true;skyline.add(inst);}
    leaves.instanceColor.needsUpdate=true;
  }
  const clouds=[];
  {
    let seed=71;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
    for(let i=0;i<12;i++){
      // A ring just past the city edge: always in the distance, whichever way the camera turns.
      const a=i/12*Math.PI*2+rnd()*.3,dist=150+rnd()*25;
      const cloud=new THREE.Group();cloud.position.set(Math.cos(a)*dist,15+rnd()*10,Math.sin(a)*dist);skyline.add(cloud);
      for(let k=0;k<4;k++){const puff=mesh(new THREE.IcosahedronGeometry(4+rnd()*4,0),0xfbf9f4,k*5-7,rnd()*2,rnd()*4-2,cloud);puff.scale.y=.55;}
      clouds.push({cloud,speed:1+rnd()*1.5});
    }
  }
  const birds=[];
  for(let i=0;i<8;i++){
    const bird=new THREE.Group(),wings=[];skyline.add(bird);
    box(.22,.16,.7,DARK,0,-.08,0,bird);
    for(const side of [-1,1]){const pivot=new THREE.Group();bird.add(pivot);box(.9,.04,.36,DARK,side*.45,0,0,pivot);wings.push(pivot);}
    birds.push({bird,wings,radius:28+i*4,height:30+(i%4)*7,speed:(.18+(i%3)*.05)*(i%2?1:-1),angle:i*.8});
  }
  // Traffic on both streets: each vehicle keeps to its lane and loops back at the edge of the city base.
  const traffic=[];
  {
    const paints=[0xd6d0c4,0x6f8580,0xb4623a,0x2f4a6b,0xd8a13a,0x8a8479,0x3f7a58];
    function vehicle(kind,color){
      const v=new THREE.Group();skyline.add(v);
      if(kind==='bus'){box(2.3,1.9,7,color,0,-.6,0,v);box(2.34,.6,6.4,SCREEN,0,.35,0,v);}
      else if(kind==='bike'){box(.35,.5,1.5,color,0,-.5,0,v);box(.4,.55,.4,DARK,0,0,-.1,v);}
      else{box(2,.6,4,color,0,-.5,0,v);box(1.7,.55,2.1,color,0,.1,-.2,v);box(1.72,.4,.03,SCREEN,0,.18,.87,v);}
      for(const sz of kind==='bike'?[-.6,.6]:[-1,1])for(const sx of kind==='bike'?[0]:[-1,1]){
        const w=cylinder(.3,.3,.18,DARK,sx*(kind==='bus'?1.15:kind==='bike'?0:1),-.9,sz*(kind==='bus'?2.4:kind==='bike'?1:1.3),v);w.rotation.z=Math.PI/2;
      }
      return v;
    }
    let seed=53;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
    // Lanes: [axis, fixed coordinate, direction]. The street along x sits at z=24, the one along z at x=34.
    const lanes=[['x',22.5,1],['x',25.5,-1],['z',32.5,-1],['z',35.5,1]];
    // One speed per lane, so vehicles keep their gaps and never overtake each other.
    lanes.forEach((lane,li)=>{const laneSpeed=8+li*.8;for(let i=0;i<5;i++){
      const kind=rnd()<.15?'bus':rnd()<.3?'bike':'car';
      traffic.push({v:vehicle(kind,paints[(li*5+i)%paints.length]),lane,pos:-130+i*54+rnd()*14,speed:laneSpeed});
    }});
  }
  skyline.traverse(o=>{o.castShadow=false;});prepareFade(skyline);
  function animateSky(dt){
    for(const c of traffic){
      c.pos+=c.speed*dt;if(c.pos>135)c.pos=-135;
      const [axis,fixed,dir]=c.lane,along=c.pos*dir;
      if(axis==='x'){c.v.position.set(along,0,fixed);c.v.rotation.y=dir>0?Math.PI/2:-Math.PI/2;}
      else{c.v.position.set(fixed,0,along);c.v.rotation.y=dir>0?0:Math.PI;}
    }
    // Clouds drift slowly around the ring.
    for(const c of clouds){const p=c.cloud.position,r=Math.hypot(p.x,p.z),a=Math.atan2(p.z,p.x)+c.speed*dt/r;p.x=Math.cos(a)*r;p.z=Math.sin(a)*r;}
    for(const b of birds){
      b.angle+=b.speed*dt;
      b.bird.position.set(Math.cos(b.angle)*b.radius-3,b.height+Math.sin(b.angle*3)*1.5,Math.sin(b.angle)*b.radius);
      b.bird.rotation.y=-b.angle+(b.speed>0?Math.PI:0);
      const flap=Math.sin(simTime*9+b.radius)*.6;b.wings[0].rotation.z=-flap;b.wings[1].rotation.z=flap;
    }
  }
  const rand=(min,max)=>min+Math.random()*(max-min),pick=list=>list[Math.floor(Math.random()*list.length)];
  const shuffle=list=>list.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(p=>p[1]);
  const bubbleMaterial=(()=>{
    const c=document.createElement('canvas');c.width=128;c.height=80;const ctx=c.getContext('2d');
    ctx.fillStyle='#faf7f0';ctx.strokeStyle='#2a2622';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(22,4);ctx.lineTo(106,4);ctx.quadraticCurveTo(124,4,124,22);ctx.lineTo(124,44);ctx.quadraticCurveTo(124,62,106,62);
    ctx.lineTo(56,62);ctx.lineTo(40,77);ctx.lineTo(42,62);ctx.lineTo(22,62);ctx.quadraticCurveTo(4,62,4,44);ctx.lineTo(4,22);ctx.quadraticCurveTo(4,4,22,4);ctx.fill();ctx.stroke();
    ctx.fillStyle='#2a2622';for(const x of [42,64,86]){ctx.beginPath();ctx.arc(x,33,6,0,Math.PI*2);ctx.fill();}
    const texture=new THREE.CanvasTexture(c);texture.encoding=THREE.sRGBEncoding;
    return new THREE.SpriteMaterial({map:texture});
  })();

  const SKIN=0xe5ba91,HAIR=0x2f2925,TROUSERS=0x38414c,SHOES=0x2a2622,FIGURE_SCALE=1;
  const part=(geometry,color,x,y,z,parent)=>mesh(geometry,color,x,y,z,parent,false);

  function softBox(w,h,d){
    const key=[w,h,d].join('/');if(softShapes.has(key))return softShapes.get(key);
    const radius=Math.min(w,h,d)*.22,shape=new THREE.BoxGeometry(w,h,d,4,4,4);
    const points=shape.attributes.position,inner=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let i=0;i<points.count;i++){
      normal.fromBufferAttribute(points,i);
      inner.set(Math.max(-w/2+radius,Math.min(w/2-radius,normal.x)),Math.max(-h/2+radius,Math.min(h/2-radius,normal.y)),Math.max(-d/2+radius,Math.min(d/2-radius,normal.z)));
      normal.sub(inner).normalize().multiplyScalar(radius).add(inner);points.setXYZ(i,normal.x,normal.y,normal.z);
    }
    shape.computeVertexNormals();softShapes.set(key,shape);return shape;
  }
  function blendPose(rig,leg,arm,y,z,lean,dt,sway=0){
    const k=rig.posed?1-Math.exp(-dt*12):1;rig.posed=true;
    const ease=(object,key,value)=>{object[key]+=(value-object[key])*k;};
    rig.legs.forEach(({thigh,knee},i)=>{ease(thigh.rotation,'x',leg[i][0]);ease(knee.rotation,'x',leg[i][1]);});
    rig.arms.forEach(({shoulder,elbow},i)=>{ease(shoulder.rotation,'x',arm[i][0]);ease(shoulder.rotation,'z',(i?1:-1)*arm[i][1]);ease(elbow.rotation,'x',arm[i][2]);});
    ease(rig.body.position,'y',y);ease(rig.body.position,'z',z);ease(rig.hips.rotation,'x',lean);ease(rig.hips.rotation,'z',sway);
  }
  function joint(parent,x,y,z,length,width,color){
    const pivot=new THREE.Group();pivot.position.set(x,y,z);parent.add(pivot);
    part(softBox(width,length,width*.92),color,0,-length/2,0,pivot);
    return pivot;
  }
  function buildFigure(shirt,gender,index){
    const figure=new THREE.Group();figure.scale.setScalar(FIGURE_SCALE);
    const body=new THREE.Group();figure.add(body);
    const hips=new THREE.Group();hips.position.y=.88;body.add(hips);
    part(softBox(.55,.17,.35),TROUSERS,0,.015,0,hips);
    oval(.64,.7,.43,shirt,0,.38,0,hips);
    part(softBox(.13,.14,.13),SKIN,0,.75,0,hips);
    const head=new THREE.Group();head.position.y=1.02;hips.add(head);
    oval(.68,.7,.61,SKIN,0,.03,0,head);
    oval(.72,.38,.65,HAIR,0,.25,-.055,head);
    for(let i=0;i<5;i++){
      const lock=oval(.23,.27,.23,HAIR,-.27+i*.13,.27+Math.sin(i)*.035,.18,head);lock.rotation.z=-.3+i*.1;
    }
    for(const side of [-1,1]){
      oval(.12,.19,.13,SKIN,side*.33,0,0,head);
      oval(.058,.088,.03,HAIR,side*.13,.025,.293,head);
      oval(.016,.023,.012,0xffffff,side*.13-.01,.043,.31,head);
      oval(.1,.04,.016,0xd59a80,side*.19,-.09,.275,head);
    }
    oval(.085,.065,.08,SKIN,0,-.04,.3,head);
    oval(.09,.026,.02,0x895d4c,0,-.15,.286,head);
    if(gender==='female'){
      oval(.65,.68,.27,HAIR,0,-.13,-.25,head);
      for(const side of [-1,1])oval(.18,.55,.28,HAIR,side*.29,-.12,-.06,head);
      if(index%2===0)oval(.32,.33,.32,HAIR,.19,.4,-.23,head);
    }else{
      oval(.62,.35,.22,HAIR,0,.11,-.27,head);
      oval(.35,.23,.35,HAIR,.14,.39,-.03,head);
    }
    const legs=[-1,1].map(sx=>{
      const thigh=joint(hips,sx*.155,-.03,0,.38,.25,TROUSERS);
      const knee=joint(thigh,0,-.38,0,.39,.24,TROUSERS);
      part(softBox(.27,.12,.38),SHOES,0,-.41,.055,knee);
      return {thigh,knee};
    });
    const arms=[-1,1].map(sx=>{
      const shoulder=joint(hips,sx*.425,.65,0,.33,.23,shirt);
      const elbow=joint(shoulder,0,-.33,0,.29,.2,SKIN);
      oval(.23,.22,.23,SKIN,0,-.31,0,elbow);
      return {shoulder,elbow};
    });
    const cup=part(new THREE.CylinderGeometry(.08,.07,.17,10),CARD,0,-.36,.13,arms[1].elbow);
    const phone=part(softBox(.045,.25,.14),SHOES,-.1,-.34,0,arms[1].elbow);
    cup.visible=phone.visible=false;
    return {figure,body,hips,head,legs,arms,cup,phone};
  }
  function character(person,index) {
    const g=new THREE.Group(),rig=buildFigure(GROUPS[person.group].color,person.gender,index);g.add(rig.figure);
    rig.cue=mesh(new THREE.CylinderGeometry(.012,.02,1.45,8),BALSA,0,-.3,0,rig.arms[1].elbow,false);rig.cue.visible=false;
    rig.wateringCan=new THREE.Group();rig.arms[1].elbow.add(rig.wateringCan);rig.wateringCan.position.set(0,-.35,.12);
    mesh(new THREE.CylinderGeometry(.12,.12,.2,12),ACCENT,0,0,0,rig.wateringCan,false);
    const spout=mesh(new THREE.CylinderGeometry(.025,.045,.25,8),ACCENT,0,.02,.18,rig.wateringCan,false);spout.rotation.x=1.1;
    const handle=mesh(new THREE.TorusGeometry(.12,.025,6,12),ACCENT,0,.12,-.04,rig.wateringCan,false);handle.rotation.y=Math.PI/2;rig.wateringCan.visible=false;
    const bubble=new THREE.Sprite(bubbleMaterial);bubble.scale.set(.75,.45,1);bubble.center.set(-.3,-.1);bubble.visible=false;g.add(bubble);
    const label=document.createElement('button');label.className='name-label';label.type='button';label.textContent=person.initials;
    label.title=`${person.initials}, ${person.role}`;label.setAttribute('aria-label',`View ${person.initials}, ${person.role}`);$('labels').append(label);
    const desk=desks[person.n];g.position.set(desk.x,0,desk.z);g.rotation.y=facing(desk);floors[3].add(g);
    const aisle=desk.route[0][0],stretchZ=desk.z-desk.f*.95;
    const stretchSpot={x:desk.x,z:stretchZ,f:desk.f,floor:3,route:[[aisle,P3],[aisle,stretchZ]],state:'stretch',local:true,label:'Standing up'};
    const agent={...person,index,g,rig,bubble,label,desk,stretchSpot,heading:facing(desk),floor:3,spot:desk,path:[],destination:desk,state:'work',stairTrip:null,activity:null,visitor:null,nextRoutine:rand(6,25)};
    label.onclick=()=>selectAgent(agent);g.traverse(o=>{o.userData.agent=agent;});return agent;
  }

  // Walking grid per floor, rasterised from the furniture itself: anything between ankle and head height blocks,
  // grown by a body radius. Built once, before any people are placed, so only the static office counts.
  // Cells are 0 open, 1 furniture (a seat can be reached through it) or 2 wall (walls, glass, partitions: never crossed).
  const NAV={cell:.2,x0:-16.4,z0:-12.4,w:164,h:124,clear:.22,soft:.16};
  const navGrids={};
  for(const [key,root] of Object.entries(floors)){
    const grid=new Uint8Array(NAV.w*NAV.h),bounds=new THREE.Box3(),y0=root.position.y;root.updateMatrixWorld(true);
    root.traverse(o=>{
      if(!o.isMesh||o.material?.isMeshBasicMaterial)return;
      for(let a=o;a;a=a.parent)if(a.userData.walkable)return;
      bounds.setFromObject(o);
      if(bounds.max.y-y0<.18||bounds.min.y-y0>1.75)return;
      const sx=bounds.max.x-bounds.min.x,sz=bounds.max.z-bounds.min.z;
      const wall=bounds.max.y-y0>1.9||Math.min(sx,sz)<.3&&Math.max(sx,sz)>1.2,value=wall?2:1,pad=wall?NAV.clear:NAV.soft;
      const i0=Math.max(0,Math.floor((bounds.min.x-pad-NAV.x0)/NAV.cell)),i1=Math.min(NAV.w-1,Math.floor((bounds.max.x+pad-NAV.x0)/NAV.cell));
      const j0=Math.max(0,Math.floor((bounds.min.z-pad-NAV.z0)/NAV.cell)),j1=Math.min(NAV.h-1,Math.floor((bounds.max.z+pad-NAV.z0)/NAV.cell));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(grid[j*NAV.w+i]<value)grid[j*NAV.w+i]=value;
    });
    navGrids[key]=grid;
  }
  const cellOf=(x,z)=>[Math.floor((x-NAV.x0)/NAV.cell),Math.floor((z-NAV.z0)/NAV.cell)];
  const centerOf=(i,j)=>[NAV.x0+(i+.5)*NAV.cell,NAV.z0+(j+.5)*NAV.cell];
  const open=(grid,i,j)=>i>=0&&j>=0&&i<NAV.w&&j<NAV.h&&!grid[j*NAV.w+i];
  // The open cell closest to a seat or a standing spot, searched through furniture but never through a wall,
  // so the last step into a chair never crosses glass.
  function nearestOpen(grid,i,j){
    const W=NAV.w,seen=new Set([j*W+i]),queue=[[i,j]];
    for(let k=0;k<queue.length&&k<3000;k++){
      const [ci,cj]=queue[k];if(open(grid,ci,cj))return [ci,cj];
      for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const ni=ci+di,nj=cj+dj,key=nj*W+ni;
        if(ni<0||nj<0||ni>=W||nj>=NAV.h||seen.has(key)||grid[key]===2)continue;
        seen.add(key);queue.push([ni,nj]);
      }
    }
    return null;
  }
  function sightLine(grid,ax,az,bx,bz){
    const steps=Math.ceil(Math.hypot(bx-ax,bz-az)/(NAV.cell*.5));
    for(let k=1;k<steps;k++){const [i,j]=cellOf(ax+(bx-ax)*k/steps,az+(bz-az)*k/steps);if(!open(grid,i,j))return false;}
    return true;
  }
  // Where to step off the open floor into a seat: from behind the chair (so neighbours at a table use different
  // gaps), or from the front for sofas and swings; whichever side crosses less furniture on the last step.
  function approachCell(grid,to,seat){
    if(!seat||seat.standing||seat.angle===undefined&&seat.f===undefined)return nearestOpen(grid,...cellOf(...to));
    const a=facing(seat),fx=Math.sin(a),fz=Math.cos(a),options=[];
    for(const side of [-1,1]){
      const cell=nearestOpen(grid,...cellOf(to[0]+fx*side*.8,to[1]+fz*side*.8));if(!cell)continue;
      const [cx,cz]=centerOf(...cell),steps=Math.ceil(Math.hypot(cx-to[0],cz-to[1])/(NAV.cell*.5));let crossed=0;
      for(let k=1;k<steps;k++){const [i,j]=cellOf(to[0]+(cx-to[0])*k/steps,to[1]+(cz-to[1])*k/steps);if(!open(grid,i,j))crossed++;}
      options.push({cell,cost:crossed+(side<0?0:.5)});
    }
    options.sort((p,q)=>p.cost-q.cost);
    return options[0]?.cell||nearestOpen(grid,...cellOf(...to));
  }
  // A* over the grid (8 neighbours, no corner cutting), then string-pulled into a few straight legs.
  function navPath(level,from,to,self,seat=null,leaving=null){
    const base=navGrids[level];if(!base)return null;
    const grid=base.slice();
    // People standing still are obstacles too; seated people are already covered by their chair.
    for(const o of agents){
      if(o===self||o.floor!==level||o.state==='walk'||o.state==='stairs'||(SIT.has(o.state)&&!o.spot?.standing))continue;
      const q=o.g.position;if(Math.hypot(q.x-to[0],q.z-to[1])<.5||Math.hypot(q.x-from[0],q.z-from[1])<.5)continue;
      const [ci,cj]=cellOf(q.x,q.z);
      for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++)if(di*di+dj*dj<=5&&ci+di>=0&&cj+dj>=0&&ci+di<NAV.w&&cj+dj<NAV.h)grid[(cj+dj)*NAV.w+ci+di]||=1;
    }
    const s=approachCell(grid,from,leaving),g=approachCell(grid,to,seat);if(!s||!g)return null;
    const W=NAV.w,N=W*NAV.h,start=s[1]*W+s[0],goal=g[1]*W+g[0];
    const cost=new Float32Array(N).fill(Infinity),came=new Int32Array(N).fill(-1),done=new Uint8Array(N);
    const heap=[],push=(node,f)=>{heap.push([f,node]);let k=heap.length-1;while(k){const up=(k-1)>>1;if(heap[up][0]<=heap[k][0])break;[heap[up],heap[k]]=[heap[k],heap[up]];k=up;}};
    const popMin=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return top[1];};
    const h=node=>{const dx=Math.abs(node%W-g[0]),dz=Math.abs((node/W|0)-g[1]);return Math.max(dx,dz)+.414*Math.min(dx,dz);};
    cost[start]=0;push(start,h(start));
    while(heap.length){
      const node=popMin();if(node===goal)break;if(done[node])continue;done[node]=1;
      const i=node%W,j=node/W|0;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
        if(!di&&!dj||!open(grid,i+di,j+dj))continue;
        if(di&&dj&&(!open(grid,i+di,j)||!open(grid,i,j+dj)))continue;
        const next=(j+dj)*W+i+di,c=cost[node]+(di&&dj?1.414:1);
        if(c<cost[next]){cost[next]=c;came[next]=node;push(next,c+h(next));}
      }
    }
    if(start!==goal&&came[goal]<0)return null;
    const cells=[];for(let n=goal;n!==-1;n=n===start?-1:came[n])cells.push(centerOf(n%W,n/W|0));cells.reverse();
    const points=[...cells,to],path=[];let anchor=from;
    for(let k=0;k<points.length;){
      let far=k;while(far+1<points.length&&sightLine(grid,anchor[0],anchor[1],points[far+1][0],points[far+1][1]))far++;
      if(far===k&&k<points.length-1)far=k;
      path.push(points[far]);anchor=points[far];k=far+1;
    }
    return path;
  }
  TEAM.forEach((person,index)=>agents.push(character(person,index)));
  // Barber shop on floor 1: two barbers, a cashier, and customers who arrive, wait on the sofa, get a haircut,
  // pay and leave. They are generic visitors, not team members, so they carry no name labels.
  const shop={people:[],chairs:[-11,-6].map(x=>({x,customer:null})),seats:[-8.4,-7,-5.6].map(x=>({x,customer:null})),paying:null,nextArrival:6};
  function extra(shirt,gender,index,x,z,rot){
    const g=new THREE.Group(),rig=buildFigure(shirt,gender,index);g.add(rig.figure);g.position.set(x,0,z);g.rotation.y=rot;floors[1].add(g);
    return {g,rig,pose:'stand',path:[],heading:rot,seat:0};
  }
  const barbers=shop.chairs.map((c,i)=>{const b=extra(0x5c554b,i?'female':'male',i+20,c.x+1.05,-8.2,-Math.PI/2);b.chair=c;return b;});
  const cashier=extra(0x5c554b,'female',23,-13.5,1.75,0);
  const customerShirts=[0xa9a397,0x8a6a4a,0x6f8580,0xc08a64,0x9aa89c,0xb89c70,0x7d8a9a];
  customerShirts.forEach((shirt,i)=>{const c=extra(shirt,i%3===1?'female':'male',i+30,7,13,Math.PI);c.state='outside';c.g.visible=false;shop.people.push(c);});
  function walk(person,points,then){person.path=points.map(([x,z])=>new THREE.Vector3(x,0,z));person.then=then;person.pose='walk';}
  function sit(person,rot,seatY,pose='sit'){person.pose=pose;person.seat=seatY;person.heading=rot;}
  function toChair(c,chair){
    chair.customer=c;c.state='toChair';const from=c.g.position;
    walk(c,[[from.x,5.8],[chair.x,-6.4],[chair.x,-8]],()=>{c.state='cut';c.until=simTime+18+Math.random()*10;sit(c,Math.PI,.21);});
  }
  function toSofa(c,seat){
    seat.customer=c;c.state='toSofa';c.g.visible=true;c.g.position.set(7,0,13);
    walk(c,[[7,4.5],[-3,4.5],[seat.x,5.8],[seat.x,7.1]],()=>{c.state='waiting';c.since=simTime;sit(c,0,-.09,Math.random()<.5?'phone':'sit');});
  }
  // Starting scene: both chairs busy, two people waiting.
  shop.chairs.forEach((chair,i)=>{const c=shop.people[i];chair.customer=c;c.g.visible=true;c.g.position.set(chair.x,0,-8);c.g.rotation.y=Math.PI;c.state='cut';c.until=6+i*9;sit(c,Math.PI,.21);});
  shop.seats.slice(0,2).forEach((seat,i)=>{const c=shop.people[2+i];seat.customer=c;c.g.visible=true;c.g.position.set(seat.x,0,7.1);c.g.rotation.y=0;c.state='waiting';c.since=-i;sit(c,0,-.09,i?'phone':'sit');});
  function shopPose(person,dt){
    const {body,hips,legs,arms,phone}=person.rig,t=simTime+person.g.id;
    let leg=[[0,0],[0,0]],arm=[[.02,.07,-.15],[.02,.07,-.15]],bodyY=0,bodyZ=0,lean=0;
    if(person.pose==='walk'){const w=t*8;leg=[[Math.sin(w)*.5,Math.max(0,Math.sin(w+1.3))*.75],[-Math.sin(w)*.5,Math.max(0,-Math.sin(w+1.3))*.75]];arm=[[-Math.sin(w)*.4,.07,-.25],[Math.sin(w)*.4,.07,-.25]];bodyY=Math.abs(Math.sin(w))*.03;}
    else if(person.pose==='sit'||person.pose==='phone'){leg=[[-Math.PI/2,Math.PI/2],[-Math.PI/2,Math.PI/2]];bodyY=-.29+person.seat;bodyZ=.2;arm=[[-.35,.1,-.95],[-.35,.1,-.95]];if(person.pose==='phone')arm[1]=[-.9,.05,-1.5];}
    else if(person.pose==='cut'){const snip=Math.sin(t*10)*.12;arm=[[-1.25,-.15,-1.1],[-1.45+snip,.25,-1.25-snip]];lean=.12;}
    else if(person.pose==='till'){const k=Math.sin(t*9)*.08;arm=[[-.85+k,.1,-.6],[-.85-k,.1,-.6]];lean=.08;}
    else if(person.pose==='pay'){arm[1]=[-1.2,.08,-.35];}
    blendPose(person.rig,leg,arm,bodyY,bodyZ,lean,dt,person.pose==='walk'?Math.sin(t*8)*.035:Math.sin(t*1.4)*.008);
    phone.visible=person.pose==='phone';
    person.g.rotation.y+=wrap(person.heading-person.g.rotation.y)*Math.min(1,dt*8);
  }
  function stepShop(dt){
    for(const person of [...shop.people,...barbers,cashier]){
      if(person.path.length){
        let distance=dt*2.4;
        while(person.path.length&&distance>0){
          const target=person.path[0],p=person.g.position,d=p.distanceTo(target);
          if(d>.001)person.heading=Math.atan2(target.x-p.x,target.z-p.z);
          if(d<=distance){p.copy(target);distance-=d;person.path.shift();}else{p.addScaledVector(target.clone().sub(p),distance/d);distance=0;}
        }
        if(!person.path.length&&person.then){const then=person.then;person.then=null;person.pose='stand';then();}
      }
      shopPose(person,dt);
    }
    for(const chair of shop.chairs){
      const c=chair.customer;
      if(!c){const next=shop.people.filter(p=>p.state==='waiting').sort((a,b)=>a.since-b.since)[0];if(next){shop.seats.find(s=>s.customer===next).customer=null;toChair(next,chair);}}
      else if(c.state==='cut'&&simTime>c.until&&!shop.paying){
        shop.paying=c;chair.customer=null;c.state='toPay';
        walk(c,[[chair.x,-6.4],[-10,-6.4],[-10,3.5],[-13.5,3.5]],()=>{c.state='pay';c.until=simTime+4;c.pose='pay';c.heading=Math.PI;});
      }
    }
    const payer=shop.paying;
    if(payer?.state==='pay'&&simTime>payer.until){
      shop.paying=null;payer.state='leaving';
      walk(payer,[[-10,3.5],[-10,4.5],[7,4.5],[7,13]],()=>{payer.state='outside';payer.g.visible=false;});
    }
    const seat=shop.seats.find(s=>!s.customer),waiting=shop.people.find(p=>p.state==='outside');
    if(seat&&waiting&&simTime>shop.nextArrival){toSofa(waiting,seat);shop.nextArrival=simTime+7+Math.random()*8;}
    for(const barber of barbers){const busy=barber.chair.customer?.state==='cut';barber.pose=busy?'cut':'stand';barber.heading=-Math.PI/2;}
    cashier.pose=payer?.state==='pay'?'till':'stand';cashier.heading=0;
  }

  const ring=new THREE.Mesh(new THREE.RingGeometry(.5,.62,40),new THREE.MeshBasicMaterial({color:linear(ACCENT),side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);

  const SIT=new Set(['work','break','meet','lounge','call']),SOCIAL=new Set(['drink','look','lounge','meet']),MAX_AWAY=4;
  // Office log: simulated events only, newest first.
  function log(text,group) {
    // The first person named in the event gets an initials chip in their desk-group colour.
    const lead=TEAM.map(p=>[text.indexOf(p.n),p]).filter(([at])=>at>=0).sort((a,b)=>a[0]-b[0])[0]?.[1];
    for(const person of TEAM)text=text.replaceAll(person.n,person.initials);
    const item=document.createElement('li');item.style.setProperty('--dot',hex(GROUPS[lead?.group??group]?.color??INK));
    const time=document.createElement('time');time.textContent=new Date().toTimeString().slice(0,5);
    const body=document.createElement('span');body.className='log-text';body.textContent=text;
    if(lead){const chip=document.createElement('span');chip.className='log-chip';chip.textContent=lead.initials;chip.setAttribute('aria-hidden','true');body.prepend(chip);item.classList.add('has-chip');}
    item.append(time,body);$('logList').prepend(item);
    while($('logList').children.length>40)$('logList').lastChild.remove();
    $('logEmpty').hidden=true;
  }
  const ACTIVITY_LOG={drink:'gets a drink in the pantry',look:'reads the task board',lounge:'takes a break in the lounge',call:'takes a call in a phone booth',water:'waters the office plant'};
  // Who joins prayer time is chosen by the user per person, never assumed.
  const PRAY_KEY='kantor-ai.musholla.v1';let prayers=new Set();
  try{prayers=new Set((JSON.parse(localStorage.getItem(PRAY_KEY)||'[]')||[]).filter(n=>TEAM.some(p=>p.n===n)));}catch{prayers=new Set();}
  function savePrayers(){try{localStorage.setItem(PRAY_KEY,JSON.stringify([...prayers]));}catch{status('Prayer choices could not be saved in this browser. They stay in effect until the page reloads.');}}
  function prayerTime() {
    const group=agents.filter(a=>prayers.has(a.n));
    if(!group.length){status('Nobody has opted in yet. Pick a team member, then tick "Join at prayer time".');return;}
    const going=group.slice(0,prayerSpots.length);
    going.forEach((a,i)=>assign(a,prayerSpots[i],rand(18,24)));
    const names=going.map(a=>a.initials).join(', ');
    log(`Prayer time: ${names} to the prayer room`,going[0].group);
    status(group.length>going.length?`Simulation: ${going.length} people to the prayer room. It holds ${prayerSpots.length} prayer mats.`:`Simulation: ${names} heading to the prayer room.`);
  }
  const STAIR_DOOR=[-16,7.5];
  function setPath(agent,spot) {
    clearActivity(agent);
    // A new command changes the destination, but never pulls a person off a flight mid-step.
    if(agent.state==='stairs'){agent.destination=spot;return;}
    if(agent.spot===spot){agent.destination=spot;agent.path=[];arrive(agent);return;}
    const p=agent.g.position,old=agent.spot,P=passage(agent.floor);
    agent.destination=spot;agent.state='walk';agent.spot=null;
    // Standing up behind the chair and sitting back down is a short direct step.
    if(spot.local||(old?.local&&spot===agent.desk)){agent.path=[[spot.x,spot.z]];return;}
    // Walk around furniture and people on the walking grid; the hand-written routes remain as a fallback.
    // Leaving a seat steps out the way the seat is entered, so neighbours at a table do not meet in the same gap.
    const leaving=old&&Math.hypot(p.x-old.x,p.z-old.z)<.3?old:null;
    const planned=agent.floor!==spot.floor?navPath(agent.floor,[p.x,p.z],STAIR_DOOR,agent,null,leaving):navPath(agent.floor,[p.x,p.z],[spot.x,spot.z],agent,spot,leaving);
    if(planned){agent.path=planned;return;}
    // Every spot has a route from the floor's central passage; leaving reverses it.
    const departure=old?[...old.route].reverse():[[p.x,P]];
    agent.path=agent.floor!==spot.floor?[...departure,[-14,P],[-14,7.5],STAIR_DOOR]:[...departure,...spot.route,[spot.x,spot.z]];
  }
  function arrive(agent) {
    const spot=agent.destination;agent.spot=spot;agent.state=spot.state||(spot.floor===3?'work':'break');
    const activity=agent.activity;
    if(activity?.spot===spot){if(activity.meeting)settleMeeting(activity.meeting);else activity.until=simTime+activity.duration;}
    if(spot===agent.desk&&agent.nextRoutine<simTime+8)agent.nextRoutine=simTime+rand(8,25);
  }
  function settleMeeting(meeting) {
    // The meeting clock starts once everyone has sat down.
    if(meeting.members.every(m=>m.spot===m.activity.spot)&&meeting.members.some(m=>m.activity.until===Infinity))
      meeting.members.forEach(m=>{m.activity.until=simTime+m.activity.duration;});
  }
  function clearActivity(agent) {
    const activity=agent.activity;
    if(activity){
      if(activity.spot.occupant===agent)activity.spot.occupant=null;
      if(activity.spot.host?.visitor===agent)activity.spot.host.visitor=null;
      agent.activity=null;agent.nextRoutine=simTime+rand(20,50)*(window.officeTasks.activeFor(agent.n)?2.5:1);
      const meeting=activity.meeting;
      if(meeting){
        meeting.members=meeting.members.filter(m=>m!==agent);
        if(meeting.members.length<2)meeting.members.forEach(m=>{m.activity.duration=1;m.activity.until=Math.min(m.activity.until,simTime+1);});
        else settleMeeting(meeting);
      }
    }
    // A host who is called away cuts the visit short.
    const visitor=agent.visitor;
    if(visitor){agent.visitor=null;if(visitor.activity){visitor.activity.duration=.8;visitor.activity.until=Math.min(visitor.activity.until,simTime+.8);}}
  }
  function visitSpot(host) {
    const d=host.desk,side=-d.f,toCenter=d.x<GROUPS[host.group].x?1:-1,z=d.z+side*1.05,aisle=d.route[0][0];
    return {x:d.x+toCenter*.75,z,f:d.f,floor:3,route:[[aisle,P3],[aisle,z]],state:'chat',host,label:`Walking over to ${host.initials}`};
  }
  function assign(agent,spot,duration,extra={}) {
    setPath(agent,spot);
    if('occupant' in spot)spot.occupant=agent;
    agent.activity={spot,duration,until:Infinity,...extra};
  }
  function startActivity(agent) {
    const idle=agents.filter(o=>o!==agent&&o.floor===3&&o.state==='work'&&o.spot===o.desk&&!o.visitor&&!o.activity);
    const open=kind=>hangouts.filter(s=>s.state===kind&&!s.occupant);
    const prefer=list=>{const mates=list.filter(o=>o.group===agent.group);return mates.length&&Math.random()<.6?mates:list;};
    const away=agents.filter(a=>a.activity).length,roll=Math.random();
    const habit=window.officeLife.habits[agent.index];
    if(roll<.6){
      const preferred={'Coffee regular':'drink','Idea board reader':'look','Lounge thinker':'lounge','Stretch break regular':'stretch','Plant caretaker':'water'}[habit];
      if(preferred==='stretch'){assign(agent,agent.stretchSpot,rand(3.5,6));log(`${agent.n} takes a favourite stretch break`,agent.group);return;}
      const spot=preferred&&pick(open(preferred));if(spot){assign(agent,spot,rand(7,12));log(`${agent.n} ${ACTIVITY_LOG[preferred]}`,agent.group);return;}
    }
    if(roll<.28&&idle.length){const host=pick(prefer(idle));assign(agent,visitSpot(host),rand(7,12));host.visitor=agent;log(`${agent.n} walks over to ${host.n}`,agent.group);return;}
    if(roll>=.76&&roll<.9&&idle.length&&away<MAX_AWAY-1){
      const seats=shuffle(open('meet'));
      if(seats.length>=2){
        const others=shuffle(prefer(idle)).slice(0,away<MAX_AWAY-2&&Math.random()<.5?2:1);
        const meeting={members:[agent,...others]},duration=rand(10,16);
        meeting.members.forEach((m,i)=>assign(m,seats[i],duration,{meeting}));
        log(`Quick meeting in the meeting room: ${meeting.members.map(m=>m.n).join(', ')}`,agent.group);return;
      }
    }
    const kind=roll<.44?'drink':roll<.54?'look':roll<.66?'lounge':roll<.76?'call':null;
    const spot=kind&&pick(open(kind));
    if(spot){assign(agent,spot,rand(6,11));log(`${agent.n} ${ACTIVITY_LOG[kind]}`,agent.group);return;}
    assign(agent,agent.stretchSpot,rand(3.5,6));
  }
  function live(agent) {
    const activity=agent.activity;
    if(activity){if(agent.spot===activity.spot&&simTime>=activity.until)setPath(agent,agent.desk);return;}
    if(agent.floor===4&&agent.destination?.floor===4){roofRoutine(agent);return;}
    if(!routineOn||agent.floor!==3||agent.state!=='work'||agent.spot!==agent.desk||agent.visitor||simTime<agent.nextRoutine)return;
    if(agents.filter(a=>a.activity).length>=MAX_AWAY){agent.nextRoutine=simTime+rand(3,8);return;}
    startActivity(agent);
  }
  // On the rooftop people move between activities, but only once everyone heading up has arrived.
  function roofRoutine(agent) {
    const settled=agents.every(a=>a.destination?.floor!==4||(a.floor===4&&a.spot===a.destination));
    if(!routineOn||!settled||agent.spot!==agent.destination){agent.roofNext=simTime+rand(12,20);return;}
    if(simTime<agent.roofNext)return;
    agent.roofNext=simTime+rand(16,28);
    const free=roofSpots.filter(s=>!agents.some(a=>a.destination===s));
    if(!free.length)return;
    const spot=pick(free);setPath(agent,spot);log(`${agent.n} ${spot.fun}`,agent.group);
  }
  function circleOf(agent) {
    if(agent.state==='chat'){const host=agent.activity?.spot.host;return host&&host.visitor===agent&&host.spot===host.desk&&host.state==='work'?[agent,host]:[];}
    if(agent.visitor?.state==='chat'&&agent.state==='work'&&agent.spot===agent.desk)return [agent.visitor,agent];
    if(SOCIAL.has(agent.state))return agents.filter(o=>o.state===agent.state&&o.floor===agent.floor);
    return [];
  }
  const companions=agent=>circleOf(agent).filter(o=>o!==agent);
  function speaking(agent) {
    if(agent.state==='call')return Math.floor(simTime/2.2+agent.index)%2===0;
    const circle=circleOf(agent).sort((a,b)=>a.index-b.index);
    return circle.length>1&&circle[Math.floor(simTime/1.9)%circle.length]===agent;
  }
  const wrap=a=>((a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  // One pose per state, written as joint angles: legs [thigh, knee], arms [shoulder forward, shoulder outward, elbow].
  function pose(agent,state,walking,sitting,talking,partner,dt) {
    const {body,hips,head,legs,arms,cup,phone}=agent.rig,t=simTime,i=agent.index;
    let leg=[[0,0],[0,0]],arm=[[.02,.07,-.15],[.02,.07,-.15]],bodyY=0,bodyZ=0,lean=0;
    if(walking){
      const w=t*7.2+i*1.7;
      leg=[[Math.sin(w)*.5,Math.max(0,Math.sin(w+1.3))*.75],[-Math.sin(w)*.5,Math.max(0,-Math.sin(w+1.3))*.75]];
      arm=[[-Math.sin(w)*.4,.07,-.25],[Math.sin(w)*.4,.07,-.25]];bodyY=Math.abs(Math.sin(w))*.03;lean=.05;
    }else if(sitting){
      leg=[[-Math.PI/2,Math.PI/2],[-Math.PI/2,Math.PI/2]];bodyY=-.29;bodyZ=state==='lounge'||state==='call'?.05:.2;
      if(state==='work'){const typing=Math.sin(t*.65+i*2)>.1,k=typing?Math.sin(t*10+i)*.045:0;arm=[[-.9+k,.12,-.67],[typing?-.9-k:-.65,.12,typing?-.67:-.85]];lean=.08+Math.sin(t*.8+i)*.025;}
      else if(state==='break'){arm=[[-.6,.1,-.9],[-.6,.1,-.9]];}
      else arm=[[-.35,.1,-.95],[-.35,.1,-.95]];
      if(state==='lounge')lean=-.15;
      // Bean bags sit lower and lean back.
      if(agent.spot?.roofPose==='beanbag'){bodyY=-.4;lean=-.22;arm=[[-.25,.2,-.6],[-.25,.2,-.6]];}
    }else if(agent.spot?.roofPose==='billiard'){
      // Bent over the table, bridge hand forward, cue arm drawing back and striking.
      const stroke=Math.max(0,Math.sin(t*1.8+i))*.35;
      leg=[[-.2,.25],[.25,.05]];lean=.55;arm=[[-1.45,-.08,-.1],[-1.05+stroke,.12,-.35-stroke]];
    }else if(agent.spot?.roofPose==='pingpong'){
      // Ready stance with the paddle arm swinging through each rally.
      const k=Math.sin(t*4.2+i*1.3);leg=[[-.25,.35],[-.1,.3]];lean=.18;arm=[[-.5,-.1,-.9],[-.7+k*.55,.35,-1.1-k*.2]];
    }else if(agent.spot?.roofPose==='stretch'){
      const k=Math.sin(t*1.1+i)*.25;arm=[[-2.9+k,.25,-.1],[-2.9-k,.25,-.1]];lean=-.05+Math.max(0,Math.sin(t*.55+i))*.35;
    }else if(agent.spot?.roofPose==='coffee'){
      arm[1]=[-.45,.1,Math.sin(t*1.2+i)>.4?-2.25:-1.4];
    }else if(state==='stretch'){
      const k=Math.sin(t*1.6+i)*.1;arm=[[-2.9+k,.18,-.1],[-2.9-k,.18,-.1]];lean=-.08;
    }else if(state==='drink'){
      arm[1]=[-.45,.1,Math.sin(t*1.2+i)>.4?-2.25:-1.4];
    }else if(state==='look'){
      arm[0]=[-.55,-.05,-1.7];
    }else if(state==='pray'){
      arm=[[-.35,-.28,-1.55],[-.35,-.28,-1.55]];
    }
    if(talking&&state!=='call'&&!walking)arm[1]=[(sitting?-.7:-.5)+Math.sin(t*3+i)*.25,.25,-1.1+Math.sin(t*4.3)*.2];
    if(state==='call')arm[1]=[-.3,.38,-2.55];
    if(state==='water')arm[1]=[-1.1,.18,-.3];
    if(agent.celebrateUntil>simTime&&!walking&&state!=='stairs'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&window.officeLife.preferences.celebrate){arm=[[-2.4,.35,-.5],[-2.4,.35,-.5]];bodyY+=Math.abs(Math.sin(t*8))*.06;}
    const sway=walking?Math.sin(t*7.2+i*1.7)*.035:Math.sin(t*1.2+i)*.008;
    blendPose(agent.rig,leg,arm,bodyY+(walking?0:Math.sin(t*1.5+i)*.008),bodyZ,lean,dt,sway);
    cup.visible=state==='drink'||(!walking&&agent.spot?.roofPose==='coffee');phone.visible=state==='call';agent.rig.wateringCan.visible=state==='water';
    agent.rig.cue.visible=!walking&&agent.spot?.roofPose==='billiard';
    // Seated people turn only their head toward whoever they talk with.
    let look=walking?Math.max(-.4,Math.min(.4,wrap(agent.heading-agent.g.rotation.y))):Math.sin(t*.45+i*2)*.08;
    if(partner&&sitting){const q=partner.g.position,p=agent.g.position;look=Math.max(-.9,Math.min(.9,wrap(Math.atan2(q.x-p.x,q.z-p.z)-agent.g.rotation.y)));}
    head.rotation.y+=(look-head.rotation.y)*(1-Math.exp(-dt*9));
  }
  // Local courtesy while walking: follow someone going the same way, both step right when meeting head-on,
  // the later person waits at a crossing, and people standing still are walked around. Waiting never lasts
  // more than a few seconds, so nobody gets stuck.
  function giveWay(agent,dt){
    // After about three seconds of being held up in total, walk on for a moment regardless, so a crowd at a door
    // (everyone waiting for everyone) always clears.
    if(agent.passUntil>simTime)return false;
    const hold=()=>{agent.blocked=(agent.blocked||0)+dt;if(agent.blocked>3){agent.blocked=0;agent.passUntil=simTime+1.6;return false;}return true;};
    const p=agent.g.position,[tx,tz]=agent.path[0],len=Math.hypot(tx-p.x,tz-p.z);if(len<.05)return false;
    const fx=(tx-p.x)/len,fz=(tz-p.z)/len;
    for(const o of agents){
      if(o===agent||o.floor!==agent.floor||o.state==='stairs'||(SIT.has(o.state)&&!o.spot?.standing&&o.state!=='walk'))continue;
      const q=o.g.position,ox=q.x-p.x,oz=q.z-p.z,along=ox*fx+oz*fz,side=Math.abs(ox*fz-oz*fx);
      if(along<=.05||along>.95||side>.55)continue;
      let dot=0,moving=o.state==='walk'&&o.path.length;
      if(moving){const [ux,uz]=o.path[0],ul=Math.hypot(ux-q.x,uz-q.z)||1;dot=((ux-q.x)*fx+(uz-q.z)*fz)/ul;}
      // Same way, or crossing with the earlier person going first: wait.
      if(moving&&dot>.3||moving&&dot>=-.3&&o.index<agent.index)return hold();
      // Head-on, or someone standing in the way: one step to the right (or left), at most once a second.
      if(!agent.path[0].sidestep&&!(agent.sidestep>simTime)){
        const grid=navGrids[agent.floor];
        for(const turn of [1,-1]){
          const x=p.x+fx*.55+fz*.6*turn,z=p.z+fz*.55-fx*.6*turn;
          if(grid&&open(grid,...cellOf(x,z))&&sightLine(grid,p.x,p.z,x,z)&&sightLine(grid,x,z,tx,tz)){
            const step=[x,z];step.sidestep=true;agent.path.unshift(step);agent.sidestep=simTime+1;agent.blocked=(agent.blocked||0)+.5;return false;
          }
        }
      }
      return hold();
    }
    agent.blocked=Math.max(0,(agent.blocked||0)-dt*.5);return false;
  }
  function updateAgent(agent,dt) {
    const before=agent.g.getWorldPosition(new THREE.Vector3());
    if(agent.state==='stairs'){
      const trip=agent.stairTrip;let remaining=dt*3.1;
      // Queue behind whoever is just ahead on the same flight, going the same way.
      const ahead=agents.find(o=>o!==agent&&o.state==='stairs'&&o.stairTrip&&o.stairTrip.from===trip.from&&o.stairTrip.to===trip.to&&
        o.stairTrip.points.length<trip.points.length&&o.g.position.distanceTo(agent.g.position)<.85);
      if(ahead&&(agent.queued=(agent.queued||0)+dt)<3)remaining=0;else if(!ahead)agent.queued=0;
      if(trip.points.length){const d=trip.points[0].clone().sub(agent.g.position);if(Math.hypot(d.x,d.z)>.05){agent.heading=Math.atan2(d.x,d.z);if(Math.abs(wrap(agent.heading-agent.g.rotation.y))>1.3)remaining=0;}}
      while(trip.points.length&&remaining>0){
        const target=trip.points[0],delta=target.clone().sub(agent.g.position),distance=delta.length();
        if(Math.hypot(delta.x,delta.z)>.001)agent.heading=Math.atan2(delta.x,delta.z);
        if(distance<=remaining){agent.g.position.copy(target);remaining-=distance;trip.points.shift();}
        else{agent.g.position.addScaledVector(delta,remaining/distance);remaining=0;}
      }
      if(!trip.points.length){
        agent.floor=trip.to;moveTo(floors[agent.floor],agent.g);agent.stairTrip=null;
        if(agent.floor!==agent.destination.floor)beginStairs(agent);
        else{const s=agent.destination;agent.path=navPath(agent.floor,[agent.g.position.x,agent.g.position.z],[s.x,s.z],agent,s)||[[-14,7.5],[-14,passage(agent.floor)],...s.route,[s.x,s.z]];agent.state='walk';}
      }
    }
    const lastPoint=agent.path.length===1?agent.path[0]:null;
    const approach=lastPoint&&agent.destination.floor===agent.floor?Math.min(1,Math.max(.3,Math.hypot(lastPoint[0]-agent.g.position.x,lastPoint[1]-agent.g.position.z)/1.2)):1;
    let distance=dt*3.1*approach;
    if(agent.state==='walk'&&agent.path.length&&giveWay(agent,dt))distance=0;
    // Turn on the spot before setting off in a new direction, so nobody is seen walking backwards.
    if(agent.state==='walk'&&agent.path.length){
      const [x,z]=agent.path[0],p=agent.g.position;
      if(Math.hypot(x-p.x,z-p.z)>.05){agent.heading=Math.atan2(x-p.x,z-p.z);if(Math.abs(wrap(agent.heading-agent.g.rotation.y))>1.3)distance=0;}
    }
    while(agent.path.length&&distance>0){
      const [x,z]=agent.path[0],p=agent.g.position,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
      if(d>.001)agent.heading=Math.atan2(dx,dz);
      if(d<=distance){p.x=x;p.z=z;distance-=d;agent.path.shift();}
      else{p.x+=dx/d*distance;p.z+=dz/d*distance;distance=0;}
      if(!agent.path.length){
        if(agent.floor!==agent.destination.floor)beginStairs(agent);
        else arrive(agent);
      }
    }
    // The walking animation plays only while someone actually covers ground; waiting in a queue or turning on the
    // spot is a standing pose, so nobody appears to walk in place or backwards.
    const moved=agent.g.getWorldPosition(new THREE.Vector3()).distanceTo(before);
    agent.stepping=moved>dt*.4?.25:Math.max(0,(agent.stepping||0)-dt);
    const state=agent.state,travelling=state==='walk'||state==='stairs',walking=travelling&&agent.stepping>0,sitting=SIT.has(state)&&!agent.spot?.standing,talking=speaking(agent);
    const partner=companions(agent).sort((a,b)=>agent.g.position.distanceTo(a.g.position)-agent.g.position.distanceTo(b.g.position))[0];
    if(!travelling&&agent.spot){
      const p=agent.g.position,q=partner?.g.position;
      agent.heading=q&&!sitting?Math.atan2(q.x-p.x,q.z-p.z):facing(agent.spot);
    }
    const turn=wrap(agent.heading-agent.g.rotation.y);agent.g.rotation.y+=turn*Math.min(1,dt*(Math.abs(turn)>1.3?14:8));
    pose(agent,state,walking,sitting,talking,partner,dt);
    agent.bubble.visible=talking;agent.bubble.position.set(0,sitting?2.05:2.55,0);
    agent.g.visible=visibleAgent(agent);
  }
  function moveTeam(level) {
    // Rooftop spots are dealt out at random, so different people end up at the billiard table and coffee bar.
    const roofOrder=level===4?shuffle([...roofSpots]):[];
    agents.forEach((agent,i)=>setPath(agent,level===3?agent.desk:level===2?dining[i]:roofOrder[i]));
    const message=level===3?'Simulation: the team heads back to their desks.':level===2?'Simulation: the team goes down for lunch.':'Simulation: the team heads up to the rooftop.';
    status(message);log(message.replace('Simulation: t','T'));
  }
  function commandMembers(members, action) {
    if(!members.length){status('Pick at least one team member.');return;}
    let spots;
    if(action==='meet'){
      spots=hangouts.filter(s=>s.state==='meet'&&(!s.occupant||members.includes(s.occupant)));
    }else if(action!=='work'){
      const pool=action==='lunch'?dining:shuffle([...roofSpots]);
      spots=pool.filter(s=>!agents.some(a=>!members.includes(a)&&a.destination===s));
    }
    // Reserve the entire group before moving anyone; a full room must not split the invitation.
    if(spots&&spots.length<members.length){status(`Only ${spots.length} places available. Choose fewer people or bring the current occupants back to work.`);return;}
    members.forEach(a=>clearActivity(a));
    members.forEach((a,i)=>{
      if(action==='meet')assign(a,spots[i],Infinity);
      else setPath(a,action==='work'?a.desk:spots[i]);
    });
    const names=members.map(a=>a.initials).join(', ');
    const destination={meet:'the meeting room',lunch:'lunch',roof:'the rooftop',work:'their desks'}[action];
    const message=`${names} heading to ${destination}.`;
    status(message+(action==='meet'?' Use Back to work to end the meeting.':''));log(message,members[0].group);
  }
  function memberCommands(agent){
    const section=document.createElement('section');section.className='member-commands';
    const label=document.createElement('label');label.htmlFor='iScope';label.textContent='Send instructions to';
    const scope=document.createElement('select');scope.id='iScope';
    for(const [value,text] of [['person',agent.initials],['division',GROUPS[agent.group].name],['custom','Choose people…']]){
      const option=document.createElement('option');option.value=value;option.textContent=text;scope.append(option);
    }
    const people=document.createElement('fieldset');people.id='iPeople';people.hidden=true;
    const legend=document.createElement('legend');legend.textContent='People to include';people.append(legend);
    for(const a of agents){const row=document.createElement('label');row.className='check';const input=document.createElement('input');input.type='checkbox';input.value=a.n;input.checked=a===agent;row.append(input,`${a.initials} · ${a.role}`);people.append(row);}
    scope.onchange=()=>{people.hidden=scope.value!=='custom';};
    const actions=document.createElement('div');actions.className='member-actions';
    for(const [action,text] of [['meet','Meet together'],['lunch','Lunch'],['roof','Rooftop'],['work','Back to work']]){
      const button=document.createElement('button');button.className='btn';button.textContent=text;button.dataset.command=action;
      button.onclick=()=>{const chosen=new Set([...people.querySelectorAll('input:checked')].map(i=>i.value));commandMembers(scope.value==='person'?[agent]:agents.filter(a=>scope.value==='division'?a.group===agent.group:chosen.has(a.n)),action);};actions.append(button);
    }
    section.append(label,scope,people,actions);return section;
  }
  function syncTaskDisplay(agent){
    const task=window.officeTasks.activeFor(agent.n);
    agent.label.classList.toggle('has-task',!!task);
    const description=`${agent.initials}, ${agent.role}${task?` · In progress: ${task.title}`:''}`;
    if(agent.label.title!==description){agent.label.title=description;agent.label.setAttribute('aria-label',`View ${description}`);}
    if(selected===agent&&$('iActiveTask')){
      const title=task?task.title:'No active task';
      if($('iActiveTask').textContent!==title)$('iActiveTask').textContent=title;
      const brief=task?.brief||'';
      if($('iTaskBrief').textContent!==brief)$('iTaskBrief').textContent=brief;
      $('iTaskBrief').hidden=!brief;
    }
  }
  function agentStatus(agent) {
    const destination=agent.destination,others=companions(agent).map(o=>o.initials).join(' & ');
    if(agent.state==='stairs')return `On the stairs to floor ${destination.floor}`;
    if(agent.state==='walk'){
      if(destination.label)return destination.label;
      if(destination===agent.desk&&agent.floor===3)return 'Back to the desk';
      return `Heading to ${FLOOR[destination.floor].name.toLowerCase()}`;
    }
    const text={
      chat:others?`chatting with ${others}`:'colleague stepped away',
      drink:others?`getting a drink with ${others}`:'getting a drink in the pantry',
      look:others?`discussing at the task board with ${others}`:'reading the task board',
      lounge:others?`chatting in the lounge with ${others}`:'relaxing in the lounge',
      meet:others?`quick meeting with ${others}`:'waiting for colleagues in the meeting room',
      call:'on a call in a phone booth',
      stretch:'stretching for a moment',
      water:'watering the office plant',
      pray:'praying in the prayer room'
    }[agent.state];
    if(text)return `Simulation: ${text}`;
    if(agent.floor===2)return 'Simulation: eating together';
    if(agent.floor===4)return `Simulation: ${ROOF_STATUS[agent.spot?.fun]||'on the rooftop'}`;
    if(others)return `Simulation: chatting with ${others}`;
    return window.officeTasks.activeFor(agent.n)?.title || 'Simulation: working at the desk';
  }
  function selectAgent(agent) {
    if(selected)selected.label.classList.remove('selected');selected=agent;
    $('info').hidden=!agent;ring.visible=!!agent;if(!agent){$('teamSelect').value='';return;}
    if(activeFloor!==0&&activeFloor!==agent.floor)setFloor(agent.floor,false);
    agent.label.classList.add('selected');$('teamSelect').value=agent.n;
    const info=$('info');info.replaceChildren();
    const close=document.createElement('button');close.id='iClose';close.textContent='×';close.setAttribute('aria-label','Close details');close.onclick=()=>selectAgent(null);
    const heading=document.createElement('h2');heading.textContent=agent.initials;
    const role=document.createElement('p');role.className='role';role.textContent=agent.role;
    const habit=document.createElement('p');habit.className='role';habit.textContent=`Simulated habit: ${window.officeLife.habits[agent.index]}`;
    // Members connected to an AI agent on the server say so; everyone else stays a labelled simulation.
    const ai=window.officeTasks.agentFor(agent.n);
    if(ai){const badge=document.createElement('span');badge.className='ai-badge';badge.textContent=ai.mode==='claude'?`AI agent · ${ai.model.replace(/^claude-/,'').replace(/-\d{8}$/,'').replace(/-(\d+)-(\d+)$/,' $1.$2').replace(/^\w/,c=>c.toUpperCase())}`:'AI agent · dry run';role.append(badge);}
    const list=document.createElement('dl');
    for(const [title,value,id] of [['Desk group',GROUPS[agent.group].name,''],['Location',FLOOR[agent.floor].name,'iLocation'],['Activity',agentStatus(agent),'iActivity']]){
      const dt=document.createElement('dt');dt.textContent=title;const dd=document.createElement('dd');dd.textContent=value;if(id)dd.id=id;list.append(dt,dd);
    }
    const pray=document.createElement('label');pray.className='check';const box=document.createElement('input');box.type='checkbox';box.id='iPray';box.checked=prayers.has(agent.n);
    box.onchange=()=>{if(box.checked)prayers.add(agent.n);else prayers.delete(agent.n);savePrayers();};pray.append(box,'Join at prayer time');
    const view=document.createElement('div');view.className='view-buttons';
    for(const [id,text,mode] of [['iEyes','First-person view','eyes'],['iChase','Follow from behind','chase']]){const b=document.createElement('button');b.id=id;b.className='btn';b.textContent=text;b.onclick=()=>startFollow(agent,mode);view.append(b);}
    const tasks=document.createElement('button');tasks.id='iTasks';tasks.className='btn primary';tasks.textContent='View / assign tasks';tasks.onclick=()=>window.officeTasks.open(agent.n);
    const taskSection=document.createElement('section');taskSection.className='active-task';
    const taskHeading=document.createElement('h3');taskHeading.textContent='Active task';
    const taskTitle=document.createElement('p');taskTitle.id='iActiveTask';
    const taskBrief=document.createElement('p');taskBrief.id='iTaskBrief';
    taskSection.append(taskHeading,taskTitle,taskBrief,tasks);
    info.append(close,heading,role,habit,taskSection,memberCommands(agent),list,pray,view);
    syncTaskDisplay(agent);
  }
  for(const agent of agents){const option=document.createElement('option');option.value=agent.n;option.textContent=`${agent.initials} · ${agent.role}`;$('teamSelect').append(option);}
  // Header faces: the first four members as initial chips in their desk-group colour, then the remaining count.
  for(const agent of agents.slice(0,4)){
    const face=document.createElement('button');face.className='face';face.textContent=agent.initials;face.style.setProperty('--dot',hex(GROUPS[agent.group].color));
    face.setAttribute('aria-label',`${agent.n}, ${agent.role}`);face.onclick=()=>{$('teamSelect').value=agent.n;selectAgent(agent);};$('teamFaces').append(face);
  }
  {const more=document.createElement('span');more.className='face more';more.textContent=`+${agents.length-4}`;more.setAttribute('aria-hidden','true');$('teamFaces').append(more);}
  $('teamSelect').onchange=()=>{const a=agents.find(a=>a.n===$('teamSelect').value);selectAgent(a||null);if(a&&activeFloor!==0){a.g.getWorldPosition(cam.target);cam.radius=Math.max(32,28/camera.aspect);}};

  const cam={target:new THREE.Vector3(1,0,0),radius:62,theta:-.22,phi:.78,spin:0};
  function cameraFor(level){
    return {target:new THREE.Vector3(level===0?-1:innerWidth>1000?-5:-3,level===0?7:floorY(level),0),theta:-.32,phi:level===0?1.08:.78,
      radius:level===0?Math.max(76,66/camera.aspect):Math.max(70,72/camera.aspect)};
  }
  function resetCamera(){
    const view=cameraFor(activeFloor);cam.target.copy(view.target);cam.theta=view.theta;cam.phi=view.phi;cam.radius=view.radius;cam.spin=0;
  }
  // Moving between one floor and the whole building glides the camera, while the other floors slide in to assemble
  // the building (zooming out) or slide away (zooming in). Glass, stairs and the city settle at the end.
  let transition=null,viewReady=false;
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function startTransition(from,to){
    transition={to,focus:to===0?from:to,t:0,duration:1.4,from:{target:cam.target.clone(),theta:cam.theta,phi:cam.phi,radius:cam.radius},dest:cameraFor(to)};
    cam.spin=0;showLevels([1,2,3,4],false);stepTransition(0);
  }
  function stepTransition(dt){
    const tr=transition;tr.t=Math.min(1,tr.t+dt/tr.duration);
    const t=tr.t,e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    cam.target.lerpVectors(tr.from.target,tr.dest.target,e);
    cam.radius=tr.from.radius*Math.pow(tr.dest.radius/tr.from.radius,e);
    cam.phi=tr.from.phi+(tr.dest.phi-tr.from.phi)*e;cam.theta=tr.from.theta+wrap(tr.dest.theta-tr.from.theta)*e;
    const spread=tr.to===0?1-e:e;
    const offset=level=>Math.sign(level-tr.focus)*spread*28;
    for(const [key,group] of Object.entries(floors)){const level=Number(key);group.position.y=floorY(level)+offset(level);}
    // Glass and stairs travel with their floor and fade in once the building has nearly assembled (or fade out first
    // when zooming into a floor); the city fades in the first half of zooming out and away at the end of zooming in.
    const smooth=(a,b,x)=>{const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k);};
    const building=tr.to===0?smooth(.45,1,t):1-smooth(0,.4,t),city=tr.to===0?smooth(0,.5,t):1-smooth(.5,1,t);
    for(const [key,lg] of Object.entries(facadeLevels))lg.position.y=offset(Number(key));
    for(const [key,bridge] of Object.entries(stairways)){bridge.position.y=floorY(Number(key))+offset(Number(key));setFade(bridge,building);}
    setFade(facade,building);doorPads.forEach(pad=>setFade(pad,building));setFade(skyline,city);
    if(t<1)return;
    transition=null;
    for(const lg of Object.values(facadeLevels))lg.position.y=0;
    for(const [key,bridge] of Object.entries(stairways))bridge.position.y=floorY(Number(key));
    for(const root of [facade,skyline,...Object.values(stairways),...doorPads])setFade(root,1);
    if(tr.to===0){showLevels([1,2,3,4],true);facade.visible=skyline.visible=true;}
    else{showLevels([tr.to],false);skyline.visible=facade.visible=false;}
  }
  let stairsShown=false,follow=null;
  // Which floors and outside stairs are drawn. The character camera may need two floors plus the stairs between them.
  function showLevels(levels,stairs){
    for(const [key,group] of Object.entries(floors)){group.visible=levels.includes(Number(key));group.position.y=floorY(Number(key));}
    stairsShown=stairs;for(const outside of [...Object.values(stairways),...doorPads])outside.visible=stairs;
  }
  function setFloor(level,clearSelection=true,keepCamera=false) {
    if(follow&&!keepCamera)stopFollow(false);
    if(transition)stepTransition(Infinity);
    const from=activeFloor;activeFloor=level;buildingMood(level===0);if(clearSelection)selectAgent(null);
    showLevels(level?[level]:[1,2,3,4],level===0);skyline.visible=facade.visible=level===0;
    document.querySelectorAll('[data-floor]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.floor)===level?'true':'false'));
    $('floorKicker').textContent=level?`Sheet 0${level} / 04`:'Building section';
    $('floorTitle').textContent=level?FLOOR[level].title:'The office, bottom to top.';
    $('floorDescription').textContent=level?FLOOR[level].description:'01 Barber & parking · 02 Kitchen · 03 Workspace · 04 Rooftop';
    if(keepCamera)return;
    status(level?'Pick a team member to see their role.':'Click a floor to enter it.');
    if(viewReady&&!reduceMotion&&(from===0)!==(level===0))startTransition(from,level);else resetCamera();
  }
  // Character camera: 'eyes' looks out from the head like a first-person game, 'chase' follows from behind.
  function startFollow(agent,mode){
    if(follow?.agent&&follow.agent!==agent)follow.agent.rig.head.visible=true;
    buildingMood(false);
    follow={agent,mode,yaw:0,pitch:mode==='eyes'?-.12:-.32,distance:3.4,snap:true};
    agent.rig.head.visible=mode!=='eyes';cam.spin=0;skyline.visible=facade.visible=false;camera.fov=mode==='eyes'?68:55;camera.updateProjectionMatrix();
    document.body.classList.add('following');$('followBar').hidden=false;$('followName').textContent=`Camera ${agent.initials}`;
    $('fEyes').setAttribute('aria-pressed',String(mode==='eyes'));$('fChase').setAttribute('aria-pressed',String(mode==='chase'));
    status(mode==='eyes'?`Seeing through ${agent.initials}'s eyes. Drag to look around, Esc to exit.`:`Following ${agent.initials} from behind. Drag to orbit, scroll for distance, Esc to exit.`);
  }
  function stopFollow(reset=true){
    if(!follow)return;follow.agent.rig.head.visible=true;follow=null;document.body.classList.remove('following');$('followBar').hidden=true;camera.fov=38;camera.updateProjectionMatrix();
    if(reset){setFloor(activeFloor,false);}
  }
  const followEye=new THREE.Vector3(),followLook=new THREE.Vector3(),followWanted=new THREE.Vector3();
  function followCamera(realDt){
    const a=follow.agent,trip=a.stairTrip;
    const levels=a.state==='stairs'&&trip?[trip.from,trip.to]:[a.floor];
    if(a.state!=='stairs'&&activeFloor!==a.floor)setFloor(a.floor,false,true);
    showLevels(levels,a.state==='stairs');
    a.rig.head.getWorldPosition(followEye);
    const heading=a.g.rotation.y+follow.yaw,pitch=follow.pitch,dir=new THREE.Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
    if(follow.mode==='eyes'){
      followWanted.copy(followEye).addScaledVector(dir,.12);followLook.copy(followWanted).add(dir);
    }else{
      followLook.copy(followEye);followLook.y-=.2;
      followWanted.copy(followLook).addScaledVector(dir,-follow.distance);followWanted.y=Math.max(followWanted.y,followLook.y-.6);
    }
    if(follow.snap){camera.position.copy(followWanted);follow.snap=false;}
    else camera.position.lerp(followWanted,1-Math.exp(-realDt*(follow.mode==='eyes'?20:6)));
    camera.lookAt(followLook);camera.updateMatrixWorld();
  }
  document.querySelectorAll('[data-floor]').forEach(b=>b.onclick=()=>setFloor(Number(b.dataset.floor)));
  $('bPause').onclick=()=>{paused=!paused;$('bPause').textContent=paused?'Resume':'Pause';$('bPause').setAttribute('aria-pressed',String(paused));};
  const syncRoutine=()=>{$('bRoutine').textContent=routineOn?'Routine: on':'Routine: off';$('bRoutine').setAttribute('aria-pressed',String(routineOn));};
  $('bRoutine').onclick=()=>{routineOn=!routineOn;syncRoutine();status(routineOn?'Simulation: the team moves around the workspace on its own.':'Routine off. The team finishes what they are doing, then returns to their desks.');};syncRoutine();
  $('bPray').onclick=prayerTime;
  const syncLog=open=>{$('log').hidden=!open;$('bLog').setAttribute('aria-expanded',String(open));};
  $('bLog').onclick=()=>syncLog($('log').hidden);syncLog(innerWidth>1000);
  $('bLunch').onclick=()=>moveTeam(2);$('bRoof').onclick=()=>moveTeam(4);$('bWork').onclick=()=>moveTeam(3);
  $('bReset').onclick=()=>{if(follow)stopFollow();else resetCamera();};
  $('fEyes').onclick=()=>follow&&startFollow(follow.agent,'eyes');$('fChase').onclick=()=>follow&&startFollow(follow.agent,'chase');$('fExit').onclick=()=>stopFollow();
  $('bZoomIn').onclick=()=>cam.radius*=.85;$('bZoomOut').onclick=()=>cam.radius/=.85;
  $('bRotate').onclick=()=>{cam.spin=3;};
  $('bTasks').onclick=()=>window.officeTasks.open();
  const keys={};
  addEventListener('keydown',event=>{
    if(event.key==='Escape'&&follow&&!$('taskDialog').open){stopFollow();return;}
    if(event.target.closest('input,textarea,select,dialog,button')||$('taskDialog').open)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key))event.preventDefault();keys[event.key.toLowerCase()]=true;
  });
  addEventListener('keyup',event=>keys[event.key.toLowerCase()]=false);
  addEventListener('blur',()=>{for(const key in keys)keys[key]=false;});

  // Orbit by default: drag rotates, Shift or right drag pans, wheel or pinch zooms, two fingers pan and pinch.
  const canvas=$('c'),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),pointers=new Map();
  ray.params.Line.threshold=.05;
  let drag=null,pinch=null;
  const pinchState=()=>{const [a,b]=[...pointers.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
  function pan(dx,dy){const k=cam.radius*.0012;cam.target.x-=dx*k*Math.cos(cam.theta)+dy*k*Math.sin(cam.theta);cam.target.z+=dx*k*Math.sin(cam.theta)-dy*k*Math.cos(cam.theta);}
  function pickAt(event){
    pointer.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);
    if(activeFloor===0){
      // Glass facade panels know their storey, so clicking a floor through the glass enters that floor.
      const hit=ray.intersectObjects([facade,...Object.values(floors)],true)[0];if(!hit)return;
      let o=hit.object,inFacade=false,edgeLevel=0;for(let a=o;a;a=a.parent){if(a===facade)inFacade=true;edgeLevel||=a.userData.level||0;}
      if(inFacade){setFloor(edgeLevel||Math.max(1,Math.min(4,Math.floor(hit.point.y/FLOOR_GAP)+1)));return;}
      while(o.parent&&o.parent!==scene)o=o.parent;
      const level=Number(Object.keys(floors).find(k=>floors[k]===o));if(level)setFloor(level);return;
    }
    const visible=agents.filter(a=>a.g.visible&&visibleAgent(a)).map(a=>a.g);
    if(activeFloor===3)visible.push(officeCat);
    const hit=ray.intersectObjects(visible,true)[0];if(hit?.object.userData.cat){petCat();return;}selectAgent(hit?hit.object.userData.agent:null);
  }
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{
    if(transition)stepTransition(Infinity);
    canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});cam.spin=0;
    if(pointers.size===1)drag={x:event.clientX,y:event.clientY,mode:event.button===2||event.shiftKey?'pan':'orbit',moved:0,time:performance.now()};
    else if(pointers.size===2){pinch=pinchState();if(drag)drag.moved=99;}
  });
  canvas.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>=2&&pinch&&follow){const next=pinchState();follow.distance=Math.max(1.6,Math.min(9,follow.distance*pinch.d/Math.max(next.d,1)));pinch=next;return;}
    if(pointers.size>=2&&pinch){const next=pinchState();cam.radius*=pinch.d/Math.max(next.d,1);pan(next.x-pinch.x,next.y-pinch.y);pinch=next;return;}
    if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;drag.moved+=Math.abs(dx)+Math.abs(dy);
    if(drag.moved<4)return;
    if(follow){follow.yaw-=dx*.005;follow.pitch=Math.max(-1.2,Math.min(.9,follow.pitch-dy*.004));return;}
    if(drag.mode==='orbit'){
      const now=performance.now();cam.theta-=dx*.006;cam.phi-=dy*.005;
      cam.spin=Math.max(-6,Math.min(6,-dx*.006/Math.max(.008,(now-drag.time)/1000)));drag.time=now;
    }else pan(dx,dy);
  });
  function release(event){
    if(!pointers.has(event.pointerId))return;
    const click=event.type==='pointerup'&&drag&&drag.moved<5&&pointers.size===1;
    pointers.delete(event.pointerId);if(pointers.size<2)pinch=null;
    if(click)pickAt(event);
    if(!drag||drag.mode!=='orbit'||performance.now()-drag.time>90)cam.spin=0;
    if(!pointers.size)drag=null;
    else{const [p]=[...pointers.values()];drag={x:p.x,y:p.y,mode:'orbit',moved:99,time:performance.now()};}
  }
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  // Name labels sit over the canvas, so they forward wheel zoom too.
  const onWheel=event=>{
    event.preventDefault();cam.spin=0;
    if(follow){follow.distance=Math.max(1.6,Math.min(9,follow.distance*Math.exp(Math.sign(event.deltaY)*.12)));return;}
    if(event.ctrlKey)cam.radius*=Math.exp(event.deltaY*.01);
    else if(Math.abs(event.deltaX)>Math.abs(event.deltaY))cam.theta-=event.deltaX*.004;
    else cam.radius*=Math.exp(Math.sign(event.deltaY)*Math.min(Math.abs(event.deltaY),60)*.0015);
  };
  canvas.addEventListener('wheel',onWheel,{passive:false});$('labels').addEventListener('wheel',onWheel,{passive:false});
  addEventListener('resize',()=>{if(transition)stepTransition(Infinity);if(innerWidth<=1000&&!$('log').hidden)syncLog(false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);resetCamera();});
  const TASK_LOG={active:'started task',done:'finished task',blocked:'needs a decision before continuing',review:'submitted draft for review',queued:'moved task back to the queue'};
  document.addEventListener('officetasks:server',()=>{
    for(const a of agents)a.label.classList.toggle('ai',!!window.officeTasks.agentFor(a.n));
    if(selected)selectAgent(selected);
  });
  // Speech bubbles for real task events: a short line on start and finish, and a steady one while an AI agent drafts.
  const SAY={active:'On it!',blocked:'Quick question!',review:'Ready for review',done:'Done!'};
  function say(agent,text,seconds=3.5){agent.sayText=text;agent.sayUntil=performance.now()+seconds*1000;}
  function sayingNow(agent){
    if(agent.sayUntil>performance.now())return agent.sayText;
    return window.officeTasks.agentFor(agent.n)&&window.officeTasks.activeFor(agent.n)?'Drafting…':'';
  }
  function syncBubble(agent){
    const text=sayingNow(agent);if(agent.sayShown===text)return;agent.sayShown=text;
    let bubble=agent.label.querySelector('.say');
    if(!text){bubble?.remove();return;}
    if(!bubble){bubble=document.createElement('span');bubble.className='say';bubble.setAttribute('aria-hidden','true');agent.label.append(bubble);}
    bubble.textContent=text;bubble.classList.toggle('drafting',text==='Drafting…');
  }
  // Task board and log summary follow the task list, whether it lives in the browser or on the server.
  function drawBoard(){
    const ctx=boardCanvas.getContext('2d'),W=boardCanvas.width,H=boardCanvas.height;
    const open=window.officeTasks.list().filter(t=>t.status!=='done').sort((a,b)=>(a.status==='active'?0:1)-(b.status==='active'?0:1));
    ctx.fillStyle='#fbf8f2';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#1e2230';ctx.font='700 44px Archivo, system-ui, sans-serif';ctx.textBaseline='middle';ctx.fillText('TASK BOARD',36,48);
    ctx.fillStyle='#6b6f7b';ctx.font='500 28px Archivo, system-ui, sans-serif';ctx.textAlign='right';ctx.fillText(`${open.length} open`,W-36,50);ctx.textAlign='left';
    ctx.fillStyle='#e8634a';ctx.fillRect(36,86,90,6);
    if(!open.length){ctx.fillStyle='#6b6f7b';ctx.font='500 34px Archivo, system-ui, sans-serif';ctx.fillText('No open tasks. Add one from Tasks.',36,230);}
    open.slice(0,5).forEach((task,i)=>{
      const y=150+i*70,person=TEAM.find(p=>p.n===task.assignee);
      ctx.fillStyle=person?hex(GROUPS[person.group].color):'#8a8479';ctx.beginPath();ctx.roundRect(36,y-22,86,44,10);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='700 24px "IBM Plex Mono", monospace';ctx.textAlign='center';ctx.fillText(person?.initials||'?',79,y+1);ctx.textAlign='left';
      ctx.fillStyle='#1e2230';ctx.font='500 30px Archivo, system-ui, sans-serif';
      let title=task.title;while(ctx.measureText(title).width>640&&title.length>4)title=title.slice(0,-2);if(title!==task.title)title=title.trimEnd()+'…';
      ctx.fillText(title,142,y+1);
      const [chip,ink,label]={active:['#fdeee9','#c24a31','In progress'],blocked:['#fff1d6','#9a6212','Question'],review:['#e8f3ec','#2f6b47','Review']}[task.status]||['#f0ece5','#6b6f7b','Queued'];
      ctx.fillStyle=chip;ctx.beginPath();ctx.roundRect(W-212,y-20,176,40,20);ctx.fill();
      ctx.fillStyle=ink;ctx.font='600 22px Archivo, system-ui, sans-serif';ctx.textAlign='center';ctx.fillText(label,W-124,y+1);ctx.textAlign='left';
    });
    if(open.length>5){ctx.fillStyle='#6b6f7b';ctx.font='500 24px Archivo, system-ui, sans-serif';ctx.fillText(`+${open.length-5} more in Tasks`,142,H-30);}
    boardTexture.needsUpdate=true;
  }
  function drawStats(){
    const list=window.officeTasks.list(),today=new Date().toDateString();
    const busy=new Set(list.filter(t=>t.status==='active').map(t=>t.assignee)).size;
    const done=list.filter(t=>t.status==='done'&&new Date(t.updatedAt||t.createdAt).toDateString()===today).length;
    $('logStats').replaceChildren(...[['On a task',busy],['Free',TEAM.length-busy],['Done today',done]].map(([label,value])=>{
      const item=document.createElement('div');const number=document.createElement('strong');number.textContent=value;
      const caption=document.createElement('span');caption.textContent=label;item.append(number,caption);return item;
    }));
    // Needs decision: agents that asked a question instead of guessing. One click opens those tasks.
    const waiting=list.filter(t=>t.status==='blocked'),button=$('decisions');button.hidden=!waiting.length;
    if(waiting.length){
      const who=[...new Set(waiting.map(t=>TEAM.find(p=>p.n===t.assignee)?.initials||t.assignee))].join(', ');
      button.textContent=`${waiting.length} ${waiting.length===1?'task needs':'tasks need'} your decision · ${who}`;
    }
  }
  $('decisions').onclick=()=>window.officeTasks.open(null,'blocked');
  document.addEventListener('officetasks:change',()=>{drawBoard();drawStats();});
  window.officeTasks.init(TEAM,(name,state,title)=>{const a=agents.find(a=>a.n===name);if(a&&window.officeTasks.activeFor(name))setPath(a,a.desk);if(a&&SAY[state])say(a,SAY[state]);if(a&&state==='done'&&window.officeLife.preferences.celebrate){a.celebrateUntil=simTime+2.5;log(`${name} celebrates a finished task`,a.group);}if(a&&state)log(`${name} ${TASK_LOG[state]}: ${title}`,a.group);},name=>{const a=agents.find(a=>a.n===name);if(a)selectAgent(a);});
  window.officeLife.init(TEAM,GROUPS);
  let currentMood='',lastMoodChoice='',lastMoodMinute=-1;
  const officeCat=new THREE.Group();floors[3].add(officeCat);officeCat.position.set(10,.08,P3);
  oval(.65,.48,1.05,0xc59664,0,.35,0,officeCat);oval(.55,.5,.5,0xc59664,0,.64,.48,officeCat);
  for(const x of [-.18,.18]){const ear=mesh(new THREE.ConeGeometry(.12,.25,3),0x976a42,x,.96,.48,officeCat,false);ear.rotation.z=x<0?.2:-.2;oval(.07,.09,.05,0x2a2622,x*.7,.7,.72,officeCat);}
  oval(.1,.07,.05,0x8f574e,0,.6,.75,officeCat);
  const catLegs=[];for(const x of [-.2,.2])for(const z of [-.3,.3])catLegs.push(oval(.15,.3,.17,0x976a42,x,.15,z,officeCat));
  const catTail=mesh(new THREE.CylinderGeometry(.055,.07,.8,10),0x976a42,0,.58,-.65,officeCat,false);catTail.rotation.x=-.6;
  officeCat.traverse(o=>o.userData.cat=true);
  const cat={state:'resting',until:0,path:[],target:null,petUntil:0};
  function petCat(){cat.petUntil=simTime+4;cat.until=Math.max(cat.until,simTime+4);$('catStatus').textContent='Moka purrs. A very good office cat.';status('Moka purrs.');log('Moka enjoys a head scratch');}
  function stepCat(dt){
    if(!dt)return;
    if(cat.petUntil>simTime){catTail.rotation.z=Math.sin(simTime*5)*.25;return;}
    if(cat.path.length){const point=cat.path[0],dx=point[0]-officeCat.position.x,dz=point[1]-officeCat.position.z,d=Math.hypot(dx,dz),step=dt*1.25;
      if(d<=step){officeCat.position.x=point[0];officeCat.position.z=point[1];cat.path.shift();}else{officeCat.position.x+=dx/d*step;officeCat.position.z+=dz/d*step;officeCat.rotation.y=Math.atan2(dx,dz);}
      catLegs.forEach((leg,i)=>leg.rotation.x=Math.sin(simTime*8+i*Math.PI)*.3);cat.state='walking';
      if(!cat.path.length){cat.state=cat.target?.sleep?'sleeping on the sofa':cat.target?.desk?'visiting a free desk':'resting';cat.until=simTime+rand(12,24);officeCat.position.y=cat.target?.sleep?.55:cat.target?.desk?.9:.08;}
    }else if(simTime>cat.until&&routineOn){
      officeCat.position.y=.08;const idle=agents.filter(a=>a.floor===3&&!window.officeTasks.activeFor(a.n)&&a.spot===a.desk&&!a.activity&&!a.visitor);
      const visitor=Math.random()<.35&&pick(idle),target=visitor?{x:visitor.desk.x,z:visitor.desk.z+visitor.desk.f*.9,desk:true}:pick([{x:10,z:P3},{x:12.6,z:-10.2},{x:14.75,z:-6.7,sleep:true}]);
      const route=navPath(3,[officeCat.position.x,officeCat.position.z],[target.x,target.z],null,null);
      if(route){cat.target=target;cat.path=route;cat.until=simTime+15;}else cat.until=simTime+5;
    }
    officeCat.scale.set(1,cat.state==='sleeping on the sofa'?.65:1,1);catTail.rotation.z=Math.sin(simTime*1.8)*.15;
    $('catStatus').textContent=`Moka is ${cat.state}.`;
  }
  function coffee(members){
    const guests=members.map(n=>agents.find(a=>a.n===n));if(guests.some(a=>!a)||new Set(members).size!==2)return false;
    const seats=hangouts.filter(s=>s.state==='drink'&&(!s.occupant||guests.includes(s.occupant)));if(seats.length<2)return false;
    guests.forEach(clearActivity);const meeting={members:guests};guests.forEach((a,i)=>assign(a,seats[i],18,{meeting}));log(`${members.join(' and ')} meet for coffee`,guests[0].group);return true;
  }
  const projected=new THREE.Vector3(),world=new THREE.Vector3();let last=performance.now();
  function frame(now) {
    // Allow slower renderers to keep pace, while limiting jumps after a background-tab pause.
    requestAnimationFrame(frame);const realDt=Math.min(.15,(now-last)/1000);last=now;const dt=paused?0:realDt;simTime+=dt;
    if($('taskDialog').open){for(const k in keys)keys[k]=false;}
    if(transition&&!follow)stepTransition(realDt);
    if(!drag&&cam.spin){cam.theta+=cam.spin*realDt;cam.spin*=Math.pow(.03,realDt);if(Math.abs(cam.spin)<.01)cam.spin=0;}
    const move=realDt*cam.radius*.3,fx=-Math.sin(cam.theta),fz=-Math.cos(cam.theta);
    if(keys.w){cam.target.x+=fx*move;cam.target.z+=fz*move;}if(keys.s){cam.target.x-=fx*move;cam.target.z-=fz*move;}
    if(keys.d){cam.target.x-=fz*move;cam.target.z+=fx*move;}if(keys.a){cam.target.x+=fz*move;cam.target.z-=fx*move;}
    if(keys.arrowleft)cam.theta-=realDt*1.3;if(keys.arrowright)cam.theta+=realDt*1.3;
    if(keys.arrowup)cam.phi-=realDt*.9;if(keys.arrowdown)cam.phi+=realDt*.9;
    if(keys.q)cam.radius+=move;if(keys.e)cam.radius-=move;
    cam.phi=Math.max(.18,Math.min(1.45,cam.phi));cam.radius=Math.max(12,Math.min(190,cam.radius));
    cam.target.x=Math.max(-25,Math.min(25,cam.target.x));cam.target.z=Math.max(-20,Math.min(20,cam.target.z));
    if(follow){if(keys.arrowleft)follow.yaw+=realDt*1.6;if(keys.arrowright)follow.yaw-=realDt*1.6;if(keys.arrowup)follow.pitch=Math.min(.9,follow.pitch+realDt);if(keys.arrowdown)follow.pitch=Math.max(-1.2,follow.pitch-realDt);}
    else{camera.position.set(cam.target.x+cam.radius*Math.sin(cam.phi)*Math.sin(cam.theta),cam.target.y+cam.radius*Math.cos(cam.phi),cam.target.z+cam.radius*Math.sin(cam.phi)*Math.cos(cam.theta));camera.lookAt(cam.target);camera.updateMatrixWorld();}
    for(const a of agents){updateAgent(a,dt);if(dt>0)live(a);syncTaskDisplay(a);}
    stepCat(dt);const minute=Math.floor(Date.now()/60000);if(lastMoodChoice!==window.officeLife.preferences.mood||lastMoodMinute!==minute){applyOfficeMood();lastMoodChoice=window.officeLife.preferences.mood;lastMoodMinute=minute;}
    if(skyline.visible)animateSky(dt);
    stepShop(dt);
    for(const d of doors){const near=agents.some(a=>a.floor===d.floor&&a.state!=='stairs'&&a.g.position.distanceTo(d.center)<1.6);d.open+=((near?1:0)-d.open)*Math.min(1,dt*6);d.pivot.rotation.y=d.base+d.open*1.45;}
    if(follow){scene.updateMatrixWorld(true);followCamera(realDt);}
    scene.updateMatrixWorld(true);
    const occupied=[];
    for(const a of [...agents].sort((a,b)=>Number(b===selected)-Number(a===selected))){
      a.g.getWorldPosition(world);projected.copy(world);projected.y+=2.65;projected.project(camera);
      const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;
      const width=a.initials.length*7+24;
      let labelY=y;
      if(activeFloor!==0)for(let step=0;step<5&&occupied.some(p=>Math.abs(x-p.x)<(width+p.width)/2+5&&Math.abs(labelY-p.y)<34);step++)labelY-=35;
      const compact=innerWidth<1000&&cam.radius>80;
      const representative=agents.find(p=>p.group===a.group)===a;
      const clearLabel=activeFloor!==0||a===selected||!occupied.some(p=>Math.abs(x-p.x)<(width+p.width)/2+5&&Math.abs(labelY-p.y)<34);
      const show=clearLabel&&(activeFloor!==0||a.state==='stairs'||a===selected)&&(!compact||representative||a===selected)&&visibleAgent(a)&&a.g.visible&&projected.z<1&&x>width/2&&x<innerWidth-width/2&&labelY>(innerWidth<=1000?230:95)&&y<innerHeight-130;
      a.label.hidden=!show||(follow?.mode==='eyes'&&follow.agent===a);
      syncBubble(a);
      if(show){a.label.style.transform=`translate(${x}px,${labelY}px) translate(-50%,-100%)`;a.label.style.setProperty('--stem',`${y-labelY+6}px`);occupied.push({x,y:labelY,width});}
    }
    if(selected){
      selected.g.getWorldPosition(world);ring.position.set(world.x,world.y+.07,world.z);ring.visible=!follow&&selected.g.visible&&visibleAgent(selected);
      $('iLocation').textContent=selected.state==='stairs'?`Left stairs · ${selected.stairTrip.from} to ${selected.stairTrip.to}`:`Floor ${selected.floor} · ${FLOOR[selected.floor].name}`;$('iActivity').textContent=agentStatus(selected);
    }
    for(let level=1;level<=4;level++){
      const count=agents.filter(a=>a.floor===level&&a.state!=='stairs').length;
      const badge=document.querySelector(`[data-floor="${level}"] .floor-count`);
      if(badge&&badge.textContent!==String(count)){badge.textContent=String(count);badge.setAttribute('aria-label',`${count} team members on this floor`);}
    }
    renderer.render(scene,camera);
  }
  // Capture the actual floor models once for the navigation previews.
  renderer.setSize(200,140,false);camera.aspect=200/140;camera.updateProjectionMatrix();
  for(let level=1;level<=4;level++){
    showLevels([level],false);camera.position.set(-32,floorY(level)+35,42);camera.lookAt(0,floorY(level),0);
    renderer.render(scene,camera);
    const button=document.querySelector(`[data-floor="${level}"]`),thumb=document.createElement('img');
    thumb.className='floor-thumb';thumb.alt='';thumb.width=60;thumb.height=42;thumb.src=renderer.domElement.toDataURL('image/png');button.prepend(thumb);
    const count=document.createElement('span');count.className='floor-count';count.textContent='0';button.append(count);
  }
  renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  setFloor(3);viewReady=true;requestAnimationFrame(frame);
  window.officeScene={
    petCat,coffee,
    lifeSnapshot:()=>({mood:currentMood,cat:{state:cat.state,position:officeCat.position.toArray(),petting:cat.petUntil>simTime},habits:agents.map(a=>({name:a.n,habit:window.officeLife.habits[a.index],celebrating:a.celebrateUntil>simTime}))}),
    snapshot:()=>({shop:{states:shop.people.map(p=>p.state),barbers:barbers.map(b=>b.pose),cashier:cashier.pose},transitioning:!!transition,sky:skyline.visible,floor:activeFloor,paused,routine:routineOn,follow:follow&&{name:follow.agent.n,mode:follow.mode},cameraPosition:camera.position.toArray(),doors:doors.map(d=>Math.round(d.open*100)/100),camera:{theta:cam.theta,phi:cam.phi,radius:cam.radius,target:cam.target.toArray()},
      team:agents.map(a=>({name:a.n,initials:a.initials,gender:a.gender,role:a.role,group:a.group,floor:a.floor,state:a.state,visible:a.g.visible,position:a.g.getWorldPosition(new THREE.Vector3()).toArray(),heading:new THREE.Euler().setFromQuaternion(a.g.getWorldQuaternion(new THREE.Quaternion()),'YXZ').y,spotFacing:a.spot?facing(a.spot):null,path:a.path.slice(0,4).map(q=>q.map(v=>+v.toFixed(2))),pathLeft:a.path.length,blocked:+(a.blocked||0).toFixed(2),pass:a.passUntil>simTime,dest:a.destination&&[a.destination.x,a.destination.z],sitting:SIT.has(a.state)&&!a.spot?.standing,destination:a.destination.floor,activity:a.activity?.spot.state||null,atDesk:a.spot===a.desk,talkingWith:companions(a)[0]?.n||null})),
      visibleFloors:Object.keys(floors).filter(k=>floors[k].visible).map(Number)}),
    // The walking grid of a floor (1 = blocked), for tests and debugging.
    navGrid:level=>({cell:NAV.cell,x0:NAV.x0,z0:NAV.z0,w:NAV.w,h:NAV.h,cells:Array.from(navGrids[level]||[])}),
    // Scripted camera moves for tests and recordings: any of target [x,y,z], theta, phi, radius.
    setCamera:view=>{if(view.target)cam.target.set(...view.target);for(const key of ['theta','phi','radius'])if(view[key]!==undefined)cam[key]=view[key];cam.spin=0;},
    // Screen position of a floor's centre, used by the browser test to click into a floor from the building view.
    floorPoint:level=>{const v=new THREE.Vector3(0,2,12.6);floors[level].localToWorld(v);v.project(camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};}
  };
})();
