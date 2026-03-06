/**
 * 🐍 Snake Domain .io - Prototype (Vanilla JS Antigravity)
 */

// Configurações do Jogo
const CONFIG = {
    WORLD_WIDTH: 4000,
    WORLD_HEIGHT: 4000,
    TILE_SIZE: 40,
    FPS: 60,
    BASE_SPEED: 4, // 240 pixels/sec
    SNAKE_LENGTH: 30, // Quantidade de segmentos no corpo
    SNAKE_RADIUS: 14,
    COLORS: [
        '#00ffcc', // Player
        '#ff3366', // Bot 1
        '#ffcc00', // Bot 2
        '#cc33ff', // Bot 3
        '#3399ff'  // Bot 4
    ]
};

const COLS = Math.floor(CONFIG.WORLD_WIDTH / CONFIG.TILE_SIZE);
const ROWS = Math.floor(CONFIG.WORLD_HEIGHT / CONFIG.TILE_SIZE);

// Estado Global
const state = {
    grid: new Array(COLS).fill(0).map(() => new Array(ROWS).fill(-1)), // -1 = vazio
    players: [],
    camera: { x: 0, y: 0 },
    keys: { u: false, d: false, l: false, r: false, usingKeyboard: false },
    mouse: { x: 0, y: 0 },
    gameOver: false,
    isPaused: false,
    currentScorePercent: 0
};

// Referências HTML
const canvases = {
    bg: document.getElementById('bg-layer'),
    trail: document.getElementById('trail-layer'),
    entity: document.getElementById('entity-layer'),
    minimap: document.getElementById('minimap-layer')
};
const ctx = {
    bg: canvases.bg.getContext('2d'),
    trail: canvases.trail.getContext('2d'),
    entity: canvases.entity.getContext('2d'),
    minimap: canvases.minimap.getContext('2d')
};

// Resize Handling
function resize() {
    [canvases.bg, canvases.trail, canvases.entity].forEach(canvas => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    canvases.minimap.width = 200;
    canvases.minimap.height = 200;
    // Otimização: Não redesenhamos o BG a cada frame, apenas quando a câmera move,
    // mas na nossa arquitetura vamos redesenhar tudo com base na posição da câmera por frame no RequestAnimationFrame.
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
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === 'W') state.keys.u = true;
    if (e.key === 's' || e.key === 'ArrowDown' || e.key === 'S') state.keys.d = true;
    if (e.key === 'a' || e.key === 'ArrowLeft' || e.key === 'A') state.keys.l = true;
    if (e.key === 'd' || e.key === 'ArrowRight' || e.key === 'D') state.keys.r = true;

    if (['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        state.keys.usingKeyboard = true;
    }

    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !state.gameOver) {
        state.isPaused = !state.isPaused;
        const pauseScreen = document.getElementById('pause-screen');
        if (state.isPaused) {
            pauseScreen.classList.remove('hidden');
        } else {
            pauseScreen.classList.add('hidden');
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === 'W') state.keys.u = false;
    if (e.key === 's' || e.key === 'ArrowDown' || e.key === 'S') state.keys.d = false;
    if (e.key === 'a' || e.key === 'ArrowLeft' || e.key === 'A') state.keys.l = false;
    if (e.key === 'd' || e.key === 'ArrowRight' || e.key === 'D') state.keys.r = false;
});

// Classe Player (Cobra)
class Player {
    constructor(id, x, y, colorId, isBot = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.colorId = colorId % CONFIG.COLORS.length;
        this.color = CONFIG.COLORS[this.colorId];
        this.isBot = isBot;
        
        this.angle = 0;
        this.speed = CONFIG.BASE_SPEED;
        this.alive = true;
        
        // Corpo e rastro
        this.body = []; // Histórico de posições exatas para formar o "corpo" Slither
        this.trail = []; // Posições (gx, gy) de blocos no rastro ativo
        this.trailSet = new Set(); // Para busca rápida O(1) do rastro

        // Setup Inicial
        this.initBase();
    }

