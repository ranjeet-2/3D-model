// Import necessary Three.js modules
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let model;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const selectedPoints = []; // Stores RAW clicked points (absolute coordinates)
const sphereMarkers = []; // Red measurement markers
let isSettingOrigin = false; // Flag for "click next to set origin" mode
let originPoint = new THREE.Vector3(0, 0, 0); // Stores the chosen origin offset
let originMarker = null; // Blue origin marker
let originHasBeenSet = false; // <<< NEW: Tracks if user has ever set/reset the origin

// --- DOM Elements ---
const point1CoordsSpan = document.getElementById('point1_coords');
const point2CoordsSpan = document.getElementById('point2_coords');
const distanceSpan = document.getElementById('distance');
const resetButton = document.getElementById('resetButton'); // Resets measurement points
const setOriginButton = document.getElementById('setOriginButton');
const resetOriginButton = document.getElementById('resetOriginButton');
const originCoordsSpan = document.getElementById('origin_coords');
const instructionText = document.createElement('p'); // For user guidance
const infoDiv = document.getElementById('info'); // Get the info div
const container = document.getElementById('container');

// --- Get Model Name from URL Parameter ---
const urlParams = new URLSearchParams(window.location.search);
const modelName = urlParams.get('model');
const defaultModel = 'hut recaled 2.glb'; // Default fallback
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
    camera.position.set(0.5, 0.5, 1.0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Axis Helper
    const axesHelper = new THREE.AxesHelper(0.5);
    scene.add(axesHelper);

    // Add instruction text to info box (Initially prompt to set origin)
    instructionText.textContent = "Please set an origin point first using the buttons.";
    instructionText.style.color = "orange";
    // Insert instruction text before the first <p> tag within the #info div
    if (infoDiv && infoDiv.firstChild) {
        infoDiv.insertBefore(instructionText, infoDiv.firstChild);
    } else if (infoDiv) {
        infoDiv.appendChild(instructionText);
    }


    // Load the GLB Model
    const loader = new GLTFLoader();
    loader.load(
        modelToLoad,
        function (gltf) { // Success
            model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center); // Center model visually

            scene.add(model);
            console.log(`Model ${modelToLoad} loaded successfully. Using original scale.`);
            controls.target.copy(model.position);
            controls.update();
            updateInfoDisplay(); // Show initial origin (0,0,0)
        },
        undefined, // Progress
        function (error) { // Error
            console.error(`An error happened loading ${modelToLoad}:`, error);
            alert(`Failed to load model: ${modelToLoad}.`);
        }
    );

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    resetButton.addEventListener('click', resetMeasurementSelection);
    setOriginButton.addEventListener('click', activateSetOriginMode); // Changed function name
    resetOriginButton.addEventListener('click', resetOriginToWorld);

    // Initially disable measurement reset button
    resetButton.disabled = true;
}

// --- Event Handler Functions ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Renamed function for clarity
function activateSetOriginMode() {
    if (!model) return;
    isSettingOrigin = true;
    // Don't change originHasBeenSet here
    resetButton.disabled = true; // Disable measurement reset
    instructionText.textContent = "Click on the model to set the NEW origin.";
    instructionText.style.color = "orange";
    setOriginButton.textContent = 'Setting Origin...';
    setOriginButton.style.backgroundColor = 'orange';
    resetMeasurementSelection(); // Clear previous measurement points
    console.log("Set Origin Mode Activated.");
}

function resetOriginToWorld() {
    originPoint.set(0, 0, 0); // Reset origin vector
    if (originMarker) {
        scene.remove(originMarker);
        originMarker = null;
    }
    originHasBeenSet = true; // Mark origin as explicitly set (to 0,0,0)
    resetButton.disabled = false; // Enable measurement reset
    instructionText.textContent = "Origin reset to World (0,0,0). Click to measure.";
    instructionText.style.color = "lightgreen";
    isSettingOrigin = false; // Ensure we exit origin mode if active
    setOriginButton.textContent = 'Set Origin Point';
    setOriginButton.style.backgroundColor = '';
    updateInfoDisplay();
    console.log("Origin reset to world (0,0,0). Measurement enabled.");
}

