const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(name,w=390,h=844,done=()=>{}) {
 const scope=vm.createContext({Math});
 vm.runInContext(fs.readFileSync(`js/pizza-${name}.js`,'utf8')+`;this.Game=Pizza${name[0].toUpperCase()+name.slice(1)}Game;`,scope);
 const g=new scope.Game({getContext:()=>({})},w,h,done);g.start();return g;
}
test('runner keeps collected John Coin on following frames',()=>{
 const g=game('runner');g.objects=[{lane:1,z:.1,kind:'coin'}];g.update(.02);assert.equal(g.coins,5);g.update(.02);assert.equal(g.score,5);
});
test('runner swept collision catches obstacles crossed within a frame',()=>{
 const g=game('runner');g.objects=[{lane:1,z:.1,kind:'van'}];g.update(.05);assert.equal(g.state,'gameover');
});
test('runner keeps the hit obstacle ahead while John settles into a fall',()=>{
 const g=game('runner');g.jump=0.4;g.objects=[{lane:1,z:.1,kind:'van'}];g.update(.02);assert.equal(g.state,'gameover');assert.equal(g.damageProgress,0);assert.equal(g.objects[0].hit,true);assert.equal(g.objects[0].z,.55);assert.equal(g.jump,0);g.update(.2);assert.ok(g.damageProgress>0&&g.damageProgress<1);assert.notEqual(g.damageDirection,0);
});
test('jump clears barrier, slide clears arch, neither clears van',()=>{
 for(const [kind,jump,slide,expected] of [['barrier',1,0,'playing'],['arch',0,.5,'playing'],['van',1,0,'gameover'],['van',0,.5,'gameover']]){
 const g=game('runner');g.jump=jump;g.slide=slide;g.objects=[{lane:1,z:.1,kind}];g.update(.02);assert.equal(g.state,expected);
 }
});
test('random runner sections preserve an adjacent route and recovery at turbo speed',()=>{
 const g=game('runner');let lastChallenge=null;const patterns=new Set();
 for(let section=0;section<500;section++) {
  g.objects=[];g.spawnRow();const obstacles=g.objects.filter(o=>o.kind!=='coin');
  const depths=[...new Set(obstacles.map(o=>o.z))].sort((a,b)=>a-b);let previousLane;
  for(let i=0;i<depths.length;i++) {
   const row=obstacles.filter(o=>o.z===depths[i]);const route=[0,1,2].filter(l=>!row.some(o=>o.lane===l&&o.kind==='van'));
   assert.ok(route.length>0,'never three vans');
   if(depths.length>1){assert.equal(route.length,1);if(i)assert.ok(Math.abs(route[0]-previousLane)<=1);previousLane=route[0];}
   if(i)assert.ok(depths[i]-depths[i-1]>=48,'action recovery at 50 m/s');
  }
  if(depths.length>1){assert.notEqual(g.lastChallenge,lastChallenge);lastChallenge=g.lastChallenge;patterns.add(lastChallenge);}
  assert.ok(g.spawnTimer*19>depths.at(-1)-75+40,'sections cannot overlap');
 }
 assert.equal(patterns.size,4);
});

