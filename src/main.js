import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { WalkmanModel } from './walkman.js';
import { WalkmanAudio } from './audio.js';
import { WalkmanInteraction } from './interaction.js';

class WalkmanApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d13);
    this.scene.fog = new THREE.FogExp2(0x0b0d13, 0.025);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(10, 6, 15);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 28;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't dip far below ground

    // Camera interpolation
    this.targetCamPos = null;
    this.targetControlsTarget = null;
    this.isTurntable = false;

    // Clock
    this.clock = new THREE.Clock();

    // Tape counter & VU Meter state
    this.tapeCounter = 0;
    this.counterAccumulator = 0;

    // Audio & Model components
    this.audio = new WalkmanAudio();
    this.walkman = new WalkmanModel(this.scene);
    this.interaction = null;

    this.setupLighting();
    this.setupGround();
    this.setupUIEvents();
    this.loadAssets();

    window.addEventListener('resize', () => this.onResize());
  }

  setupLighting() {
    // Studio Environment Reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Key Light (warm studio spotlight)
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.4);
    keyLight.position.set(12, 18, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Fill Light (Sony cool cyan/blue tone)
    const fillLight = new THREE.DirectionalLight(0x7bb6ff, 1.2);
    fillLight.position.set(-14, 8, -6);
    this.scene.add(fillLight);

    // Rim Light (back-bottom kicker for metallic edges)
    const rimLight = new THREE.DirectionalLight(0xff944d, 1.0);
    rimLight.position.set(0, -6, -14);
    this.scene.add(rimLight);

    // Ambient soft base
    const ambient = new THREE.AmbientLight(0x182030, 1.0);
    this.scene.add(ambient);
  }

  setupGround() {
    // Elegant studio floor with subtle circular pedestal
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x090b10,
      roughness: 0.85,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -7.2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Shadow contact catcher
    const shadowGeo = new THREE.PlaneGeometry(22, 22);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.45 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -7.18;
    shadowMesh.receiveShadow = true;
    this.scene.add(shadowMesh);

    // Pedestal accent ring
    const ringGeo = new THREE.RingGeometry(8.5, 8.6, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -7.16;
    this.scene.add(ring);
  }

  async loadAssets() {
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('loading-status');
    const loadingScreen = document.getElementById('loading-screen');

    await this.walkman.loadAllParts((progress, partName) => {
      const pct = Math.round(progress * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (statusText) statusText.textContent = `Cargando: ${partName} (${pct}%)`;
    });

    // Initialize raycast interactions
    this.interaction = new WalkmanInteraction(
      this.camera,
      this.scene,
      this.walkman,
      this.audio,
      this.renderer.domElement,
      (type, val) => this.onInteractionStateChange(type, val)
    );

    // Fade out loading screen
    setTimeout(() => {
      if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.remove(), 600);
      }
    }, 400);

    // Start render loop
    this.animate();
  }

  onInteractionStateChange(type, val) {
    // Synchronize UI elements with 3D model clicks
    const btnPlay = document.getElementById('ui-play');
    const btnStop = document.getElementById('ui-stop');
    const btnHotline = document.getElementById('ui-hotline');
    const btnFwd = document.getElementById('ui-fwd');
    const lcdState = document.getElementById('lcd-state');
    const hotlineBadge = document.getElementById('hotline-badge');
    const toneSlider = document.getElementById('slider-tone');

    if (type === 'play') {
      if (val) {
        btnPlay.classList.add('active');
        lcdState.textContent = 'PLAYING';
        lcdState.classList.add('playing');
      } else {
        btnPlay.classList.remove('active');
        lcdState.textContent = 'STOPPED';
        lcdState.classList.remove('playing');
      }
    } else if (type === 'stop') {
      btnPlay.classList.remove('active');
      btnFwd.classList.remove('active');
      lcdState.textContent = 'STOPPED';
      lcdState.classList.remove('playing');
    } else if (type === 'hotline') {
      if (val) {
        btnHotline.classList.add('active');
        hotlineBadge.classList.add('active');
      } else {
        btnHotline.classList.remove('active');
        hotlineBadge.classList.remove('active');
      }
    } else if (type === 'fwd') {
      if (val) {
        btnFwd.classList.add('active');
        lcdState.textContent = 'FAST FWD';
      } else {
        btnFwd.classList.remove('active');
        lcdState.textContent = this.audio.isPlaying ? 'PLAYING' : 'STOPPED';
      }
    } else if (type === 'tone') {
      if (toneSlider) toneSlider.value = val;
    }
  }

  setupUIEvents() {
    // Play button in UI
    const uiPlay = document.getElementById('ui-play');
    uiPlay.addEventListener('click', () => {
      if (!this.audio.isPlaying) {
        this.audio.play();
        this.walkman.pressPlay();
        this.onInteractionStateChange('play', true);
      } else {
        this.audio.stop();
        this.walkman.pressStop();
        this.onInteractionStateChange('play', false);
      }
    });

    // Stop button in UI
    const uiStop = document.getElementById('ui-stop');
    uiStop.addEventListener('click', () => {
      this.audio.stop();
      this.walkman.pressStop();
      this.onInteractionStateChange('stop', true);
    });

    // Fwd button in UI
    const uiFwd = document.getElementById('ui-fwd');
    uiFwd.addEventListener('mousedown', () => {
      this.walkman.pressFwd(true);
      this.audio.fastForward(true);
      this.onInteractionStateChange('fwd', true);
    });
    uiFwd.addEventListener('mouseup', () => {
      this.walkman.pressFwd(false);
      this.audio.fastForward(false);
      this.onInteractionStateChange('fwd', false);
    });

    // Rew button in UI
    const uiRew = document.getElementById('ui-rew');
    uiRew.addEventListener('mousedown', () => {
      this.audio.rewind(true);
      this.tapeCounter = Math.max(0, this.tapeCounter - 5);
      this.updateTapeCounterDisplay();
    });

    // Hot Line button in UI
    const uiHotline = document.getElementById('ui-hotline');
    uiHotline.addEventListener('click', () => {
      const active = this.audio.toggleHotline();
      this.walkman.toggleHotline();
      this.onInteractionStateChange('hotline', active);
    });

    // Reset counter button
    const btnReset = document.getElementById('btn-reset-counter');
    btnReset.addEventListener('click', () => {
      this.tapeCounter = 0;
      this.audio.playMechanicalClick('release');
      this.updateTapeCounterDisplay();
    });

    // Mixtape selector
    const tapeSelect = document.getElementById('tape-select');
    const trackTitleMarquee = document.getElementById('track-title-marquee');
    tapeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        document.getElementById('custom-file-input').click();
      } else {
        this.audio.setTrack(val);
        const titles = {
          'synthwave': "MIXTAPE '84 • SYNTHWAVE DREAMS",
          'citypop': "TOKYO 1984 • CITY POP NIGHTS",
          'lofi': "MIDNIGHT LO-FI • VINTAGE CASSETTE"
        };
        trackTitleMarquee.textContent = titles[val] || 'CUSTOM CASSETTE';
      }
    });

    // Upload custom audio
    const btnUpload = document.getElementById('btn-upload-tape');
    const fileInput = document.getElementById('custom-file-input');
    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const fileName = this.audio.loadCustomAudioFile(file);
        tapeSelect.value = 'custom';
        trackTitleMarquee.textContent = `MIXTAPE: ${fileName.toUpperCase()}`;
        // Auto play if already playing
        if (this.audio.isPlaying) {
          this.audio.play();
        }
      }
    });

    // Tone & Volume Sliders
    const sliderTone = document.getElementById('slider-tone');
    sliderTone.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audio.updateToneFilter(val);
      this.walkman.setSliderValue(val);
    });

    const sliderVolume = document.getElementById('slider-volume');
    sliderVolume.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audio.setVolume(val);
    });

    // Toggles for tape hiss & flutter
    const chkHiss = document.getElementById('chk-hiss');
    chkHiss.addEventListener('change', (e) => {
      this.audio.isHissEnabled = e.target.checked;
      if (!e.target.checked && this.audio.tapeHissGain) {
        this.audio.tapeHissGain.gain.setValueAtTime(0, this.audio.ctx.currentTime);
      } else if (e.target.checked && this.audio.isPlaying && this.audio.tapeHissGain) {
        this.audio.tapeHissGain.gain.setValueAtTime(0.045, this.audio.ctx.currentTime);
      }
    });

    const chkFlutter = document.getElementById('chk-flutter');
    chkFlutter.addEventListener('change', (e) => {
      this.audio.isWowFlutterEnabled = e.target.checked;
    });

    // Camera preset buttons
    const camBtns = document.querySelectorAll('.cam-btn[data-view]');
    camBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        camBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setCameraPreset(btn.dataset.view);
      });
    });

    // Turntable button
    const btnTurntable = document.getElementById('btn-turntable');
    btnTurntable.addEventListener('click', () => {
      this.isTurntable = !this.isTurntable;
      btnTurntable.classList.toggle('active', this.isTurntable);
      this.controls.autoRotate = this.isTurntable;
      this.controls.autoRotateSpeed = 1.5;
    });

    // Info modal toggle
    const btnInfo = document.getElementById('btn-info');
    const infoModal = document.getElementById('info-modal');
    const modalClose = document.getElementById('modal-close');
    btnInfo.addEventListener('click', () => infoModal.classList.add('open'));
    modalClose.addEventListener('click', () => infoModal.classList.remove('open'));
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) infoModal.classList.remove('open');
    });
  }

  setCameraPreset(view) {
    if (view === 'studio') {
      this.transitionCamera(new THREE.Vector3(10, 6, 15), new THREE.Vector3(0, 0, 0));
    } else if (view === 'front') {
      // Direct front on cassette window & logos
      this.transitionCamera(new THREE.Vector3(15.5, 0, 0), new THREE.Vector3(0, 0, 0));
    } else if (view === 'top') {
      // Close up of top buttons (PLAY, STOP, HOTLINE)
      this.transitionCamera(new THREE.Vector3(-2, 14, -4), new THREE.Vector3(-0.8, 5, -2.5));
    } else if (view === 'side') {
      // Side edge showing slider and volume
      this.transitionCamera(new THREE.Vector3(0, 3, -15), new THREE.Vector3(0, 3, 0));
    }
  }

  transitionCamera(pos, target) {
    this.targetCamPos = pos;
    this.targetControlsTarget = target;
  }

  updateTapeCounterDisplay() {
    const formatted = String(Math.floor(this.tapeCounter) % 1000).padStart(3, '0');
    document.getElementById('cnt-digit-1').textContent = formatted[0];
    document.getElementById('cnt-digit-2').textContent = formatted[1];
    document.getElementById('cnt-digit-3').textContent = formatted[2];
  }

  updateVUMeter() {
    const levels = this.audio.getVULevels();
    const ledsL = document.querySelectorAll('#vu-bar-l .vu-led');
    const ledsR = document.querySelectorAll('#vu-bar-r .vu-led');

    const litCountL = Math.round(levels.left * ledsL.length);
    const litCountR = Math.round(levels.right * ledsR.length);

    ledsL.forEach((led, i) => {
      led.classList.toggle('active', i < litCountL);
    });
    ledsR.forEach((led, i) => {
      led.classList.toggle('active', i < litCountR);
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    // Smooth camera preset interpolation
    if (this.targetCamPos && this.targetControlsTarget) {
      this.camera.position.lerp(this.targetCamPos, 0.06);
      this.controls.target.lerp(this.targetControlsTarget, 0.06);

      if (this.camera.position.distanceTo(this.targetCamPos) < 0.05) {
        this.targetCamPos = null;
        this.targetControlsTarget = null;
      }
    }

    this.controls.update();

    // Update 3D Walkman Model (button lerp, spinning reels, LED pulsing)
    this.walkman.update(delta, this.audio.isPlaying, this.audio.isFastForward, this.audio.isRewind);

    // Update Tape Counter
    if (this.audio.isPlaying) {
      this.counterAccumulator += delta;
      if (this.counterAccumulator >= 1.2) {
        this.tapeCounter++;
        this.counterAccumulator = 0;
        this.updateTapeCounterDisplay();
      }
    } else if (this.audio.isFastForward) {
      this.tapeCounter += delta * 12;
      this.updateTapeCounterDisplay();
    }

    // Update Stereo VU Meter
    this.updateVUMeter();

    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new WalkmanApp();
});
