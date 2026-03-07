/**
 * 🐍 Snake Domain .io - Premium Engine
 * Built with Vanilla JS & Antigravity Design
 */

const CONFIG = {
    WORLD_WIDTH: 4000,
    WORLD_HEIGHT: 4000,
    TILE_SIZE: 40,
    FPS: 60,
    BASE_SPEED: 3.2,
    TURBO_SPEED: 5.5,
    SNAKE_LENGTH: 25,
    SNAKE_RADIUS: 14,
    PASSIVE_ORB_INTERVAL: 10000, // 10s
    POWERUP_DURATION: 8000,     // 8s (Venom/Shield)
    TURBO_DURATION: 5000,       // 5s
    COLORS: [
        { main: '#00ffcc', glow: 'rgba(0, 255, 204, 0.5)' }, // Ciano
        { main: '#ff3366', glow: 'rgba(255, 51, 102, 0.5)' }, // Rosa
        { main: '#ffcc00', glow: 'rgba(255, 204, 0, 0.5)' }, // Amarelo
        { main: '#cc33ff', glow: 'rgba(204, 51, 255, 0.5)' }, // Roxo
        { main: '#3399ff', glow: 'rgba(51, 153, 255, 0.5)' }, // Azul
        { main: '#ff6600', glow: 'rgba(255, 102, 0, 0.5)' }, // Laranja
        { main: '#00ff00', glow: 'rgba(0, 255, 0, 0.5)' },   // Verde
        { main: '#ffffff', glow: 'rgba(255, 255, 255, 0.5)' },// Branco
        { main: '#ff0000', glow: 'rgba(255, 0, 0, 0.5)' },   // Vermelho
        { main: '#ff33ff', glow: 'rgba(255, 51, 255, 0.5)' }, // Magenta
        { main: '#0099ff', glow: 'rgba(0, 153, 255, 0.5)' }, // Royal Blue
        { main: '#33ff99', glow: 'rgba(51, 255, 153, 0.5)' }, // Menta
        { main: '#ffff33', glow: 'rgba(255, 255, 51, 0.5)' }, // Lemon
        { main: '#9933ff', glow: 'rgba(153, 51, 255, 0.5)' }, // Violeta
        { main: '#ff9933', glow: 'rgba(255, 153, 51, 0.5)' }  // Pêssego
    ],
    ORB_TYPES: {
        NORMAL: { color: '#ffffff', value: 1 },
        TURBO: { color: '#ffcc00', value: 0, type: 'turbo', icon: '⚡' },
        VENOM: { color: '#cc33ff', value: 0, type: 'venom', icon: '🧪' },
        SHIELD: { color: '#3399ff', value: 0, type: 'shield', icon: '🛡️' }
    },
    BOT_COUNT: 10
};

const COLS = Math.floor(CONFIG.WORLD_WIDTH / CONFIG.TILE_SIZE);
const ROWS = Math.floor(CONFIG.WORLD_HEIGHT / CONFIG.TILE_SIZE);

// Global State
const state = {
    grid: new Array(COLS).fill(0).map(() => new Array(ROWS).fill(-1)),
    players: [],
    orbs: [],
    camera: { x: 0, y: 0 },
    keys: { u: false, d: false, l: false, r: false, usingKeyboard: false },
    mouse: { x: 0, y: 0 },
    gameOver: false,
    isPaused: false,
    gameStarted: false,
    lastPassiveOrbTime: 0,
    currentScorePercent: 0,
    selectedColorIdx: 0,
    isBoosting: false
};

// Canvas Setup
const canvases = {
    bg: document.getElementById('bg-layer'),
    trail: document.getElementById('trail-layer'),
    entity: document.getElementById('entity-layer'),
    minimap: document.getElementById('minimap-layer')
};
const ctxs = {
    bg: canvases.bg.getContext('2d'),
    trail: canvases.trail.getContext('2d'),
    entity: canvases.entity.getContext('2d'),
    minimap: canvases.minimap.getContext('2d')
};

