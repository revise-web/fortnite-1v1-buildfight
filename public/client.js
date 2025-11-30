// client.js
const socket = io();

let myId = null;
let map = { w: 1200, h: 800 };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const cam = { x:0, y:0, w: canvas.width, h: canvas.height, zoom: 1 };

// local predicted state
let players = {};
let blocks = [];
let bullets = [];

let keys = {};
let mouse = { x:0, y:0, down:false, right:false };

// input sequence
let inputSeq = 0;

// UI
const mynameSpan = document.getElementById('myname');
document.getElementById('respawn').addEventListener('click', () => {
  // instant local respawn (server will also)
  if (myId && players[myId]) {
    players[myId].x = Math.random() * (map.w-100) + 50;
    players[myId].y = 50;
    players[myId].health = 100;
  }
});

// send inputs at fixed rate
setInterval(() => {
  sendInput();
}, 1000/60);

function sendInput() {
  if (!myId) return;
  const inputs = {
    left: keys['a'] || keys['ArrowLeft'],
    right: keys['d'] || keys['ArrowRight'],
    up: keys['w'] || keys[' '],
    mouseX: mouse.worldX,
    mouseY: mouse.worldY,
    shoot: mouse.down && mouse.leftButton,
    place: mouse.right && !mouse.shiftKey,
    remove: mouse.right && mouse.shiftKey
  };
  inputSeq++;
  socket.emit('input', { seq: inputSeq, inputs });
}

// map mouse position to world coords
function updateMouseWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left);
  const cy = (e.clientY - rect.top);
  // world coords = camera + canvas coords / zoom
  mouse.x = cx;
  mouse.y = cy;
  mouse.worldX = cam.x + cx / cam.zoom;
  mouse.worldY = cam.y + cy / cam.zoom;
}

canvas.addEventListener('mousemove', (e) => {
  updateMouseWorld(e);
});
canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  updateMouseWorld(e);
  if (e.button === 0) { mouse.down = true; mouse.leftButton = true;}
  if (e.button === 2) { mouse.right = true; }
});
canvas.addEventListener('mouseup', (e) => {
  e.preventDefault();
  updateMouseWorld(e);
  if (e.button === 0) { mouse.down = false; mouse.leftButton = false;}
  if (e.button === 2) { mouse.right = false; }
});
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });

// keyboard
window.addEventListener('keydown', (e) => { keys[e.key] = true; if (e.key === ' ') e.preventDefault(); });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// socket handlers
socket.on('init', (data) => {
  myId = data.id;
  map = data.map;
  players = data.state.players || {};
  blocks = data.state.blocks || [];
  bullets = data.state.bullets || [];
  mynameSpan.textContent = players[myId] ? players[myId].name : '';
  console.log('init', myId, map);
});

socket.on('playerJoined', (p) => {
  players[p.id] = p;
});

socket.on('playerLeft', (id) => {
  delete players[id];
});

socket.on('nameChange', (d) => {
  if (players[d.id]) players[d.id].name = d.name;
});

socket.on('snapshot', (data) => {
  // replace authoritative state
  players = data.players;
  blocks = data.blocks;
  bullets = data.bullets;
  // keep myname updated
  if (players[myId]) mynameSpan.textContent = players[myId].name + ' - HP: ' + Math.max(0, Math.floor(players[myId].health));
});

function lerp(a,b,t){return a+(b-a)*t;}

function updateCamera() {
  if (!players[myId]) return;
  // center on player
  const p = players[myId];
  cam.x = p.x + p.w/2 - cam.w/2 / cam.zoom;
  cam.y = p.y + p.h/2 - cam.h/2 / cam.zoom;
  // clamp
  cam.x = Math.max(0, Math.min(map.w - cam.w / cam.zoom, cam.x));
  cam.y = Math.max(0, Math.min(map.h - cam.h / cam.zoom, cam.y));
}

function draw() {
  // clear
  ctx.clearRect(0,0,canvas.width, canvas.height);

  // transform for camera
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // background grid
  const gridSize = 40;
  ctx.fillStyle = '#d8f0ff';
  // map background
  ctx.fillRect(0,0,map.w, map.h);

  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  for (let gx=0; gx<map.w; gx+=gridSize) {
    ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,map.h); ctx.stroke();
  }
  for (let gy=0; gy<map.h; gy+=gridSize) {
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(map.w,gy); ctx.stroke();
  }

  // blocks
  for (const b of blocks) {
    ctx.fillStyle = '#a77b4b';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#6b471f';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  // players
  for (const id in players) {
    const p = players[id];
    ctx.fillStyle = (id === myId) ? '#ffcc00' : '#ff6b6b';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.fillText(p.name, p.x, p.y - 6);
    // health bar
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x, p.y - 14, p.w, 6);
    ctx.fillStyle = '#00d400';
    ctx.fillRect(p.x, p.y - 14, p.w * (Math.max(0,p.health)/100), 6);
  }

  // bullets
  for (const b of bullets) {
    ctx.fillStyle = '#222';
    ctx.fillRect(b.x-3, b.y-3, 6,6);
  }

  ctx.restore();

  // HUD
  ctx.fillStyle = '#fff';
  ctx.font = '13px Arial';
  ctx.fillText('Players: ' + Object.keys(players).length, 10, 18);

  requestAnimationFrame(draw);
}

function gameLoop() {
  updateCamera();
  // local prediction could be added here, but we keep server authoritative updates to display
  setTimeout(gameLoop, 1000/60);
}

// start loops
requestAnimationFrame(draw);
gameLoop();
