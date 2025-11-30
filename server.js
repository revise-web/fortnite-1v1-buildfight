// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// static files
app.use(express.static('public'));

const TICK_RATE = 30; // server updates per second
const MAP_W = 1200;
const MAP_H = 800;

// Game state
let players = {}; // id -> {id, x,y,vx,vy,dir,health,name}
let blocks = [];  // array of {id,x,y,w,h,owner}
let bullets = []; // array of {id,x,y,vx,vy,owner,life}

// Helpers
const randId = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Basic AABB collision
function aabbIntersect(a, b) {
  return !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h);
}

// On connection
io.on('connection', (socket) => {
  const id = socket.id;
  console.log('connect', id);

  // create player
  const spawnX = Math.floor(Math.random() * (MAP_W - 100)) + 50;
  const spawnY = 100;
  players[id] = {
    id,
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    w: 28,
    h: 48,
    speed: 220, // px/s
    onGround: false,
    health: 100,
    name: `P-${id.slice(0,4)}`,
    inputsSeq: 0
  };

  // send initial state
  socket.emit('init', {
    id,
    map: { w: MAP_W, h: MAP_H },
    state: { players, blocks, bullets }
  });

  // notify others
  socket.broadcast.emit('playerJoined', players[id]);

  // handle input from client
  socket.on('input', (data) => {
    // data: {seq, inputs: {left, right, up, mouseX, mouseY, shoot, place, remove}}
    const p = players[id];
    if (!p) return;
    p.lastInput = data;
    p.inputsSeq = data.seq || (p.inputsSeq + 1);
    // Store desired inputs for physics step
    p.pendingInputs = data.inputs;
  });

  socket.on('disconnect', () => {
    console.log('disconnect', id);
    delete players[id];
    // remove blocks owned by player
    blocks = blocks.filter(b => b.owner !== id);
    io.emit('playerLeft', id);
  });

  // optional: set name
  socket.on('setName', (n) => {
    if (players[id]) {
      players[id].name = String(n).slice(0,20);
      io.emit('nameChange', { id, name: players[id].name });
    }
  });
});

// Game loop
let lastTime = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTime) / 1000; // seconds
  lastTime = now;
  step(dt);
}, 1000 / TICK_RATE);