    initBase() {
        const gx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const gy = Math.floor(this.y / CONFIG.TILE_SIZE);
        // Cria 3x3 base
        for (let ix = -1; ix <= 1; ix++) {
            for (let iy = -1; iy <= 1; iy++) {
                if (gx + ix >= 0 && gx + ix < COLS && gy + iy >= 0 && gy + iy < ROWS) {
                    state.grid[gx + ix][gy + iy] = this.id;
                }
            }
        }
        
        // Ponto âncora para a IA saber qual seu último lugar seguro ao sair
        this.baseX = this.x;
        this.baseY = this.y;
    }

    update() {
        if (!this.alive) return;

        // Bônus de Zona (Home Turf)
        const currentGx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const currentGy = Math.floor(this.y / CONFIG.TILE_SIZE);

        let isInOwnTerritory = false;
        if (currentGx >= 0 && currentGx < COLS && currentGy >= 0 && currentGy < ROWS) {
            isInOwnTerritory = (state.grid[currentGx][currentGy] === this.id);
        }

        // Armazena a âncora da base no exato momento antes do Bot sair pro desconhecido para saber como voltar
        if (isInOwnTerritory) {
            this.baseX = this.x;
            this.baseY = this.y;
        }

        // Speed boost no próprio território (+25%) e lentidão em território inimigo
        let currentSpeed = this.speed;
        if (isInOwnTerritory) {
            currentSpeed *= 1.25;
        } else {
            let tileOwner = state.grid[currentGx] && state.grid[currentGx][currentGy];
            if (tileOwner !== undefined && tileOwner !== -1 && tileOwner !== this.id) {
                currentSpeed *= 0.70; // Lentidão
            }
        }

        // Movimento (Bot vs Player)
        if (this.isBot) {
            this.botAI();
        } else {
            // Player Angle baseado no teclado ou mouse
            let targetAngle;
            
            if (state.keys.usingKeyboard && (state.keys.u || state.keys.d || state.keys.l || state.keys.r)) {
                let dx = 0;
                let dy = 0;
                if (state.keys.u) dy -= 1;
                if (state.keys.d) dy += 1;
                if (state.keys.l) dx -= 1;
                if (state.keys.r) dx += 1;
                
                targetAngle = Math.atan2(dy, dx);
            } else {
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const dx = state.mouse.x - centerX;
                const dy = state.mouse.y - centerY;
                if (Math.hypot(dx, dy) > 10) {
                    targetAngle = Math.atan2(dy, dx);
                }
            }

            if (targetAngle !== undefined) {
                this.angle = this.lerpAngle(this.angle, targetAngle, 0.15);
            }
        }

        // Guardar posição antiga no histórico do corpo
        this.body.push({ x: this.x, y: this.y });
        // Manter tamanho ajustado com folga por causa da velocidade
        // Se pegamos 1 body pt por frame e vamos a speed, a cada 1 frame avançamos `currentSpeed` px.
        const bodyMaxFrames = Math.floor((CONFIG.SNAKE_LENGTH * CONFIG.SNAKE_RADIUS * 2) / currentSpeed);
        if (this.body.length > bodyMaxFrames) {
            this.body.shift();
        }

        // Atualizar Posição
        const nextX = this.x + Math.cos(this.angle) * currentSpeed;
        const nextY = this.y + Math.sin(this.angle) * currentSpeed;
        
        // Borda do mapa (Wrap ao redor ou Morte? Vamos fazer bloquear movimento)
        if (nextX > 0 && nextX < CONFIG.WORLD_WIDTH) this.x = nextX;
        if (nextY > 0 && nextY < CONFIG.WORLD_HEIGHT) this.y = nextY;

        this.checkTrailLogic();
    }

