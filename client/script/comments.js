const COMMENT_FONT_SIZE = 14;

class Comment {
    constructor(nickname, text, x, y, z) {
        this.nickname = nickname;
        this.text = text;
        this.group = new THREE.Group();
        this.added = false;
        
        let geom = new THREE.SphereBufferGeometry(0.35);
        let mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        let mesh = new THREE.Mesh(geom, mat);
        let light = new THREE.PointLight(0xFFFFFF, 1, 3.5);

        this.group.position.set(x, y, z);
        this.group.add(mesh);
        this.group.add(light);
    }

    addToScene(scene) {
        if (this.added) {
            return;
        }

        scene.add(this.group);
        this.added = true;
    }

    removeFromScene(scene) {
        if (!this.added) {
            return;
        }

        scene.remove(this.group);
        this.added = false;
    }

    render() {
        let camera = window.game.camera;

        if (camera.position.distanceTo(this.group.position) < 5) {
            let pos = this.group.position.clone();
            pos.project(camera);

            let widthHalf = game.width / 2;
            let heightHalf = game.height / 2;

            pos.x = (pos.x * widthHalf) + widthHalf;
            pos.y = (pos.y * heightHalf) + heightHalf;

            let str = this.nickname + ": " + this.text;
            
            game.drawCommentText(pos.x, game.height - pos.y, str);
        }
    }
}