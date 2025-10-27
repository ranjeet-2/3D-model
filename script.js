// Import necessary Three.js modules
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let model; // Holds the single loaded model
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const selectedPoints = [];
const sphereMarkers = [];

// --- DOM Elements ---
const point1CoordsSpan = document.getElementById('point1_coords'); // <<< CORRECTED ID
const point2CoordsSpan = document.getElementById('point2_coords');
const distanceSpan = document.getElementById('distance');
const resetButton = document.getElementById('resetButton');
const container = document.getElementById('container');

// --- Get Model Name from URL Parameter ---
const urlParams = new URLSearchParams(window.location.search);
const modelName = urlParams.get('model'); // Get value after ?model=
const defaultModel = 'hut recaled 2.glb'; // Fallback if no parameter

// Use the modelName from URL, or the default if not provided
const modelToLoad = modelName ? modelName : defaultModel;
console.log(`Attempting to load model: ${modelToLoad}`);


// --- Initialization ---
init();
animate();

// --- Main Setup Function ---
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Adjust initial camera position if models appear too small/large
    camera.position.set(0.5, 0.5, 1.0); // May need tweaking based on typical model size

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Auto-rotate can be nice for viewing, uncomment if desired
    // controls.autoRotate = true; 
    // controls.autoRotateSpeed = 0.5;

    // Axis Helper
    const axesHelper = new THREE.AxesHelper(0.5); // Adjust size as needed
    scene.add(axesHelper);

    // Load the GLB Model (using the dynamic modelToLoad variable)
    const loader = new GLTFLoader();
    loader.load(
        modelToLoad, // Use the variable here
        function (gltf) { // Success
            model = gltf.scene;

            // Centering (Keep) - Crucial for OrbitControls to work well
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // --- NO AUTOMATIC SCALING ---
            // We assume models ('hut recaled 2.glb', 'kappa rescaled.glb')
            // are already correctly scaled in meters from Polycam/export.

            scene.add(model);
            console.log(`Model ${modelToLoad} loaded successfully. Using original scale.`);
            
            // Optional: Adjust camera target after loading and centering
            controls.target.copy(model.position); 
            controls.update();

        },
        undefined, // Progress
        function (error) { // Error
            console.error(`An error happened loading ${modelToLoad}:`, error);
            // Display error to the user
            const errorDiv = document.createElement('div');
            errorDiv.textContent = `Failed to load model: ${modelToLoad}. Check filename and ensure it's in the correct folder.`;
            errorDiv.style.position = 'absolute';
            errorDiv.style.top = '50%';
            errorDiv.style.left = '50%';
            errorDiv.style.transform = 'translate(-50%, -50%)';
            errorDiv.style.padding = '20px';
            errorDiv.style.backgroundColor = 'red';
            errorDiv.style.color = 'white';
            document.body.appendChild(errorDiv);
        }
    );

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    resetButton.addEventListener('click', resetSelection);
}

// --- Event Handler Functions ---

// Adjust camera and renderer on window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handle clicks on the 3D model
function onCanvasClick(event) {
    if (selectedPoints.length >= 2) {
        alert("Two points already selected. Please reset to measure again.");
        return;
    }
    if (!model) { // Don't raycast if model hasn't loaded or failed
        console.warn("Model not loaded yet, cannot measure.");
        return; 
    }

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections
    const intersects = raycaster.intersectObject(model, true); // `true` checks children recursively

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        selectedPoints.push(intersectionPoint.clone());

        // Adjust marker size relative to camera distance for better visibility
        const distanceToPoint = camera.position.distanceTo(intersectionPoint);
        // Experiment with these values (0.01 base size, 5.0 reference distance)
        const markerSize = Math.max(0.005, 0.01 * distanceToPoint / 2.0); 

        const markerGeometry = new THREE.SphereGeometry(markerSize); 
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.copy(intersectionPoint);
        scene.add(markerMesh);
        sphereMarkers.push(markerMesh);

        updateInfoDisplay(); // Update the text info box
    }
}

// Update the coordinate and distance information in the HTML
function updateInfoDisplay() {
    const formatCoord = (p) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`;
    point1CoordsSpan.textContent = selectedPoints.length >= 1 ? formatCoord(selectedPoints[0]) : 'N/A';
    point2CoordsSpan.textContent = selectedPoints.length === 2 ? formatCoord(selectedPoints[1]) : 'N/A';
    if (selectedPoints.length === 2) {
        const distance = selectedPoints[0].distanceTo(selectedPoints[1]);
        // Display units as meters, assuming your input models are scaled correctly
        distanceSpan.textContent = `${distance.toFixed(3)} meters`; 
    } else {
        distanceSpan.textContent = 'N/A';
    }
}

// Reset the point selection and markers
function resetSelection() {
    selectedPoints.length = 0; // Clear selected coordinates
    sphereMarkers.forEach(marker => scene.remove(marker)); // Remove spheres from scene
    sphereMarkers.length = 0; // Clear marker array
    updateInfoDisplay(); // Update text display
    console.log("Point selection reset.");
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate); // Loop the animation
    controls.update(); // Update controls for damping and auto-rotate
    renderer.render(scene, camera); // Render the scene
}
