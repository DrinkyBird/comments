let SERVER_ADDRESS = "https://csnxs.uk/";
let SERVER_PATH = "/comments-server";

/*
SERVER_ADDRESS = "http://localhost:1338";
SERVER_PATH = "/socket.io";
//*/

class Network {
    constructor(readyCallback) {
        this.readyCallback = readyCallback;
        this.socket = io(SERVER_ADDRESS, {
            path: SERVER_PATH
        });

        this.socket.on('connect', () => { game.network.onConnection(); });
        this.socket.on('error', (e) => { game.network.onError(e); });
        this.socket.on('disconnect', (reason) => { game.network.onDisconnection(reason); });

        this.socket.on('chunkComments', (x, z, c) => { game.network.onChunkComments(x, z, c); })
    }

    onConnection() {
        console.log('Connected');
        this.socket.emit('begin', game.nickname);
        this.socket.on('ready', () => {
            game.network.onReady();
        });
    }

    onReady() {
        this.readyCallback();
    }

    onDisconnection(reason) {
        game.error('Lost connection: ' + reason);
        this.socket.close();
    }

    onError(e) {
        game.error(e);
        this.socket.close();
    }

    askForChunkComments(x, z) {
        this.socket.emit('getCommentsForChunk', x, z);
    }

    onChunkComments(x, z, comments) {
        let chunk = game.world.getChunk(x, z);
        if (!chunk) {
            return;
        }

        for (let i = 0; i < comments.length; i++) {
            let data = comments[i];
            let comment = new Comment(data.nickname, data.text, data['x'], data['y'], data['z']);
            chunk.addComment(comment);
        }
    }

    postComment(x, y, z, text) {
        this.socket.emit('postComment', x, y, z, text);
    }
}