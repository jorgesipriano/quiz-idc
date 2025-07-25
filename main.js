// --- CONFIGURAÇÕES DO JOGO ---
const config = {
    width: 1000,
    height: 600,
    gravity: 0.6,
    playerSpeed: 5,
    playerJump: -15,
    projectileSpeed: 10,
    enemyBaseSpeed: 1.5, // Velocidade inicial dos inimigos
    enemySpawnBaseRate: 150, // Taxa de spawn inicial
    initialLives: 3,
    winScore: 300, // Pontuação para vencer o jogo
};

// --- ESTADO DO JOGO ---
let state = {
    keys: {},
    player: null,
    projectiles: [],
    enemies: [],
    faithOrbs: [],
    score: 0,
    lives: config.initialLives,
    gameTime: 0,
    levelComplete: false,
    gameOver: false,
    gameStarted: false,
    currentEnemySpeed: config.enemyBaseSpeed,
    currentSpawnRate: config.enemySpawnBaseRate,
};

// --- ELEMENTOS DO DOM E CONTEXTO DO CANVAS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = config.width;
canvas.height = config.height;

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const messageContainer = document.getElementById('message-container');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');

// --- CARREGAMENTO DE ASSETS ---
const images = {};
const sounds = {};
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

async function loadAssets() {
    const imageSources = {
        player: './player.png',
        enemy: './enemy.png',
        lightProjectile: './light_projectile.png',
        faithOrb: './faith_orb.png',
        background: './background.png',
        goal: './goal.png',
    };

    const soundSources = {
        jump: './jump.mp3',
        shoot: './shoot.mp3',
        hit: './hit.mp3',
        collect: './collect.mp3',
        levelWin: './level_win.mp3',
        gameOver: './game_over.mp3',
    };
    
    const imagePromises = Object.entries(imageSources).map(([name, src]) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => { images[name] = img; resolve(); };
        });
    });

    const soundPromises = Object.entries(soundSources).map(async ([name, src]) => {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        sounds[name] = audioBuffer;
    });

    await Promise.all([...imagePromises, ...soundPromises]);
}

function playSound(buffer) {
    if (!buffer || audioContext.state === 'suspended') return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

// --- CLASSES DO JOGO ---
class Entity {
    constructor(x, y, width, height, image) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.image = image; this.dx = 0; this.dy = 0;
    }
    draw() { if (this.image) ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }
    isCollidingWith(other) {
        return (this.x < other.x + other.width && this.x + this.width > other.x &&
                this.y < other.y + other.height && this.y + this.height > other.y);
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 60, 80, images.player);
        this.onGround = false;
        this.shootCooldown = 0;
        this.invulnerable = 0;
    }

    update() {
        if (state.keys['ArrowLeft']) this.dx = -config.playerSpeed;
        else if (state.keys['ArrowRight']) this.dx = config.playerSpeed;
        else this.dx = 0;
        this.x += this.dx;

        this.dy += config.gravity;
        this.y += this.dy;

        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.dy = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        if (this.shootCooldown > 0) this.shootCooldown--;
        // ✅ MELHORIA: Removido `this.onGround` para permitir tiro no ar.
        if (state.keys[' '] && this.shootCooldown === 0) {
            this.shoot();
            this.shootCooldown = 20;
        }

        if (this.invulnerable > 0) this.invulnerable--;
    }

    draw() {
        if (this.invulnerable > 0 && Math.floor(state.gameTime / 5) % 2 === 0) return;
        super.draw();
    }

    jump() {
        if (this.onGround) {
            this.dy = config.playerJump;
            playSound(sounds.jump);
        }
    }

    shoot() {
        const projectile = new Projectile(this.x + this.width / 2, this.y + this.height / 2);
        state.projectiles.push(projectile);
        playSound(sounds.shoot);
    }
    
    takeDamage() {
        if(this.invulnerable > 0) return;
        state.lives--;
        this.invulnerable = 120; // 2 segundos de invulnerabilidade
        playSound(sounds.hit);
        if (state.lives <= 0) endGame(false);
    }
}

class Projectile extends Entity {
    constructor(x, y) {
        super(x - 15, y - 15, 30, 30, images.lightProjectile);
        this.dx = config.projectileSpeed;
    }
    update() { this.x += this.dx; }
}

class Enemy extends Entity {
    constructor(x, y, speed) {
        super(x, y, 50, 50, images.enemy);
        this.dx = -speed;
    }
    update() {
        this.x += this.dx;
        this.y += Math.sin(state.gameTime / 30) * 0.7;
    }
}

class FaithOrb extends Entity {
    constructor(x, y) { super(x, y, 30, 30, images.faithOrb); }
}