    botAI() {
        if (this.botTurnDecay === undefined) {
             this.botTargetAngle = this.angle;
             this.botTurnDecay = 0;
             this.botMaxTrail = 15 + Math.random() * 45; // Cada bot tem uma ambição diferente (quantos blocos arrisca antes de voltar)
        }

        const margin = CONFIG.TILE_SIZE * 3;
        let forceAngle = null;

        // 1. Prioridade Extrema: Evitar Borda do Mapa
        if (this.x < margin) forceAngle = 0;
        else if (this.x > CONFIG.WORLD_WIDTH - margin) forceAngle = Math.PI;
        else if (this.y < margin) forceAngle = Math.PI / 2;
        else if (this.y > CONFIG.WORLD_HEIGHT - margin) forceAngle = -Math.PI / 2;

        if (forceAngle !== null) {
            this.angle = this.lerpAngle(this.angle, forceAngle, 0.2);
            return;
        }

        const currentGx = Math.floor(this.x / CONFIG.TILE_SIZE);
        const currentGy = Math.floor(this.y / CONFIG.TILE_SIZE);
        const inOwnTerritory = (state.grid[currentGx] && state.grid[currentGx][currentGy] === this.id);

        let targetAngle = this.botTargetAngle;

        // 2. Visão Geopolítica: Cuidar de inimigos e presas
        let enemyNear = false;
        let enemyTrailDest = null;
        
        for (let p of state.players) {
             if (p.id !== this.id && p.alive) {
                  // Inimigo perto botando pressão?
                  let dist = Math.hypot(p.x - this.x, p.y - this.y);
                  if (dist < 400) {
                      enemyNear = true;
                  }
                  // Rastro exposto perto para atacar? (Aproveitar oportunidade)
                  if (!inOwnTerritory && p.trail.length > 0) {
                      for (let t of p.trail) {
                          let tx = t.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
                          let ty = t.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
                          let tDist = Math.hypot(tx - this.x, ty - this.y);
                          if (tDist < 250) {
                              enemyTrailDest = { x: tx, y: ty };
                              break;
                          }
                      }
                  }
             }
        }

        // 3. Tomada de Decisão (FSM)
        if (inOwnTerritory) {
             // Estado: SEGURO (Procurar expansão)
             this.botMaxTrail = 15 + Math.random() * 45; // Sorteia nova coragem pro próximo rastro
             
             this.botTurnDecay--;
             if (this.botTurnDecay <= 0) {
                 targetAngle = this.angle + (Math.random() - 0.5) * 1.5;
                 this.botTurnDecay = 20 + Math.random() * 40;
             }
        } else {
             // Estado: FORA DE CASA (Risco de vida)
             let danger = enemyNear || (this.trail.length > this.botMaxTrail);
             
             if (danger) {
                 // Modo Fuga/Volta Rápida: mira no ponto `baseXY` seguro gravado ao sair
                 if (this.baseX !== undefined) {
                     targetAngle = Math.atan2(this.baseY - this.y, this.baseX - this.x);
                 }
             } else if (enemyTrailDest) {
                 // Modo Assassino: Cortar Trilha Inimiga!
                 targetAngle = Math.atan2(enemyTrailDest.y - this.y, enemyTrailDest.x - this.x);
             } else {
                 // Modo Expandindo Normal: Faz arcos contínuos
                 this.botTurnDecay--;
                 if (this.botTurnDecay <= 0) {
                     // Ajusta a curva ligeiramente
                     targetAngle = this.angle + (Math.random() > 0.5 ? 0.6 : -0.6);
                     this.botTurnDecay = 15 + Math.random() * 20;
                 }
             }

             // Anti-Suicídio: Prevenir bater no próprio rastro ativo nas curvas
             const nextAngleX = this.x + Math.cos(targetAngle) * 100;
             const nextAngleY = this.y + Math.sin(targetAngle) * 100;
             const nextGx = Math.floor(nextAngleX / CONFIG.TILE_SIZE);
             const nextGy = Math.floor(nextAngleY / CONFIG.TILE_SIZE);
             if (this.trailSet.has(`${nextGx},${nextGy}`)) {
                 targetAngle += Math.PI / 1.5; // Desvia bruscamente do próprio rastro
             }
        }

        // Aplica o ângulo de target na variável da classe e usa o giro Lerp parecido com o Slither
        this.botTargetAngle = targetAngle;
        this.angle = this.lerpAngle(this.angle, this.botTargetAngle, 0.08);
    }

    // Função utilitária para girar no menor arco de círculo
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
        const tileKey = `${gx},${gy}`;