function resize() {
    [canvases.bg, canvases.trail, canvases.entity].forEach(canvas => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    canvases.minimap.width = 200;
    canvases.minimap.height = 200;
}
window.addEventListener('resize', resize);
resize();

// Input Tracking
window.addEventListener('mousemove', (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
    state.keys.usingKeyboard = false;
});

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') state.keys.u = true;
    if (k === 's' || e.key === 'ArrowDown') state.keys.d = true;
    if (k === 'a' || e.key === 'ArrowLeft') state.keys.l = true;
    if (k === 'd' || e.key === 'ArrowRight') state.keys.r = true;
    
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
        state.keys.usingKeyboard = true;
    }

    if (e.key === 'Escape' || k === 'p') {
        togglePause();
    }
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') state.keys.u = false;
    if (k === 's' || e.key === 'ArrowDown') state.keys.d = false;
    if (k === 'a' || e.key === 'ArrowLeft') state.keys.l = false;
    if (k === 'd' || e.key === 'ArrowRight') state.keys.r = false;
});

function togglePause() {
    if (state.gameOver || !state.gameStarted) return;
    state.isPaused = !state.isPaused;
    document.getElementById('pause-screen').classList.toggle('hidden', !state.isPaused);
}

window.addEventListener('mousedown', () => { state.isBoosting = true; });
window.addEventListener('mouseup', () => { state.isBoosting = false; });

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    state.gameStarted = true;
    initGame();
});

document.getElementById('respawn-btn').addEventListener('click', () => {
    const screen = document.getElementById('game-over-screen');
    if (screen) {
        screen.classList.add('hidden');
        screen.style.display = 'none';
    }
    initGame();
});

document.getElementById('resume-btn').addEventListener('click', togglePause);

/**
 * ENTITY CLASSES
 */

class Orb {
    constructor(x, y, type = 'NORMAL') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.config = CONFIG.ORB_TYPES[type];
        this.size = type === 'NORMAL' ? 6 : 12;
        this.pulse = 0;
    }

    update() {
        this.pulse += 0.1;
    }

    draw(ctx, cx, cy) {
        const drawSize = this.size + Math.sin(this.pulse) * 2;
        ctx.save();
        ctx.translate(this.x - cx, this.y - cy);
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.config.color;
        ctx.fillStyle = this.config.color;
        
        ctx.beginPath();
        ctx.arc(0, 0, drawSize, 0, Math.PI * 2);
        ctx.fill();
        
        if (this.config.icon) {
            ctx.fillStyle = '#111';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.config.icon, 0, 0);
        }
        
        ctx.restore();
    }
}

class Player {
    constructor(id, x, y, colorIdx, isBot = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.colorData = CONFIG.COLORS[colorIdx % CONFIG.COLORS.length];
        this.color = this.colorData.main;
        this.isBot = isBot;
        this.isPlayer = (id === 0);
        
        this.angle = 0;
        this.speed = CONFIG.BASE_SPEED;
        this.alive = true;
        
        this.body = []; 
        this.trail = []; 
        this.trailSet = new Set();

        // Power-ups
        this.powerups = {
            turbo: 0,
            venom: 0,
            shield: 0
        };

        this.mass = CONFIG.SNAKE_LENGTH; 

        this.initBase();
    }

    initBase() {
        const gx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const gy = Math.floor(this.y / CONFIG.TILE_SIZE);
        for (let ix = -1; ix <= 1; ix++) {
            for (let iy = -1; iy <= 1; iy++) {
                if (gx + ix >= 0 && gx + ix < COLS && gy + iy >= 0 && gy + iy < ROWS) {
                    state.grid[gx + ix][gy + iy] = this.id;
                }
            }
        }
        this.baseX = this.x;
        this.baseY = this.y;
    }

