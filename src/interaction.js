import * as THREE from 'three';

export class WalkmanInteraction {
  constructor(camera, scene, walkmanModel, walkmanAudio, domElement, onStateChange) {
    this.camera = camera;
    this.scene = scene;
    this.walkman = walkmanModel;
    this.audio = walkmanAudio;
    this.domElement = domElement;
    this.onStateChange = onStateChange;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;
    this.tooltipEl = document.getElementById('tooltip-3d');

    this.isDraggingSlider = false;

    this.setupEvents();
  }

  setupEvents() {
    this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));

    // Touch support
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.updateMouseCoords(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }

  updateMouseCoords(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  onMouseMove(e) {
    this.updateMouseCoords(e.clientX, e.clientY);

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.walkman.interactiveObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      let interactive = hit.userData.parent ? hit : null;
      let cur = hit;
      while (!interactive && cur.parent) {
        if (cur.userData && cur.userData.parent) {
          interactive = cur;
          break;
        }
        cur = cur.parent;
      }

      if (interactive && interactive.userData && interactive.userData.parent) {
        this.hoveredObject = interactive;
        this.domElement.style.cursor = 'pointer';

        // Update 3D tooltip position
        if (this.tooltipEl) {
          this.tooltipEl.textContent = interactive.userData.parent.tooltip || 'Botón Walkman';
          this.tooltipEl.style.display = 'block';
          this.tooltipEl.style.left = `${e.clientX + 16}px`;
          this.tooltipEl.style.top = `${e.clientY + 12}px`;
        }
        return;
      }
    }

    // No hit
    this.hoveredObject = null;
    this.domElement.style.cursor = 'default';
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
    }
  }

  onPointerDown(e) {
    this.updateMouseCoords(e.clientX, e.clientY);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.walkman.interactiveObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      let interactive = null;
      let cur = hit;
      while (!interactive && cur) {
        if (cur.userData && cur.userData.id) {
          interactive = cur;
          break;
        }
        cur = cur.parent;
      }

      if (interactive) {
        const id = interactive.userData.id;
        this.handleButtonTrigger(id);
      }
    }
  }

  onPointerUp() {
    // If releasing FWD
    if (this.walkman.fwdPressed) {
      this.walkman.pressFwd(false);
      this.audio.fastForward(false);
      if (this.onStateChange) this.onStateChange('fwd', false);
    }
  }

  handleButtonTrigger(id) {
    if (id === 'play') {
      if (!this.audio.isPlaying) {
        this.audio.play();
        this.walkman.pressPlay();
        if (this.onStateChange) this.onStateChange('play', true);
      } else {
        // Already playing: pause or stop
        this.audio.stop();
        this.walkman.pressStop();
        if (this.onStateChange) this.onStateChange('play', false);
      }
    } else if (id === 'stop') {
      this.audio.stop();
      this.walkman.pressStop();
      if (this.onStateChange) this.onStateChange('stop', true);
    } else if (id === 'hotline') {
      const active = this.audio.toggleHotline();
      this.walkman.toggleHotline();
      if (this.onStateChange) this.onStateChange('hotline', active);
    } else if (id === 'fwd') {
      this.walkman.pressFwd(true);
      this.audio.fastForward(true);
      if (this.onStateChange) this.onStateChange('fwd', true);
    } else if (id === 'slider') {
      // Toggle slider between warm / crisp tone
      const newTone = this.audio.tone > 0.5 ? 0.2 : 0.85;
      this.audio.updateToneFilter(newTone);
      this.walkman.setSliderValue(newTone);
      if (this.onStateChange) this.onStateChange('tone', newTone);
    }
  }
}
