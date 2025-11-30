// Déclaration des variables globales
let scene, camera, renderer, cube;

// --- 1. FONCTION D'INITIALISATION ---
function init() {
    // 1.1 SCENE
    // La scène est le conteneur où tous les objets 3D seront placés.
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Couleur de ciel bleu clair

    // 1.2 CAMÉRA
    // La caméra définit l'angle de vue du joueur.
    // Paramètres : Field of View (FOV), Aspect Ratio, Near, Far
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 2; // Position de la caméra légèrement en hauteur

    // 1.3 RENDU (RENDERER)
    // Le renderer dessine la scène 3D sur un élément HTML <canvas>.
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 1.4 AJOUTER UN CUBE (pour tester)
    // Créer une géométrie (la forme) et un matériau (l'apparence)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Rouge
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // 1.5 LUMIÈRE
    // Indispensable pour voir les objets avec des matériaux non-Basic
    const ambientLight = new THREE.AmbientLight(0x404040, 5); // Lumière douce
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // 1.6 GÉRER LE REDIMENSIONNEMENT DE LA FENÊTRE
    window.addEventListener('resize', onWindowResize, false);

    // 1.7 Lancer la boucle de rendu
    animate();
}

// --- 2. BOUCLE DE RENDU (JEU) ---
// Cette fonction est appelée 60 fois par seconde (ou plus) et met à jour la scène.
function animate() {
    requestAnimationFrame(animate); // Demande au navigateur d'appeler 'animate' à nouveau
    
    // Mouvement d'exemple pour le cube
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.005;

    // Dessiner la scène avec la caméra actuelle
    renderer.render(scene, camera);
}

// --- 3. FONCTION DE REDIMENSIONNEMENT ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Lancement du programme
init();