        if (tileId === this.id) {
            // Voltou pro território seguro!
            if (this.trail.length > 0) {
                this.closePolygon();
            }
        } else {
            // Está fora do território próprio
            // 1. Testa suicídio no próprio rastro ativo (se bateu e não é a ponta super recente)
            if (this.trailSet.has(tileKey)) {
                // Checa para não morrer instantâneo nas curvas
                const index = this.trail.findIndex(t => t.x === gx && t.y === gy);
                if (index < this.trail.length - 3) {
                    this.die("Você cruzou seu próprio rastro!");
                    return;
                }
            }

            // 2. Continua adicionando ao rastro
            if (!this.trailSet.has(tileKey)) {
                this.trail.push({ x: gx, y: gy });
                this.trailSet.add(tileKey);
            }
        }
    }

    closePolygon() {
        // O(N) flood fill para capturar território
        const walls = new Set();
        
        // Consider walls = player territory + player trail
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (state.grid[x][y] === this.id) {
                    walls.add(`${x},${y}`);
                }
            }
        }
        for (let t of this.trail) {
            walls.add(`${t.x},${t.y}`);
        }

        // BFS outside walls starting from a bounding box slightly outside the grid
        const visited = new Set();
        const queue = [];

        // Adiciona a borda externa virtual ao BFS
        for (let x = -1; x <= COLS; x++) {
            queue.push({x: x, y: -1});
            queue.push({x: x, y: ROWS});
        }
        for (let y = 0; y < ROWS; y++) {
            queue.push({x: -1, y: y});
            queue.push({x: COLS, y: y});
        }

        for (let cell of queue) {
            visited.add(`${cell.x},${cell.y}`);
        }

        // Direções de Flood (4 ways)
        const dirs = [[0,1], [1,0], [0,-1], [-1,0]];

        let i = 0;
        while(i < queue.length) {
            const curr = queue[i++];
            
            for (let d of dirs) {
                const nx = curr.x + d[0];
                const ny = curr.y + d[1];
                
                if (nx < -1 || nx > COLS || ny < -1 || ny > ROWS) continue;

                const nKey = `${nx},${ny}`;
                if (visited.has(nKey) || walls.has(nKey)) continue;

                visited.add(nKey);
                queue.push({x: nx, y: ny});
            }
        }

        // Tudo que está no GRID e NÃO foi visitado, + o rastro, vira do jogador
        let blocksGained = 0;
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                const key = `${x},${y}`;
                if (!visited.has(key)) {
                    state.grid[x][y] = this.id;
                    blocksGained++;
                }
            }
        }

        // Limpar rastro
        this.trail = [];
        this.trailSet.clear();
        
        // Atualizar pontuação (para simplificar, no game loop calculamos os %)
    }

    die(reason) {
        if (!this.alive) return;
        this.alive = false;
        
        // Remove territórios
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                if (state.grid[x][y] === this.id) {
                    state.grid[x][y] = -1; // Vira neutro
                }
            }
        }
        this.trail = [];
        this.trailSet.clear();

        if (!this.isBot) {
            state.gameOver = true;
            document.getElementById('death-reason').innerText = reason;
            document.getElementById('final-score').innerText = `Sua pontuação final: ${state.currentScorePercent}%`;
            
            // Salvar no LocalStorage
            localStorage.setItem('snakeDomain_lastScore', state.currentScorePercent);
            let bestScore = parseFloat(localStorage.getItem('snakeDomain_bestScore')) || 0;
            if (parseFloat(state.currentScorePercent) > bestScore) {
                localStorage.setItem('snakeDomain_bestScore', state.currentScorePercent);
            }

            document.getElementById('game-over-screen').classList.remove('hidden');
        } else {
            // Respawn Bot
            setTimeout(() => {
                this.x = Math.random() * CONFIG.WORLD_WIDTH;
                this.y = Math.random() * CONFIG.WORLD_HEIGHT;
                this.initBase();
                this.alive = true;
            }, 3000);
        }
    }
}

