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
            const burnt=type==='burnt';
            if(burnt) {
                // Nacho Queimado: triângulo de nacho carbonizado com fumaça e brasas incandescentes
                c.shadowBlur=0; c.shadowOffsetY=0;
                this.poly(c,[[-22,18],[22,18],[0,-22]],'#1c1a19');
                this.poly(c,[[-19,15],[19,15],[0,-19]],'#2e2724');
                this.poly(c,[[-14,12],[14,12],[0,-14]],'#3d3430');
                c.strokeStyle='#ff3d00'; c.lineWidth=1.8; c.lineCap='round';
                c.beginPath(); c.moveTo(-10,10); c.lineTo(-2,2); c.lineTo(4,6); c.stroke();
                c.beginPath(); c.moveTo(2,-6); c.lineTo(8,-2); c.stroke();
                for (const [x,y] of [[-7,8],[2,3],[5,-1],[-3,-4]]) this.oval(c,x,y,2.5,2.5,'#ff6d00');
                for (const [x,y] of [[-7,8],[2,3],[5,-1]]) this.oval(c,x,y,1.2,1.2,'#ffea00');
                this.oval(c,-4,-26,5,4,'rgba(120,115,110,0.6)');
                this.oval(c,3,-32,7,5,'rgba(100,95,90,0.45)');
                this.oval(c,-1,-39,9,6,'rgba(80,75,70,0.3)');
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
        } else if(type==='quesadilla') {
            // Quesadilla dourada grelhada com queijo derretido
            c.shadowBlur=0;
            this.poly(c, [[-22, 16], [22, 16], [20, -10], [0, -20], [-20, -10]], '#f4c37d');
            this.poly(c, [[-20, 14], [20, 14], [18, -8], [0, -18], [-18, -8]], '#fed89b');
            c.strokeStyle='#9c5b1c'; c.lineWidth=2.2; c.lineCap='round';
            c.beginPath(); c.moveTo(-14, 12); c.lineTo(-8, -12); c.stroke();
            c.beginPath(); c.moveTo(-4, 12); c.lineTo(2, -14); c.stroke();
            c.beginPath(); c.moveTo(6, 12); c.lineTo(12, -10); c.stroke();
            this.poly(c, [[-22, 14], [22, 14], [18, 20], [12, 17], [6, 22], [0, 18], [-6, 21], [-14, 17], [-20, 20]], '#ffb300');
            this.poly(c, [[-20, 14], [20, 14], [16, 18], [11, 16], [6, 20], [0, 16], [-6, 19], [-13, 16], [-18, 18]], '#ffe082');
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
