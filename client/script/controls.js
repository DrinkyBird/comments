const PLAYER_HEIGHT = 1.7;
const CASTER_DIRECTION = new THREE.Vector3(0, -1, 0);
const GRAVITY = 9.8;
const JUMP_HEIGHT = 20;
const BASE_SPEED = 100;
const WORLD_LIMIT = 10000000;
const TELEPORT_SEED = 0xBEE5AAAA;

class Controls {
    constructor(game) {
        this.game = game;
        window.game = game;

        this.keys = {};
        this.angle = 0;
        this.pitch = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseCaptured = false;
        this.groundY = 0;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.position = new THREE.Vector3();
        this.onGround = false;
        this.lastTime = 0;
        this.teleportRng = new Prando(TELEPORT_SEED);
		this.invertMouse = false;

        let lastX = localStorage.getItem('lastX');
        let lastY = localStorage.getItem('lastY');
        let lastZ = localStorage.getItem('lastZ');
        if (lastX && lastY && lastZ) {
            this.position.x = parseFloat(lastX);
            this.position.y = parseFloat(lastY) + 10;
            this.position.z = parseFloat(lastZ);
        }
        
        let teleportIterations = localStorage.getItem('teleportIterations');
        if (teleportIterations) {
            this.teleportRng.skip(parseInt(teleportIterations) * 2);
        }
		
		let settingInvert = localStorage.getItem('invertMouse');
		if (settingInvert) {
			this.invertMouse = (settingInvert === 'true');
		}

        window.addEventListener('keydown', (e) => { game.controls.keyDown(e); });
        window.addEventListener('keyup', (e) => { game.controls.keyUp(e); });
        window.addEventListener('mousemove', (e) => { game.controls.mouseMove(e); });
        game.canvasContainer.addEventListener('mousedown', (e) => { game.controls.mouseDown(e); });
        document.addEventListener('pointerlockchange', (e) => { game.controls.pointerLockChange(e); });
    }

    update() {
        let time = performance.now();
        let speed = BASE_SPEED;
        const delta = (time - this.lastTime) / 1000;

        this.groundY = this.calculateGroundY();

        if (this.mouseCaptured) {
            // player movement
            let moveForward = false;
            let moveBackward = false;
            let moveRight = false;
            let moveLeft = false;

            if (this.keys["ShiftLeft"]) {
                speed *= 25;
            }

            if (this.keys["KeyW"]) {
                moveForward = true;
            }
    
            if (this.keys["KeyS"]) {
                moveBackward = true;
            }
    
            if (this.keys["KeyA"]) {
                moveLeft = true;
            }
    
            if (this.keys["KeyD"]) {
                moveRight = true;
            }

            this.velocity.x -= this.velocity.x * 10 * delta;
            this.velocity.z -= this.velocity.z * 10 * delta;
            this.velocity.y -= GRAVITY * 8 * delta;

            this.direction.z = Number(moveForward) - Number(moveBackward);
            this.direction.x = Number(moveRight) - Number(moveLeft);
            this.direction.normalize();

            this.velocity.z -= this.direction.z * speed * delta;
            this.velocity.x -= this.direction.x * speed * delta;

            if (this.onGround) {
                this.velocity.y = Math.max(0, this.velocity.y);
            }

            if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
            if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0;
            if (Math.abs(this.velocity.z) < 0.1) this.velocity.z = 0;

            let vec = new THREE.Vector3();
            vec.setFromMatrixColumn(game.camera.matrix, 0);
            vec.crossVectors(game.camera.up, vec);
            this.position.addScaledVector(vec, -this.velocity.z * delta);
            vec.setFromMatrixColumn(game.camera.matrix, 0);
            this.position.addScaledVector(vec, -this.velocity.x * delta);
            this.position.y += this.velocity.y * delta;

            // prevent the camera from bouncing down hills
            if ((this.position.y - this.groundY) < 0.25 && this.velocity.y < 1 && !this.jumping) {
                this.position.y = this.groundY;
            }

            if (this.position.y < this.groundY) {
                this.position.y = this.groundY;
            }

                 if (this.position.x < -WORLD_LIMIT) this.position.x = -WORLD_LIMIT;
            else if (this.position.x >  WORLD_LIMIT) this.position.x =  WORLD_LIMIT;
                 if (this.position.z < -WORLD_LIMIT) this.position.z = -WORLD_LIMIT;
            else if (this.position.z >  WORLD_LIMIT) this.position.z =  WORLD_LIMIT;

            this.onGround = this.position.y == this.groundY;

            // mouse rotation
            let dmx = this.mouseX;
            let dmy = this.mouseY;
    
            this.angle -= dmx;
			
			if (this.invertMouse) {
				this.pitch += dmy;
			} else {
				this.pitch -= dmy;
			}
    
            this.clampPitch();
        }

        this.game.camera.rotation.order = "YXZ";
        this.game.camera.rotation.x = deg2rad(this.pitch);
        this.game.camera.rotation.y = deg2rad(this.angle);

        this.game.camera.position.x = this.position.x;
        this.game.camera.position.y = this.position.y + PLAYER_HEIGHT;
        this.game.camera.position.z = this.position.z;

        this.save();

        this.mouseX = 0;
        this.mouseY = 0;
        this.lastTime = time;
    }

