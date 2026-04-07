// ============================================================
// Claude Whip — renderer.js
// Verlet rope physics + proper whip graphic
// ============================================================

const canvas = document.getElementById('whip-canvas');
const ctx = canvas.getContext('2d');
const { ipcRenderer } = require('electron');

// ---- Audio (Web Audio API — no files needed) ---------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playWhipCrack() {
  const now = audioCtx.currentTime;

  // Noise burst — the "crack" transient
  const bufferSize = audioCtx.sampleRate * 0.12; // 120ms
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // White noise, heavily weighted toward the start
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 4);
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  // Bandpass filter — whip cracks are mid-high frequency pops
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.8;

  // Sharp volume envelope
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.9, now + 0.003);  // instant attack
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // fast decay

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(now);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ---- Config ------------------------------------------------
<<<<<<< HEAD
const NUM_NODES   = 60;
const SEGMENT_LEN = 6.5;
const GRAVITY     = 0.15; // Adjusted heavily for 2x sub-stepping
const ITERATIONS  = 45;
const CRACK_VEL   = 36;
=======
const NUM_NODES   = 20;      // 75% of previous length
const SEGMENT_LEN = 34;      // bigger gaps between nodes
const GRAVITY     = 0.72;    // heavier droop
const ITERATIONS  = 6;       // fewer = more flexible/whippy
const DAMPING     = 0.87;    // velocity friction — makes it feel heavy
const CRACK_VEL   = 18;      // sensitive enough to catch most forward snaps
>>>>>>> ea9f690b3353f12864539f4c1296e0b9a11b8ac7
const CRACK_FRAMES = 10;

// ---- Sound (MP3 Asset) -------------------------------------
const crackStartAudio = new Audio('assets/crack_the_whip.mp3');
crackStartAudio.volume = 1.0;

function playCrackSound() {
  // Clone the node so rapid consecutive clicks can overlap
  crackStartAudio.cloneNode().play().catch(e => console.error("Audio play error: ", e));
}

// ---- State -------------------------------------------------
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

const { ipcRenderer } = require('electron');

// Track cursor via IPC from main process
ipcRenderer.on('mouse-move', (event, { x, y }) => {
  mouse = { x, y };
});

// Crack on global click
ipcRenderer.on('mouse-click', () => {
  const tip = nodes[NUM_NODES - 1];
  crackTimer = CRACK_FRAMES;
  crackX = tip.x;
  crackY = tip.y;
  playCrackSound();
});

// Verlet nodes
let nodes = [];
function initNodes() {
  nodes = [];
  for (let i = 0; i < NUM_NODES; i++) {
    nodes.push({
      x:  mouse.x,
      y:  mouse.y + i * SEGMENT_LEN,
      px: mouse.x,
      py: mouse.y + i * SEGMENT_LEN,
    });
  }
}
initNodes();

let crackTimer = 0;
let crackX = 0, crackY = 0;
let targetWindows = [];

// Refresh target window bounds from main process every 5s
async function refreshTargetWindows() {
  targetWindows = await ipcRenderer.invoke('get-target-windows');
}
refreshTargetWindows();
setInterval(refreshTargetWindows, 5000);

function checkWindowHit(tipX, tipY) {
  for (const w of targetWindows) {
    if (tipX >= w.x && tipX <= w.x + w.width &&
        tipY >= w.y && tipY <= w.y + w.height) {
      console.log('HIT:', w.title);
      ipcRenderer.send('whip-hit');
      return true;
    }
  }
  return false;
}

