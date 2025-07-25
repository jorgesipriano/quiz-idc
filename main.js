<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Jornada do Influenciador</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">
    <style>
        /* --- ESTILOS GERAIS --- */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Montserrat', sans-serif;
            -webkit-tap-highlight-color: transparent; /* Remove o brilho do toque em mobile */
        }

        body {
            background-color: #111;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
        }

        /* --- CONTAINER PRINCIPAL DO JOGO --- */
        #game-container {
            position: relative;
            width: 1000px;
            height: 600px;
            max-width: 100%; /* Garante que não ultrapasse a largura da tela */
            max-height: 100%;
        }

        canvas {
            background-color: #000;
            display: block;
            width: 100%;
            height: 100%;
        }

        /* --- CAMADA DE INTERFACE (PONTOS, VIDAS) --- */
        #ui-layer {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            font-size: clamp(16px, 2.5vw, 20px); /* Fonte responsiva */
            text-shadow: 2px 2px 4px #000;
        }

        /* --- MENSAGENS (INÍCIO/FIM DE JOGO) --- */
        #message-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            padding: 20px;
            text-align: center;
            transition: opacity 0.3s;
        }

        #message-container.hidden {
            opacity: 0;
            pointer-events: none;
        }

        #message-button {
            padding: 12px 24px;
            margin-top: 20px;
            font-size: 18px;
            border: none;
            border-radius: 10px;
            background-color: #FFD700;
            color: #000;
            cursor: pointer;
            font-weight: bold;
        }

        /* --- CONTROLES DE TOQUE --- */
        #touch-controls {
            position: absolute;
            bottom: 10px;
            left: 0;
            width: 100%;
            padding: 0 10px;
            display: none; /* Escondido por padrão */
            justify-content: space-between;
            pointer-events: none; /* Permite clicar através dele */
        }

        /* Mostra os controles apenas em dispositivos de toque */
        @media (pointer: coarse) {
            #touch-controls {
                display: flex;
            }
        }

        .touch-group {
            display: flex;
            gap: 20px;
            pointer-events: auto; /* Habilita o toque nos botões */
        }
        
        .touch-btn {
            width: 60px;
            height: 60px;
            background-color: rgba(255, 255, 255, 0.3);
            border: 2px solid white;
            border-radius: 50%;
            color: white;
            font-size: 30px;
            display: flex;
            justify-content: center;
            align-items: center;
            user-select: none;
        }
    </style>
