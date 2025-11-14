import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { initStats, initRenderer, initCamera, initOrbitControls } from './util.js';

// ----------------------------------------------------------
// 1. 기본 설정
// ----------------------------------------------------------
const scene = new THREE.Scene();
const renderer = initRenderer();
let camera = initCamera();
const stats = initStats();
const orbitControls = initOrbitControls(camera, renderer);
const clock = new THREE.Clock();


// ----------------------------------------------------------
// 2. 태양광(PointLight) + 태양 Sphere
// ----------------------------------------------------------
const ambient = new THREE.AmbientLight(0x404040, 30);
scene.add(ambient);

const sunGeo = new THREE.SphereGeometry(10, 32, 32);
const sunMat = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 3.0
});
const sun = new THREE.Mesh(sunGeo, sunMat);
scene.add(sun);

const sunLight = new THREE.PointLight(0xffffff, 10, 0); 
sunLight.position.copy(sun.position);
scene.add(sunLight);


// ----------------------------------------------------------
// 3. Planet 클래스
// ----------------------------------------------------------
class Planet {
    constructor({ name, radius, distance, color, rotationSpeed, orbitSpeed, texture }) {
        this.name = name;
        this.radius = radius;
        this.distance = distance;
        this.color = color;
        this.rotationSpeed = rotationSpeed;
        this.orbitSpeed = orbitSpeed;

        this.orbitAngle = 0;

        const geo = new THREE.SphereGeometry(radius, 32, 32);
        const tex = texture ? new THREE.TextureLoader().load(texture) : null;
        tex && (tex.colorSpace = THREE.SRGBColorSpace);

        const mat = tex
            ? new THREE.MeshStandardMaterial({ map: tex })
            : new THREE.MeshStandardMaterial({ color: 0xffffff });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(distance, 0, 0);
        scene.add(this.mesh);
    }

    update(dt) {
        this.mesh.rotation.y += this.rotationSpeed * dt * 60;
        this.orbitAngle += this.orbitSpeed * dt * 60;

        this.mesh.position.set(
            Math.cos(this.orbitAngle) * this.distance,
            0,
            Math.sin(this.orbitAngle) * this.distance
        );
    }
}


// ----------------------------------------------------------
// 4. 행성 생성
// ----------------------------------------------------------
const planets = [];

planets.push(new Planet({
    name: 'Mercury',
    radius: 1.5,
    distance: 20,
    color: '#a6a6a6',
    rotationSpeed: 0.02,
    orbitSpeed: 0.02,
    texture: './assets/textures/Mercury.jpg'
}));

planets.push(new Planet({
    name: 'Venus',
    radius: 3,
    distance: 35,
    color: '#e39e1c',
    rotationSpeed: 0.015,
    orbitSpeed: 0.015,
    texture: './assets/textures/Venus.jpg'
}));

planets.push(new Planet({
    name: 'Earth',
    radius: 3.5,
    distance: 50,
    color: '#3498db',
    rotationSpeed: 0.01,
    orbitSpeed: 0.01,
    texture: './assets/textures/Earth.jpg'
}));

planets.push(new Planet({
    name: 'Mars',
    radius: 2.5,
    distance: 65,
    color: '#c0392b',
    rotationSpeed: 0.008,
    orbitSpeed: 0.008,
    texture: './assets/textures/Mars.jpg'
}));


// ----------------------------------------------------------
// 5. GUI
// ----------------------------------------------------------
const gui = new GUI();

// Camera 폴더
const cameraFolder = gui.addFolder("Camera");

// 행성 개별 폴더
planets.forEach(planet => {
  const f = gui.addFolder(planet.name);
  f.add(planet, "rotationSpeed", 0, 0.1, 0.001);
  f.add(planet, "orbitSpeed", 0, 0.1, 0.001);
});

// 상태값 (읽기 전용 느낌으로 표시)
const cameraState = { current: "Perspective" };

// 버튼용 래퍼 객체
const cameraActions = {
  switchCameraType() {
    if (camera instanceof THREE.PerspectiveCamera) {
      // Orthographic으로 전환
      const aspect = window.innerWidth / window.innerHeight;
      const size = 80;
      const ortho = new THREE.OrthographicCamera(
        -size * aspect, size * aspect,
         size, -size,
         0.1, 2000
      );
      ortho.position.set(120, 80, 120);
      ortho.lookAt(0, 0, 0);
      camera = ortho;
      cameraState.current = "Orthographic";
    } else {
      // 다시 Perspective로
      camera = initCamera();
      cameraState.current = "Perspective";
    }
    orbitControls.object = camera;
    orbitControls.update();
  }
};

// 버튼
cameraFolder
  .add(cameraActions, "switchCameraType")
  .name("Switch Camera Type");

// 현재 카메라 타입 표시 (listen()으로 자동 갱신)
cameraFolder
  .add(cameraState, "current")
  .name("Current Camera")
  .listen();



// ----------------------------------------------------------
// 6. Render Loop
// ----------------------------------------------------------
function animate() {
    const dt = clock.getDelta();

    stats.update();
    orbitControls.update();

    planets.forEach(p => p.update(dt));

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();


// ----------------------------------------------------------
// 7. Resize 대응
// ----------------------------------------------------------
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = window.innerWidth / window.innerHeight;
    } else {
        const aspect = window.innerWidth / window.innerHeight;
        const size = 80;
        camera.left = -size * aspect;
        camera.right = size * aspect;
    }
    camera.updateProjectionMatrix();
});
