/**
 * office.js — Live 3D Agent Office
 *
 * Three.js r128 (vendored locally at /three.min.js — no CDN, no npm).
 * Renders a low-poly isometric office scene:
 *   • Warm cream walls, oak floor, orange accent furniture
 *   • Chibi Nendoroid-style agents at desks, LLM logo merch shirts
 *   • Real-time SSE updates animate agents by task status
 */

/* global THREE */

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const canvas   = document.querySelector('#office-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputEncoding    = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ecfcc);
scene.fog = new THREE.Fog(0x7ecfcc, 36, 65);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

let orthoZoom = 7.2;   // orthographic half-height — scroll changes this

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const aspect  = w / h;
  camera.left   = -orthoZoom * aspect;
  camera.right  =  orthoZoom * aspect;
  camera.top    =  orthoZoom;
  camera.bottom = -orthoZoom;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Lighting — warm office feel
// ---------------------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xfff5e8, 0.72));

// Key light — warm sun through windows (upper right)
const sun = new THREE.DirectionalLight(0xfffbe8, 1.3);
sun.position.set(12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 80;
sun.shadow.camera.left = sun.shadow.camera.bottom = -22;
sun.shadow.camera.right = sun.shadow.camera.top   =  22;
sun.shadow.bias = -0.0008;
scene.add(sun);

// Cool fill from opposite corner
const fill = new THREE.DirectionalLight(0xc8e0ff, 0.28);
fill.position.set(-10, 8, -6);
scene.add(fill);

// Warm overhead point light — makes desk surfaces pop
const deskLight = new THREE.PointLight(0xffe8c8, 0.6, 18, 1.5);
deskLight.position.set(1, 5, 0);
scene.add(deskLight);

// Cool accent from behind (back wall bounce)
const backLight = new THREE.PointLight(0x8cb8ff, 0.18, 14, 2);
backLight.position.set(-6, 3, 1);
scene.add(backLight);

// ---------------------------------------------------------------------------
// Material helpers
// ---------------------------------------------------------------------------
function mat(color) {
  return new THREE.MeshLambertMaterial({ color });
}
// Phong for surfaces that should catch specular highlights (desks, floor, monitors)
function matP(color, shininess = 40, specular = 0x222222) {
  return new THREE.MeshPhongMaterial({ color, shininess, specular });
}
function matFlat(color) {
  return new THREE.MeshBasicMaterial({ color });
}

// Palette
const M = {
  // Room — walls slightly warm, floor rich oak Phong
  wall:         mat(0xede0c4),
  wallR:        mat(0xe4d7b0),
  floor:        matP(0xb8965e, 60, 0x1a1008),
  floorDk:      matP(0xa07c42, 55, 0x140e04),
  floorLt:      matP(0xc8a870, 50, 0x1a1008),
  skirting:     mat(0xcab898),

  // Furniture — desks get Phong for that lacquered-wood look
  orange:       matP(0xf47920, 80, 0x553010),
  orangeHi:     matP(0xf9a55a, 60, 0x442808),
  orangeDk:     mat(0xc95f10),
  deskSurf:     matP(0xeee0c4, 90, 0x2a2010),
  deskBody:     mat(0xd8c8a4),
  monBez:       matP(0x1e1e2a, 120, 0x444466),
  monScrnOff:   matFlat(0x0e1520),
  monScrnRun:   matFlat(0x042a14),
  monScrnBlk:   matFlat(0x2a1800),
  monScrnFail:  matFlat(0x280808),
  monScrnDone:  matFlat(0x04240e),
  chairLeg:     matP(0x888888, 100, 0x333333),
  shelf:        mat(0xc8a870),
  shelfDk:      mat(0xa88050),
  glass:        new THREE.MeshPhongMaterial({ color: 0x90c8e0, transparent: true, opacity: 0.35, shininess: 120, specular: 0xffffff }),
  glassFrame:   mat(0x1e1e2a),
  cooler:       matP(0xd0e0f0, 80, 0x334466),
  coolerBottle: new THREE.MeshPhongMaterial({ color: 0x5898e8, transparent: true, opacity: 0.65, shininess: 140, specular: 0xaaccff }),
  plant:        mat(0x286224),
  plantDk:      mat(0x184418),
  pot:          matP(0xf47920, 50, 0x441808),
  soil:         mat(0x382010),
  whiteboard:   matP(0xf4f0e8, 30, 0xddddcc),
  wbFrame:      mat(0xe06010),
  book:         [matP(0x1848c8,50,0x0010aa), matP(0xa81818,50,0x880000), matP(0x1e6028,50,0x003010),
                 matP(0xc88008,50,0x885000), matP(0x481480,50,0x200060), matP(0x006878,50,0x003040)],
  coffeeTbl:    matP(0xb89060, 60, 0x1a0c00),
  rug:          mat(0xb84820),

  // Agent body
  skin:         matP(0xf2bc84, 20, 0x1a0800),
  skinDk:       mat(0xcc7c3a),
  pants:        mat(0x38486a),
  pantsDk:      mat(0x28384e),
  shoe:         matP(0x181e28, 120, 0x444466),
  shoeHi:       mat(0x303848),

  // Hair colours per owner
  hair: {
    Builder:  mat(0x180e04),
    Reviewer: mat(0x843a0c),
    Security: mat(0x303030),
    Ops:      mat(0x5a3008),
    default:  mat(0x281408),
  },
  hairHi: {
    Builder:  mat(0x342010),
    Reviewer: mat(0xa85820),
    Security: mat(0x505050),
    Ops:      mat(0x805020),
    default:  mat(0x443010),
  },

  // LLM shirt colours — slightly more vivid
  shirt: {
    Builder:  matP(0x1a2848, 40, 0x102060),
    Reviewer: matP(0xc07050, 40, 0x602010),
    Security: matP(0x1468d8, 40, 0x0040a0),
    Ops:      matP(0x0e9870, 40, 0x005040),
    default:  matP(0x0d58f0, 40, 0x0030c0),
  },

  // Status halo (emissive flat)
  status: {
    queued:  matFlat(0x8cb8ff),
    running: matFlat(0x42be65),
    blocked: matFlat(0xf1c21b),
    done:    matFlat(0x24a148),
    failed:  matFlat(0xfa4d56),
  },

  logoWhite: matP(0xffffff, 20, 0x333333),
};

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------
function box(w, h, d, material, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  if (ry) mesh.rotation.y = ry;
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt, rb, h, segs, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), material);
  mesh.position.set(x, y, z);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  return mesh;
}
function sphere(r, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}
function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

// ---------------------------------------------------------------------------
// Room geometry  — wider (W=14) and deeper (D=12)
// ---------------------------------------------------------------------------
function buildRoom() {
  const g = new THREE.Group();
  const W = 14, D = 12;

  // Floor — 3-tone plank rows for visible depth
  for (let r = 0; r < D; r++) {
    const m = r % 3 === 0 ? M.floorDk : r % 3 === 1 ? M.floor : M.floorLt;
    const tile = box(W, 0.14, 1, m, 0, 0, r - D / 2 + 0.5);
    tile.receiveShadow = true;
    tile.castShadow = false;
    g.add(tile);
  }

  // Back wall  (left side, negative X) — runs along Z axis
  g.add(box(0.14, 4.0, D, M.wall,  -W / 2, 2.0, 0));
  // Front-facing wall (negative Z) — runs along X axis
  g.add(box(W, 4.0, 0.14, M.wallR, 0, 2.0, -D / 2));

  // Skirting boards
  g.add(box(0.1, 0.22, D, M.skirting, -W / 2 + 0.05, 0.11, 0));
  g.add(box(W,   0.22, 0.1, M.skirting, 0, 0.11, -D / 2 + 0.05));

  // NO ceiling — isometric view looks down from above; ceiling would block everything

  return g;
}

