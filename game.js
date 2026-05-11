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

// Processed images for solid look without black background
let processedPlayer = null;
let processedEnemy = null;

function processImage(img) {
    try {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);
        
        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // If pixel is very close to black, make it transparent
            if (data[i] < 20 && data[i+1] < 20 && data[i+2] < 20) {
                data[i+3] = 0;
            }
        }
        tempCtx.putImageData(imgData, 0, 0);
        return tempCanvas;
    } catch (e) {
        console.error("Image processing failed (likely CORS/file://):", e);
        return img; // Fallback to original image
    }
}

playerImg.onload = () => { processedPlayer = processImage(playerImg); };
enemyImg.onload = () => { processedEnemy = processImage(enemyImg); };

// Pre-define UI functions at top level to ensure they are available even if later code has issues
window.startGame = function(difficulty) {
    // Read map selection
    const mapSelect = document.getElementById('map-select');
    currentMap = mapSelect ? mapSelect.value : 'neon';

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

    // Set difficulty (hierarchical scales)
    currentDifficultyLevel = difficulty;
    switch(difficulty) {
        case 'easy':
            currentSpeed = 4.68; // +30% on top of previous +20%
            spawnRate = 120;
            break;
        case 'medium':
            currentSpeed = 7.8; // +30% on top of previous +20%
            spawnRate = 80;
            break;
        case 'hard':
            currentSpeed = 12.48; // +30% on top of previous +20%
            spawnRate = 60;
            break;
        case 'insane':
            currentSpeed = 28.6; // +30% boost
            spawnRate = 10;
            break;
    }
    
    isPlaying = true;
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.pointerEvents = 'none';
    canvas.style.pointerEvents = 'auto';
    lastTime = 0; // Reset timer for new game
    requestAnimationFrame(gameLoop);
}

window.showMainMenu = function() {
    gameOverMenu.classList.add('hidden');
    startMenu.classList.remove('hidden');
    
    // Update High Score Display
    document.getElementById('start-high-score').innerText = highScore;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.pointerEvents = 'auto';
    canvas.style.pointerEvents = 'none';
}

// Background Assets
const bgNeon = new Image();
bgNeon.src = 'assets/bg_neon.png';

const bgMiami = new Image();
bgMiami.src = 'assets/bg_miami.png';

const bgRaceTrack = new Image();
bgRaceTrack.src = 'assets/bg_race_track.png';
// Game State Variables
let isPlaying = false;
let animationId;
let score = 0;
let baseSpeed = 5;
let currentSpeed = 5;
let spawnRate = 60; // Frames between spawns
let frameCount = 0;
let roadOffset = 0;
let lastTime = 0;

// New Features State
let highScores = {
    easy: parseInt(localStorage.getItem('neonRunner_easy')) || 0,
    medium: parseInt(localStorage.getItem('neonRunner_medium')) || 0,
    hard: parseInt(localStorage.getItem('neonRunner_hard')) || 0,
    insane: parseInt(localStorage.getItem('neonRunner_insane')) || 0
};
// Legacy support for global high score
let highScore = Math.max(localStorage.getItem('neonRunnerHighScore') || 0, highScores.easy, highScores.medium, highScores.hard, highScores.insane);

let insaneLoses = 0; // Session-based jumpscare counter
let resetSlipCount = 0; // Tracking "My finger slipped" instances
let currentMap = 'neon';
let currentDifficultyLevel = 'medium';

// Car Dimensions
const CAR_WIDTH = 72;  // 20% bigger (60 -> 72)
const CAR_HEIGHT = 120; // 20% bigger (100 -> 120)

// Entities
let player;
let enemies = [];

// Classes (Must be defined before startGame uses them)
class Player {
    constructor() {
        this.width = CAR_WIDTH;
        this.height = CAR_HEIGHT;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.speed = 12; // Increased from 7 for faster response
    }

