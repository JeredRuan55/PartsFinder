const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gameContainer = document.getElementById('game-container');
const scoreDisplay = document.getElementById('score-display');
const gameOverScreen = document.getElementById('game-over-screen');
const startScreen = document.getElementById('start-screen');
const finalScoreSpan = document.getElementById('final-score');
const bestScoreSpan = document.getElementById('best-score');
const restartBtn = document.getElementById('restart-btn');

function resizeCanvas() {
    canvas.width = gameContainer.clientWidth;
    canvas.height = gameContainer.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const BIRD_COLOR = '#ffda44';
const PIPE_COLOR_FRONT = '#52c712';
const PIPE_COLOR_SIDE = '#389a07';
const GROUND_COLOR = '#ded895';

// Physics & Defaults
const GRAVITY = 0.5;
const JUMP_IMPULSE = -8;
const INITIAL_BIRD_Y = canvas.height / 2;
const BASE_SPEED = 3.5;

let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('skyDashBestScore') || 0;
let gameState = 'START'; 
let currentSpeed = BASE_SPEED;
let bgOffset = 0;

let particles = [];

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.size = Math.random() * 4 + 2;
        this.life = 1;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = `rgba(255, 255, 255, ${this.life})`;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.color = `rgba(255, 255, 255, ${this.life})`;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

const bird = {
    x: canvas.width * 0.2, // stay on the left quarter
    y: INITIAL_BIRD_Y,
    width: 36,
    height: 26,
    velocity: 0,
    rotation: 0,
    
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        ctx.rotate(this.rotation);
        
        ctx.fillStyle = BIRD_COLOR;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.stroke();
        
        // Eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(8, -6, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(11, -6, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Wing
        ctx.fillStyle = 'white';
        ctx.beginPath();
        // Flap animation based on velocity
        let wingY = this.velocity < 0 ? -2 : 4; 
        ctx.ellipse(-6, wingY, 9, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Beak
        ctx.fillStyle = '#f35b23';
        ctx.beginPath();
        ctx.moveTo(10, 2);
        ctx.lineTo(24, 6);
        ctx.lineTo(10, 10);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    },
    
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;
        
        // Floor collision
        if (this.y + this.height >= ground.y) {
            this.y = ground.y - this.height;
            triggerGameOver();
        }
        
        // Ceiling collision
        if (this.y <= 0) {
            this.y = 0;
            this.velocity = 0;
        }
    },
    
    flap() {
        this.velocity = JUMP_IMPULSE;
        
        // Spawn juice particles
        for (let i = 0; i < 8; i++) {
            particles.push(new Particle(this.x + 10, this.y + this.height));
        }
    },
    
    getHitbox() {
        // "Quase-Colisão": Hitbox menor que o desenho
        return {
            x: this.x + 6,
            y: this.y + 6,
            width: this.width - 12,
            height: this.height - 12
        };
    }
};

const pipes = {
    items: [],
    width: 70,
    gap: 160,
    
    draw() {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            
            // Draw Main Trunk
            ctx.fillStyle = PIPE_COLOR_FRONT;
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            
            // Top Pipe Trunk
            ctx.fillRect(p.x, 0, this.width, p.top);
            ctx.strokeRect(p.x, 0, this.width, p.top);
            
            // Bottom Pipe Trunk
            let bottomY = p.top + p.gap;
            ctx.fillRect(p.x, bottomY, this.width, canvas.height - bottomY);
            ctx.strokeRect(p.x, bottomY, this.width, canvas.height - bottomY);

            // Shading
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(p.x + this.width - 15, 0, 15, p.top);
            ctx.fillRect(p.x + this.width - 15, bottomY, 15, canvas.height - bottomY);

            // Caps
            ctx.fillStyle = PIPE_COLOR_FRONT;
            ctx.fillRect(p.x - 4, p.top - 24, this.width + 8, 24);
            ctx.strokeRect(p.x - 4, p.top - 24, this.width + 8, 24);
            
            ctx.fillRect(p.x - 4, bottomY, this.width + 8, 24);
            ctx.strokeRect(p.x - 4, bottomY, this.width + 8, 24);
        }
    },
    
    update() {
        // Dynamic spawn rate based on speed
        let spawnRate = Math.max(60, Math.floor(100 - (currentSpeed - BASE_SPEED)*10));

        if (frames % spawnRate === 0) {
            // Difficulty scaling - narrowing gaps
            let minGap = 100; // Minimum gap allowance
            let currentGap = Math.max(minGap, this.gap - Math.floor(score * 1.5));
            
            let minTop = 50;
            let maxTop = canvas.height - ground.height - currentGap - 50;
            let topPosition = Math.floor(Math.random() * (maxTop - minTop + 1) + minTop);
            
            this.items.push({
                x: canvas.width,
                top: topPosition,
                gap: currentGap,
                passed: false
            });
        }
        
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            p.x -= currentSpeed;
            
            let bBox = bird.getHitbox();
            
            let topPipeRect = {x: p.x, y: 0, width: this.width, height: p.top};
            let bottomPipeRect = {x: p.x, y: p.top + p.gap, width: this.width, height: canvas.height - (p.top + p.gap)};
            
            if (checkCollision(bBox, topPipeRect) || checkCollision(bBox, bottomPipeRect)) {
                triggerGameOver();
            }
            
            if (p.x + this.width < bird.x && !p.passed) {
                score++;
                p.passed = true;
                scoreDisplay.innerText = score;
                
                // Add pop effect to score
                scoreDisplay.style.transform = 'scale(1.3)';
                setTimeout(() => scoreDisplay.style.transform = 'scale(1)', 100);

                // Progress speed
                if (score % 5 === 0) {
                    currentSpeed += 0.3;
                }
            }
            
            if (p.x + this.width < -10) {
                this.items.shift();
                i--;
            }
        }
    },
    
    reset() {
        this.items = [];
    }
}

