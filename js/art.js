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
        const g = c.createLinearGradient(-size,-size,size,size);
        g.addColorStop(0,'#fff6b8'); g.addColorStop(.25,'#ffd54f'); g.addColorStop(.65,'#f59e0b'); g.addColorStop(1,'#c87010');
        this.oval(c,0,0,size,size,g);
        c.strokeStyle='#fffae0'; c.lineWidth=Math.max(1, size*.08); c.beginPath(); c.arc(0,0,size*.78,0,Math.PI*2); c.stroke();
        c.strokeStyle='rgba(167,92,22,0.3)'; c.lineWidth=Math.max(.8, size*.04); c.beginPath(); c.arc(0,0,size*.72,0,Math.PI*2); c.stroke();
        c.font=`900 ${Math.max(6, size*.62)}px Nunito, sans-serif`; c.textAlign='center'; c.textBaseline='middle';
        c.fillStyle='rgba(255,248,225,0.6)'; c.fillText('SN',0,0);
        c.fillStyle='#8f4c0e'; c.fillText('SN',0,1.2);
        c.restore();
    },
    food(c, type, x, y, size, rotation = 0) {
        c.save(); c.translate(x,y); c.rotate(rotation); c.scale(size/50,size/50);
        c.shadowBlur = 0; c.shadowOffsetY = 0;
        if (type === 'golden' || type === 'special') { this.coin(c,0,0,24); }
        else if (type === 'pizza' || type === 'burnt') {
            const burnt=type==='burnt';
            if(burnt) {
                // Burrito Queimado: burrito carbonizado com papel alumínio chamuscado, brasas e fumaça
                c.shadowBlur=0; c.shadowOffsetY=0;
                this.poly(c,[[-14,-20],[14,-20],[15,20],[-15,20]],'#1c1a19');
                this.poly(c,[[-12,-18],[12,-18],[13,18],[-13,18]],'#2c2420');
                this.poly(c,[[-15,0],[15,0],[15,21],[-15,21]],'#545b61');
                this.poly(c,[[-14,2],[14,2],[14,19],[-14,19]],'#78848c');
                c.strokeStyle='#262b2f'; c.lineWidth=2;
                c.beginPath(); c.moveTo(-15,8); c.lineTo(-4,14); c.stroke();
                c.beginPath(); c.moveTo(4,10); c.lineTo(15,13); c.stroke();
                this.oval(c,0,-20,13,6,'#12100f');
                c.strokeStyle='#ff3d00'; c.lineWidth=1.6; c.lineCap='round';
                c.beginPath(); c.moveTo(-8,-19); c.lineTo(0,-22); c.lineTo(7,-18); c.stroke();
                for(const [x,y] of [[-5,-20],[2,-21],[6,-19],[0,-12],[-7,6]]) this.oval(c,x,y,2.2,2.2,'#ff6d00');
                for(const [x,y] of [[-5,-20],[2,-21],[6,-19]]) this.oval(c,x,y,1.1,1.1,'#ffea00');
                this.oval(c,-3,-28,6,5,'rgba(110,105,100,0.6)');
                this.oval(c,4,-35,8,6,'rgba(90,85,80,0.45)');
                this.oval(c,-1,-43,10,7,'rgba(70,65,60,0.3)');
            } else {
                this.poly(c,[[-23,-18],[23,0],[-23,18]],'#e9a64e');
                c.shadowBlur=0; c.shadowOffsetY=0;
                this.poly(c,[[-18,-13],[18,0],[-18,13]],'#e45430');
                this.poly(c,[[-16,-11],[16,0],[-16,11]],'#ffd46b');
                c.strokeStyle='#9c531e';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(-21,-16);c.lineTo(-21,16);c.stroke();
                for (const [x,y] of [[-8,-7],[-7,7],[2,0],[8,4]]) this.oval(c,x,y,3.5,3.5,'#c93928');
                for(const [x,y] of [[-12,0],[1,-5],[7,7]]) this.oval(c,x,y,2,3,'#4a8546');
            }
        } else if(type==='tomato') {
            const g=c.createRadialGradient(-8,-10,1,0,0,25); g.addColorStop(0,'#ff9c68');g.addColorStop(.5,'#f14d36');g.addColorStop(1,'#b82328');
            this.oval(c,0,2,23,21,g); c.shadowBlur=0;this.poly(c,[[0,-22],[4,-12],[14,-16],[7,-6],[0,-11],[-10,-6],[-5,-15],[-13,-18]],'#367546');
        } else if(type==='nacho' || type==='nachos') {
            // Nacho triangular crocante com queijo cheddar derretido e jalapeño
            c.shadowBlur=0;
            this.poly(c, [[-22, 18], [22, 18], [0, -22]], '#f4b036');
            this.poly(c, [[-20, 16], [20, 16], [0, -20]], '#fed368');
            this.poly(c, [[-15, 14], [15, 14], [10, 2], [5, 8], [0, -6], [-5, 4], [-12, 0]], '#ff9800');
            this.poly(c, [[-13, 12], [13, 12], [8, 3], [4, 7], [0, -4], [-4, 3], [-10, 1]], '#ffc107');
            this.oval(c, -3, 6, 6, 6, '#2e7d32');
            this.oval(c, -3, 6, 3.5, 3.5, '#a5d6a7');
            this.oval(c, -3, 6, 1.5, 1.5, '#1b5e20');
            this.oval(c, 7, 8, 3, 2.5, '#d32f2f');
            this.oval(c, -8, -1, 2.5, 2, '#d32f2f');
            this.oval(c, 5, -5, 2, 2, '#d32f2f');
        } else if(type==='tortilha' || type==='tortilla') {
            // Tortilha crocante estilo Doritos: triângulo de milho dourado com tempero nacho
            c.shadowBlur = 0;
            this.poly(c, [[-23, 19], [23, 19], [0, -23]], '#d47b18');
            const chipGrad = c.createLinearGradient(-15, -20, 15, 20);
            chipGrad.addColorStop(0, '#ffd54f');
            chipGrad.addColorStop(0.35, '#ffb300');
            chipGrad.addColorStop(0.75, '#f57c00');
            chipGrad.addColorStop(1, '#e65100');
            this.poly(c, [[-21, 17], [21, 17], [0, -21]], chipGrad);
            this.oval(c, -6, 6, 6, 3, 'rgba(255, 248, 225, 0.45)');
            this.oval(c, 5, -4, 5, 2.5, 'rgba(255, 248, 225, 0.45)');
            this.oval(c, 0, 12, 7, 2, 'rgba(216, 67, 21, 0.25)');
            for (const [px, py] of [[-12, 10], [-5, 0], [8, 8], [11, -6], [-3, -12], [2, 3], [-8, -4], [6, 13], [0, -5], [-14, 14], [13, 12]]) {
                this.oval(c, px, py, 1.2, 1.2, '#c62828');
                this.oval(c, px + 1.2, py - 0.8, 1, 1, '#ff6f00');
            }
            c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 1.2; c.lineCap = 'round';
            c.beginPath(); c.moveTo(-6, -10); c.lineTo(0, -20); c.lineTo(6, -10); c.stroke();
        } else if(type==='guacamole') {
            // Tigelinha Molcajete de pedra mexicana com Guacamole fresco e tortilha espetada
            c.shadowBlur = 0;
            c.save(); c.translate(8, -12); c.rotate(0.35);
            this.poly(c, [[-10, 10], [10, 10], [0, -12]], '#d47b18');
            this.poly(c, [[-9, 9], [9, 9], [0, -11]], '#f57c00');
            this.poly(c, [[-7, 8], [7, 8], [0, -9]], '#ffb300');
            for (const [px, py] of [[-3, 3], [2, 0], [-1, -4], [3, 5]]) this.oval(c, px, py, 1, 1, '#c62828');
            c.restore();
            this.oval(c, -14, 18, 4, 5, '#1e2428');
            this.oval(c, 14, 18, 4, 5, '#1e2428');
            this.oval(c, 0, 19, 4, 4, '#15191c');
            this.oval(c, 0, 10, 24, 14, '#263238');
            this.oval(c, 0, 10, 22, 12, '#37474f');
            this.oval(c, 0, 6, 23, 10, '#1e272c');
            const guacG = c.createRadialGradient(-3, 3, 2, 0, 4, 18);
            guacG.addColorStop(0, '#8bc34a');
            guacG.addColorStop(0.5, '#689f38');
            guacG.addColorStop(1, '#33691e');
            this.oval(c, 0, 5, 21, 8.5, guacG);
            this.oval(c, -8, 5, 5, 3.5, '#7cb342');
            this.oval(c, 6, 6, 4.5, 3, '#7cb342');
            this.oval(c, 0, 3, 6, 3, '#9ccc65');
            this.box(c, -10, 3, 3.5, 3.5, '#e53935', 1);
            this.box(c, 2, 6, 3.5, 3.5, '#d32f2f', 1);
            this.box(c, 9, 3, 3, 3, '#e53935', 1);
            this.box(c, -2, 2, 3, 2.5, '#f44336', 1);
            for (const [ox, oy] of [[-5, 6], [5, 4], [-1, 7], [8, 6]]) this.oval(c, ox, oy, 1.8, 1.4, '#ffffff');
            for (const [cx, cy] of [[-7, 7], [1, 4], [-3, 3], [6, 7], [3, 2]]) this.oval(c, cx, cy, 1.2, 1.2, '#1b5e20');
        } else if(type==='sushi') {
            // Sushi Nigiri de Salmão com arroz e alga nori
            c.shadowBlur=0;
            this.box(c, -20, 0, 40, 17, '#f5f5f0', 8);
            this.box(c, -18, 2, 36, 13, '#ffffff', 6);
            const salmon=c.createLinearGradient(-22, -14, 22, 0);
            salmon.addColorStop(0, '#ff7043'); salmon.addColorStop(.5, '#ff5722'); salmon.addColorStop(1, '#f4511e');
            this.box(c, -23, -12, 46, 16, salmon, 8);
            c.strokeStyle='rgba(255,255,255,0.7)'; c.lineWidth=2; c.lineCap='round';
            for(let i=-14; i<=14; i+=7) {
                c.beginPath(); c.moveTo(i-4, -10); c.lineTo(i+4, 2); c.stroke();
            }
            this.box(c, -4, -12, 8, 29, '#1a221d', 1);
            c.strokeStyle='rgba(255,255,255,0.85)'; c.lineWidth=1.5;
            c.beginPath(); c.moveTo(-16, -9); c.lineTo(-8, -9); c.stroke();
        } else if(type==='sashimi') {
            // Fatias nobres de Sashimi de Salmão com limão e shiso
            c.shadowBlur=0;
            this.poly(c, [[-20, 16], [-15, 0], [-22, -10], [-8, -6], [-5, -20], [6, -12], [14, -20], [14, -6], [22, 0], [18, 16]], '#388e3c');
            for(let i=0; i<3; i++) {
                const ox=(i-1)*7, oy=(i-1)*4;
                c.save(); c.translate(ox, oy);
                const g=c.createLinearGradient(-15, -12, 15, 12);
                g.addColorStop(0, '#ff8a65'); g.addColorStop(.6, '#ff5722'); g.addColorStop(1, '#d84315');
                this.poly(c, [[-16, 10], [-10, -12], [12, -12], [16, 10]], g);
                c.strokeStyle='rgba(255,255,255,0.75)'; c.lineWidth=1.8;
                c.beginPath(); c.moveTo(-10, -8); c.lineTo(-4, 8); c.stroke();
                c.beginPath(); c.moveTo(-3, -8); c.lineTo(3, 8); c.stroke();
                c.beginPath(); c.moveTo(4, -8); c.lineTo(10, 8); c.stroke();
                c.restore();
            }
            this.oval(c, 12, 10, 9, 9, '#fbc02d');
            this.oval(c, 12, 10, 7, 7, '#fff59d');
            this.oval(c, 12, 10, 2, 2, '#fbc02d');
        } else if(type==='burrito') {
            // Burrito suculento envolto em papel alumínio
            c.shadowBlur=0;
            this.box(c, -14, -20, 28, 40, '#f0cf9e', 8);
            this.oval(c, -6, -12, 3, 2, '#b87c3b');
            this.oval(c, 5, -8, 4, 2, '#a56c32');
            this.oval(c, -4, -4, 3, 2, '#b87c3b');
            const foil=c.createLinearGradient(-15, 0, 15, 20);
            foil.addColorStop(0, '#cfd8dc'); foil.addColorStop(.4, '#ffffff'); foil.addColorStop(1, '#90a4ae');
            this.box(c, -15, 0, 30, 21, foil, 4);
            c.strokeStyle='#78909c'; c.lineWidth=1;
            c.beginPath(); c.moveTo(-15, 6); c.lineTo(15, 8); c.stroke();
            c.beginPath(); c.moveTo(-15, 14); c.lineTo(15, 12); c.stroke();
            this.oval(c, 0, -20, 13, 6, '#4e342e');
            this.oval(c, -4, -21, 6, 4, '#4caf50');
            this.oval(c, 4, -20, 6, 4, '#ffca28');
            this.oval(c, 0, -22, 3, 2, '#e53935');
        } else if(type==='taco' || type==='quesadilla') {
            // Taco crocante recheado com carne, alface, tomate e queijo
            c.shadowBlur=0;
            // Casca de trás (dourada tostada)
            this.poly(c, [[-22, 6], [-19, -9], [19, -9], [22, 6], [16, 17], [-16, 17]], '#d48822');
            // Recheio de carne moída temperada
            this.poly(c, [[-17, 4], [-14, -7], [14, -7], [17, 4]], '#5a3825');
            this.oval(c, -7, -4, 3, 2, '#3e2417');
            this.oval(c, 1, -5, 3, 2, '#3e2417');
            this.oval(c, 8, -4, 3, 2, '#3e2417');
            // Alface fresca desfiada (tons de verde)
            this.poly(c, [[-17, -3], [-14, -13], [-10, -7], [-5, -14], [0, -6], [6, -13], [11, -7], [15, -12], [17, -2]], '#43a047');
            this.poly(c, [[-13, -4], [-10, -11], [-7, -6], [-3, -12], [2, -5], [8, -11], [12, -6]], '#66bb6a');
            // Tomates picados em cubinhos
            this.box(c, -11, -11, 4, 4, '#e53935', 1);
            this.box(c, 1, -12, 4, 4, '#e53935', 1);
            this.box(c, 9, -9, 4, 4, '#d32f2f', 1);
            this.box(c, -4, -6, 3, 3, '#e53935', 1);
            // Tiras de queijo cheddar ralado
            c.strokeStyle='#ffb300'; c.lineWidth=2; c.lineCap='round';
            c.beginPath(); c.moveTo(-11, -7); c.lineTo(-7, -2); c.stroke();
            c.beginPath(); c.moveTo(-2, -9); c.lineTo(2, -3); c.stroke();
            c.beginPath(); c.moveTo(5, -10); c.lineTo(8, -4); c.stroke();
            c.beginPath(); c.moveTo(12, -6); c.lineTo(15, -1); c.stroke();
            // Casca da frente (crocante dourada cobrindo a base)
            this.poly(c, [[-22, 5], [-18, 1], [18, 1], [22, 5], [16, 18], [-16, 18]], '#f6b83d');
            this.poly(c, [[-20, 6], [-16, 3], [16, 3], [20, 6], [14, 16], [-14, 16]], '#fed56a');
            // Pontinhos de milho tostado na casquinha
            this.oval(c, -9, 9, 2, 1.5, '#c97d1b');
            this.oval(c, 2, 11, 2.5, 1.5, '#c97d1b');
            this.oval(c, 11, 8, 2, 1.5, '#c97d1b');
            this.oval(c, -4, 14, 1.5, 1, '#c97d1b');
        } else if(type==='cheese') {
            this.poly(c,[[-23,14],[23,14],[23,-8],[-13,-22],[-23,-5]],'#df911f');
            this.poly(c,[[-23,-5],[23,-8],[-13,-22]],'#ffe58b'); this.poly(c,[[-23,-5],[23,-8],[23,12],[-23,16]],'#ffc74f');
            c.shadowBlur=0; for(let i=0;i<4;i++) this.oval(c,-14+i*10,i%2?6:0,3,4,'#e29b27');
        } else if(type==='plate') {
            this.oval(c,0,4,27,20,'#86a8a7');this.oval(c,0,0,27,20,'#f7fffb');this.oval(c,0,0,20,14,'#bedbd5');this.oval(c,0,1,17,11,'#edf7ef');
        } else if(type==='glass') {
            this.poly(c,[[-17,-24],[17,-24],[13,24],[-13,24]],'#a7d9dc');this.poly(c,[[-12,-16],[12,-16],[9,20],[-9,20]],'#eafafa');this.box(c,-10,-20,4,35,'#fff',2);
        } else if(type==='temaki' || type==='pineapple') {
            // Cone de Temaki com alga nori, arroz, salmão fresco, cream cheese e cebolinha
            c.shadowBlur=0;
            // Cone de nori de fundo
            this.poly(c, [[-16, -7], [16, -7], [2, 20], [-4, 20]], '#1a241e');
            this.poly(c, [[-14, -5], [14, -5], [1, 18], [-3, 18]], '#25352b');
            // Arroz na boca do cone
            this.oval(c, 0, -7, 15, 8, '#f5f5f0');
            this.oval(c, 0, -8, 13, 6, '#ffffff');
            this.oval(c, -7, -7, 2.5, 1.5, '#e0e0e0');
            this.oval(c, 7, -7, 2.5, 1.5, '#e0e0e0');
            // Pepino / Avocado
            this.poly(c, [[-12, -6], [-10, -17], [-6, -15], [-7, -5]], '#2e7d32');
            this.poly(c, [[-11, -6], [-9, -15], [-7, -14], [-8, -5]], '#4caf50');
            // Fatia nobre de salmão fresco
            this.poly(c, [[-7, -6], [-4, -22], [6, -20], [8, -5]], '#ff5722');
            this.poly(c, [[-5, -7], [-3, -20], [5, -18], [6, -6]], '#ff7043');
            c.strokeStyle='rgba(255,255,255,0.75)'; c.lineWidth=1.5;
            c.beginPath(); c.moveTo(-3, -16); c.lineTo(4, -14); c.stroke();
            c.beginPath(); c.moveTo(-4, -11); c.lineTo(5, -9); c.stroke();
            // Cream cheese
            this.oval(c, 7, -9, 4, 3, '#fffde7');
            // Dobra frontal da folha de alga nori envolvendo o cone
            this.poly(c, [[-16, -6], [12, -2], [2, 20], [-4, 20]], '#141d18');
            c.strokeStyle='#2d3d33'; c.lineWidth=1.5;
            c.beginPath(); c.moveTo(-16, -6); c.lineTo(2, 20); c.stroke();
            // Cebolinha picada e gergelim
            this.oval(c, -1, -10, 2, 2, '#43a047');
            this.oval(c, 3, -7, 2, 2, '#43a047');
            this.oval(c, 1, -12, 1, 1.5, '#fff9c4');
            this.oval(c, 5, -11, 1, 1.5, '#fff9c4');
        } else { this.coin(c,0,0,22); c.fillStyle='#fff'; c.font='bold 15px sans-serif';c.textAlign='center';c.fillText(type==='powerup_paddle'?'↔':'½',0,4); }
        c.restore();
    },
    john(c, x, y, scale=1, back=false, phase=0, slide=0, sit=0, falling=0, air=0) {
        c.save(); c.translate(x, y); c.scale(scale, scale);
        if (+slide > 0) { this.johnSlide(c, back, +slide); c.restore(); return; }
        this.oval(c, 0, 0, 26, 7, `rgba(30,35,32,${.25 * (1 - air)})`);
        const swing = Math.sin(phase) * 11 * (1 - sit) * (1 - air);
        falling = Math.max(falling, air);

        // Pernas e tênis verdes do Mascote Nacho Ninja
        c.strokeStyle = '#1e2328'; c.lineWidth = 9; c.lineCap = 'round';
        for (const side of [-1, 1]) {
            if (air > 0 && sit === 0) {
                const lift = air * (side < 0 ? 1 : .5);
                const kx = side * (10 + air * 6), ky = -20 + lift * 4;
                const fx = side * (8 + air * 3), fy = -6 - lift * 12;
                c.beginPath(); c.moveTo(side * 8, -26); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
                this.box(c, fx - 8, fy - 4, 16, 8, '#239b4b', 3);
                this.box(c, fx - 8, fy + 2, 16, 3, '#1c1f23', 1);
                this.box(c, fx - 5, fy - 5, 8, 3, '#ffffff', 1);
                continue;
            }
            if (sit > 0) {
                c.beginPath(); c.moveTo(side * 8, -26 + sit * 18);
                c.lineTo(side * 14, -14 - sit * 8); c.lineTo(side * 18, -4 - sit * 8); c.stroke();
                this.box(c, side * 18 - 8, -6 - sit * 8, 16, 8, '#239b4b', 3);
                this.box(c, side * 18 - 8, -1 - sit * 8, 16, 3, '#1c1f23', 1);
                this.box(c, side * 18 - 5, -7 - sit * 8, 8, 3, '#ffffff', 1);
            } else {
                const footY = -6 + side * swing;
                c.beginPath(); c.moveTo(side * 8, -26); c.lineTo(side * 8, footY); c.stroke();
                this.box(c, side * 8 - 8, footY - 4, 16, 8, '#239b4b', 3);
                this.box(c, side * 8 - 8, footY + 2, 16, 3, '#1c1f23', 1);
                this.box(c, side * 8 - 5, footY - 5, 8, 3, '#ffffff', 1);
            }
        }

        c.translate(0, sit * 18);

        // Braços de Nacho Ninja Dourado
        c.strokeStyle = '#f5b041'; c.lineWidth = 7; c.lineCap = 'round';
        for (const side of [-1, 1]) {
            const armSwing = Math.sin(phase) * 11 * (1 - sit) * (1 - air);
            const hx = side * (24 + sit * 8 + falling * 10);
            const hy = -44 - side * armSwing + sit * 12 - falling * 32;
            c.beginPath(); c.moveTo(side * 16, -60); c.lineTo(hx, hy); c.stroke();
            this.oval(c, hx, hy, 5, 5, '#e59828');

            if (side === -1) {
                // Nunchaku com Roll de Sushi pendurado
                c.save(); c.translate(hx, hy); c.rotate(-armSwing * 0.05 - 0.35);
                this.box(c, -2, -13, 4, 13, '#9c5221', 1);
                c.strokeStyle = '#d4af37'; c.lineWidth = 1.5;
                c.beginPath(); c.moveTo(0, -13); c.quadraticCurveTo(-6, -18, -10, -14); c.stroke();
                c.save(); c.translate(-10, -14); c.rotate(0.5 + armSwing * 0.08);
                this.box(c, -2, 0, 4, 12, '#9c5221', 1);
                // Maki de sushi no nunchaku
                this.oval(c, 0, -2, 5.5, 4.5, '#181b1e');
                this.oval(c, 0, -2, 4, 3, '#ffffff');
                this.oval(c, 0, -2, 2, 1.5, '#ff5722');
                c.restore();
                c.restore();
            }
        }

        this.johnTorso(c, back);
        c.restore();
    },
    johnSlide(c, back, k) {
        const lerp = (a, b) => a + (b - a) * k, hipY = lerp(-24, -8), a = lerp(0, .75);
        this.oval(c, lerp(0, 6), 0, lerp(26, 48), 7, 'rgba(30,35,32,.22)');
        c.strokeStyle = '#1e2328'; c.lineWidth = 9; c.lineCap = 'round';
        const lead = [lerp(10, 48), lerp(-4, -5)], knee = [lerp(-10, -24), lerp(-14, -12)], foot = [lerp(-10, -14), lerp(-4, -3)];
        c.beginPath(); c.moveTo(6, hipY); c.lineTo(...lead); c.stroke();
        c.beginPath(); c.moveTo(-6, hipY); c.lineTo(...knee); c.lineTo(...foot); c.stroke();
        this.box(c, lead[0] - 5, lead[1] - 6, 15, 8, '#239b4b', 3);
        this.box(c, lead[0] - 5, lead[1] + 1, 15, 3, '#1c1f23', 1);
        this.box(c, foot[0] - 7, foot[1] - 4, 15, 8, '#239b4b', 3);
        c.save(); c.translate(0, hipY); c.rotate(-a); c.translate(0, 24);
        c.strokeStyle = '#f5b041'; c.lineWidth = 7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-16, -60); c.lineTo(-28, -12); c.stroke();
        this.oval(c, -28, -12, 5, 5, '#e59828');
        this.johnTorso(c, back);
        c.restore();
    },
    johnTorso(c, back) {
        // === CORPO TRIANGULAR DO NACHO NINJA (Crocante e Dourado) ===
        c.beginPath();
        c.moveTo(-29, -26);
        c.quadraticCurveTo(0, -22, 29, -26);
        c.quadraticCurveTo(32, -29, 26, -37);
        c.lineTo(6, -96);
        c.quadraticCurveTo(0, -102, -6, -96);
        c.lineTo(-26, -37);
        c.quadraticCurveTo(-32, -29, -29, -26);
        c.closePath();

        const chip = c.createLinearGradient(0, -102, 0, -22);
        chip.addColorStop(0, '#fed368');
        chip.addColorStop(0.35, '#f5b838');
        chip.addColorStop(0.75, '#ea9c20');
        chip.addColorStop(1, '#db8410');
        c.fillStyle = chip;
        c.fill();
        c.strokeStyle = '#c67207'; c.lineWidth = 2; c.stroke();

        // Salpicos tostados autênticos de nacho
        const spots = [
            [-14, -42, 2.2, 1.4], [13, -44, 2.4, 1.6], [1, -52, 2, 1.2],
            [-8, -64, 2.2, 1.5], [10, -70, 1.8, 1.3], [-4, -80, 2, 1.2],
            [5, -86, 1.6, 1.1], [-18, -32, 2.3, 1.4], [16, -33, 2, 1.4]
        ];
        for (const [sx, sy, rx, ry] of spots) {
            this.oval(c, sx, sy, rx, ry, '#ba6806');
        }

        // === FAIXA OBI LARANJA (Artes Marciais) ===
        this.poly(c, [[-26, -33], [26, -33], [24, -43], [-24, -43]], '#ff6b22');
        this.poly(c, [[-25, -33], [25, -33], [25, -36], [-25, -36]], '#d84e09');

        if (back) {
            // === VISÃO DE COSTAS (RUNNER): Katana atravessada nas costas ===
            c.save();
            c.translate(0, -60);
            c.rotate(0.52);
            // Bainha da Katana (Saya) em laca preta
            this.box(c, -3.5, -34, 7, 72, '#181b1e', 2);
            // Ponteira (Kojiri) e bocal em dourado
            this.box(c, -3.5, 33, 7, 5, '#d4af37', 1);
            this.box(c, -4, -34, 8, 5, '#d4af37', 1);
            // Guarda redonda (Tsuba) dourada
            this.oval(c, 0, -35, 7.5, 3.5, '#f1c40f');
            // Empunhadura (Tsuka)
            this.box(c, -2.5, -53, 5, 18, '#181b1e', 1);
            this.box(c, -3, -54, 6, 3, '#d4af37', 1);
            // Trançado da empunhadura
            c.strokeStyle = '#e67e22'; c.lineWidth = 1.4;
            c.beginPath(); c.moveTo(-2, -50); c.lineTo(2, -40); c.stroke();
            c.beginPath(); c.moveTo(2, -50); c.lineTo(-2, -40); c.stroke();
            c.restore();

            // Nó da faixa segurando a bainha
            this.box(c, -5, -42, 10, 8, '#d84e09', 2);
        } else {
            // === VISÃO FRONTAL (CATCHER/COVERS): Rosto completo do Nacho Ninja ===
            // Nó frontal da faixa com pontas soltas
            this.box(c, -11, -43, 10, 10, '#d84e09', 2);
            this.poly(c, [[-11, -33], [-16, -18], [-10, -18], [-6, -33]], '#ff6b22');
            this.poly(c, [[-7, -33], [-5, -16], [0, -16], [-3, -33]], '#e85a14');

            // Katana embainhada na cintura
            c.save(); c.translate(14, -38); c.rotate(-0.15);
            this.box(c, -2, -2, 24, 5, '#181b1e', 2);
            this.box(c, 20, -2, 4, 5, '#d4af37', 1);
            this.oval(c, -2, 0.5, 3, 5, '#f1c40f');
            this.box(c, -14, -1.5, 12, 4, '#181b1e', 1);
            this.box(c, -15, -1.5, 2, 4, '#d4af37', 1);
            c.restore();

            // --- ROSTO NO PRÓPRIO TRIÂNGULO DE NACHO ---
            // Óculos escuros
            this.poly(c, [[-16, -82], [-2, -82], [-4, -73], [-14, -73]], '#15171a');
            this.poly(c, [[2, -82], [16, -82], [14, -73], [4, -73]], '#15171a');
            this.box(c, -3, -81, 6, 3, '#15171a', 1);
            // Reflexos nas lentes
            c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.5; c.lineCap = 'round';
            c.beginPath(); c.moveTo(-13, -80); c.lineTo(-9, -75); c.stroke();
            c.beginPath(); c.moveTo(5, -80); c.lineTo(9, -75); c.stroke();

            // Narizinho amarelo arredondado
            this.oval(c, 0, -71, 3.5, 3.5, '#ffd54f');
            this.oval(c, -1, -72, 1, 1, '#fffde7');

            // Bigode mexicano curvado grande
            c.fillStyle = '#15171a'; c.beginPath();
            c.moveTo(-22, -67);
            c.quadraticCurveTo(-11, -74, 0, -68);
            c.quadraticCurveTo(11, -74, 22, -67);
            c.quadraticCurveTo(24, -63, 19, -63);
            c.quadraticCurveTo(10, -66, 0, -64);
            c.quadraticCurveTo(-10, -66, -19, -63);
            c.quadraticCurveTo(-24, -63, -22, -67);
            c.fill();

            // Sorriso aberto com dentes brancos e língua vermelha
            this.poly(c, [[-8, -63], [8, -63], [6, -53], [-6, -53]], '#7a0e10');
            this.box(c, -6, -63, 12, 3.5, '#ffffff', 1);
            this.oval(c, 0, -54, 4, 2.5, '#ff4757');
        }

        // === SOMBRERO VERDE MEXICANO & HACHIMAKI (Sobre o ápice do Nacho) ===
        this.oval(c, 0, -96, 26, 6, 'rgba(0,0,0,0.2)');
        this.oval(c, 0, -98, 33, 9, '#1e8240');
        this.oval(c, 0, -99, 31, 7.5, '#27ae60');

        // Borda zigue-zague vermelha tradicional mexicana
        c.strokeStyle = '#d63031'; c.lineWidth = 1.8; c.lineCap = 'round';
        c.beginPath();
        for (let i = -26; i <= 26; i += 5.2) {
            c.lineTo(i, -99 + (Math.abs(i) % 10.4 ? 2.2 : -2.2));
        }
        c.stroke();

        // Cone do sombrero
        this.poly(c, [[-16, -99], [0, -132], [16, -99]], '#229954');
        this.poly(c, [[-7, -99], [0, -132], [7, -99]], '#2ecc71');

        // Hachimaki branco (faixa ninja)
        this.box(c, -11, -117, 22, 7, '#ffffff', 1);
        this.box(c, -11, -111, 22, 1.5, '#dcdde1', 0);

        if (back) {
            // Nó e fitas brancas esvoaçando atrás ao correr
            this.oval(c, 8, -113.5, 2.5, 2.5, '#f5f6fa');
            this.poly(c, [[8, -114], [22, -122], [18, -116], [24, -111], [8, -112]], '#ffffff');
            this.poly(c, [[8, -113], [19, -110], [15, -107], [22, -104], [8, -111]], '#e5e7eb');
        } else {
            // Sol nascente vermelho japonês na frente
            this.oval(c, 0, -113.5, 3.2, 3.2, '#d63031');
        }
    },
    kitchen(c, w, h, ninja=false, time=0, label=true) {
        if (ninja) {
            this.japaneseTemple(c, w, h, time, label);
        } else {
            this.mexicanFiesta(c, w, h, time, label);
        }
    },
    mexicanFiesta(c, w, h, time=0, label=true) {
        // Fundo em adobe acolhedor mexicano
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#e58237'); g.addColorStop(0.35, '#f3a456'); g.addColorStop(0.75, '#fad082'); g.addColorStop(1, '#ffebbe');
        c.fillStyle = g; c.fillRect(0, 0, w, h);

        const cx = w * 0.5;
        const archW = Math.min(w * 0.82, 380);
        const archTop = Math.max(90, h * 0.15);
        const archH = Math.min(h * 0.64, 460);

        // Grande arco arquitetônico colonial de cantina mexicana
        this.box(c, cx - archW/2 - 12, archTop - 10, archW + 24, archH + 20, '#e5934a', 32);
        const innerG = c.createLinearGradient(0, archTop, 0, archTop + archH);
        innerG.addColorStop(0, '#c75f28'); innerG.addColorStop(0.45, '#e0833a'); innerG.addColorStop(1, '#f8cb79');
        this.box(c, cx - archW/2, archTop, archW, archH, innerG, 26);
        c.strokeStyle = '#9c4316'; c.lineWidth = 2.5;
        c.beginPath(); c.roundRect(cx - archW/2, archTop, archW, archH, 26); c.stroke();

        // Sol mexicano decorativo estilizado no topo do arco
        const sunY = archTop + 40;
        this.oval(c, cx, sunY, 26, 26, '#ffe082');
        this.oval(c, cx, sunY, 21, 21, '#ffb300');
        c.strokeStyle = '#ff8f00'; c.lineWidth = 2.2;
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI / 6;
            c.beginPath();
            c.moveTo(cx + Math.cos(a) * 25, sunY + Math.sin(a) * 25);
            c.lineTo(cx + Math.cos(a) * 34, sunY + Math.sin(a) * 34);
            c.stroke();
        }

        // Título / Letreiro Festivo (Apenas Fiesta Sushinachos conforme solicitado)
        if (label) {
            c.fillStyle = '#6d2311';
            c.textAlign = 'center';
            c.font = `900 ${Math.min(23, w * 0.05)}px Nunito, sans-serif`;
            c.fillText('Fiesta Sushinachos', cx, archTop + 84);
        }

        // Guirlanda de Papel Picado Mexicano no topo superior (acima do HUD para não atrapalhar leitura)
        const flagColors = ['#e91e63', '#2e7d32', '#ff9800', '#00bcd4', '#fbc02d', '#9c27b0', '#e53935'];
        const vy = 12;
        c.strokeStyle = '#7c5432'; c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(0, vy);
        c.quadraticCurveTo(cx, vy + 16, w, vy);
        c.stroke();

        const flagCount = Math.max(7, Math.floor(w / 40));
        for (let i = 0; i < flagCount; i++) {
            const t = (i + 0.5) / flagCount;
            const fx = t * w;
            const fy = vy + Math.sin(t * Math.PI) * 16;
            const sway = Math.sin(time * 2.5 + i * 0.7) * 2;
            const col = flagColors[i % flagColors.length];
            const fw = 15, fh = 19;
            this.poly(c, [
                [fx - fw/2, fy],
                [fx + fw/2, fy],
                [fx + fw/2 + sway, fy + fh],
                [fx + sway, fy + fh - 4],
                [fx - fw/2 + sway, fy + fh]
            ], col);
            this.oval(c, fx + sway * 0.5, fy + fh * 0.45, 2.8, 2.8, 'rgba(255,255,255,0.45)');
        }

        // Músicos Mariachis em Festa (Estilo cartoon mexicano clássico)
        const my = archTop + archH - 35;
        const noteAnim = Math.sin(time * 3.5) * 4;

        // 1. Mariachi Central (Cantor com Guitarrón)
        this.box(c, cx - 18, my - 55, 36, 45, '#2d1e15', 6);
        this.poly(c, [[cx - 6, my - 53], [cx + 6, my - 53], [cx, my - 45]], '#ffffff');
        this.poly(c, [[cx - 8, my - 46], [cx + 8, my - 46], [cx, my - 42]], '#d32f2f');
        for (let by = my - 40; by <= my - 18; by += 8) this.oval(c, cx, by, 1.8, 1.8, '#ffca28');
        this.oval(c, cx, my - 62, 13, 11, '#e5a56d');
        // Bigode mexicano
        c.strokeStyle = '#1b1b1b'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(cx - 10, my - 58);
        c.quadraticCurveTo(cx - 5, my - 64, cx, my - 60);
        c.quadraticCurveTo(cx + 5, my - 64, cx + 10, my - 58);
        c.stroke();
        // Sombrero Mexicano Grande Central
        this.oval(c, cx, my - 72, 44, 13, '#c98528');
        this.oval(c, cx, my - 74, 42, 11, '#f5c366');
        this.poly(c, [[cx - 16, my - 72], [cx + 16, my - 72], [cx + 10, my - 95], [cx - 10, my - 95]], '#d99232');
        this.box(c, cx - 14, my - 77, 28, 5, '#c62828', 2);
        // Guitarrón de madeira
        this.oval(c, cx + 12, my - 34, 14, 18, '#a66028');
        this.oval(c, cx + 12, my - 34, 5, 5, '#3e1c07');
        this.box(c, cx - 18, my - 42, 28, 4, '#5d3111', 1);

        // 2. Mariachi da Esquerda (Trompetista)
        const lx = cx - 78;
        this.box(c, lx - 15, my - 50, 30, 42, '#1e2b24', 6);
        this.oval(c, lx, my - 57, 11, 10, '#e5a56d');
        c.strokeStyle = '#1b1b1b'; c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(lx - 8, my - 54); c.quadraticCurveTo(lx, my - 58, lx + 8, my - 54); c.stroke();
        // Sombrero Verde Esmeralda
        this.oval(c, lx, my - 67, 36, 11, '#1b5e20');
        this.oval(c, lx, my - 69, 34, 9, '#2e7d32');
        this.poly(c, [[lx - 12, my - 67], [lx + 12, my - 67], [lx + 8, my - 88], [lx - 8, my - 88]], '#388e3c');
        this.box(c, lx - 11, my - 72, 22, 4, '#ffffff', 1);
        // Trompete Dourado
        c.strokeStyle = '#ffc107'; c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(lx + 4, my - 56); c.lineTo(lx - 22, my - 78); c.stroke();
        this.oval(c, lx - 24, my - 80, 6, 8, '#ffb300');
        // Notas musicais
        c.fillStyle = '#e65100'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
        c.fillText('♪', lx - 34, my - 88 + noteAnim);
        c.fillText('♫', lx - 18, my - 102 - noteAnim);

        // 3. Mariachi da Direita (Violinista)
        const rx = cx + 78;
        this.box(c, rx - 15, my - 50, 30, 42, '#3e1e24', 6);
        this.oval(c, rx, my - 57, 11, 10, '#e5a56d');
        c.strokeStyle = '#1b1b1b'; c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(rx - 8, my - 54); c.quadraticCurveTo(rx, my - 58, rx + 8, my - 54); c.stroke();
        // Sombrero Vermelho
        this.oval(c, rx, my - 67, 36, 11, '#b71c1c');
        this.oval(c, rx, my - 69, 34, 9, '#d32f2f');
        this.poly(c, [[rx - 12, my - 67], [rx + 12, my - 67], [rx + 8, my - 88], [rx - 8, my - 88]], '#e53935');
        this.box(c, rx - 11, my - 72, 22, 4, '#ffd54f', 1);
        // Violino
        this.oval(c, rx - 8, my - 42, 9, 13, '#8d4d1e');
        c.strokeStyle = '#d7ccc8'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(rx - 18, my - 32); c.lineTo(rx + 6, my - 52); c.stroke();
        c.fillStyle = '#e65100'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
        c.fillText('♩', rx + 24, my - 90 - noteAnim);

        // Cactos decorativos autênticos nos cantos inferiores (com vasos de terracota, nervuras e espinhos afiados)
        for (const [xPos, side] of [[44, -1], [w - 44, 1]]) {
            const potY = h - 36;
            // Vaso de barro terracota mexicano
            this.poly(c, [
                [xPos - 14, potY],
                [xPos + 14, potY],
                [xPos + 10, potY + 22],
                [xPos - 10, potY + 22]
            ], '#a84318');
            this.poly(c, [
                [xPos - 12, potY + 2],
                [xPos + 12, potY + 2],
                [xPos + 9, potY + 20],
                [xPos - 9, potY + 20]
            ], '#c75a28');
            // Borda saliente do vaso
            this.box(c, xPos - 16, potY - 4, 32, 7, '#8f3410', 3);
            this.box(c, xPos - 15, potY - 3, 30, 5, '#d96832', 2);
            // Faixa decorativa asteca/mexicana no vaso
            this.box(c, xPos - 11, potY + 8, 22, 4, '#00bcd4', 1);
            this.box(c, xPos - 10, potY + 9, 20, 2, '#ffeb3b', 0);
            // Terra escura
            this.oval(c, xPos, potY - 2, 13, 3, '#3e2723');

            // Tronco principal do cacto saguaro
            const cacBase = potY - 2;
            const cacH = 68;
            this.box(c, xPos - 10, cacBase - cacH, 20, cacH, '#2e7d32', 10);
            // Nervuras verticais de relevo e luz
            this.box(c, xPos - 8, cacBase - cacH + 2, 5, cacH - 4, '#43a047', 2);
            this.box(c, xPos - 2, cacBase - cacH + 2, 4, cacH - 4, '#388e3c', 2);
            this.box(c, xPos + 3, cacBase - cacH + 2, 5, cacH - 4, '#1b5e20', 2);

            // Braço inferior (voltado para dentro/fora alternando)
            const b1Side = side;
            const b1Y = cacBase - 26;
            this.box(c, xPos, b1Y - 4, b1Side * 16, 9, '#2e7d32', 4);
            this.box(c, xPos + b1Side * 10, b1Y - 24, 8, 26, '#2e7d32', 4);
            this.box(c, xPos + b1Side * 11, b1Y - 23, 3, 24, '#43a047', 1);

            // Braço superior (lado oposto)
            const b2Side = -side;
            const b2Y = cacBase - 42;
            this.box(c, xPos, b2Y - 4, b2Side * 14, 8, '#2e7d32', 4);
            this.box(c, xPos + b2Side * 8, b2Y - 22, 8, 24, '#2e7d32', 4);
            this.box(c, xPos + b2Side * 9, b2Y - 21, 3, 22, '#43a047', 1);

            // Espinhos pontiagudos visíveis (traços agudos em leque / espinhos claros)
            c.strokeStyle = '#fff9c4'; c.lineWidth = 1.6; c.lineCap = 'round';
            for (let sy = cacBase - cacH + 8; sy <= cacBase - 8; sy += 12) {
                // Espinho lateral esquerdo
                c.beginPath(); c.moveTo(xPos - 10, sy); c.lineTo(xPos - 15, sy - 3); c.stroke();
                c.beginPath(); c.moveTo(xPos - 10, sy); c.lineTo(xPos - 14, sy + 3); c.stroke();
                // Espinho lateral direito
                c.beginPath(); c.moveTo(xPos + 10, sy); c.lineTo(xPos + 15, sy - 3); c.stroke();
                c.beginPath(); c.moveTo(xPos + 10, sy); c.lineTo(xPos + 14, sy + 3); c.stroke();
                // Pontinhos de espinho na nervura frontal
                this.oval(c, xPos - 2, sy, 1.4, 1.4, '#fff9c4');
                this.oval(c, xPos + 4, sy + 6, 1.4, 1.4, '#fff9c4');
            }
            // Espinhos nos braços laterais
            c.beginPath(); c.moveTo(xPos + b1Side * 18, b1Y - 14); c.lineTo(xPos + b1Side * 22, b1Y - 17); c.stroke();
            c.beginPath(); c.moveTo(xPos + b2Side * 16, b2Y - 12); c.lineTo(xPos + b2Side * 20, b2Y - 15); c.stroke();

            // Flores mexicanas desabrochando
            this.oval(c, xPos - 3, cacBase - cacH - 4, 4, 6, '#e91e63');
            this.oval(c, xPos + 3, cacBase - cacH - 4, 4, 6, '#e91e63');
            this.oval(c, xPos, cacBase - cacH - 6, 5, 6, '#ff4081');
            this.oval(c, xPos, cacBase - cacH - 4, 3, 3, '#ffeb3b');

            const topArmX = xPos + b2Side * 12, topArmY = b2Y - 24;
            this.oval(c, topArmX, topArmY - 3, 3.5, 4.5, '#ff4081');
            this.oval(c, topArmX, topArmY - 2, 2, 2, '#ffeb3b');
        }

        // Piso do salão / tablado
        const floorY = h - 35;
        c.fillStyle = '#a65329'; c.fillRect(0, floorY - 9, w, 9);
        c.fillStyle = '#7a3617'; c.fillRect(0, floorY - 2, w, 3);
        c.fillStyle = '#bf6a3b'; c.fillRect(0, floorY + 1, w, 34);
        c.fillStyle = '#d98555'; c.fillRect(0, floorY + 2, w, 3);
        c.strokeStyle = '#853e19'; c.lineWidth = 1;
        for (let x = 0; x < w; x += 85) {
            c.beginPath(); c.moveTo(x, floorY + 5); c.lineTo(x, h); c.stroke();
        }
    },
    _templeCanvas: null,
    _templeW: 0,
    _templeH: 0,
    _templeLabel: null,
    _renderStaticTemple(c, w, h, label) {
        // Céu suave em crepúsculo oriental (tons suaves, baixo contraste e ambiente harmonioso)
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#243746');
        g.addColorStop(0.32, '#314a58');
        g.addColorStop(0.68, '#41606d');
        g.addColorStop(1, '#4f727c');
        c.fillStyle = g; c.fillRect(0, 0, w, h);

        const cx = w * 0.5;

        // Lua serena com brilho suave e translúcido (sem pontos brancos ofuscantes)
        const moonR = Math.min(54, w * 0.14);
        const moonY = h * 0.25;
        this.oval(c, cx, moonY, moonR + 16, moonR + 16, 'rgba(255, 245, 215, 0.06)');
        this.oval(c, cx, moonY, moonR + 6, moonR + 6, 'rgba(255, 245, 215, 0.12)');
        this.oval(c, cx, moonY, moonR, moonR, 'rgba(255, 248, 225, 0.45)');
        this.oval(c, cx, moonY, moonR - 4, moonR - 4, 'rgba(255, 252, 235, 0.58)');

        // Silhueta suave do Monte Fuji na névoa do crepúsculo
        const fujiBaseY = h * 0.64;
        this.poly(c, [[cx - 190, fujiBaseY], [cx - 52, h * 0.36], [cx + 52, h * 0.36], [cx + 190, fujiBaseY]], 'rgba(32, 48, 58, 0.65)');
        // Neve no cume integrada na atmosfera
        this.poly(c, [
            [cx - 60, h * 0.40],
            [cx - 52, h * 0.36],
            [cx + 52, h * 0.36],
            [cx + 60, h * 0.40],
            [cx + 32, h * 0.44],
            [cx, h * 0.42],
            [cx - 32, h * 0.44]
        ], 'rgba(225, 242, 248, 0.38)');

        // Templo Pagode tradicional com tonalidades harmônicas e acolhedoras
        const pagodaW = Math.min(w * 0.64, 300);
        const pagodaY = h * 0.38;
        // Telhado superior curvo
        this.poly(c, [[cx - pagodaW/2 - 22, pagodaY + 16], [cx - pagodaW/2 + 8, pagodaY], [cx + pagodaW/2 - 8, pagodaY], [cx + pagodaW/2 + 22, pagodaY + 16]], 'rgba(35, 48, 58, 0.75)');
        this.box(c, cx - pagodaW/2 + 14, pagodaY + 15, pagodaW - 28, 6, 'rgba(155, 58, 48, 0.75)', 2);
        // Paredes com janelas Shoji de brilho morno suave
        this.box(c, cx - pagodaW/2 + 24, pagodaY + 21, pagodaW - 48, 46, 'rgba(135, 48, 40, 0.7)', 2);
        for (let wx = cx - pagodaW/2 + 36; wx <= cx + pagodaW/2 - 50; wx += 28) {
            this.box(c, wx, pagodaY + 27, 18, 32, 'rgba(255, 235, 170, 0.38)', 2);
            c.strokeStyle = 'rgba(70, 35, 28, 0.4)'; c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(wx + 9, pagodaY + 27); c.lineTo(wx + 9, pagodaY + 59); c.stroke();
            c.beginPath(); c.moveTo(wx, pagodaY + 43); c.lineTo(wx + 18, pagodaY + 43); c.stroke();
        }

        // O Grande Portal Torii Japonês em tom vermelho laca tradicional suave (baixo contraste com o fundo)
        const toriiW = Math.min(w * 0.74, 350);
        const toriiTop = Math.max(105, h * 0.18);
        const toriiBottom = h * 0.78;
        const pxL = cx - toriiW/2, pxR = cx + toriiW/2;

        // Bases de pedra (Daiishi)
        this.box(c, pxL - 14, toriiBottom - 38, 28, 38, '#2d3840', 4);
        this.box(c, pxR - 14, toriiBottom - 38, 28, 38, '#2d3840', 4);

        // Pilares cilíndricos em vermelho vermilion suave
        this.box(c, pxL - 10, toriiTop + 24, 20, toriiBottom - toriiTop - 58, '#8a3830', 3);
        this.box(c, pxL - 6, toriiTop + 24, 5, toriiBottom - toriiTop - 58, '#a0483e', 2);
        this.box(c, pxR - 10, toriiTop + 24, 20, toriiBottom - toriiTop - 58, '#8a3830', 3);
        this.box(c, pxR - 6, toriiTop + 24, 5, toriiBottom - toriiTop - 58, '#a0483e', 2);

        // Trave transversal inferior (Nuki)
        this.box(c, cx - toriiW/2 - 26, toriiTop + 54, toriiW + 52, 18, '#7a2f27', 3);
        this.box(c, cx - toriiW/2 - 24, toriiTop + 56, toriiW + 48, 4, '#9e443a', 1);

        // Viga mestra superior com beiral curvo (Kasagi & Shimagi)
        this.poly(c, [[cx - toriiW/2 - 48, toriiTop - 2], [cx + toriiW/2 + 48, toriiTop - 2], [cx + toriiW/2 + 36, toriiTop + 22], [cx - toriiW/2 - 36, toriiTop + 22]], '#2d3840');
        this.box(c, cx - toriiW/2 - 36, toriiTop + 20, toriiW + 72, 18, '#8a3830', 3);
        this.box(c, cx - toriiW/2 - 34, toriiTop + 22, toriiW + 68, 4, '#a0483e', 1);

        // Placa Votiva Central (Gakuzuka) com ideograma japonês dourado suave
        this.box(c, cx - 14, toriiTop + 20, 28, 34, '#2d3840', 3);
        this.box(c, cx - 11, toriiTop + 23, 22, 28, '#7a2720', 2);
        c.fillStyle = 'rgba(255, 235, 170, 0.85)';
        c.font = '900 16px "Hiragino Kaku Gothic Pro", "Noto Sans JP", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('壽', cx, toriiTop + 37);

        // Estandartes Nobori Tradicionais com textura natural de tecido
        const banLY = toriiTop + 95;
        // Estandarte Esquerdo (Linho Cru Suave): 寿司 (Sushi)
        this.box(c, pxL + 18, banLY, 24, 76, 'rgba(240, 238, 230, 0.7)', 3);
        c.fillStyle = 'rgba(40, 48, 54, 0.85)';
        c.font = '900 18px "Hiragino Kaku Gothic Pro", "Noto Sans JP", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        c.fillText('寿', pxL + 30, banLY + 28);
        c.fillText('司', pxL + 30, banLY + 60);

        // Estandarte Direito (Tecido Vermilion Queimado): 忍者 (Ninja)
        this.box(c, pxR - 42, banLY, 24, 76, 'rgba(138, 48, 40, 0.72)', 3);
        c.fillStyle = 'rgba(255, 250, 245, 0.9)';
        c.font = '900 18px "Hiragino Kaku Gothic Pro", "Noto Sans JP", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        c.fillText('忍', pxR - 30, banLY + 28);
        c.fillText('者', pxR - 30, banLY + 60);

        // Lanternas de Pedra Tradicionais (Tōrō) nas laterais em tom de granito
        for (const [tx, side] of [[pxL - 26, -1], [pxR + 26, 1]]) {
            const ty = toriiBottom - 18;
            this.box(c, tx - 12, ty, 24, 18, '#354752', 2);
            this.box(c, tx - 7, ty - 22, 14, 22, '#415562', 1);
            this.box(c, tx - 11, ty - 32, 22, 10, '#2d3b45', 2);
            this.box(c, tx - 7, ty - 30, 14, 7, 'rgba(255, 230, 150, 0.4)', 1);
            this.poly(c, [[tx - 16, ty - 32], [tx, ty - 42], [tx + 16, ty - 32]], '#354752');
            this.oval(c, tx, ty - 43, 3, 3, 'rgba(255, 230, 150, 0.4)');
        }

        // Pátio de pedras do templo na base (harmônico com o gradiente do céu)
        const fy = h * 0.78;
        this.poly(c, [[0, fy], [w, fy], [w, h], [0, h]], '#344854');
        c.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for (let i = -8; i < 9; i++) {
            c.beginPath(); c.moveTo(w/2 + i * 40, fy); c.lineTo(w/2 + i * 180, h); c.stroke();
        }
        for (let i = 1; i < 5; i++) {
            let y = fy + (h - fy) * (i / 5) ** 1.6;
            c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
        }

        // Título limpo (apenas quando label === true, em tom suave)
        if (label) {
            c.fillStyle = 'rgba(255, 240, 190, 0.85)';
            c.font = `900 ${Math.min(22, w * 0.045)}px Nunito, sans-serif`;
            c.textAlign = 'center';
            c.textBaseline = 'alphabetic';
            c.fillText('SUSHI NINJA • 寿司', cx, Math.max(120, toriiTop - 14));
        }
    },
    japaneseTemple(c, w, h, time=0, label=true) {
        // Cache do fundo estático do templo (evita renderizar dezenas de vetores complexos por quadro)
        const canUseOffscreen = typeof document !== 'undefined' && document.createElement;
        if (canUseOffscreen) {
            if (!this._templeCanvas || this._templeW !== w || this._templeH !== h || this._templeLabel !== label) {
                this._templeCanvas = document.createElement('canvas');
                this._templeCanvas.width = w;
                this._templeCanvas.height = h;
                this._templeW = w;
                this._templeH = h;
                this._templeLabel = label;
                const tc = this._templeCanvas.getContext('2d');
                this._renderStaticTemple(tc, w, h, label);
            }
            c.drawImage(this._templeCanvas, 0, 0);
        } else {
            this._renderStaticTemple(c, w, h, label);
        }

        const cx = w * 0.5;
        const toriiW = Math.min(w * 0.74, 350);
        const toriiTop = Math.max(105, h * 0.18);

        // Estrelas discretas e suaves no céu
        const stars = [[0.12, 0.08], [0.28, 0.14], [0.45, 0.06], [0.65, 0.12], [0.82, 0.09], [0.91, 0.18], [0.22, 0.22], [0.75, 0.24]];
        for (const [sx, sy] of stars) {
            const tw = Math.sin(time * 3 + sx * 10) * 0.3 + 0.5;
            this.oval(c, sx * w, sy * h, 1.2 * tw, 1.2 * tw, 'rgba(255, 250, 230, 0.35)');
        }

        // Lanternas Japonesas de Papel Vermelho (Chōchin) com luz âmbar difusa
        const sway = Math.sin(time * 2.8) * 3;
        for (const lx of [cx - toriiW * 0.28, cx + toriiW * 0.28]) {
            const ly = toriiTop + 85;
            c.strokeStyle = '#2d3436'; c.lineWidth = 1.3;
            c.beginPath(); c.moveTo(lx, toriiTop + 72); c.lineTo(lx + sway, ly - 16); c.stroke();
            this.oval(c, lx + sway, ly, 30, 30, 'rgba(255, 220, 140, 0.12)');
            this.oval(c, lx + sway, ly, 16, 22, '#993d32');
            this.oval(c, lx + sway, ly, 11, 16, 'rgba(255, 230, 160, 0.45)');
            c.strokeStyle = 'rgba(45, 25, 20, 0.45)'; c.lineWidth = 1.1;
            c.beginPath(); c.moveTo(lx + sway - 12, ly - 6); c.lineTo(lx + sway + 12, ly - 6); c.stroke();
            c.beginPath(); c.moveTo(lx + sway - 12, ly + 6); c.lineTo(lx + sway + 12, ly + 6); c.stroke();
            c.beginPath(); c.moveTo(lx + sway, ly + 22); c.lineTo(lx + sway, ly + 32); c.stroke();
        }

        // Pétalas de Sakura flutuando suavemente
        for (let i = 0; i < 8; i++) {
            const petX = (cx - 150 + i * 50 + Math.sin(time * 2 + i) * 20 + w) % w;
            const petY = (h * 0.2 + i * 60 + time * 32) % (h * 0.85);
            this.oval(c, petX, petY, 3.8, 2.4, 'rgba(255, 185, 195, 0.65)');
            this.oval(c, petX, petY, 2, 1.4, 'rgba(255, 140, 155, 0.7)');
        }
    }
};