    update() {
        if (!this.alive) return;

        // Current Tile Check
        const gx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const gy = Math.floor(this.y / CONFIG.TILE_SIZE);
        const isInOwnTerritory = (state.grid[gx] && state.grid[gx][gy] === this.id);

        if (isInOwnTerritory) {
            this.baseX = this.x;
            this.baseY = this.y;
        }

        // Power-up Timers
        Object.keys(this.powerups).forEach(type => {
            if (this.powerups[type] > 0) {
                this.powerups[type] -= 1000 / 60; // Approx ms per frame
                if (this.powerups[type] < 0) this.powerups[type] = 0;
            }
        });

        // Speed calculation
        let isManualBoosting = !this.isBot && state.isBoosting && this.mass > CONFIG.SNAKE_LENGTH;
        let currentSpeed = (this.powerups.turbo > 0 || isManualBoosting) ? CONFIG.TURBO_SPEED : CONFIG.BASE_SPEED;
        
        if (isManualBoosting) {
            this.mass -= 0.05; // Consume mass
            if (this.mass < CONFIG.SNAKE_LENGTH) this.mass = CONFIG.SNAKE_LENGTH;
        }

        if (isInOwnTerritory) {
            currentSpeed *= 1.25; // Home Turf Boost
        } else {
            let tileOwner = state.grid[gx] && state.grid[gx][gy];
            if (tileOwner !== undefined && tileOwner !== -1 && tileOwner !== this.id) {
                currentSpeed *= 0.70; // Enemy Slow
            }
        }

        // AI or Input
        if (this.isBot) {
            this.botAI();
        } else {
            this.handleInput();
        }

        // Body History (Smoothing)
        this.body.push({ x: this.x, y: this.y });
        const maxBody = Math.floor((this.mass * CONFIG.SNAKE_RADIUS * 2) / CONFIG.BASE_SPEED);
        if (this.body.length > maxBody) this.body.shift();

        // Position Update
        this.x += Math.cos(this.angle) * currentSpeed;
        this.y += Math.sin(this.angle) * currentSpeed;

        // Map Bounds
        this.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH, this.x));
        this.y = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT, this.y));

        this.checkTrailLogic();
        this.checkOrbCollision();
    }

    handleInput() {
        let targetAngle;
        if (state.keys.usingKeyboard && (state.keys.u || state.keys.d || state.keys.l || state.keys.r)) {
            let dx = 0, dy = 0;
            if (state.keys.u) dy -= 1;
            if (state.keys.d) dy += 1;
            if (state.keys.l) dx -= 1;
            if (state.keys.r) dx += 1;
            targetAngle = Math.atan2(dy, dx);
        } else {
            const dx = state.mouse.x - window.innerWidth / 2;
            const dy = state.mouse.y - window.innerHeight / 2;
            if (Math.hypot(dx, dy) > 20) targetAngle = Math.atan2(dy, dx);
        }

        if (targetAngle !== undefined) {
            this.angle = this.lerpAngle(this.angle, targetAngle, 0.15);
        }
    }

    botAI() {
        if (this.targetAngleDecay === undefined) {
            this.targetAngleDecay = 0;
            this.botMaxTrail = 20 + Math.random() * 40;
            this.botState = 'explore'; // 'explore', 'return', 'attack', 'orb'
        }

        const margin = 150;
        const gx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const gy = Math.floor(this.y / CONFIG.TILE_SIZE);
        const inSafe = (state.grid[gx] && state.grid[gx][gy] === this.id);

        // 1. DANGER AVOIDANCE (Highest Priority)
        let dangerFound = false;
        // Avoid map bounds
        if (this.x < margin) { this.angle = this.lerpAngle(this.angle, 0, 0.2); dangerFound = true; }
        else if (this.x > CONFIG.WORLD_WIDTH - margin) { this.angle = this.lerpAngle(this.angle, Math.PI, 0.2); dangerFound = true; }
        if (this.y < margin) { this.angle = this.lerpAngle(this.angle, Math.PI / 2, 0.2); dangerFound = true; }
        else if (this.y > CONFIG.WORLD_HEIGHT - margin) { this.angle = this.lerpAngle(this.angle, -Math.PI / 2, 0.2); dangerFound = true; }

        if (dangerFound) return;

        // Anti-collision: Look ahead
        const lookAheadDist = 100;
        const lookX = this.x + Math.cos(this.angle) * lookAheadDist;
        const lookY = this.y + Math.sin(this.angle) * lookAheadDist;
        const lgx = Math.floor(lookX / CONFIG.TILE_SIZE);
        const lgy = Math.floor(lookY / CONFIG.TILE_SIZE);

        // Avoid own trail
        if (this.trailSet.has(`${lgx},${lgy}`)) {
            this.angle += 0.5; // Turn away
            return;
        }

        // Avoid others
        for (let p of state.players) {
            if (!p.alive || p.id === this.id) continue;
            // Check body
            for (let i = 0; i < p.body.length; i += 5) {
                const b = p.body[i];
                if (Math.hypot(lookX - b.x, lookY - b.y) < 60) {
                    this.angle += Math.PI / 2; // Sharp turn away
                    return;
                }
            }
        }

        // 2. DECISION MAKING
        if (inSafe) {
            this.botState = 'explore';
            this.botMaxTrail = 25 + Math.random() * 50; 
            
            this.targetAngleDecay--;
            if (this.targetAngleDecay <= 0) {
                // Wandering
                this.angle += (Math.random() - 0.5) * 1.2;
                this.targetAngleDecay = 20 + Math.random() * 40;
            }
        } else {
            // Check if we should return
            if (this.trail.length > this.botMaxTrail) {
                this.botState = 'return';
            } else {
                // Look for opportunities
                // A. Check for enemy trails to cut
                let nearestTrail = null;
                let minDist = 300;
                for (let p of state.players) {
                    if (!p.alive || p.id === this.id) continue;
                    for (let t of p.trail) {
                        const tx = t.x * CONFIG.TILE_SIZE + 20;
                        const ty = t.y * CONFIG.TILE_SIZE + 20;
                        const dist = Math.hypot(this.x - tx, this.y - ty);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestTrail = {x: tx, y: ty};
                        }
                    }
                }

                if (nearestTrail) {
                    this.botState = 'attack';
                    const targetA = Math.atan2(nearestTrail.y - this.y, nearestTrail.x - this.x);
                    this.angle = this.lerpAngle(this.angle, targetA, 0.15);
                } else {
                    // B. Look for Orbs
                    let nearestOrb = null;
                    let minOrbDist = 250;
                    for (let orb of state.orbs) {
                        const dist = Math.hypot(this.x - orb.x, this.y - orb.y);
                        if (dist < minOrbDist) {
                            minOrbDist = dist;
                            nearestOrb = orb;
                        }
                    }

                    if (nearestOrb) {
                        this.botState = 'orb';
                        const orbA = Math.atan2(nearestOrb.y - this.y, nearestOrb.x - this.x);
                        this.angle = this.lerpAngle(this.angle, orbA, 0.1);
                    } else if (this.botState !== 'attack') {
                        // Just keep curving to make a loop
                        this.angle += 0.05; 
                    }
                }
            }

            if (this.botState === 'return') {
                const toBase = Math.atan2(this.baseY - this.y, this.baseX - this.x);
                this.angle = this.lerpAngle(this.angle, toBase, 0.12);
            }
        }
    }

    lerpAngle(a, b, t) {
        let diff = b - a;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        return a + diff * t;
    }

    checkTrailLogic() {
        const gx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const gy = Math.floor(this.y / CONFIG.TILE_SIZE);
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

        const tileId = state.grid[gx][gy];
        const key = `${gx},${gy}`;

        if (tileId === this.id) {
            if (this.trail.length > 0) this.closePolygon();
        } else {
            if (this.trailSet.has(key)) {
                // Self-collision (check if it's not the head segments)
                const idx = this.trail.findIndex(t => t.x === gx && t.y === gy);
                if (idx < this.trail.length - 4) this.die("Auto-colisão no rastro!");
            } else {
                this.trail.push({ x: gx, y: gy });
                this.trailSet.add(key);
            }
        }
    }

    checkOrbCollision() {
        for (let i = state.orbs.length - 1; i >= 0; i--) {
            const orb = state.orbs[i];
            const dist = Math.hypot(this.x - orb.x, this.y - orb.y);
            if (dist < CONFIG.SNAKE_RADIUS + orb.size) {
                this.applyOrb(orb);
                state.orbs.splice(i, 1);
            }
        }
    }

    applyOrb(orb) {
        if (orb.config.type) {
            this.powerups[orb.config.type] = (orb.config.type === 'turbo') ? CONFIG.TURBO_DURATION : CONFIG.POWERUP_DURATION;
        } else {
            // Normal orb: grow
            this.mass += 0.5;
        }
    }

    closePolygon() {
        // Point-in-polygon / Flood fill Logic
        const walls = new Set();
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (state.grid[x][y] === this.id) walls.add(`${x},${y}`);
            }
        }
        this.trail.forEach(t => walls.add(`${t.x},${t.y}`));

        const visited = new Set();
        const queue = [];
        for (let x = -1; x <= COLS; x++) { queue.push({x:x, y:-1}); queue.push({x:x, y:ROWS}); }
        for (let y = 0; y < ROWS; y++) { queue.push({x:-1, y:y}); queue.push({x:COLS, y:y}); }
        queue.forEach(q => visited.add(`${q.x},${q.y}`));

        const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
        let head = 0;
        while(head < queue.length) {
            const curr = queue[head++];
            for (let d of dirs) {
                const nx = curr.x + d[0], ny = curr.y + d[1];
                if (nx < -1 || nx > COLS || ny < -1 || ny > ROWS) continue;
                const key = `${nx},${ny}`;
                if (!visited.has(key) && !walls.has(key)) {
                    visited.add(key);
                    queue.push({x: nx, y: ny});
                }
            }
        }

        let areaGained = 0;
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (!visited.has(`${x},${y}`)) {
                    if (this.powerups.venom > 0) {
                        // Venom effect: possibly reduce others territory? 
                        // For simplicity, venom will just expand faster or punish others later
                    }
                    state.grid[x][y] = this.id;
                    areaGained++;
                }
            }
        }
        this.trail = [];
        this.trailSet.clear();
    }

    shrinkArea(percent) {
        let cells = [];
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (state.grid[x][y] === this.id) cells.push({x, y});
            }
        }
        const countToRemove = Math.floor(cells.length * percent);
        for (let i = 0; i < countToRemove; i++) {
            const idx = Math.floor(Math.random() * cells.length);
            const {x, y} = cells[idx];
            state.grid[x][y] = -1;
            cells.splice(idx, 1);
        }
    }

    die(reason) {
        if (!this.alive) return;
        
        if (this.powerups.shield > 0) {
            this.powerups.shield = 0;
            return;
        }

        console.log("Player died:", reason); // For debugging
        this.alive = false;
        
        if (this.isPlayer) {
            // Capture final score before clearing grid
            const finalScore = state.currentScorePercent;
            state.gameOver = true;
            
            // Clear territory after a short delay or immediately?
            // Let's clear it but show the captured score.
            this.clearTerritory();
            this.showGameOver(reason, finalScore);
        } else {
            this.clearTerritory();
            setTimeout(() => this.respawn(), 3000);
        }
    }

    clearTerritory() {
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (state.grid[x][y] === this.id) state.grid[x][y] = -1;
            }
        }
    }

    respawn() {
        const pos = findSafeSpawn();
        this.x = pos.x;
        this.y = pos.y;
        this.initBase();
        this.alive = true;
        this.body = [];
        this.trail = [];
        this.trailSet = new Set();
    }

    showGameOver(reason, finalScore) {
        const screen = document.getElementById('game-over-screen');
        const reasonEl = document.getElementById('death-reason');
        const scoreEl = document.getElementById('final-score');
        
        if (reasonEl) reasonEl.innerText = reason;
        if (scoreEl) scoreEl.innerText = `Dominação Final: ${finalScore}%`;
        
        let best = parseFloat(localStorage.getItem('snakeBest') || 0);
        if (parseFloat(finalScore) > best) {
            localStorage.setItem('snakeBest', finalScore);
        }
        localStorage.setItem('snakeLast', finalScore);
        
        if (screen) {
            screen.classList.remove('hidden');
            screen.style.display = 'block'; // Force display just in case
        }
    }
}