// ---------------------------------------------------------------------------
// Wall decorations
// ---------------------------------------------------------------------------
function buildWallDecor() {
  const g = new THREE.Group();
  const W = 14, D = 12;

  // ── Whiteboard on back wall ──
  // Back wall is the slab at x = -W/2, running along Z. The board lies flat
  // against it, so its thin dimension goes along X (no rotation needed —
  // BoxGeometry depth=0.07 already faces X when the wall faces X).
  g.add(group(
    box(0.07, 1.8, 2.6, M.wbFrame,    -W / 2 + 0.08, 2.4, -2.0),
    box(0.08, 1.6, 2.4, M.whiteboard, -W / 2 + 0.09, 2.4, -2.0),
  ));

  // ── Clock on front wall ──
  g.add(cyl(0.38, 0.38, 0.07, 24, M.logoWhite, -2.0, 3.0, -D / 2 + 0.08));
  g.add(cyl(0.40, 0.40, 0.05, 24, M.wbFrame,   -2.0, 3.0, -D / 2 + 0.06));

  // ── Glass windows on front wall (two pairs) ──
  for (const x of [-5.5, 2.0]) {
    g.add(box(1.8, 2.4, 0.09, M.glassFrame, x, 2.2, -D / 2 + 0.08));
    g.add(box(0.72, 2.1, 0.11, M.glass, x - 0.48, 2.2, -D / 2 + 0.06));
    g.add(box(0.72, 2.1, 0.11, M.glass, x + 0.48, 2.2, -D / 2 + 0.06));
  }

  // ── Bookshelf on front wall ──
  const shelf = group(
    box(1.4, 2.4, 0.35, M.shelfDk, 5.0, 1.2, -D / 2 + 0.18),
    box(1.3, 0.07, 0.30, M.shelf,  5.0, 0.35, -D / 2 + 0.18),
    box(1.3, 0.07, 0.30, M.shelf,  5.0, 1.05, -D / 2 + 0.18),
    box(1.3, 0.07, 0.30, M.shelf,  5.0, 1.75, -D / 2 + 0.18),
    box(1.3, 0.07, 0.30, M.shelf,  5.0, 2.35, -D / 2 + 0.18),
  );
  for (let i = 0; i < 6; i++) {
    shelf.add(box(0.14, 0.60, 0.25, M.book[i],
      4.38 + (i % 4) * 0.21, 0.70 + Math.floor(i / 4) * 0.70, -D / 2 + 0.18));
  }
  g.add(shelf);

  // ── Water cooler near back wall corner ──
  g.add(group(
    cyl(0.20, 0.17, 0.80, 16, M.cooler,        -W / 2 + 0.5, 0.4, -3.0),
    cyl(0.15, 0.15, 0.50, 16, M.coolerBottle,  -W / 2 + 0.5, 1.0, -3.0),
    box(0.09, 0.09, 0.14, M.orange, -W / 2 + 0.34, 0.44, -2.92),
    box(0.09, 0.09, 0.14, M.orange, -W / 2 + 0.66, 0.44, -2.92),
  ));

  // ── Potted plant in corner (back wall) ──
  g.add(group(
    cyl(0.22, 0.26, 0.40, 10, M.pot,   -W / 2 + 0.5, 0.20, -5.0),
    sphere(0.36, M.plant,   -W / 2 + 0.5, 0.74, -5.0),
    sphere(0.26, M.plantDk, -W / 2 + 0.66, 0.60, -5.0),
    sphere(0.24, M.plant,   -W / 2 + 0.34, 0.62, -5.0),
  ));

  // ── Live Board TV — mounted on back wall ──
  // Thick dark bezel
  const tvBezel = box(0.12, 2.0, 3.4, matP(0x151520, 120, 0x444466), -W / 2 + 0.10, 2.6, 3.8);
  tvBezel.name = 'liveboard';
  g.add(tvBezel);
  // Thin inner screen inset — uses a live canvas texture updated each frame
  const tvScrnCanvas = document.createElement('canvas');
  tvScrnCanvas.width = 512; tvScrnCanvas.height = 288;
  const tvScrnTex = new THREE.CanvasTexture(tvScrnCanvas);
  // Build a 6-face material array so only the +X face (facing room) shows the texture
  const tvScrnMats = [
    new THREE.MeshBasicMaterial({ map: tvScrnTex }),     // +X face → room-facing
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
  ];
  const tvScrnGeo = new THREE.BoxGeometry(0.07, 1.78, 3.18);
  const tvScrn = new THREE.Mesh(tvScrnGeo, tvScrnMats);
  tvScrn.position.set(-W / 2 + 0.14, 2.6, 3.8);
  tvScrn.name = 'liveboard-screen';
  tvScrn.userData.canvas = tvScrnCanvas;
  tvScrn.userData.texture = tvScrnTex;
  g.add(tvScrn);
  // Wall mount bracket
  g.add(box(0.07, 0.70, 0.14, matP(0x222232, 80, 0x333366), -W / 2 + 0.12, 1.68, 3.8));
  g.add(box(0.07, 0.10, 0.50, matP(0x222232, 80, 0x333366), -W / 2 + 0.12, 1.35, 3.8));
  // Ambient LED strip glow behind TV (thin bright strip on wall)
  g.add(box(0.02, 2.1, 3.5, matFlat(0x4488ff), -W / 2 + 0.02, 2.6, 3.8));

  // ── Orange sofa — pushed to the far back corner, well clear of desks ──
  g.add(group(
    box(2.8, 0.35, 1.2, M.orange,    3.8, 0.37, 5.5),   // seat
    box(2.8, 0.80, 0.22, M.orangeDk, 3.8, 0.70, 6.1),   // back
    box(0.22, 0.60, 1.2, M.orange,  2.48, 0.60, 5.5),   // left arm
    box(0.22, 0.60, 1.2, M.orange,  5.12, 0.60, 5.5),   // right arm
    cyl(0.05, 0.05, 0.1, 8, M.orangeDk, 2.62, 0.05, 5.0),
    cyl(0.05, 0.05, 0.1, 8, M.orangeDk, 5.0,  0.05, 5.0),
    cyl(0.05, 0.05, 0.1, 8, M.orangeDk, 2.62, 0.05, 6.0),
    cyl(0.05, 0.05, 0.1, 8, M.orangeDk, 5.0,  0.05, 6.0),
  ));

  // ── Coffee table ──
  g.add(group(
    box(1.4, 0.07, 0.65, M.coffeeTbl, 3.8, 0.36, 4.5),
    cyl(0.04, 0.04, 0.34, 6, M.orangeDk, 3.2, 0.17, 4.25),
    cyl(0.04, 0.04, 0.34, 6, M.orangeDk, 4.4, 0.17, 4.25),
    cyl(0.04, 0.04, 0.34, 6, M.orangeDk, 3.2, 0.17, 4.75),
    cyl(0.04, 0.04, 0.34, 6, M.orangeDk, 4.4, 0.17, 4.75),
  ));

  // ── Rug ──
  const rugGeo = new THREE.PlaneGeometry(3.8, 2.8);
  const rugMesh = new THREE.Mesh(rugGeo, M.rug);
  rugMesh.rotation.x = -Math.PI / 2;
  rugMesh.position.set(3.8, 0.015, 5.2);
  rugMesh.receiveShadow = true;
  g.add(rugMesh);

  return g;
}

