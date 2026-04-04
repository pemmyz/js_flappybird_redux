document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const container = document.getElementById('gameContainer');
    const scoreEl = document.getElementById('scoreDisplay');
    const gapEl = document.getElementById('pipeGapDisplay');
    const diffEl = document.getElementById('difficultyDisplayElement');
    const autoEl = document.getElementById('autobotStatusDisplay');
    const demoEl = document.getElementById('autobotDemoStatusDisplay');
    const startMsg = document.getElementById('startMessage');
    const pauseMsg = document.getElementById('pausedMessage');
    const overMsg = document.getElementById('gameOverMessage');
    const finalScoreEl = document.getElementById('finalScore');
    
    const flapBtn = document.getElementById('flapBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const diffBtn = document.getElementById('difficultyBtn');
    const fsBtn = document.getElementById('fullscreenBtn');

    // --- THREE.JS SETUP ---
    const scene = new THREE.Scene();
    const LOGIC_HEIGHT = 600; 
    let LOGIC_WIDTH = 0; 
    
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 200);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // --- ASSETS ---
    const birdMaterial = new THREE.MeshPhongMaterial({ color: 0xff3333, shininess: 50 });
    const beakMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00 });
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const pipeMaterial = new THREE.MeshPhongMaterial({ color: 0x73bf2e, shininess: 30 });
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xded895 });
    const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x73bf2e });

    const birdGroup = new THREE.Group();
    const birdBody = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), birdMaterial);
    birdBody.castShadow = true;
    birdGroup.add(birdBody);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(5, 10, 16), beakMaterial);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(12, -2, 0);
    birdGroup.add(beak);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), eyeMaterial);
    eyeL.position.set(6, 6, 8);
    birdGroup.add(eyeL);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), pupilMaterial);
    pupilL.position.set(10, 6, 9);
    birdGroup.add(pupilL);
    scene.add(birdGroup);

    const groundGroup = new THREE.Group();
    const groundBlock = new THREE.Mesh(new THREE.BoxGeometry(1, 100, 100), groundMaterial); 
    groundBlock.position.y = -50; 
    groundBlock.receiveShadow = true;
    const grassBlock = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 100), grassMaterial);
    grassBlock.position.y = 5;
    grassBlock.receiveShadow = true;
    groundGroup.add(groundBlock);
    groundGroup.add(grassBlock);
    scene.add(groundGroup);

    const PIPE_WIDTH = 55;
    const pipePool = [];
    const pipeCount = 4; 

    function createPipe() {
        const group = new THREE.Group();
        const height = 800;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, height, 32), pipeMaterial);
        tube.castShadow = true;
        tube.receiveShadow = true;
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(29, 29, 25, 32), pipeMaterial);
        rim.castShadow = true;
        rim.receiveShadow = true;
        group.add(tube);
        group.add(rim);
        return group;
    }

    for(let i=0; i<pipeCount; i++) {
        const top = createPipe();
        const bottom = createPipe();
        top.children[0].position.y = 400 + 12.5; 
        top.children[1].position.y = 0; 
        bottom.children[0].position.y = -400 - 12.5;
        bottom.children[1].position.y = 0; 
        scene.add(top);
        scene.add(bottom);
        pipePool.push({ top, bottom, x: -1000, active: false });
    }

    // --- GAME VARIABLES ---
    const BASE_HEIGHT = 20; 
    const BIRD_RADIUS = 12;
    const BIRD_VISUAL_X = -80; 
    
    const gravity = 0.45;
    const flapStrength = -8;
    const scrollSpeed = 3.5;
    
    let bird_y = 0;
    let bird_velocity = 0;
    let bird_rot = 0;
    let score = 0;
    let pipes = []; 
    let pipeSpawnDistance = 300; 
    let basePipeGap = 160;
    let currentPipeGap = basePipeGap;
    let gameState = 'START';
    let isPaused = false;
    let difficulty = 'Normal';
    let autobot = false;
    let demoMode = true;

    // --- FPS CONTROL VARIABLES ---
    let lastTime = performance.now();
    const fpsInterval = 1000 / 60; // Locked to 60 updates per second

    // --- FULLSCREEN LOGIC (WITH iOS FALLBACK) ---
    let isFakeFullscreen = false;

    function updateFullscreenState() {
        const isFS = document.fullscreenElement || document.webkitFullscreenElement || isFakeFullscreen;
        if (isFS) {
            document.body.classList.add('is-fullscreen');
            fsBtn.innerText = "EXIT FULLSCREEN";
        } else {
            document.body.classList.remove('is-fullscreen');
            fsBtn.innerText = "⛶ FULLSCREEN";
        }
    }

    // Standard event listeners for Android/Desktop
    document.addEventListener('fullscreenchange', () => { isFakeFullscreen = false; updateFullscreenState(); });
    document.addEventListener('webkitfullscreenchange', () => { isFakeFullscreen = false; updateFullscreenState(); });

    fsBtn.addEventListener('click', () => {
        const doc = document.documentElement;
        const isFS = document.fullscreenElement || document.webkitFullscreenElement || isFakeFullscreen;

        if (!isFS) {
            // Enter Fullscreen
            if (doc.requestFullscreen) {
                doc.requestFullscreen();
            } else if (doc.webkitRequestFullscreen) {
                doc.webkitRequestFullscreen();
            } else {
                // Fallback for iOS (Safari doesn't support the Fullscreen API on iPhones)
                isFakeFullscreen = true;
            }
        } else {
            // Exit Fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else {
                isFakeFullscreen = false;
            }
        }
        updateFullscreenState();
        setTimeout(handleResize, 100); // Recalculate aspect ratio cleanly
    });

    // --- RESIZE HANDLING ---
    function handleResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const dist = (LOGIC_HEIGHT / 2) / Math.tan((fov * Math.PI / 180) / 2);
        camera.position.z = dist;
        LOGIC_WIDTH = LOGIC_HEIGHT * camera.aspect;
        groundBlock.scale.x = LOGIC_WIDTH * 2;
        grassBlock.scale.x = LOGIC_WIDTH * 2;
        groundGroup.position.y = -(LOGIC_HEIGHT/2) + BASE_HEIGHT; 
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    function logicToVisualY(y) { return y - (LOGIC_HEIGHT / 2); }

    function resetGame() {
        bird_y = LOGIC_HEIGHT / 2;
        bird_velocity = 0;
        bird_rot = 0;
        score = 0;
        pipes = [];
        pipePool.forEach(p => { p.x = -1000; p.active = false; });
        currentPipeGap = 160;
        updateUI();
        startMsg.style.display = 'none';
        overMsg.style.display = 'none';
        pauseMsg.style.display = 'none';
        gameState = 'PLAY';
        isPaused = false;
        pauseBtn.textContent = 'PAUSE (P)';
    }

    function spawnPipeLogic() {
        const poolObj = pipePool.find(p => !p.active);
        if(poolObj) {
            poolObj.active = true;
            poolObj.x = (LOGIC_WIDTH / 2) + 60; 
            const minGapY = BASE_HEIGHT + 60;
            const maxGapY = LOGIC_HEIGHT - currentPipeGap - 60;
            const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
            pipes.push({ poolIdx: pipePool.indexOf(poolObj), x: poolObj.x, gapY: gapY, gapSize: currentPipeGap, passed: false });
        }
    }

    function updateUI() {
        scoreEl.innerText = score;
        gapEl.innerText = Math.round(currentPipeGap);
        diffEl.innerText = difficulty;
        autoEl.innerText = autobot ? "ON" : "OFF";
        demoEl.innerText = (demoMode && gameState === 'PLAY' && autobot) ? "DEMO MODE ACTIVE" : (demoMode ? "WAITING FOR INPUT..." : "");
    }

    function flap() {
        if (gameState === 'PLAY' && !isPaused) {
            bird_velocity = flapStrength;
            if(demoMode && autobot) { autobot = false; demoMode = false; updateUI(); }
        } else if (gameState !== 'PLAY') {
            resetGame();
            bird_velocity = flapStrength;
            if(demoMode) { autobot = false; demoMode = false; updateUI(); }
        }
    }

    // --- FIXED TIMESTEP GAME LOOP ---
    function animate(currentTime) {
        requestAnimationFrame(animate);

        const elapsed = currentTime - lastTime;

        // Only update logic if enough time has passed for 60fps
        if (elapsed >= fpsInterval) {
            lastTime = currentTime - (elapsed % fpsInterval);

            if (gameState === 'PLAY' && !isPaused) {
                bird_velocity += gravity;
                bird_y -= bird_velocity;
                const targetRot = (bird_velocity < 0) ? 0.5 : -0.5; 
                bird_rot += (targetRot - bird_rot) * 0.1;
                birdGroup.rotation.z = bird_rot;

                if (pipes.length === 0 || (LOGIC_WIDTH/2 + 60) - pipes[pipes.length-1].x >= pipeSpawnDistance) {
                    spawnPipeLogic();
                }

                for (let i = pipes.length - 1; i >= 0; i--) {
                    let p = pipes[i];
                    p.x -= scrollSpeed;
                    const poolObj = pipePool[p.poolIdx];
                    poolObj.x = p.x;
                    if (!p.passed && p.x < BIRD_VISUAL_X) { 
                        score++;
                        p.passed = true;
                        if (difficulty === 'Hard') currentPipeGap = Math.max(100, currentPipeGap - 1);
                        if (difficulty === 'Extra Hard') currentPipeGap = Math.max(90, currentPipeGap - 2);
                        updateUI();
                    }
                    if (p.x < -(LOGIC_WIDTH/2) - 60) {
                        poolObj.active = false;
                        pipes.splice(i, 1);
                    }
                }

                if (bird_y < BASE_HEIGHT + BIRD_RADIUS || bird_y > LOGIC_HEIGHT) gameOver();

                pipes.forEach(p => {
                    if (Math.abs(p.x - BIRD_VISUAL_X) < (PIPE_WIDTH/2 + BIRD_RADIUS - 5)) {
                        if (bird_y - BIRD_RADIUS < p.gapY || bird_y + BIRD_RADIUS > p.gapY + p.gapSize) gameOver();
                    }
                });

                if (autobot) {
                    const nextPipe = pipes.find(p => p.x > BIRD_VISUAL_X - (PIPE_WIDTH/2));
                    if (nextPipe) {
                        if (bird_y < (nextPipe.gapY + 25) && bird_y < (nextPipe.gapY + nextPipe.gapSize - 30)) bird_velocity = flapStrength;
                    } else if (bird_y < LOGIC_HEIGHT / 2) bird_velocity = flapStrength;
                }

            } else if (gameState === 'OVER') {
                if (bird_y > BASE_HEIGHT + BIRD_RADIUS) {
                    bird_velocity += gravity * 2;
                    bird_y -= bird_velocity;
                    birdGroup.rotation.z = -1.5;
                } else bird_y = BASE_HEIGHT + BIRD_RADIUS;
            } else {
                const time = Date.now() * 0.005;
                bird_y = (LOGIC_HEIGHT / 2) + Math.sin(time) * 15;
                birdGroup.rotation.z = 0;
            }

            // Sync Visuals
            birdGroup.position.y = logicToVisualY(bird_y);
            birdGroup.position.x = BIRD_VISUAL_X;
            pipePool.forEach(p => {
                if (p.active) {
                    const lp = pipes.find(lp => pipePool[lp.poolIdx] === p);
                    if (lp) {
                        p.top.position.x = p.bottom.position.x = lp.x;
                        p.bottom.position.y = logicToVisualY(lp.gapY);
                        p.top.position.y = logicToVisualY(lp.gapY + lp.gapSize);
                    }
                } else { p.top.position.x = p.bottom.position.x = 2000; }
            });
        }

        renderer.render(scene, camera);
    }

    function gameOver() {
        gameState = 'OVER';
        finalScoreEl.innerText = score;
        overMsg.style.display = 'block';
        if(autobot && demoMode) setTimeout(() => { if(gameState === 'OVER') resetGame(); }, 800);
    }

    function togglePause() {
        if(gameState === 'PLAY') {
            isPaused = !isPaused;
            pauseMsg.style.display = isPaused ? 'block' : 'none';
            pauseBtn.textContent = isPaused ? 'RESUME (P)' : 'PAUSE (P)';
        }
    }

    function toggleDifficulty() {
        const modes = ['Normal', 'Hard', 'Extra Hard'];
        difficulty = modes[(modes.indexOf(difficulty) + 1) % modes.length];
        updateUI();
    }
    
    // Input Handling (Pointerdown fixes 120Hz double-fire)
    const onTrigger = (e) => {
        if (e && e.target.closest('.game-btn')) return; 
        if (e) e.preventDefault();
        flap();
    };

    container.addEventListener('pointerdown', onTrigger);
    flapBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); flap(); });
    pauseBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); togglePause(); });
    diffBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleDifficulty(); });

    window.addEventListener('keydown', (e) => {
        if(e.code === 'Space' || e.code === 'ArrowUp') flap();
        if(e.code === 'KeyP') togglePause();
        if(e.code === 'KeyN') toggleDifficulty();
        if(e.code === 'KeyB') { autobot = !autobot; demoMode = false; updateUI(); }
    });

    setTimeout(() => { if(gameState === 'START' && demoMode) { autobot = true; resetGame(); } }, 2000);

    animate(performance.now());
});