/**
 * ENGINE LOGIC
 */

function initGame() {
    state.grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(-1));
    state.players = [];
    state.orbs = [];
    state.gameOver = false;
    state.isPaused = false;
    state.lastPassiveOrbTime = Date.now();

    // Prepare unique colors
    let availableColorIndices = CONFIG.COLORS.map((_, i) => i);
    // Remove selected player color from bots availability
    availableColorIndices = availableColorIndices.filter(i => i !== state.selectedColorIdx);
    
    // Shuffle bot colors
    for (let i = availableColorIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableColorIndices[i], availableColorIndices[j]] = [availableColorIndices[j], availableColorIndices[i]];
    }

    // Player
    const playerPos = findSafeSpawn();
    state.players.push(new Player(0, playerPos.x, playerPos.y, state.selectedColorIdx, false));

    // Bots
    for (let i = 1; i <= CONFIG.BOT_COUNT; i++) {
        const pos = findSafeSpawn();
        // Fallback to random if we run out of unique colors (though we have 15 for 10 bots)
        const colorIdx = availableColorIndices.pop() ?? Math.floor(Math.random() * CONFIG.COLORS.length);
        state.players.push(new Player(i, pos.x, pos.y, colorIdx, true));
    }

    // Initial random orbs
    for (let i = 0; i < 50; i++) spawnOrb();

    requestAnimationFrame(gameLoop);
}

