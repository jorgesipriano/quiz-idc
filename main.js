// --- CONFIGURAÇÕES DO JOGO ---
const config = {
    width: 1000,
    height: 600,
    gravity: 0.6,
    playerSpeed: 5,
    playerJump: -15,
    projectileSpeed: 10,
    enemyBaseSpeed: 1.5,
    enemySpawnBaseRate: 150,
    initialLives: 3,
    winScore: 3000, // ALTERADO: Meta de 3000 pontos
};

// --- ESTADO DO JOGO ---
let state = {
    keys: {},
    player: null,
    projectiles: [],
    enemyProjectiles: [], // NOVO: Array para os projéteis dos inimigos
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
    enemySpawnCounter: 0, // NOVO: Contador para decidir qual inimigo spawnar
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
        enemyShooter: './enemy_shooter.png', // NOVO: Imagem do inimigo que atira
        enemyProjectile: './enemy_projectile.png', // NOVO: Imagem do projétil inimigo
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
            img.onerror = () => { console.warn(`Não foi possível carregar a imagem: ${src}. Usando um quadrado vazio.`); resolve(); } // Evita travar se uma imagem faltar
        });
    });

    const soundPromises = Object.entries(soundSources).map(async ([name, src]) => {
        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            sounds[name] = audioBuffer;
        } catch (e) {
            console.warn(`Não foi possível carregar o som: ${src}`);
        }
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
    draw() { 
        if (this.image && this.image.complete && this.image.naturalHeight !== 0) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else { // Desenha um substituto se a imagem falhar ou não carregou
            ctx.fillStyle = 'magenta';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
    isCollidingWith(other) {
        return (this.x < other.x + other.width && this.x + this.width > other.x &&
                this.y < other.y + other.height && this.y + this.height > other.y);
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 60, 80, images.player);
        this.onGround = false; this.shootCooldown = 0; this.invulnerable = 0;
    }
    update() {
        if (state.keys['ArrowLeft']) this.dx = -config.playerSpeed;
        else if (state.keys['ArrowRight']) this.dx = config.playerSpeed;
        else this.dx = 0;
        this.x += this.dx;
        this.dy += config.gravity;
        this.y += this.dy;
        if (this.y + this.height > canvas.height) { this.y = canvas.height - this.height; this.dy = 0; this.onGround = true; } 
        else { this.onGround = false; }
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (state.keys[' '] && this.shootCooldown === 0) { this.shoot(); this.shootCooldown = 20; }
        if (this.invulnerable > 0) this.invulnerable--;
    }
    draw() { if (this.invulnerable > 0 && Math.floor(state.gameTime / 5) % 2 === 0) return; super.draw(); }
    jump() { if (this.onGround) { this.dy = config.playerJump; playSound(sounds.jump); } }
    shoot() { state.projectiles.push(new Projectile(this.x + this.width / 2, this.y + this.height / 2)); playSound(sounds.shoot); }
    takeDamage() {
        if(this.invulnerable > 0) return;
        state.lives--;
        this.invulnerable = 120;
        playSound(sounds.hit);
        if (state.lives <= 0) endGame(false);
    }
}

class Projectile extends Entity {
    constructor(x, y) { super(x - 15, y - 15, 30, 30, images.lightProjectile); this.dx = config.projectileSpeed; }
    update() { this.x += this.dx; }
}

// NOVO: Projétil do inimigo
class EnemyProjectile extends Entity {
    constructor(x, y) {
        super(x, y, 25, 25, images.enemyProjectile);
        this.dy = 5; // Atira para baixo
    }
    update() { this.y += this.dy; }
}

class Enemy extends Entity {
    constructor(x, y, speed) { super(x, y, 50, 50, images.enemy); this.dx = -speed; }
    update() { this.x += this.dx; this.y += Math.sin(state.gameTime / 30) * 0.7; }
}

// NOVO: Inimigo que atira e é resistente
class ShooterEnemy extends Enemy {
    constructor(x, y, speed) {
        super(x, y, speed);
        this.image = images.enemyShooter; // Usa a nova imagem
        this.width = 60;
        this.height = 60;
        this.health = 3; // Precisa de 3 tiros para morrer
        this.shootCooldown = Math.random() * 100 + 100; // Cooldown inicial aleatório
    }

    update() {
        super.update(); // Executa a lógica de movimento do inimigo normal
        this.shootCooldown--;
        if (this.shootCooldown <= 0) {
            this.shoot();
            this.shootCooldown = 180; // Atira a cada 3 segundos
        }
    }

    shoot() {
        if(this.x < canvas.width) { // Só atira se estiver na tela
            state.enemyProjectiles.push(new EnemyProjectile(this.x + this.width / 2, this.y + this.height));
        }
    }

    takeHit() {
        this.health--;
        return this.health <= 0; // Retorna true se morreu
    }
}

class FaithOrb extends Entity { constructor(x, y) { super(x, y, 30, 30, images.faithOrb); } }

// --- LÓGICA DE ATUALIZAÇÃO E RENDERIZAÇÃO ---
function update() {
    if (state.gameOver || state.levelComplete || !state.gameStarted) return;
    state.gameTime++;
    state.player.update();

    if (state.gameTime % 600 === 0 && state.gameTime > 0) {
        state.currentEnemySpeed += 0.25;
        if (state.currentSpawnRate > 60) state.currentSpawnRate -= 10;
    }
    
    // ALTERADO: Lógica de Spawn para alternar inimigos
    if (state.gameTime % Math.round(state.currentSpawnRate) === 0) {
        const enemyY = canvas.height - 80 - Math.random() * 200;
        state.enemySpawnCounter++;
        // A cada 4 inimigos, spawna um que atira
        if (state.enemySpawnCounter % 4 === 0) {
            state.enemies.push(new ShooterEnemy(canvas.width, enemyY, state.currentEnemySpeed * 0.8)); // Um pouco mais lento
        } else {
            state.enemies.push(new Enemy(canvas.width, enemyY, state.currentEnemySpeed));
        }
    }
    
    if (state.gameTime > 0 && state.gameTime % 250 === 0) {
        const orbY = Math.random() * (canvas.height - 200) + 50;
        const orbX = Math.random() * (canvas.width - 100) + 50;
        state.faithOrbs.push(new FaithOrb(orbX, orbY));
    }

    // Atualiza todos os projéteis e inimigos
    state.projectiles.forEach(p => p.update());
    state.enemyProjectiles.forEach(p => p.update());
    state.enemies.forEach(e => e.update());

    // Remove entidades que saíram da tela
    state.projectiles = state.projectiles.filter(p => p.x <= canvas.width);
    state.enemyProjectiles = state.enemyProjectiles.filter(p => p.y < canvas.height);
    state.enemies = state.enemies.filter(e => e.x + e.width >= 0);

    // --- Verificação de Colisões (Lógica Alterada) ---
    // Projéteis do Jogador vs Inimigos
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        for (let j = state.enemies.length - 1; j >= 0; j--) {
            const p = state.projectiles[i];
            const e = state.enemies[j];
            if (p?.isCollidingWith(e)) {
                playSound(sounds.hit);
                state.projectiles.splice(i, 1); // Projétil sempre some
                
                if (e instanceof ShooterEnemy) {
                    if (e.takeHit()) { // Se o inimigo morreu após o tiro
                        state.score += 25; // Recompensa maior
                        state.enemies.splice(j, 1);
                    }
                } else { // Inimigo comum morre com 1 tiro
                    state.score += 10;
                    state.enemies.splice(j, 1);
                }
                break; // Sai do loop de inimigos pois o projétil já foi usado
            }
        }
    }
    
    // NOVO: Projéteis Inimigos vs Jogador
    for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
        const p = state.enemyProjectiles[i];
        if (p?.isCollidingWith(state.player)) {
            state.player.takeDamage();
            state.enemyProjectiles.splice(i, 1);
        }
    }

    // Jogador vs Inimigos (colisão corporal)
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        if (state.player.isCollidingWith(state.enemies[i])) {
            state.player.takeDamage();
            state.enemies.splice(i, 1);
        }
    }

    // Jogador vs Orbes de Fé
    for (let i = state.faithOrbs.length - 1; i >= 0; i--) {
        if(state.player.isCollidingWith(state.faithOrbs[i])) {
            state.score += 5;
            playSound(sounds.collect);
            state.faithOrbs.splice(i, 1);
        }
    }

    if (state.score >= config.winScore && !state.levelComplete) endGame(true);

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
    state.enemyProjectiles.forEach(p => p.draw()); // NOVO: Desenha projéteis inimigos
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
    state.enemyProjectiles = [];
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
    state.enemySpawnCounter = 0;
    scoreEl.textContent = `FÉ: ${state.score}`;
    livesEl.textContent = `VIDAS: ${state.lives}`;
}