    update(dt) {
        let moving = false;
        const adjustedSpeed = this.speed * dt;

        if ((keys.ArrowLeft || keys.a || touchSide === 'left') && this.x > 0) {
            this.x -= adjustedSpeed;
            moving = true;
        }
        if ((keys.ArrowRight || keys.d || touchSide === 'right') && this.x + this.width < canvas.width) {
            this.x += adjustedSpeed;
            moving = true;
        }

        // Mouse follow movement
        if (targetX !== null) {
            const centerX = this.x + this.width / 2;
            const diffX = targetX - centerX;

            // X Movement only
            if (Math.abs(diffX) > 5) {
                if (diffX > 0 && this.x + this.width < canvas.width) {
                    this.x += Math.min(diffX, adjustedSpeed);
                    moving = true;
                } else if (diffX < 0 && this.x > 0) {
                    this.x += Math.max(diffX, -adjustedSpeed);
                    moving = true;
                }
            }
        }

        // Keep car within canvas bounds
        const margin = 20;
        this.x = Math.max(margin, Math.min(canvas.width - margin - this.width, this.x));
    }

    draw() {
        if (processedPlayer) {
            ctx.drawImage(processedPlayer, this.x, this.y, this.width, this.height);
        } else if (playerImg.complete) {
            ctx.drawImage(playerImg, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#00f3ff';
            ctx.fillRect(this.x, this.y, this.width, this.height);
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

    update(dt) {
        this.y += this.speed * dt;
    }

    draw() {
        if (processedEnemy) {
            ctx.drawImage(processedEnemy, this.x, this.y, this.width, this.height);
        } else if (enemyImg.complete) {
            ctx.drawImage(enemyImg, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#ff003c';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

let stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * 500, // canvas width
        y: Math.random() * 800, // canvas height
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1
    });
}

function updateHighScoreUI() {
    document.getElementById('start-high-score').innerText = highScore;
    // Update modal elements
    const hsEasy = document.getElementById('hs-easy');
    const hsMedium = document.getElementById('hs-medium');
    const hsHard = document.getElementById('hs-hard');
    const hsInsane = document.getElementById('hs-insane');
    
    if (hsEasy) hsEasy.innerText = highScores.easy;
    if (hsMedium) hsMedium.innerText = highScores.medium;
    if (hsHard) hsHard.innerText = highScores.hard;
    if (hsInsane) hsInsane.innerText = highScores.insane;
}
updateHighScoreUI();

// Responsive Canvas Logic
function resizeCanvas() {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Update stars on resize
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }

    // If player exists, reposition it
    if (player) {
        player.y = canvas.height - player.height - 20;
    }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);
resizeCanvas();

// High Score Modal & Reset Logic
const hsModal = document.getElementById('hs-modal');
const hsViewScreen = document.getElementById('hs-view-screen');
const hsResetScreen = document.getElementById('hs-reset-screen');
const resetPrompt = document.getElementById('reset-prompt');
const resetButtons = document.getElementById('reset-buttons');

window.toggleHSModal = function(show) {
    if (show) {
        hsModal.classList.remove('hidden');
        hsViewScreen.classList.remove('hidden');
        hsResetScreen.classList.add('hidden');
    } else {
        hsModal.classList.add('hidden');
    }
};

window.startResetFlow = function() {
    hsViewScreen.classList.add('hidden');
    hsResetScreen.classList.remove('hidden');
    showResetStep(1);
};

function showResetStep(step) {
    resetButtons.innerHTML = '';
    
    const goodCall = () => {
        resetPrompt.innerText = "Good call. You ain't hitting those scores again.";
        resetButtons.innerHTML = '<button class="btn btn-retry" style="width: 100%" onclick="toggleHSModal(false)">THANKS...</button>';
    };

    if (step === 1) {
        resetPrompt.innerText = "Are you sure?";
        createResetBtn("Yes", () => showResetStep(2));
        createResetBtn("No", () => showResetStep(3));
    } else if (step === 2) {
        resetPrompt.innerText = "Are you sure you're sure?";
        createResetBtn("Yes", () => showResetStep(4));
        createResetBtn("No", goodCall);
    } else if (step === 3) {
        resetPrompt.innerText = "Why'd you even click reset scores in the first place?";
        createResetBtn("My finger slipped...", () => {
            resetSlipCount++;
            if (resetSlipCount === 1) {
                resetPrompt.innerText = "Dont let it happen again!";
                resetButtons.innerHTML = '<button class="btn btn-retry" style="width: 100%" onclick="toggleHSModal(false)">OK...</button>';
            } else if (resetSlipCount === 2) {
                resetPrompt.innerText = "And you went and let it happen again...";
                resetButtons.innerHTML = '';
                createResetBtn("ok so now what?", () => {
                    resetPrompt.innerText = "Now you reap the consequences!";
                    resetButtons.innerHTML = '';
                    // Trigger jumpscare
                    playScream();
                    const overlay = document.getElementById('jumpscare-overlay');
                    setTimeout(() => {
                        overlay.classList.remove('hidden');
                        setTimeout(() => {
                            overlay.classList.add('hidden');
                            toggleHSModal(false);
                        }, 2000);
                    }, 1000);
                });
            } else {
                // 3rd time or more
                resetPrompt.innerText = "there's no way you wanted to get jumpscared again. Logic says that you must be an idiot.";
                resetButtons.innerHTML = '';
                createResetBtn("ugghhh", () => {
                    resetPrompt.innerText = "I'll give you another chance... What's 9 + 10?";
                    resetButtons.innerHTML = '';
                    const handleMath = () => {
                        resetPrompt.innerText = "Congrats you uncultured swine! It was 67!! The internet is no place for idiots. You're router just got fried!";
                        resetButtons.innerHTML = '';
                        setTimeout(triggerFakeCrash, 5500);
                    };
                    createResetBtn("19", handleMath);
                    createResetBtn("21", handleMath);
                });
            }
        });
        createResetBtn("Porque me dio la gana", () => {
            resetPrompt.innerText = "Oh you think it's funny talking in another language I dont understand? 打死我也不信你真费那个劲把这堆狗屎给翻译出来了。赶紧找点正经事做去吧！";
            resetButtons.innerHTML = '';
            const huhBtn = document.createElement('button');
            huhBtn.className = 'btn';
            huhBtn.innerText = "huh?";
            huhBtn.onclick = () => {
                performActualReset();
                toggleHSModal(false);
            };
            resetButtons.appendChild(huhBtn);
        });
    } else if (step === 4) {
        resetPrompt.innerText = "Are you really sure? There's no going back.";
        createResetBtn("Yes", () => showResetStep(5));
        createResetBtn("No", () => {
            performActualReset();
            resetPrompt.innerText = "You just clicked yes 3 times in a row to back out now? That just pissed me off. Idc! RESET SCORES!";
            resetButtons.innerHTML = '<button class="btn btn-retry" style="width: 100%" onclick="toggleHSModal(false)">DANM...</button>';
        });
    } else if (step === 5) {
        resetPrompt.innerText = "Are you so sure that you would stake your life that there has not been another human in existence as sure as you are right now?";
        createResetBtn("Yes", () => {
            performActualReset();
            resetPrompt.innerText = "Yeah, right...";
            resetButtons.innerHTML = '<button class="btn btn-retry" style="width: 100%" onclick="toggleHSModal(false)">FINALLY</button>';
        });
        createResetBtn("No", () => showResetStep(6));
    } else if (step === 6) {
        resetPrompt.innerText = "How can you ever confirm your beliefs if you don't stick by what you claim to be sure of until the bitter end?";
        createResetBtn("cuz I'm like that", () => {
            performActualReset();
            resetPrompt.innerText = "yeah... you're not that guy pal.";
            resetButtons.innerHTML = '<button class="btn btn-retry" style="width: 100%" onclick="toggleHSModal(false)">Ouch.</button>';
        });
        createResetBtn("cuz I'm woke", () => {
            resetPrompt.innerText = "Not with the scores you're trying to reset you're not. I'd wanna reset them too.";
            resetButtons.innerHTML = '<button class="btn btn-retry" style="width: 100%" onclick="toggleHSModal(false)">HEY!</button>';
        });
        createResetBtn("my name is Jeff", () => {
            resetPrompt.innerText = "Yup that was the last straw...";
            resetButtons.innerHTML = '';
            setTimeout(() => {
                alert("ERROR: you've been banned from the game.");
                location.reload(); // "Banned" by refreshing/resetting the session
            }, 2000);
        });
    }
}

function createResetBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.innerText = text;
    btn.onclick = onClick;
    resetButtons.appendChild(btn);
}

function performActualReset() {
    highScores = { easy: 0, medium: 0, hard: 0, insane: 0 };
    highScore = 0;
    localStorage.removeItem('neonRunnerHighScore');
    localStorage.setItem('neonRunner_easy', 0);
    localStorage.setItem('neonRunner_medium', 0);
    localStorage.setItem('neonRunner_hard', 0);
    localStorage.setItem('neonRunner_insane', 0);
    updateHighScoreUI();
}

// Pre-load and unlock audio
let audioUnlocked = false;
const screamAsset = document.getElementById('scream-asset');

window.testSound = function() {
    screamAsset.play().then(() => {
        alert("Success! The FNAF scream is playing.");
        audioUnlocked = true;
    }).catch(e => {
        // Fallback: Try to synthesize a beep
        try {
            const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = tempCtx.createOscillator();
            osc.connect(tempCtx.destination);
            osc.start();
            osc.stop(tempCtx.currentTime + 0.2);
            alert("The file 'assets/scream.wav' exists but the browser can't play it. Error: " + e.message);
        } catch(err) {
            alert("Audio is strictly blocked. Check browser settings.");
        }
    });
};

function playScream() {
    screamAsset.currentTime = 0;
    screamAsset.play().catch(e => console.log("Scream failed:", e));
}

function triggerFakeCrash() {
    const crashDiv = document.createElement('div');
    crashDiv.className = 'crash-overlay';
    
    let codeText = "";
    for(let i=0; i<20; i++) {
        codeText += `segment .text\n  global _start\n_start:\n  mov eax, 1\n  mov ebx, 0\n  int 0x80\n0x${Math.random().toString(16).substr(2, 8)} CRITICAL_FAILURE\n`;
    }
    
    crashDiv.innerHTML = `<div>${codeText}</div><div class="crash-message-big">You're router just got fried!</div>`;
    document.body.appendChild(crashDiv);
    
    // Disable everything
    isPlaying = false;
    cancelAnimationFrame(animationId);
}

window.addEventListener('mousedown', () => {
    if (!audioUnlocked) {
        // Play and immediately pause to unlock
        screamAsset.play().then(() => {
            screamAsset.pause();
            screamAsset.currentTime = 0;
            audioUnlocked = true;
        }).catch(e => console.log("Unlock failed:", e));
    }
}, { once: true });

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

// Input
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    a: false,
    d: false,
    w: false,
    s: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

let touchSide = null; // 'left', 'right', or null
let targetX = null;
let targetY = null;

canvas.addEventListener('touchstart', (e) => {
    if (isPlaying) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[e.touches.length - 1];
        const x = touch.clientX - rect.left;
        
        targetX = x;
        targetY = null; // Reverted Y
        touchSide = x < rect.width / 2 ? 'left' : 'right';
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (isPlaying) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[e.touches.length - 1];
        const x = touch.clientX - rect.left;
        
        targetX = x;
        targetY = null; // Reverted Y
        touchSide = x < rect.width / 2 ? 'left' : 'right';
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    targetX = null;
    targetY = null;
    if (e.touches.length === 0) {
        touchSide = null;
    } else {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[e.touches.length - 1];
        const x = touch.clientX - rect.left;
        targetX = x;
        targetY = null;
        touchSide = x < rect.width / 2 ? 'left' : 'right';
    }
});

// Mouse support: Follow mouse position without clicking
window.addEventListener('mousemove', (e) => {
    if (isPlaying) {
        const rect = canvas.getBoundingClientRect();
        targetX = e.clientX - rect.left;
        targetY = null; // Reverted Y
        touchSide = null; 
    }
});

// Reset targetX when mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
    targetX = null;
});