function spawnOrb(type = 'NORMAL') {
    const x = Math.random() * CONFIG.WORLD_WIDTH;
    const y = Math.random() * CONFIG.WORLD_HEIGHT;
    state.orbs.push(new Orb(x, y, type));
}

function findSafeSpawn() {
    let attempts = 0;
    while(attempts < 50) {
        const x = Math.random() * (CONFIG.WORLD_WIDTH - 400) + 200;
        const y = Math.random() * (CONFIG.WORLD_HEIGHT - 400) + 200;
        const gx = Math.floor(x / CONFIG.TILE_SIZE);
        const gy = Math.floor(y / CONFIG.TILE_SIZE);
        
        // Match 3x3 free area
        let areaFree = true;
        for(let ix=-2; ix<=2; ix++) {
            for(let iy=-2; iy<=2; iy++) {
                if(state.grid[gx+ix] && state.grid[gx+ix][gy+iy] !== -1) areaFree = false;
            }
        }
        
        if(areaFree) return {x, y};
        attempts++;
    }
    // Fallback
    return { x: Math.random() * CONFIG.WORLD_WIDTH, y: Math.random() * CONFIG.WORLD_HEIGHT };
}

function handlePassiveOrbs() {
    const now = Date.now();
    if (now - state.lastPassiveOrbTime > CONFIG.PASSIVE_ORB_INTERVAL) {
        state.lastPassiveOrbTime = now;
        
        // Spawn inside each player's territory
        state.players.forEach(p => {
            if (!p.alive) return;
            const myTiles = [];
            for(let x=0; x<COLS; x++) {
                for(let y=0; y<ROWS; y++) {
                    if(state.grid[x][y] === p.id) myTiles.push({x,y});
                }
            }
            if (myTiles.length > 0) {
                const target = myTiles[Math.floor(Math.random() * myTiles.length)];
                state.orbs.push(new Orb(
                    target.x * CONFIG.TILE_SIZE + 20,
                    target.y * CONFIG.TILE_SIZE + 20,
                    'NORMAL'
                ));
            }
        });

        // Chance to spawn Power-up
        if (Math.random() > 0.7) {
            const types = ['TURBO', 'VENOM', 'SHIELD'];
            spawnOrb(types[Math.floor(Math.random() * types.length)]);
        }
    }
}

