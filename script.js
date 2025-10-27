// Import necessary Three.js modules
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let model;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const selectedPoints = [];
const sphereMarkers = [];

// --- DOM Elements ---
const point1CoordsSpan = document.getElementById('point_coords');
const point2CoordsSpan = document.getElementById('point2_coords');
const distanceSpan = document.getElementById('distance');
const resetButton = document.getElementById('resetButton');
const container = document.getElementById('container');

// --- NEW: Get Model Name from URL Parameter ---
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
    camera.position.set(1, 1, 2);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Axis Helper
    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);

    // Load the GLB Model (using the dynamic modelToLoad variable)
    const loader = new GLTFLoader();
    loader.load(
        modelToLoad, // <<< CHANGED: Use the variable here
        function (gltf) { // Success
            model = gltf.scene;

            // Centering (Keep)
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // --- NO AUTOMATIC SCALING ---
            // We assume models are already correctly scaled

            scene.add(model);
            console.log(`Model ${modelToLoad} loaded successfully. Using original scale.`);
        },
        undefined, // Progress
        function (error) { // Error
            console.error(`An error happened loading ${modelToLoad}:`, error);
            // Optionally display an error message to the user on the page
            alert(`Failed to load model: ${modelToLoad}. Please check the filename and URL.`);
        }
    );

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    resetButton.addEventListener('click', resetSelection);
}

// --- Event Handler Functions ---
// (onWindowResize, onCanvasClick, updateInfoDisplay, resetSelection remain the same as before)
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
    if (!model) return; // Don't raycast if model hasn't loaded

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        selectedPoints.push(intersectionPoint.clone());

        // Adjust marker size relative to the scene, not model scale which might be 1
        const markerSize = 0.015 * camera.position.distanceTo(intersectionPoint) / 5; // Adjust factor 5 as needed
        const markerGeometry = new THREE.SphereGeometry(Math.max(0.005, markerSize)); // Ensure minimum size

        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.copy(intersectionPoint);
        scene.add(markerMesh);
        sphereMarkers.push(markerMesh);
        updateInfoDisplay();
    }
}

// Update the coordinate and distance information in the HTML
function updateInfoDisplay() {
    const formatCoord = (p) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`;
    point1CoordsSpan.textContent = selectedPoints.length >= 1 ? formatCoord(selectedPoints[0]) : 'N/A';
    point2CoordsSpan.textContent = selectedPoints.length === 2 ? formatCoord(selectedPoints[1]) : 'N/A';
    if (selectedPoints.length === 2) {
        const distance = selectedPoints[0].distanceTo(selectedPoints[1]);
        distanceSpan.textContent = `${distance.toFixed(3)} units`;
    } else {
        distanceSpan.textContent = 'N/A';
    }
}

// Reset the point selection and markers
function resetSelection() {
    selectedPoints.length = 0;
    sphereMarkers.forEach(marker => scene.remove(marker));
    sphereMarkers.length = 0;
    updateInfoDisplay();
    console.log("Point selection reset.");
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}