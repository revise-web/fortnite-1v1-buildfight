// --- VARIABLES GLOBALES ---
let scene, camera, renderer, controls;
let playerObject; 
let prevTime = performance.now();
const currentModeDisplay = document.getElementById('current-mode');

// Contrôle du mouvement (ZQSD)
let isLocked = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocity = new THREE.Vector3();
const speed = 150.0; 
const playerHeight = 2; 

// Variables de construction
let isBuilding = false;
let currentStructure = null; // null si mode exploration
let ghostMesh = null;
const buildSize = 4; // Taille d'un bloc de construction (4x4m)

// Définition des structures
const structures = {
    'Wall': { color: 0x6e4e37, geometry: new THREE.BoxGeometry(buildSize, buildSize, 0.2) },
    'Floor': { color: 0x8f8f8f, geometry: new THREE.BoxGeometry(buildSize, 0.2, buildSize) },
    'Ramp': { color: 0x4e6e37, geometry: new THREE.BoxGeometry(buildSize, buildSize * 0.5, buildSize) }
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

    // 7. GESTION DES ÉVÉNEMENTS
    setupKeyEvents();
    window.addEventListener('resize', onWindowResize, false);
    
    // 8. DÉMARRAGE
    animate(); 
}

// --- CONFIGURATION ---

function setupPointerLockEvents() {
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', () => { 
        controls.lock(); 
    }, false);

    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        isLocked = true;
        updateModeDisplay(false); // Mode Exploration au départ
    });

    controls.addEventListener('unlock', () => {
        blocker.style.display = 'block';
        instructions.style.display = '';
        isLocked = false;
        disableBuildingMode();
        updateModeDisplay(false); 
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
            case 'Digit1': toggleBuildingMode('Wall'); break;
            case 'Digit2': toggleBuildingMode('Floor'); break;
            case 'Digit3': toggleBuildingMode('Ramp'); break;
            
            // Échap pour désactiver la construction
            case 'Escape': 
                if (isBuilding) disableBuildingMode();
                break;
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

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- LOGIQUE DE CONSTRUCTION ---

function updateModeDisplay(type) {
    if (isLocked) {
        currentModeDisplay.innerHTML = type ? `Mode: **Construction (${type})**` : `Mode: **Exploration**`;
    }
}

function createGhostMesh(type) {
    let geometry;
    if (type === 'Ramp') {
        geometry = new THREE.BoxGeometry(buildSize, buildSize * 0.5, buildSize);
    } else {
        geometry = structures[type].geometry.clone();
    }
    
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
        depthWrite: false 
    });
    return new THREE.Mesh(geometry, material);
}

function toggleBuildingMode(type) {
    if (!isLocked) return;
    
    if (isBuilding && currentStructure === type) {
        // Désactiver si on reclique sur la même touche
        disableBuildingMode();
    } else {
        // Activer le nouveau mode
        if (ghostMesh) scene.remove(ghostMesh);
        
        isBuilding = true;
        currentStructure = type;
        ghostMesh = createGhostMesh(type);
        scene.add(ghostMesh);
        updateModeDisplay(type);
    }
}

function disableBuildingMode() {
    isBuilding = false;
    currentStructure = null;
    if (ghostMesh) {
        scene.remove(ghostMesh);
        ghostMesh = null;
    }
    updateModeDisplay(false);
}

function placeStructure() {
    if (isLocked && isBuilding && ghostMesh) { 
        const type = currentStructure;
        let geometry;
        let rotation = ghostMesh.rotation.clone();

        if (type === 'Ramp') {
            geometry = new THREE.BoxGeometry(buildSize, buildSize * 0.5, buildSize);
            rotation.x = -Math.PI / 8; // Inclinaison de la rampe
        } else {
            geometry = structures[type].geometry.clone();
        }

        const material = new THREE.MeshPhongMaterial({ color: structures[type].color });
        const permanentStructure = new THREE.Mesh(geometry, material);

        permanentStructure.position.copy(ghostMesh.position);
        permanentStructure.rotation.copy(rotation);

        scene.add(permanentStructure);
    }
}

function updateGhostPosition() {
    const playerPosition = playerObject.position;
    
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    // Vise 8m devant le joueur
    let targetPosition = playerPosition.clone().add(direction.multiplyScalar(buildSize * 2)); 
    
    // SNAPPING
    let snappedX = Math.round(targetPosition.x / buildSize) * buildSize;
    let snappedZ = Math.round(targetPosition.z / buildSize) * buildSize;
    
    // Hauteur de la grille (simplification, le joueur est toujours à la hauteur Y=2, on snap les structures en fonction)
    let snappedY = Math.round(playerPosition.y / buildSize) * buildSize; 
    
    // Ajustements
    if (currentStructure === 'Wall') {
        snappedY += buildSize / 2; // Centre du mur à mi-hauteur
        ghostMesh.position.set(snappedX, snappedY, snappedZ);

        // Orientation du mur
        if (Math.abs(direction.x) > Math.abs(direction.z)) {
            ghostMesh.rotation.y = Math.PI / 2; 
        } else {
            ghostMesh.rotation.y = 0; 
        }

    } else if (currentStructure === 'Floor') {
        snappedY += 0.1; // Pour éviter les conflits de rendu avec le sol principal
        ghostMesh.position.set(snappedX, snappedY, snappedZ);
        ghostMesh.rotation.y = 0;

    } else if (currentStructure === 'Ramp') {
        snappedY += buildSize / 4; // Hauteur pour que la rampe monte bien
        ghostMesh.position.set(snappedX, snappedY, snappedZ);
        
        // Orientation de la rampe dans l'une des 4 directions principales
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
        
        // Gravité et Plan de sol simple
        // Si le joueur est plus haut que sa hauteur standard (saut, escalade), il retombe.
        if (playerObject.position.y > playerHeight) {
             velocity.y -= 9.8 * delta; 
        } else {
             velocity.y = 0;
             playerObject.position.y = playerHeight; 
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