</head>
<body>
    <div id="game-container">
        <canvas id="gameCanvas"></canvas>
        <div id="ui-layer">
            <div id="score">FÉ: 0</div>
            <div id="lives">VIDAS: 3</div>
        </div>
        <div id="message-container">
            <h1 id="message-title"></h1>
            <p id="message-text"></p>
            <button id="message-button"></button>
        </div>
        <div id="touch-controls">
            <div class="touch-group">
                <div class="touch-btn" id="left">&#8592;</div>
                <div class="touch-btn" id="right">&#8594;</div>
            </div>
            <div class="touch-group">
                <div class="touch-btn" id="shoot">&#128165;</div>
                <div class="touch-btn" id="jump">&#8679;</div>
            </div>
        </div>
    </div>

    <script type="module">
        // --- CONFIGURAÇÕES DO JOGO ---
        const config = {
            width: 1000,
            height: 600,
            gravity: 0.6,
            playerSpeed: 5,
            playerJump: -15,
            projectileSpeed: 10,
            enemySpeed: 1.5,
            enemySpawnRate: 150, // a cada 150 frames
            initialLives: 3,
            winScore: 300,
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

        // --- ELEMENTOS DO DOM ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = config.width;
        canvas.height = config.height;

        const scoreEl = document.getElementById('score');
        const livesEl = document.getElementById('lives');
        const messageContainer = document.getElementById('message-container');
        const messageTitle = document.getElementById('message-title');
        const messageText = document.getElementById('message-text');
        
        const images = {};
        const sounds = {};
        let audioContext = null;

        async function loadAssets() {
            const imageSources = {
                player: 'https://i.imgur.com/your_player_image.png', // SUBSTITUA PELOS LINKS DAS SUAS IMAGENS
                enemy: 'https://i.imgur.com/your_enemy_image.png',
                lightProjectile: 'https://i.imgur.com/your_projectile_image.png',
                faithOrb: 'https://i.imgur.com/your_orb_image.png',
                background: 'https://i.imgur.com/your_background_image.png',
                goal: 'https://i.imgur.com/your_goal_image.png',
            };

            // Para facilitar, vou comentar o carregamento de sons.
            // Descomente e use os seus próprios arquivos se precisar.
            /*
            const soundSources = {
                jump: './jump.mp3',
                shoot: './shoot.mp3',
                hit: './hit.mp3',
                collect: './collect.mp3',
                levelWin: './level_win.mp3',
                gameOver: './game_over.mp3',
            };
            */

            const imagePromises = Object.entries(imageSources).map(([name, src]) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous'; // Necessário para carregar imagens de outros domínios (como o imgur)
                    img.src = src;
                    img.onload = () => {
                        images[name] = img;
                        resolve();
                    };
                    img.onerror = () => reject(`Erro ao carregar imagem: ${name}`);
                });
            });
            /*
            const soundPromises = Object.entries(soundSources).map(async ([name, src]) => {
                const response = await fetch(src);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                sounds[name] = audioBuffer;
            });
            */
            // await Promise.all([...imagePromises, ...soundPromises]);
            await Promise.all(imagePromises);
        }
        
        function playSound(buffer) {
            if (!buffer || !audioContext || audioContext.state === 'suspended') return;
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        }

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
                this.invulnerable = 0; // Tempo de invulnerabilidade após ser atingido
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

                // Colisão com o chão
                if (this.y + this.height > canvas.height) {
                    this.y = canvas.height - this.height;
                    this.dy = 0;
                    this.onGround = true;
                } else {
                    this.onGround = false;
                }

                // Limites da tela
                if (this.x < 0) this.x = 0;
                if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

                // Cooldown do tiro
                if (this.shootCooldown > 0) this.shootCooldown--;
                if (state.keys[' '] && this.shootCooldown === 0) {
                    this.shoot();
                    this.shootCooldown = 20; // 20 frames de cooldown
                }

                // Cooldown de invulnerabilidade
                if (this.invulnerable > 0) this.invulnerable--;
            }

            draw() {
                 // Pisca o jogador quando está invulnerável
                if (this.invulnerable > 0 && Math.floor(this.invulnerable / 5) % 2 === 0) {
                    return;
                }
                super.draw();
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
            
            takeDamage() {
                if (this.invulnerable > 0) return; // Não toma dano se estiver invulnerável

                state.lives--;
                this.invulnerable = 120; // 2 segundos de invulnerabilidade (60fps * 2s)
                playSound(sounds.hit);
                if (state.lives <= 0) {
                    endGame(false);
                }
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
            constructor(x, y, speed) {
                super(x, y, 50, 50, images.enemy);
                this.dx = -speed;
            }

            update() {
                this.x += this.dx;
                // Movimento senoidal para variar a trajetória
                this.y += Math.sin(state.gameTime / 20) * 0.5;
            }
        }

        class FaithOrb extends Entity {
            constructor(x, y) {
                super(x, y, 30, 30, images.faithOrb);
            }
        }
        
        function update() {
            if (state.gameOver || state.levelComplete || !state.gameStarted) return;
            
            state.gameTime++;
            state.player.update();
            
            // Dificuldade progressiva
            const currentEnemySpeed = config.enemySpeed + Math.floor(state.gameTime / 1000) * 0.2;
            const currentSpawnRate = Math.max(60, config.enemySpawnRate - Math.floor(state.gameTime / 500) * 10);

            // Spawn de inimigos
            if (state.gameTime % currentSpawnRate === 0) {
                const enemyY = canvas.height - 50 - Math.random() * 150;
                state.enemies.push(new Enemy(canvas.width, enemyY, currentEnemySpeed));
            }

            // Spawn de orbes
            if (state.gameTime > 0 && state.gameTime % 300 === 0) {
                const orbY = Math.random() * (canvas.height - 200) + 50;
                const orbX = Math.random() * (canvas.width - 100) + 50;
                state.faithOrbs.push(new FaithOrb(orbX, orbY));
            }

            // Atualiza projéteis e remove os que saem da tela
            state.projectiles.forEach(p => p.update());
            state.projectiles = state.projectiles.filter(p => p.x <= canvas.width);

            // Atualiza inimigos e remove os que saem da tela
            state.enemies.forEach(e => e.update());
            state.enemies = state.enemies.filter(e => e.x + e.width >= 0);

            // Checa colisões
            checkCollisions();
            
            // Checa condição de vitória
            if (state.score >= config.winScore && !state.levelComplete) {
                endGame(true);
            }

            // Atualiza UI
            scoreEl.textContent = `FÉ: ${state.score}`;
            livesEl.textContent = `VIDAS: ${state.lives}`;
        }
        
        function checkCollisions() {
            // Projéteis vs Inimigos
            for (let i = state.projectiles.length - 1; i >= 0; i--) {
                for (let j = state.enemies.length - 1; j >= 0; j--) {
                    const p = state.projectiles[i];
                    const e = state.enemies[j];
                    if (p && e && p.isCollidingWith(e)) {
                        state.projectiles.splice(i, 1);
                        state.enemies.splice(j, 1);
                        state.score += 10;
                        playSound(sounds.hit);
                        break; // Projétil só pode atingir um inimigo
                    }
                }
            }

            // Jogador vs Orbes de Fé
            for (let i = state.faithOrbs.length - 1; i >= 0; i--) {
                const orb = state.faithOrbs[i];
                if (state.player.isCollidingWith(orb)) {
                    state.score += 5;
                    playSound(sounds.collect);
                    state.faithOrbs.splice(i, 1);
                }
            }
            
            // Jogador vs Inimigos
            for (let i = state.enemies.length - 1; i >= 0; i--) {
                const e = state.enemies[i];
                if (state.player.isCollidingWith(e)) {
                    state.player.takeDamage();
                    state.enemies.splice(i, 1); // Remove inimigo ao colidir
                }
            }
        }


        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (images.background) {
                ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
            }
            
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

        function showMessage(title, text, buttonText, onButtonClick) {
            messageTitle.textContent = title;
            messageText.textContent = text;
            const messageButton = document.getElementById('message-button');
            messageButton.textContent = buttonText;
            messageContainer.classList.remove('hidden');

            // Remove listener antigo e adiciona um novo para evitar múltiplos cliques
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
            
            // Reseta a dificuldade
            config.enemySpeed = 1.5;
            config.enemySpawnRate = 150;

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
                showMessage("FASE CONCLUÍDA!", "Você superou as distrações e fortaleceu sua fé. Continue firme na sua jornada!", "Continuar", startGame);
            } else {
                state.gameOver = true;
                playSound(sounds.gameOver);
                showMessage("FIM DE JOGO", "As distrações foram fortes, mas não desista. Tente novamente!", "Recomeçar", startGame);
            }
        }

        // --- INICIALIZAÇÃO E EVENTOS ---

        function setupEventListeners() {
            // Eventos de teclado
            window.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp') state.player?.jump();
                else state.keys[e.key] = true;
            });

            window.addEventListener('keyup', (e) => {
                state.keys[e.key] = false;
            });

            // Eventos de toque para mobile
            const touchButtons = {
                left: document.getElementById('left'),
                right: document.getElementById('right'),
                jump: document.getElementById('jump'),
                shoot: document.getElementById('shoot'),
            };

            Object.entries(touchButtons).forEach(([key, btn]) => {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (key === 'jump') state.player?.jump();
                    else if (key === 'shoot') state.keys[' '] = true;
                    else if (key === 'left') state.keys['ArrowLeft'] = true;
                    else if (key === 'right') state.keys['ArrowRight'] = true;
                }, { passive: false });

                btn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    if (key === 'shoot') state.keys[' '] = false;
                    else if (key === 'left') state.keys['ArrowLeft'] = false;
                    else if (key === 'right') state.keys['ArrowRight'] = false;
                }, { passive: false });
            });
        }

        window.addEventListener('load', async () => {
            const startInteraction = () => {
                // Inicia o contexto de áudio após interação do usuário
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                audioContext.resume().then(async () => {
                    document.removeEventListener('click', startInteraction);
                    document.removeEventListener('keydown', startInteraction);
                    
                    showMessage("Carregando...", "Preparando sua jornada...", "", () => {});

                    try {
                        await loadAssets();
                        setupEventListeners();
                        showMessage(
                            "Jornada do Influenciador",
                            "Use as setas ou toque para mover, pular e atirar luz contra as dúvidas! Colete Orbes de Fé e vença!",
                            "Começar a Jornada!",
                            startGame
                        );
                        gameLoop();
                    } catch (error) {
                         showMessage("Erro!", `Não foi possível carregar os recursos do jogo. Verifique os links das imagens e tente novamente. Detalhe: ${error}`, "OK", () => {});
                    }
                });
            };
            
            showMessage(
                "Bem-vindo(a)!",
                "Clique ou pressione qualquer tecla para iniciar.",
                "Iniciar",
                startInteraction
            );
        });

    </script>
</body>
</html>