// Lógica de colisão Slither + Corte de Rastro
function checkCollisions() {
    for (let u = 0; u < state.players.length; u++) {
        let p1 = state.players[u];
        if (!p1.alive) continue;

        const p1Head = { x: p1.x, y: p1.y };

        for (let v = 0; v < state.players.length; v++) {
            let p2 = state.players[v];
            if (p1.id === p2.id || !p2.alive) continue;

            // 1. Corte de Rastro (p1 bate na trail de p2)
            const gx = Math.floor(p1.x / CONFIG.TILE_SIZE);
            const gy = Math.floor(p1.y / CONFIG.TILE_SIZE);
            if (p2.trailSet.has(`${gx},${gy}`)) {
                p2.die(`Sua linha vital foi cortada por ${p1.isBot ? 'um bot' : 'outro jogador'}!`);
            }

            // 2. Bater a cabeça no corpo (Slither.io)
            for (let b of p2.body) {
                const dist = Math.hypot(p1Head.x - b.x, p1Head.y - b.y);
                if (dist < CONFIG.SNAKE_RADIUS * 2) {
                    p1.die(`Você colidiu com outro jogador!`);
                    break;
                }
            }
        }
    }
}

// SETUP DO JOGO
function initGame() {
    state.players = [];
    state.gameOver = false;
    state.isPaused = false;
    state.currentScorePercent = 0;
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    
    // Carregar Scores salvos
    let bestScore = localStorage.getItem('snakeDomain_bestScore') || '0.00';
    let lastScore = localStorage.getItem('snakeDomain_lastScore') || '0.00';
    document.getElementById('best-score-text').innerText = `Recorde: ${bestScore}%`;
    document.getElementById('last-score-text').innerText = `Último: ${lastScore}%`;
    
    // Limpar o grid
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            state.grid[x][y] = -1;
        }
    }

    // Criar Player na posição central aproximada
    state.players.push(new Player(0, CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT / 2, 0, false));

    // Criar Bots espalhados
    for (let i = 1; i <= 4; i++) {
        const bx = Math.random() * (CONFIG.WORLD_WIDTH - 200) + 100;
        const by = Math.random() * (CONFIG.WORLD_HEIGHT - 200) + 100;
        state.players.push(new Player(i, bx, by, i, true));
    }

    window.requestAnimationFrame(gameLoop);
}

// Botão Respawn
document.getElementById('respawn-btn').addEventListener('click', () => {
    initGame();
});

// Botão Pause Continuar
document.getElementById('resume-btn').addEventListener('click', () => {
    state.isPaused = false;
    document.getElementById('pause-screen').classList.add('hidden');
});

// DESENHO - RENDERIZAÇÃO
function drawGrid(cx, cy) {
    const ctxBg = ctx.bg;
    ctxBg.fillStyle = '#111';
    ctxBg.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Desenhar mundo
    ctxBg.save();
    ctxBg.translate(-cx, -cy);

    // Borda do mundo
    ctxBg.strokeStyle = '#333';
    ctxBg.lineWidth = 4;
    ctxBg.strokeRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);

    // Blocos territoriais
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            const ownerId = state.grid[x][y];
            if (ownerId !== -1) {
                // Desenhar
                ctxBg.fillStyle = CONFIG.COLORS[ownerId % CONFIG.COLORS.length];
                ctxBg.globalAlpha = 0.3; // Translúcido
                ctxBg.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                ctxBg.globalAlpha = 1.0;
                
                // Opção p/ contorno leve:
                ctxBg.strokeStyle = 'rgba(255,255,255,0.05)';
                ctxBg.lineWidth = 1;
                ctxBg.strokeRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
            }
        }
    }
    
    ctxBg.restore();
}

