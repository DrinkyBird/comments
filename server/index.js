const io = require('socket.io');
const util = require('util');
const mysql = require('mysql');
const conf = require('./conf')

const WORLD_LIMIT = 10000000;

let db = mysql.createConnection({
    host: conf.MYSQL_HOST,
    user: conf.MYSQL_USERNAME,
    password: conf.MYSQL_PASSWORD,
    database: conf.MYSQL_DB
});
let server = io.listen(1338);

db.connect();

server.on("connection", (socket) => {
    let address = socket.handshake.headers["x-forwarded-for"];
    let agent = socket.request.headers['user-agent'];

    if (!address) {
        address = '<unknown>';
    }

    console.info(`New connection from ${address}`);
    let nickname = null;

    socket.on("begin", (setNickname) => {
        if (nickname) {
            return;
        }

        if (!setNickname) {
            socket.emit('serror', 'No nickname');
            socket.disconnect(false);
            return;
        }

        nickname = setNickname.trim();
        if (!nickname) {
            socket.emit('serror', 'No nickname');
            socket.disconnect(false);
            return;
        }

        socket.emit('ready');
        console.info(`${address} is known as ${nickname}`);
    });

    socket.on("disconnect", () => {

    });

    socket.on("error", (e) => {
        console.error("Socket error: " + e)
    });

    socket.on("getCommentsForChunk", (x, z) => {
        let r = [];

        db.query("SELECT x,y,z,nickname,text FROM comments WHERE chunkX=? AND chunkZ=?", [x, z], (err, rows) => {
            if (err) {
                socket.emit('serror', 'Error getting comments for chunk ' + x + ', ' + z);
                socket.disconnect(false);
                return;
            }

            for (let i = 0; i < rows.length; i++) {
                let row = rows[i];

                r.push({
                    nickname:       row.nickname,
                    text:           row.text,
                    x:              row.x,
                    y:              row.y,
                    z:              row.z
                });
            }

            if (r.length > 0) {
                socket.emit('chunkComments', x, z, r);
            }
        })
    });

    socket.on('postComment', (x, y, z, text) => {
        let chunkX = x >> 4;
        let chunkZ = z >> 4;

        if (!text) {
            socket.emit('serror', 'No text');
            socket.disconnect(false);
            return;
        }

        let trimmed = text.trim();
        if (!trimmed || trimmed.length > 128) {
            socket.emit('serror', 'No text');
            socket.disconnect(false);
            return;
        }

        if (x < -WORLD_LIMIT || x > WORLD_LIMIT || z < -WORLD_LIMIT || z > WORLD_LIMIT) {
            socket.emit('serror', 'Out of bounds');
            socket.disconnect(false);
            return;
        }

        console.info(`${nickname} (${address}) posted: ${trimmed}`);

        db.query("INSERT INTO comments (x,y,z,chunkX,chunkZ,text,nickname,ip,userAgent,timestamp) VALUES (?,?,?,?,?,?,?,?,?,?)",
            [x, y, z, chunkX, chunkZ, trimmed, nickname, address, agent, Math.floor(Date.now()/1000)],
            (err, res) => {
            if (err) {
                console.error(err);
                socket.emit('serror', 'Error inserting to database');
                socket.disconnect(false);
                return;
            }
        });
    });
});

function doExit() {
    server.close();
    db.end();
}

process.on('SIGINT', () => { console.info('SIGINT!'); doExit(); });
process.on('SIGTERM', () => { console.info('SIGTERM!'); doExit(); });
