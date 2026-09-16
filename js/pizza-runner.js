// Perspective runner: world-space movement and collisions, painter-sorted scenery.
class PizzaRunnerGame {
    constructor(canvas, w, h, onGameOver) {
        this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.w=w; this.h=h; this.onGameOver=onGameOver; this.start();
    }
    start() {
        this.stage=0; this.stageStart=0; this.deliveryBonus=0; this.coasted=0; this.score=0; this.coins=0; this.distance=0; this.speed=19; this.time=0; this.deliveries=0;
        this.turboTime=0; this.turboCooldown=0;
        this.targetLane=1; this.lane=1; this.jump=0; this.jumpVelocity=0; this.slide=0;
        this.sectionIndex=0; this.easySectionsLeft=2; this.lastChallenge=null; this.lastActionSequence=null;
        this.state='playing'; this.objects=[]; this.particles=[]; this.spawnTimer=1.5; this.arrivalTime=0; this.arrivalDecel=0;
        this.touch=null; this.crashTime=0; this.damageProgress=0; this.damageDirection=1; this.impactTime=0; this.hitObject=null; this.message='Bora entregar essas pizzas!'; this.messageTime=3;
        this.sceneryLayout={buildingCenter:8.3,buildingWidth:3.7,palmX:4.5,sidewalkEdge:6.5};
    }
    nextStage() {
        if(this.state!=='delivery') return;
        // Meters braked into the destination are not scored; speed keeps growing from total distance.
        this.coasted+=this.distance-this.stageStart-this.stageLength();
        this.stage++;this.stageStart=this.distance;this.objects=[];this.particles=[];this.arrivalTime=0;
        this.sectionIndex=0;this.easySectionsLeft=Math.max(1,2-this.stage);this.spawnTimer=1.5;
        this.jump=0;this.jumpVelocity=0;this.slide=0;this.turboTime=0;this.turboCooldown=0;
        this.state='playing';this.message=this.destinationKind()==='family'?'Nova entrega!':'Bora voltar pro Sushinachos!';this.messageTime=2;
    }
    stageName() {return ['Orla de dia','Pôr do sol • vento','Entrega noturna','Chuva na orla'][this.stage%4];}
    stageLength() {return 1500+Math.min(this.stage,4)*250;}
    stopAt() {return this.stageStart+this.stageLength()+30;}
    cruiseSpeed() {return Math.min(40,19+this.distance*.004);}
    destinationKind() {return this.stage%2?'pizzeria':'family';}
    // Even stages deliver to a family; odd stages return to the pizzeria to pick up the next order.
    stageTitle() {return this.destinationKind()==='family'?`ENTREGA ${Math.floor(this.stage/2)+1}`:'VOLTA AO RESTAURANTE';}
    deliveryInfo() {
        return this.destinationKind()==='family'
            ?{title:'🍣 Entrega concluída!',text:'Os clientes receberam os combos de sushi e nachos quentinhos!',button:'Voltar pro Sushinachos →'}
            :{title:'🌮 Pedido pronto!',text:'De volta ao Sushinachos: os próximos pedidos já estão no balcão.',button:'Levar o pedido →'};
    }
    updateScore() {this.score=this.coins+Math.floor((Math.min(this.distance,this.stageStart+this.stageLength())-this.coasted)/10)+this.deliveryBonus;}
    physics(dt,laneRate) {
        this.lane+=(this.targetLane-this.lane)*Math.min(1,dt*laneRate);
        this.slide=Math.max(0,this.slide-dt);
        if(this.jumpVelocity || this.jump>0){this.jump+=this.jumpVelocity*dt;this.jumpVelocity-=22*dt;if(this.jump<0){this.jump=0;this.jumpVelocity=0;}}
        this.messageTime-=dt;
    }
    arrive(dt) {
        this.physics(dt,6);
        const remaining=this.stopAt()-this.distance;
        if(remaining>.05) {this.speed=Math.min(this.speed,Math.sqrt(2*this.arrivalDecel*remaining));this.distance+=Math.min(remaining,Math.max(this.speed,2)*dt);return;}
        if(this.arrivalTime===0) {
            this.distance=this.stopAt();this.speed=0;this.jump=0;this.jumpVelocity=0;this.message=this.destinationKind()==='family'?'Pedido entregue!':'Combo novo na mão!';this.messageTime=1.6;
            // Only the family stop counts as a real delivery; the return trip to the pizzeria does not.
            if(this.destinationKind()==='family')this.deliveries++;
            if(typeof ChefJohnAudio!=='undefined')ChefJohnAudio.play('coin');
        }
        this.arrivalTime+=dt;
        if(this.arrivalTime>=1.4)this.state='delivery';
    }
    resize(w,h) { this.w=w;this.h=h; }
    project(x,y,z) {
        // Camera looks down from above and behind John. Reciprocal depth gives real foreshortening.
        const f=Math.min(this.w*.95,this.h*.95), depth=z+8;
        return {x:this.w/2+x*f/depth,y:this.h*.29+(4.4-y)*this.h*.95/depth,s:Math.min(this.w*1.4,this.h*.95)/depth};
    }
    setLane(n) { this.targetLane=Math.max(0,Math.min(2,n)); }
    leap() { if(this.jump===0 && this.slide<=0){this.jumpVelocity=8.5;if(typeof ChefJohnAudio!=='undefined') ChefJohnAudio.play('jump');} }
    duck() {if(this.jump<.1){this.slide=.8;this.jumpVelocity=0;} }
    turbo() {
        if(this.state!=='playing' || this.turboTime>0 || this.turboCooldown>0) return false;
        this.turboTime=3.25; this.turboCooldown=8;
        if(typeof ChefJohnAudio!=='undefined') ChefJohnAudio.play('turbo');
        this.message='TURBO!'; this.messageTime=.9;
        return true;
    }
    spawnRow() {
        const pick=values=>values[Math.floor(Math.random()*values.length)];
        const add=(lane,z,kind)=>{if(this.distance+z<this.stageStart+this.stageLength()-30)this.objects.push({lane,z,kind,checked:false});};
        this.sectionIndex++;
        if(this.easySectionsLeft>0) {
            this.easySectionsLeft--;
            const lane=pick([0,1,2]), safe=pick([0,1,2].filter(n=>n!==lane));
            add(lane,75,pick(['van','barrier','arch','hole']));
            for(let i=0;i<5;i++) add(safe,81+i*3,'coin');
            this.spawnTimer=(52+Math.random()*20)/19;
            return;
        }
        const pattern=pick(['slalom','jump','duck','mixed'].filter(p=>p!==this.lastChallenge));
        this.lastChallenge=pattern;
        // Later deliveries give fewer breathers and longer challenges.
        this.easySectionsLeft=pick([[1,2,3],[1,2],[0,1,1,2]][Math.min(this.stage,2)]);
        // Repeated actions form rhythms instead of a predictable jump/duck alternation.
        const rhythms=['JJJ','DDD','DDJJ','JJDDD','JJJDD','DJJJD','JDDJJ','DDDJJ','JJDDJJ','DDJJDD'];
        const sequence=pattern==='mixed'?pick(rhythms.filter(r=>r!==this.lastActionSequence)):null;
        if(sequence) this.lastActionSequence=sequence;
        const count=sequence?sequence.length:pick([3,4,5,6])+Math.min(2,this.stage);
        let safe=pick([0,1,2]), z=75;
        for(let row=0;row<count;row++) {
            // Only adjacent lane changes; 48 m allows action recovery even during turbo.
            if(row) {z+=48+Math.random()*16;safe=pick([safe-1,safe,safe+1].filter(n=>n>=0&&n<=2));}
            for(let lane=0;lane<3;lane++) if(lane!==safe) add(lane,z,'van');
            const action=pattern==='jump'?'barrier':pattern==='duck'?'arch':sequence?(sequence[row]==='J'?'barrier':'arch'):null;
            if(action) add(safe,z,action==='barrier'&&Math.random()<.35?'hole':action);
            for(let i=0;i<3;i++) add(safe,z+9+i*3,'coin');
        }
        this.spawnTimer=(z-75+65+Math.random()*25)/19;
    }

