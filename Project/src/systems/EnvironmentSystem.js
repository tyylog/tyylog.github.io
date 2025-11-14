// src/systems/EnvironmentSystem.js
import * as THREE from 'three';

export class EnvironmentSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Mesh} groundPlane
     */
    constructor(scene, renderer, groundPlane) {
        this.scene = scene;
        this.renderer = renderer;
        this.ground = groundPlane;

        // 현재/타겟 색
        this.currentColor = new THREE.Color(0x000000);
        this.targetColor = new THREE.Color(0x000000);

        // 전환 속도
        this.lerpSpeed = 2.0; // 1.0이면 약 1초 정도에 전환된다고 생각하면 됨

        // 미리 텍스처들 로드
        const loader = new THREE.TextureLoader();
        this.textures = {
            grass: loader.load('assets/textures/ground_grass.jpg'),
            dirt:  loader.load('assets/textures/ground_dirt.jpg'),
            lava:  loader.load('assets/textures/ground_lava.jpg'),
        };
        Object.values(this.textures).forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(20, 20); // 넓은 바닥 타일링
        });

        // 테마 정의
        this.modes = {
            grassland: {
                bg: new THREE.Color(0x87ceeb),
                groundMap: this.textures.grass,
            },
            wasteland: {
                bg: new THREE.Color(0xffb266),
                groundMap: this.textures.dirt,
            },
            hell: {
                bg: new THREE.Color(0x200010),
                groundMap: this.textures.lava,
            },
        };

        this.currentMode = 'grassland';

        // 초기 배경 적용
        this.setMode(this.currentMode, true);
    }

    /** 모드 바꾸기 (즉시 또는 부드럽게) */
    setMode(name, instant = false) {
        const mode = this.modes[name];
        if (!mode) return;

        this.currentMode = name;
        this.targetColor.copy(mode.bg);

        // plane material 교체/갱신
        if (this.ground && this.ground.material) {
            this.ground.material.map = mode.groundMap;
            this.ground.material.needsUpdate = true;
        }

        if (instant) {
            this.currentColor.copy(this.targetColor);
            this._applyColor();
        }
    }

    update(delta) {
        this.currentColor.lerp(this.targetColor, this.lerpSpeed * delta);
        this._applyColor();
    }

    _applyColor() {
        this.scene.background = this.currentColor;
        this.renderer.setClearColor(this.currentColor, 1.0);
    }
}
