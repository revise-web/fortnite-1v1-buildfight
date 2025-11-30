// --- VARIABLES GLOBALES ---
let scene, camera, renderer, controls;
let prevTime = performance.now();

// Contrôle du mouvement (ZQSD)
let isLocked = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocity = new THREE.Vector3();
const speed = 150.0; 

// Variables de construction
let isBuilding = false;
let currentStructure = 'Wall'; // Par défaut, on construit un mur
let ghostMesh = null;
const buildSize = 4; // Taille d'un bloc de construction (4x4m)
const structures = {
    'Wall': { color: 0x6e4e37, geometry: new THREE.BoxGeometry(buildSize, buildSize, 0.2) },
    'Floor': { color: 0x8f8f8f, geometry: new THREE.BoxGeometry(buildSize, 0.2, buildSize) },
    'Ramp': { color: 0x4e6e37, geometry: new THREE.BoxGeometry(buildSize, 0.2, buildSize) } // Rampe sera ajustée
};

// --- FONCTIONS D'INITIALISATION ---

function init() {
    // 1. SCÈNE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Ciel bleu
    scene.fog = new THREE.Fog(0x87ceeb, 0, 75); // Brouillard léger

    // 2. CAMÉRA
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 2; 

    // 3. RENDU
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 4. CONTRÔLES (PointerLock)
    controls = new THREE.PointerLockControls(camera, document.body);
    setupPointerLockEvents();
    scene.add(controls.getObject());

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

    // Démarrage de la boucle de rendu
    animate();
}

// --- CONFIGURATION ---

function setupPointerLockEvents() {
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', () => { controls.lock(); }, false);

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
    document.addEventListener('mousedown', placeStructure, false);
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
    // La rampe est une simple boite inclinée pour l'instant (simplification)
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

function enableBuildingMode(type) {
    if (!isLocked) return;
    
    // Si on change de structure ou si on n'est pas en mode construction
    if (ghostMesh) {
        scene.remove(ghostMesh);
    }
    
    isBuilding = true;
    currentStructure = type;
    ghostMesh = createGhostMesh(type);
    scene.add(ghostMesh);
    console.log(`Mode construction activé : ${type}`);
}

function disableBuildingMode() {
    isBuilding = false;
    if (ghostMesh) {
        scene.remove(ghostMesh);
        ghostMesh = null;
    }
}

function placeStructure(event) {
    if (isLocked && isBuilding && event.button === 0) { // Clic gauche
        if (!ghostMesh) return;

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
        // La mécanique de destruction (raycasting) serait ajoutée ici.
    }
}

function updateGhostPosition() {
    const playerObject = controls.getObject();
    const playerPosition = playerObject.position;
    
    // Obtenir la direction de la caméra
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    // Position cible : 8m (buildSize * 2) devant le joueur
    let targetPosition = playerPosition.clone().add(direction.multiplyScalar(buildSize * 2)); 
    
    // SNAPPING sur la grille
    let snappedX = Math.round(targetPosition.x / buildSize) * buildSize;
    let snappedZ = Math.round(targetPosition.z / buildSize) * buildSize;
    let snappedY = 0;

    // Détermination de la hauteur du sol le plus proche (simplification)
    snappedY = Math.round(playerPosition.y / buildSize) * buildSize;
    
    // Ajustements pour les différents types de structures
    if (currentStructure === 'Wall') {
        snappedY += buildSize / 2; // Centre du mur à mi-hauteur
        ghostMesh.position.set(snappedX, snappedY, snappedZ);

        // Orientation du mur (le long de l'axe X ou Z, le plus perpendiculaire à la vue)
        if (Math.abs(direction.x) > Math.abs(direction.z)) {
            ghostMesh.rotation.y = Math.PI / 2;
        } else {
            ghostMesh.rotation.y = 0;
        }

    } else if (currentStructure === 'Floor') {
        snappedY += 0.1; // Légèrement au-dessus de la hauteur de la grille
        ghostMesh.position.set(snappedX, snappedY, snappedZ);
        ghostMesh.rotation.y = 0;

    } else if (currentStructure === 'Ramp') {
        // La rampe doit être placée une demi-unité en hauteur par rapport au sol
        snappedY += buildSize / 4; 
        ghostMesh.position.set(snappedX, snappedY, snappedZ);
        
        // La rampe doit être orientée dans la direction du joueur
        let angle = Math.atan2(direction.x, direction.z);
        // Alignement sur 45 degrés pour les 4 directions principales
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
        // Mouvement fluide du joueur
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Vitesse d'avancement/recul et latéral (ZQSD)
        if (moveForward) velocity.z -= speed * delta;
        if (moveBackward) velocity.z += speed * delta;
        if (moveLeft) velocity.x -= speed * delta;
        if (moveRight) velocity.x += speed * delta;

        controls.moveRight(velocity.x * delta);
        controls.moveForward(velocity.z * delta);
        
        // Simuler la gravité et le plancher
        if (playerObject.position.y > 2) {
             velocity.y -= 9.8 * delta; // Gravité
        } else {
             velocity.y = 0;
             playerObject.position.y = 2; // Position Y des yeux au-dessus du sol (y=0)
        }
        playerObject.position.y += velocity.y * delta;
        
        // Mettre à jour la position du fantôme si on est en mode construction
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

// Lancement du programme
init();