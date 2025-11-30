// --- VARIABLES GLOBALES ---
let scene, camera, renderer, controls;
let playerObject; // Référence à controls.getObject()
let prevTime = performance.now();

// Contrôle du mouvement (ZQSD)
let isLocked = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocity = new THREE.Vector3();
const speed = 150.0; 
const playerHeight = 2; // Hauteur des yeux du joueur

// Variables de construction
let isBuilding = false;
let currentStructure = 'Wall'; 
let ghostMesh = null;
const buildSize = 4; // Taille d'un bloc de construction (4x4m)

// Définition des structures avec géométrie et couleur de base
const structures = {
    'Wall': { color: 0x6e4e37, geometry: new THREE.BoxGeometry(buildSize, buildSize, 0.2) },
    'Floor': { color: 0x8f8f8f, geometry: new THREE.BoxGeometry(buildSize, 0.2, buildSize) },
    'Ramp': { color: 0x4e6e37, geometry: new THREE.BoxGeometry(buildSize, buildSize * 0.5, buildSize) } // Rampe (ajustée dans la fonction)
};

// --- FONCTIONS D'INITIALISATION ---

function init() {
    // 1. SCÈNE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 75); 

    // 2. CAMÉRA
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = playerHeight; 

    // 3. RENDU
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 4. CONTRÔLES (PointerLock)
    controls = new THREE.PointerLockControls(camera, document.body);
    playerObject = controls.getObject();
    setupPointerLockEvents();
    scene.add(playerObject);

    // 5. LUMIÈRES
    scene.add(new THREE.AmbientLight(0x404040, 3)); 
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    // 6. SOL
    createFloor();

    // 7. GESTION DES TOUCHES (ZQSD & Construction)
    setupKeyEvents();

    // 8. REDIMENSIONNEMENT
    window.addEventListener('resize', onWindowResize, false);
    
    // NOTE : La fonction animate() est lancée dans la fonction init() si le DOM est chargé (voir index.html)
    animate(); 
}

// --- CONFIGURATION ---

function setupPointerLockEvents() {
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', () => { 
        // Lancement du PointerLock au clic sur les instructions
        controls.lock(); 
    }, false);

    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        isLocked = true;
    });

    controls.addEventListener('unlock', () => {
        blocker.style.display = 'block';
        instructions.style.display = '';
        isLocked = false;
        disableBuildingMode();
    });
}

function setupKeyEvents() {
    const onKeyDown = function (event) {
        switch (event.code) {
            // Mouvements ZQSD
            case 'KeyZ': moveForward = true; break;
            case 'KeyQ': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            
            // Touches de sélection de construction (1, 2, 3)
            case 'Digit1': enableBuildingMode('Wall'); break;
            case 'Digit2': enableBuildingMode('Floor'); break;
            case 'Digit3': enableBuildingMode('Ramp'); break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'KeyZ': moveForward = false; break;
            case 'KeyQ': moveLeft = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyD': moveRight = false; break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    // Clic gauche pour placer la structure
    document.addEventListener('mousedown', (event) => {
        if (event.button === 0) { 
            placeStructure(); 
        }
    }, false);
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(100, 100, 1, 1);
    const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x4a4a4a, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);
}

// --- LOGIQUE DE CONSTRUCTION ---

function createGhostMesh(type) {
    let geometry;
    
    // Ajustement de la géométrie de la rampe pour le rendu
    if (type === 'Ramp') {
        geometry = new THREE.BoxGeometry(buildSize, buildSize * 0.5, buildSize);
    } else {
        geometry = structures[type].geometry.clone();
    }
    
    // Matériau semi-transparent
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
        depthWrite: false 
    });
    return new THREE.Mesh(geometry, material);
}

function enableBuildingMode(type) {
    if (!isLocked) return;
    
    if (ghostMesh) {
        scene.remove(ghostMesh);
    }
    
    isBuilding = true;
    currentStructure = type;
    ghostMesh = createGhostMesh(type);
    scene.add(ghostMesh);
}

