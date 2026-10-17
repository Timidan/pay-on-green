// Builds the "How it works" figure: an escrow test bench.
// A $5 coin waits in a clamp (the hold). A glass-walled chamber is the CreateOS sandbox;
// a duct brings the network in and a gate slides shut before the agent writes (the lock).
// A gantry carriage writes the patch onto the board, five test lamps flip red to green,
// and the coin rides the rail to the Paid tray, or drops back into the Refund cup.
// Output: app/components/anatomy-figure.ts (static SVG + the screen vectors the client needs).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../app/components/anatomy-figure.ts");

const WIDTH = 760;
const HEIGHT = 470;

// World units ≈ px of a desk-sized bench. x along the bench, y into depth, z up.
const PLATE = { x: -170, y: -72, w: 340, d: 144, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

const CLAMP = { x: -150, y: -2, w: 34, d: 30, r: 3 }; // escrow pedestal
const CLAMP_H = 30;
const COIN_R = 8;
const COIN_AT = [-133, 13, CLAMP_H + 2];

const CUP = [-133, -46]; // refund cup
const CUP_R = 13;
const CUP_H = 9;

const CH = { x: -82, y: -42, w: 128, d: 84, r: 2 }; // sandbox chamber
const CH_TOP = 74;
const POST_R = 2.4;

const BOARD = { x: -66, y: -34, w: 96, d: 6, r: 1 }; // patch board, standing at the back
const BOARD_H = 34;

const RACK = { x: -64, y: 4, w: 92, d: 14, r: 1.5 }; // test rack with five lamps
const RACK_H = 6;
const LAMPS = [-54, -36, -18, 0, 18];

const BOX = { x: -40, y: -70, w: 34, d: 16, r: 2 }; // network junction (GitHub · npm)
const BOX_H = 22;
const DUCT = { x: -27, y: -64, w: 8, d: 8, r: 1 };
const DUCT_TOP = 92;
const GATE_Z = 50;

const GANTRY_Y = -8;
const GANTRY_Z = 100;
const GANTRY = [-96, 62];
const CARRIAGE_FROM = -56;
const CARRIAGE_TO = 22;

const RAIL = { x: -138, y: 10, w: 266, d: 6, r: 1 }; // coin rail, high over the chamber
const RAIL_Z = 112;
const TRAY = { x: 104, y: -22, w: 46, d: 46, r: 4 }; // paid tray
const TRAY_H = 10;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, 0, RAIL_Z + 14], [GANTRY[0], GANTRY_Y, GANTRY_Z + 10], [-23, -60, DUCT_TOP + 6]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 38 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge
  const strip = { x: -150, y: PLATE.y + PLATE.d - 14, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

function network() {
  // junction box at the back: GitHub and npm come in here
  const out = [];
  out.push(S(k.slabOf(BOX, 0, BOX_H, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BOX, 3), BOX_H, P), { tone: "faint" }));
  out.push(D(k.corners(BOX, 3).map(([x, y]) => at([x, y, BOX_H])), { size: 0.45 }));
  for (const x of [BOX.x + 6, BOX.x + BOX.w - 6]) {
    out.push(S(k.cylinder(x, BOX.y + BOX.d + 1.5, 2.6, 6, 3, P, 18), { tone: "mid" })); // port caps
  }
  out.push(`<g data-part="netlamp">${S(k.cylinder(BOX.x + BOX.w - 6, BOX.y + 5, 2.2, BOX_H, 1.6, P, 18), { tone: "hi", className: "net-lamp" })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([BOX.x + 4, BOX.y + 9], BOX_H, P, "x"), "NET", { size: 3, tone: "lo" }));
  // vertical duct, the gate housing, then the duct turns into the chamber
  out.push(S(k.slabOf(DUCT, BOX_H, GATE_Z - 6 - BOX_H, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: DUCT.x - 6, y: DUCT.y - 3, w: DUCT.w + 12, d: DUCT.d + 6, r: 1.5 }, GATE_Z - 6, 12, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([DUCT.x - 4, DUCT.y - 1, GATE_Z + 6]), at([DUCT.x + DUCT.w + 4, DUCT.y - 1, GATE_Z + 6])], { size: 0.45 }));
  out.push(S(k.slabOf(DUCT, GATE_Z + 6, DUCT_TOP - GATE_Z - 6, P, 3, 0.4), { tone: "mid" }));
  const run = { x: DUCT.x, y: DUCT.y, w: DUCT.w, d: CH.y + 30 - DUCT.y, r: 1 };
  out.push(S(k.slabOf(run, DUCT_TOP, 8, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.sideSeam({ x: run.x, y: run.y, w: run.w, d: run.d, r: 1 }, DUCT_TOP + 4, P), { tone: "faint" }));
  // the drop into the chamber, ending on a flange inside the top frame
  out.push(S(k.slabOf({ x: DUCT.x, y: CH.y + 22, w: DUCT.w, d: DUCT.d, r: 1 }, CH_TOP + 2, DUCT_TOP - CH_TOP - 2, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: DUCT.x - 3, y: CH.y + 19, w: DUCT.w + 6, d: DUCT.d + 6, r: 1.5 }, CH_TOP, 2, P, 3), { tone: "mid" }));
  return out.join("");
}

function gate() {
  // the gate blade, drawn at its open rest position; it slides +x to close the duct
  return S(k.slabOf({ x: DUCT.x - 22, y: DUCT.y + 1, w: 14, d: DUCT.d - 2, r: 0.8 }, GATE_Z - 2, 4, P, 3), { tone: "hi", lit: true });
}

function cup() {
  const [x, y] = CUP;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - CUP_R, y: y - CUP_R, w: CUP_R * 2, d: CUP_R * 2, r: CUP_R }, 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.cylinder(x, y, CUP_R, 0, CUP_H, P, 40, 0.6), { tone: "mid" }));
  out.push(L(k.ring(x, y, CUP_R - 1.6, CUP_H, P, 40), { tone: "lo" }));
  out.push(`<path class="iso-fill" d="${k.ring(x, y, CUP_R - 1.6, CUP_H, P, 40)}" style="opacity:.5"/>`);
  out.push(L(k.sideArc(x, y, CUP_R, 4, P, 30), { tone: "faint" }));
  return out.join("");
}

function chamberBack() {
  const out = [];
  out.push(S(k.slabOf(CH, 0, 3, P, 4, 0.5), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(CH, 4), 3, P), { tone: "faint" }));
  const posts = k.corners(CH, 3);
  for (const [x, y] of byDepth(posts).slice(0, 2)) out.push(S(k.cylinder(x, y, POST_R, 3, CH_TOP - 3, P, 16), { tone: "mid" }));
  // back and left top rails
  out.push(S(k.slabOf({ x: CH.x, y: CH.y, w: CH.w, d: 4, r: 1 }, CH_TOP, 3, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: CH.x, y: CH.y, w: 4, d: CH.d, r: 1 }, CH_TOP, 3, P, 3), { tone: "mid" }));
  // the patch board with its printed rule lines (text stand-ins)
  out.push(S(k.slabOf(BOARD, 3, BOARD_H, P, 3, 0.5), { tone: "hi", crease: "lo" }));
  const face = BOARD.y + BOARD.d;
  const rules = [];
  for (let i = 0; i < 6; i++) {
    const z = BOARD_H - 3 - i * 4.4;
    const len = [70, 54, 78, 40, 62, 30][i];
    rules.push(k.segment([BOARD.x + 6, face, z], [BOARD.x + 6 + len, face, z], P));
  }
  out.push(L(rules.join(""), { tone: "faint", free: "both" }));
  out.push(`<path data-part="patchline" class="iso-line" data-tone="lit" data-free="both" d="${k.segment([BOARD.x + 6, face, BOARD_H - 3 - 2.2], [BOARD.x + 82, face, BOARD_H - 3 - 2.2], P)}" style="stroke-width:1.3;stroke-dasharray:80;stroke-dashoffset:80"/>`);
  return out.join("");
}

function rack() {
  const out = [];
  out.push(S(k.slabOf(RACK, 3, RACK_H, P, 3, 0.5), { tone: "mid" }));
  out.push(D(k.corners(RACK, 2.5).map(([x, y]) => at([x, y, 3 + RACK_H])), { size: 0.4 }));
  LAMPS.forEach((x, i) => {
    const y = RACK.y + RACK.d / 2;
    out.push(S(k.cylinder(x, y, 4.6, 3 + RACK_H, 1.4, P, 24), { tone: "mid" }));
    out.push(`<g data-lamp="${i}" data-state="off">${S(k.cylinder(x, y, 3.4, 3 + RACK_H + 1.4, 3, P, 24, 0.6), { tone: "hi" })}</g>`);
  });
  return out.join("");
}

function chamberFront() {
  const out = [];
  const posts = k.corners(CH, 3);
  for (const [x, y] of byDepth(posts).slice(2)) out.push(S(k.cylinder(x, y, POST_R, 3, CH_TOP - 3, P, 16), { tone: "mid" }));
  out.push(S(k.slabOf({ x: CH.x, y: CH.y + CH.d - 4, w: CH.w, d: 4, r: 1 }, CH_TOP, 3, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: CH.x + CH.w - 4, y: CH.y, w: 4, d: CH.d, r: 1 }, CH_TOP, 3, P, 3), { tone: "mid" }));
  out.push(D(k.corners(CH, 2).map(([x, y]) => at([x, y, CH_TOP + 3])), { size: 0.45 }));
  // glass: a faint pane on the front face, edge to edge
  const fy = CH.y + CH.d - 1;
  out.push(`<path class="glass" style="fill:rgb(120 170 200 / 0.07);stroke:rgb(90 140 170 / 0.35);stroke-width:0.6" d="${k.pathOf(k.pointsAt([[CH.x + 3, fy, 3], [CH.x + CH.w - 3, fy, 3], [CH.x + CH.w - 3, fy, CH_TOP], [CH.x + 3, fy, CH_TOP]], P), true)}"/>`);
  out.push(k.faceTextSvg(k.sideMatrix([CH.x + 8, fy + 1], 8, P, "left"), "CREATEOS SANDBOX", { size: 3.2, tone: "lo" }));
  return out.join("");
}

function gantry() {
  const out = [];
  for (const x of GANTRY) {
    out.push(S(k.slabOf({ x: x - 3, y: GANTRY_Y - 3, w: 6, d: 6, r: 1 }, 0, GANTRY_Z, P, 3, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x - 6, y: GANTRY_Y - 6, w: 12, d: 12, r: 2 }, 0, 3, P, 3), { tone: "lo" }));
  }
  out.push(S(k.slabOf({ x: GANTRY[0] - 4, y: GANTRY_Y - 4, w: GANTRY[1] - GANTRY[0] + 8, d: 8, r: 1.5 }, GANTRY_Z, 5, P, 4, 0.5), { tone: "mid" }));
  const ticks = k.topTicks(GANTRY[0] + 4, GANTRY[1] - 4, 4, 5, GANTRY_Y - 3.4, GANTRY_Z + 5, [1.4, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function carriage() {
  // built at x = 0; the client slides it along the beam
  const out = [];
  out.push(S(k.slabOf({ x: -8, y: GANTRY_Y - 7, w: 16, d: 14, r: 2 }, GANTRY_Z - 4, 13, P, 4, 0.6), { tone: "hi", crease: "lo" }));
  out.push(D([at([-5, GANTRY_Y - 4, GANTRY_Z + 9]), at([5, GANTRY_Y - 4, GANTRY_Z + 9])], { size: 0.4 }));
  out.push(S(k.cylinder(0, GANTRY_Y, 1.6, BOARD_H + 6, GANTRY_Z - 4 - BOARD_H - 6, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(0, GANTRY_Y, 2.6, BOARD_H + 2, 4, P, 16), { tone: "hi", lit: true }));
  return out.join("");
}

function tray() {
  const out = [`<path class="iso-halo" d="${k.haloOf(TRAY, 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(TRAY, 0, 3, P, 4, 0.5), { tone: "mid" }));
  const wall = 2.4;
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: wall, r: 1 }, 3, TRAY_H - 3, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: wall, d: TRAY.d, r: 1 }, 3, TRAY_H - 3, P, 3), { tone: "mid" }));
  return out.join("");
}

