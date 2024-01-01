import { updateInput, isActionJustPressed } from "../lib/input.js"
import { addLayer, createWindow, gameState, setGameState, layers, width, height, textures, preloadAll } from "../lib/globals.js";
import { Vector2, randomInt } from "../lib/math.js";
import { choose, delay, isAlpha } from "../lib/utils.js";
import { Emitter } from "../lib/particle.js";
import { AudioStream } from "../lib/audio.js";


createWindow(240, 200, 2);
addLayer("main", 1, false);
addLayer("heartParticle", 2, false);
addLayer("vanishParticle", 3, false);
addLayer("spawnParticle", 3, false);
addLayer("deadParticle", 3, false);


let urls = {
    start: "./src/assets/startscreen.png",
    gameover: "./src/assets/gameover.png",
    bg: "./src/assets/background.png",
    heart: "./src/assets/particles/heart.png",
    vanish: "./src/assets/particles/vanish.png",
    generic1: "./src/assets/particles/generic1.png",
}

await preloadAll(urls);


let sfxBlip = [
    new AudioStream("./src/assets/sfx/blip1.wav"),
    new AudioStream("./src/assets/sfx/blip2.wav"),
    new AudioStream("./src/assets/sfx/blip3.wav"),
]
let sfxExplode = [
    new AudioStream("./src/assets/sfx/explode1.wav"),
    new AudioStream("./src/assets/sfx/explode2.wav"),
]
let sfxJump = new AudioStream("./src/assets/sfx/jump1.wav");
let sfxPick = new AudioStream("./src/assets/sfx/pick1.wav");



class TargetSize {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.vely = 0;
        this.gravity = 20;
        this.jumpForce = -120;
        this.value = value;
    }

    update(deltaTime) {
        this.vely += this.gravity;
		this.y += this.vely * deltaTime;

        if (this.y > height - 50) {
            this.y = height - 50;
        }
    }

    jump() {
        this.vely = this.jumpForce;
    }

    draw(ctx) {
        ctx.font = "24px roboto";
        ctx.fillText(this.value, this.x, this.y);
    }

    updateValue(possibleSizes) {
        if (possibleSizes.length > 0) {
            this.value = choose(possibleSizes);
        }
    }
}
class FallingWord {
    constructor(text, x, y, textSize) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.textSize = textSize;
        this.fallSpeed = randomInt(5, 10);
        this.hasHeart = randomInt(1, 4) === 1;

        this.typed = "";
    }

    update(deltaTime) {
        this.y += this.fallSpeed * deltaTime;
    }

    draw(ctx) {
        ctx.fillStyle = "#55f";
        ctx.font = "16px m5x7";
        ctx.fillText(this.text, this.x, this.y);
        ctx.fillStyle = "#ccc";
        ctx.fillText(this.typed, this.x, this.y);

        if (this.hasHeart) {
            ctx.drawImage(textures.heart, this.x - 10, this.y - 8);
        }
    }
}


let targetSize = new TargetSize(width/2 - 8, height - 50, 6);

const wordDB = [
    "blue", "lamp", "star", "fish", "code", "bird", "book", "tree", "moon", "rose", 
    "gold", "fire", "song", "time", "hope", "wind", "dark", "lake", "ship", "wave",
    "apple", "happy", "music", "beach", "water", "cloud", "table", "space", "earth", "dream", 
    "smile", "grape", "ocean", "sunny", "green", "peace", "light", "stone", "laugh",
    "guitar", "flower", "orange", "summer", "planet", "purple", "coffee", "forest", "friend", "banana", 
    "cookie", "sunset", "puzzle", "bridge", "garden", "singer", "piano", "turtle", "wisdom",
    "library", "rainbow", "journey", "victory", "silence", "freedom", "morning", "concert", "picture", 
    "balance", "wonder", "diamond", "village", "blessed", "perfect", "breathe", "sunrise", "whisper", "courage",
    "mountain", "beautiful", "bluebird", "sunshine", "triangle", "laughter", "remember", 
    "umbrella", "firework", "raindrop", "tomorrow", "silhouette", "wonderful", "happiness", "treasure"
];

let usedWords = [];
let fallingWordPool = [];
let textInput = "";
let inputMaxSize = 10

let lives = 4;
let score = 0;

let fontSize = 16;



let spawnInterval = 5000;
let spawnLastUpdateTime = performance.now();
function spawnFallingWord() {
    // Create fallingWord if only one is on screen;
    if (fallingWordPool.length < 2) {
        // Randomize the quantity;
        for (let i = 0; i < randomInt(0, 2); i++) {
            generateFallingWord();
        }
    }

    // Spawn new fallingWord periodically;
    let currentTime = performance.now();
    let spawnElapsedTime = currentTime - spawnLastUpdateTime
    
    if (spawnElapsedTime > spawnInterval) {
        // Randomize the quantity;
        for (let i = 0; i < randomInt(0, 2); i++) {
            generateFallingWord();
        }

        spawnLastUpdateTime = currentTime;
    }
}

