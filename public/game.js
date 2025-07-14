// --- Three.js Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // light sky blue

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);

const cameraTarget = new THREE.Object3D();
scene.add(cameraTarget);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x202020);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const container = document.getElementById('game-container');
container.appendChild(renderer.domElement);

// Lighting to avoid black screen
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
ground.position.y = 0;

ground.receiveShadow = true;
scene.add(ground);

const socket = io();
const clock = new THREE.Clock();
const players = {};
let localPlayer = null;

function createRobloxRig(name = "Player") {
  const rig = new THREE.Group();
  rig.name = name;

  const materials = {
    body: new THREE.MeshStandardMaterial({ color: 0xdddddd }),
    head: new THREE.MeshStandardMaterial({ color: 0xffccaa }),
  };

  // Torso
  const torsoGeo = new THREE.BoxGeometry(2, 2.5, 1);
  const torso = new THREE.Mesh(torsoGeo, materials.body);
  torso.name = "Torso";
  torso.position.y = 1.25;
  rig.add(torso);

  // Head
  const headGeo = new THREE.SphereGeometry(0.75, 16, 16);
  const head = new THREE.Mesh(headGeo, materials.head);
  head.name = "Head";
  head.position.y = 3.25;
  rig.add(head);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.75, 2, 0.75);
  const leftArm = new THREE.Mesh(armGeo.clone(), materials.body);
  leftArm.name = "LeftArm";
  leftArm.position.set(-1.5, 1.25, 0);
  rig.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo.clone(), materials.body);
  rightArm.name = "RightArm";
  rightArm.position.set(1.5, 1.25, 0);
  rig.add(rightArm);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.8, 2.25, 0.8);
  const leftLeg = new THREE.Mesh(legGeo.clone(), materials.body);
  leftLeg.name = "LeftLeg";
  leftLeg.position.set(-0.5, -1.125, 0);
  rig.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo.clone(), materials.body);
  rightLeg.name = "RightLeg";
  rightLeg.position.set(0.5, -1.125, 0);
  rig.add(rightLeg);

  return rig;
}

// --- Player Class ---
class Player {
  constructor(id, isLocal = false) {
    this.id = id;
    this.isLocal = isLocal;
    this.rig = createRobloxRig(isLocal? "LocalPlayer" : `Player_${id}`);
    scene.add(this.rig);

    this.position = new THREE.Vector3(0, 0, 0);
    this.rotationY = 0;
    this.speed = 5;
    this.velocityY = 0;
    this.gravity = -20; // units per second²
    this.jumpForce = 10;
    this.isGrounded = true;

    if (isLocal) {
      this.setupInput();
    }
  }

  setupInput() {
    this.keys = {};
    this.moveDirection = new THREE.Vector3();

    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        const message = chatInput.value;
        socket.emit('chat', message);  // Emit to the server
        chatInput.value = '';  // Clear input
      }
    });

  }

  update(delta) {
    if (this.isLocal) {
      this.handleInput(delta);
      this.sendState();
    }
  }

  handleInput(delta) {
    this.moveDirection.set(0, 0, 0);
    if (this.keys["w"]) this.moveDirection.z -= 1;
    if (this.keys["s"]) this.moveDirection.z += 1;
    if (this.keys["a"]) this.moveDirection.x -= 1;
    if (this.keys["d"]) this.moveDirection.x += 1;

    if (this.keys[" "] && this.isGrounded) {
    this.velocityY = this.jumpForce;
    this.isGrounded = false;
  }

  if (this.moveDirection.length() > 0) {
    this.moveDirection.normalize();

    // Get camera direction on XZ plane
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    move.copy(camDir).multiplyScalar(-this.moveDirection.z);
    move.addScaledVector(right, this.moveDirection.x);
    move.normalize().multiplyScalar(this.speed * delta);

    // Update rotation to face movement
    this.rotationY = Math.atan2(move.x, move.z);

    // Apply horizontal movement
    this.position.add(move);
  }

  // Jumping and gravity
  this.velocityY += this.gravity * delta;
  this.position.y += this.velocityY * delta;

  // Ground collision
  if (this.position.y <= 0) {
    this.position.y = 0;
    this.velocityY = 0;
    this.isGrounded = true;
  }

  // Apply to rig (add offset to lift rig above ground)
  const rigOffsetY = 1.125;
  this.rig.position.set(this.position.x, this.position.y + rigOffsetY, this.position.z);
  this.rig.rotation.y = this.rotationY;

  }



  sendState() {
    socket.emit("move", {
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotationY: this.rotationY,
    });
  }

  applyState(data) {
    this.position.set(data.position.x, data.position.y, data.position.z);
    this.rotationY = data.rotationY;
    const rigOffsetY = 1.125;
    this.rig.position.set(this.position.x, this.position.y + rigOffsetY, this.position.z);

    this.rig.rotation.y = this.rotationY;
  }

  dispose() {
    scene.remove(this.rig);
    this.rig.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
socket.on("connect", () => {
  console.log("Connected as", socket.id);
  localPlayer = new Player(socket.id, true);
  players[socket.id] = localPlayer;
});

socket.on("playerJoined", (id) => {
  if (!players[id]) {
    players[id] = new Player(id, false);
    console.log(`Player ${id} joined`);
  }
});

socket.on("playerMoved", (data) => {
  const { id, position, rotationY } = data;
  if (id!== socket.id && players[id]) {
    players[id].applyState({ position, rotationY });
  }
});

socket.on("playerLeft", (id) => {
  if (players[id]) {
    players[id].dispose();
    delete players[id];
    console.log(`Player ${id} left`);
  }
});

socket.on("currentPlayers", (playersData) => {
  for (const id in playersData) {
    if (id !== socket.id) {
      players[id] = new Player(id, false);
      players[id].applyState(playersData[id]);
    }
  }
});

// --- Chat Handling ---
const chatDisplay = document.getElementById('chat-display');
const chatInput = document.getElementById('chat-input');

// Send chat message when the user presses Enter
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim() !== '') {
    const message = chatInput.value;
    socket.emit('chat', message);
    chatInput.value = ''; // Clear input after sending
  }
});

// Receive chat message from server and display it
socket.on('chat', (data) => {
  const { id, message } = data;
  const player = players[id] || { name: `Player ${id}` };
  const chatMessage = document.createElement('div');
  chatMessage.textContent = `${player.name}: ${message}`;
  chatDisplay.appendChild(chatMessage);
  chatDisplay.scrollTop = chatDisplay.scrollHeight; // Scroll to bottom
});


// --- Handle window resizing ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---
function animate() {
  const delta = clock.getDelta();

  for (const player of Object.values(players)) {
    player.update(delta);
  }

  if (localPlayer) {
    const desiredOffset = new THREE.Vector3(0, 5, 10);
    const targetPos = localPlayer.rig.position.clone();
    cameraTarget.position.lerp(targetPos, 0.1); // smooth follow

    const desiredCameraPos = cameraTarget.position.clone().add(desiredOffset);
    camera.position.lerp(desiredCameraPos, 0.1); // smooth camera

    camera.lookAt(cameraTarget.position);
  }


  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}


animate();