function startGame() { hideMessage(); resetGame(); }

function endGame(isWin) {
    if(state.gameOver || state.levelComplete) return;

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
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); state.keys[touchButtons[id]] = true; }, { passive: false });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); state.keys[touchButtons[id]] = false; }, { passive: false });
        }
    });
    const jumpBtn = document.getElementById('jump');
    if (jumpBtn) {
        jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); state.player?.jump(); }, { passive: false });
    }
}

window.addEventListener('load', async () => {
    const startInteraction = () => {
        document.removeEventListener('click', startInteraction);
        document.removeEventListener('keydown', startInteraction);
        showMessage("Carregando...", "Aguarde, estamos preparando a sua jornada...", "...", ()=>{});
        
        audioContext.resume().then(async () => {
            try {
                await loadAssets();
                setupEventListeners();
                gameLoop();
                showMessage("Jornada do Influenciador", `Use as setas/toque para se mover. Atire luz contra as dúvidas! Faça ${config.winScore} pontos para vencer!`, "Começar a Jornada!", startGame);
            } catch(err) {
                console.error("Erro ao carregar assets:", err);
                showMessage("Erro!", "Não foi possível carregar os recursos do jogo. Verifique o console para mais detalhes.", "OK", ()=>{});
            }
        });
    };
    document.addEventListener('click', startInteraction);
    document.addEventListener('keydown', startInteraction);
});