function checkCollisions() {
    for (let p1 of state.players) {
        if (!p1.alive) continue;
        const gx = Math.floor(p1.x / CONFIG.TILE_SIZE);
        const gy = Math.floor(p1.y / CONFIG.TILE_SIZE);

        for (let p2 of state.players) {
            if (!p2.alive || p1.id === p2.id) continue;

            // Trail Cutting / Venom Effect
            if (p2.trailSet.has(`${gx},${gy}`)) {
                if (p2.powerups.venom > 0) {
                    // Venom Effect: Enemy loses speed or area? 
                    // User said: "perdem 10% de tamanho/área". 
                    // Let's implement area loss for p1.
                    p1.shrinkArea(0.1);
                    // Also visual flash?
                } else {
                    p2.die(`Sua linha foi cortada por ${p1.isPlayer ? 'um herói' : 'um rival'}!`);
                }
            }

            // Head to Body collision
            for (let b of p2.body) {
                const dist = Math.hypot(p1.x - b.x, p1.y - b.y);
                if (dist < CONFIG.SNAKE_RADIUS * 2) {
                    p1.die("Você bateu no corpo de outro!");
                }
            }
        }
    }
}

/**
 * RENDERING
 */

function draw() {
    const cx = state.camera.x;
    const cy = state.camera.y;

    // 1. Background
    const ctxB = ctxs.bg;
    ctxB.fillStyle = '#0a0a0c';
    ctxB.fillRect(0, 0, window.innerWidth, window.innerHeight);
    
    ctxB.save();
    ctxB.translate(-cx, -cy);
    
    // Grid Lines
    ctxB.strokeStyle = 'rgba(255,255,255,0.03)';
    ctxB.lineWidth = 1;
    for(let x=0; x<=CONFIG.WORLD_WIDTH; x+=CONFIG.TILE_SIZE*2) {
        ctxB.beginPath(); ctxB.moveTo(x, 0); ctxB.lineTo(x, CONFIG.WORLD_HEIGHT); ctxB.stroke();
    }
    for(let y=0; y<=CONFIG.WORLD_HEIGHT; y+=CONFIG.TILE_SIZE*2) {
        ctxB.beginPath(); ctxB.moveTo(0, y); ctxB.lineTo(CONFIG.WORLD_WIDTH, y); ctxB.stroke();
    }

    // Territories
    for(let x=0; x<COLS; x++) {
        for(let y=0; y<ROWS; y++) {
            const id = state.grid[x][y];
            if (id !== -1) {
                const color = CONFIG.COLORS[id % CONFIG.COLORS.length].main;
                ctxB.fillStyle = color;
                ctxB.globalAlpha = 0.15;
                ctxB.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
            }
        }
    }
    ctxB.restore();

    // 2. Trails
    const ctxT = ctxs.trail;
    ctxT.clearRect(0,0, window.innerWidth, window.innerHeight);
    ctxT.save();
    ctxT.translate(-cx, -cy);
    state.players.forEach(p => {
        if (!p.alive || p.trail.length === 0) return;
        ctxT.fillStyle = p.color;
        ctxT.globalAlpha = 0.4;
        p.trail.forEach(t => ctxT.fillRect(t.x * CONFIG.TILE_SIZE, t.y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE));
        
        // Trail drawing
        if (p.powerups.venom > 0) {
            ctxT.shadowBlur = 10;
            ctxT.shadowColor = '#cc33ff';
            ctxT.globalAlpha = 1;
            ctxT.strokeStyle = '#cc33ff';
            ctxT.setLineDash([]);
        } else {
            ctxT.globalAlpha = 1;
            ctxT.setLineDash([10, 5]);
            ctxT.strokeStyle = p.color;
        }
        ctxT.beginPath();
        const first = p.trail[0];
        ctxT.moveTo(first.x * CONFIG.TILE_SIZE + 20, first.y * CONFIG.TILE_SIZE + 20);
        p.trail.forEach(t => ctxT.lineTo(t.x * CONFIG.TILE_SIZE + 20, t.y * CONFIG.TILE_SIZE + 20));
        ctxT.lineTo(p.x, p.y);
        ctxT.stroke();
        ctxT.setLineDash([]);
    });
    ctxT.restore();

    // 3. Entities (Orbs & Snakes)
    const ctxE = ctxs.entity;
    ctxE.clearRect(0, 0, window.innerWidth, window.innerHeight);
    state.orbs.forEach(o => o.draw(ctxE, cx, cy));
    
    ctxE.save();
    ctxE.translate(-cx, -cy);
    state.players.forEach(p => {
        if (!p.alive) return;
        
        // Body
        for (let i = 0; i < p.body.length; i += 2) {
            const b = p.body[i];
            const size = CONFIG.SNAKE_RADIUS * (0.6 + 0.4 * (i / p.body.length));
            ctxE.fillStyle = p.color;
            ctxE.globalAlpha = 0.3 + 0.7 * (i / p.body.length);
            ctxE.beginPath();
            ctxE.arc(b.x, b.y, size, 0, Math.PI * 2);
            ctxE.fill();
        }

        // Head Glow
        ctxE.shadowBlur = 15;
        ctxE.shadowColor = p.color;
        
        // Shield Effect
        if (p.powerups.shield > 0) {
            ctxE.strokeStyle = '#3399ff';
            ctxE.lineWidth = 4;
            ctxE.beginPath();
            ctxE.arc(p.x, p.y, CONFIG.SNAKE_RADIUS + 8, 0, Math.PI * 2);
            ctxE.stroke();
        }

        // Head
        ctxE.globalAlpha = 1;
        ctxE.fillStyle = '#fff';
        ctxE.beginPath();
        ctxE.arc(p.x, p.y, CONFIG.SNAKE_RADIUS, 0, Math.PI * 2);
        ctxE.fill();
        
        ctxE.fillStyle = p.color;
        ctxE.beginPath();
        ctxE.arc(p.x, p.y, CONFIG.SNAKE_RADIUS - 3, 0, Math.PI * 2);
        ctxE.fill();

        // Eyes
        const ex = Math.cos(p.angle) * 6;
        const ey = Math.sin(p.angle) * 6;
        const ox = Math.cos(p.angle + Math.PI/2) * 5;
        const oy = Math.sin(p.angle + Math.PI/2) * 5;
        ctxE.fillStyle = '#000';
        ctxE.beginPath(); ctxE.arc(p.x + ex + ox, p.y + ey + oy, 2.5, 0, Math.PI*2); ctxE.fill();
        ctxE.beginPath(); ctxE.arc(p.x + ex - ox, p.y + ey - oy, 2.5, 0, Math.PI*2); ctxE.fill();
        
        ctxE.shadowBlur = 0;
    });
    ctxE.restore();

    drawMinimap();
    updateUI();
}

