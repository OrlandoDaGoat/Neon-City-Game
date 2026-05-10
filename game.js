const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startMenu = document.getElementById('start-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const scoreDisplay = document.getElementById('score-display');
const scoreValue = scoreDisplay.querySelector('span');
const finalScore = document.getElementById('final-score');

// Load Assets
const playerImg = new Image();
playerImg.src = 'assets/player_car.png';

const enemyImg = new Image();
enemyImg.src = 'assets/enemy_car.png';

const bgNeon = new Image();
bgNeon.src = 'assets/bg_neon.png';

const bgMiami = new Image();
bgMiami.src = 'assets/bg_miami.png';

const bgRaceTrack = new Image();
bgRaceTrack.src = 'assets/bg_race_track.png';

// Game State
let isPlaying = false;
let animationId;
let score = 0;
let baseSpeed = 5;
let currentSpeed = 5;
let spawnRate = 60; // Frames between spawns
let frameCount = 0;
let roadOffset = 0;

// New Features State
let highScore = localStorage.getItem('neonRunnerHighScore') || 0;
let currentMap = 'neon';

const crashMessages = [
    "YOU'RE TRASH!",
    "I know you were drinking and driving on that one",
    "Did you even see that car?",
    "My grandma drives better than that",
    "Revoked license simulator 2026",
    "Was your monitor turned off?",
    "That was expensive...",
    "Are you even trying?"
];

// Entities
let player;
let enemies = [];

// Car Dimensions
const CAR_WIDTH = 60;
const CAR_HEIGHT = 100;

// Input
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    a: false,
    d: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

let targetX = null;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    targetX = (e.clientX - rect.left) * scaleX - (CAR_WIDTH / 2);
});

canvas.addEventListener('mouseleave', () => {
    targetX = null;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    targetX = (e.touches[0].clientX - rect.left) * scaleX - (CAR_WIDTH / 2);
}, { passive: false });

canvas.addEventListener('touchend', () => {
    targetX = null;
});

class Player {
    constructor() {
        this.width = CAR_WIDTH;
        this.height = CAR_HEIGHT;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.speed = 7;
    }

    update() {
        let movedWithKeyboard = false;

        if ((keys.ArrowLeft || keys.a) && this.x > 0) {
            this.x -= this.speed;
            movedWithKeyboard = true;
        }
        if ((keys.ArrowRight || keys.d) && this.x + this.width < canvas.width) {
            this.x += this.speed;
            movedWithKeyboard = true;
        }

        if (!movedWithKeyboard && targetX !== null) {
            // Smoothly move towards mouse/touch target
            if (Math.abs(targetX - this.x) > this.speed) {
                this.x += (targetX > this.x) ? this.speed : -this.speed;
            } else {
                this.x = targetX;
            }
        }

        // Keep car within canvas bounds
        this.x = Math.max(40, Math.min(canvas.width - 40 - this.width, this.x));
    }

