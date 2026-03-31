const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.05;

const level = {
  goal: { x: 800, y: 140, width: 80, height: 110 },
  platforms: [
    { x: 0, y: 500, width: 260, height: 40 },
    { x: 190, y: 410, width: 220, height: 20 },
    { x: 410, y: 330, width: 220, height: 20 },
    { x: 630, y: 250, width: 240, height: 20 }
  ]
};

const controlProfiles = {
  keyboardWasd: {
    id: "keyboardWasd",
    left: ["KeyA"],
    right: ["KeyD", "KeyB"],
    jump: ["KeyW", "Space"]
  },
  keyboardArrows: {
    id: "keyboardArrows",
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    jump: ["ArrowUp"]
  }
};

const playerConfigs = [
  {
    name: "Player 1",
    color: "#ef476f",
    spawnX: 70,
    spawnY: 440,
    controlId: "keyboardWasd"
  },
  {
    name: "Player 2",
    color: "#118ab2",
    spawnX: 125,
    spawnY: 440,
    controlId: "keyboardArrows"
  }
];

const physics = {
  gravity: 1800,
  moveSpeed: 260,
  jumpVelocity: 650,
  maxFallSpeed: 900
};

const inputManager = createInputManager();

const state = {
  mode: "playing",
  message: "Reach the goal with both players",
  players: [],
  resetTimer: 0
};

function createInputManager() {
  return {
    pressedKeys: new Set(),
    controlAssignments: new Map(),
    actionStateByPlayer: new Map()
  };
}

function createControlState() {
  return {
    left: false,
    right: false,
    jump: false
  };
}

function getControlProfile(controlId) {
  return controlProfiles[controlId] || null;
}

function assignControlToPlayer(playerName, controlId) {
  inputManager.controlAssignments.set(playerName, controlId);
  updateActionStates();
}

function getAssignedControl(playerName) {
  const controlId = inputManager.controlAssignments.get(playerName);
  return getControlProfile(controlId);
}

function assignDefaultControls() {
  for (const config of playerConfigs) {
    assignControlToPlayer(config.name, config.controlId);
  }
}

function updateActionStates() {
  for (const player of state.players) {
    const controlProfile = getAssignedControl(player.name);
    const controlState = createControlState();

    if (controlProfile) {
      controlState.left = controlProfile.left.some((code) => inputManager.pressedKeys.has(code));
      controlState.right = controlProfile.right.some((code) => inputManager.pressedKeys.has(code));
      controlState.jump = controlProfile.jump.some((code) => inputManager.pressedKeys.has(code));
    }

    inputManager.actionStateByPlayer.set(player.name, controlState);
  }
}

function getPlayerControls(player) {
  return inputManager.actionStateByPlayer.get(player.name) || createControlState();
}

function createPlayer(config) {
  return {
    ...config,
    width: 34,
    height: 42,
    x: config.spawnX,
    y: config.spawnY,
    vx: 0,
    vy: 0,
    onGround: false,
    atGoal: false,
    jumpHeld: false
  };
}

function resetLevel(message = "Reach the goal with both players") {
  state.mode = "playing";
  state.message = message;
  state.resetTimer = 0;
  state.players = playerConfigs.map(createPlayer);
  updateActionStates();
}

function queueReset(message) {
  if (state.mode === "resetting") {
    return;
  }

  state.mode = "resetting";
  state.message = message;
  state.resetTimer = 1.2;
}