// ---------------------------------------------------------------------------
// LLM logo texture for the desk front panel (large, readable)
// ---------------------------------------------------------------------------
function makeDeskLogoTexture(owner) {
  const W = 256, H = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const cx = W / 2, cy = H / 2;

  const key = ['Builder','Reviewer','Security','Ops'].includes(owner) ? owner : 'default';

  // Background pill — owner brand colour
  const bg = { Builder:'#1b2a4a', Reviewer:'#cc785c', Security:'#1a73e8',
                Ops:'#10a37f', default:'#0f62fe' }[key];
  x.fillStyle = bg;
  x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, 12); x.fill();

  // White label area
  x.fillStyle = 'rgba(255,255,255,0.15)';
  x.beginPath(); x.roundRect(8, H / 2, W - 16, H / 2 - 8, 8); x.fill();

  // Logo icon (centred in top half)
  x.save(); x.translate(cx, cy * 0.55);
  if (key === 'Builder') {
    // GitHub Copilot visor
    x.strokeStyle = '#fff'; x.lineWidth = 5;
    x.beginPath(); x.arc(-18, 0, 13, Math.PI, 0); x.stroke();
    x.beginPath(); x.arc( 18, 0, 13, Math.PI, 0); x.stroke();
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(38, -18, 6, 0, Math.PI * 2); x.fill();
  } else if (key === 'Reviewer') {
    // Anthropic triangle
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(0,-22); x.lineTo(-26,18); x.lineTo(26,18); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(0,-8); x.lineTo(-12,14); x.lineTo(12,14); x.closePath(); x.fill();
  } else if (key === 'Security') {
    // Gemini 4-point star
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(0,-28); x.quadraticCurveTo(8,0,0,28); x.quadraticCurveTo(-8,0,0,-28); x.fill();
    x.beginPath();
    x.moveTo(-36,0); x.quadraticCurveTo(0,8,36,0); x.quadraticCurveTo(0,-8,-36,0); x.fill();
  } else if (key === 'Ops') {
    // OpenAI bloom
    x.strokeStyle = '#fff'; x.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      x.beginPath(); x.arc(Math.cos(a)*10, Math.sin(a)*10, 18, 0, Math.PI*2); x.stroke();
    }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0,0,6,0,Math.PI*2); x.fill();
  } else {
    // IBM Granite bars
    x.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) {
      const w = (i===0||i===2||i===5||i===7) ? 52 : 68;
      x.fillRect(-w/2, -16 + i * 5, w, 3.2);
    }
  }
  x.restore();

  // Owner name label bottom
  const label = { Builder:'Builder · Copilot', Reviewer:'Reviewer · Claude',
                  Security:'Security · Gemini', Ops:'Ops · ChatGPT',
                  default:'IBM Granite' }[key];
  x.fillStyle = 'rgba(255,255,255,0.90)';
  x.font = 'bold 13px sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(label, cx, H * 0.80);

  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------------
// Desk unit — accepts owner so it can show the LLM logo on the front panel
// ---------------------------------------------------------------------------
function buildDesk(status, owner) {
  const g = new THREE.Group();

  // Desk surface
  g.add(box(1.55, 0.08, 0.85, M.deskSurf,  0,    0.60,  0));
  // Side legs
  g.add(box(0.06, 0.58, 0.85, M.deskBody, -0.74, 0.29,  0));
  g.add(box(0.06, 0.58, 0.85, M.deskBody,  0.74, 0.29,  0));

  // Front panel — carries the LLM logo texture
  const panelTex = makeDeskLogoTexture(owner ?? 'default');
  const panelMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.43, 0.48, 0.06),
    [
      new THREE.MeshLambertMaterial({ color: 0xe0d0b0 }),   // left
      new THREE.MeshLambertMaterial({ color: 0xe0d0b0 }),   // right
      new THREE.MeshLambertMaterial({ color: 0xe0d0b0 }),   // top
      new THREE.MeshLambertMaterial({ color: 0xe0d0b0 }),   // bottom
      new THREE.MeshBasicMaterial({ map: panelTex }),        // front (facing +Z / agent)
      new THREE.MeshLambertMaterial({ color: 0xe0d0b0 }),   // back
    ],
  );
  panelMesh.position.set(0, 0.36, 0.42);
  panelMesh.castShadow = true;
  g.add(panelMesh);

  // Keyboard on desk surface
  g.add(box(0.52, 0.03, 0.22, mat(0xccc8b8), -0.10, 0.65, 0.08));
  // Trackpad
  g.add(box(0.22, 0.02, 0.14, mat(0xb8b4a8), -0.10, 0.645, 0.28));
  // Mug
  g.add(cyl(0.055, 0.048, 0.13, 10, mat(0xffffff), -0.52, 0.67, 0.04));
  g.add(cyl(0.050, 0.043, 0.04, 10, M.orange,      -0.52, 0.66, 0.04));

  // Monitor stand
  g.add(box(0.06, 0.26, 0.06, mat(0x808080), 0.18, 0.74, -0.14));
  g.add(box(0.20, 0.03, 0.13, mat(0x808080), 0.18, 0.62, -0.14));

  // Monitor
  const scrnMat = {
    queued: M.monScrnOff, running: M.monScrnRun, blocked: M.monScrnBlk,
    done: M.monScrnDone,  failed:  M.monScrnFail,
  }[status] ?? M.monScrnOff;
  g.add(box(0.86, 0.55, 0.04, M.monBez,  0.18, 1.04, -0.15));
  g.add(box(0.78, 0.47, 0.05, scrnMat,   0.18, 1.04, -0.13));

  return g;
}

// ---------------------------------------------------------------------------
// Chair
// ---------------------------------------------------------------------------
function buildChair() {
  return group(
    box(0.65, 0.07, 0.55, M.orangeHi,  0, 0.40,  0),
    box(0.65, 0.50, 0.06, M.orange,    0, 0.65,  0.25),
    cyl(0.02, 0.02, 0.36, 8, M.chairLeg, -0.26, 0.20, -0.20),
    cyl(0.02, 0.02, 0.36, 8, M.chairLeg,  0.26, 0.20, -0.20),
    cyl(0.02, 0.02, 0.36, 8, M.chairLeg, -0.26, 0.20,  0.20),
    cyl(0.02, 0.02, 0.36, 8, M.chairLeg,  0.26, 0.20,  0.20),
  );
}