// ---- Physics -----------------------------------------------
function updatePhysics() {
  const HANDLE_LEN = 50;

  // Let all nodes fall mathematically
  for (let i = 0; i < NUM_NODES; i++) {
    const n = nodes[i];
    const vx = (n.x - n.px) * DAMPING;
    const vy = (n.y - n.py) * DAMPING;
    n.px = n.x;
    n.py = n.y;
    const nodeGrav = GRAVITY;
    n.x += vx;
    n.y += vy + nodeGrav;
  }

  // Pre-iteration Structural Spring Stiffness for the first rope loop
  // Gives the rope a natural curve out of the handle base
  const hdx_pre = nodes[0].x - mouse.x;
  const hdy_pre = nodes[0].y - mouse.y;
  const hlen_pre = Math.sqrt(hdx_pre * hdx_pre + hdy_pre * hdy_pre) || 1;
  const hnx = hdx_pre / hlen_pre;
  const hny = hdy_pre / hlen_pre;
  
  for (let i = 1; i <= 15; i++) {
    // Force the first several segments to follow the handle's trajectory to create the majestic arc
    const targetX = nodes[i - 1].x + hnx * SEGMENT_LEN;
    const targetY = nodes[i - 1].y + hny * SEGMENT_LEN;
    const stiffness = 0.8 * (1 - (i - 1) / 15); // very strong at base, gradually fading
    nodes[i].x += (targetX - nodes[i].x) * stiffness;
    nodes[i].y += (targetY - nodes[i].y) * stiffness;
  }

  // Constraints iteration
  for (let iter = 0; iter < ITERATIONS; iter++) {
    // 1. Handle constraints (Mouse -> Node 0)
    let angle = Math.atan2(nodes[0].y - mouse.y, nodes[0].x - mouse.x);
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    
    // Simulates wrist strength: holding the handle UP but slightly tilted RIGHT to encourage the beautiful arc
    const targetAngle = -Math.PI * 0.35; // ~63 degrees up-right
    let angleDiff = targetAngle - angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    angle += angleDiff * 0.05; 
    
    // Clamp to 45 deg left/right of straight UP
    // Valid range: [-135 deg, -45 deg] = [-3*Math.PI/4, -Math.PI/4]
    // If it falls outside this range, snap it to the closest valid edge
    if (angle > -Math.PI / 4 && angle <= Math.PI / 2) {
      angle = -Math.PI / 4;
    } else if (angle > Math.PI / 2 || angle < -3 * Math.PI / 4) {
      angle = -3 * Math.PI / 4;
    }

    // Force perfect distance and angle for the handle
    nodes[0].x = mouse.x + Math.cos(angle) * HANDLE_LEN;
    nodes[0].y = mouse.y + Math.sin(angle) * HANDLE_LEN;

    // 2. Rope segments (Node 0 -> NUM_NODES - 1)
    for (let i = 0; i < NUM_NODES - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const diff = (dist - SEGMENT_LEN) / dist;
      const ox = dx * diff * 0.5;
      const oy = dy * diff * 0.5;
      
      a.x += ox; a.y += oy;
      b.x -= ox; b.y -= oy;
    }
    
    // Re-enforce handle lock after rope pulls it
    if (iter === ITERATIONS - 1) {
      let finalAngle = Math.atan2(nodes[0].y - mouse.y, nodes[0].x - mouse.x);
      while (finalAngle > Math.PI) finalAngle -= 2 * Math.PI;
      while (finalAngle < -Math.PI) finalAngle += 2 * Math.PI;
      
      if (finalAngle > -Math.PI / 4 && finalAngle <= Math.PI / 2) {
        finalAngle = -Math.PI / 4;
      } else if (finalAngle > Math.PI / 2 || finalAngle < -3 * Math.PI / 4) {
        finalAngle = -3 * Math.PI / 4;
      }
      nodes[0].x = mouse.x + Math.cos(finalAngle) * HANDLE_LEN;
      nodes[0].y = mouse.y + Math.sin(finalAngle) * HANDLE_LEN;
    }
  }

<<<<<<< HEAD
  // Visuals handled by global click listener now. 
  // We just decrement the flash timer if active.
=======
  // Crack detection — forward snap only (tip moving away from handle)
  const tip = nodes[NUM_NODES - 1];
  const tvx = tip.x - tip.px;
  const tvy = tip.y - tip.py;
  const tipSpeed = Math.sqrt(tvx * tvx + tvy * tvy);

  // Vector from handle to tip
  const htx = tip.x - nodes[0].x;
  const hty = tip.y - nodes[0].y;
  const htLen = Math.sqrt(htx * htx + hty * hty) || 1;
  // Dot product of tip velocity with handle→tip direction
  // Positive = tip moving away from handle (forward snap)
  const forwardDot = (tvx * htx + tvy * hty) / htLen;

  if (tipSpeed > CRACK_VEL && forwardDot > -2 && crackTimer <= 0) {
    crackTimer = CRACK_FRAMES;
    crackX = tip.x;
    crackY = tip.y;
    playWhipCrack();
    checkWindowHit(tip.x, tip.y);
    console.log('CRACK! speed:', tipSpeed.toFixed(1));
  }
>>>>>>> ea9f690b3353f12864539f4c1296e0b9a11b8ac7
  if (crackTimer > 0) crackTimer--;
}

// ---- Drawing -----------------------------------------------

function getNodeRadius(i) {
  // Taper: thick at handle end, very thin at tip
  const t = i / (NUM_NODES - 1);
  return 5.5 * (1 - t) + 0.8 * t;
}