function disableBuildingMode() {
    isBuilding = false;
    if (ghostMesh) {
        scene.remove(ghostMesh);
        ghostMesh = null;
    }
}

function placeStructure() {
    if (isLocked && isBuilding && ghostMesh) { 
        const type = currentStructure;
        let geometry;
        let rotation = ghostMesh.rotation.clone();

        // Recréation de la géométrie de la rampe
        if (type === 'Ramp') {
            geometry = new THREE.BoxGeometry(buildSize, buildSize * 0.5, buildSize);
            rotation.x = -Math.PI / 8; // Inclinaison de la rampe pour la rendre utilisable
        } else {
            geometry = structures[type].geometry.clone();
        }

        const material = new THREE.MeshPhongMaterial({ color: structures[type].color });
        const permanentStructure = new THREE.Mesh(geometry, material);

        permanentStructure.position.copy(ghostMesh.position);
        permanentStructure.rotation.copy(rotation);

        scene.add(permanentStructure);
        
        // Optionnel: Mettre fin au mode construction après placement (ou laisser actif)
        // disableBuildingMode(); 
    }
}

function updateGhostPosition() {
    const playerPosition = playerObject.position;
    
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    // Position cible : 8m (buildSize * 2) devant le joueur
    let targetPosition = playerPosition.clone().add(direction.multiplyScalar(buildSize * 2)); 
    
    // SNAPPING
    let snappedX = Math.round(targetPosition.x / buildSize) * buildSize;
    let snappedZ = Math.round(targetPosition.z / buildSize) * buildSize;
    
    // Hauteur de la grille (simplification, pour l'instant on snap à 0, 4, 8, etc.)
    let snappedY = Math.round(playerPosition.y / buildSize) * buildSize; 
    
    // Ajustements pour les différents types de structures
    if (currentStructure === 'Wall') {
        snappedY += buildSize / 2; 
        ghostMesh.position.set(snappedX, snappedY, snappedZ);

        if (Math.abs(direction.x) > Math.abs(direction.z)) {
            ghostMesh.rotation.y = Math.PI / 2; // Axe Z
        } else {
            ghostMesh.rotation.y = 0; // Axe X
        }

    } else if (currentStructure === 'Floor') {
        snappedY += 0.1; 
        ghostMesh.position.set(snappedX, snappedY, snappedZ);
        ghostMesh.rotation.y = 0;

    } else if (currentStructure === 'Ramp') {
        snappedY += buildSize / 4; 
        ghostMesh.position.set(snappedX, snappedY, snappedZ);
        
        // Orientation dans la direction de la caméra (alignée sur 4 directions)
        let angle = Math.atan2(direction.x, direction.z);
        let snappedAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
        ghostMesh.rotation.y = snappedAngle;
    }
}

// --- BOUCLE DE RENDU (ANIMATION) ---

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (isLocked) {
        // Mouvement et friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        
        if (moveForward) velocity.z -= speed * delta;
        if (moveBackward) velocity.z += speed * delta;
        if (moveLeft) velocity.x -= speed * delta;
        if (moveRight) velocity.x += speed * delta;

        controls.moveRight(velocity.x * delta);
        controls.moveForward(velocity.z * delta);
        
        // Gravité / Plan de sol simple
        if (playerObject.position.y > playerHeight) {
             velocity.y -= 9.8 * delta; // Gravité
        } else {
             velocity.y = 0;
             playerObject.position.y = playerHeight; // Toujours à la hauteur des yeux
        }
        playerObject.position.y += velocity.y * delta;
        
        // Mise à jour de la position du fantôme
        if (isBuilding && ghostMesh) {
            updateGhostPosition();
        }
    }
    
    renderer.render(scene, camera);
    prevTime = time;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// NOTE : La fonction init() sera appelée par l'écouteur DOMContentLoaded dans index.html