// ---------------------------------------------------------------------------
// LLM logo patch
// ---------------------------------------------------------------------------
function makeLLMTexture(owner) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const cx = size / 2, cy = size / 2;

  // White pill background
  x.fillStyle = 'rgba(255,255,255,0.95)';
  x.beginPath();
  x.roundRect(6, 14, 52, 36, 8);
  x.fill();

  const key = ['Builder','Reviewer','Security','Ops'].includes(owner) ? owner : 'default';

  if (key === 'Builder') {
    // Copilot visor
    x.strokeStyle = '#0969da'; x.lineWidth = 3.5;
    x.beginPath(); x.arc(cx - 10, cy - 2, 8, Math.PI, 0); x.stroke();
    x.beginPath(); x.arc(cx + 10, cy - 2, 8, Math.PI, 0); x.stroke();
    x.fillStyle = '#0969da';
    x.beginPath(); x.arc(cx + 22, cy - 12, 4, 0, Math.PI * 2); x.fill();
  } else if (key === 'Reviewer') {
    // Anthropic triangle
    x.fillStyle = '#d97706'; x.strokeStyle = '#d97706'; x.lineWidth = 3;
    x.beginPath();
    x.moveTo(cx, cy - 14); x.lineTo(cx - 18, cy + 12); x.lineTo(cx + 18, cy + 12);
    x.closePath(); x.stroke();
    x.beginPath();
    x.moveTo(cx, cy - 4); x.lineTo(cx - 8, cy + 10); x.lineTo(cx + 8, cy + 10);
    x.closePath(); x.fill();
  } else if (key === 'Security') {
    // Gemini 4-point star
    x.fillStyle = '#4285f4';
    x.beginPath();
    x.moveTo(cx, cy - 16); x.quadraticCurveTo(cx + 5, cy, cx, cy + 16);
    x.quadraticCurveTo(cx - 5, cy, cx, cy - 16); x.fill();
    x.beginPath();
    x.moveTo(cx - 22, cy); x.quadraticCurveTo(cx, cy + 5, cx + 22, cy);
    x.quadraticCurveTo(cx, cy - 5, cx - 22, cy); x.fill();
  } else if (key === 'Ops') {
    // OpenAI bloom
    x.strokeStyle = '#10a37f'; x.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      x.beginPath();
      x.arc(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 12, 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = '#10a37f';
    x.beginPath(); x.arc(cx, cy, 4, 0, Math.PI * 2); x.fill();
  } else {
    // IBM Granite horizontal bars
    x.fillStyle = '#0f62fe';
    for (let i = 0; i < 8; i++) {
      const w = (i === 0 || i === 2 || i === 5 || i === 7) ? 36 : 48;
      x.fillRect(cx - w / 2, cy - 12 + i * 3.5, w, 2.2);
    }
  }

  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------------
// Agent — chibi character  (scaled down: 0.82× the previous version)
// ---------------------------------------------------------------------------
function buildAgent(owner, status) {
  const g  = new THREE.Group();
  const sm = M.shirt[owner] ?? M.shirt.default;
  const hm = M.hair[owner]  ?? M.hair.default;
  const hh = M.hairHi[owner] ?? M.hairHi.default;

  const S = 0.82;   // uniform scale factor — agents smaller relative to desks

  // ── Shoes ──
  g.add(cyl(0.09*S, 0.11*S, 0.11*S, 10, M.shoeHi, -0.12*S, 0.055*S,  0.08*S));
  g.add(cyl(0.09*S, 0.11*S, 0.11*S, 10, M.shoeHi,  0.12*S, 0.055*S,  0.08*S));
  g.add(cyl(0.08*S, 0.10*S, 0.12*S, 10, M.shoe,   -0.12*S, 0.058*S,  0.09*S));
  g.add(cyl(0.08*S, 0.10*S, 0.12*S, 10, M.shoe,    0.12*S, 0.058*S,  0.09*S));

  // ── Legs ──
  g.add(cyl(0.09*S, 0.09*S, 0.30*S, 10, M.pants,   -0.12*S, 0.27*S, 0));
  g.add(cyl(0.09*S, 0.09*S, 0.30*S, 10, M.pants,    0.12*S, 0.27*S, 0));
  g.add(cyl(0.09*S, 0.09*S, 0.28*S, 10, M.pantsDk, -0.13*S, 0.26*S, 0.01*S));
  g.add(cyl(0.09*S, 0.09*S, 0.28*S, 10, M.pantsDk,  0.13*S, 0.26*S, 0.01*S));

  // ── Torso ──
  g.add(cyl(0.25*S, 0.21*S, 0.38*S, 14, sm, 0, 0.60*S, 0));
  g.add(cyl(0.24*S, 0.22*S, 0.32*S, 14, new THREE.MeshLambertMaterial({
    color: new THREE.Color(sm.color).multiplyScalar(0.70),
  }), 0.02*S, 0.60*S, 0.01*S));

  // LLM logo patch
  const logoPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.25*S, 0.16*S),
    new THREE.MeshBasicMaterial({ map: makeLLMTexture(owner), transparent: true }),
  );
  logoPatch.position.set(0, 0.60*S, 0.24*S);
  g.add(logoPatch);

  // ── Arms ──
  g.add(cyl(0.076*S, 0.068*S, 0.32*S, 10, sm, -0.33*S, 0.58*S, 0));
  g.add(cyl(0.076*S, 0.068*S, 0.32*S, 10, sm,  0.33*S, 0.58*S, 0));

  // ── Hands ──
  g.add(sphere(0.07*S, M.skin, -0.33*S, 0.42*S, 0));
  g.add(sphere(0.07*S, M.skin,  0.33*S, 0.42*S, 0));

  // ── Neck ──
  g.add(cyl(0.09*S, 0.09*S, 0.11*S, 10, M.skin, 0, 0.85*S, 0));

  // ── Head ──
  g.add(sphere(0.30*S, M.skinDk, 0.01*S, 1.10*S, 0.01*S));  // shadow
  const head = sphere(0.30*S, M.skin, 0, 1.10*S, 0);
  g.add(head);

  // Hair cap (uses per-owner colour)
  const hairGeo = new THREE.SphereGeometry(0.31*S, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hairMesh = new THREE.Mesh(hairGeo, hm);
  hairMesh.position.set(0, 1.10*S, 0);
  hairMesh.rotation.x = -0.15;
  g.add(hairMesh);

  // Hair tufts
  g.add(sphere(0.11*S, hh, -0.16*S, 1.36*S,  0.09*S));
  g.add(sphere(0.12*S, hm,  0.0,    1.40*S,  0.07*S));
  g.add(sphere(0.10*S, hh,  0.16*S, 1.36*S,  0.09*S));

  // ── Ears ──
  g.add(sphere(0.08*S, M.skinDk, -0.31*S, 1.09*S, 0));
  g.add(sphere(0.08*S, M.skinDk,  0.31*S, 1.09*S, 0));
  g.add(sphere(0.063*S, M.skin,  -0.32*S, 1.10*S, 0));
  g.add(sphere(0.063*S, M.skin,   0.32*S, 1.10*S, 0));

  // ── Eyes ──
  g.add(sphere(0.075*S, M.logoWhite, -0.11*S, 1.10*S, 0.25*S));
  g.add(sphere(0.075*S, M.logoWhite,  0.11*S, 1.10*S, 0.25*S));
  g.add(sphere(0.058*S, mat(0x1a1a2a), -0.11*S, 1.10*S, 0.27*S));
  g.add(sphere(0.058*S, mat(0x1a1a2a),  0.11*S, 1.10*S, 0.27*S));
  // Highlights
  g.add(sphere(0.022*S, M.logoWhite, -0.09*S, 1.12*S, 0.295*S));
  g.add(sphere(0.022*S, M.logoWhite,  0.13*S, 1.12*S, 0.295*S));

  // ── Blush ──
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xff8888, transparent: true, opacity: 0.38 });
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.08*S, 8, 6), blushMat);
  bl.position.set(-0.22*S, 1.07*S, 0.22*S); g.add(bl);
  const br = new THREE.Mesh(new THREE.SphereGeometry(0.08*S, 8, 6), blushMat);
  br.position.set( 0.22*S, 1.07*S, 0.22*S); g.add(br);

  // ── IBM badge on belt area ──
  g.add(box(0.12*S, 0.07*S, 0.02*S, mat(0xffffff), 0, 0.42*S, 0.22*S));

  // ── Status halo ring ──
  const haloColor = [0x8cb8ff,0x42be65,0xf1c21b,0x24a148,0xfa4d56];
  const statusIdx = ['queued','running','blocked','done','failed'].indexOf(status);
  const haloMat = new THREE.MeshBasicMaterial({
    color: haloColor[statusIdx] ?? 0x8cb8ff,
    transparent: true, opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.33*S, 0.40*S, 32), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.012;
  halo.name = 'halo';
  g.add(halo);

  return g;
}