function drawWhip() {
  if (nodes.length < 2) return;

  // Build smooth path through nodes
  const pts = nodes;

  // --- Rope body ---
  // Two passes: outline first, then fill on top (cartoon style)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < NUM_NODES - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];

      const ra = getNodeRadius(i);
      const rb = getNodeRadius(i + 1);
      const outlineWidth = 2.2;

      // Perpendicular direction
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny =  dx / len;

      // Outline pass: expand by outlineWidth
      const ora = pass === 0 ? ra + outlineWidth : ra;
      const orb = pass === 0 ? rb + outlineWidth : rb;

      const ax1 = a.x + nx * ora, ay1 = a.y + ny * ora;
      const ax2 = a.x - nx * ora, ay2 = a.y - ny * ora;
      const bx1 = b.x + nx * orb, by1 = b.y + ny * orb;
      const bx2 = b.x - nx * orb, by2 = b.y - ny * orb;

<<<<<<< HEAD
    ctx.fillStyle = `rgb(${r},${g},${bv})`;
    ctx.beginPath();
    ctx.moveTo(ax1, ay1);
    ctx.lineTo(bx1, by1);
    ctx.lineTo(bx2, by2);
    ctx.lineTo(ax2, ay2);
    ctx.closePath();
    ctx.fill();

    // Circular joint to completely hide polygonal seams between segments
    if (i > 0) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, Math.abs(ra), 0, Math.PI * 2);
      ctx.fill();
    }
    // Cap the very tip of the whip with a circle
    if (i === NUM_NODES - 2) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.abs(rb), 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight stripe on top edge (leather sheen)
    if (ra > 1.5) {
=======
>>>>>>> ea9f690b3353f12864539f4c1296e0b9a11b8ac7
      ctx.beginPath();
      ctx.moveTo(ax1, ay1);
      ctx.lineTo(bx1, by1);
      ctx.lineTo(bx2, by2);
      ctx.lineTo(ax2, ay2);
      ctx.closePath();

      if (pass === 0) {
        // Outline — solid dark brown/black
        ctx.fillStyle = 'rgba(20, 8, 0, 0.92)';
      } else {
        // Fill — bold warm brown, more saturated than before
        const t = i / (NUM_NODES - 1);
        const r = Math.round(160 - t * 60);
        const g = Math.round(80  - t * 30);
        const bv = Math.round(20  - t * 10);
        ctx.fillStyle = `rgb(${r},${g},${bv})`;
      }
      ctx.fill();

      // Highlight stripe on fill pass only
      if (pass === 1 && ra > 2) {
        const t = i / (NUM_NODES - 1);
        ctx.beginPath();
        ctx.moveTo(ax1, ay1);
        ctx.lineTo(bx1, by1);
        ctx.strokeStyle = `rgba(230, 160, 80, ${0.5 * (1 - t)})`;
        ctx.lineWidth = ra * 0.4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }

  // --- Handle ---
  drawHandle();

  // --- Crack flash ---
  if (crackTimer > 0) {
    const alpha = crackTimer / CRACK_FRAMES;
    const tip = nodes[NUM_NODES - 1];

    // Glow
    const grd = ctx.createRadialGradient(crackX, crackY, 0, crackX, crackY, 22);
    grd.addColorStop(0, `rgba(255, 240, 180, ${alpha})`);
    grd.addColorStop(1, `rgba(255, 180, 0, 0)`);
    ctx.beginPath();
    ctx.arc(crackX, crackY, 22, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Star lines
    const numRays = 6;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const rayLen = 12 + (CRACK_FRAMES - crackTimer) * 3.5;
      ctx.beginPath();
      ctx.moveTo(crackX, crackY);
      ctx.lineTo(crackX + Math.cos(angle) * rayLen, crackY + Math.sin(angle) * rayLen);
      ctx.strokeStyle = `rgba(255, 210, 50, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
}

function drawHandle() {
  const topX = nodes[0].x;
  const topY = nodes[0].y;
  const baseX = mouse.x;
  const baseY = mouse.y;

  const dx = topX - baseX;
  const dy = topY - baseY;
  const handleLen = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / handleLen;
  const uy = dy / handleLen;

<<<<<<< HEAD
  // Handle rod
  const grad = ctx.createLinearGradient(baseX, baseY, topX, topY);
  grad.addColorStop(0,   '#3b1a06');
  grad.addColorStop(0.3, '#7a3b10');
  grad.addColorStop(0.7, '#5c2a0a');
  grad.addColorStop(1,   '#2a0f02');
=======
  // Handle rod — outline first, then fill
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(x, y);
  ctx.strokeStyle = 'rgba(20, 8, 0, 0.92)';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.stroke();

  const grad = ctx.createLinearGradient(hx, hy, x, y);
  grad.addColorStop(0,   '#4a2008');
  grad.addColorStop(0.3, '#9a4e18');
  grad.addColorStop(0.7, '#7a3a0e');
  grad.addColorStop(1,   '#3a1504');
>>>>>>> ea9f690b3353f12864539f4c1296e0b9a11b8ac7

  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(topX, topY);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Wrap bands (decorative)
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    const bx = baseX + ux * handleLen * t;
    const by = baseY + uy * handleLen * t;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? '#1a0a02' : '#8b4a18';
    ctx.fill();
  }

  // End cap (base)
  ctx.beginPath();
  ctx.arc(baseX, baseY, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = '#1a0a02';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(baseX, baseY, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#c87a30';
  ctx.fill();
}

// ---- Loop --------------------------------------------------
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 2 sub-steps per frame keeps wave-propagation lightning fast 
  // even with 60 physics nodes making up the whip!
  updatePhysics();
  updatePhysics();
  
  drawWhip();
  requestAnimationFrame(loop);
}

loop();