function generateFallingWord() {
    let minX = 5,
        maxX = width - 50;
    let x = randomInt(minX, maxX);

    let text = "";
    
    // Pick a word that is not currently being used
    do {
        text = choose(wordDB);
    } while (usedWords.includes(text));


    let fallingWord = new FallingWord(text, x, 0, text.length);

    usedWords.push(text);
    fallingWordPool.push(fallingWord);

    fireWordSpawnParticle(fallingWord);
}

function matchInputWord() {
    for (let i = 0; i < fallingWordPool.length; i++) {
        let fallingWord = fallingWordPool[i];

        if (fallingWord.text.startsWith(textInput)) {
            fallingWord.typed = textInput;

            let validWord = fallingWord.text === fallingWord.typed && 
                            fallingWord.textSize === targetSize.value;
            
            let validWordWrongSize = fallingWord.text === fallingWord.typed && 
                                     fallingWord.textSize !== targetSize.value;

            if (validWord) {
                if (fallingWord.hasHeart) {
                    sfxPick.play(0.1);
                    fireHeartParticle();

                    // Wait for effects before increasing lives;
                    delay(300).then(() => { lives += 1; })
                }

                // Play effects;
                sfxJump.play(0.1);
                targetSize.jump();
                fireWordVanishParticle(fallingWord);
                
                // Remove word from lists, reset textInput and increase score;
                fallingWordPool.splice(i, 1);
                usedWords.splice(i, 1);
                textInput = "";

                score += 1;
                speedUpGame();

                getNextTargetSize();

                i--;
            } else if (validWordWrongSize) {
                sfxExplode[0].play(0.1);
                lives -= 1

                textInput = "";
                fallingWord.typed = "";
            }
        } else {
            fallingWord.typed = "";
        }
    }
}

function getInitialTargetSize(){
    let possibleSizes = [];
    for (const text of usedWords) {
        possibleSizes.push(text.length);
    }

    if (!possibleSizes.includes(targetSize.value)) {
        targetSize.updateValue(possibleSizes);
    }
}

function getNextTargetSize() {
    let possibleSizes = [];
    for (const text of usedWords) {
        possibleSizes.push(text.length);
    }

    targetSize.updateValue(possibleSizes);
}

function speedUpGame() {
    let minimumSpawnInterval = 1500;
    let reductionAmount = 80;

    spawnInterval -= reductionAmount;
    if (spawnInterval < minimumSpawnInterval) {
        spawnInterval = minimumSpawnInterval;
    }
}


function fireHeartParticle() {
    let particleConfig = {
        context: layers.heartParticle,
        texture: textures.heart,
        oneshot: true,
        lifetime: 0.2,
        emissionShape: { width: 10, height: 10 },
        position: new Vector2(lives * 9 + 2, height - 9),
        gravity: new Vector2(0, 1),
        direction: new Vector2(0, -1),
        spread: 360,
        speed: 20,
        startScale: 0.5,
        endScale: 0.1,
    };
    
    let emitterConfig = {
        context: layers.heartParticle,
        position: particleConfig.position,
        maxParticles: 100,
        isExplosive: false,
        useGlobalPosition: true,
    }

    let emi = new Emitter(particleConfig, emitterConfig);
    emi.start();
}
function fireWordVanishParticle(fallingWord) {
    let [w, h, x, y] = [
        fallingWord.textSize * fontSize/2, 
        fontSize/2, 
        fallingWord.x + fallingWord.textSize * 2, 
        fallingWord.y
    ];


    let particleConfig = {
        context: layers.vanishParticle,
        texture: textures.vanish,
        oneshot: true,
        lifetime: 0.2,
        emissionShape: { width: w/2, height: h/2 },
        position: new Vector2(x, y),
        gravity: new Vector2(0, 0),
        direction: new Vector2(0, -1),
        spread: 360/4,
        speed: 20,
        startScale: 0.5,
        endScale: 0.1,
    };
    
    let emitterConfig = {
        context: layers.vanishParticle,
        position: particleConfig.position,
        maxParticles: 100,
        isExplosive: false,
        useGlobalPosition: true,
    }

    let emi = new Emitter(particleConfig, emitterConfig);
    emi.start();
}
function fireWordSpawnParticle(fallingWord) {
    let [w, h, x, y] = [
        fallingWord.textSize * fontSize/2, 
        fontSize/2, 
        fallingWord.x + fallingWord.textSize * 2, 
        fallingWord.y
    ];

    let particleConfig = {
        context: layers.spawnParticle,
        texture: textures.generic1,
        oneshot: true,
        lifetime: 0.2,
        emissionShape: { width: w, height: h },
        position: new Vector2(x, y),
        gravity: new Vector2(0, 1),
        direction: new Vector2(0, 1),
        spread: 360/8,
        speed: 10,
        startScale: 0.5,
        endScale: 0.1,
    };
    
    let emitterConfig = {
        context: layers.spawnParticle,
        position: particleConfig.position,
        maxParticles: 100,
        isExplosive: false,
        useGlobalPosition: true,
    }

    let emi = new Emitter(particleConfig, emitterConfig);
    emi.start();
}
function fireDeadParticle(fallingWord) {
    let [w, h, x, y] = [
        fallingWord.textSize * fontSize/2, 
        fontSize/2, 
        fallingWord.x + fallingWord.textSize * 2, 
        fallingWord.y - 8
    ];


    let particleConfig = {
        context: layers.deadParticle,
        texture: textures.generic1,
        oneshot: true,
        lifetime: 0.2,
        emissionShape: { width: w, height: h },
        position: new Vector2(x, y),
        gravity: new Vector2(0, 1),
        direction: new Vector2(0, 1),
        spread: 360/8,
        speed: 10,
        startScale: 0.5,
        endScale: 0.1,
    };
    
    let emitterConfig = {
        context: layers.deadParticle,
        position: particleConfig.position,
        maxParticles: 100,
        isExplosive: false,
        useGlobalPosition: true,
    }

    let emi = new Emitter(particleConfig, emitterConfig);
    emi.start();
}