// ---------------------------------------------------------------------------
// Agent slot positions — 3 × 2 grid with better spread + 2 side slots
// Room is now W=14, D=12; desks face negative-Z direction
// ---------------------------------------------------------------------------
const AGENT_SLOTS = [
  // [x, z]  — 3 columns, 3 rows
  [ 3.5, -3.0],  // col A row 1
  [ 3.5,  0.0],  // col A row 2
  [ 3.5,  2.0],  // col A row 3 (closer to lounge)
  [ 0.5, -3.0],  // col B row 1
  [ 0.5,  0.0],  // col B row 2
  [ 0.5,  2.0],  // col B row 3
  [-2.5, -2.0],  // col C row 1
  [-2.5,  0.5],  // col C row 2
];

// ---------------------------------------------------------------------------
// Live data
// ---------------------------------------------------------------------------
let tasks = [], prevStatus = {};
// Flat list of scene objects per agent (for removal): desk, chair, agent, sprite?
const sceneObjects = [];

// Build a speech-bubble sprite showing the task status above the agent's head.
// Every status gets a bubble — colour-coded, icon + label, white rounded rect.
function makeBubbleSprite(status) {
  const BW = 220, BH = 72;
  const c = document.createElement('canvas');
  c.width = BW; c.height = BH + 14; // extra for tail
  const x = c.getContext('2d');

  const cfg = {
    queued:  { bg:'#d0e4ff', border:'#8cb8ff', icon:'💤', label:'Queued'   },
    running: { bg:'#d4f4de', border:'#42be65', icon:'⚡', label:'Running'  },
    blocked: { bg:'#fef4d0', border:'#f1c21b', icon:'⚠️',  label:'Blocked'  },
    done:    { bg:'#d4f4de', border:'#24a148', icon:'✅', label:'Done'     },
    failed:  { bg:'#ffd6d8', border:'#fa4d56', icon:'❌', label:'Failed'   },
  }[status] ?? { bg:'#eee', border:'#aaa', icon:'?', label: status };

  // Bubble body
  x.fillStyle = cfg.bg;
  x.strokeStyle = cfg.border;
  x.lineWidth = 3;
  x.beginPath();
  x.roundRect(3, 3, BW - 6, BH - 6, 14);
  x.fill(); x.stroke();

  // Tail (triangle pointing down)
  x.fillStyle = cfg.bg;
  x.beginPath();
  x.moveTo(BW / 2 - 10, BH - 4);
  x.lineTo(BW / 2 + 10, BH - 4);
  x.lineTo(BW / 2, BH + 12);
  x.closePath(); x.fill();
  x.strokeStyle = cfg.border; x.lineWidth = 2;
  x.beginPath();
  x.moveTo(BW / 2 - 10, BH - 4);
  x.lineTo(BW / 2, BH + 12);
  x.lineTo(BW / 2 + 10, BH - 4);
  x.stroke();

  // Icon
  x.font = '28px sans-serif';
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(cfg.icon, 14, BH / 2);

  // Label
  x.fillStyle = '#1a2438';
  x.font = 'bold 22px sans-serif';
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(cfg.label, 54, BH / 2);

  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true,
  }));
  // Scale so bubble is ~1.1 world-units wide
  spr.scale.set(1.1, 1.1 * (BH + 14) / BW, 1.0);
  return spr;
}

function applySnapshot(snap) {
  const incoming = snap.tasks ?? [];

  // Remove all previous agent/desk objects
  for (const obj of sceneObjects) scene.remove(obj);
  sceneObjects.length = 0;

  for (let i = 0; i < incoming.length; i++) {
    const task = incoming[i];
    const slot = AGENT_SLOTS[i % AGENT_SLOTS.length];
    const [sx, sz] = slot;
    const owner = task.owner ?? 'default';

    // Desk — pass owner so front panel shows LLM logo
    const deskG  = buildDesk(task.status, owner);
    deskG.position.set(sx, 0, sz);
    scene.add(deskG);
    sceneObjects.push(deskG);

    // Chair sits between the agent and the desk.
    // Agent faces NEGATIVE Z (toward the monitor). Chair rotated to match.
    const chairG = buildChair();
    chairG.position.set(sx, 0, sz + 0.55);
    chairG.rotation.y = Math.PI;
    scene.add(chairG);
    sceneObjects.push(chairG);

    const agentG = buildAgent(owner, task.status);
    agentG.position.set(sx, 0, sz + 0.38);
    agentG.rotation.y = Math.PI;
    agentG.userData = { taskIdx: i };
    scene.add(agentG);
    sceneObjects.push(agentG);

    // Speech bubble — every agent always has one, floating above their head
    const bubble = makeBubbleSprite(task.status);
    bubble.position.set(sx, 2.05, sz + 0.38);
    bubble.userData = { bubbleIdx: i };
    scene.add(bubble);
    sceneObjects.push(bubble);

    // Burst on status change
    if (prevStatus[task.id] !== undefined && prevStatus[task.id] !== task.status) {
      spawnBurst(sx, sz + 0.38);
    }
    prevStatus[task.id] = task.status;
  }
  tasks = incoming;
}

// ---------------------------------------------------------------------------
// Particle burst (status change)
// ---------------------------------------------------------------------------
const particles = [];
function spawnBurst(x, z) {
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const speed = 0.04 + Math.random() * 0.07;
    const mesh  = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: [0x42be65, 0x8cb8ff, 0xf47920, 0xf1c21b][i % 4] }),
    );
    mesh.position.set(x, 1.2, z);
    scene.add(mesh);
    particles.push({ mesh, vx: Math.cos(angle) * speed, vy: 0.08 + Math.random() * 0.04,
      vz: Math.sin(angle) * speed, life: 1.0 });
  }
}
function tickParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.vy -= 0.003;
    p.life -= 0.025;
    p.mesh.material.opacity  = p.life;
    p.mesh.material.transparent = true;
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
}

// ---------------------------------------------------------------------------
// Orbit camera
// ---------------------------------------------------------------------------
let isDragging = false, prevMouse = { x: 0, y: 0 };
let theta  = Math.PI * 0.22;   // initial yaw — shows depth well
let phi    = Math.PI * 0.30;   // initial pitch
let radius = 26;