function step(dt) {
  // clamp dt
  const dtc = Math.min(dt, 1 / 10);

  // Physics constants
  const GRAVITY = 900;
  const FRICTION = 0.9;

  // Handle players
  for (const id in players) {
    const p = players[id];

    // default pendingInputs
    const inps = (p.pendingInputs) ? p.pendingInputs : {};

    // horizontal velocity
    let targetVx = 0;
    if (inps.left) targetVx -= p.speed;
    if (inps.right) targetVx += p.speed;

    // simple smoothing
    p.vx = targetVx;

    // jump
    if (inps.up && p.onGround) {
      p.vy = -420;
      p.onGround = false;
    }

    // apply gravity
    p.vy += GRAVITY * dtc;

    // integrate
    p.x += p.vx * dtc;
    p.y += p.vy * dtc;

    // bounds
    p.x = clamp(p.x, 0, MAP_W - p.w);
    if (p.y > MAP_H - p.h) {
      p.y = MAP_H - p.h;
      p.vy = 0;
      p.onGround = true;
    } else {
      // check blocks as ground
      p.onGround = false;
      for (const b of blocks) {
        const playerAABB = { x: p.x, y: p.y, w: p.w, h: p.h };
        const blockAABB = { x: b.x, y: b.y, w: b.w, h: b.h };
        if (aabbIntersect(playerAABB, blockAABB)) {
          // simple resolution: push player up
          if (p.vy > 0 && p.y + p.h - p.vy * dtc <= b.y) {
            // landed on top
            p.y = b.y - p.h;
            p.vy = 0;
            p.onGround = true;
          } else {
            // horizontal collision: push away
            if (p.x < b.x) p.x = b.x - p.w;
            else p.x = b.x + b.w;
            p.vx = 0;
          }
        }
      }
    }

    // handle shooting and building inputs server-side
    if (p.lastInput && p.lastInput.inputs) {
      const inputs = p.lastInput.inputs;
      // shooting
      if (inputs.shoot && inputs.mouseX !== undefined) {
        spawnBullet(id, inputs.mouseX, inputs.mouseY);
      }
      // place block
      if (inputs.place && inputs.mouseX !== undefined) {
        placeBlock(id, inputs.mouseX, inputs.mouseY);
      }
      if (inputs.remove && inputs.mouseX !== undefined) {
        removeBlockAt(inputs.mouseX, inputs.mouseY, id);
      }
    }
  }

  // bullets movement
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dtc;
    b.y += b.vy * dtc;
    b.life -= dtc;
    // collision with blocks
    let hit = false;
    for (const bl of blocks) {
      const a = { x: b.x - 2, y: b.y - 2, w:4, h:4 };
      const bb = { x: bl.x, y: bl.y, w: bl.w, h: bl.h };
      if (aabbIntersect(a, bb)) {
        // destroy block if bullet hits it
        blocks = blocks.filter(x => x.id !== bl.id);
        hit = true;
        break;
      }
    }
    // collision with players
    if (!hit) {
      for (const pid in players) {
        if (pid === b.owner) continue;
        const p = players[pid];
        const a = { x: b.x - 2, y: b.y - 2, w:4, h:4 };
        const pb = { x: p.x, y: p.y, w: p.w, h: p.h };
        if (aabbIntersect(a, pb)) {
          p.health -= 20;
          // remove bullet
          hit = true;
          // if dead, respawn
          if (p.health <= 0) {
            respawnPlayer(p);
          }
          break;
        }
      }
    }

    if (hit || b.life <= 0 || b.x < -50 || b.x > MAP_W + 50 || b.y < -50 || b.y > MAP_H + 50) {
      bullets.splice(i, 1);
    }
  }

  // broadcast snapshot (could be optimized)
  io.emit('snapshot', { players, blocks, bullets });
}

function spawnBullet(ownerId, mouseX, mouseY) {
  const owner = players[ownerId];
  if (!owner) return;
  // direction using world coords (mouseX,mouseY are client screen coords; clients should send world coords)
  const startX = owner.x + owner.w / 2;
  const startY = owner.y + owner.h / 2;
  const dx = mouseX - startX;
  const dy = mouseY - startY;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const speed = 700;
  bullets.push({
    id: randId(),
    x: startX,
    y: startY,
    vx: (dx/len)*speed,
    vy: (dy/len)*speed,
    owner: ownerId,
    life: 2.0
  });
}

function placeBlock(ownerId, worldX, worldY) {
  // grid align
  const size = 40;
  const gx = Math.floor(worldX / size) * size;
  const gy = Math.floor(worldY / size) * size;
  // check overlap with players
  for (const id in players) {
    const p = players[id];
    const a = { x: gx, y: gy, w: size, h: size };
    const b = { x: p.x, y: p.y, w: p.w, h: p.h };
    if (aabbIntersect(a,b)) return; // can't place inside player
  }
  // check existing block
  for (const bl of blocks) {
    if (bl.x === gx && bl.y === gy) return;
  }
  blocks.push({ id: randId(), x: gx, y: gy, w: size, h: size, owner: ownerId });
}

function removeBlockAt(worldX, worldY, requesterId) {
  const size = 40;
  const gx = Math.floor(worldX / size) * size;
  const gy = Math.floor(worldY / size) * size;
  for (let i = blocks.length - 1; i >=0; i--) {
    const b = blocks[i];
    if (b.x === gx && b.y === gy) {
      // allow removing any block (or restrict to owner)
      blocks.splice(i,1);
      return;
    }
  }
}

function respawnPlayer(p) {
  p.health = 100;
  p.x = Math.floor(Math.random() * (MAP_W - 100)) + 50;
  p.y = 50;
  p.vx = 0;
  p.vy = 0;
}

// start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