    calculateGroundY() {
        let origin = game.camera.position.clone();
        origin.y += 50;
        let caster = new THREE.Raycaster(origin, CASTER_DIRECTION);

        let intersects = caster.intersectObjects(game.world.chunkMeshes, true);
        for (let i = 0; i < intersects.length; i++) {
            let isect = intersects[i];

            return isect.point.y;
        }

        return 0;
    }

    save() {
        localStorage.setItem('lastX', this.position.x);
        localStorage.setItem('lastY', this.position.y);
        localStorage.setItem('lastZ', this.position.z);
    }

    clampPitch() {
        if (this.pitch < -90) {
            this.pitch = -90;
        } else if (this.pitch > 90) {
            this.pitch = 90;
        }
    }

    keyDown(e) {
        if (!this.mouseCaptured) {
            return;
        }

        if (this.keys[e.code] === true) {
            e.preventDefault();
            return;
        }

        this.keys[e.code] = true;

        switch (e.code) {
            case "Space": {
                if (this.onGround) {
                    this.velocity.y = JUMP_HEIGHT;
                    this.jumping = true;
                }

                break;
            }

            case "KeyM": {
                this.game.debug = !this.game.debug;

                break;
            }

            case "KeyL": {
                if (this.game.debug) {
                    this.game.lock = !this.game.lock;
                    console.debug('Lock: ' + this.game.lock);
                }
                
                break;
            }

            case "KeyT": {
                let text = prompt("Enter your comment");
                text = text.trim();
                if (!text) {
                    break;
                }

                let chunk = game.world.getChunkAt(this.position.x, this.position.z);
                if (!chunk) {
                    break;
                }

                let cx = this.position.x;
                let cy = this.position.y + PLAYER_HEIGHT;
                let cz = this.position.z;

                let comment = new Comment(game.nickname, text, cx, cy, cz);
                chunk.addComment(comment);
                this.game.network.postComment(cx, cy, cz, text);

                break;
            }

            case "KeyR": {
                this.velocity.set(0, 0, 0);
                this.position.set(0, 10, 0);

                this.save();
                localStorage.setItem("teleportIterations", 0);
                this.teleportRng.reset();

                break;
            }

            case "KeyF": {
                this.velocity.set(0, 0, 0);

                let range = 9000000;
                let offrange = 150;

                let newx = this.teleportRng.nextInt(-range, range);
                let newy = 50;
                let newz = this.teleportRng.nextInt(-range, range);

                newx += getRandomArbitrary(-offrange, offrange);
                newz += getRandomArbitrary(-offrange, offrange);

                this.position.set(newx, newy, newz);
                this.save();

                let teleportIterations = localStorage.getItem("teleportIterations");
                if (teleportIterations) {
                    localStorage.setItem("teleportIterations", parseInt(teleportIterations) + 2);
                } else {
                    localStorage.setItem("teleportIterations", 2);
                }
				
				break;
            }
			
			case "KeyY": {
				this.invertMouse = !this.invertMouse;
				
				localStorage.setItem("invertMouse", (this.invertMouse ? 'true' : 'false'));
				
				break;
			}
        }

        e.preventDefault();
    }

    keyUp(e) {
        if (!this.mouseCaptured) {
            return;
        }

        if (this.keys[e.code] !== true) {
            e.preventDefault();
            return;
        }

        this.keys[e.code] = false;

        e.preventDefault();
    }

    mouseMove(e) {
        this.mouseX = e.movementX;
        this.mouseY = e.movementY;
    }

    pointerLockChange(e) {
        if (document.pointerLockElement == this.game.threeCanvas) {
            this.mouseCaptured = true;
        } else {
            this.mouseCaptured = false;
        }
    }

    mouseDown(e) {
        if (this.game.errored) return;
        this.game.threeCanvas.requestPointerLock();
    }

    mouseUp(e) {

    }
}