test('swipe up jumps without changing lane; horizontal swipe changes once',()=>{
 const g=game('runner');g.onTouchStart(200,400);g.onTouchMove(200,350);g.onTouchEnd(200,350);assert.equal(g.targetLane,1);assert.ok(g.jumpVelocity>0);
 g.onTouchStart(200,400);g.onTouchMove(250,400);g.onTouchMove(300,400);g.onTouchEnd(300,400);assert.equal(g.targetLane,2);
});
test('runner turbo temporarily increases speed and respects cooldown',()=>{
 const g=game('runner');g.spawnTimer=99;g.update(.01);const cruise=g.speed;assert.equal(g.turbo(),true);g.update(.01);assert.ok(g.speed>cruise);assert.equal(g.turbo(),false);g.update(8);assert.equal(g.turbo(),true);
});
test('runner ends once and destroy cancels pending completion',()=>{
 let n=0;const g=game('runner',390,844,()=>n++);g.state='gameover';for(let i=0;i<100;i++)g.update(.02);assert.equal(n,1);
 const other=game('runner',390,844,()=>n++);other.state='gameover';other.destroy();other.update(1);assert.equal(n,1);
});
test('catcher cannot produce negative balance or multiple game over calls',()=>{
 let n=0;const g=game('catcher',390,844,()=>n++);g.catchItem({points:-20,bad:true,x:0,y:0});assert.equal(g.score,0);g.loseLife();g.loseLife();g.loseLife();assert.equal(n,1);
});
test('catcher rewards tortilha and penalizes empty plates',()=>{
 const source=fs.readFileSync('js/pizza-catcher.js','utf8');assert.match(source,/type: 'tortilha'.*points: 10.*bad: false/);assert.match(source,/type: 'plate'.*bad: true/);assert.doesNotMatch(source,/type: 'tortilha'.*bad: true/);
});
test('ninja slice uses segment distance and awards combo',()=>{
 const g=game('ninja');g.items=[{id:'pizza',x:100,y:200,size:50,pts:10,vx:0,vy:0,gravity:300,rot:0,rotSpeed:0}];g.onTouchStart(30,200);g.onTouchMove(160,200);assert.equal(g.score,10);assert.equal(g.items.length,0);assert.equal(g.particles.filter(p=>p.isHalf).length,2);
});
test('ninja John Coin uses the coin sound path and fast defeat transition',()=>{
 const source=fs.readFileSync('js/pizza-ninja.js','utf8');assert.match(source,/item\.isCoin \? 'coin'/);const g=game('ninja');g.gameOver();assert.equal(g.endTimer,.25);
});
test('ninja end timer is singular and destroyed games cannot report',()=>{
 let n=0;const g=game('ninja',390,844,()=>n++);g.gameOver();g.gameOver();g.update(1);g.update(1);assert.equal(n,1);const other=game('ninja',390,844,()=>n++);other.gameOver();other.destroy();other.update(1);assert.equal(n,1);
});
test('perspective stays finite after portrait and landscape resizes',()=>{
 const g=game('runner');for(const [w,h] of [[390,844],[1000,720],[844,390]]){g.resize(w,h);for(const z of [-5,0,75]){const p=g.project(2,1,z);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.s>0);}}
});
function sceneryFrame(distance) {
 const calls=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>gradient:()=>{},set:()=>true});
 const scope=vm.createContext({Math,JohnArt:{oval(){},poly(){},john(){},box(){}}});
 vm.runInContext(fs.readFileSync('js/pizza-runner.js','utf8')+';this.Game=PizzaRunnerGame',scope);
 const g=new scope.Game({getContext:()=>ctx},390,844,()=>{});
 g.building=(side,z,id)=>calls.push({kind:'building',side,z,id});
 g.palm=(side,z)=>calls.push({kind:'palm',side,z});
 g.distance=distance;g.render();return calls;
}
test('buildings keep their appearance and move continuously across a street segment boundary',()=>{
 const before=sceneryFrame(11.99),after=sceneryFrame(12.01);
 const building=before.find(o=>o.kind==='building'&&o.side===1&&Math.abs(o.z)<.1);
 const next=after.find(o=>o.kind==='building'&&o.side===building.side&&o.id===building.id);
 assert.ok(next,'same building must remain present');assert.ok(Math.abs(next.z-building.z+.02)<1e-8,'building must advance 2 cm, not teleport 12 m');
});
test('palms stay visible as they pass the player instead of disappearing at z=0',()=>{
 const after=sceneryFrame(11.01);
 assert.ok(after.some(o=>o.kind==='palm'&&o.side===1&&Math.abs(o.z+.01)<1e-8));
});
test('near-camera walls are clipped without projecting vertices behind the camera',()=>{
 const drawn=[];const scope=vm.createContext({Math,JohnArt:{poly(c,points){drawn.push(points);}}});
 vm.runInContext(fs.readFileSync('js/pizza-runner.js','utf8')+';this.Game=PizzaRunnerGame',scope);
 const g=new scope.Game({getContext:()=>({})},390,844,()=>{});
 const depths=[];const project=g.project.bind(g);g.project=(x,y,z)=>{depths.push(z);return project(x,y,z);};
 g.quad([[4,0,-10],[4,0,1],[4,5,1],[4,5,-10]],'#fff');
 assert.equal(drawn.length,1);assert.ok(depths.every(z=>z>=-7.5));
 assert.ok(drawn[0].every(point=>point.every(Number.isFinite)));
 g.quad([[4,0,-12],[4,0,-10],[4,5,-10],[4,5,-12]],'#fff');assert.equal(drawn.length,1);
});
test('street-facing walls remain while the front of a building passes behind the camera',()=>{
 assert.ok(sceneryFrame(20).some(o=>o.kind==='building'&&o.side===1&&o.id===1&&o.z===-8));
 for(const boundary of [24,120,1200]) {
  const before=sceneryFrame(boundary-.01),after=sceneryFrame(boundary+.01);
  for(const b of before.filter(o=>o.kind==='building'&&o.z>0&&o.z<120)){
   const next=after.find(o=>o.kind===b.kind&&o.side===b.side&&o.id===b.id);
   assert.ok(next);assert.ok(Math.abs(next.z-b.z+.02)<1e-7);
  }
 }
});
test('runner inverts beach and building sides between delivery and return stages',()=>{
 const scope=vm.createContext({Math,JohnArt:{oval(){},poly(){},john(){},box(){}}});
 vm.runInContext(fs.readFileSync('js/pizza-runner.js','utf8')+';this.Game=PizzaRunnerGame',scope);
 const g=new scope.Game({getContext:()=>({})},390,844,()=>{});
 assert.equal(g.beachSide(),-1);assert.equal(g.buildingSide(),1);
 g.stage=1;
 assert.equal(g.beachSide(),1);assert.equal(g.buildingSide(),-1);
 g.stage=2;
 assert.equal(g.beachSide(),-1);assert.equal(g.buildingSide(),1);
});
test('catcher draws falling food in front of John',()=>{
 const order=[];const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
 const scope=vm.createContext({Math,JohnArt:{kitchen(){order.push('background');},food(){order.push('food');},box(){}}});
 vm.runInContext(fs.readFileSync('js/pizza-catcher.js','utf8')+';this.Game=PizzaCatcherGame',scope);
 const g=new scope.Game({getContext:()=>ctx},390,844,()=>{});g.start();
 g.drawChef=()=>order.push('john');g.items=[{type:'pizza',x:195,y:700,rotation:0}];g.render();
 assert.deepEqual(order,['background','john','food']);
});
test('pizza artwork uses a slice silhouette',()=>{
 const source=fs.readFileSync('js/art.js','utf8');const start=source.indexOf("else if (type === 'pizza' || type === 'burnt')");const end=source.indexOf("} else if(type==='tomato')",start);const block=source.slice(start,end);assert.match(block,/this\.poly/);assert.doesNotMatch(block,/this\.oval\(c,0,4,25,22/);
});
test('missed pizza lands on the visible floor instead of falling below it',()=>{
 const g=game('catcher');g.spawnTimer=99;g.items=[{type:'pizza',x:20,y:g.h-50,speed:0,rotation:0,rotSpeed:0,mustCatch:true}];
 g.update(.016);assert.equal(g.items.length,0);assert.equal(g.lives,2);
});
test('runner palms, including crowns, fit between curb and buildings on mobile and desktop',()=>{
 const g=game('runner');const layout=g.sceneryLayout;
 const wall=layout.buildingCenter-layout.buildingWidth/2;
 assert.ok(layout.palmX-.34>3.6,'planting bed must be outside the curb');
 assert.ok(layout.palmX+.34<layout.sidewalkEdge,'planting bed must be on sidewalk');
 for(const [w,h] of [[320,740],[390,844],[1000,650]]) {
  g.resize(w,h);const palm=g.project(layout.palmX,4.3,12),facade=g.project(wall,4.3,12);
  assert.ok(palm.x+palm.s*1.1<facade.x,'even the widest crown must clear the wall');
 }
});

test('mixed challenges include repeated actions instead of strict alternation',()=>{
 const g=game('runner');let previous=null, mixed=0;
 for(let i=0;i<500;i++) {
  g.objects=[];g.spawnRow();
  if(g.lastChallenge!=='mixed'||g.objects.filter(o=>o.kind==='van').length<4)continue;
  const sequence=g.objects.filter(o=>o.kind==='barrier'||o.kind==='hole'||o.kind==='arch').map(o=>o.kind==='arch'?'D':'J').join('');
  assert.match(sequence,/JJ|DD/);assert.notEqual(sequence,previous);previous=sequence;mixed++;
 }
 assert.ok(mixed>0);
});

test('delivery awards bonus once and next stage preserves score',()=>{
 const g=game('runner');g.distance=g.stageLength()-.1;g.spawnTimer=99;g.update(.02);
 assert.equal(g.state,'arriving');assert.equal(g.deliveryBonus,100);const score=g.score;
 for(let i=0;i<400&&g.state==='arriving';i++)g.update(.02);
 assert.equal(g.state,'delivery');assert.equal(g.distance,g.stopAt());assert.equal(g.speed,0);assert.equal(g.score,score);
 g.update(3);assert.equal(g.score,score);g.nextStage();assert.equal(g.stage,1);assert.equal(g.state,'playing');assert.equal(g.score,score);assert.equal(g.objects.length,0);assert.equal(g.deliveryBonus,100);
});
test('runner speed keeps climbing across deliveries and stages get longer',()=>{
 const g=game('runner');g.spawnTimer=99;g.distance=g.stageLength()-.1;g.update(.02);const endSpeed=g.cruiseSpeed();
 while(g.state==='arriving')g.update(.02);const firstLength=g.stageLength();g.nextStage();g.spawnTimer=99;g.update(.02);
 assert.ok(g.speed>=endSpeed,'speed does not reset on the next delivery');assert.ok(g.stageLength()>firstLength);
});
test('runner ignores steering once the delivery is arriving',()=>{
 const g=game('runner');g.spawnTimer=99;g.distance=g.stageLength()-.1;g.update(.02);g.onTouchStart(200,400);g.onTouchMove(200,350);g.onTouchEnd(200,350);assert.equal(g.jumpVelocity,0);
});
test('return trip to the pizzeria is not announced as a delivery',()=>{
 const g=game('runner');g.stage=1;g.spawnTimer=99;g.distance=g.stageLength()-.1;g.update(.02);while(g.state==='arriving')g.update(.02);
 assert.equal(g.destinationKind(),'pizzeria');assert.doesNotMatch(g.message,/entreg/i);assert.doesNotMatch(g.deliveryInfo().title+g.deliveryInfo().text,/entreg/i);
 assert.equal(g.stageTitle(),'VOLTA AO RESTAURANTE');g.stage=2;assert.equal(g.stageTitle(),'ENTREGA 2');
});
test('holes require jumping and cannot be ducked',()=>{
 for(const [jump,slide,state] of [[1,0,'playing'],[0,.5,'gameover']]){
 const g=game('runner');g.jump=jump;g.slide=slide;g.objects=[{lane:1,z:.1,kind:'hole'}];g.update(.02);assert.equal(g.state,state);
 }
});
test('arrival zone remains clear of newly generated obstacles',()=>{
 const g=game('runner');g.distance=g.stageLength()-90;g.spawnRow();assert.equal(g.objects.length,0);
});
test('deliveries count only family arrivals, once each, and reset on restart',()=>{
 const g=game('runner');assert.equal(g.deliveries,0);
 const arrive=()=>{g.spawnTimer=99;g.distance=g.stageStart+g.stageLength()-.1;g.update(.02);while(g.state==='arriving')g.update(.02);};
 arrive();assert.equal(g.destinationKind(),'family');assert.equal(g.deliveries,1);
 g.update(1);assert.equal(g.deliveries,1); // arrival is a single event, not counted again while waiting
 g.nextStage();arrive();assert.equal(g.destinationKind(),'pizzeria');assert.equal(g.deliveries,1); // return trip does not count
 g.nextStage();arrive();assert.equal(g.destinationKind(),'family');assert.equal(g.deliveries,2);
 g.start();assert.equal(g.deliveries,0);
});
test('all 3 games yield equivalent John Coin rates over standard play duration',()=>{
 const gr=game('runner');
 for(let t=0;t<60;t+=.02){
  gr.objects=gr.objects.filter(o=>o.kind==='coin'||o.z>5);
  const coin=gr.objects.find(o=>o.kind==='coin'&&o.z>0&&o.z<10);
  if(coin)gr.lane=coin.lane;
  gr.update(.02);
  if(gr.state==='delivery')gr.nextStage();
 }
 const gc=game('catcher');gc.loseLife=()=>{};
 for(let t=0;t<60;t+=.02){
  const good=gc.items.filter(i=>!i.bad).sort((a,b)=>b.y-a.y);
  if(good.length>0)gc.targetX=good[0].x;
  gc.update(.02);
 }
 const gn=game('ninja');gn.gameOver=()=>{};
 for(let t=0;t<60;t+=.02){
  const good=gn.items.filter(i=>!i.bad&&!i.sliced&&i.y>200&&i.y<700);
  if(good.length>0){
   gn.onTouchStart(good[0].x-10,good[0].y);
   for(const it of good)gn.onTouchMove(it.x,it.y);
   gn.onTouchEnd(good.at(-1).x+10,good.at(-1).y);
  }
  gn.update(.02);
 }
 assert.ok(gr.score>=250&&gr.score<=600,`runner score ${gr.score} out of balanced range`);
 assert.ok(gc.score>=250&&gc.score<=600,`catcher score ${gc.score} out of balanced range`);
 assert.ok(gn.score>=250&&gn.score<=600,`ninja score ${gn.score} out of balanced range`);
});
