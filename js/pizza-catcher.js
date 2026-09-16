class PizzaCatcherGame {
    constructor(canvas, logicalWidth, logicalHeight, onGameOver) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.w = logicalWidth;
        this.h = logicalHeight;
        this.onGameOver = onGameOver;
        this.score = 0;
        
        this.targetX = this.w / 2;
        
        this.state = 'start'; // start, playing, gameover
        
        this.initGame();
    }
    
    initGame() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.time = 0;
        
        this.chef = {
            x: this.w / 2,
            y: this.h - 80,
            width: 100,
            height: 80,
            paddleWidth: 80,
            normalPaddleWidth: 80,
            bigPaddleWidth: 160
        };
        this.targetX = this.chef.x;
        
        this.items = [];
        this.particles = [];
        this.popups = [];
        
        this.spawnTimer = 0;
        this.spawnInterval = 1.3;
        this.baseSpeed = 120;
        
        this.powerups = {
            bigPaddle: 0, // timer
            slowMo: 0    // timer
        };
        
        this.keys = { left: false, right: false };
    }
    
    start() {
        this.state = 'playing';
        this.initGame();
    }
    
    resize(w, h) {
        this.w = w;
        this.h = h;
        this.chef.y = this.h - 80;
    }
    
    spawnItem() {
        // Determine what to spawn based on weights and level
        const possibleItems = [
            { type: 'nacho', emoji: '🧀', points: 10, weight: 40, bad: false, mustCatch: true },
            { type: 'sushi', emoji: '🍣', points: 12, weight: 20, bad: false, mustCatch: false },
            { type: 'sashimi', emoji: '🐟', points: 14, weight: 14, bad: false, mustCatch: false },
            { type: 'burrito', emoji: '🌯', points: 10, weight: 14, bad: false, mustCatch: false },
            { type: 'quesadilla', emoji: '🌮', points: 10, weight: 14, bad: false, mustCatch: false },
            { type: 'pineapple', emoji: '🍍', points: 12, weight: 8, bad: false, mustCatch: false },
            { type: 'burnt', emoji: '🔥', points: -20, weight: 10 + this.level, bad: true, mustCatch: false },
            { type: 'plate', emoji: '🍽️', points: -10, weight: 8 + this.level, bad: true, mustCatch: false }
        ];
        
        if (this.level >= 3) {
            possibleItems.push({ type: 'golden', emoji: '⭐', points: 50, weight: 3, bad: false, mustCatch: false, glow: true });
        }
        
        if (this.level >= 2) {
            possibleItems.push({ type: 'powerup_paddle', emoji: '📏', points: 0, weight: 3, bad: false, mustCatch: false, isPowerup: true });
        }
        
        if (this.level >= 4) {
            possibleItems.push({ type: 'powerup_slow', emoji: '🐌', points: 0, weight: 2, bad: false, mustCatch: false, isPowerup: true });
        }
        
        let totalWeight = possibleItems.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        
        let selected = possibleItems[0];
        for (let item of possibleItems) {
            if (random < item.weight) {
                selected = item;
                break;
            }
            random -= item.weight;
        }
        
        let x = Math.random() * (this.w - 60) + 30;
        let speed = this.baseSpeed + (this.level - 1) * 20;
        speed *= (Math.random() * 0.4 + 0.8); // slight variation
        
        this.items.push({
            ...selected,
            x: x,
            y: -30,
            speed: speed,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 4
        });
    }
    
    update(dt) {
        if (this.state !== 'playing') return;
        
        this.time += dt;
        
        // Level up every 15 seconds
        let newLevel = Math.floor(this.time / 15) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.spawnInterval = Math.max(0.45, 1.3 - (this.level - 1) * 0.12);
        }
        
        // Powerups
        if (this.powerups.bigPaddle > 0) {
            this.powerups.bigPaddle -= dt;
            this.chef.paddleWidth = this.chef.bigPaddleWidth;
        } else {
            this.chef.paddleWidth = this.chef.normalPaddleWidth;
        }
        
        let slowMultiplier = 1.0;
        if (this.powerups.slowMo > 0) {
            this.powerups.slowMo -= dt;
            slowMultiplier = 0.5;
        }
        
        // Spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnItem();
            this.spawnTimer = this.spawnInterval;
        }
        
        // Movement Input
        let moveSpeed = 400 * dt;
        if (this.keys.left) this.targetX -= moveSpeed;
        if (this.keys.right) this.targetX += moveSpeed;
        
        this.targetX = Math.max(this.chef.paddleWidth/2, Math.min(this.w - this.chef.paddleWidth/2, this.targetX));
        
        // Interpolate chef position
        this.chef.x += (this.targetX - this.chef.x) * 15 * dt;
        
        // Update Items
        for (let i = this.items.length - 1; i >= 0; i--) {
            let item = this.items[i];
            item.y += item.speed * dt * slowMultiplier;
            item.rotation += item.rotSpeed * dt * slowMultiplier;
            
            // Collision detection
            let itemRadius = 15;
            let paddleY = this.chef.y;
            let paddleLeft = this.chef.x - this.chef.paddleWidth / 2;
            let paddleRight = this.chef.x + this.chef.paddleWidth / 2;
            
            if (item.y + itemRadius > paddleY - 10 && item.y - itemRadius < paddleY + 10) {
                if (item.x + itemRadius > paddleLeft && item.x - itemRadius < paddleRight) {
                    this.catchItem(item);
                    this.items.splice(i, 1);
                    if (this.state !== 'playing') return;
                    continue;
                }
            }
            
            // Missed item
            if (item.y + itemRadius >= this.h - 35) {
                if (item.mustCatch) {
                    this.loseLife();
                    this.addPopup("Errou!", item.x, this.h - 40, "#FF0000");
                }
                this.items.splice(i, 1);
            }
        }
        
        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update Popups
        for (let i = this.popups.length - 1; i >= 0; i--) {
            let p = this.popups[i];
            p.y -= 30 * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.popups.splice(i, 1);
            }
        }
    }
    
    catchItem(item) {
        if (item.isPowerup) {
            if (item.type === 'powerup_paddle') {
                this.powerups.bigPaddle = 8;
                this.addPopup("Pá Grande!", item.x, item.y, "#00FFFF");
            } else if (item.type === 'powerup_slow') {
                this.powerups.slowMo = 5;
                this.addPopup("Câmera Lenta!", item.x, item.y, "#00FFFF");
            }
            this.spawnParticles(item.x, item.y, "#00FFFF");
        } else {
            this.score = Math.max(0, this.score + item.points);
            if (item.points > 0) {
                if (typeof ChefJohnAudio !== 'undefined') ChefJohnAudio.play('coin');
                this.addPopup(`+${item.points}`, item.x, item.y, item.glow ? "#FFD700" : "#00FF00");
                this.spawnParticles(item.x, item.y, "#00FF00");
            } else {
                this.addPopup(`${item.points}`, item.x, item.y, "#FF0000");
                this.spawnParticles(item.x, item.y, "#FF0000");
            }
            
            if (item.bad) {
                this.loseLife();
            }
        }
    }
    
    loseLife() {
        if (this.state !== 'playing') return;
        this.lives--;
        if (typeof ChefJohnAudio !== 'undefined') ChefJohnAudio.play('damage');
        if (this.lives <= 0) {
            this.state = 'gameover';
            if (this.onGameOver) this.onGameOver(this.score);
        }
    }
    
    addPopup(text, x, y, color) {
        this.popups.push({ text, x, y, color, life: 1.0 });
    }
    
    spawnParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 100 + 50;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.random() * 0.3 + 0.2,
                maxLife: 0.5,
                color: color
            });
        }
    }
    
    render() {
        JohnArt.kitchen(this.ctx, this.w, this.h, false, this.time);
        // Falling food and collection effects belong in front of John and his paddle.
        this.drawChef(this.chef.x, this.chef.y);
        
        // Draw items
        for (let item of this.items) {
            this.ctx.save();
            this.ctx.translate(item.x, item.y);
            this.ctx.rotate(item.rotation);
            
            if (item.glow) {
                this.ctx.shadowColor = "#FFD700";
                this.ctx.shadowBlur = 15;
            }
            
            this.ctx.font = "30px 'Fredoka One'";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            JohnArt.food(this.ctx, item.type, 0, 0, 43);
            
            this.ctx.restore();
        }
        
        // Draw particles
        for (let p of this.particles) {
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw popups
        for (let p of this.popups) {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.font = "bold 20px 'Fredoka One'";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(p.text, p.x, p.y);
            
            this.ctx.strokeStyle = "#000";
            this.ctx.lineWidth = 1;
            this.ctx.strokeText(p.text, p.x, p.y);
            this.ctx.globalAlpha = 1.0;
        }
        
        this.ctx.fillStyle = '#714e35';
        this.ctx.font = "900 16px Nunito";
        this.ctx.textAlign = 'left';
        this.ctx.fillText('FORNADA ' + this.level, 16, 83);
        this.ctx.textAlign = 'right';
        this.ctx.fillText('❤️'.repeat(Math.max(0,this.lives)), this.w-16, 83);
        // Active Powerups
        let py = 112;
        this.ctx.font = "16px 'Nunito'";
        this.ctx.textAlign = "left";
        if (this.powerups.bigPaddle > 0) {
            this.ctx.fillStyle = "#00FFFF";
            this.ctx.fillText(`Pá Grande: ${Math.ceil(this.powerups.bigPaddle)}s`, 10, py);
            py += 20;
        }
        if (this.powerups.slowMo > 0) {
            this.ctx.fillStyle = "#00FFFF";
            this.ctx.fillText(`Câmera Lenta: ${Math.ceil(this.powerups.slowMo)}s`, 10, py);
        }
        
    }
    
    drawChef(x, y) {
        const c=this.ctx;
        JohnArt.john(c,x,y+45,1.1,false,Math.sin(this.time)*.2);
        c.save();c.translate(x,y);
        JohnArt.box(c,-5,-3,10,48,'#a87040',4);
        JohnArt.oval(c,0,1,this.chef.paddleWidth/2,10,'#a17347');
        JohnArt.oval(c,0,-4,this.chef.paddleWidth/2,10,'#e8c18b');
        c.strokeStyle='#fff0c8';c.lineWidth=2;c.beginPath();c.ellipse(0,-4,this.chef.paddleWidth/2-4,6,0,0,Math.PI*2);c.stroke();
        c.restore();
    }
    
    onTouchStart(x, y, event) {
        this.targetX = x;
    }
    
    onTouchMove(x, y, event) {
        this.targetX = x;
    }
    
    onTouchEnd(x, y, event) {
        // Nothing needed here usually, just keeping the last position
    }
    
    onKeyDown(key) {
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            this.targetX -= 50; // quick manual step
        }
        if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            this.targetX += 50;
        }
    }
    
    destroy() {
        // cleanup if needed
    }
}
