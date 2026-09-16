/* Original Canvas artwork shared by the three games. No external assets required. */
const JohnArt = {
    oval(c, x, y, rx, ry, color) {
        c.fillStyle = color; c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, Math.PI * 2); c.fill();
    },
    box(c, x, y, w, h, color, r = 6) {
        c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
    },
    poly(c, points, color) {
        c.fillStyle = color; c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fill();
    },
    coin(c, x, y, size, time = 0) {
        c.save(); c.translate(x,y); c.scale(.72 + Math.abs(Math.cos(time)) * .28, 1);
        this.oval(c, 2, 3, size, size, '#b76a1e');
        const g = c.createLinearGradient(-size,-size,size,size); g.addColorStop(0,'#fff2a0'); g.addColorStop(.45,'#ffc735'); g.addColorStop(1,'#e99814');
        this.oval(c,0,0,size,size,g); c.strokeStyle='#fff0a1'; c.lineWidth=size*.09; c.beginPath(); c.arc(0,0,size*.77,0,Math.PI*2); c.stroke();
        c.fillStyle='#a75c16'; c.font=`900 ${size*.95}px Nunito, sans-serif`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('SN',0,1); c.restore();
    },
    food(c, type, x, y, size, rotation = 0) {
        c.save(); c.translate(x,y); c.rotate(rotation); c.scale(size/50,size/50);
        c.shadowColor='rgba(73,37,18,.24)'; c.shadowBlur=12; c.shadowOffsetY=7;
        if (type === 'golden' || type === 'special') { this.coin(c,0,0,24); }
        else if (type === 'pizza' || type === 'burnt') {
            // A single slice keeps the pizza's footprint close to the other foods.
            const burnt=type==='burnt';
            this.poly(c,[[-23,-18],[23,0],[-23,18]],burnt?'#574033':'#e9a64e');
            c.shadowBlur=0; c.shadowOffsetY=0;
            this.poly(c,[[-18,-13],[18,0],[-18,13]],burnt?'#332b28':'#e45430');
            this.poly(c,[[-16,-11],[16,0],[-16,11]],burnt?'#534437':'#ffd46b');
            c.strokeStyle=burnt?'#201e1b':'#9c531e';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(-21,-16);c.lineTo(-21,16);c.stroke();
            for (const [x,y] of [[-8,-7],[-7,7],[2,0],[8,4]]) this.oval(c,x,y,3.5,3.5,burnt?'#201e1b':'#c93928');
            if(!burnt) for(const [x,y] of [[-12,0],[1,-5],[7,7]]) this.oval(c,x,y,2,3,'#4a8546');
        } else if(type==='tomato') {
            const g=c.createRadialGradient(-8,-10,1,0,0,25); g.addColorStop(0,'#ff9c68');g.addColorStop(.5,'#f14d36');g.addColorStop(1,'#b82328');
            this.oval(c,0,2,23,21,g); c.shadowBlur=0;this.poly(c,[[0,-22],[4,-12],[14,-16],[7,-6],[0,-11],[-10,-6],[-5,-15],[-13,-18]],'#367546');
        } else if(type==='cheese') {
            this.poly(c,[[-23,14],[23,14],[23,-8],[-13,-22],[-23,-5]],'#df911f');
            this.poly(c,[[-23,-5],[23,-8],[-13,-22]],'#ffe58b'); this.poly(c,[[-23,-5],[23,-8],[23,12],[-23,16]],'#ffc74f');
            c.shadowBlur=0; for(let i=0;i<4;i++) this.oval(c,-14+i*10,i%2?6:0,3,4,'#e29b27');
        } else if(type==='plate') {
            this.oval(c,0,4,27,20,'#86a8a7');this.oval(c,0,0,27,20,'#f7fffb');this.oval(c,0,0,20,14,'#bedbd5');this.oval(c,0,1,17,11,'#edf7ef');
        } else if(type==='glass') {
            this.poly(c,[[-17,-24],[17,-24],[13,24],[-13,24]],'#a7d9dc');this.poly(c,[[-12,-16],[12,-16],[9,20],[-9,20]],'#eafafa');this.box(c,-10,-20,4,35,'#fff',2);
        } else if(type==='pineapple') {
            this.oval(c,0,7,16,21,'#eab748');c.shadowBlur=0;this.poly(c,[[0,-9],[-16,-30],[-5,-24],[0,-36],[5,-23],[18,-29],[8,-8]],'#408450');
            c.strokeStyle='#b7772c';for(let i=-10;i<15;i+=8){c.beginPath();c.moveTo(i,-6);c.lineTo(i+10,21);c.stroke();}
        } else { this.coin(c,0,0,22); c.fillStyle='#fff'; c.font='bold 15px sans-serif';c.textAlign='center';c.fillText(type==='powerup_paddle'?'↔':'½',0,4); }
        c.restore();
    },
    john(c, x, y, scale=1, back=false, phase=0, slide=0, sit=0, falling=0, air=0) {
        c.save();c.translate(x,y);c.scale(scale,scale);
        if(+slide>0){this.johnSlide(c,back,+slide);c.restore();return;}
        this.oval(c,0,0,29,8,`rgba(41,46,39,${.2*(1-air)})`);
        const swing=Math.sin(phase)*9*(1-sit)*(1-air);
        falling=Math.max(falling,air);
        for(const side of [-1,1]) {
            if(air>0&&sit===0){
                // Airborne tuck below the coat hem: knees spread, the leading foot pulled higher.
                const lift=air*(side<0?1:.5),kx=side*(12+air*9),ky=-22+lift*3,fx=side*(8+air*3),fy=-5-lift*11;
                c.strokeStyle='#53646e';c.lineWidth=12;c.lineCap='round';c.beginPath();c.moveTo(side*10,-30);c.lineTo(kx,ky);c.lineTo(fx,fy);c.stroke();
                this.box(c,fx-9,fy-3,18,9,'#fff7e6',4);continue;
            }
            if(sit>0){c.strokeStyle='#53646e';c.lineWidth=13;c.lineCap='round';c.beginPath();c.moveTo(side*10,-30+sit*25);c.lineTo(side*(10+sit*16),-16-sit*12);c.lineTo(side*(10+sit*24),-4-sit*12);c.stroke();}
            else this.box(c,side*10-6,-30,12,27+side*swing,'#53646e',5);
            this.box(c,side*(10+sit*24)-8,-6+side*swing-sit*12,18,9,'#fff7e6',4);
        }
        c.translate(0,sit*25);
        c.strokeStyle='#eee5d3';c.lineWidth=12;c.lineCap='round';
        for(const side of [-1,1]) {c.beginPath();c.moveTo(side*17,-61);c.lineTo(side*(28+sit*13+falling*16),-40+side*swing+sit*17-falling*43);c.stroke();this.oval(c,side*(28+sit*13+falling*16),-36+side*swing+sit*17-falling*43,6,7,'#e6ad85');}
        this.johnTorso(c,back);
        c.restore();
    },
    johnSlide(c,back,k) {
        // Carrinho: John leans sideways, lead leg stretched along the asphalt, one hand braking on the ground.
        const lerp=(a,b)=>a+(b-a)*k,hipY=lerp(-30,-10),a=lerp(0,.75);
        // Converts a pose point in standing coordinates into the leaning torso frame below.
        const local=(wx,wy)=>{const dy=wy-hipY;return[wx*Math.cos(a)-dy*Math.sin(a),wx*Math.sin(a)+dy*Math.cos(a)-30];};
        this.oval(c,lerp(0,4),0,lerp(29,52),8,'rgba(41,46,39,.2)');
        c.strokeStyle='#53646e';c.lineWidth=12;c.lineCap='round';
        const lead=[lerp(10,54),lerp(-4,-5)],knee=[lerp(-10,-30),lerp(-16,-14)],foot=[lerp(-10,-18),lerp(-4,-3)];
        c.beginPath();c.moveTo(8,hipY);c.lineTo(...lead);c.stroke();
        c.beginPath();c.moveTo(-8,hipY);c.lineTo(...knee);c.lineTo(...foot);c.stroke();
        this.box(c,lead[0]-4,lead[1]-7,12,14,'#fff7e6',4);this.box(c,foot[0]-9,foot[1]-4,18,9,'#fff7e6',4);
        c.save();c.translate(0,hipY);c.rotate(-a);c.translate(0,30);
        c.strokeStyle='#eee5d3';c.lineWidth=12;
        for(const [side,wx,wy] of [[-1,lerp(-28,-60),lerp(-40,-4)],[1,lerp(28,24),lerp(-40,-72)]]) {
            const [hx,hy]=local(wx,wy);c.beginPath();c.moveTo(side*17,-61);c.lineTo(hx,hy);c.stroke();this.oval(c,hx,hy,6,7,'#e6ad85');
        }
        this.johnTorso(c,back);c.restore();
    },
    johnTorso(c,back) {
        const coat=c.createLinearGradient(-22,0,22,0);coat.addColorStop(0,'#c5d5d0');coat.addColorStop(.45,'#fffdf0');coat.addColorStop(1,'#e5eada');
        this.box(c,-21,-74,42,49,coat,12);
        if(back) {
            // Black harness holding the delivery box: shoulder straps over the coat and a waist strap under the arms.
            c.lineCap='round';
            for(const side of [-1,1]) {
                // Straps end at the coat's shoulder line and stay inside its silhouette, clear of the hands.
                c.strokeStyle='#15181b';c.lineWidth=4;
                c.beginPath();c.moveTo(side*11,-60);c.quadraticCurveTo(side*11.5,-70,side*14,-72.5);c.stroke();
                c.beginPath();c.moveTo(side*16,-38);c.lineTo(side*19,-40);c.stroke();
                c.strokeStyle='#3d444b';c.lineWidth=1;
                c.beginPath();c.moveTo(side*10,-61);c.quadraticCurveTo(side*10.5,-69.5,side*12.5,-71.5);c.stroke();
                this.box(c,side*11-2.5,-67,5,3.5,'#8d959c',1);
            }
            this.box(c,-19,-62,38,33,'#101214',7);this.box(c,-17,-63,34,28,'#292d31',6);
            c.fillStyle='#fff2c9';c.font='900 10px Nunito';c.textAlign='center';c.fillText('SN',0,-48);c.font='13px sans-serif';c.fillText('🍣',0,-34);
        } else { for(let i=0;i<3;i++) {this.oval(c,-6,-59+i*10,1.7,1.7,'#344643');this.oval(c,6,-59+i*10,1.7,1.7,'#344643');} }
        this.box(c,-7,-85,14,15,'#d59974',5);
        this.oval(c,-20,-92,4,7,'#e6ad85');this.oval(c,20,-92,4,7,'#e6ad85');
        const skin=c.createLinearGradient(-19,-110,18,-80);skin.addColorStop(0,'#f7c9a2');skin.addColorStop(1,'#dfa17d');
        this.box(c,-20,-115,40,41,skin,17);
        // Close-cropped silhouette with a soft skin fade at the temples and nape.
        c.save();c.beginPath();c.roundRect(-20,-115,40,41,17);c.clip();
        const fade=c.createLinearGradient(0,-112,0,back?-80:-94);
        fade.addColorStop(0,'#39352f');fade.addColorStop(.35,'#51483f');
        fade.addColorStop(.68,'rgba(87,73,60,.55)');fade.addColorStop(1,'rgba(87,73,60,0)');
        if(back)this.box(c,-20,-115,40,36,fade,0);
        else for(const side of [-1,1])this.box(c,side<0?-20:15,-114,5,22,fade,0);
        this.box(c,-19,-115,38,back?12:9,'#39352f',8);
        for(let i=0;i<25;i++) {
            const hx=-16+(i*13%33),hy=-112+(i*7%8);
            this.oval(c,hx,hy,.65,.45,i%2?'#615548':'#292823');
        }
        c.restore();
        if(!back) {
            for(const side of [-1,1]) {this.oval(c,side*8,-96,3,3.5,'#fff');this.oval(c,side*8,-96,1.7,2.5,'#333832');}
            c.strokeStyle='#754931';c.lineWidth=1.8;c.beginPath();c.arc(1,-90,8,.15*Math.PI,.82*Math.PI);c.stroke();
            this.oval(c,0,-88,4,.9,'#735644');
        }
    },
    kitchen(c,w,h,ninja=false,time=0,label=true) {
        const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,ninja?'#217c77':'#edc99b');g.addColorStop(1,ninja?'#96b9a0':'#fff0cf');c.fillStyle=g;c.fillRect(0,0,w,h);
        c.strokeStyle=ninja?'rgba(238,255,224,.12)':'rgba(138,91,48,.12)';c.lineWidth=1;
        for(let y=100;y<h*.75;y+=44){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();for(let x=(y%88?0:36);x<w;x+=72){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+44);c.stroke();}}
        const cx=w*.5, ovenY=h*.47, ow=Math.min(250,w*.6);
        this.box(c,cx-ow/2-12,ovenY-ow*.55,ow+24,ow*.7,ninja?'#aac1a0':'#cc7950',ow*.3);
        this.box(c,cx-ow/2,ovenY-ow*.5,ow,ow*.63,'#f3bb7b',ow*.3);
        this.box(c,cx-ow*.38,ovenY-ow*.36,ow*.76,ow*.43,'#683f2f',ow*.2);
        const fire=c.createRadialGradient(cx,ovenY,2,cx,ovenY,ow*.42);fire.addColorStop(0,'#fff0a1');fire.addColorStop(.4,'#ffba52');fire.addColorStop(1,'#9b492d');
        this.box(c,cx-ow*.33,ovenY-ow*.23,ow*.66,ow*.29,fire,20);
        for(let i=0;i<5;i++) this.oval(c,cx+(i-2)*ow*.1,ovenY-8,ow*.04,13+Math.sin(time*4+i)*5,'#ffcd65');
        this.box(c,cx-ow*.59,ovenY+ow*.12,ow*1.18,12,'#82624b',3);
        if(label){c.fillStyle=ninja?'#ebebca':'#a34b34';c.textAlign='center';c.font=`900 ${Math.min(25,w*.05)}px Nunito`;c.fillText(ninja?'KATANA & NACHO • FATIE & BRILHE':'SUSHINACHOS • SABOR A TODO VAPOR',cx,Math.max(124,ovenY-ow*.66));}
        for(const x of [w*.12,w*.88]) {c.fillStyle='#675a41';c.fillRect(x,0,2,105);this.poly(c,[[x-25,121],[x-12,99],[x+12,99],[x+25,121]],'#df6743');this.oval(c,x,123,22,4,'#ffdf95');}
        if(ninja) {
            const fy=h*.78;this.poly(c,[[0,fy],[w,fy],[w,h],[0,h]],'#b48558');
            c.strokeStyle='rgba(94,55,33,.16)';for(let i=-8;i<9;i++){c.beginPath();c.moveTo(w/2+i*40,fy);c.lineTo(w/2+i*180,h);c.stroke();}for(let i=1;i<5;i++){let y=fy+(h-fy)*(i/5)**1.6;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
        } else {
            // Front-facing stage: the floor/contact line coincides with John's feet.
            const floorY=h-35;
            c.fillStyle='#bb8d60';c.fillRect(0,floorY-9,w,9);
            c.fillStyle='#875d3c';c.fillRect(0,floorY-2,w,3);
            c.fillStyle='#c99b68';c.fillRect(0,floorY+1,w,34);
            c.fillStyle='#e9bd86';c.fillRect(0,floorY+2,w,3);
            c.strokeStyle='#b18151';c.lineWidth=1;
            for(let x=0;x<w;x+=90){c.beginPath();c.moveTo(x,floorY+5);c.lineTo(x,h);c.stroke();}
        }
        if(ninja){this.box(c,w*.08,h*.19,w*.84,h*.64,'rgba(76,62,38,.12)',36);}
    }
};
