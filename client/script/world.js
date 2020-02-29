const WORLD_SEED = 0x1337BEE5;
const DRAW_RADIUS = 16;

class World {
    constructor(game) {
        this.chunks = [];
        this.chunkMap = {};
        this.chunkMeshes = [];
        this.chunkGroup = new THREE.Group();
        this.game = game;
        this.noise = new OctaveNoise(WORLD_SEED, 8);

        game.scene.add(this.chunkGroup);

        this.fog = new THREE.Fog(0xDDDDFF, 4 * 16, (DRAW_RADIUS * 0.5) * 16);
        game.scene.fog = this.fog;
    }

    render() {
        let camera = game.camera;
        let campos = camera.position.clone();
        campos.y = 0;

        const radius = DRAW_RADIUS / 2;
        let xs = (Math.floor(campos.x / 16)) - radius;
        let xe = (Math.floor(campos.x / 16)) + radius;
        let zs = (Math.floor(campos.z / 16)) - radius;
        let ze = (Math.floor(campos.z / 16)) + radius;

        for (let x = xs; x < xe; x++)
        for (let z = zs; z < ze; z++) {
            let c = this.loadChunk(x, z);
            if (!c) {
                continue;
            }

            if (c.mesh.position.distanceTo(campos) > DRAW_RADIUS * 16) {
                this.unloadChunk(c);
                continue;
            }

            c.addToScene(this.chunkGroup);
            c.render();
        }

        for (let i = 0; i < this.chunks.length; i++) {
            let c = this.chunks[i];
            if (c.x < xs || c.x > xe || c.z < zs || c.z > ze) {
                this.unloadChunk(c);
                continue;
            }
        }
    }

    getChunkAt(x, z) {
        let cx = x >> 4;
        let cz = z >> 4;

        return this.getChunk(cx, cz);
    }

    getChunk(x, z) {
        if (!this.chunkMap.hasOwnProperty(z)) {
            return null;
        }

        let zo = this.chunkMap[z];
        if (!zo.hasOwnProperty(x)) {
            return null;
        }

        return zo[x];
    }

    loadChunk(x, z) {
        let c = this.getChunk(x, z);
        if (c !== null) {
            return c;
        }

        if (this.game.lock) {
            return null;
        }

        c = new Chunk(this, x, z);
        
        if (!this.chunkMap.hasOwnProperty(z)) {
            this.chunkMap[z] = {};
        }
        if (this.chunkMap[z].hasOwnProperty(x)) {
            throw new Error("already a chunkMap entry at " + x + ", " + z);
        }
        this.chunkMap[z][x] = c;
        this.chunks.push(c);
        this.chunkMeshes.push(c.mesh);

        return c;
    }

    unloadChunk(c) {
        c.removeFromScene(this.chunkGroup);
        delete this.chunkMap[c.z][c.x];
        this.chunks.splice(this.chunks.indexOf(c), 1);
        this.chunkMeshes.splice(this.chunkMeshes.indexOf(c.mesh), 1);
    }
}

class Chunk {
    constructor(world, x, z) {
        this.world = world;
        this.x = x;
        this.z = z;
        this.mesh = null;
        this.comments = [];
        this.commentGroup = new THREE.Group();

        this.heightmap = new Array(17 * 17);
        for (let i = 0; i < 17 * 17; i++) {
            this.heightmap[i] = 500; // easy error detection
        }

        this.generate();
        this.makeColour();
        this.makeMesh();

        game.network.askForChunkComments(this.x, this.z);
    }

    makeColour() {
        const colourscale = 0.1;

        let r = Math.abs(Math.sin(deg2rad(this.x * colourscale)));
        let g = Math.abs(Math.sin(deg2rad((this.x + this.z) * colourscale)));
        let b = Math.abs(Math.sin(deg2rad(this.z * colourscale)));

        r = 1 - r;
        g = 1 - g;
        b = 1 - b;

        this.r = r;
        this.g = g;
        this.b = b;
    }

    generate() {
        const noise = this.world.noise;
        for (let x = 0; x < 17; x++)
        for (let z = 0; z < 17; z++) {
            let ax = (this.x * 16) + x;
            let az = (this.z * 16) + z;

            const n = 0.45;
            const r = 5.4;

            this.heightmap[x + z * 17] = noise.compute(ax * n, az * n) / r;
        }
    }

    getHeight(x, z) {
        return this.heightmap[x + z * 17];
    }

    makeMesh() {
        let vertices = [];
        let colours = [];

        for (let x = 0; x < 16; x++)
        for (let z = 0; z < 16; z++) {
            let x0 = x;
            let x1 = x + 1;
            let z0 = z;
            let z1 = z + 1;

            let y00 = this.heightmap[x0 + z0 * 17];
            let y01 = this.heightmap[x0 + z1 * 17];
            let y11 = this.heightmap[x1 + z1 * 17];
            let y10 = this.heightmap[x1 + z0 * 17];

            vertices.push(
                x1, y11, z1,
                x1, y10, z0,
                x0, y00, z0,
                x0, y00, z0,
                x0, y01, z1,
                x1, y11, z1,
            );

            for (let i = 0; i < 2; i++) {
                let f = Math.random() * (1 - 0.75) + 0.75;

                let nr = clamp(this.r * f, 0.1, 0.9);
                let ng = clamp(this.g * f, 0.1, 0.9);
                let nb = clamp(this.b * f, 0.1, 0.9);
                
                colours.push(
                    nr, ng, nb,
                    nr, ng, nb,
                    nr, ng, nb
                );
            }
        }

        let geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colours), 3));
        geom.computeVertexNormals();
        let mat = new THREE.MeshPhongMaterial();
        mat.flatShading = false;
        mat.vertexColors = THREE.VertexColors;
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(this.x * 16, 0, this.z * 16);
        this.mesh._isChunkMesh = true;
    }

    addToScene(scene) {
        if (this.added) {
            return;
        }

        scene.add(this.mesh);
        scene.add(this.commentGroup);
        this.added = true;
    }

    removeFromScene(scene) {
        if (!this.added) {
            return;
        }

        this.added = false;
        scene.remove(this.commentGroup);
        scene.remove(this.mesh);
    }

    addComment(comment) {
        this.comments.push(comment);
        this.commentGroup.add(comment.group);
    }

    render() {
        for (let i = 0; i < this.comments.length; i++) {
            let comment = this.comments[i];
            comment.render();
        }
    }
}