function drawMinimap() {
    const ctxM = ctxs.minimap;
    ctxM.clearRect(0,0,200,200);
    const sw = 200 / COLS;
    const sh = 200 / ROWS;

    for(let x=0; x<COLS; x+=2) { // x2 optimization
        for(let y=0; y<ROWS; y+=2) {
            const id = state.grid[x][y];
            if (id !== -1) {
                ctxM.fillStyle = CONFIG.COLORS[id % CONFIG.COLORS.length].main;
                ctxM.fillRect(x*sw, y*sh, sw*2, sh*2);
            }
        }
    }
    
    const p = state.players[0];
    if (p && p.alive) {
        ctxM.fillStyle = '#fff';
        ctxM.beginPath();
        ctxM.arc((p.x / CONFIG.WORLD_WIDTH) * 200, (p.y / CONFIG.WORLD_HEIGHT) * 200, 3, 0, Math.PI*2);
        ctxM.fill();
    }
}

function updateUI() {
    const counts = {};
    state.players.forEach(p => counts[p.id] = 0);
    for(let x=0; x<COLS; x++) {
        for(let y=0; y<ROWS; y++) {
            const id = state.grid[x][y];
            if (id !== -1 && counts[id] !== undefined) counts[id]++;
        }
    }

    const total = COLS * ROWS;
    const sorted = Object.keys(counts).map(id => ({
        id: parseInt(id),
        score: counts[id]
    })).sort((a,b) => b.score - a.score);

    document.getElementById('leaderboard-list').innerHTML = sorted.slice(0, 5).map(s => {
        const p = state.players.find(pl => pl.id === s.id);
        const name = p.isPlayer ? 'VOCÊ' : `RIVAL ${s.id}`;
        return `<li><span>${name}</span> <span>${((s.score/total)*100).toFixed(1)}%</span></li>`;
    }).join('');

    if (state.players[0]) {
        const p = state.players[0];
        const perc = ((counts[0]/total)*100).toFixed(2);
        state.currentScorePercent = perc;
        document.getElementById('score-text').innerText = `Território: ${perc}%`;
        
        // Power-up HUD update
        updatePowerupHUD('pow-turbo', 'timer-turbo', p.powerups.turbo, CONFIG.TURBO_DURATION);
        updatePowerupHUD('pow-venom', 'timer-venom', p.powerups.venom, CONFIG.POWERUP_DURATION);
        updatePowerupHUD('pow-shield', 'timer-shield', p.powerups.shield, CONFIG.POWERUP_DURATION);
    }
}

