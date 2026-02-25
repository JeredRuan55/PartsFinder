const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const mCtx = minimapCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const invEl = document.getElementById('inventory-status');
const promptEl = document.getElementById('interaction-prompt');

// Game Config
const WORLD_SIZE = 3000;
const PART_COUNT = 5;
const PLAYER_SPEED = 5;
const WORKSHOP_REGION = { x: WORLD_SIZE - 200, y: WORLD_SIZE - 200, size: 200 };

// Player State
const player = {
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,
    size: 20,
    color: '#00f2ff',
    inventory: null,
    partsFound: 0
};

// Map Items
let parts = [];
const partTypes = ['Motor', 'Roda FL', 'Roda FR', 'Roda TR', 'Roda TL'];
const partClasses = ['engine', 'wheel-fl', 'wheel-fr', 'wheel-bl', 'wheel-br'];

// Inputs
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function init() {
    // Generate parts at random locations
    for (let i = 0; i < PART_COUNT; i++) {
        parts.push({
            id: i,
            name: partTypes[i],
            class: partClasses[i],
            x: Math.random() * (WORLD_SIZE - 100) + 50,
            y: Math.random() * (WORLD_SIZE - 100) + 50,
            collected: false,
            installed: false,
            size: 15
        });
    }
    
    resize();
    requestAnimationFrame(update);
}

function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);

function update() {
    // Movement logic
    if (keys['w'] || keys['arrowup']) player.y -= PLAYER_SPEED;
    if (keys['s'] || keys['arrowdown']) player.y += PLAYER_SPEED;
    if (keys['a'] || keys['arrowleft']) player.x -= PLAYER_SPEED;
    if (keys['d'] || keys['arrowright']) player.x += PLAYER_SPEED;

    // Boundaries
    player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
    player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));

    // Interaction Check
    let nearPart = null;
    parts.forEach(part => {
        if (!part.collected && !part.installed) {
            const dist = Math.hypot(player.x - part.x, player.y - part.y);
            if (dist < 40) nearPart = part;
        }
    });

    if (nearPart) {
        promptEl.classList.remove('hidden');
        if (keys['e']) {
            if (!player.inventory) {
                nearPart.collected = true;
                player.inventory = nearPart;
                invEl.innerText = nearPart.name;
                invEl.style.color = '#ff0055';
            } else {
                // Already carrying something
                alert("Você só pode carregar uma peça por vez!");
                keys['e'] = false; // Reset to avoid spam
            }
        }
    } else {
        promptEl.classList.add('hidden');
    }

    // Workshop delivery check
    if (player.inventory) {
        const distToWorkshop = Math.hypot(player.x - (WORKSHOP_REGION.x + 100), player.y - (WORKSHOP_REGION.y + 100));
        if (distToWorkshop < 120) {
            // Install part
            player.inventory.installed = true;
            document.querySelector(`.part.${player.inventory.class}`).classList.add('found');
            
            player.inventory = null;
            player.partsFound++;
            
            invEl.innerText = 'Vazio';
            invEl.style.color = '#00f2ff';
            scoreEl.innerText = `${player.partsFound}/5`;

            if (player.partsFound === 5) {
                setTimeout(() => alert("PARABÉNS! Veículo Restaurado!"), 500);
            }
        }
    }

    draw();
    drawMinimap();
    requestAnimationFrame(update);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid/floor relative to camera
    const camX = player.x - canvas.width / 2;
    const camY = player.y - canvas.height / 2;

    ctx.save();
    ctx.translate(-camX, -camY);

    // World Floor Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    const gridSize = 100;
    for (let i = 0; i <= WORLD_SIZE; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, WORLD_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(WORLD_SIZE, i); ctx.stroke();
    }

    // Workshop Area
    ctx.fillStyle = 'rgba(112, 0, 255, 0.2)';
    ctx.fillRect(WORKSHOP_REGION.x, WORKSHOP_REGION.y, WORKSHOP_REGION.size, WORKSHOP_REGION.size);
    ctx.strokeStyle = '#7000ff';
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(WORKSHOP_REGION.x, WORKSHOP_REGION.y, WORKSHOP_REGION.size, WORKSHOP_REGION.size);
    ctx.setLineDash([]);
    ctx.fillStyle = '#7000ff';
    ctx.font = '20px Outfit';
    ctx.fillText("OFICINA", WORKSHOP_REGION.x + 60, WORKSHOP_REGION.y + 110);

    // Parts
    parts.forEach(part => {
        if (!part.collected && !part.installed) {
            ctx.fillStyle = '#ff0055';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff0055';
            ctx.beginPath();
            ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Floating label
            ctx.fillStyle = '#fff';
            ctx.font = '12px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(part.name, part.x, part.y - 25);
        }
    });

    // Player
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = player.color;
    // Simple car shape
    ctx.fillRect(player.x - 10, player.y - 15, 20, 30);
    // Headlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x - 8, player.y - 18, 5, 5);
    ctx.fillRect(player.x + 3, player.y - 18, 5, 5);
    ctx.shadowBlur = 0;

    ctx.restore();
}

function drawMinimap() {
    mCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const scale = minimapCanvas.width / WORLD_SIZE;

    // Workshop
    mCtx.fillStyle = '#7000ff';
    mCtx.fillRect(WORKSHOP_REGION.x * scale, WORKSHOP_REGION.y * scale, WORKSHOP_REGION.size * scale, WORKSHOP_REGION.size * scale);

    // Parts (Only if not collected)
    parts.forEach(part => {
        if (!part.collected && !part.installed) {
            mCtx.fillStyle = '#ff0055';
            mCtx.beginPath();
            mCtx.arc(part.x * scale, part.y * scale, 3, 0, Math.PI * 2);
            mCtx.fill();
        }
    });

    // Player
    mCtx.fillStyle = '#fff';
    mCtx.beginPath();
    mCtx.arc(player.x * scale, player.y * scale, 4, 0, Math.PI * 2);
    mCtx.fill();
}

init();
