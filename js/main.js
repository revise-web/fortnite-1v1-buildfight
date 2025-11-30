// --- Déclaration des variables globales (au début de main.js) ---
let scene, camera, renderer; // Laissez ces variables
let controls; // Nouvelle variable pour les contrôles
let isLocked = false; // État du PointerLock
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let velocity = new THREE.Vector3(); // Vitesse du joueur
const speed = 100.0; // Vitesse de déplacement

// --- 1. FONCTION D'INITIALISATION (Dans init()) ---

// Remplacez l'ancienne caméra (qui n'avait pas de mouvement) par la nouvelle logique :
function init() {
    // ... (SCENE, RENDU - comme avant) ...

    // --- 1.2 CAMÉRA ---
    // La caméra définit l'angle de vue du joueur.
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 2; // Hauteur des yeux

    // --- 1.4 CONTRÔLES (NOUVEAU) ---
    // Le PointerLockControls gère la rotation de la vue et le mouvement FPS
    controls = new THREE.PointerLockControls(camera, document.body);

    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    // Écouteur pour activer les contrôles lorsque l'utilisateur clique
    instructions.addEventListener('click', function () {
        controls.lock();
    }, false);

    // Événements de verrouillage (lock) et déverrouillage (unlock)
    controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        isLocked = true;
    });

    controls.addEventListener('unlock', function () {
        blocker.style.display = 'block';
        instructions.style.display = '';
        isLocked = false;
    });

    scene.add(controls.getObject()); // Ajoute le conteneur de la caméra à la scène

    // --- 1.5 GESTION DES TOUCHES (NOUVEAU) ---
    const onKeyDown = function (event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = true;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // ... (LUMIÈRE, CUBE, REDIMENSIONNEMENT - comme avant) ...
    
    // --- NOUVEAU : CRÉER UN SOL POUR NE PAS TOMBER ---
    const floorGeometry = new THREE.PlaneGeometry(50, 50, 1, 1);
    const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x808080, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2; // Faire pivoter le plan pour qu'il soit horizontal
    floor.position.y = 0;
    scene.add(floor);

    // ... (animate() est toujours appelé à la fin de init()) ...
}

// --- 2. BOUCLE DE RENDU (Mise à jour de animate()) ---

let prevTime = performance.now(); // Pour un mouvement indépendant du framerate

function animate() {
    requestAnimationFrame(animate);

    // Calculer le temps écoulé (delta) pour un mouvement fluide
    const time = performance.now();
    const delta = (time - prevTime) / 1000; // Delta en secondes

    // Seulement mettre à jour si les contrôles sont actifs (PointerLock)
    if (isLocked === true) {

        // Décélération progressive (friction)
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Réinitialiser la vitesse
        velocity.z = 0;
        velocity.x = 0;

        // Mise à jour de la vitesse selon les touches enfoncées
        if (moveForward) velocity.z -= speed * delta;
        if (moveBackward) velocity.z += speed * delta;
        if (moveLeft) velocity.x -= speed * delta;
        if (moveRight) velocity.x += speed * delta;

        // Appliquer la vitesse à la position de la caméra
        controls.moveRight(velocity.x * delta);
        controls.moveForward(velocity.z * delta);
        
        // Simuler la gravité très simplement (sans la librairie de physique pour l'instant)
        controls.getObject().position.y += velocity.y * delta; 
        
        // Si le joueur est sous le sol (y=0), le remettre sur le sol
        if (controls.getObject().position.y < 2) {
             velocity.y = 0;
             controls.getObject().position.y = 2;
        }
    }
    
    // Rotation du cube de test (optionnel)
    // cube.rotation.x += 0.005; 
    // cube.rotation.y += 0.005;

    renderer.render(scene, camera);
    
    prevTime = time;
}

// ... (onWindowResize() comme avant) ...

// Lancement du programme
init();