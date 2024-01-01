import { height, width } from "./globals.js";
import { Vector2, lerp, mapValue, randomInt, toRadians } from "./math.js";

// Basic Particle system.
export class Particle {
    constructor({context, texture, oneshot, lifetime, emissionShape, position, gravity, direction, spread, speed, startScale, endScale}) {
        this.active = false;

        this.context = context;
        this.texture = texture;
        this.oneshot = oneshot;
        this.startLifetime = lifetime;
        this.lifetime = lifetime;
        this.emissionShape = emissionShape;
        
        this.gravity = gravity
        
        this.acceleration = new Vector2(0, 0);
        this.startPosition = position;
        this.position = position;
        this.startDirection = direction;
        this.direction = direction;
        this.spread = toRadians(spread);
        this.startSpeed = speed;
        this.startScale = startScale;
        this.endScale = endScale;
        this.scale = startScale;

        this.startAngle = direction.toAngle();
        let randomAngle = (Math.random() * this.spread) - (this.spread / 2);
        this.randomDirection = Vector2.fromAngle(this.startAngle + randomAngle);

        this.velocity = this.randomDirection.multiply(speed);

        this.getPointInsideEmissionShape();
    }

    applyForce() {
        let force = this.gravity;
        this.acceleration = this.acceleration.add(force);
    }

    update(deltaTime) {
        if (!this.active) { return; }

        this.lifetime -= deltaTime;
        
        let t = mapValue(this.lifetime, 0, this.startLifetime, 0, 1);
        this.scale = lerp(this.startScale, this.endScale, 1 - t);


        if (this.lifetime > 0) {
            // Euler integration to get particle position
            // based on start speed and forces applied to it.
            this.applyForce();
            this.velocity = this.velocity.add(this.acceleration.multiply(deltaTime));
            this.position = this.position.add(this.velocity.multiply(deltaTime));
            this.position.snapToPixel();

            this.acceleration.x = 0;
            this.acceleration.y = 0;

            this.draw();
        } else {
            this.active = false;

            if (this.oneshot === false) {
                this.reset();
            }
        }
    }

    draw() {
        let newWidth = Math.ceil(this.texture.naturalWidth * this.scale);
        let newHeight = Math.ceil(this.texture.naturalHeight * this.scale);

        this.context.drawImage(this.texture, this.position.x, this.position.y, newWidth, newHeight);
        // this.drawEmissionShape();
    }

    drawEmissionShape() {
        let halfWidth = this.emissionShape.width / 2;
        let halfHeight = this.emissionShape.height / 2;
        let startX = this.startPosition.x - halfWidth;
        let startY = this.startPosition.y - halfHeight;

        this.context.lineWidth = 1;
        this.context.strokeRect(startX, startY, this.emissionShape.width, this.emissionShape.height);
    }

    reset() {
        this.position = this.startPosition;
        this.getPointInsideEmissionShape();

        // Calculate new direction based on spread angle.
        let randomAngle = (Math.random() * this.spread - this.spread / 2);
        this.randomDirection = Vector2.fromAngle(this.startAngle + randomAngle);
        this.velocity = this.randomDirection.multiply(this.startSpeed);

        this.acceleration = new Vector2(0, 0);
        this.lifetime = this.startLifetime;

        this.scale = this.startScale
    }

    getPointInsideEmissionShape() {
        let halfWidth = this.emissionShape.width / 2;
        let halfHeight = this.emissionShape.height / 2;
        let startX = this.position.x - halfWidth;
        let endX = this.position.x + halfWidth;
        let startY = this.position.y - halfHeight;
        let endY = this.position.y + halfHeight;
        
        // Calculate a random point inside the rectangle
        let newPosition = new Vector2(randomInt(startX, endX), randomInt(startY, endY))
        this.position = newPosition;
    }
}


// Emitter will have its own requestAnimationFrame 
// so we can control at what interval each particle will be emitted.
export class Emitter {
    constructor(particleConfig, emitterConfig) {
        this.active = false;

        this.context = emitterConfig.context;
        this.position = emitterConfig.position;
        this.maxParticles = emitterConfig.maxParticles;
        this.isExplosive = emitterConfig.isExplosive;

        this.lastUpdateTime = performance.now();
        this.emitInterval = particleConfig.lifetime / emitterConfig.maxParticles;

        this.particlePool = [];

        for (let i = 0; i < emitterConfig.maxParticles; i++) {
            let particle = new Particle(particleConfig);
            this.particlePool.push(particle);
        }
    }

    start() {
        // start() can be called every frame in the game logic, so make sure to check if its already active
        if (!this.active) {
            this.active = true;
            this.lastUpdateTime = performance.now();
            this.update();
        }
    }

    stop() {
        this.active = false
    }

    update() {
        if (this.active) {
            let currentTime = performance.now();
            let elapsedUpdateTime = currentTime - this.lastUpdateTime;
			let deltaTime = elapsedUpdateTime/1000;

            // Particles will be emitted at a interval and updated every frame.
            if (elapsedUpdateTime > this.emitInterval * 1000) {
                this.emitParticle()
                this.lastUpdateTime = currentTime;
            }
	
			this.updateParticles(deltaTime);
            requestAnimationFrame(() => this.update());
        }
    }

    emitParticle() {
        for (let i = 0; i < this.maxParticles; i++) {
            let particle = this.particlePool[i];
            if (!particle.active) {
                particle.active = true;
                
                // If explosive is true, we continue the loop 
                // emitting all the particles at the same time
                if (!this.isExplosive) {
                    break;
                }
            }
        }
    }

    updateParticles(deltaTime) {
        this.context.clearRect(0, 0, width, height);

        for (let i = 0; i < this.maxParticles; i++) {
            let particle = this.particlePool[i];
            
            // Particle start position is updated here to make sure it 
            // spawns at the correct location if the emitter is moved 
            particle.startPosition = this.position;
            particle.update(deltaTime);
        }
    }
}