function trayFront() {
  const out = [];
  const wall = 2.4;
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y + TRAY.d - wall, w: TRAY.w, d: wall, r: 1 }, 3, TRAY_H - 3, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: TRAY.x + TRAY.w - wall, y: TRAY.y, w: wall, d: TRAY.d, r: 1 }, 3, TRAY_H - 3, P, 3), { tone: "mid" }));
  out.push(k.faceTextSvg(k.sideMatrix([TRAY.x + 8, TRAY.y + TRAY.d + 0.2], 3, P, "left"), "PAID", { size: 3.6, tone: "mid" }));
  return out.join("");
}

function rail() {
  const out = [];
  for (const x of [-138, 120]) {
    out.push(S(k.cylinder(x, RAIL.y + 3, 2.4, x < 0 ? CLAMP_H : 0, RAIL_Z - (x < 0 ? CLAMP_H : 0), P, 16), { tone: "mid", crease: "none" }));
  }
  out.push(S(k.slabOf(RAIL, RAIL_Z, 2.4, P, 3, 0.3), { tone: "mid" }));
  out.push(D([at([RAIL.x + 4, RAIL.y + 3, RAIL_Z + 2.4]), at([RAIL.x + RAIL.w - 4, RAIL.y + 3, RAIL_Z + 2.4])], { size: 0.45 }));
  return out.join("");
}

