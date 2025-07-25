// --- CONFIGURAÇÕES DO JOGO ---
const config = {
    width: 1000,
    height: 600,
    gravity: 0.6,
    playerSpeed: 5,
    playerJump: -15,
    projectileSpeed: 10,
    enemySpeed: 1,
    enemySpawnRate: 150, // a cada 150 frames
    initialLives: 3,
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
const messageButton = document.getElementById('message-button');

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
    
    // Carregar imagens
    const imagePromises = Object.entries(imageSources).map(([name, src]) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                images[name] = img;
                resolve();
            };
        });
    });

    // Carregar sons
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
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.image = image;
        this.dx = 0;
        this.dy = 0;
    }

    draw() {
        if (this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        }
    }

    isCollidingWith(other) {
        return (
            this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y
        );
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 60, 80, images.player);
        this.onGround = false;
        this.shootCooldown = 0;
    }

    update() {
        // Movimento horizontal
        if (state.keys['ArrowLeft']) this.dx = -config.playerSpeed;
        else if (state.keys['ArrowRight']) this.dx = config.playerSpeed;
        else this.dx = 0;

        this.x += this.dx;

        // Gravidade
        this.dy += config.gravity;
        this.y += this.dy;

        // Limites do chão
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.dy = 0;
            this.onGround = true;
        }

        // Limites laterais
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        // Atirar
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (state.keys[' '] && this.onGround && this.shootCooldown === 0) {
            this.shoot();
            this.shootCooldown = 20; // Cooldown de 20 frames
        }
    }

    jump() {
        if (this.onGround) {
            this.dy = config.playerJump;
            this.onGround = false;
            playSound(sounds.jump);
        }
    }

    shoot() {
        const projectile = new Projectile(this.x + this.width / 2, this.y + this.height / 2);
        state.projectiles.push(projectile);
        playSound(sounds.shoot);
    }
}

class Projectile extends Entity {
    constructor(x, y) {
        super(x - 15, y - 15, 30, 30, images.lightProjectile);
        this.dx = config.projectileSpeed;
    }

    update() {
        this.x += this.dx;
    }
}

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 50, 50, images.enemy);
        this.dx = -config.enemySpeed;
    }

    update() {
        this.x += this.dx;
        this.y += Math.sin(state.gameTime / 20) * 0.5; // Movimento ondulado
    }
}

class FaithOrb extends Entity {
    constructor(x, y) {
        super(x, y, 30, 30, images.faithOrb);
    }
}

// --- LÓGICA DE ATUALIZAÇÃO E RENDERIZAÇÃO ---
function update() {
    if (state.gameOver || state.levelComplete || !state.gameStarted) return;

    state.gameTime++;
    state.player.update();

    // Spawna inimigos
    if (state.gameTime % config.enemySpawnRate === 0) {
        const enemyY = canvas.height - 50 - Math.random() * 100;
        state.enemies.push(new Enemy(canvas.width, enemyY));
    }
    
    // Spawna orbs de fé
    if (state.gameTime > 0 && state.gameTime % 200 === 0) {
        const orbY = Math.random() * (canvas.height - 150) + 50;
        const orbX = Math.random() * (canvas.width - 100) + 50;
        state.faithOrbs.push(new FaithOrb(orbX, orbY));
    }

    // Atualiza projéteis
    state.projectiles.forEach((p, i) => {
        p.update();
        if (p.x > canvas.width) state.projectiles.splice(i, 1);
    });

    // Atualiza inimigos
    state.enemies.forEach((e, i) => {
        e.update();
        if (e.x + e.width < 0) state.enemies.splice(i, 1);
    });

    // --- Verificação de Colisões ---
    // Projéteis vs Inimigos
    state.projectiles.forEach((p, pi) => {
        state.enemies.forEach((e, ei) => {
            if (p.isCollidingWith(e)) {
                state.projectiles.splice(pi, 1);
                state.enemies.splice(ei, 1);
                state.score += 10;
                playSound(sounds.hit);
            }
        });
    });
    
    // Player vs Orbs de Fé
    state.faithOrbs.forEach((orb, i) => {
        if(state.player.isCollidingWith(orb)) {
            state.faithOrbs.splice(i, 1);
            state.score += 5;
            playSound(sounds.collect);
        }
    });

    // Player vs Inimigos
    state.enemies.forEach((e, i) => {
        if (state.player.isCollidingWith(e)) {
            state.enemies.splice(i, 1);
            state.lives--;
            if(state.lives <= 0) {
                endGame(false);
            }
        }
    });

    // Verifica condição de vitória
    if (state.score >= 100) {
        endGame(true);
    }

    // Atualiza UI
    scoreEl.textContent = `FÉ: ${state.score}`;
    livesEl.textContent = `VIDAS: ${state.lives}`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(images.background) {
        ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
    }

    if (!state.gameStarted) return;

    state.faithOrbs.forEach(orb => orb.draw());
    state.player.draw();
    state.projectiles.forEach(p => p.draw());
    state.enemies.forEach(e => e.draw());
    
    // Desenha o portão de chegada se a meta foi atingida
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
    messageTitle.textContent = title;
    messageText.textContent = text;
    messageButton.textContent = buttonText;
    messageContainer.classList.remove('hidden');
    
    // Remove o listener antigo para evitar múltiplos cliques
    const newButton = messageButton.cloneNode(true);
    messageButton.parentNode.replaceChild(newButton, messageButton);
    document.getElementById('message-button').onclick = onButtonClick;
}

function hideMessage() {
    messageContainer.classList.add('hidden');
}

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
    
    scoreEl.textContent = `FÉ: ${state.score}`;
    livesEl.textContent = `VIDAS: ${state.lives}`;
}

function startGame() {
    hideMessage();
    resetGame();
}

function endGame(isWin) {
    if (isWin) {
        state.levelComplete = true;
        playSound(sounds.levelWin);
        showMessage(
            "FASE CONCLUÍDA!",
            "Você superou as distrações e fortaleceu sua fé. Continue firme na sua jornada!",
            "Seja um influenciador de Cristo!",
            () => { 
                // Futuramente, iria para a próxima fase. Por agora, reinicia.
                startGame();
            }
        );
    } else {
        state.gameOver = true;
        playSound(sounds.gameOver);
        showMessage(
            "FIM DE JOGO",
            "As distrações foram fortes, mas não desista. Levante-se e tente novamente!",
            "Tentar Novamente",
            startGame
        );
    }
}


// --- INICIALIZAÇÃO ---
window.addEventListener('keydown', (e) => {
    state.keys[e.key] = true;
    if (e.key === 'ArrowUp') state.player?.jump();
});

window.addEventListener('keyup', (e) => {
    state.keys[e.key] = false;
});

// Começa o jogo após carregar os assets
window.addEventListener('load', async () => {
    await loadAssets();
    
    // Iniciar o AudioContext com um gesto do usuário
    const startInteraction = () => {
        audioContext.resume().then(() => {
            document.removeEventListener('click', startInteraction);
            document.removeEventListener('keydown', startInteraction);
            
            showMessage(
                "Jornada do Influenciador",
                "Use as setas para mover, Seta para Cima para pular e Espaço para atirar luz contra os demônios da dúvida. Colete Orbes de Fé para aumentar sua pontuação e alcançar 100 pontos de Fé para passar de fase!",
                "Começar a Jornada!",
                startGame
            );
            
            gameLoop();
        });
    };

    document.addEventListener('click', startInteraction);
    document.addEventListener('keydown', startInteraction);
});