function update(deltaTime) {
    // Update all fallingWords y position and check if out of screen;
    for (let i = 0; i < fallingWordPool.length; i++) {
        const fallingWord = fallingWordPool[i];
        fallingWord.update(deltaTime);

        // fallingWord is out of screen;
        if (fallingWord.y > height + 4) {
            // Play effects;
            sfxExplode[randomInt(0, 1)].play(0.1);
            fireDeadParticle(fallingWord);
            
            // Remove word from lists and decrease lives;
            fallingWordPool.splice(i, 1);
            usedWords.splice(i, 1);
            
            lives -= 1;
            i--;
        }
    }

    // targetSize.update() is used for simple physics calculation for jump effect;
    getInitialTargetSize();
    targetSize.update(deltaTime);
    
    spawnFallingWord();


    if (lives == 0) {
        setGameState("gameover");
    } 
}

// Draw
function drawStart() {
    let ctx = layers.main;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(textures.start, 0, 0);
};
function drawGameOver() {
    let ctx = layers.main;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(textures.gameover, 0, 0);

    ctx.fillStyle = "#55f";
    ctx.font = "16px m5x7";
    ctx.fillText("Score: " + score, width/2 - 24, height/2 + 8);
};
function draw() {
    let ctx = layers.main;
    ctx.drawImage(textures.bg, 0, 0);
    
    for (const word of fallingWordPool) {
        word.draw(ctx);
    }

    // Draw typed input;
    ctx.font = `${fontSize}px m5x7`;
    let inputX = width/2 - (6 * textInput.length/2),
        inputY = height - 20;
    ctx.fillText(textInput, inputX, inputY);

    // Draw score;
    ctx.fillText(score, 3, 10);

    // Draw lives;
    for (let i = 0; i < lives; i++) {
        ctx.drawImage(textures.heart, i * 9, height - 10);        
    }

    // Draw targetSize
    targetSize.draw(ctx);
}

// Gameloop
let lastUpdateTime = performance.now();

function gameLoop() {
    updateInput();
    
    const currentTime = performance.now();
    const elapsedTime = currentTime - lastUpdateTime;
    let deltaTime = elapsedTime/1000;

    if (gameState === "start") { 
        score = 0;
        lives = 4;
        usedWords = [];
        fallingWordPool = [];
        textInput = "";
        
        drawStart(); 
    }
    else if (gameState === "gameover") { drawGameOver(); }
    else if (gameState === "run") {
        update(deltaTime);
        draw();
    }

    // Handle States
    if (isActionJustPressed("start") && gameState === "start") {
        setGameState("run");
    }
    else if (isActionJustPressed("restart") && gameState === "gameover") { 
        setGameState("start"); 
    }

    lastUpdateTime = currentTime;
    requestAnimationFrame(gameLoop);
}

gameLoop();


window.addEventListener("keydown", (event) => {
    event.preventDefault();

    if (gameState != "run") {
        return;
    }

    // Only alphanumeric characters allowed;
    if (isAlpha(event.key) && textInput.length < inputMaxSize) {
        textInput += event.key;
        sfxBlip[randomInt(0, 2)].play(0.08);
    } else if (event.key === "Backspace") {
        textInput = "";
        sfxBlip[2].play(0.08);
    }

    textInput = textInput.toLowerCase();

    matchInputWord();
});