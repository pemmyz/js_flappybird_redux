document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const SCREEN_WIDTH = 288;
    const SCREEN_HEIGHT = 512;
    
    // --- THREE.JS SETUP ---
    const container = document.getElementById('gameContainer');
    const scene = new THREE.Scene();
    
    // Camera setup for 2.5D look
    // We use a Perspective camera but position it to match the logic coordinates
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, SCREEN_WIDTH / SCREEN_HEIGHT, 0.1, 1000);
    
    // Calculate Z position to match visible height of 512 units at z=0
    const cameraZ = (SCREEN_HEIGHT / 2) / Math.tan((fov * Math.PI / 180) / 2);
    camera.position.set(0, 0, cameraZ);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 200);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- 3D ASSETS ---

    // Materials
    const birdMaterial = new THREE.MeshPhongMaterial({ color: 0xff3333, shininess: 50 }); // Red Bird
    const beakMaterial = new THREE.MeshPhongMaterial({ color: 0xffcc00 }); // Yellow Beak
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pupilMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    
    // Classic Flappy Pipe Green
    const pipeMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x73bf2e, 
        shininess: 30,
        specular: 0x111111
    });

    // Ground Material
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xded895 });
    const groundTopMaterial = new THREE.MeshLambertMaterial({ color: 0x73bf2e }); // Grass top

    // BIRD MESH
    const birdGroup = new THREE.Group();
    // Body
    const birdBody = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), birdMaterial);
    birdBody.castShadow = true;
    birdGroup.add(birdBody);
    // Beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(5, 10, 16), beakMaterial);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(12, -2, 0);
    birdGroup.add(beak);
    // Eye (White)
    const eyeGeo = new THREE.SphereGeometry(6, 16, 16);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMaterial);
    eyeL.position.set(6, 6, 8);
    birdGroup.add(eyeL);
    // Pupil
    const pupilGeo = new THREE.SphereGeometry(2, 8, 8);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMaterial);
    pupilL.position.set(10, 6, 9);
    birdGroup.add(pupilL);
    
    scene.add(birdGroup);

    // GROUND MESH
    const BASE_HEIGHT = 100; // Visual height, logic uses 20 for collision
    const groundGroup = new THREE.Group();
    const groundBlock = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_WIDTH * 1.5, BASE_HEIGHT, 100), groundMaterial);
    groundBlock.position.y = -BASE_HEIGHT/2;
    groundBlock.receiveShadow = true;
    
    const grassBlock = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_WIDTH * 1.5, 10, 100), groundTopMaterial);
    grassBlock.position.y = (BASE_HEIGHT/2) - 5 - (BASE_HEIGHT/2); // Top of ground
    grassBlock.receiveShadow = true;

    groundGroup.add(groundBlock);
    groundGroup.add(grassBlock);
    
    scene.add(groundGroup);


    // PIPE MESH POOLING (Create 2 pairs of pipes to recycle)
    const PIPE_WIDTH = 52; // Slightly wider than logic 50 for visual overlap
    const PIPE_RIM_HEIGHT = 25;
    const PIPE_RIM_SCALE = 1.1; // Rim is 10% wider
    const pipePool = [];

    function createPipeHalf(isTop) {
        const group = new THREE.Group();
        
        // Main Tube (Make it tall enough to go off screen)
        const tubeHeight = 400; 
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_WIDTH/2, PIPE_WIDTH/2, tubeHeight, 32), pipeMaterial);
        tube.castShadow = true;
        tube.receiveShadow = true;
        
        // The Rim (The "Cap")
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_WIDTH/2 * PIPE_RIM_SCALE, PIPE_WIDTH/2 * PIPE_RIM_SCALE, PIPE_RIM_HEIGHT, 32), pipeMaterial);
        rim.castShadow = true;
        rim.receiveShadow = true;

        if (isTop) {
            // Top pipe: Tube goes up, Rim is at bottom
            tube.position.y = tubeHeight / 2 + PIPE_RIM_HEIGHT / 2;
            rim.position.y = 0;
        } else {
            // Bottom pipe: Tube goes down, Rim is at top
            tube.position.y = -tubeHeight / 2 - PIPE_RIM_HEIGHT / 2;
            rim.position.y = 0;
        }

        group.add(tube);
        group.add(rim);
        return group;
    }

    // Initialize pool
    for(let i=0; i<2; i++) {
        const topPipe = createPipeHalf(true);
        const botPipe = createPipeHalf(false);
        
        // We group them nicely to just move X
        scene.add(topPipe);
        scene.add(botPipe);
        
        // Start them off screen
        topPipe.position.x = 1000;
        botPipe.position.x = 1000;

        pipePool.push({ top: topPipe, bottom: botPipe, active: false });
    }


    // --- GAME LOGIC VARIABLES ---
    
    // Bird settings
    const bird_radius = 12; // Adjusted for 3D visual match
    let bird_x = 50;
    let bird_y = SCREEN_HEIGHT / 2;
    let bird_y_change = 0;
    let bird_rotation = 0;

    // Pipe settings
    const LOGIC_PIPE_WIDTH = 50;
    const BASE_PIPE_GAP = 155;
    let pipe_gap = BASE_PIPE_GAP;
    const MIN_PIPE_GAP = bird_radius * 4;

    let pipe_x = SCREEN_WIDTH;

    const pipe_position_cycle = [0, 0, 0];
    let pipe_position_index = 0;
    let current_pipe_gap_start_y; // This is the Y coordinate of the Top of the gap

    // Base settings
    const LOGIC_BASE_HEIGHT = 20;
    const base_y = SCREEN_HEIGHT - LOGIC_BASE_HEIGHT;

    // Game settings
    const gravity = 0.4; // Slightly tweaked for 60fps feel
    const flap_strength = -7;
    const scroll_speed = 3;
    let score = 0;

    // Difficulty Settings
    const DIFFICULTIES = { NORMAL: 'Normal', HARD: 'Hard', EXTRA_HARD: 'Extra Hard' };
    const DIFFICULTY_CYCLE = ['Normal', 'Hard', 'Extra Hard'];
    let currentDifficultyIndex = 0;
    let currentDifficulty = 'Normal';

    // Game state
    let gameRunning = false;
    let gameOver = false;
    let paused = false;
    
    // Autobot State
    let autobotActive = false;
    let autobotRestartScheduled = false;
    let autobotDemoCountdown = 5;
    let autobotDemoTimer = null;
    let autobotDemoLaunched = false;

    // DOM Elements
    const scoreEl = document.getElementById('scoreDisplay');
    const gapEl = document.getElementById('pipeGapDisplay');
    const startMsg = document.getElementById('startMessage');
    const pauseMsg = document.getElementById('pausedMessage');
    const overMsg = document.getElementById('gameOverMessage');
    const finalScoreEl = document.getElementById('finalScore');
    const diffEl = document.getElementById('difficultyDisplayElement');
    const autoEl = document.getElementById('autobotStatusDisplay');
    const demoEl = document.getElementById('autobotDemoStatusDisplay');
    const flapBtn = document.getElementById('flapBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const diffBtn = document.getElementById('difficultyBtn');

    // --- HELPER FUNCTIONS ---

    // Convert Logic Y (0 top, 512 bottom) to Three Y (0 center, + up)
    function toThreeY(y) {
        return (SCREEN_HEIGHT / 2) - y;
    }
    
    // Convert Logic X (0 left, 288 right) to Three X (0 center)
    function toThreeX(x) {
        return x - (SCREEN_WIDTH / 2);
    }

    function updateUI() {
        scoreEl.innerText = score;
        gapEl.innerText = `Gate Size: ${Math.round(pipe_gap)}`;
        diffEl.innerText = `Diff: ${currentDifficulty} (N)`;
        autoEl.innerText = `Autobot: ${autobotActive ? 'ON' : 'OFF'} (B)`;
        
        if (autobotDemoLaunched && autobotActive) {
            demoEl.innerText = "DEMO MODE ACTIVE";
            demoEl.style.display = "block";
        } else if (autobotDemoTimer) {
            demoEl.innerText = `Demo in ${autobotDemoCountdown}...`;
            demoEl.style.display = "block";
        } else {
            demoEl.style.display = "none";
        }
    }

    function resetGame() {
        bird_y = SCREEN_HEIGHT / 2;
        bird_y_change = 0;
        bird_rotation = 0;
        pipe_x = SCREEN_WIDTH + 50; // Push back slightly
        score = 0;
        gameOver = false;
        paused = false;
        gameRunning = true;
        autobotRestartScheduled = false;

        // Reset Difficulty Gap
        if (currentDifficulty === 'Normal') pipe_gap = BASE_PIPE_GAP;
        else pipe_gap = BASE_PIPE_GAP; // Start normal, shrink later

        // Calculate initial pipe positions
        const area = SCREEN_HEIGHT - LOGIC_BASE_HEIGHT;
        const min_h = 50;
        const max_h = area - pipe_gap - 50;
        
        // Randomize cycle
        pipe_position_cycle[0] = Math.floor(Math.random() * (max_h - min_h) + min_h);
        pipe_position_cycle[1] = Math.floor(Math.random() * (max_h - min_h) + min_h);
        pipe_position_cycle[2] = Math.floor(Math.random() * (max_h - min_h) + min_h);
        
        pipe_position_index = 0;
        current_pipe_gap_start_y = pipe_position_cycle[0];

        startMsg.style.display = 'none';
        overMsg.style.display = 'none';
        pauseMsg.style.display = 'none';
        if (pauseBtn) pauseBtn.textContent = 'PAUSE (P)';

        // Reset Pipe Meshes visually
        pipePool.forEach(p => {
            p.top.position.x = 1000;
            p.bottom.position.x = 1000;
        });
        
        updateUI();
    }

    function performFlap() {
        if (!gameRunning && !gameOver) {
            resetGame();
            bird_y_change = flap_strength;
        } else if (gameOver) {
            resetGame();
            bird_y_change = flap_strength;
        } else if (gameRunning && !paused) {
            bird_y_change = flap_strength;
        }
    }

    function userFlap() {
        // User interaction kills demo
        if (autobotDemoTimer) { clearInterval(autobotDemoTimer); autobotDemoTimer = null; }
        if (autobotDemoLaunched) { autobotActive = false; autobotDemoLaunched = false; }
        
        updateUI();
        
        if (!autobotActive || gameOver || !gameRunning) {
            performFlap();
        }
    }

    function checkCollision() {
        // 1. Ground/Ceiling
        if (bird_y + bird_radius >= base_y) return true;
        if (bird_y - bird_radius <= 0) return true; // Actually sky ceiling, usually legal but let's bound it

        // 2. Pipes
        // Logic Pipe X is the Left edge of the pipe
        const pLeft = pipe_x;
        const pRight = pipe_x + LOGIC_PIPE_WIDTH;
        const bLeft = bird_x - bird_radius;
        const bRight = bird_x + bird_radius;
        const bTop = bird_y - bird_radius;
        const bBottom = bird_y + bird_radius;

        // Check horizontal overlap
        if (bRight > pLeft && bLeft < pRight) {
            // Check vertical (hit top pipe OR hit bottom pipe)
            // current_pipe_gap_start_y is the BOTTOM of the TOP pipe
            // current_pipe_gap_start_y + pipe_gap is the TOP of the BOTTOM pipe
            
            if (bTop < current_pipe_gap_start_y || bBottom > (current_pipe_gap_start_y + pipe_gap)) {
                return true;
            }
        }
        return false;
    }

    // --- AUTOBOT DEMO LOGIC ---
    function startDemoCountdown() {
        if (gameRunning || gameOver || autobotDemoLaunched || autobotDemoTimer) return;
        
        autobotDemoCountdown = 5;
        updateUI();
        
        autobotDemoTimer = setInterval(() => {
            autobotDemoCountdown--;
            updateUI();
            if (autobotDemoCountdown <= 0) {
                clearInterval(autobotDemoTimer);
                autobotDemoTimer = null;
                if (!gameRunning) {
                    autobotActive = true;
                    autobotDemoLaunched = true;
                    updateUI();
                    performFlap();
                }
            }
        }, 1000);
    }

    // --- MAIN GAME LOOP ---
    function animate() {
        requestAnimationFrame(animate);

        const dt = 1; // Time step factor

        if (gameRunning && !paused) {
            // Physics
            bird_y_change += gravity;
            bird_y += bird_y_change;
            
            // Bird Rotation Logic
            // -45 deg when flapping up, 90 deg when falling
            const targetRot = (bird_y_change < 0) ? -0.5 : (bird_y_change * 0.15); 
            bird_rotation += (targetRot - bird_rotation) * 0.1; // Smooth lerp
            birdGroup.rotation.z = Math.min(Math.PI/2, Math.max(-0.8, -bird_rotation)); // Note: 3D rotation Z is counter-clockwise

            // Pipe Movement
            pipe_x -= scroll_speed;

            // Pipe Recycling & Scoring
            if (pipe_x < -LOGIC_PIPE_WIDTH) {
                pipe_x = SCREEN_WIDTH;
                score++;
                
                // Difficulty Logic
                if (currentDifficulty === 'Hard') pipe_gap = Math.max(MIN_PIPE_GAP, pipe_gap - 1.5);
                if (currentDifficulty === 'Extra Hard') pipe_gap = Math.max(MIN_PIPE_GAP, pipe_gap - 3);

                // New Gap Position
                pipe_position_index = (pipe_position_index + 1) % pipe_position_cycle.length;
                
                // Add some randomness to the cycle values dynamically
                const variance = (Math.random() * 40) - 20;
                let nextY = pipe_position_cycle[pipe_position_index] + variance;
                const area = SCREEN_HEIGHT - LOGIC_BASE_HEIGHT;
                // Clamp
                nextY = Math.max(50, Math.min(area - pipe_gap - 50, nextY));
                
                current_pipe_gap_start_y = nextY;
                
                updateUI();
            }

            // Collision
            if (checkCollision()) {
                gameOver = true;
                gameRunning = false;
                
                // Fall animation setup
                overMsg.style.display = 'block';
                finalScoreEl.innerText = score;
                if(pauseBtn) pauseBtn.textContent = "PAUSE (P)";
                
                if (autobotActive) {
                    autobotRestartScheduled = true;
                    setTimeout(() => {
                        if (autobotActive && gameOver) performFlap();
                    }, 1200);
                }
            }

            // Autobot Logic
            if (autobotActive) {
                const pipeRight = pipe_x + LOGIC_PIPE_WIDTH;
                const safety = bird_radius + 5;
                const targetY = current_pipe_gap_start_y + pipe_gap - safety;
                
                // If bird is falling below the target line
                if (bird_y + bird_radius > targetY && bird_y_change >= 0) {
                    // Only flap if we are somewhat close to the pipe horizontally or inside it
                    // Or if we are just too low generally
                    if (pipe_x < SCREEN_WIDTH * 0.7 || bird_y > SCREEN_HEIGHT - 100) {
                        performFlap();
                    }
                }
            }
        } else if (gameOver) {
            // Bird falls to ground
            if (bird_y < base_y - bird_radius) {
                bird_y_change += gravity * 2;
                bird_y += bird_y_change;
                birdGroup.rotation.z = -Math.PI/2; // Face plant
            } else {
                bird_y = base_y - bird_radius;
            }
        } else {
            // Idle / Menu Bobbing
            const time = Date.now() * 0.005;
            bird_y = (SCREEN_HEIGHT / 2) + Math.sin(time) * 10;
            birdGroup.rotation.z = 0;
        }

        // --- RENDER UPDATES ---
        
        // 1. Update Bird Position
        birdGroup.position.y = toThreeY(bird_y);
        birdGroup.position.x = toThreeX(bird_x);

        // 2. Update Ground Position
        // Base Y is 492. Three Y = 512/2 - 492 = -236.
        const groundVisualY = toThreeY(base_y) - (100/2); // 100 is Box height
        groundGroup.position.y = groundVisualY;

        // 3. Update Pipes
        // We map the single logic pipe to the first pool object.
        const pObj = pipePool[0];
        const pX3D = toThreeX(pipe_x + LOGIC_PIPE_WIDTH/2);
        
        pObj.top.position.x = pX3D;
        pObj.bottom.position.x = pX3D;

        // Positioning Y
        // Top Pipe: Rim is at the bottom of the top pipe segment.
        pObj.top.position.y = toThreeY(current_pipe_gap_start_y); 
        
        // Bottom Pipe:
        const botGapEdge = current_pipe_gap_start_y + pipe_gap;
        pObj.bottom.position.y = toThreeY(botGapEdge);

        // Hide the second pool pipe (unused in this simple logic version)
        pipePool[1].top.position.x = 1000;
        pipePool[1].bottom.position.x = 1000;


        renderer.render(scene, camera);
    }

    // --- INPUT HANDLING ---
    const handleInput = (e) => {
        if (e.type === 'keydown' && (e.key === 'ArrowUp' || e.key === ' ')) {
            e.preventDefault();
            userFlap();
        } else if (e.type === 'touchstart' || e.type === 'mousedown') {
            // Check if target is a button
            if(e.target.tagName !== 'BUTTON') {
                e.preventDefault();
                userFlap();
            }
        }
    };

    window.addEventListener('keydown', (e) => {
        handleInput(e);
        if (e.key.toLowerCase() === 'p') togglePause();
        if (e.key.toLowerCase() === 'n') cycleDifficulty();
        if (e.key.toLowerCase() === 'b') toggleAutobot();
    });

    container.addEventListener('touchstart', handleInput, {passive: false});
    container.addEventListener('mousedown', handleInput);

    // Buttons
    flapBtn.addEventListener('click', (e) => { e.stopPropagation(); userFlap(); });
    
    function togglePause() {
        if (gameOver) return;
        if (autobotDemoLaunched) { autobotActive = false; autobotDemoLaunched = false; }
        paused = !paused;
        pauseMsg.style.display = paused ? 'block' : 'none';
        pauseBtn.textContent = paused ? 'RESUME (P)' : 'PAUSE (P)';
    }
    pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });

    function cycleDifficulty() {
        currentDifficultyIndex = (currentDifficultyIndex + 1) % DIFFICULTY_CYCLE.length;
        currentDifficulty = DIFFICULTY_CYCLE[currentDifficultyIndex];
        
        // If in menu, apply immediately
        if (!gameRunning) {
            if(currentDifficulty === 'Normal') pipe_gap = BASE_PIPE_GAP;
            else pipe_gap = BASE_PIPE_GAP; 
        }
        updateUI();
    }
    diffBtn.addEventListener('click', (e) => { e.stopPropagation(); cycleDifficulty(); });

    function toggleAutobot() {
        // Manual toggle kills demo specific state but enables bot
        if (autobotDemoTimer) clearInterval(autobotDemoTimer);
        autobotDemoLaunched = false;
        
        autobotActive = !autobotActive;
        updateUI();
        
        if (autobotActive && (gameOver || !gameRunning)) {
            resetGame();
            performFlap();
        }
    }

    // Initialize
    resetGame();
    gameRunning = false; // Wait for start
    startMsg.style.display = 'block';
    startDemoCountdown();
    animate();
});
