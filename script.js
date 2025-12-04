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

    // --- THREE.JS SETUP ---
    const scene = new THREE.Scene();

    // Logic: 
    // Y: 0 (bottom) to 600 (top).
    // X: 0 is center.
    const LOGIC_HEIGHT = 600; 
    let LOGIC_WIDTH = 0; // Calculated on resize
    
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
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

    // Bird
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

    // Ground
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

    // Pipes
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
    const BIRD_VISUAL_X = -80; // Visual X position of bird
    
    // Physics
    const gravity = 0.45;
    const flapStrength = -8;
    const scrollSpeed = 3.5;
    
    let bird_y = 0;
    let bird_velocity = 0;
    let bird_rot = 0;
    let score = 0;
    
    // Pipe Logic
    let pipes = []; 
    let pipeSpawnDistance = 300; 
    
    let basePipeGap = 160;
    let currentPipeGap = basePipeGap;
    
    // State
    let gameState = 'START';
    let isPaused = false;
    let difficulty = 'Normal';
    
    // Autobot
    let autobot = false;
    let demoMode = true;

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

    // --- HELPER FUNCTIONS ---
    function logicToVisualY(y) {
        return y - (LOGIC_HEIGHT / 2);
    }

    function resetGame() {
        bird_y = LOGIC_HEIGHT / 2;
        bird_velocity = 0;
        bird_rot = 0;
        score = 0;
        pipes = [];
        
        pipePool.forEach(p => { p.x = -1000; p.active = false; });
        
        currentPipeGap = (difficulty === 'Normal') ? 160 : 160;
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
            
            pipes.push({ 
                poolIdx: pipePool.indexOf(poolObj),
                x: poolObj.x,
                gapY: gapY,
                gapSize: currentPipeGap,
                passed: false
            });
        }
    }

    function updateUI() {
        scoreEl.innerText = score;
        gapEl.innerText = Math.round(currentPipeGap);
        diffEl.innerText = difficulty;
        autoEl.innerText = autobot ? "ON" : "OFF";
        
        if(demoMode && gameState !== 'PLAY') {
            demoEl.innerText = "WAITING FOR INPUT...";
        } else if (autobot && demoMode) {
            demoEl.innerText = "DEMO MODE ACTIVE";
        } else {
            demoEl.innerText = "";
        }
    }

    function flap() {
        if (gameState === 'PLAY' && !isPaused) {
            bird_velocity = flapStrength;
            
            if(demoMode && autobot) {
                autobot = false;
                demoMode = false;
                updateUI();
            }
        } else if (gameState !== 'PLAY') {
            resetGame();
            bird_velocity = flapStrength;
            
            if(demoMode) {
                autobot = false;
                demoMode = false;
                updateUI();
            }
        }
    }

    // --- GAME LOOP ---
    function animate() {
        requestAnimationFrame(animate);

        if (gameState === 'PLAY' && !isPaused) {
            // 1. Bird Physics
            bird_velocity += gravity;
            bird_y -= bird_velocity;

            // Rotation
            const targetRot = (bird_velocity < 0) ? 0.5 : -0.5; 
            bird_rot += (targetRot - bird_rot) * 0.1;
            birdGroup.rotation.z = bird_rot;

            // 2. Pipes
            if (pipes.length === 0 || (LOGIC_WIDTH/2 + 60) - pipes[pipes.length-1].x >= pipeSpawnDistance) {
                spawnPipeLogic();
            }

            for (let i = pipes.length - 1; i >= 0; i--) {
                let p = pipes[i];
                p.x -= scrollSpeed;
                
                const poolObj = pipePool[p.poolIdx];
                poolObj.x = p.x;

                // Scoring (BIRD_VISUAL_X is -80)
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

            // 3. Collision
            if (bird_y < BASE_HEIGHT + BIRD_RADIUS || bird_y > LOGIC_HEIGHT) {
                gameOver();
            }

            pipes.forEach(p => {
                // Horizontal Hit Check
                if (Math.abs(p.x - BIRD_VISUAL_X) < (PIPE_WIDTH/2 + BIRD_RADIUS - 5)) {
                    const birdBottom = bird_y - BIRD_RADIUS;
                    const birdTop = bird_y + BIRD_RADIUS;
                    const gapBottom = p.gapY;
                    const gapTop = p.gapY + p.gapSize;

                    if (birdBottom < gapBottom || birdTop > gapTop) {
                        gameOver();
                    }
                }
            });

            // 4. AUTOBOT LOGIC (Revised)
            if (autobot) {
                // Find the closest pipe that is technically still "playable" (in front or inside)
                // Use a slight offset so we don't ignore the pipe we are currently inside
                const nextPipe = pipes.find(p => p.x > BIRD_VISUAL_X - (PIPE_WIDTH/2));
                
                // If there is a pipe coming...
                if (nextPipe) {
                    // We specifically want to flap when we are getting close to the BOTTOM pipe.
                    // gapY is the Y coordinate of the bottom pipe's top rim.
                    
                    // --- CHANGE THIS LINE ---
                    const floorThreshold = nextPipe.gapY + 25; 
                    // ------------------------
                    
                    // Don't flap if it pushes us into the ceiling
                    const ceilingThreshold = nextPipe.gapY + nextPipe.gapSize - BIRD_RADIUS - 15;

                    // If bird falls below the safe floor line, flap.
                    if (bird_y < floorThreshold) {
                        // But only if we have room above
                        if (bird_y < ceilingThreshold) {
                             bird_velocity = flapStrength;
                        }
                    }
                } else {
                    // No pipe in view? Just hover in middle
                    if (bird_y < LOGIC_HEIGHT / 2) bird_velocity = flapStrength;
                }
            }

        } else if (gameState === 'OVER') {
            if (bird_y > BASE_HEIGHT + BIRD_RADIUS) {
                bird_velocity += gravity * 2;
                bird_y -= bird_velocity;
                birdGroup.rotation.z = -1.5;
            } else {
                bird_y = BASE_HEIGHT + BIRD_RADIUS;
            }
        } else {
            // Idle
            const time = Date.now() * 0.005;
            bird_y = (LOGIC_HEIGHT / 2) + Math.sin(time) * 15;
            birdGroup.rotation.z = 0;
        }

        // RENDER MAPPING
        const visualY = logicToVisualY(bird_y);
        birdGroup.position.y = visualY;
        birdGroup.position.x = BIRD_VISUAL_X;

        pipePool.forEach(p => {
            if (p.active) {
                const logicP = pipes.find(lp => pipePool[lp.poolIdx] === p);
                if (logicP) {
                    p.top.position.x = logicP.x;
                    p.bottom.position.x = logicP.x;
                    p.bottom.position.y = logicToVisualY(logicP.gapY);
                    p.top.position.y = logicToVisualY(logicP.gapY + logicP.gapSize);
                }
            } else {
                p.top.position.x = 2000;
                p.bottom.position.x = 2000;
            }
        });

        renderer.render(scene, camera);
    }

    function gameOver() {
        gameState = 'OVER';
        finalScoreEl.innerText = score;
        overMsg.style.display = 'block';
        
        // Auto restart for demo
        if(autobot && demoMode) {
            setTimeout(() => {
                if(gameState === 'OVER') {
                    resetGame();
                    bird_velocity = flapStrength;
                }
            }, 800);
        }
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
        let idx = modes.indexOf(difficulty);
        idx = (idx + 1) % modes.length;
        difficulty = modes[idx];
        if (gameState === 'START') {
             currentPipeGap = (difficulty === 'Normal') ? 160 : 160;
        }
        updateUI();
    }
    
    // Auto Demo Start
    setTimeout(() => {
        if(gameState === 'START' && demoMode) {
            autobot = true;
            resetGame();
            bird_velocity = flapStrength;
        }
    }, 2000);

    // Event Listeners
    flapBtn.addEventListener('click', (e) => { e.stopPropagation(); flap(); });
    pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
    diffBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDifficulty(); });

    container.addEventListener('mousedown', flap);
    container.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, {passive: false});

    window.addEventListener('keydown', (e) => {
        if(e.code === 'Space' || e.code === 'ArrowUp') flap();
        if(e.code === 'KeyP') togglePause();
        if(e.code === 'KeyN') toggleDifficulty();
        if(e.code === 'KeyB') {
             autobot = !autobot; 
             demoMode = false;
             updateUI(); 
        }
    });

    animate();
});
