class PizzaNinjaGame {
    constructor(canvas, logicalWidth, logicalHeight, onGameOver) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.w = logicalWidth;
        this.h = logicalHeight;
        this.onGameOver = onGameOver;
        this.score = 0;

        this.start();
    }

    start() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.combo = 0;
        this.slicing = false;
        this.lastX = null;
        this.lastY = null;
        this.items = [];
        this.particles = [];
        this.popups = [];
        this.trail = [];
        this.waveTimer = 0;
        this.levelTimer = 0;
        this.waveInterval = 1.2;
        this.isGameOver = false;

        // Tabela de itens temáticos do Sushi Ninja (100% culinária japonesa):
        this.itemTypes = [
            { id: 'sushi',      emoji: '🍣', name: 'Sushi',            pts: 3,   weight: 40, bad: false },
            { id: 'sashimi',    emoji: '🐟', name: 'Sashimi',          pts: 4,   weight: 26, bad: false },
            { id: 'temaki',     emoji: '🍙', name: 'Temaki',           pts: 3,   weight: 28, bad: false },
            { id: 'special',    emoji: '⭐', name: 'SN Coin',          pts: 10,  weight: 6,  bad: false, glow: true, isCoin: true },
            { id: 'plate',      emoji: '🍽️', name: 'Prato',            pts: 0,   weight: 10, bad: true, dish: true, label: 'PRATO' },
            { id: 'glass',      emoji: '🥛', name: 'Copo',             pts: 0,   weight: 10, bad: true, dish: true, label: 'COPO' }
        ];
    }

    resize(w, h) {
        this.w = w;
        this.h = h;
    }

    spawnWave() {
        let itemCount = Math.min(1 + Math.floor(this.level / 3) + Math.floor(Math.random() * 2), 3);

        for (let i = 0; i < itemCount; i++) {
            // Frequência de louças (copo e prato) aumenta ligeiramente com os níveis
            let dishWeight = 6 + (this.level - 1) * 1.5;
            let totalWeight = 0;

            let types = this.itemTypes.map(t => {
                let w = t.dish ? dishWeight : t.weight;
                totalWeight += w;
                return { ...t, currentWeight: w };
            });

            let rand = Math.random() * totalWeight;
            let selectedType = types[0];
            let current = 0;

            for (let t of types) {
                current += t.currentWeight;
                if (rand <= current) {
                    selectedType = t;
                    break;
                }
            }

            let size = this.w * 0.12;
            if (size < 36) size = 36;
            if (size > 56) size = 56;

            let x = this.w * 0.15 + Math.random() * (this.w * 0.7);
            let y = this.h + size;

            let targetX = this.w * 0.3 + Math.random() * (this.w * 0.4);
            let dx = targetX - x;

            let vx = dx * 0.5 + (Math.random() - 0.5) * 50;
            let vy = -Math.sqrt(2 * this.h * 0.65 * (this.h * (.55 + Math.random() * .18)));

            this.items.push({
                ...selectedType,
                x, y, vx, vy,
                gravity: this.h * 0.65,
                size,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 4,
                sliced: false,
                lifeTime: 0
            });
        }
    }

    update(dt) {
        if (this.isGameOver) {
            if (this.endTimer > 0) { this.endTimer -= dt; if (this.endTimer <= 0 && this.onGameOver) this.onGameOver(this.score); }
            return;
        }

        this.waveTimer += dt;
        this.levelTimer += dt;

        if (this.levelTimer > 15) {
            this.levelTimer = 0;
            this.level++;
            this.waveInterval = Math.max(0.75, 1.2 - (this.level * 0.07));
            this.addPopup(this.w / 2, this.h / 2, `🔥 Nível ${this.level}!`, '#FFD700', 36);
        }

        if (this.waveTimer >= this.waveInterval) {
            this.waveTimer = 0;
            this.spawnWave();
        }

        // Rastro de corte
        for (let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].life -= dt * 4;
            if (this.trail[i].life <= 0) {
                this.trail.splice(i, 1);
            }
        }

        // Itens
        for (let i = this.items.length - 1; i >= 0; i--) {
            let item = this.items[i];
            item.x += item.vx * dt;
            item.vy += item.gravity * dt;
            item.y += item.vy * dt;
            item.rot += item.rotSpeed * dt;
            item.lifeTime += dt;

            // Se cair da tela
            if (item.y > this.h + item.size * 2 && item.vy > 0) {
                // Perde vida apenas se deixar comida boa cair (pratos/copos caírem sem cortar é bom!)
                if (!item.bad && !item.sliced) {
                    this.lives--;
                    if (typeof ChefJohnAudio !== 'undefined') ChefJohnAudio.play('damage');
                    this.addPopup(item.x, this.h - 80, '💔 Escapou!', '#FF5252', 22);
                    if (this.lives <= 0) {
                        this.gameOver('A comida caiu no chão!');
                    }
                }
                this.items.splice(i, 1);
            }
        }

        // Partículas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.vy += p.gravity * dt;
            p.y += p.vy * dt;
            p.rot += p.rotSpeed * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Popups
        for (let i = this.popups.length - 1; i >= 0; i--) {
            let p = this.popups[i];
            p.y -= 60 * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.popups.splice(i, 1);
            }
        }
    }

    render() {
        const ctx = this.ctx;

        JohnArt.kitchen(ctx, this.w, this.h, true, this.levelTimer, false);

        // Rastro de corte luminoso de alta performance (sem shadowBlur)
        if (this.trail.length > 1) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Camada 1: Brilho ciano suave externo
            for (let i = 1; i < this.trail.length; i++) {
                const p0 = this.trail[i - 1];
                const p1 = this.trail[i];
                const life = Math.max(0, p1.life);
                if (life <= 0.01) continue;

                ctx.strokeStyle = `rgba(0, 229, 255, ${(life * 0.35).toFixed(2)})`;
                ctx.lineWidth = 14 * life + 4;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
            }

            // Camada 2: Lâmina de energia neon intermediária
            for (let i = 1; i < this.trail.length; i++) {
                const p0 = this.trail[i - 1];
                const p1 = this.trail[i];
                const life = Math.max(0, p1.life);
                if (life <= 0.01) continue;

                ctx.strokeStyle = `rgba(0, 240, 255, ${(life * 0.75).toFixed(2)})`;
                ctx.lineWidth = 7 * life + 2;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
            }

            // Camada 3: Fio da navalha central ultra brilhante (branco)
            for (let i = 1; i < this.trail.length; i++) {
                const p0 = this.trail[i - 1];
                const p1 = this.trail[i];
                const life = Math.max(0, p1.life);
                if (life <= 0.01) continue;

                ctx.strokeStyle = `rgba(255, 255, 255, ${life.toFixed(2)})`;
                ctx.lineWidth = 3 * life + 1;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Desenhar itens voando
        for (let item of this.items) {
            if (item.sliced) continue;

            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rot);
            ctx.shadowBlur = 0;

            // Halo dourado para especiais (gradiente radial acelerado por hardware)
            if (item.glow) {
                const glowG = ctx.createRadialGradient(0, 0, item.size * 0.2, 0, 0, item.size * 0.85);
                glowG.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
                glowG.addColorStop(0.65, 'rgba(255, 215, 0, 0.18)');
                glowG.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.fillStyle = glowG;
                ctx.beginPath();
                ctx.arc(0, 0, item.size * 0.85, 0, Math.PI * 2);
                ctx.fill();
            }

            // Halo de perigo para louça frágil (gradiente radial acelerado por hardware)
            if (item.dish) {
                const dishG = ctx.createRadialGradient(0, 0, item.size * 0.2, 0, 0, item.size * 0.75);
                dishG.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
                dishG.addColorStop(0.65, 'rgba(0, 229, 255, 0.15)');
                dishG.addColorStop(1, 'rgba(0, 229, 255, 0)');
                ctx.fillStyle = dishG;
                ctx.beginPath();
                ctx.arc(0, 0, item.size * 0.75, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.font = `${item.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            JohnArt.food(ctx, item.id, 0, 0, item.size);

            ctx.restore();
        }

        // Partículas e estilhaços
        for (let p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            if (alpha <= 0.01) continue;

            if (p.isShard) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = alpha;
                // Estilhaço pontiagudo de porcelana ou vidro
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.moveTo(0, -p.size);
                ctx.lineTo(p.size * 0.6, p.size);
                ctx.lineTo(-p.size * 0.6, p.size * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else if (p.isHalf) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = alpha;
                // Metades de comida fatiada
                ctx.beginPath();
                if (p.side === 'left') {
                    ctx.rect(-p.size, -p.size, p.size, p.size * 2);
                } else {
                    ctx.rect(0, -p.size, p.size, p.size * 2);
                }
                ctx.clip();
                JohnArt.food(ctx, p.id, 0, 0, p.size);
                ctx.restore();
            } else {
                // Faíscas circulares simples - renderização direta sem transformações caras de matriz
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // HUD - Vidas
        ctx.font = '22px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let livesText = '';
        for (let i = 0; i < 3; i++) {
            livesText += i < this.lives ? '❤️' : '🖤';
        }
        ctx.fillText(livesText, 12, 78);

        // Nível
        ctx.font = `bold 15px 'Nunito', sans-serif`;
        ctx.fillStyle = '#FFC107';
        ctx.textAlign = 'right';
        ctx.fillText(`Nível ${this.level}`, this.w - 12, 81);

        // Aviso temático no topo
        ctx.font = `bold 11px 'Nunito', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ Fatie os sushis • Não quebre a louça! 🍽️🥛', this.w / 2, 104);

        // Combo
        if (this.slicing && this.combo > 1) {
            ctx.save();
            ctx.font = `bold ${Math.min(36, 24 + this.combo * 3)}px 'Fredoka One', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.strokeText(`${this.combo}x COMBO!`, this.w / 2, 95);

            let comboColors = ['#FF5722', '#FF9800', '#FFEB3B', '#00E676', '#00BCD4'];
            ctx.fillStyle = comboColors[Math.min(this.combo - 1, comboColors.length - 1)];
            ctx.fillText(`${this.combo}x COMBO!`, this.w / 2, 95);
            ctx.restore();
        }

        // Popups flutuantes
        for (let p of this.popups) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.font = `bold ${p.size}px 'Fredoka One', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 4;
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
    }

    addPopup(x, y, text, color, size) {
        this.popups.push({ x, y, text, color, size, life: 1.2 });
    }

    // Quebra de louça (prato ou copo) com estilhaços voando
    breakDish(item) {
        let isGlass = item.id === 'glass';
        let colors = isGlass
            ? ['#E0F7FA', '#B2EBF2', '#80DEEA', '#FFFFFF', '#4DD0E1']
            : ['#FFFFFF', '#F5F5F5', '#EEEEEE', '#E0E0E0', '#FFD54F'];

        // Keep the impact readable on mobile without holding a heavy particle burst.
        for (let i = 0; i < 18; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = 90 + Math.random() * 260;
            this.particles.push({
                x: item.x,
                y: item.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                gravity: 350,
                rot: Math.random() * Math.PI,
                rotSpeed: (Math.random() - 0.5) * 12,
                size: 3 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0.8 + Math.random() * 0.5,
                maxLife: 1.3,
                isShard: true,
                isHalf: false
            });
        }

        let label = isGlass ? '💥 QUEBROU O COPO!' : '💥 QUEBROU O PRATO!';
        this.addPopup(item.x, item.y, label, '#FF1744', 36);
        this.gameOver(`Você quebrou as louças do restaurante!`);
    }

    createHalves(item) {
        let speed = 120;
        let pLife = 1.2;

        // Metade esquerda
        this.particles.push({
            x: item.x, y: item.y,
            vx: item.vx - speed, vy: item.vy - 50,
            gravity: item.gravity,
            rot: item.rot, rotSpeed: item.rotSpeed - 3,
            size: item.size,
            life: pLife, maxLife: pLife,
            isHalf: true, side: 'left', id: item.id, emoji: item.emoji
        });

        // Metade direita
        this.particles.push({
            x: item.x, y: item.y,
            vx: item.vx + speed, vy: item.vy - 50,
            gravity: item.gravity,
            rot: item.rot, rotSpeed: item.rotSpeed + 3,
            size: item.size,
            life: pLife, maxLife: pLife,
            isHalf: true, side: 'right', id: item.id, emoji: item.emoji
        });

        // Faíscas coloridas
        let sparkColors = ['#FFC107', '#FF5722', '#4CAF50', '#E91E63', '#ffffff'];
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: item.x + (Math.random() - 0.5) * 30,
                y: item.y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 200,
                vy: -Math.random() * 150 - 50,
                gravity: 300,
                rot: 0, rotSpeed: 0,
                size: 2 + Math.random() * 5,
                color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
                life: 0.5 + Math.random() * 0.4,
                maxLife: 0.9,
                isHalf: false
            });
        }
    }

    sliceItem(item) {
        // Se fatiar prato ou copo -> quebra a louça e game over!
        if (item.dish) {
            this.breakDish(item);
            return;
        }

        this.combo++;
        if (typeof ChefJohnAudio !== 'undefined') ChefJohnAudio.play(item.isCoin ? 'coin' : item.bad ? 'damage' : 'slice');
        let multiplier = Math.min(this.combo, 4);
        let pts = item.pts * multiplier;
        this.score = Math.max(0, this.score + pts);

        let color, text;
        if (item.bad) {
            color = '#FF5252';
            text = `${pts}`;
        } else {
            color = item.glow ? '#FFD700' : '#76FF03';
            text = `+${pts}`;
        }

        if (this.combo > 1 && !item.bad) {
            text += ` (${multiplier}x)`;
            color = ['#FFEB3B', '#FF9800', '#FF5722', '#E91E63'][Math.min(multiplier - 1, 3)];
        }

        this.addPopup(item.x, item.y - 20, text, color, 28);
        this.createHalves(item);
    }

    gameOver(reason) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.endTimer = .25;
        this.addPopup(this.w / 2, this.h / 2 - 50, '💀 Fim de Jogo!', '#FF1744', 44);

    }

    checkCollisions(x1, y1, x2, y2) {
        if (this.isGameOver) return;

        for (let i = this.items.length - 1; i >= 0; i--) {
            let item = this.items[i];

            let minX = Math.min(x1, x2) - item.size;
            let maxX = Math.max(x1, x2) + item.size;
            let minY = Math.min(y1, y2) - item.size;
            let maxY = Math.max(y1, y2) + item.size;

            if (item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY) {
                let l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
                let t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((item.x - x1) * (x2 - x1) + (item.y - y1) * (y2 - y1)) / l2));
                let projX = x1 + t * (x2 - x1);
                let projY = y1 + t * (y2 - y1);

                let dist = Math.sqrt((item.x - projX) ** 2 + (item.y - projY) ** 2);

                if (dist < item.size * 0.65) {
                    this.sliceItem(item);
                    this.items.splice(i, 1);
                    if (this.isGameOver) return;
                }
            }
        }
    }

    onTouchStart(x, y, event) {
        if (this.isGameOver) return;
        this.slicing = true;
        this.lastX = x;
        this.lastY = y;
        this.combo = 0;
        this.trail = [{ x, y, life: 1 }];
    }

    onTouchMove(x, y, event) {
        if (!this.slicing || this.isGameOver) return;

        if (this.lastX !== null && this.lastY !== null) {
            const dx = x - this.lastX;
            const dy = y - this.lastY;
            if (dx * dx + dy * dy < 4) return;
        }

        this.trail.push({ x, y, life: 1 });
        if (this.trail.length > 22) this.trail.shift();

        this.checkCollisions(this.lastX, this.lastY, x, y);

        this.lastX = x;
        this.lastY = y;
    }

    onTouchEnd(x, y, event) {
        this.slicing = false;
        this.lastX = null;
        this.lastY = null;
        if (this.combo > 1) {
            this.addPopup(this.w / 2, this.h / 3, `🔥 ${this.combo}x COMBO!`, '#00E5FF', 38);
        }
        this.combo = 0;
    }

    onKeyDown(key) {
    }

    destroy() {
        this.onGameOver = null;
        this.endTimer = 0;
    }
}