function pedestal() {
  const out = [];
  out.push(S(k.slabOf(CLAMP, 0, CLAMP_H, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CLAMP, 3), CLAMP_H, P), { tone: "faint" }));
  out.push(D(k.corners(CLAMP, 2.6).map(([x, y]) => at([x, y, CLAMP_H])), { size: 0.45 }));
  out.push(k.faceTextSvg(k.sideMatrix([CLAMP.x + 6, CLAMP.y + CLAMP.d + 0.2], 10, P, "left"), "HOLD $5", { size: 3.4, tone: "mid" }));
  // jaws either side of the coin
  for (const dy of [-11, 9]) out.push(S(k.slabOf({ x: COIN_AT[0] - 6, y: COIN_AT[1] + dy, w: 12, d: 3, r: 0.8 }, CLAMP_H, 6, P, 3), { tone: "mid" }));
  // thumb screw on the front
  const ts = [CLAMP.x + CLAMP.w - 7, CLAMP.y + CLAMP.d + 3];
  out.push(S(k.cylinder(ts[0], ts[1], 2.8, 14, 5, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(ts[0], ts[1], 2.8, 14, 19, 16, P), { tone: "lo" }));
  return out.join("");
}

function coin() {
  return S(k.cylinder(0, 0, COIN_R, 0, 2, P, 40, 0.4), { tone: "hi", lit: true, halo: false }) +
    L(k.ring(0, 0, COIN_R - 2, 2, P, 40), { tone: "lo" }) +
    k.faceTextSvg(k.topMatrix([-2.6, 2.4], 2, P, "x"), "$5", { size: 4.2, tone: "mid" });
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "An escrow test bench. A five dollar coin waits in a clamp. Inside a glass chamber marked CreateOS sandbox, a carriage on a gantry writes a patch onto a board while five test lamps go from red to green. A network duct brings GitHub and npm in, and a gate slides shut before the agent writes. On green the coin rides a rail into the Paid tray; on red it drops back into the refund cup.",
  body: [
    plate(),
    network(),
    `<g data-part="gate">${gate()}</g>`,
    cup(),
    chamberBack(),
    rack(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [CARRIAGE_FROM, 0, 0])}">${carriage()}</g>`,
    gantry(),
    chamberFront(),
    tray(),
    pedestal(),
    rail(),
    `<g data-part="coin" transform="${k.translateAlong(P, COIN_AT)}">${coin()}</g>`,
    trayFront(),
  ],
});

const basis = { x: k.axisVector(P, [1, 0, 0]), y: k.axisVector(P, [0, 1, 0]), z: k.axisVector(P, [0, 0, 1]) };
const ts = `// Generated by scripts/anatomy/build.mjs. Do not edit by hand.
export const FIGURE_SVG = ${JSON.stringify(svg)};
export const BASIS = ${JSON.stringify(basis)};
export const COIN = ${JSON.stringify({ hold: COIN_AT, lift: [COIN_AT[0], COIN_AT[1], RAIL_Z + 2.4], over: [TRAY.x + TRAY.w / 2, RAIL.y + 3, RAIL_Z + 2.4], paid: [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d / 2, 3], refundUp: [CUP[0], CUP[1], CLAMP_H + 10], refund: [CUP[0], CUP[1], 2] })};
export const CARRIAGE = ${JSON.stringify({ from: CARRIAGE_FROM, to: CARRIAGE_TO })};
export const GATE_TRAVEL = ${DUCT.x - (DUCT.x - 22) + 8};
`;
writeFileSync(OUT, ts);
console.log("wrote", OUT, `${(svg.length / 1024).toFixed(0)} KB`);