    draw() {
        // Fallback rectangle if image isn't loaded
        if (!playerImg.complete) {
            ctx.fillStyle = '#00f3ff';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else {
            // Draw image with globalCompositeOperation to remove black background
            ctx.globalCompositeOperation = 'screen';
            ctx.drawImage(playerImg, this.x, this.y, this.width, this.height);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

class Enemy {
    constructor() {
        this.width = CAR_WIDTH;
        this.height = CAR_HEIGHT;
        this.x = 40 + Math.random() * (canvas.width - 80 - this.width);
        this.y = -this.height;
        // Enemy speed slightly varies
        this.speed = currentSpeed + (Math.random() * 2 - 1);
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        if (!enemyImg.complete) {
            ctx.fillStyle = '#ff003c';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else {
            ctx.globalCompositeOperation = 'screen';
            ctx.drawImage(enemyImg, this.x, this.y, this.width, this.height);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

function drawRoad() {
    if (currentMap === 'tron') {
        // Clear canvas with slightly transparent dark to create trailing effect for neon
        ctx.fillStyle = 'rgba(10, 10, 10, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid lines for synthwave feel
        ctx.strokeStyle = 'rgba(255, 0, 234, 0.3)';
        ctx.lineWidth = 2;

        for (let i = 0; i <= canvas.width; i += 50) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }

        roadOffset += currentSpeed;
        if (roadOffset > 50) roadOffset -= 50;

        for (let i = roadOffset; i < canvas.height; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
    } else {
        // Draw image-based backgrounds
        let bgImg = bgNeon;
        if (currentMap === 'miami') bgImg = bgMiami;
        else if (currentMap === 'race_track') bgImg = bgRaceTrack;

        roadOffset += currentSpeed;
        if (roadOffset >= canvas.height) roadOffset -= canvas.height;

        if (bgImg.complete && bgImg.naturalWidth !== 0) {
            // Draw seamless scrolling background, cropping the middle 35% to zoom in and make the road wider
            const sx = bgImg.naturalWidth * 0.325;
            const sw = bgImg.naturalWidth * 0.35;
            ctx.drawImage(bgImg, sx, 0, sw, bgImg.naturalHeight, 0, roadOffset - canvas.height, canvas.width, canvas.height);
            ctx.drawImage(bgImg, sx, 0, sw, bgImg.naturalHeight, 0, roadOffset, canvas.width, canvas.height);

            // Extend the road over the sidewalks/grass for Miami and Race Track so the car doesn't drive on them
            if (currentMap === 'miami' || currentMap === 'race_track') {
                const rColor = currentMap === 'miami' ? '104, 106, 115' : '48, 48, 48';
                
                // Left extended road (fade from sand -> solid road -> fade to center road)
                let leftGrad = ctx.createLinearGradient(20, 0, 180, 0);
                leftGrad.addColorStop(0, `rgba(${rColor}, 0)`);
                leftGrad.addColorStop(0.1875, `rgba(${rColor}, 1)`); // Solid at x=50
                leftGrad.addColorStop(0.8125, `rgba(${rColor}, 1)`); // Solid at x=150
                leftGrad.addColorStop(1, `rgba(${rColor}, 0)`);
                
                ctx.fillStyle = leftGrad;
                ctx.fillRect(20, 0, 160, canvas.height);
                
                // Right extended road (fade from center road -> solid road -> fade to buildings)
                let rightGrad = ctx.createLinearGradient(320, 0, 480, 0);
                rightGrad.addColorStop(0, `rgba(${rColor}, 0)`);
                rightGrad.addColorStop(0.1875, `rgba(${rColor}, 1)`); // Solid at x=350
                rightGrad.addColorStop(0.8125, `rgba(${rColor}, 1)`); // Solid at x=450
                rightGrad.addColorStop(1, `rgba(${rColor}, 0)`);
                
                ctx.fillStyle = rightGrad;
                ctx.fillRect(320, 0, 160, canvas.height);
                
                // Add dashed lines to make it look like extra lanes
                ctx.strokeStyle = currentMap === 'miami' ? '#ffffff' : '#888888';
                ctx.lineWidth = 4;
                ctx.setLineDash([30, 30]);
                ctx.lineDashOffset = -roadOffset;
                
                ctx.beginPath();
                ctx.moveTo(110, 0);
                ctx.lineTo(110, canvas.height);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(390, 0);
                ctx.lineTo(390, canvas.height);
                ctx.stroke();
                
                ctx.setLineDash([]);
            }
        } else {
            // Fallback if image isn't loaded yet
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw basic lines just so the player knows it's moving
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            ctx.setLineDash([30, 30]);
            ctx.lineDashOffset = -roadOffset;
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0);
            ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

function checkCollision(rect1, rect2) {
    // Hitbox tweaking for better gameplay (making it slightly smaller than the image)
    const paddingX = 10;
    const paddingY = 15;

    return (
        rect1.x + paddingX < rect2.x + rect2.width - paddingX &&
        rect1.x + rect1.width - paddingX > rect2.x + paddingX &&
        rect1.y + paddingY < rect2.y + rect2.height - paddingY &&
        rect1.y + rect1.height - paddingY > rect2.y + paddingY
    );
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    
    // High Score logic
    let finalScoreInt = Math.floor(score);
    if (finalScoreInt > highScore) {
        highScore = finalScoreInt;
        localStorage.setItem('neonRunnerHighScore', highScore);
    }
    
    // UI Updates
    finalScore.innerText = finalScoreInt;
    document.getElementById('game-over-high-score').innerText = highScore;
    
    // Random Crash Message
    const randomMessage = crashMessages[Math.floor(Math.random() * crashMessages.length)];
    document.getElementById('crash-message').innerText = randomMessage;

    scoreDisplay.style.display = 'none';
    gameOverMenu.classList.remove('hidden');
}

function gameLoop() {
    if (!isPlaying) return;

    drawRoad();

    player.update();
    player.draw();

    // Spawn enemies
    frameCount++;
    if (frameCount >= spawnRate) {
        enemies.push(new Enemy());
        frameCount = 0;
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        enemy.update();
        enemy.draw();

        // Check collision
        if (checkCollision(player, enemy)) {
            gameOver();
            return;
        }

        // Remove off-screen enemies and increase score
        if (enemy.y > canvas.height) {
            enemies.splice(i, 1);
            score += 10;
            scoreValue.innerText = Math.floor(score);
            
            // Progressive difficulty
            currentSpeed += 0.02;
            spawnRate = Math.max(15, spawnRate - 0.2); // Cap min spawn rate
        }
    }

    // Score based on survival time as well
    score += 0.05;
    scoreValue.innerText = Math.floor(score);

    animationId = requestAnimationFrame(gameLoop);
}

window.startGame = function(difficulty) {
    // Read map selection
    currentMap = document.getElementById('map-select').value;

    // Hide menus
    startMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    scoreDisplay.style.display = 'block';

    // Reset State
    score = 0;
    frameCount = 0;
    enemies = [];
    scoreValue.innerText = score;
    player = new Player();

    // Set difficulty
    switch(difficulty) {
        case 'easy':
            currentSpeed = 2.5;
            spawnRate = 120;
            break;
        case 'medium':
            currentSpeed = 5;
            spawnRate = 80;
            break;
        case 'hard':
            currentSpeed = 10;
            spawnRate = 30;
            break;
    }
    
    isPlaying = true;
    gameLoop();
}

window.showMainMenu = function() {
    gameOverMenu.classList.add('hidden');
    startMenu.classList.remove('hidden');
    
    // Update High Score Display
    document.getElementById('start-high-score').innerText = highScore;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Initial clear
showMainMenu();