const ground = {
    height: 80,
    get y() { return canvas.height - this.height; },
    
    draw() {
        // Ground top strip
        ctx.fillStyle = '#7ebd42';
        ctx.fillRect(0, this.y, canvas.width, 15);
        ctx.strokeRect(0, this.y, canvas.width, 15);
        
        ctx.fillStyle = GROUND_COLOR;
        ctx.fillRect(0, this.y + 15, canvas.width, this.height - 15);
        
        // Striped pattern lines moving
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 5;
        for (let i = 0; i < canvas.width / 20 + 2; i++) {
            ctx.beginPath();
            let lineX = (i * 30 - (bgOffset % 30));
            ctx.moveTo(lineX + 15, this.y + 15);
            ctx.lineTo(lineX, canvas.height);
            ctx.stroke();
        }
    },
    update() {
        bgOffset += currentSpeed;
    }
}

// Scenery (Clouds)
const clouds = {
    items: [],
    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.items.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 0.8, c.y - c.size * 0.4, c.size * 0.8, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 1.6, c.y, c.size * 0.9, 0, Math.PI * 2);
            ctx.fill();
        });
    },
    update() {
        if (frames % 120 === 0) {
            this.items.push({
                x: canvas.width + 50,
                y: Math.random() * (canvas.height * 0.5),
                size: Math.random() * 25 + 20,
                speed: Math.random() * 0.5 + 0.5
            });
        }
        for(let i=0; i<this.items.length; i++){
            this.items[i].x -= this.items[i].speed;
            if (this.items[i].x < -150) {
                this.items.splice(i, 1);
                i--;
            }
        }
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.height + rect1.y > rect2.y;
}

function triggerGameOver() {
    if (gameState === 'GAMEOVER') return;
    gameState = 'GAMEOVER';
    
    // Juice: Screen Shake
    gameContainer.classList.add('shake');
    setTimeout(() => {
        gameContainer.classList.remove('shake');
    }, 400);
    
    // Particles explosion
    for(let i=0; i<20; i++) {
        particles.push(new Particle(bird.x + bird.width/2, bird.y + bird.height/2));
    }
    
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
    
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('skyDashBestScore', bestScore);
    }
    
    finalScoreSpan.innerText = score;
    bestScoreSpan.innerText = bestScore;
}

function resetGame() {
    bird.y = INITIAL_BIRD_Y;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes.reset();
    particles = [];
    score = 0;
    frames = 0;
    currentSpeed = BASE_SPEED;
    
    scoreDisplay.innerText = score;
    scoreDisplay.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameState = 'PLAYING';
}

function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    
    if (gameState === 'START') {
        resetGame();
        bird.flap();
    } else if (gameState === 'PLAYING') {
        bird.flap();
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#restart-btn')) return;
    handleInput(e);
});
window.addEventListener('touchstart', (e) => {
    if (e.target.closest('#restart-btn')) return;
    handleInput(e);
}, {passive: false});

restartBtn.addEventListener('click', resetGame);

// Render loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    clouds.update();
    clouds.draw();
    
    if (gameState === 'PLAYING') {
        pipes.update();
        ground.update();
        bird.update();
        frames++;
    } else if (gameState === 'GAMEOVER') {
        // Fall simulation
        if (bird.y + bird.height < ground.y) {
            bird.velocity += GRAVITY;
            bird.y += bird.velocity;
            bird.rotation += 0.1; 
        }
    } else if (gameState === 'START') {
        bird.y = INITIAL_BIRD_Y + Math.sin(frames * 0.05) * 8; // Float gently
        frames++;
    }
    
    pipes.draw();
    ground.draw();
    
    // Draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    bird.draw();
    
    requestAnimationFrame(gameLoop);
}

// Generate some initial clouds
for(let i=0; i<3; i++) {
    clouds.items.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height * 0.5),
        size: Math.random() * 25 + 20,
        speed: Math.random() * 0.5 + 0.5
    });
}

gameLoop();