function updateCamera() {
  camera.position.set(
    Math.sin(theta) * Math.cos(phi) * radius,
    Math.sin(phi) * radius,
    Math.cos(theta) * Math.cos(phi) * radius,
  );
  camera.lookAt(0.5, 0.6, 0);   // look slightly above floor centre
  camera.updateProjectionMatrix();
}
updateCamera();

// Track mousedown position so we only fire a click (not a drag-end) on the board
let mousedownPos = { x: 0, y: 0 };

canvas.addEventListener('mousedown', e => {
  isDragging   = true;
  prevMouse    = { x: e.clientX, y: e.clientY };
  mousedownPos = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', e => {
  if (isDragging) {
    theta -= (e.clientX - prevMouse.x) * 0.007;
    phi    = Math.max(0.08, Math.min(Math.PI / 2.1, phi - (e.clientY - prevMouse.y) * 0.005));
    prevMouse = { x: e.clientX, y: e.clientY };
    updateCamera();
  }
  onMouseMove(e);
});
window.addEventListener('mouseup', e => {
  isDragging = false;
  canvas.style.cursor = '';
});
// Single clean click listener — fires after mousedown+mouseup on the same element
canvas.addEventListener('click', e => {
  if (isBoardHit(e.clientX, e.clientY)) {
    const lb = document.getElementById('live-board');
    if (!lb) return;
    lb.classList.add('open');
    // If tasks haven't loaded yet, fetch them first then render
    if (tasks.length === 0) {
      fetch('/api/snapshot', { cache: 'no-store' })
        .then(r => r.json())
        .then(snap => { applySnapshot(snap); renderLiveBoard(); })
        .catch(() => renderLiveBoard());
    } else {
      renderLiveBoard();
    }
  }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  // Orthographic zoom: shrink/grow the frustum half-height directly
  orthoZoom = Math.max(3.5, Math.min(14, orthoZoom + e.deltaY * 0.012));
  resize();
}, { passive: false });

// ---------------------------------------------------------------------------
// Tooltip (raycaster)
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const mouse2d   = new THREE.Vector2();
const tooltip   = document.querySelector('#agent-tooltip');
const ttTitle   = document.querySelector('#tt-title');
const ttOwner   = document.querySelector('#tt-owner');
const ttStatus  = document.querySelector('#tt-status');
const ttReason  = document.querySelector('#tt-reason');

const LLM_NAME = {
  Builder: 'GitHub Copilot', Reviewer: 'Claude (Anthropic)',
  Security: 'Gemini (Google)', Ops: 'ChatGPT (OpenAI)', default: 'IBM Granite',
};
const STATUS_STYLE = {
  queued:  'background:rgba(140,184,255,0.15);color:#8cb8ff',
  running: 'background:rgba(66,190,101,0.15);color:#42be65',
  blocked: 'background:rgba(241,194,27,0.15);color:#f1c21b',
  done:    'background:rgba(36,161,72,0.15);color:#24a148',
  failed:  'background:rgba(250,77,86,0.15);color:#fa4d56',
};

let mouseX = 0, mouseY = 0;
function onMouseMove(e) { mouseX = e.clientX; mouseY = e.clientY; }

// Live Board — four world-space corners of the TV face projected to screen each frame.
// Using screen-space hit testing because the back wall is nearly parallel to the
// orthographic ray, making Ray.intersectsBox unreliable at this camera angle.
const BOARD_WORLD_PTS = [
  new THREE.Vector3(-6.87, 1.65, 2.3),   // bottom-left
  new THREE.Vector3(-6.87, 1.65, 5.3),   // bottom-right
  new THREE.Vector3(-6.87, 3.45, 5.3),   // top-right
  new THREE.Vector3(-6.87, 3.45, 2.3),   // top-left
];
// Screen-space bounding rect updated every frame by animate()
let boardScreenRect = { x: 0, y: 0, w: 0, h: 0, valid: false };

function updateBoardScreenRect() {
  const w = window.innerWidth, h = window.innerHeight;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of BOARD_WORLD_PTS) {
    const v = pt.clone().project(camera);
    // Standard NDC → pixel: x: (-1..1) → (0..w), y: (1..-1) → (0..h)
    const sx = (v.x  + 1) * 0.5 * w;
    const sy = (1 - v.y)  * 0.5 * h;
    if (sx < minX) minX = sx;
    if (sy < minY) minY = sy;
    if (sx > maxX) maxX = sx;
    if (sy > maxY) maxY = sy;
  }
  // Generous padding — TV is small on screen, make it easy to click
  const PAD = 32;
  boardScreenRect = { x: minX - PAD, y: minY - PAD,
                      w: (maxX - minX) + PAD * 2,
                      h: (maxY - minY) + PAD * 2, valid: true };
}