function setupInput() {
  window.addEventListener("keydown", (event) => {
    inputManager.pressedKeys.add(event.code);
    updateActionStates();

    if (event.code === "KeyR") {
      resetLevel("Level reset");
    }

    if (["ArrowUp", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyD", "KeyB"].includes(event.code)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    inputManager.pressedKeys.delete(event.code);
    updateActionStates();
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function handlePlayerInput(player) {
  const controls = getPlayerControls(player);
  const movingLeft = controls.left;
  const movingRight = controls.right;
  const wantsJump = controls.jump;

  player.vx = 0;

  if (movingLeft && !movingRight) {
    player.vx = -physics.moveSpeed;
  } else if (movingRight && !movingLeft) {
    player.vx = physics.moveSpeed;
  }

  if (wantsJump && player.onGround && !player.jumpHeld) {
    player.vy = -physics.jumpVelocity;
    player.onGround = false;
  }

  player.jumpHeld = wantsJump;
}

function resolvePlatformCollisions(player, previousY) {
  player.onGround = false;

  for (const platform of level.platforms) {
    if (!rectsOverlap(player, platform)) {
      continue;
    }

    const previousBottom = previousY + player.height;
    const currentBottom = player.y + player.height;

    if (player.vy >= 0 && previousBottom <= platform.y && currentBottom >= platform.y) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

function keepPlayerInBounds(player) {
  if (player.x < 0) {
    player.x = 0;
  }

  if (player.x + player.width > GAME_WIDTH) {
    player.x = GAME_WIDTH - player.width;
  }
}

function updatePlayer(player, dt) {
  handlePlayerInput(player);

  player.vy += physics.gravity * dt;
  player.vy = Math.min(player.vy, physics.maxFallSpeed);

  player.x += player.vx * dt;
  keepPlayerInBounds(player);

  const previousY = player.y;
  player.y += player.vy * dt;
  resolvePlatformCollisions(player, previousY);

  if (player.y > GAME_HEIGHT + 120) {
    queueReset(`${player.name} fell. Resetting level...`);
  }

  player.atGoal = rectsOverlap(player, level.goal);
}

function updateGame(dt) {
  if (state.mode === "resetting") {
    state.resetTimer -= dt;
    if (state.resetTimer <= 0) {
      resetLevel();
    }
    return;
  }

  updateActionStates();

  for (const player of state.players) {
    updatePlayer(player, dt);
  }

  if (state.players.every((player) => player.atGoal)) {
    queueReset("Both players reached the goal. Restarting level...");
  }
}

function drawRect(rect, color) {
  ctx.fillStyle = color;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function renderBackground() {
  ctx.fillStyle = "#8ecae6";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "#bde0fe";
  ctx.fillRect(0, 0, GAME_WIDTH, 120);
}

function renderLevel() {
  drawRect(level.goal, "#6ecb63");

  for (const platform of level.platforms) {
    drawRect(platform, "#6d597a");
  }
}

function renderPlayers() {
  for (const player of state.players) {
    drawRect(player, player.atGoal ? "#ffd166" : player.color);
  }
}

function renderHud() {
  ctx.fillStyle = "#1f2933";
  ctx.font = "20px Trebuchet MS";
  ctx.fillText(state.message, 20, 32);

  ctx.font = "16px Trebuchet MS";
  ctx.fillText("Origin: top-left, +x right, +y down", 20, 56);
}

function render() {
  renderBackground();
  renderLevel();
  renderPlayers();
  renderHud();
}

let lastTimestamp = 0;
let accumulator = 0;

function frame(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, MAX_FRAME_TIME);
  lastTimestamp = timestamp;
  accumulator += deltaSeconds;

  while (accumulator >= FIXED_STEP) {
    updateGame(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }

  render();
  window.requestAnimationFrame(frame);
}

function renderGameToText() {
  return JSON.stringify({
    mode: state.mode,
    message: state.message,
    coordinateSystem: "origin top-left, +x right, +y down",
    goal: level.goal,
    platforms: level.platforms,
    players: state.players.map((player) => ({
      name: player.name,
      x: Number(player.x.toFixed(1)),
      y: Number(player.y.toFixed(1)),
      vx: Number(player.vx.toFixed(1)),
      vy: Number(player.vy.toFixed(1)),
      onGround: player.onGround,
      atGoal: player.atGoal,
      controlId: inputManager.controlAssignments.get(player.name) || null
    }))
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (FIXED_STEP * 1000)));
  for (let i = 0; i < steps; i += 1) {
    updateGame(FIXED_STEP);
  }
  render();
};
window.__platformer = {
  state,
  level,
  controlProfiles,
  inputManager,
  assignControlToPlayer,
  getAssignedControl,
  resetLevel,
  updateGame,
  render
};

assignDefaultControls();
resetLevel();
setupInput();
render();
window.requestAnimationFrame(frame);
