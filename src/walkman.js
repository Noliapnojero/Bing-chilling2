import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class WalkmanModel {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Interactive button objects
    this.buttons = {};
    this.interactiveObjects = [];

    // Cassette spools
    this.spoolLeft = null;
    this.spoolRight = null;
    this.tapeLeft = null;
    this.tapeRight = null;
    this.tapeGroup = null;

    // LED indicators
    this.ledMesh = null;
    this.ledLight = null;
    this.isLedOn = false;

    // Button states
    this.playPressed = false;
    this.hotlinePressed = false;
    this.fwdPressed = false;
    this.sliderPosition = 0.5; // 0 to 1

    // Loader
    this.loader = new GLTFLoader();
  }

  async loadAllParts(onProgress) {
    const parts = [
      { id: 'chassis', path: '/GLB/Cube/Cube.glb', name: 'Chasis Principal' },
      { id: 'hotline', path: '/GLB/Cube_001/Cube_001.glb', name: 'Botón Hot Line' },
      { id: 'slider',  path: '/GLB/Cube_002/Cube_002.glb', name: 'Control Deslizante' },
      { id: 'stop',    path: '/GLB/Cube_003/Cube_003.glb', name: 'Botón Stop / Eject' },
      { id: 'fwd',     path: '/GLB/Cube_004/Cube_004.glb', name: 'Botón FWD / Avance' },
      { id: 'play',    path: '/GLB/Cube_005/Cube_005.glb', name: 'Botón Play' },
      { id: 'sony',    path: '/GLB/Empty_004/Empty_004.glb', name: 'Logo Sony' },
      { id: 'walkman', path: '/GLB/Empty_006/Empty_006.glb', name: 'Logo Walkman' },
    ];

    let loadedCount = 0;
    const loadPromises = parts.map(part => {
      return new Promise((resolve, reject) => {
        this.loader.load(
          part.path,
          (gltf) => {
            const root = gltf.scene;
            root.name = part.id;
            this.setupMaterialsAndShadows(root, part.id);
            this.group.add(root);

            // Register buttons and interactive parts
            this.registerInteractivePart(part.id, root);

            loadedCount++;
            if (onProgress) onProgress(loadedCount / parts.length, part.name);
            resolve(root);
          },
          undefined,
          (err) => {
            console.error(`Error loading ${part.path}:`, err);
            // Fallback resolve so other models continue
            resolve(null);
          }
        );
      });
    });

    await Promise.all(loadPromises);

    // Build the animated cassette tape inside the window
    this.buildCassetteTape();

    // Build power indicator LED
    this.buildPowerLED();

    // Center the Walkman assembly
    this.centerAssembly();

    return this.group;
  }

  setupMaterialsAndShadows(root, partId) {
    root.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          // Enhance PBR properties
          const mat = child.material;

          if (mat.name === 'Brushed aluminium' || mat.name.includes('aluminium')) {
            mat.metalness = 0.92;
            mat.roughness = 0.28;
            mat.envMapIntensity = 1.4;
          } else if (mat.name.includes('Blue plastic')) {
            mat.metalness = 0.15;
            mat.roughness = 0.38;
            mat.envMapIntensity = 1.2;
            // Classic Sony metallic blue tone
            mat.color.setRGB(0.12, 0.25, 0.52);
          } else if (mat.name.includes('Orange')) {
            mat.metalness = 0.3;
            mat.roughness = 0.25;
            mat.envMapIntensity = 1.3;
            mat.color.setRGB(1.0, 0.32, 0.05); // Vibrant Hot Line orange
          } else if (mat.name.includes('Black')) {
            mat.metalness = 0.2;
            mat.roughness = 0.7;
          }

          // Sony & Walkman decals: ensure transparency
          if (partId === 'sony' || partId === 'walkman') {
            mat.transparent = true;
            mat.depthWrite = false;
            mat.polygonOffset = true;
            mat.polygonOffsetFactor = -1;
            mat.polygonOffsetUnits = -1;
          }
        }
      }
    });
  }

  registerInteractivePart(id, root) {
    // Find the primary mesh or node
    let targetNode = root;
    root.traverse((child) => {
      if (child.isMesh && targetNode === root) {
        targetNode = child;
      }
    });

    if (id === 'play') {
      this.buttons.play = {
        node: root,
        mesh: targetNode,
        initialPos: root.position.clone(),
        pressedPos: root.position.clone().add(new THREE.Vector3(0, 0, 0.45)), // Push down into housing
        state: 'up',
        targetOffset: 0,
        currentOffset: 0,
        tooltip: 'PLAY (Reproducir)'
      };
      targetNode.userData = { id: 'play', parent: this.buttons.play };
      this.interactiveObjects.push(targetNode);
    } else if (id === 'stop') {
      this.buttons.stop = {
        node: root,
        mesh: targetNode,
        initialPos: root.position.clone(),
        pressedPos: root.position.clone().add(new THREE.Vector3(0, 0, 0.45)),
        state: 'up',
        targetOffset: 0,
        currentOffset: 0,
        tooltip: 'STOP / EJECT (Detener)'
      };
      targetNode.userData = { id: 'stop', parent: this.buttons.stop };
      this.interactiveObjects.push(targetNode);
    } else if (id === 'fwd') {
      this.buttons.fwd = {
        node: root,
        mesh: targetNode,
        initialPos: root.position.clone(),
        pressedPos: root.position.clone().add(new THREE.Vector3(0, 0, 0.45)),
        state: 'up',
        targetOffset: 0,
        currentOffset: 0,
        tooltip: 'FAST FWD (Avance Rápido)'
      };
      targetNode.userData = { id: 'fwd', parent: this.buttons.fwd };
      this.interactiveObjects.push(targetNode);
    } else if (id === 'hotline') {
      this.buttons.hotline = {
        node: root,
        mesh: targetNode,
        initialPos: root.position.clone(),
        pressedPos: root.position.clone().add(new THREE.Vector3(0, -0.35, 0)), // Push down vertically
        state: 'up',
        targetOffset: 0,
        currentOffset: 0,
        tooltip: 'HOT LINE (Micrófono / Atenuador)'
      };
      targetNode.userData = { id: 'hotline', parent: this.buttons.hotline };
      this.interactiveObjects.push(targetNode);
    } else if (id === 'slider') {
      this.buttons.slider = {
        node: root,
        mesh: targetNode,
        initialPos: root.position.clone(),
        minPos: root.position.clone().add(new THREE.Vector3(0, -0.8, 0)),
        maxPos: root.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
        value: 0.5,
        tooltip: 'TONE (Control de Tono / EQ)'
      };
      targetNode.userData = { id: 'slider', parent: this.buttons.slider };
      this.interactiveObjects.push(targetNode);
    }
  }

  // --- 3D Vintage Cassette Tape inside the Window ---
  buildCassetteTape() {
    this.tapeGroup = new THREE.Group();
    // In Walkman coordinates:
    // Window is around X = 1.25, Y = -0.85, Z = 1.28
    this.tapeGroup.position.set(1.22, -0.88, 1.28);
    this.tapeGroup.rotation.y = Math.PI / 2; // Face out of window

    // 1. Transparent Cassette Shell
    const shellGeo = new THREE.BoxGeometry(4.2, 2.7, 0.35);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0x111115,
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.7,
      ior: 1.45,
      thickness: 0.3
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    this.tapeGroup.add(shell);

    // 2. Mixtape Label Sticker
    const labelGeo = new THREE.PlaneGeometry(3.6, 1.8);
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 256;
    const ctx = labelCanvas.getContext('2d');
    
    // Draw retro 80s tape label
    ctx.fillStyle = '#f8f4e6';
    ctx.fillRect(0, 0, 512, 256);
    // Orange / red stripe
    ctx.fillStyle = '#e63946';
    ctx.fillRect(0, 20, 512, 18);
    ctx.fillStyle = '#f4a261';
    ctx.fillRect(0, 38, 512, 12);
    // Header
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('SONY HF 90', 25, 85);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SIDE A [NR OFF]', 320, 85);
    // Mixtape handwriting title
    ctx.fillStyle = '#0d1b2a';
    ctx.font = 'italic bold 32px "Courier New", monospace';
    ctx.fillText('⚡ 80s RETRO MIXTAPE ⚡', 50, 150);
    // Lines
    ctx.strokeStyle = '#a8dadc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 175); ctx.lineTo(480, 175);
    ctx.moveTo(30, 215); ctx.lineTo(480, 215);
    ctx.stroke();

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.MeshStandardMaterial({
      map: labelTex,
      roughness: 0.8,
      metalness: 0.05
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.z = 0.18;
    this.tapeGroup.add(labelMesh);

    // 3. Dual Tape Spools (White gear cogwheels)
    const createSpool = (posX) => {
      const spool = new THREE.Group();
      spool.position.set(posX, 0, 0.02);

      // Outer ring
      const ringGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.22, 24);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      spool.add(ring);

      // Inner cogs / 6 teeth
      for (let i = 0; i < 6; i++) {
        const cogGeo = new THREE.BoxGeometry(0.12, 0.24, 0.12);
        const cog = new THREE.Mesh(cogGeo, ringMat);
        const angle = (i / 6) * Math.PI * 2;
        cog.position.set(Math.cos(angle) * 0.28, Math.sin(angle) * 0.28, 0);
        spool.add(cog);
      }

      // Center hole (black)
      const holeGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.24, 16);
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.rotation.x = Math.PI / 2;
      spool.add(hole);

      return spool;
    };

    this.spoolLeft = createSpool(-1.15);
    this.spoolRight = createSpool(1.15);
    this.tapeGroup.add(this.spoolLeft);
    this.tapeGroup.add(this.spoolRight);

    // 4. Wound Brown Magnetic Tape Cylinders
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.6 });
    
    // Left spool has more tape initially (Side A starting)
    const tapeLeftGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 24);
    this.tapeLeft = new THREE.Mesh(tapeLeftGeo, tapeMat);
    this.tapeLeft.rotation.x = Math.PI / 2;
    this.tapeLeft.position.set(-1.15, 0, 0.01);
    this.tapeGroup.add(this.tapeLeft);

    // Right spool has smaller initial tape
    const tapeRightGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.18, 24);
    this.tapeRight = new THREE.Mesh(tapeRightGeo, tapeMat);
    this.tapeRight.rotation.x = Math.PI / 2;
    this.tapeRight.position.set(1.15, 0, 0.01);
    this.tapeGroup.add(this.tapeRight);

    this.group.add(this.tapeGroup);
  }

  // --- 3D Power / Play LED Indicator ---
  buildPowerLED() {
    const ledGroup = new THREE.Group();
    // Positioned near the top-front edge: X: 1.48, Y: 5.6, Z: -2.8
    ledGroup.position.set(1.48, 5.65, -2.8);

    // LED bulb (small sphere)
    const ledGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x330000,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
      metalness: 0.8
    });
    this.ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledGroup.add(this.ledMesh);

    // Real PointLight for authentic glow cast onto metal
    this.ledLight = new THREE.PointLight(0xff2222, 0, 3.5, 2.0);
    this.ledLight.position.set(0.15, 0, 0);
    ledGroup.add(this.ledLight);

    this.group.add(ledGroup);
  }

  setPowerLED(active) {
    this.isLedOn = active;
    if (this.ledMesh && this.ledLight) {
      if (active) {
        this.ledMesh.material.color.setHex(0xff3333);
        this.ledMesh.material.emissive.setHex(0xff1100);
        this.ledMesh.material.emissiveIntensity = 2.8;
        this.ledLight.intensity = 2.2;
      } else {
        this.ledMesh.material.color.setHex(0x330000);
        this.ledMesh.material.emissive.setHex(0x000000);
        this.ledMesh.material.emissiveIntensity = 0;
        this.ledLight.intensity = 0;
      }
    }
  }

  centerAssembly() {
    // Compute total bounding box
    const box = new THREE.Box3().setFromObject(this.group);
    const center = box.getCenter(new THREE.Vector3());
    // Offset children so pivot is exact center
    this.group.position.sub(center);
  }

  // --- Button Interaction Triggers ---
  pressPlay() {
    if (this.buttons.play) {
      this.playPressed = true;
      this.buttons.play.targetOffset = 1.0;
      this.setPowerLED(true);
    }
    if (this.buttons.stop) {
      this.buttons.stop.targetOffset = 0.0;
    }
  }

  pressStop() {
    if (this.buttons.play) {
      this.playPressed = false;
      this.buttons.play.targetOffset = 0.0;
      this.setPowerLED(false);
    }
    if (this.buttons.fwd) {
      this.fwdPressed = false;
      this.buttons.fwd.targetOffset = 0.0;
    }
    if (this.buttons.stop) {
      // Quick press & release bounce
      this.buttons.stop.targetOffset = 1.0;
      setTimeout(() => {
        if (this.buttons.stop) this.buttons.stop.targetOffset = 0.0;
      }, 150);
    }
  }

  toggleHotline() {
    this.hotlinePressed = !this.hotlinePressed;
    if (this.buttons.hotline) {
      this.buttons.hotline.targetOffset = this.hotlinePressed ? 1.0 : 0.0;
    }
    return this.hotlinePressed;
  }

  pressFwd(start = true) {
    this.fwdPressed = start;
    if (this.buttons.fwd) {
      this.buttons.fwd.targetOffset = start ? 1.0 : 0.0;
    }
  }

  setSliderValue(val) {
    this.sliderPosition = Math.max(0, Math.min(1, val));
    if (this.buttons.slider) {
      const b = this.buttons.slider;
      b.node.position.lerpVectors(b.minPos, b.maxPos, this.sliderPosition);
    }
  }

  // --- Animation Update Loop (60 FPS) ---
  update(delta, isPlaying, isFastForward, isRewind) {
    // 1. Smoothly animate button physical displacement (lerp)
    const lerpFactor = Math.min(1.0, delta * 14.0);

    for (const key in this.buttons) {
      const btn = this.buttons[key];
      if (btn.targetOffset !== undefined) {
        btn.currentOffset = THREE.MathUtils.lerp(btn.currentOffset, btn.targetOffset, lerpFactor);
        btn.node.position.lerpVectors(btn.initialPos, btn.pressedPos, btn.currentOffset);
      }
    }

    // 2. Rotate Cassette Tape Spools
    if (this.spoolLeft && this.spoolRight) {
      let speed = 0;
      if (isPlaying) speed = 2.4;
      if (isFastForward) speed = 8.5;
      if (isRewind) speed = -8.5;

      if (speed !== 0) {
        this.spoolLeft.rotation.z += speed * delta;
        this.spoolRight.rotation.z += speed * delta;

        // Subtle tape spool size change as tape plays
        if (this.tapeLeft && this.tapeRight && isPlaying) {
          const tapeScaleL = Math.max(0.65, 0.85 - (Date.now() % 60000) / 300000);
          const tapeScaleR = Math.min(0.85, 0.58 + (Date.now() % 60000) / 300000);
          this.tapeLeft.scale.set(tapeScaleL, tapeScaleL, 1);
          this.tapeRight.scale.set(tapeScaleR, tapeScaleR, 1);
        }
      }
    }

    // 3. Subtle pulsing glow for active LED
    if (this.isLedOn && this.ledLight) {
      const pulse = 1.0 + Math.sin(Date.now() * 0.006) * 0.12;
      this.ledLight.intensity = 2.2 * pulse;
    }
  }
}
