// core/Game.js
import * as THREE from 'three';
import { Player } from '../entities/Player.js';
import { InputController } from './InputController.js';
import { EnemySpawner } from '../systems/EnemySpawner.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EnvironmentSystem } from '../systems/EnvironmentSystem.js';
import { UISystem } from '../systems/UISystem.js';



export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        this.player = null;
        this.ground = null;

        this.input = null;

        this.enemySpawner = null;
        this.combatSystem = null;
        this.environmentSystem = null;
        this.uiSystem = null;

        this.elapsedTime = 0;
        this.killCount = 0;
        this.isGameOver = false;

        this._initThree();
        this._initWorld();
        this._initSystems();

        this.input = new InputController(this.renderer.domElement);
        this.player = new Player(this.scene, this.ground); // plane 위를 걷게

        this.player.onDeathCallback = () => {
            this.handlePlayerDeath();
        }

        this._bindEvents();

        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    _initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(-3, 8, 2);
        this.scene.add(this.camera);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xffffff);
        document.body.appendChild(this.renderer.domElement);
    }

    _initWorld() {
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(5, 12, 8);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        const planeGeometry = new THREE.PlaneGeometry(1500, 1500);
        const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaa00 });
        const ground = new THREE.Mesh(planeGeometry, planeMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.ground = ground;

        // TODO: worldCubes, followerCubes 등도 여기서 만들고
        // this.enemies, this.obstacles 배열에 넣어 관리
    }

    _initSystems() {
        // Enemy Spawner
        this.enemySpawner = new EnemySpawner(this.scene, this.ground, {
                maxEnemies: 15,
                spawnInterval: 3.0,
                minSpawnRadius: 10,
                maxSpawnRadius: 30,
                enemyOptions: {
                    color: 0xff5555,
                    radius: 0.8,
                    maxHp: 30,
                    moveSpeed: 2.5,
                    chaseRange: 25,
                    loseInterestRange: 35,
                    attackRange: 2.0,
                    attackDamage: 5,
                    attackCooldown: 1.0,
                }
            },
            (enemy) => {
                this.handleEnemyDeath(enemy);
        });

        // Combat System
        this.combatSystem = new CombatSystem({
            playerAttackRange: 3.0,
            playerAttackAngle: Math.PI / 3,
            playerAttackDamage: 15,
            playerAttackCooldown: 0.4,
            enemyAttackCooldown: 1.0,
        });

        // Environment System
        this.environmentSystem = new EnvironmentSystem(this.scene, this.renderer, this.ground);

        window.addEventListener('keydown', (e) => {
        if (!this.environmentSystem) return;

        if (e.key === '1') this.environmentSystem.setMode('grassland');
        if (e.key === '2') this.environmentSystem.setMode('wasteland');
        if (e.key === '3') this.environmentSystem.setMode('hell');
        });
        
        // UI System
        this.uiSystem = new UISystem();


}

    _bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        const delta = this.clock.getDelta();
        if (this.isGameOver) {
            // 시간 멈추고 싶으면 elapsedTime 안 올리기
            this.uiSystem.update({
                hp: this.player.hp ?? 0,
                maxHp: this.player.maxHp ?? 100,
                killCount: this.killCount ?? 0,
                level: this.player.level ?? 1,
                elapsedTime: this.elapsedTime,
            });
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.animate);
            return;
        }

        this.elapsedTime += delta;

        // 입력 업데이트
        this.input.update();

        // 플레이어 업데이트
        this.player.update(delta, this.input);

        // 적 스폰/AI 업데이트
        if (this.enemySpawner) {
        this.enemySpawner.update(delta, this.player);

        // 각 enemy의 AI update
        this.enemySpawner.enemies.forEach(enemy => {
            enemy.update(delta, this.player);
        });
        }

        // 전투 판정 (양쪽 공격/피격)
        if (this.combatSystem && this.enemySpawner) {
            this.combatSystem.update(
                delta,
                this.player,
                this.enemySpawner.enemies,
                this.input
            );
        }

        // envirnment 갱신
        if (this.environmentSystem) {
            this.environmentSystem.update(delta);
        }

        // ui 갱신
        if (this.uiSystem && this.player) {
            this.uiSystem.update({
                hp: this.player.hp ?? 0,
                maxHp: this.player.maxHp ?? 100,
                killCount: this.killCount ?? 0,
                level: this.player.level ?? 1,
                elapsedTime: this.elapsedTime,
        });
        }

        // 카메라 위치 갱신
        this.input.applyToCamera(this.camera);
        this._updateCamera();

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate);
    }

    _updateCamera() {
        const offset = this.player.cameraOffset; // Player 안에서 정의
        const dir = this.player.getForwardVector();
        const pos = this.player.mesh.position;

        this.camera.position.set(
            pos.x - dir.x * offset.z,
            pos.y + offset.y,
            pos.z - dir.z * offset.z
        );
        const forward = this.player.getForwardVector();
        this.camera.position.addScaledVector(forward, -offset.z);
    }

    handleEnemyDeath(enemy) {
        // 1) 킬 카운트 증가
        this.killCount += 1;
        console.log('Kill count:', this.killCount);

        // 2) 씬에서 메쉬 제거
        if (enemy.mesh) {
            this.scene.remove(enemy.mesh);
        }

        // 3) EnemySpawner의 enemies 배열에서 제거
        if (this.enemySpawner && this.enemySpawner.enemies) {
            this.enemySpawner.enemies = this.enemySpawner.enemies.filter(e => e !== enemy);
        }

        // 4) 필요하면 추가 연출 (드랍 아이템, 이펙트 등) 여기에
    }

    handlePlayerDeath() {
        console.log('Player died!');
        this.isGameOver = true;

        // UI에 게임오버 표시
        if (this.uiSystem) {
            this.uiSystem.showGameOver();
        }
    }

}