    update(dt) {
        this.time+=dt;
        this.turboTime=Math.max(0,this.turboTime-dt);
        this.turboCooldown=Math.max(0,this.turboCooldown-dt);
        this.particles=this.particles.filter(p=>{p.life-=dt;p.y-=dt*48;return p.life>0;});
        if(this.state==='gameover') {this.crashTime+=dt;this.damageProgress=Math.min(1,this.crashTime/.75);this.impactTime=Math.max(0,this.impactTime-dt);if(this.crashTime>(this.hitObject?.kind==='hole'?1.5:1.15)){this.state='ended';this.onGameOver(this.score);}return;}
        if(this.state==='arriving') {this.arrive(dt);this.updateScore();return;}
        if(this.state!=='playing') return;
        this.speed=Math.min(50,this.cruiseSpeed()*(this.turboTime>0?1.5:1));const step=this.speed*dt;this.distance+=step;
        this.physics(dt,15);
        this.spawnTimer-=step/19;
        if(this.spawnTimer<=0){this.spawnRow();}
        for(const o of this.objects) {
            const oldZ=o.z;o.z-=step;
            if(!o.checked && oldZ>=0 && o.z<=0) {
                o.checked=true;
                if(Math.abs(o.lane-this.lane)<.42) {
                    if(o.kind==='coin') {this.coins+=5;if(typeof ChefJohnAudio!=='undefined') ChefJohnAudio.play('coin');this.message='+5 John Coin';this.messageTime=.5;const p=this.project((this.lane-1)*2.1,1,0);this.particles.push({x:p.x,y:p.y,life:1});}
                    else if(!(((o.kind==='barrier'||o.kind==='hole') && this.jump>.7)||(o.kind==='arch'&&this.slide>0))) {if(typeof ChefJohnAudio!=='undefined') ChefJohnAudio.play('damage');this.state='gameover';this.crashTime=0;this.damageProgress=0;this.impactTime=.38;this.damageDirection=o.lane<this.lane?1:-1;this.jump=0;this.jumpVelocity=0;this.slide=0;o.hit=true;o.z=o.kind==='hole'?-.7:.55;this.hitObject=o;this.message='Opa! Vamos de novo?';this.messageTime=2;break;}
                }
            }
        }
        this.objects=this.objects.filter(o=>o.z>-7);
        if(this.state==='playing'&&this.distance-this.stageStart>=this.stageLength()) {
            // John keeps running into the destination and brakes to stop in front of it.
            this.deliveryBonus+=100;this.state='arriving';this.arrivalTime=0;
            this.objects=[];this.slide=0;this.turboTime=0;this.targetLane=1;
            this.arrivalDecel=this.speed*this.speed/(2*Math.max(1,this.stopAt()-this.distance));
            this.message=this.destinationKind()==='family'?'A família está esperando!':'Chegando na Pizzaria Chef John!';this.messageTime=2;
            if(typeof ChefJohnAudio!=='undefined')ChefJohnAudio.play('coin');
        }
        this.updateScore();
    }
    quad(points,color) {
        // Clip world polygons before projection: a building may straddle the camera.
        const near=-7.5, clipped=[];
        for(let i=0;i<points.length;i++) {
            const a=points[i], b=points[(i+1)%points.length];
            if(a[2]>=near) clipped.push(a);
            if((a[2]>=near)!==(b[2]>=near)) {
                const t=(near-a[2])/(b[2]-a[2]);
                clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,near]);
            }
        }
        if(clipped.length<3) return;
        JohnArt.poly(this.ctx,clipped.map(p=>{const q=this.project(...p);return[q.x,q.y];}),color);
    }
    block(x,z,width,height,depth,color,side,top) {
        this.quad([[x-width/2,0,z],[x+width/2,0,z],[x+width/2,height,z],[x-width/2,height,z]],color);
        const inner=x>0?x-width/2:x+width/2;
        this.quad([[inner,0,z],[inner,0,z+depth],[inner,height,z+depth],[inner,height,z]],side);
        this.quad([[x-width/2,height,z],[x+width/2,height,z],[x+width/2,height,z+depth],[x-width/2,height,z+depth]],top);
    }
    building(side,z,i) {
        const x=side*this.sceneryLayout.buildingCenter, height=4.5+(i%3), colors=['#efb05e','#e67d65','#63a9a0','#ead0a0'];
        this.block(x,z,this.sceneryLayout.buildingWidth,height,6,colors[i%4],'#ba8060','#f5d9a5');
        for(let j=0;j<2;j++)for(let k=0;k<2;k++){
            const wx=x-.9+j*1.65,wy=2.4+k*1.8;
            this.quad([[wx-.42,wy,z-.02],[wx+.42,wy,z-.02],[wx+.42,wy+1,z-.02],[wx-.42,wy+1,z-.02]],'#fff0cb');
            this.quad([[wx-.33,wy+.1,z-.04],[wx+.33,wy+.1,z-.04],[wx+.33,wy+.9,z-.04],[wx-.33,wy+.9,z-.04]],'#477b79');
        }
        this.quad([[x-1.3,0,z-.03],[x+1.3,0,z-.03],[x+1.3,1.8,z-.03],[x-1.3,1.8,z-.03]],'#376e67');
        for(let j=0;j<7;j++)this.quad([[x-1.65+j*.47,1.8,z-.9],[x-1.18+j*.47,1.8,z-.9],[x-1.18+j*.47,2.3,z],[x-1.65+j*.47,2.3,z]],j%2?'#fff2ce':'#cc4b36');
        // Windows on the street-facing wall stay visible after the front passes us.
        const inner=x-side*(this.sceneryLayout.buildingWidth/2+.001);
        for(let row=0;row<2;row++) for(let bay=0;bay<3;bay++) {
            const y=1.8+row*1.8, wz=z+.65+bay*1.8;
            this.quad([[inner,y,wz],[inner,y,wz+1],[inner,y+1,wz+1],[inner,y+1,wz]],'#f8e6bf');
            this.quad([[inner-side*.01,y+.12,wz+.12],[inner-side*.01,y+.12,wz+.88],[inner-side*.01,y+.88,wz+.88],[inner-side*.01,y+.88,wz+.12]],'#477b79');
        }
        if(z>-7.5&&!this.cover) {
            const p=this.project(x,2.5,z);
            this.ctx.save();this.ctx.globalAlpha*=Math.max(0,Math.min(1,(p.s-3)/3));
            this.ctx.fillStyle='#663d2d';this.ctx.font=`900 ${Math.max(7,p.s*.27)}px Nunito`;this.ctx.textAlign='center';this.ctx.fillText(i%3===0?'CHEFF JOHN':i%3===1?'GELATO':'PIZZERIA',p.x,p.y);this.ctx.restore();
        }
    }
    palm(side,z) {
        const c=this.ctx,x=side*this.sceneryLayout.palmX,p=this.project(x,0,z),top=this.project(x,4.3,z);
        // A planting bed anchors the trunk in the sidewalk, away from the storefronts.
        this.quad([[x-.34,.025,z-.3],[x+.34,.025,z-.3],[x+.34,.025,z+.3],[x-.34,.025,z+.3]],'#b0a17a');
        this.quad([[x-.25,.03,z-.22],[x+.25,.03,z-.22],[x+.25,.03,z+.22],[x-.25,.03,z+.22]],'#6b8252');
        c.strokeStyle='#a47947';c.lineWidth=p.s*.22;c.beginPath();c.moveTo(p.x,p.y);c.quadraticCurveTo(p.x+side*p.s*.3,top.y+p.s,top.x,top.y);c.stroke();
        // Tapered fronds instead of overlapping disks, with a curved silhouette.
        for(let i=0;i<7;i++) {
            const a=i*Math.PI*2/7, dx=Math.cos(a)*p.s*1.1, dy=Math.sin(a)*p.s*.38;
            c.fillStyle=i%2?'#59a555':'#327c49';c.beginPath();c.moveTo(top.x,top.y);
            c.quadraticCurveTo(top.x+dx*.6,top.y+dy-p.s*.48,top.x+dx,top.y+dy+p.s*.18);
            c.quadraticCurveTo(top.x+dx*.45,top.y+dy-p.s*.09,top.x,top.y);c.fill();
        }
        JohnArt.oval(c,top.x,top.y+p.s*.07,p.s*.12,p.s*.16,'#82603a');
    }
    rect(x1,x2,y1,y2,z,color) {this.quad([[x1,y1,z],[x2,y1,z],[x2,y2,z],[x1,y2,z]],color);}
    person(x,z,height,shirt,hair,wave) {
        const c=this.ctx,p=this.project(x,0,z),u=(p.y-this.project(x,height,z).y)/10;if(u<=0)return;
        JohnArt.oval(c,p.x,p.y,2.2*u,.55*u,'#33443d33');
        for(const side of [-1,1])JohnArt.box(c,p.x+side*.9*u-.6*u,p.y-4.3*u,1.2*u,4.3*u,'#4b5b66',.4*u);
        c.strokeStyle='#e6ad85';c.lineWidth=Math.max(.5,.9*u);c.lineCap='round';
        for(const side of [-1,1]) {
            // Both arms rise to celebrate; the right one always waves a little.
            const raise=side>0?Math.max(.35,wave):wave,hx=side*(2.3+raise*.9)*u+Math.sin(this.time*10+x)*raise*.7*u,hy=(-4.2-raise*6)*u;
            c.beginPath();c.moveTo(p.x+side*1.5*u,p.y-7*u);c.lineTo(p.x+hx,p.y+hy);c.stroke();
        }
        JohnArt.box(c,p.x-1.8*u,p.y-7.6*u,3.6*u,4*u,shirt,u);
        JohnArt.oval(c,p.x,p.y-8.9*u,1.35*u,1.45*u,'#e6ad85');JohnArt.oval(c,p.x,p.y-9.9*u,1.4*u,.7*u,hair);
        if(u>1.2){for(const side of [-1,1])JohnArt.oval(c,p.x+side*.5*u,p.y-9*u,.16*u,.2*u,'#333832');c.strokeStyle='#754931';c.lineWidth=Math.max(1,.18*u);c.beginPath();c.arc(p.x,p.y-8.7*u,.55*u,.15*Math.PI,.85*Math.PI);c.stroke();}
    }
    destination(z) {
        // The road ends at the delivery address: alternately a family home and the Chef John pizzeria.
        const c=this.ctx,family=this.destinationKind()==='family';
        const cheer=this.state==='delivery'?1:this.state==='arriving'?Math.min(1,this.arrivalTime/.3):0;
        const label=(text,y,size,color)=>{const p=this.project(0,y,z-.1);c.save();c.fillStyle=color;c.font=`900 ${Math.max(6,p.s*size)}px Nunito`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,p.x,p.y);c.restore();};
        if(family) {
            this.quad([[-11,.03,z-5],[11,.03,z-5],[11,.03,z],[-11,.03,z]],'#9fcf7f');
            this.quad([[-1.3,.04,z-5],[1.3,.04,z-5],[1.3,.04,z],[-1.3,.04,z]],'#e8d3a8');
            this.block(0,z,22,5.2,8,'#f6d7a7','#d8b27f','#e9c58f');
            this.quad([[-11.8,5.1,z-.05],[11.8,5.1,z-.05],[0,8.7,z-.05]],'#b9473a');
            this.quad([[-10.2,5.2,z-.06],[10.2,5.2,z-.06],[0,8.1,z-.06]],'#e06d4f');
            this.rect(-1.2,1.2,0,2.7,z-.04,'#8a4b2f');this.rect(-.95,.95,.15,2.5,z-.06,'#a8613c');
            for(const x of [-7.5,-4,4,7.5]){this.rect(x-1.1,x+1.1,1.6,3.5,z-.04,'#fff0cb');this.rect(x-.85,x+.85,1.8,3.3,z-.06,'#7cc0c4');}
            this.rect(-3.9,3.9,3.75,4.75,z-.08,'#fff4d0');label('OBRIGADO, JOHN!',4.25,.36,'#b33a2d');
            for(const [x,height,shirt,hair] of [[-3.5,1.9,'#5aa0c8','#3b2a20'],[-2.3,1.2,'#f2b33d','#6b4a2f'],[2.3,1.1,'#e0607a','#2b211c'],[3.5,1.8,'#6fae6a','#554033']])this.person(x,z-2.4,height,shirt,hair,cheer);
        } else {
            this.quad([[-11,.03,z-5],[11,.03,z-5],[11,.03,z],[-11,.03,z]],'#e7c28f');
            this.block(0,z,22,6.2,8,'#e8744f','#b85339','#f39a70');
            for(const side of [-1,1]){const a=Math.min(side*2.2,side*8.6),b=Math.max(side*2.2,side*8.6);this.rect(a,b,.8,3,z-.04,'#5b3322');this.rect(a+.3,b-.3,1,2.8,z-.06,'#ffcd73');}
            const oven=this.project(-5.4,1.6,z-.08);JohnArt.oval(c,oven.x,oven.y,oven.s*1.3,oven.s*.6,'#f28c3a');
            this.rect(-1.3,1.3,0,2.9,z-.04,'#5b3322');this.rect(-1.05,1.05,.15,2.7,z-.06,'#8a4b2f');
            for(let j=0;j<16;j++){const x=-9.6+j*1.2;this.quad([[x,3.2,z-1.3],[x+1.2,3.2,z-1.3],[x+1.2,3.9,z-.02],[x,3.9,z-.02]],j%2?'#fff2ce':'#cc4b36');}
            this.rect(-7,7,4.25,5.95,z-.05,'#fff3d9');this.rect(-6.75,6.75,4.4,5.8,z-.07,'#b33a2d');label('PIZZARIA CHEF JOHN',5.1,.5,'#fff3d9');
            const emblem=this.project(0,7,z-.1);JohnArt.food(c,'pizza',emblem.x,emblem.y,emblem.s*2.2,Math.PI/2);
            for(const [x,height,shirt,hair] of [[-3.4,1.85,'#fffdf0','#2c2723'],[2.4,1.2,'#f2b33d','#6b4a2f'],[3.6,1.8,'#5aa0c8','#3b2a20']])this.person(x,z-2.4,height,shirt,hair,cheer);
        }
        if(cheer>0) {
            c.save();c.textAlign='center';c.fillStyle=family?'#e2475c':'#ffc735';const alpha=c.globalAlpha;
            for(let i=0;i<7;i++){const t=(this.time*.8+i*.37)%1,p=this.project(-4.2+i*1.4,2.6+t*3,z-2.6);c.globalAlpha=alpha*cheer*(1-t);c.font=`900 ${Math.max(8,p.s*.6)}px sans-serif`;c.fillText(family?'❤':'★',p.x,p.y);}
            c.restore();
        }
    }
    obstacle(o) {
        const c=this.ctx,x=(o.lane-1)*2.1,z=o.z;
        if(o.kind==='coin'){if(o.checked)return;const p=this.project(x,1.05+Math.sin(this.time*4+z)*.1,z);JohnArt.coin(c,p.x,p.y,p.s*.3,this.time*2+z);return;}
        if(o.kind==='hole') {
            const rim=[[-.95,.1],[-.64,.04],[-.42,-.13],[-.05,.03],[.2,-.08],[.48,.12],[.87,.03],[.78,.4],[1,.66],[.78,.88],[.9,1.25],[.56,1.39],[.3,1.28],[0,1.54],[-.24,1.33],[-.64,1.45],[-.82,1.12],[-1,.93],[-.82,.58]];
            this.quad(rim.map(([dx,dz])=>[x+dx,.015,z+dz]),'#393d39');
            this.quad(rim.map(([dx,dz])=>[x+dx*.83,.025,z+.7+(dz-.7)*.82]),'#090f14');
            for(const i of [0,4,8,12,16]) {
                const [dx,dz]=rim[i];
                this.quad([[x+dx,.03,z+dz],[x+dx*1.24,.03,z+dz+.12],[x+dx*1.08,.03,z+dz+.04]],'#484c43');
            }
        } else if(o.kind==='van') {
            this.block(x,z,1.65,2.35,3.8,'#d94e35','#b8332d','#ff9260');
            this.quad([[x-.65,1.2,z-.03],[x+.65,1.2,z-.03],[x+.65,2,z-.03],[x-.65,2,z-.03]],'#9ad4d1');
            for(const side of [-1,1]){const p=this.project(x+side*.58,.25,z-.04);JohnArt.oval(c,p.x,p.y,p.s*.18,p.s*.26,'#344740');}
            const p=this.project(x,.65,z-.05);c.fillStyle='#fff3cb';c.font=`900 ${p.s*.22}px Nunito`;c.textAlign='center';c.fillText('PIZZA',p.x,p.y);
        } else if(o.kind==='barrier') {
            this.block(x,z,1.75,.85,.25,'#edb249','#b77c35','#ffe49a');
            for(const side of [-1,1])this.block(x+side*.63,z-.05,.12,1.05,.12,'#fff5cd','#c7af78','#fff8dd');
            const p=this.project(x,.42,z-.1);c.fillStyle='#925129';c.font=`900 ${p.s*.36}px sans-serif`;c.textAlign='center';c.fillText('↑ ↑',p.x,p.y);
        } else {
            for(const side of [-1,1])this.block(x+side*.8,z,.14,2.9,.15,'#53796e','#38655d','#a1c3a4');
            this.quad([[x-.9,1.15,z-.05],[x+.9,1.15,z-.05],[x+.9,2.8,z-.05],[x-.9,2.8,z-.05]],'#e96042');
            const p=this.project(x,1.8,z-.1);c.fillStyle='#fff4d0';c.font=`900 ${p.s*.45}px sans-serif`;c.textAlign='center';c.fillText('↓ ↓',p.x,p.y);
        }
    }
    render() {
        const c=this.ctx,w=this.w,h=this.h; c.save();
        const sky=c.createLinearGradient(0,0,0,h*.55);const weather=this.stage%4;const colors=[['#70c5ce','#f9ecc8'],['#ad658c','#ffc179'],['#101f43','#425985'],['#526b7c','#a6bec4']][weather];sky.addColorStop(0,colors[0]);sky.addColorStop(1,colors[1]);c.fillStyle=sky;c.fillRect(0,0,w,h);
        JohnArt.oval(c,w*.75,h*.15,35,35,weather===2?'#e6f0ff':'#fff0b3');
        for(let i=0;i<5;i++){const x=((i*w*.27+this.time*3)%(w+180))-90;JohnArt.oval(c,x,h*(.12+(i%2)*.06),65,12,'#ffffff80');}
        c.fillStyle='#66b7ae';c.fillRect(0,h*.29,w,h*.08);
        this.quad([[-100,0,-7],[100,0,-7],[100,0,150],[-100,0,150]],'#9dbf8c');
        const sidewalk=this.sceneryLayout.sidewalkEdge;
        this.quad([[-sidewalk,0,-7],[sidewalk,0,-7],[sidewalk,0,150],[-sidewalk,0,150]],'#edcc9e');
        this.quad([[-3.4,0,-7],[3.4,0,-7],[3.4,0,150],[-3.4,0,150]],'#738a80');
        for(let z=145;z>-6;z-=5){const zz=z-this.distance%5;if(zz<=-6)continue;for(const x of [-1.05,1.05])this.quad([[x-.025,.02,zz],[x+.025,.02,zz],[x+.025,.02,zz+2],[x-.025,.02,zz+2]],'#f5e7ba');}
        for(const side of [-1,1])this.quad([[side*3.4,.02,-7],[side*3.6,.02,-7],[side*3.6,.02,150],[side*3.4,.02,150]],'#fff1c8');
        const scene=[];
        // Absolute segment IDs keep appearance and position stable across each 12 m boundary.
        // Include the building's full depth behind us, then clip its remaining walls.
        const first=Math.max(0,Math.floor((this.distance-24)/12));
        const last=Math.ceil((this.distance+192)/12);
        const addScenery=(z,depth,draw)=> {
            if(z+depth<=-7.5 || z>=192) return;
            scene.push({z,draw:()=>{
                c.save();c.globalAlpha*=Math.min(1,(192-z)/36);draw();c.restore();
            }});
        };
        for(let i=first;i<=last;i++) {
            const z=i*12-this.distance;
            addScenery(z,6,()=>this.building(-1,z,i));
            addScenery(z+4,6,()=>this.building(1,z+4,i+1));
            addScenery(z-1,0,()=>this.palm(-1,z-1));
            addScenery(z+3,0,()=>this.palm(1,z+3));
        }
        const destination=this.stopAt()+9-this.distance;addScenery(destination,8,()=>this.destination(destination));
        for(const o of this.objects)if(o.z>-5&&(this.state==='playing'||o.hit))scene.push({z:o.hit&&o.kind==='hole'?.01:o.z,draw:()=>this.obstacle(o)});
        scene.push({z:0,draw:()=>{
            const characterX=(this.lane-1)*2.1,p=this.project(characterX,this.jump,0),ground=this.project(characterX,0,0);
            const fall=this.state==='gameover'||this.state==='ended'?this.damageProgress:0;
            const sinking=this.hitObject?.kind==='hole',sit=fall*fall*(3-2*fall);
            c.save();
            if(sinking){
                const t=this.crashTime,drop=Math.min(1,Math.max(0,(t-.18)/.9));
                const edge=this.project(characterX,0,this.hitObject.z+.12);
                // Mask only the foreground lip, leaving the body visible above the opening.
                c.beginPath();c.moveTo(0,0);c.lineTo(w,0);c.lineTo(w,edge.y);
                for(const [dx,dz] of [[.8,.03],[.48,.12],[.2,-.08],[-.05,.03],[-.42,-.13],[-.64,.04],[-.95,.1]]) {
                    const q=this.project(characterX+dx,0,this.hitObject.z+dz);c.lineTo(q.x,q.y);
                }
                c.lineTo(0,edge.y);c.closePath();c.clip();
                const stumble=Math.min(1,t/.18);
                c.translate(p.x+Math.sin(t*15)*p.s*.04*(1-drop),p.y+drop*drop*p.s*3.2);
                c.rotate(Math.sin(stumble*Math.PI)*.12*(1-drop));
                c.globalAlpha=1-drop*.35;
                JohnArt.john(c,0,0,p.s*.018*(1-drop*.12),true,t*22,false,0,Math.min(1,t/.25));
            }else{
                // Airborne pose replaces the run cycle; the ground shadow shrinks with height.
                const shrink=1/(1+this.jump*.45),air=fall>0?0:Math.min(1,this.jump/.45);
                const cheer=this.state==='delivery'?1:this.state==='arriving'?Math.min(1,this.arrivalTime/.3):0,running=fall===0&&air===0&&this.speed>.5;
                JohnArt.oval(c,ground.x,ground.y,ground.s*(.4+sit*.18)*shrink,ground.s*(.12+sit*.05)*shrink,'#334c4933');
                c.translate(p.x,p.y+sit*p.s*.65-Math.sin(fall*Math.PI)*p.s*.12-Math.abs(Math.sin(this.time*7))*p.s*.1*cheer);
                // Slide eases in and out of the carrinho pose over the .8 s slide window.
                const slideAmount=this.slide>0?Math.max(0,Math.min(1,(.8-this.slide)/.08,this.slide/.12)):0;
                JohnArt.john(c,0,0,p.s*.018,true,running&&slideAmount===0?this.time*14:0,slideAmount,sit,cheer,air);
                if(slideAmount>0&&this.state==='playing')for(let i=0;i<5;i++){
                    const t=(this.time*3.2+i*.2)%1,u=p.s*.018;
                    JohnArt.oval(c,(12+i*9-t*22)*u,(4+t*14)*u,(6+t*16)*u,(3+t*7)*u,`rgba(236,222,196,${.55*(1-t)*slideAmount})`);
                }
            }
            c.restore();
        }});

        if((this.state==='gameover'||this.state==='ended')&&this.impactTime>0&&this.hitObject?.kind!=='hole'){const characterX=(this.lane-1)*2.1;const p=this.project(characterX,1.25,.55);const t=1-this.impactTime/.38;const radius=p.s*(.2+t*.62);c.save();c.globalAlpha=1-t;c.strokeStyle='#ffd166';c.lineWidth=Math.max(2,p.s*.07);c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.stroke();c.strokeStyle='#fff4bb';c.lineWidth=Math.max(1,p.s*.035);for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(p.x+Math.cos(a)*radius*.8,p.y+Math.sin(a)*radius*.8);c.lineTo(p.x+Math.cos(a)*radius*1.45,p.y+Math.sin(a)*radius*1.45);c.stroke();}c.restore();}
        scene.sort((a,b)=>b.z-a.z).forEach(o=>o.draw());
        for(const p of this.particles){c.globalAlpha=p.life;c.fillStyle='#fff2a1';c.font='900 24px Nunito';c.textAlign='center';c.fillText('+5',p.x,p.y);}c.globalAlpha=1;
        // Menu covers show only the scene; the card below already names the game.
        if(!this.cover){c.font='900 13px Nunito';c.textAlign='left';c.fillStyle='#284f48';c.fillText(`ORLA DE PENHA  /  ${Math.floor(this.distance)} m`,18,82);
        c.textAlign='right';c.fillText(`${Math.floor(this.speed*3.6)} km/h`,w-18,82);}
        if(this.messageTime>0&&!this.cover){c.font='900 16px Nunito';c.textAlign='center';const y=h*.2;JohnArt.box(c,w/2-143,y-23,286,38,'#fff4dbe8',19);c.fillStyle='#925032';c.fillText(this.message,w/2,y+1);}
        if(weather===2||weather===3){c.fillStyle=weather===2?'rgba(12,23,63,.28)':'rgba(39,61,78,.15)';c.fillRect(0,90,w,h-90);}
        if(weather===2){for(let i=0;i<24;i++)JohnArt.oval(c,(i*73)%w,95+(i*31)%(h*.17),1.3,1.3,'#fff2c9');}
        if(weather===1){for(let i=0;i<18;i++){const x=(i*81+this.time*140)%(w+50)-25,y=120+(i*57+Math.sin(this.time+i)*15)%(h-170);JohnArt.oval(c,x,y,5,2,'#db934e');}}
        if(weather===3){c.strokeStyle='#d8edf077';c.lineWidth=1;for(let i=0;i<65;i++){const x=(i*67-this.time*85)%(w+60),y=(i*97+this.time*540)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+17);c.stroke();}}
        if(!this.cover){c.fillStyle='#fff3d9';c.fillRect(18,94,w-36,6);c.fillStyle='#e6633e';c.fillRect(18,94,(w-36)*Math.min(1,(this.distance-this.stageStart)/this.stageLength()),6);
        c.font='900 12px Nunito';c.textAlign='center';c.fillStyle=weather===2?'#fff3d9':'#284f48';c.fillText(`${this.stageTitle()} • ${this.stageName()} • ${Math.max(0,Math.ceil(this.stageLength()-this.distance+this.stageStart))} m`,w/2,117);}
        c.restore();
    }
    onTouchStart(x,y) {this.touch={x,y,used:false};}
    onTouchMove(x,y) {
        if(this.state!=='playing' || !this.touch || this.touch.used)return;const dx=x-this.touch.x,dy=y-this.touch.y;
        if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;
        if(Math.abs(dx)>Math.abs(dy))this.setLane(this.targetLane+Math.sign(dx));else if(dy<0)this.leap();else this.duck();this.touch.used=true;
    }
    onTouchEnd(x,y) {if(this.state==='playing'&&this.touch&&!this.touch.used){if(x<this.w*.38)this.setLane(this.targetLane-1);else if(x>this.w*.62)this.setLane(this.targetLane+1);else this.leap();}this.touch=null;}
    onKeyDown(key) {
        if(this.state!=='playing')return;
        if(['ArrowLeft','a','A'].includes(key))this.setLane(this.targetLane-1);
        if(['ArrowRight','d','D'].includes(key))this.setLane(this.targetLane+1);
        if(['ArrowUp','w','W',' '].includes(key))this.leap();
        if(['ArrowDown','s','S'].includes(key))this.duck();
        if(['Shift','Turbo','t','T'].includes(key))this.turbo();
    }
    destroy() {this.state='ended';this.onGameOver=null;}
}