function updatePowerupHUD(iconId, timerId, current, max) {
    const el = document.getElementById(iconId);
    const timer = document.getElementById(timerId);
    if (current > 0) {
        el.classList.add('active');
        timer.style.width = (current / max * 100) + '%';
    } else {
        el.classList.remove('active');
        timer.style.width = '0%';
    }
}

function gameLoop() {
    if (!state.isPaused && state.gameStarted && !state.gameOver) {
        state.players.forEach(p => p.update());
        state.orbs.forEach(o => o.update());
        checkCollisions();
        handlePassiveOrbs();
    }

    // Camera follow
    if (state.players[0]) {
        const p = state.players[0];
        const targetX = p.x - window.innerWidth / 2;
        const targetY = p.y - window.innerHeight / 2;
        state.camera.x += (targetX - state.camera.x) * 0.1;
        state.camera.y += (targetY - state.camera.y) * 0.1;
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Initial Load
(function setupColorPicker() {
    const container = document.getElementById('color-selection');
    if (!container) return;

    CONFIG.COLORS.forEach((color, index) => {
        const opt = document.createElement('div');
        opt.className = `color-option ${index === 0 ? 'active' : ''}`;
        opt.style.backgroundColor = color.main;
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('active'));
            opt.classList.add('active');
            state.selectedColorIdx = index;
        });
        container.appendChild(opt);
    });
})();

document.getElementById('best-score-text').innerText = `Recorde: ${localStorage.getItem('snakeBest') || '0.00'}%`;
document.getElementById('last-score-text').innerText = `Último: ${localStorage.getItem('snakeLast') || '0.00'}%`;