function drawTrails(cx, cy) {
    const ctxT = ctx.trail;
    ctxT.clearRect(0, 0, window.innerWidth, window.innerHeight);
    
    ctxT.save();
    ctxT.translate(-cx, -cy);

    state.players.forEach(p => {
        if (!p.alive || p.trail.length === 0) return;

        ctxT.fillStyle = p.color;
        ctxT.globalAlpha = 0.5;
        p.trail.forEach(t => {
            ctxT.fillRect(t.x * CONFIG.TILE_SIZE, t.y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        });
        
        // Fio de luz do rastro
        ctxT.globalAlpha = 1.0;
        ctxT.beginPath();
        ctxT.strokeStyle = p.color;
        ctxT.lineWidth = 4;
        ctxT.lineCap = 'round';
        ctxT.lineJoin = 'round';
        
        const first = p.trail[0];
        ctxT.moveTo(first.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2, first.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2);
        
        for (let i = 1; i < p.trail.length; i++) {
            ctxT.lineTo(p.trail[i].x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2, p.trail[i].y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2);
        }
        ctxT.lineTo(p.x, p.y); // Ligar à cabeça
        ctxT.stroke();
    });

    ctxT.restore();
}

function drawEntities(cx, cy) {
    const ctxE = ctx.entity;
    ctxE.clearRect(0, 0, window.innerWidth, window.innerHeight);
    
    ctxE.save();
    ctxE.translate(-cx, -cy);

    state.players.forEach(p => {
        if (!p.alive) return;

        // Desenhar Corpo (estilo Slither)
        for (let i = 0; i < p.body.length; i += 3) { // pule pontos p/ rendimento e espaçamento visual
            const b = p.body[i];
            const sizeProgress = i / p.body.length; // 0 = ponta da cauda, 1 = pescoço
            const rad = CONFIG.SNAKE_RADIUS * (0.5 + 0.5 * sizeProgress);
            
            ctxE.beginPath();
            ctxE.fillStyle = p.color;
            ctxE.globalAlpha = Math.max(0.2, sizeProgress);
            ctxE.arc(b.x, b.y, rad, 0, Math.PI * 2);
            ctxE.fill();
        }

        // Desenhar Cabeça
        ctxE.globalAlpha = 1.0;
        ctxE.beginPath();
        ctxE.fillStyle = '#fff';
        ctxE.arc(p.x, p.y, CONFIG.SNAKE_RADIUS * 1.2, 0, Math.PI * 2);
        ctxE.fill();
        
        ctxE.beginPath();
        ctxE.fillStyle = p.color;
        ctxE.arc(p.x, p.y, CONFIG.SNAKE_RADIUS, 0, Math.PI * 2);
        ctxE.fill();

        // Olhinhos baseados na direção
        const eyeDx = Math.cos(p.angle);
        const eyeDy = Math.sin(p.angle);
        const eX = Math.cos(p.angle + Math.PI/2);
        const eY = Math.sin(p.angle + Math.PI/2);
        
        ctxE.fillStyle = '#111';
        ctxE.beginPath();
        ctxE.arc(p.x + eyeDx*6 + eX*5, p.y + eyeDy*6 + eY*5, 3, 0, Math.PI*2);
        ctxE.fill();
        ctxE.beginPath();
        ctxE.arc(p.x + eyeDx*6 - eX*5, p.y + eyeDy*6 - eY*5, 3, 0, Math.PI*2);
        ctxE.fill();

        // Tag do nome
        ctxE.fillStyle = 'rgba(255,255,255,0.7)';
        ctxE.font = '12px Arial';
        ctxE.textAlign = 'center';
        ctxE.fillText(p.isBot ? `Bot ${p.id}` : 'Você', p.x, p.y - 20);

        // Indicador de Direção (apenas para o Player local)
        if (!p.isBot) {
            ctxE.beginPath();
            ctxE.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctxE.lineWidth = 2;
            ctxE.setLineDash([5, 5]);
            ctxE.moveTo(p.x + eyeDx * CONFIG.SNAKE_RADIUS * 1.5, p.y + eyeDy * CONFIG.SNAKE_RADIUS * 1.5);
            ctxE.lineTo(p.x + eyeDx * CONFIG.SNAKE_RADIUS * 4, p.y + eyeDy * CONFIG.SNAKE_RADIUS * 4);
            ctxE.stroke();
            ctxE.setLineDash([]);
            
            // Setinha na ponta do indicador
            ctxE.beginPath();
            ctxE.fillStyle = 'rgba(255, 255, 255, 0.6)';
            let arrowX = p.x + eyeDx * CONFIG.SNAKE_RADIUS * 4.5;
            let arrowY = p.y + eyeDy * CONFIG.SNAKE_RADIUS * 4.5;
            ctxE.moveTo(arrowX, arrowY);
            ctxE.lineTo(arrowX - Math.cos(p.angle - 0.5) * 8, arrowY - Math.sin(p.angle - 0.5) * 8);
            ctxE.lineTo(arrowX - Math.cos(p.angle + 0.5) * 8, arrowY - Math.sin(p.angle + 0.5) * 8);
            ctxE.fill();
        }
    });

    ctxE.restore();
}

function drawMinimap() {
    const ctxM = ctx.minimap;
    const w = canvases.minimap.width;
    const h = canvases.minimap.height;
    
    ctxM.clearRect(0, 0, w, h);
    
    // Calcular tamanho de cada bloco no minimapa
    const scaleX = w / COLS;
    const scaleY = h / ROWS;

    // Desenhar Grid de territórios de forma muito otimizada e simplificada
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            const ownerId = state.grid[x][y];
            if (ownerId !== -1) {
                ctxM.fillStyle = CONFIG.COLORS[ownerId % CONFIG.COLORS.length];
                ctxM.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
            }
        }
    }

    // Desenhar a posição do jogador como um ponto branco
    const player = state.players[0];
    if (player && player.alive) {
        const px = (player.x / CONFIG.WORLD_WIDTH) * w;
        const py = (player.y / CONFIG.WORLD_HEIGHT) * h;
        
        ctxM.fillStyle = '#ffffff';
        ctxM.beginPath();
        ctxM.arc(px, py, 3, 0, Math.PI * 2);
        ctxM.fill();
        
        // Bordar o ponto
        ctxM.lineWidth = 1;
        ctxM.strokeStyle = '#000000';
        ctxM.stroke();
    }
}