function drawRoad(dt) {
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

        roadOffset += currentSpeed * dt;
        if (roadOffset > 50) roadOffset -= 50;

        for (let i = roadOffset; i < canvas.height; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
    } else if (currentMap === 'rainbow') {
        // Space background
        ctx.fillStyle = '#050010';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Parallax Stars
        ctx.fillStyle = '#ffffff';
        stars.forEach(star => {
            star.y += currentSpeed * 0.2 * dt;
            if (star.y > canvas.height) star.y = 0;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Rainbow Road
        const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8b00ff'];
        const stripeWidth = canvas.width / colors.length;
        
        roadOffset += currentSpeed * dt;
        if (roadOffset >= 100) roadOffset -= 100;

        colors.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(i * stripeWidth, 0, stripeWidth, canvas.height);
            
            // Tiles for motion
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            for (let y = (roadOffset % 100); y < canvas.height; y += 100) {
                ctx.fillRect(i * stripeWidth, y, stripeWidth, 50);
            }
        });
        ctx.globalAlpha = 1.0;

        // Glowing rails
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00f3ff';
        ctx.beginPath();
        ctx.moveTo(2, 0); ctx.lineTo(2, canvas.height);
        ctx.moveTo(canvas.width-2, 0); ctx.lineTo(canvas.width-2, canvas.height);
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else {
        // Draw image-based backgrounds
        let bgImg = bgNeon;
        if (currentMap === 'miami') bgImg = bgMiami;
        else if (currentMap === 'race_track') bgImg = bgRaceTrack;

        roadOffset += currentSpeed * dt;
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
                const sideWidth = canvas.width * 0.32; // Responsive side width
                
                // Left extended road
                let leftGrad = ctx.createLinearGradient(0, 0, sideWidth, 0);
                leftGrad.addColorStop(0, `rgba(${rColor}, 0)`);
                leftGrad.addColorStop(0.2, `rgba(${rColor}, 1)`);
                leftGrad.addColorStop(0.8, `rgba(${rColor}, 1)`);
                leftGrad.addColorStop(1, `rgba(${rColor}, 0)`);
                
                ctx.fillStyle = leftGrad;
                ctx.fillRect(0, 0, sideWidth, canvas.height);
                
                // Right extended road
                let rightGrad = ctx.createLinearGradient(canvas.width - sideWidth, 0, canvas.width, 0);
                rightGrad.addColorStop(0, `rgba(${rColor}, 0)`);
                rightGrad.addColorStop(0.2, `rgba(${rColor}, 1)`);
                rightGrad.addColorStop(0.8, `rgba(${rColor}, 1)`);
                rightGrad.addColorStop(1, `rgba(${rColor}, 0)`);
                
                ctx.fillStyle = rightGrad;
                ctx.fillRect(canvas.width - sideWidth, 0, sideWidth, canvas.height);
                
                // Add dashed lines
                ctx.strokeStyle = currentMap === 'miami' ? '#ffffff' : '#888888';
                ctx.lineWidth = 4;
                ctx.setLineDash([30, 30]);
                ctx.lineDashOffset = -roadOffset;
                
                ctx.beginPath();
                ctx.moveTo(sideWidth * 0.6, 0);
                ctx.lineTo(sideWidth * 0.6, canvas.height);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(canvas.width - sideWidth * 0.6, 0);
                ctx.lineTo(canvas.width - sideWidth * 0.6, canvas.height);
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
    
    // Update global high score
    if (finalScoreInt > highScore) {
        highScore = finalScoreInt;
        localStorage.setItem('neonRunnerHighScore', highScore);
    }
    
    // Update difficulty-specific high score
    if (finalScoreInt > highScores[currentDifficultyLevel]) {
        highScores[currentDifficultyLevel] = finalScoreInt;
        localStorage.setItem(`neonRunner_${currentDifficultyLevel}`, finalScoreInt);
    }
    
    updateHighScoreUI();
    
    // UI Updates
    finalScore.innerText = finalScoreInt;
    document.getElementById('game-over-high-score').innerText = highScores[currentDifficultyLevel];
    
    // Random Crash Message
    const insaneContent = document.getElementById('insane-loser-content');
    const easyContent = document.getElementById('easy-loser-content');
    const mediumContent = document.getElementById('medium-loser-content');
    const hardContent = document.getElementById('hard-loser-content');
    const crashMessage = document.getElementById('crash-message');

    // Reset visibility
    insaneContent.classList.add('hidden');
    easyContent.classList.add('hidden');
    mediumContent.classList.add('hidden');
    hardContent.classList.add('hidden');

    if (currentDifficultyLevel === 'insane') {
        insaneLoses++;

        if (insaneLoses % 2 === 0) {
            // JUMPSCARE!
            const overlay = document.getElementById('jumpscare-overlay');
            
            // Start audio immediately (since it has 1s of silence)
            playScream();

            // Show visual 1 second later to match the sound
            setTimeout(() => {
                overlay.classList.remove('hidden');
                setTimeout(() => {
                    overlay.classList.add('hidden');
                }, 2000); // Keep it on screen for 2s after it appears
            }, 1000);

            // Change message for jumpscare rounds
            document.getElementById('crash-message').innerText = "Told you so";
        } else {
            // Normal Insane loss message
            document.getElementById('crash-message').innerText = "I don't know who you think you are, but you better go back to easy mode...or else..";
        }

        insaneContent.classList.remove('hidden');
        crashMessage.style.color = "#ff0000";
        crashMessage.style.fontSize = "18px";
    } else if (currentDifficultyLevel === 'easy') {
        easyContent.classList.remove('hidden');
        crashMessage.innerText = "Losing on easy? Seriously?";
        crashMessage.style.color = "#00f3ff";
    } else if (currentDifficultyLevel === 'medium') {
        mediumContent.classList.remove('hidden');
        crashMessage.innerText = "Mid difficulty, mid player.";
        crashMessage.style.color = "#ff00ea";
    } else if (currentDifficultyLevel === 'hard') {
        hardContent.classList.remove('hidden');
        crashMessage.innerText = "Just go back to easy bro";
        crashMessage.style.color = "#ff0000";
    } else {
        const randomMessage = crashMessages[Math.floor(Math.random() * crashMessages.length)];
        crashMessage.innerText = randomMessage;
        crashMessage.style.color = ""; // Reset to default
        crashMessage.style.fontSize = "";
    }

    scoreDisplay.style.display = 'none';
    gameOverMenu.classList.remove('hidden');
    document.getElementById('ui-layer').style.pointerEvents = 'auto';
    canvas.style.pointerEvents = 'none';
}

function gameLoop(currentTime) {
    if (!isPlaying) return;

    // Calculate delta time
    if (!lastTime) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 16.666; // Normalize to 60fps
    lastTime = currentTime;

    // Cap deltaTime to prevent huge jumps (e.g. after backgrounding)
    const dt = Math.min(deltaTime, 3);

    drawRoad(dt);

    player.update(dt);
    player.draw();

    // Spawn enemies
    frameCount += dt;
    if (frameCount >= spawnRate) {
        enemies.push(new Enemy());
        frameCount = 0;
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        enemy.update(dt);
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
            
            // Progressive difficulty scaled by mode
            const difficultyScale = {
                'easy': 0.005,
                'medium': 0.015,
                'hard': 0.03,
                'insane': 0.1
            };
            const scale = difficultyScale[currentDifficultyLevel] || 0.01;
            currentSpeed += scale;
            spawnRate = Math.max(10, spawnRate - (scale * 5));
        }
    }

    // Score based on survival time as well
    score += 0.05 * dt;
    scoreValue.innerText = Math.floor(score);

    animationId = requestAnimationFrame(gameLoop);
}

// Initial clear
showMainMenu();