// --- LÓGICA DE ATUALIZAÇÃO E RENDERIZAÇÃO ---
function update() {
    if (state.gameOver || state.levelComplete || !state.gameStarted) return;

    state.gameTime++;
    state.player.update();

    // ✅ MELHORIA: Dificuldade progressiva
    if (state.gameTime % 600 === 0 && state.gameTime > 0) { // A cada 10 segundos
        state.currentEnemySpeed += 0.25;
        if (state.currentSpawnRate > 60) { // Limite mínimo para não ficar impossível
            state.currentSpawnRate -= 10;
        }
    }
    
    // Spawna inimigos com a dificuldade atual
    if (state.gameTime % Math.round(state.currentSpawnRate) === 0) {
        const enemyY = canvas.height - 60 - Math.random() * 200;
        state.enemies.push(new Enemy(canvas.width, enemyY, state.currentEnemySpeed));
    }
    
    if (state.gameTime > 0 && state.gameTime % 250 === 0) {
        const orbY = Math.random() * (canvas.height - 200) + 50;
        const orbX = Math.random() * (canvas.width - 100) + 50;
        state.faithOrbs.push(new FaithOrb(orbX, orbY));
    }

    state.projectiles = state.projectiles.filter(p => { p.update(); return p.x <= canvas.width; });
    state.enemies = state.enemies.filter(e => { e.update(); return e.x + e.width >= 0; });

    // Colisões
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        for (let j = state.enemies.length - 1; j >= 0; j--) {
            if (state.projectiles[i]?.isCollidingWith(state.enemies[j])) {
                state.score += 10;
                playSound(sounds.hit);
                state.projectiles.splice(i, 1);
                state.enemies.splice(j, 1);
                break;
            }
        }
    }
    
    for (let i = state.faithOrbs.length - 1; i >= 0; i--) {
        if(state.player.isCollidingWith(state.faithOrbs[i])) {
            state.score += 5;
            playSound(sounds.collect);
            state.faithOrbs.splice(i, 1);
        }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
        if (state.player.isCollidingWith(state.enemies[i])) {
            state.player.takeDamage();
            state.enemies.splice(i, 1);
        }
    }

    // ✅ MELHORIA: Condição de vitória com pontuação maior
    if (state.score >= config.winScore) endGame(true);

    scoreEl.textContent = `FÉ: ${state.score}`;
    livesEl.textContent = `VIDAS: ${state.lives}`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(images.background) ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
    if (!state.gameStarted) return;
    state.faithOrbs.forEach(orb => orb.draw());
    state.player.draw();
    state.projectiles.forEach(p => p.draw());
    state.enemies.forEach(e => e.draw());
    if (state.levelComplete && images.goal) {
         ctx.drawImage(images.goal, canvas.width - 150, canvas.height - 200, 150, 200);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- CONTROLE DE ESTADO DO JOGO ---
function showMessage(title, text, buttonText, onButtonClick) {
    const messageButton = document.getElementById('message-button');
    messageTitle.textContent = title;
    messageText.textContent = text;
    messageButton.textContent = buttonText;
    messageContainer.classList.remove('hidden');
    const newButton = messageButton.cloneNode(true);
    messageButton.parentNode.replaceChild(newButton, messageButton);
    newButton.onclick = onButtonClick;
}

function hideMessage() { messageContainer.classList.add('hidden'); }

function resetGame() {
    state.player = new Player(50, canvas.height - 80);
    state.projectiles = [];
    state.enemies = [];
    state.faithOrbs = [];
    state.score = 0;
    state.lives = config.initialLives;
    state.gameTime = 0;
    state.levelComplete = false;
    state.gameOver = false;
    state.gameStarted = true;
    state.currentEnemySpeed = config.enemyBaseSpeed;
    state.currentSpawnRate = config.enemySpawnBaseRate;
    scoreEl.textContent = `FÉ: ${state.score}`;
    livesEl.textContent = `VIDAS: ${state.lives}`;
}

function startGame() { hideMessage(); resetGame(); }

function endGame(isWin) {
    if(state.gameOver || state.levelComplete) return; // Evita chamar a função várias vezes

    if (isWin) {
        state.levelComplete = true;
        playSound(sounds.levelWin);
        showMessage("FASE CONCLUÍDA!", `Você alcançou ${config.winScore} pontos de Fé e superou as distrações. Continue firme!`, "Jogar Novamente", startGame);
    } else {
        state.gameOver = true;
        playSound(sounds.gameOver);
        showMessage("FIM DE JOGO", "As distrações foram fortes, mas não desista. Tente novamente!", "Recomeçar", startGame);
    }
}

// --- INICIALIZAÇÃO E EVENTOS ---
function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        state.keys[e.key] = true;
        if (e.key === 'ArrowUp') state.player?.jump();
    });
    window.addEventListener('keyup', (e) => { state.keys[e.key] = false; });

    const touchButtons = { left: 'ArrowLeft', right: 'ArrowRight', shoot: ' ' };
    ['left', 'right', 'shoot'].forEach(id => {
        document.getElementById(id).addEventListener('touchstart', (e) => { e.preventDefault(); state.keys[touchButtons[id]] = true; });
        document.getElementById(id).addEventListener('touchend', (e) => { e.preventDefault(); state.keys[touchButtons[id]] = false; });
    });
    document.getElementById('jump').addEventListener('touchstart', (e) => { e.preventDefault(); state.player?.jump(); });
}

window.addEventListener('load', async () => {
    const startInteraction = () => {
        document.removeEventListener('click', startInteraction);
        document.removeEventListener('keydown', startInteraction);
        showMessage("Carregando...", "Aguarde, estamos preparando a sua jornada...", "...", ()=>{});
        
        audioContext.resume().then(async () => {
            await loadAssets();
            setupEventListeners();
            gameLoop();
            showMessage("Jornada do Influenciador", "Use as setas/toque para mover, pular e atirar luz contra as dúvidas! Colete Orbes e faça 300 pontos para vencer!", "Começar a Jornada!", startGame);
        }).catch(err => {
            console.error("Erro ao carregar assets:", err);
            showMessage("Erro!", "Não foi possível carregar os recursos do jogo. Verifique o console para mais detalhes.", "OK", ()=>{});
        });
    };
    document.addEventListener('click', startInteraction);
    document.addEventListener('keydown', startInteraction);
});
