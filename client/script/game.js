const DBG_FONT_HEIGHT = 14;
const FOV = 90;

class Game {
    constructor(readyCallback) {
        this.threeCanvas = document.getElementById('3dCanvas');
        this.uiCanvas = document.getElementById('uiCanvas');
        this.canvasContainer = document.getElementById('canvasContainer');
        this.lastFpsTime = 0;
        this.fpsFrames = 0;
        this.fps = 0;
        this.delta = 0;
        this.debug = false;
        this.lock = false;
        this.errored = false;

        this.scene = new THREE.Scene();
        this.camera = null
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.threeCanvas,
            antialias: true
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSharpShadowMap;
        
        this.onResize();
        this.controls = new Controls(this);

        this.scene.background = new THREE.Color(0xDDDDFF);

        this.light = new THREE.DirectionalLight(0xEEEEFF, 1.0);
        this.light.castShadow = true;
        this.light.position.set(0.1, 1, 0);

        this.scene.add(this.light);

        this.clock = new THREE.Clock();

        this.world = new World(this);

        // reference positioning cube.
        {
            let geometry = new THREE.BoxGeometry(5, 5, 5);
            let material = new THREE.MeshPhongMaterial( { color: 0x00ff00 } );
            let cube = new THREE.Mesh( geometry, material );
            cube.position.y = 7;
            cube.castShadow = true;
            cube.receiveShadow = true;
            //this.scene.add(cube);
        }

        window.addEventListener('resize', () => {
            game.onResize();
        });

        let urlParams = new URLSearchParams(window.location.search);
        this.nickname = urlParams.get('nickname');
        if (this.nickname) this.nickname = this.nickname.trim();
        if (!this.nickname) {
            this.error("No nickname!");
            return;
        }
        if (this.nickname.length > 12) {
            this.error("Nickname too long.");
            return;
        }

        this.network = new Network(() => {
            readyCallback();
        });
    }

    error(text) {
        this.errored = true;
        document.exitPointerLock();
        console.error(text);

        let ctx = this.uiCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = DBG_FONT_HEIGHT + "px monospace";

        let x = 5;
        let y = 5;
        this.drawBackgroundText(x, y, "An error occured."); y += DBG_FONT_HEIGHT;
        this.drawBackgroundText(x, y, text); y += DBG_FONT_HEIGHT;
    }

    onResize() {
        let width = this.canvasContainer.clientWidth;
        let height = this.canvasContainer.clientHeight;

        this.width = width;
        this.height = height;

        this.threeCanvas.width = width;
        this.threeCanvas.height = height;
        this.renderer.setSize(width, height);
        this.camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 1000);

        this.uiCanvas.width = width;
        this.uiCanvas.height = height;
    }

    draw() {
        if (this.errored) {
            return;
        }

        let start = performance.now();

        window.requestAnimationFrame(() => { game.draw(); });

        // update fog and background
        this.updateFogAndBackground();
        this.clearUi();

        this.world.render();

        this.renderer.render(this.scene, this.camera);
        this.drawUi();

        this.controls.update(this.clock.getDelta());

        let end = performance.now();
        this.delta = end - start;
        this.fpsFrames++;
        if (end - this.lastFpsTime >= 1000) {
            this.fps = this.fpsFrames;
            this.fpsFrames = 0;
            this.lastFpsTime = end;
        }
    }

    updateFogAndBackground() {
        let c = this.world.getChunkAt(this.controls.position.x, this.controls.position.z);
        let r, g, b;

        if (c) {
            r = c.r;
            g = c.g;
            b = c.b;
        } else {
            r = 0xEE / 255;
            g = 0xEE / 255;
            b = 0xFF / 255;
        }

        const f = 0.9;
        r *= f;
        g *= f;
        b *= f;

        this.scene.background.setRGB(r, g, b);
        this.world.fog.color.setRGB(r, g, b);
        this.light.color.setRGB(r, g, b);
    }

    clearUi() {
        let ctx = this.uiCanvas.getContext("2d");
        ctx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
        ctx.font = DBG_FONT_HEIGHT + "px monospace";
    }

    drawUi() {
        let ctx = this.uiCanvas.getContext("2d");

        ctx.font = DBG_FONT_HEIGHT + "px monospace";

        if (!this.controls.mouseCaptured) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, this.width, this.height);

            const str = "Click to focus. Scroll down for controls.";
            const measure = ctx.measureText(str);

            let x = (this.width / 2) - (measure.width / 2);
            let y = (this.height / 2) - (DBG_FONT_HEIGHT / 2);

            this.drawBackgroundText(x, y, str);
        }

        if (this.debug) {
            let x = 1;
            let y = 1;
            this.drawBackgroundText(x, y, this.fps + " FPS (" + this.delta + " ms)"); y += DBG_FONT_HEIGHT;
            this.drawBackgroundText(x, y, `X: ${this.camera.position.x} Y: ${this.camera.position.y} Z: ${this.camera.position.z}`); y += DBG_FONT_HEIGHT;
            this.drawBackgroundText(x, y, `vX: ${this.controls.velocity.x} vY: ${this.controls.velocity.y} vZ: ${this.controls.velocity.z} grounded: ${this.controls.onGround}`); y += DBG_FONT_HEIGHT;
            this.drawBackgroundText(x, y, `Chunks: ${this.world.chunks.length}`); y += DBG_FONT_HEIGHT;
            this.drawBackgroundText(x, y, `Resolution: ${this.width}*${this.height}`); y += DBG_FONT_HEIGHT;
            this.drawBackgroundText(x, y, `UA: ${navigator.userAgent}`); y += DBG_FONT_HEIGHT;
        }
    }

    drawBackgroundText(x, y, text) {
        let ctx = this.uiCanvas.getContext("2d");
        let measure = ctx.measureText(text);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(x, y, measure.width, DBG_FONT_HEIGHT);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x, y + DBG_FONT_HEIGHT);
    }

    drawCommentText(x, y, text) {
        let ctx = this.uiCanvas.getContext("2d");
        let measure = ctx.measureText(text);

        x -= measure.width / 2;
        y -= DBG_FONT_HEIGHT / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(x, y, measure.width, DBG_FONT_HEIGHT);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x, y + DBG_FONT_HEIGHT);
    }
}

window.addEventListener('load', () => {
    try {
        window.game = new Game(() => {
            game.draw();
        });
    } catch (e) {
        game.error(`${e.__proto__.constructor.name}: ${e.message}`);
    }
});