// UI Update
function updateUI() {
    // Calculo do ranking
    const counts = {};
    state.players.forEach(p => counts[p.id] = 0);
    
    let totalBlocks = COLS * ROWS;

    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            const id = state.grid[x][y];
            if (id !== -1 && counts[id] !== undefined) {
                counts[id]++;
            }
        }
    }

    // Leaderboard Sort
    const sorted = Object.keys(counts).map(id => ({
        id: parseInt(id),
        score: counts[id],
        isPlayer: parseInt(id) === 0
    })).sort((a,b) => b.score - a.score);

    const listHtml = sorted.slice(0, 5).map(s => {
        let name = s.isPlayer ? 'Você' : `Bot ${s.id}`;
        let percent = ((s.score / totalBlocks) * 100).toFixed(2);
        return `<li><span style="color:${CONFIG.COLORS[s.id % CONFIG.COLORS.length]}">■</span> ${name}: ${percent}%</li>`;
    }).join('');
    
    document.getElementById('leaderboard-list').innerHTML = listHtml;

    // Score Text do Player
    if (state.players[0] && state.players[0].alive) {
        let pPercent = ((counts[0] / totalBlocks) * 100).toFixed(2);
        state.currentScorePercent = pPercent;
        document.getElementById('score-text').innerText = `Território: ${pPercent}%`;
        
        // Bater recorde em tempo real
        let bestScore = parseFloat(localStorage.getItem('snakeDomain_bestScore')) || 0;
        if (parseFloat(pPercent) > bestScore) {
            document.getElementById('best-score-text').innerText = `Recorde: ${pPercent}% 🏆`;
            document.getElementById('best-score-text').style.color = '#ffcc00';
        } else {
             document.getElementById('best-score-text').style.color = '#ccc';
        }
    }
}

// LOOP PRINCIPAL
function gameLoop() {
    if (state.gameOver) return;

    if (!state.isPaused) {
        // Atualização
        state.players.forEach(p => p.update());
        checkCollisions();
    }

    let player = state.players[0];
    
    // Câmera segue o jogador
    if (player && player.alive) {
        state.camera.x = player.x - window.innerWidth / 2;
        state.camera.y = player.y - window.innerHeight / 2;
    }

    // Desenho
    drawGrid(state.camera.x, state.camera.y);
    drawTrails(state.camera.x, state.camera.y);
    drawEntities(state.camera.x, state.camera.y);
    drawMinimap();
    updateUI();

    window.requestAnimationFrame(gameLoop);
}

// Start
initGame();