function isBoardHit(px, py) {
  const r = boardScreenRect;
  return r.valid && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function checkHover() {
  mouse2d.set(
    (mouseX / window.innerWidth) * 2 - 1,
    -(mouseY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(mouse2d, camera);

  // --- Agent hover ---
  let hit = null, bestD = 0.9;
  for (let i = 0; i < tasks.length; i++) {
    const slot = AGENT_SLOTS[i % AGENT_SLOTS.length];
    const agentPos = new THREE.Vector3(slot[0], 0.7, slot[1] + 0.38);
    const d = raycaster.ray.distanceToPoint(agentPos);
    if (d < bestD) { bestD = d; hit = tasks[i]; }
  }

  if (hit) {
    ttTitle.textContent  = hit.title;
    ttOwner.textContent  = `${hit.owner} · ${LLM_NAME[hit.owner] ?? LLM_NAME.default}`;
    ttStatus.textContent = hit.status;
    ttStatus.setAttribute('style', STATUS_STYLE[hit.status] ?? '');
    if (hit.reason) { ttReason.textContent = hit.reason; ttReason.hidden = false; }
    else { ttReason.hidden = true; }
    tooltip.style.left = `${mouseX}px`;
    tooltip.style.top  = `${mouseY}px`;
    tooltip.classList.add('visible');
    canvas.style.cursor = isDragging ? 'grabbing' : 'pointer';
    return;
  }
  tooltip.classList.remove('visible');

  // --- Live Board hover (screen-space) ---
  if (!isDragging && isBoardHit(mouseX, mouseY)) {
    canvas.style.cursor = 'pointer';
  } else if (!isDragging) {
    canvas.style.cursor = '';
  }
}


// ---------------------------------------------------------------------------
// Animation — halo pulse + running bob + blocked shake + spin for ⚙
// ---------------------------------------------------------------------------
let animT = 0;

function animate(ts) {
  // rAF is driven externally by animateWithLerp after boot; this self-schedules
  // only during the pre-boot period (before animateWithLerp takes over).
  animT = ts / 1000;

  // Per-task status animations
  for (let i = 0; i < tasks.length; i++) {
    const task   = tasks[i];
    const slot   = AGENT_SLOTS[i % AGENT_SLOTS.length];
    // sceneObjects order: desk, chair, agent[, sprite] repeated
    // Each task has 3 base objects (desk, chair, agent) + optional sprite
    // We stored them flat; find the agent group by userData.taskIdx
    for (const obj of sceneObjects) {
      if (!(obj instanceof THREE.Group)) continue;
      if (obj.userData.taskIdx !== i) continue;

      const agent = obj;
      const base  = agent.position;

      if (task.status === 'running') {
        // Gentle vertical bob
        agent.position.y = Math.sin(animT * 3.5 + i) * 0.04;
        agent.position.x = slot[0];
        agent.rotation.x = 0;
      } else if (task.status === 'blocked') {
        // Horizontal head-shake (wiggle along X — perpendicular to facing direction)
        agent.position.x = slot[0] + Math.sin(animT * 8 + i) * 0.04;
        agent.position.y = 0;
        agent.rotation.x = 0;
      } else if (task.status === 'done') {
        // Tiny celebratory bounce
        agent.position.y = Math.abs(Math.sin(animT * 2.0 + i)) * 0.06;
        agent.position.x = slot[0];
        agent.rotation.x = 0;
      } else if (task.status === 'failed') {
        // Slow forward droop
        agent.rotation.x = Math.sin(animT * 1.5 + i) * 0.04;
        agent.position.y = 0;
        agent.position.x = slot[0];
      } else {
        // queued — idle
        agent.position.y  = 0;
        agent.position.x  = slot[0];
        agent.rotation.x  = 0;
      }

      // Halo pulse (all statuses)
      const halo = agent.getObjectByName('halo');
      if (halo) {
        halo.material.opacity = 0.5 + Math.sin(animT * 2.5 + i) * 0.25;
      }
    }
  }

  // Live Board TV — paint live task data onto the screen canvas texture
  const lbScrn = scene.getObjectByName('liveboard-screen');
  if (lbScrn && lbScrn.userData.canvas) {
    const sc = lbScrn.userData.canvas;
    const sx = sc.getContext('2d');
    const W = sc.width, H = sc.height;
    sx.clearRect(0, 0, W, H);

    // Background gradient — dark blue-grey
    const bg = sx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1628'); bg.addColorStop(1, '#06101e');
    sx.fillStyle = bg; sx.fillRect(0, 0, W, H);

    // Pulsing border glow
    const pulse = 0.5 + Math.sin(animT * 2.2) * 0.5;
    sx.strokeStyle = `rgba(68,136,255,${0.25 + pulse * 0.45})`;
    sx.lineWidth = 6;
    sx.strokeRect(4, 4, W - 8, H - 8);

    // Header bar
    sx.fillStyle = 'rgba(244,121,32,0.90)';
    sx.fillRect(0, 0, W, 44);
    sx.fillStyle = '#fff';
    sx.font = 'bold 22px sans-serif';
    sx.textAlign = 'center'; sx.textBaseline = 'middle';
    sx.fillText('📊  LIVE BOARD', W / 2, 22);

    // Status pills row
    const STATUS_C = { queued:'#8cb8ff', running:'#42be65', blocked:'#f1c21b', done:'#24a148', failed:'#fa4d56' };
    const STATUS_I = { queued:'💤', running:'⚡', blocked:'⚠', done:'✓', failed:'✕' };
    const counts = { queued:0, running:0, blocked:0, done:0, failed:0 };
    for (const t of tasks) { if (t.status in counts) counts[t.status]++; }
    const statuses = Object.keys(counts);
    const pillW = W / statuses.length;
    statuses.forEach((s, i) => {
      const c = counts[s];
      const px = i * pillW, py = 52;
      sx.fillStyle = c > 0 ? STATUS_C[s] + '33' : 'rgba(255,255,255,0.04)';
      sx.fillRect(px + 4, py, pillW - 8, 48);
      sx.fillStyle = c > 0 ? STATUS_C[s] : 'rgba(255,255,255,0.2)';
      sx.font = 'bold 20px sans-serif';
      sx.textAlign = 'center'; sx.textBaseline = 'middle';
      sx.fillText(`${STATUS_I[s]} ${c}`, px + pillW / 2, py + 16);
      sx.font = '11px sans-serif';
      sx.fillStyle = 'rgba(255,255,255,0.4)';
      sx.fillText(s, px + pillW / 2, py + 36);
    });

    // Task name list (last 4)
    const visible = tasks.slice(-4);
    visible.forEach((t, i) => {
      const y = 118 + i * 40;
      sx.fillStyle = STATUS_C[t.status] ?? '#8cb8ff';
      sx.fillRect(12, y + 8, 6, 22);
      sx.fillStyle = 'rgba(255,255,255,0.85)';
      sx.font = 'bold 13px sans-serif';
      sx.textAlign = 'left'; sx.textBaseline = 'middle';
      const title = t.title.length > 32 ? t.title.slice(0,30) + '…' : t.title;
      sx.fillText(title, 26, y + 19);
      sx.fillStyle = 'rgba(255,255,255,0.35)';
      sx.font = '11px sans-serif';
      sx.fillText(t.owner, 26, y + 33);
    });

    // "Click to expand" footer with pulsing arrow
    sx.fillStyle = `rgba(255,255,255,${0.3 + pulse * 0.35})`;
    sx.font = 'bold 13px sans-serif';
    sx.textAlign = 'center'; sx.textBaseline = 'middle';
    sx.fillText('▶  Click to expand dashboard', W / 2, H - 18);

    lbScrn.userData.texture.needsUpdate = true;
  }

  updateBoardScreenRect();
  tickParticles();
  checkHover();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Build static scene
// ---------------------------------------------------------------------------
scene.add(buildRoom());
scene.add(buildWallDecor());

// ---------------------------------------------------------------------------
// Live Board overlay
// ---------------------------------------------------------------------------
const liveBoard = document.querySelector('#live-board');
const liveBoardClose = document.querySelector('#live-board-close');
const lbTasksEl = document.querySelector('#lb-tasks');
const lbMetricsEl = document.querySelector('#lb-metrics');
const lbPipeEl = document.querySelector('#lb-pipe');

function openLiveBoard() {
  document.getElementById('live-board')?.classList.add('open');
  renderLiveBoard();
}
function closeLiveBoard() {
  document.getElementById('live-board')?.classList.remove('open');
}
document.getElementById('live-board-close')?.addEventListener('click', closeLiveBoard);
document.getElementById('live-board')?.addEventListener('click', e => {
  if (e.target.id === 'live-board') closeLiveBoard();
});
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeLiveBoard(); });

const STATUS_ICON  = { queued:'💤', running:'⚡', blocked:'⚠️', done:'✅', failed:'❌' };
const STATUS_COLOR = { queued:'#8cb8ff', running:'#42be65', blocked:'#f1c21b', done:'#24a148', failed:'#fa4d56' };

function renderLiveBoard() {
  const lbTasks   = document.getElementById('lb-tasks');
  const lbMetrics = document.getElementById('lb-metrics');
  const lbPipe    = document.getElementById('lb-pipe');
  if (!lbTasks) return;

  // ── Pipeline summary bar ──
  if (lbPipe) {
    const counts = { queued:0, running:0, blocked:0, done:0, failed:0 };
    for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
    const total = tasks.length || 1;
    lbPipe.innerHTML = '';
    for (const [key, count] of Object.entries(counts)) {
      if (count === 0) continue;
      const pct = Math.round((count / total) * 100);
      const seg = document.createElement('div');
      seg.className = 'lb-pipe-seg';
      seg.style.cssText = `flex:${pct};background:${STATUS_COLOR[key]};`;
      seg.title = `${key}: ${count}`;
      seg.innerHTML = `<span>${STATUS_ICON[key]} ${count}</span>`;
      lbPipe.appendChild(seg);
    }
  }

  // ── Metrics row ──
  if (lbMetrics) {
    fetch('/api/metrics', { cache: 'no-store' })
      .then(r => r.json())
      .then(m => {
        lbMetrics.innerHTML = `
          <div class="lb-metric"><span class="lb-mval">${tasks.length}</span><span class="lb-mlabel">Tasks</span></div>
          <div class="lb-metric"><span class="lb-mval">${m.sse_connections ?? '—'}</span><span class="lb-mlabel">SSE</span></div>
          <div class="lb-metric"><span class="lb-mval">${m.store_revision ?? '—'}</span><span class="lb-mlabel">Revision</span></div>
          <div class="lb-metric"><span class="lb-mval">${formatUptime(m.uptime_s ?? 0)}</span><span class="lb-mlabel">Uptime</span></div>
        `;
      }).catch(() => {});
  }

  // ── Task cards ──
  const LLM = { Builder:'Copilot', Reviewer:'Claude', Security:'Gemini', Ops:'ChatGPT', default:'Granite' };
  lbTasks.innerHTML = '';
  for (const task of tasks) {
    const card = document.createElement('div');
    card.className = 'lb-card';
    card.style.setProperty('--accent', STATUS_COLOR[task.status] ?? '#888');
    card.innerHTML = `
      <div class="lb-card-header">
        <span class="lb-status-icon">${STATUS_ICON[task.status] ?? '?'}</span>
        <span class="lb-status-pill" style="background:${STATUS_COLOR[task.status]}22;color:${STATUS_COLOR[task.status]};border:1px solid ${STATUS_COLOR[task.status]}44">${task.status}</span>
      </div>
      <p class="lb-card-title">${escHtml(task.title)}</p>
      <p class="lb-card-owner">${escHtml(task.owner)} · ${escHtml(LLM[task.owner] ?? LLM.default)}</p>
      ${task.reason ? `<p class="lb-card-reason">${escHtml(task.reason)}</p>` : ''}
    `;
    lbTasks.appendChild(card);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatUptime(seconds) {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ---------------------------------------------------------------------------
// SSE
// ---------------------------------------------------------------------------
const streamEl = document.querySelector('#office-stream');
function connectStream() {
  let retries = 0;
  function connect() {
    const es = new EventSource('/api/stream');
    es.addEventListener('snapshot', e => {
      try {
        applySnapshot(JSON.parse(e.data));
        // Keep live board fresh if it's open
        if (document.getElementById('live-board')?.classList.contains('open')) renderLiveBoard();
      } catch { /* ignore */ }
    });
    es.onopen  = () => { retries = 0; streamEl.textContent = '⬤ Live'; streamEl.className = 'live'; };
    es.onerror = () => {
      es.close();
      streamEl.textContent = '⬤ Disconnected'; streamEl.className = 'error';
      if (retries >= 5) return;
      setTimeout(connect, Math.min(1000 * (2 ** retries++), 16000));
    };
  }
  connect();
}

// ---------------------------------------------------------------------------
// Simulation toggle
// ---------------------------------------------------------------------------
const simBtn = document.getElementById('sim-toggle');
let simActive = false;

async function toggleSim() {
  try {
    const res = await fetch('/api/sim', { method: 'POST' });
    const data = await res.json();
    simActive = data.enabled;
    if (simBtn) {
      simBtn.textContent = simActive ? '⏹ Stop' : '▶ Sim';
      simBtn.setAttribute('aria-pressed', String(simActive));
      simBtn.classList.toggle('active', simActive);
    }
  } catch { /* non-critical */ }
}

// Fetch initial sim state
fetch('/api/sim').then(r => r.json()).then(d => {
  simActive = d.enabled;
  if (simBtn) {
    simBtn.textContent = simActive ? '⏹ Stop' : '▶ Sim';
    simBtn.classList.toggle('active', simActive);
  }
}).catch(() => {});

if (simBtn) simBtn.addEventListener('click', toggleSim);

// ---------------------------------------------------------------------------
// TV double-click zoom
// ---------------------------------------------------------------------------
let tvZoomed = false;
// Target camera state when zoomed in on TV
const TV_ZOOM = { theta: Math.PI * 1.0, phi: Math.PI * 0.18, orthoZoom: 3.2 };
// Saved state for zoom-out restore
let savedCam = { theta: Math.PI * 0.22, phi: Math.PI * 0.30, orthoZoom: 7.2 };

// Smooth camera interpolation
let camTarget = { theta: Math.PI * 0.22, phi: Math.PI * 0.30, orthoZoom: 7.2 };
let camCurrent = { theta: Math.PI * 0.22, phi: Math.PI * 0.30, orthoZoom: 7.2 };

function lerpCam(dt) {
  const k = 1 - Math.pow(0.008, dt);
  camCurrent.theta    += (camTarget.theta    - camCurrent.theta)    * k;
  camCurrent.phi      += (camTarget.phi      - camCurrent.phi)      * k;
  camCurrent.orthoZoom += (camTarget.orthoZoom - camCurrent.orthoZoom) * k;
  theta    = camCurrent.theta;
  phi      = camCurrent.phi;
  orthoZoom = camCurrent.orthoZoom;
  updateCamera();
  resize();
}

let lastFrameTs = 0;
// Patch animate to drive lerp — wrap the existing rAF
const _origAnimate = animate;
function animateWithLerp(ts) {
  requestAnimationFrame(animateWithLerp);
  const dt = Math.min((ts - lastFrameTs) / 1000, 0.1);
  lastFrameTs = ts;
  if (tvZoomed || Math.abs(camCurrent.theta - camTarget.theta) > 0.001
               || Math.abs(camCurrent.orthoZoom - camTarget.orthoZoom) > 0.05) {
    lerpCam(dt);
  }
  _origAnimate(ts);
}

// Double-click TV to zoom in/out
let lastClickTs = 0;
canvas.addEventListener('click', e => {
  const now = Date.now();
  const isDbl = (now - lastClickTs) < 350;
  lastClickTs = now;
  if (!isDbl) return;
  if (isBoardHit(e.clientX, e.clientY)) {
    if (tvZoomed) {
      // Zoom out — restore saved state
      tvZoomed = false;
      camTarget.theta    = savedCam.theta;
      camTarget.phi      = savedCam.phi;
      camTarget.orthoZoom = savedCam.orthoZoom;
    } else {
      // Zoom in — save current, fly to TV
      tvZoomed = true;
      savedCam = { theta, phi, orthoZoom };
      camCurrent.theta = theta; camCurrent.phi = phi; camCurrent.orthoZoom = orthoZoom;
      camTarget.theta    = TV_ZOOM.theta;
      camTarget.phi      = TV_ZOOM.phi;
      camTarget.orthoZoom = TV_ZOOM.orthoZoom;
    }
  }
});
// Escape also zooms out
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && tvZoomed) {
    tvZoomed = false;
    camTarget.theta    = savedCam.theta;
    camTarget.phi      = savedCam.phi;
    camTarget.orthoZoom = savedCam.orthoZoom;
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  try {
    const res = await fetch('/api/snapshot', { cache: 'no-store' });
    applySnapshot(await res.json());
  } catch { /* SSE will deliver */ }
  connectStream();
  requestAnimationFrame(animateWithLerp);
}

boot();