function onCanvasClick(event) {
    if (!model) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point; // Raw coordinate

        if (isSettingOrigin) {
            // --- SETTING THE ORIGIN ---
            originPoint.copy(intersectionPoint);
            console.log(`New Origin Set To Raw: (${originPoint.x.toFixed(3)}, ${originPoint.y.toFixed(3)}, ${originPoint.z.toFixed(3)})`);

            if (originMarker) scene.remove(originMarker); // Remove old one

            // Add new blue marker
            const markerSize = 0.018; // Fixed size for origin marker might be better
            const originMarkerGeo = new THREE.SphereGeometry(markerSize);
            const originMarkerMat = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue
            originMarker = new THREE.Mesh(originMarkerGeo, originMarkerMat);
            originMarker.position.copy(originPoint);
            scene.add(originMarker);

            isSettingOrigin = false; // Exit origin setting mode
            originHasBeenSet = true; // Mark origin as explicitly set
            resetButton.disabled = false; // Enable measurement reset
            instructionText.textContent = "Origin set. Click two points to measure.";
            instructionText.style.color = "lightgreen";
            setOriginButton.textContent = 'Set Origin Point';
            setOriginButton.style.backgroundColor = '';
            updateInfoDisplay();

        } else if (originHasBeenSet) { // <<< CHECK if origin has been set before allowing measurement
            // --- SELECTING MEASUREMENT POINTS ---
            if (selectedPoints.length >= 2) {
                alert("Two points already selected. Reset measurement points first.");
                return;
            }
            selectedPoints.push(intersectionPoint.clone()); // Store the raw coordinate

            // Add red visual marker
            const distanceToPoint = camera.position.distanceTo(intersectionPoint);
            const markerSize = Math.max(0.005, 0.01 * distanceToPoint / 2.0); // Dynamic size
            const markerGeometry = new THREE.SphereGeometry(markerSize);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
            const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
            markerMesh.position.copy(intersectionPoint); // Place at raw position
            scene.add(markerMesh);
            sphereMarkers.push(markerMesh);

            updateInfoDisplay(); // Update display relative to CURRENT origin

        } else {
             // Inform user if they click before origin is ever set
             alert("Please set an origin first using 'Set Origin Point' or 'Reset Origin'.");
        }
    }
}

// Update the coordinate and distance information (RELATIVE TO CURRENT ORIGIN)
function updateInfoDisplay() {
    const formatCoordRelativeToOrigin = (p_raw) => {
        const relativeP = p_raw.clone().sub(originPoint);
        return `(${relativeP.x.toFixed(3)}, ${relativeP.y.toFixed(3)}, ${relativeP.z.toFixed(3)})`;
    };

    // Display Current Origin Coordinates (Raw)
    originCoordsSpan.textContent = `(${originPoint.x.toFixed(3)}, ${originPoint.y.toFixed(3)}, ${originPoint.z.toFixed(3)})`;

    // Display Measurement Points (Relative to Current Origin) if origin is set
    if (originHasBeenSet) {
        point1CoordsSpan.textContent = selectedPoints.length >= 1 ? formatCoordRelativeToOrigin(selectedPoints[0]) : 'N/A';
        point2CoordsSpan.textContent = selectedPoints.length === 2 ? formatCoordRelativeToOrigin(selectedPoints[1]) : 'N/A';
    } else {
        point1CoordsSpan.textContent = 'Set Origin First';
        point2CoordsSpan.textContent = 'Set Origin First';
    }


    // Distance calculation uses raw points
    if (selectedPoints.length === 2) {
        const distance = selectedPoints[0].distanceTo(selectedPoints[1]);
        distanceSpan.textContent = `${distance.toFixed(3)} meters`;
    } else {
        distanceSpan.textContent = 'N/A';
    }
}

// Resets only the MEASUREMENT points (red markers)
function resetMeasurementSelection() {
    selectedPoints.length = 0;
    sphereMarkers.forEach(marker => scene.remove(marker));
    sphereMarkers.length = 0;
    updateInfoDisplay();
    console.log("Measurement point selection reset.");
    // Resetting measurement doesn't affect origin mode
    if (isSettingOrigin) {
        instructionText.textContent = "Click on the model to set the NEW origin.";
        instructionText.style.color = "orange";
    } else if (originHasBeenSet) {
         instructionText.textContent = "Origin set. Click two points to measure.";
         instructionText.style.color = "lightgreen";
    }
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
