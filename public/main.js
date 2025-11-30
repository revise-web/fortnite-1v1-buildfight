// main.js - Three.js client (AZERTY controls Z Q S D, FR)
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87cefa, 20, 120);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

// Lights
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(10, 20, 10);
scene.add(dir);
const amb = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(amb);

// Ground
const texLoader = new THREE.TextureLoader();
const floorTex = texLoader.load('/assets/floor.png', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(80, 80); });
const groundMat = new THREE.MeshStandardMaterial({ map: floorTex });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// simple player capsule (represented by a box for simplicity)
const player = {
  mesh: null,
  pos: new THREE.Vector3(0, 1, 0),
  velocityY: 0,
  speed: 0.2,
  running: false,
  onGround: true
};
const bodyGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
player.mesh = new THREE.Mesh(bodyGeo, bodyMat);
player.mesh.position.copy(player.pos);
scene.add(player.mesh);

// camera offset (3rd person behind)
const camOffset = new THREE.Vector3(0, 1.6, 5);

// Building materials
const wallTex = texLoader.load('/assets/wall.png');
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex });

// grid to place blocks (size 2 units)
const BUILD_SIZE = 2;
const builtBlocks = [];

// build function (place wall in front of player)
function buildWall() {
  // position in front of player (rounded to grid)
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const pos = player.pos.clone().add(forward.multiplyScalar(3));
  // snap to grid
  pos.x = Math.round(pos.x / BUILD_SIZE) * BUILD_SIZE;
  pos.y = Math.round((pos.y + 1) / BUILD_SIZE) * BUILD_SIZE; // put on ground level
  pos.z = Math.round(pos.z / BUILD_SIZE) * BUILD_SIZE;

  // prevent overlapping player
  if (Math.abs(pos.x - player.pos.x) < 1 && Math.abs(pos.z - player.pos.z) < 1) return;

  // check existing
  for (const b of builtBlocks) {
    if (b.position.x === pos.x && b.position.z === pos.z && b.position.y === pos.y) return;
  }

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2,2,0.3), wallMat);
  mesh.position.copy(pos);
  scene.add(mesh);
  builtBlocks.push(mesh);
}

// Input (AZERTY)
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// handle mouse
let mouseDown = false;
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // left
    mouseDown = true;
    buildWall();
  }
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });

// Resize
window.addEventListener('resize', onResize);
function onResize() {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
onResize();

// simple physics & movement (server-authoritative not implemented here)
function update(delta) {
  // movement: AZERTY (Z forward, Q left, S back, D right)
  let moveX = 0, moveZ = 0;
  if (keys['z']) moveZ -= 1;
  if (keys['s']) moveZ += 1;
  if (keys['q']) moveX -= 1;
  if (keys['d']) moveX += 1;

  const dir = new THREE.Vector3(moveX, 0, moveZ);
  if (dir.lengthSq() > 0) {
    dir.normalize();
    // rotate by camera yaw
    const yaw = Math.atan2(camera.position.x - player.pos.x, camera.position.z - player.pos.z);
    // apply movement relative to camera forward
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0; camForward.normalize();
    const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), camForward).normalize();
    const moveVec = new THREE.Vector3();
    moveVec.addScaledVector(camForward, -dir.z);
    moveVec.addScaledVector(camRight, dir.x);
    moveVec.normalize();

    const speed = keys['shift'] ? player.speed * 1.8 : player.speed;
    player.pos.addScaledVector(moveVec, speed * delta * 60);
  }

  // Jump (Space)
  if ((keys[' '] || keys['space']) && player.onGround) {
    player.velocityY = 0.25;
    player.onGround = false;
  }

  // gravity
  player.velocityY -= 0.012 * delta * 60;
  player.pos.y += player.velocityY * delta * 60;

  if (player.pos.y <= 1) {
    player.pos.y = 1;
    player.velocityY = 0;
    player.onGround = true;
  }

  // update mesh and camera
  player.mesh.position.copy(player.pos);

  // camera third-person follow
  const wantedCamPos = new THREE.Vector3(player.pos.x + camOffset.x, player.pos.y + camOffset.y, player.pos.z + camOffset.z);
  camera.position.lerp(wantedCamPos, 0.12);
  camera.lookAt(player.pos.x, player.pos.y + 1.2, player.pos.z);
}

// animate loop
let last = performance.now();
function animate(now) {
  const delta = (now - last) / 1000;
  last = now;

  update(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
