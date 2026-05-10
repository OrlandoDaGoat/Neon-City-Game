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

// Game State
let isPlaying = false;
let animationId;
let score = 0;
let baseSpeed = 5;
let currentSpeed = 5;
let spawnRate = 60; // Frames between spawns
let frameCount = 0;
let roadOffset = 0;

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

class Player {
    constructor() {
        this.width = CAR_WIDTH;
        this.height = CAR_HEIGHT;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.speed = 7;
    }

    update() {
        if ((keys.ArrowLeft || keys.a) && this.x > 0) {
            this.x -= this.speed;
        }
        if ((keys.ArrowRight || keys.d) && this.x + this.width < canvas.width) {
            this.x += this.speed;
        }
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
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        // Enemy speed slightly varies
        this.speed = currentSpeed + (Math.random() * 2 - 1);
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        // Fallback rectangle if image isn't loaded
        if (!enemyImg.complete) {
            ctx.fillStyle = '#ff003c';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else {
            // Draw image with globalCompositeOperation to remove black background
            ctx.globalCompositeOperation = 'screen';
            ctx.drawImage(enemyImg, this.x, this.y, this.width, this.height);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

function drawRoad() {
    // Clear canvas with slightly transparent dark to create trailing effect for neon
    ctx.fillStyle = 'rgba(10, 10, 10, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines for synthwave feel
    ctx.strokeStyle = 'rgba(255, 0, 234, 0.3)';
    ctx.lineWidth = 2;

    // Vertical lines (perspective)
    for (let i = 0; i <= canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }

    // Horizontal lines (moving)
    roadOffset += currentSpeed;
    if (roadOffset > 50) roadOffset = 0;

    for (let i = roadOffset; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
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
    
    // UI Updates
    finalScore.innerText = Math.floor(score);
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
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Initial clear
showMainMenu();
