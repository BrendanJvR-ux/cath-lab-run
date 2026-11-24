/* Cath Lab Run: a 3D model of the skull, face, neck spine and upper chest, built from signed distance shapes in the
   stroke room's coordinates (x left-right, y up, z forwards; the same frame as the brain arteries in js/stroke-sim.js).
   renderSkull() passes X-rays through it in both views (front and side) and returns three smooth channels for
   js/stroke.js to engrave at run time:
     R  how much bone the ray crossed (dark = dense), so tables, rims and overlaps come out as on a real film
     G  ink contours: thin dense lines (cortex seen edge-on) found with a difference of blurs
     B  soft tissue (scalp, face, neck, shoulders), with the airway and sinuses as holes
   Used only by tools/render_skull.html to make assets/skull-xray.png; the game never runs this. */
"use strict";
const SKM = (() => {
  /* ---------- noise ---------- */
  const hash = (i, j, k) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295 };
  const sm = t => t * t * (3 - 2 * t);
  function noise(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = sm(x - i), fy = sm(y - j), fz = sm(z - k);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hash(i, j, k), hash(i + 1, j, k), fx), l(hash(i, j + 1, k), hash(i + 1, j + 1, k), fx), fy),
             l(l(hash(i, j, k + 1), hash(i + 1, j, k + 1), fx), l(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), fx), fy), fz);
  }
  const fbm = (x, y, z) => 0.6 * noise(x, y, z) + 0.4 * noise(x * 2.3 + 17, y * 2.3 + 5, z * 2.3 + 11);

  /* ---------- shapes: each {f(x,y,z) -> signed distance, bb:[x0,x1,y0,y1,z0,z1] or null} ---------- */
  const ell = (c, r) => ({
    f(x, y, z) { const X = (x - c[0]) / r[0], Y = (y - c[1]) / r[1], Z = (z - c[2]) / r[2], k0 = Math.sqrt(X * X + Y * Y + Z * Z), k1 = Math.sqrt(X * X / (r[0] * r[0]) + Y * Y / (r[1] * r[1]) + Z * Z / (r[2] * r[2])); return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1 },
    bb: [c[0] - r[0], c[0] + r[0], c[1] - r[1], c[1] + r[1], c[2] - r[2], c[2] + r[2]]
  });
  // a cone with rounded ends (Inigo Quilez's formula)
  const cone = (a, b, r1, r2) => {
    const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2, R = Math.max(r1, r2);
    return {
      f(x, y, z) {
        const px = x - a[0], py = y - a[1], pz = z - a[2], yy = px * ba[0] + py * ba[1] + pz * ba[2], zz = yy - l2;
        const qx = px * l2 - ba[0] * yy, qy = py * l2 - ba[1] * yy, qz = pz * l2 - ba[2] * yy, x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
        const k = Math.sign(rr) * rr * rr * x2;
        if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
        if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
        return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
      },
      bb: [Math.min(a[0], b[0]) - R, Math.max(a[0], b[0]) + R, Math.min(a[1], b[1]) - R, Math.max(a[1], b[1]) + R, Math.min(a[2], b[2]) - R, Math.max(a[2], b[2]) + R]
    };
  };
  const ball = (c, r) => cone(c, [c[0], c[1] + 0.01, c[2]], r, r);
  /* a tube along a polyline with an elliptical section: ra across (perpendicular to the path and to `up`), rb the other way */
  const tube = (pts, ra, rb, up = [0, 1, 0]) => {
    const n = pts.length, RA = i => Array.isArray(ra) ? ra[i] : ra, RB = i => Array.isArray(rb) ? rb[i] : rb, segs = [];
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), T = d.map(v => v / L);
      let A = [T[1] * up[2] - T[2] * up[1], T[2] * up[0] - T[0] * up[2], T[0] * up[1] - T[1] * up[0]], al = Math.hypot(...A);
      if (al < 1e-3) { const u2 = [0, 0, 1]; A = [T[1] * u2[2] - T[2] * u2[1], T[2] * u2[0] - T[0] * u2[2], T[0] * u2[1] - T[1] * u2[0]]; al = Math.hypot(...A) }
      A = A.map(v => v / al); const B = [A[1] * T[2] - A[2] * T[1], A[2] * T[0] - A[0] * T[2], A[0] * T[1] - A[1] * T[0]];
      segs.push({ a, T, A, B, L, ra0: RA(i), ra1: RA(i + 1), rb0: RB(i), rb1: RB(i + 1) });
    }
    let bb = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9], M = 0; for (let i = 0; i < n; i++) M = Math.max(M, RA(i), RB(i));
    for (const p of pts) { bb[0] = Math.min(bb[0], p[0] - M); bb[1] = Math.max(bb[1], p[0] + M); bb[2] = Math.min(bb[2], p[1] - M); bb[3] = Math.max(bb[3], p[1] + M); bb[4] = Math.min(bb[4], p[2] - M); bb[5] = Math.max(bb[5], p[2] + M) }
    return {
      f(x, y, z) {
        let best = 1e9;
        for (const s of segs) {
          const px = x - s.a[0], py = y - s.a[1], pz = z - s.a[2]; let t = px * s.T[0] + py * s.T[1] + pz * s.T[2];
          const tc = Math.max(0, Math.min(s.L, t)), u = tc / s.L, ra = s.ra0 + (s.ra1 - s.ra0) * u, rb = s.rb0 + (s.rb1 - s.rb0) * u, rc = Math.min(ra, rb);
          const vx = px - s.T[0] * tc, vy = py - s.T[1] * tc, vz = pz - s.T[2] * tc;
          const ca = vx * s.A[0] + vy * s.A[1] + vz * s.A[2], cb = vx * s.B[0] + vy * s.B[1] + vz * s.B[2], ct = t - tc;
          const X = ca / ra, Y = cb / rb, Z = ct / rc, k0 = Math.sqrt(X * X + Y * Y + Z * Z), k1 = Math.sqrt(X * X / (ra * ra) + Y * Y / (rb * rb) + Z * Z / (rc * rc));
          const d = k1 < 1e-9 ? -rc : k0 * (k0 - 1) / k1; if (d < best) best = d;
        }
        return best;
      }, bb
    };
  };
  // an upright cylinder with an elliptical section and rounded edges
  const ecyl = (c, rx, rz, h, rnd = 1.5) => ({
    f(x, y, z) {
      const X = (x - c[0]) / rx, Z = (z - c[2]) / rz, k0 = Math.hypot(X, Z), k1 = Math.hypot(X / rx, Z / rz);
      const d2 = (k1 < 1e-9 ? -Math.min(rx, rz) : k0 * (k0 - 1) / k1) + rnd, dy = Math.abs(y - c[1]) - h / 2 + rnd;
      return Math.hypot(Math.max(d2, 0), Math.max(dy, 0)) + Math.min(Math.max(d2, dy), 0) - rnd;
    },
    bb: [c[0] - rx, c[0] + rx, c[1] - h / 2, c[1] + h / 2, c[2] - rz, c[2] + rz]
  });
  const bbU = (l) => l.reduce((b, s) => s.bb ? [Math.min(b[0], s.bb[0]), Math.max(b[1], s.bb[1]), Math.min(b[2], s.bb[2]), Math.max(b[3], s.bb[3]), Math.min(b[4], s.bb[4]), Math.max(b[5], s.bb[5])] : b, [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]);
  const grow = (b, m) => [b[0] - m, b[1] + m, b[2] - m, b[3] + m, b[4] - m, b[5] + m];
  const U = (...l) => ({ f(x, y, z) { let d = 1e9; for (const s of l) { const v = s.f(x, y, z); if (v < d) d = v } return d }, bb: bbU(l) });
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 };
  const SU = (k, ...l) => ({ f(x, y, z) { let d = l[0].f(x, y, z); for (let i = 1; i < l.length; i++) d = smin(d, l[i].f(x, y, z), k); return d }, bb: grow(bbU(l), k) });
  const I = (a, b) => ({ f: (x, y, z) => Math.max(a.f(x, y, z), b.f(x, y, z)), bb: a.bb });
  const Shell = (a, t) => ({ f: (x, y, z) => Math.abs(a.f(x, y, z)) - (typeof t === 'function' ? t(x, y, z) : t), bb: grow(a.bb, 4) });
  const rotY = (s, c, ang) => { const cs = Math.cos(ang), sn = Math.sin(ang), b = s.bb, R = Math.max(b[1] - b[0], b[5] - b[4]);
    return { f(x, y, z) { const dx = x - c[0], dz = z - c[2]; return s.f(c[0] + cs * dx - sn * dz, y, c[2] + sn * dx + cs * dz) }, bb: [c[0] - R, c[0] + R, b[2], b[3], c[2] - R, c[2] + R] } };
  const custom = (f, bb) => ({ f, bb });

  /* ---------- the anatomy ---------- */
  const parts = [], soft = [], softAir = [];
  // part: shape, cortex thickness, cortex and inner density, texture, air cut out of it, special textures
  const P = (s, o = {}) => { const p = Object.assign({ s, cort: 1.4, cd: 1, id: 0.42, tex: 0.6, air: [], cells: 0, honey: 0 }, o); parts.push(p); return p };
  const both = fn => { fn(-1); fn(1) };
  const m = (s, p) => [s * p[0], p[1], p[2]];

  // air spaces
  const airOrbit = [-1, 1].map(s => cone(m(s, [32, 222, 98]), m(s, [16, 219, 38]), 17, 3.5));
  const airNose = ell([0, 203, 70], [11.5, 24, 37]);
  const airMax = [-1, 1].map(s => ell(m(s, [25, 194, 68]), [14, 14.5, 20]));
  const airFrontal = [ell([-9, 252, 86], [10, 9, 6.5]), ell([9, 251, 86], [9, 8, 6.5]), ell([0, 246, 88], [6, 6, 5])];
  const airSphen = ell([0, 213, 16], [11, 9.5, 13]);
  const airSella = ball([0, 228, 2], 7.5);
  const airEar = [-1, 1].map(s => cone(m(s, [82, 200, -38]), m(s, [46, 202, -36]), 4.2, 3));
  const airIAC = [-1, 1].map(s => cone(m(s, [40, 206, -30]), m(s, [23, 208, -21]), 2.2, 1.6));
  const airInner = [-1, 1].map(s => ell(m(s, [34, 203, -32]), [3, 2.6, 3]));
  const airFM = ecyl([0, 186, -40], 14, 17, 40, 2);
  const zig = (a, b) => 1.1 * Math.sin(a * 0.9 + Math.sin(b * 0.3) * 2) * Math.sin(b * 0.7 + a * 0.2);
  const sutures = [
    custom((x, y, z) => Math.max(Math.abs(z - (18 + 0.16 * (368 - y)) + zig(y, x)) - 0.45, 214 - y), null),           // coronal
    custom((x, y, z) => Math.max(Math.abs(x + zig(z, y)) - 0.45, 305 - y, z - 18, -88 - z), null),                    // sagittal
    custom((x, y, z) => Math.max(Math.abs(z - (-88 + 0.0045 * x * x + 0.06 * (y - 300)) + zig(y, x)) - 0.45, 210 - y), null), // lambdoid
    custom((x, y, z) => Math.max(Math.abs(Math.hypot(Math.abs(x) * 0.15, y - 172, z + 6) - 52 + zig(z, y) * 0.8) - 0.4, 212 - y, Math.abs(z + 8) - 34, 62 - Math.abs(x)), null) // squamosal
  ];
  // the vault and skull base: one shell around the brain case, the floor stepped into the three fossae
  const E1 = ell([0, 272, -10], [86, 100, 98]), E2 = ell([0, 234, -56], [66, 52, 57]);
  const floorY = (x, z) => {
    // anterior fossa: domed over each orbit, dipping at the midline (cribriform plate), sloping down towards the back
    const ax = Math.abs(x), fa = 233 + 9 * Math.exp(-(((ax - 30) / 15) ** 2)) - 8 * Math.exp(-((x / 7) ** 2)) + 0.0025 * (z - 40) * (z - 40) - 0.004 * Math.max(0, ax - 46) ** 2;
    // middle fossa: a bowl under each temporal lobe, the sphenoid body raised between them
    const fm = 193 + 28 * Math.exp(-((x / 15) ** 2)) + 0.006 * (ax - 46) ** 2 + 0.014 * (z - 4) ** 2;
    // posterior fossa: a bowl under the cerebellum either side of the midline
    const fp = 180 + 0.005 * (ax - 30) ** 2 + 0.006 * (z + 62) ** 2 + 5 * Math.exp(-((x / 8) ** 2));
    const wa = Math.min(1, Math.max(0, (z - 22) / 18)), wp = Math.min(1, Math.max(0, (-22 - z) / 18)), w = 1 - wa - wp;
    return fa * sm(wa) + fp * sm(wp) + fm * (1 - sm(wa) - sm(wp)) + 0 * w;
  };
  const brainCase = I(SU(14, E1, E2), custom((x, y, z) => (floorY(x, z) - y) * 0.9, null));
  const vaultT = (x, y, z) => 3.3 - 1.7 * Math.exp(-(((y - floorY(x, z) - 2) / 9) ** 2)) - 0.7 * Math.exp(-(((y - 214) / 22) ** 2));
  const vascular = [];
  // middle meningeal grooves and diploic channels: thin air tubes in the inner table
  for (const s of [-1, 1]) {
    const ang = [[-0.15, 0.55], [0.15, 0.9], [0.5, 1.15], [-0.45, 0.6]];
    for (const [a0, a1] of ang) {
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6, th = a0 + (a1 - a0) * t * 0.6, ph = 0.25 + t * 1.05 + 0.06 * Math.sin(k * 2.1);
        const dir = [s * Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)];
        // walk out from the centre to the inner surface
        let r = 40; for (let it = 0; it < 30; it++) { const d = brainCase.f(dir[0] * r * 0.86, 262 + dir[1] * r, -10 + dir[2] * r * 0.98); r -= d * 0.8 }
        r -= 3.3; pts.push([dir[0] * r * 0.86, 262 + dir[1] * r, -10 + dir[2] * r * 0.98]) }
      vascular.push(tube(pts, [1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.7], [1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.7]));
    }
  }
  P(Shell(brainCase, vaultT), { cort: 1.25, id: 0.5, tex: 0.9, air: [airFM, airSella, ...airFrontal, ...airEar, ...airIAC, ...sutures, ...vascular] });
  // granulation pits near the top
  for (const [x, z] of [[-14, 10], [16, 4], [-24, -12], [26, -20], [8, -30]]) parts[parts.length - 1].air.push(ell([x, 366 - Math.abs(x) * 0.25, z], [2.4, 3.2, 2.4]));

  // face: frontal brow, orbit rims, zygomas, maxilla, nose
  // the rim of each orbit: a tilted ring, thick above, set back at the side, thin on the inner side
  function orbitRim(s) {
    const pts = [], ra = [], rb = [];
    for (let i = 0; i <= 24; i++) { const ph = i / 24 * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
      pts.push([s * (33 + 19.5 * c), 222 + 17.5 * sn + 1.5 * c, 88 - 13 * c + 3 * sn]);
      const w = 3.2 + 1.2 * Math.max(0, sn) + 0.6 * c - 0.4 * Math.max(0, -sn); ra.push(w); rb.push(w * 0.9) }
    return tube(pts, ra, rb, [0, 0, 1]);
  }
  const faceShapes = [
    ell([0, 240, 94], [11, 7, 5]),
    ell([0, 192, 70], [42, 24, 30]),
    tube(arcPts(174, 1.0, 0, -88, 88, 9), 5.5, 6.5),
    ell([0, 177, 64], [21, 3, 30])
  ];
  both(s => {
    faceShapes.push(
      orbitRim(s),
      ell(m(s, [18, 245, 91]), [13, 5, 5]),                                            // brow ridge
      ell(m(s, [50, 204, 64]), [11, 11, 13]),                                          // cheekbone
      tube([m(s, [13, 236, 95]), m(s, [15, 206, 98])], 4, 3, [0, 0, 1]),
      tube([m(s, [54, 205, 56]), m(s, [64, 205, 32]), m(s, [67, 207, 10]), m(s, [64, 204, -10]), m(s, [60, 200, -20])], 2.1, [4.2, 4.2, 3.8, 3.8, 3.4]),
      cone(m(s, [15, 206, 30]), m(s, [17, 176, 32]), 3.5, 2),
      cone(m(s, [23, 204, 28]), m(s, [25, 178, 30]), 3, 1.6),
      cone(m(s, [4, 237, 97]), m(s, [3, 214, 106]), 3.2, 2.2));
  });
  P(SU(5, ...faceShapes), { cort: 1.0, cd: 0.72, id: 0.3, air: [...airOrbit, airNose, ...airMax, ...airFrontal] });
  P(ell([0, 204, 72], [1.3, 20, 31]), { cort: 2, cd: 0.8 });                                                     // nasal septum
  both(s => { P(ell(m(s, [8, 197, 68]), [3, 3.5, 27]), { cort: 1, cd: 0.75, id: 0.3 }); P(ell(m(s, [9, 208, 70]), [2.6, 3, 24]), { cort: 1, cd: 0.7, id: 0.3 }) }); // turbinates
  P(ell([0, 220, 66], [12, 13, 27]), { honey: 1, air: [...airOrbit] });                                          // ethmoid air cells
  P(cone([0, 235, 84], [0, 247, 80], 2.6, 1), { cort: 3 });                                                      // crista galli
  // sphenoid, sella, clivus, petrous bones, mastoids, condyles
  P(ell([0, 213, 16], [15, 13.5, 18]), { air: [airSphen, airSella] });
  P(cone([0, 220, -7], [0, 233, -6], 3.5, 2), { cort: 3 });                                                      // dorsum sellae
  both(s => P(ell(m(s, [7, 232, 9]), [3, 2, 4.5]), { cort: 3 }));                                                // anterior clinoids
  P(cone([0, 226, -6], [0, 192, -28], 6, 4.5), { cort: 2 });                                                     // clivus
  both(s => {
    P(SU(6, cone(m(s, [60, 197, -46]), m(s, [14, 213, -6]), 10, 3.5), ell(m(s, [44, 199, -36]), [13, 8, 11])), { cort: 2.5, cd: 1.2, id: 0.85, tex: 0.3, air: [airEar[(s + 1) / 2], airIAC[(s + 1) / 2], airInner[(s + 1) / 2]] }); // petrous ridge
    P(ell(m(s, [58, 184, -54]), [9, 15, 11]), { cells: 1, cort: 1 });                                            // mastoid with its air cells
    P(cone(m(s, [40, 196, -30]), m(s, [36, 168, -18]), 2, 0.8), { cort: 3 });                                    // styloid
    P(ell(m(s, [17, 190, -32]), [6, 5, 9]), { cort: 1.6 });                                                       // occipital condyle
  });
  P(ell([0, 236, -103], [7, 5, 4]), { cort: 3, cd: 0.6 }); P(ell([0, 230, -111], [5, 4, 2.5]), { cort: 3, cd: 0.6 });                // occipital protuberances

  // mandible
  const jawPath = [[0, 141, 93], [17, 142, 88], [31, 143, 74], [40, 145, 55], [46, 147, 32], [49, 149, 12], [50, 151, 0]];
  const jawShapes = [tube([...jawPath.slice(1).reverse().map(p => m(-1, p)), ...jawPath], 4.8, [9, 10, 11, 12, 13, 13.5, 13, 12, 11, 10, 9, 9, 9].slice(0, 13)), ell([0, 132, 95], [14, 6, 5])];
  both(s => jawShapes.push(
    tube([m(s, [50, 153, 2]), m(s, [51, 168, -4]), m(s, [51.5, 181, -8])], [13, 14, 12.5], 3.5, [1, 0, 0]),
    tube([m(s, [51.5, 180, -9]), m(s, [53, 193, -18])], 3.4, 3.6, [1, 0, 0]),
    ell(m(s, [54, 196, -19]), [9, 4.5, 5.5]),
    cone(m(s, [48, 178, 7]), m(s, [47, 193, 12]), 4.5, 1.8)));
  const canal = [-1, 1].map(s => tube([m(s, [50, 172, -3]), m(s, [48, 148, 10]), m(s, [40, 142, 50]), m(s, [24, 140, 78])], 1.6, 1.6));
  P(SU(3, ...jawShapes), { cort: 1.7, id: 0.4, air: canal });
  // teeth, upper and lower, along the dental arch
  function arcPts(y, sc, dz, a0, a1, n) { const out = []; for (let i = 0; i < n; i++) { const a = (a0 + (a1 - a0) * i / (n - 1)) * Math.PI / 180; out.push([38 * sc * Math.sin(a), y, 52 + dz + 42 * sc * Math.cos(a)]) } return out }
  const TA = [6, 17, 28, 39, 50, 61, 72, 83], TW = [2.5, 2.3, 2.8, 2.9, 3, 3.9, 4, 3.6], TL = [12, 11, 16, 12, 12, 11, 11, 10];
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) for (const up of [1, 0]) {
    const a = TA[i] * Math.PI / 180, sc = up ? 1 : 0.97, dz = up ? 0 : -2.5, x = s * 38 * sc * Math.sin(a), z = 52 + dz + 42 * sc * Math.cos(a), w = TW[i], L = TL[i], tilt = i < 2 ? 3 : 0;
    const yC0 = up ? 164 : 162, yC1 = up ? 172 : 154, yR = up ? 172 + L : 154 - L, dir = up ? 1 : -1;
    const tx = s * Math.cos(a), tz = -Math.sin(a), shapes = [cone([x, yC0, z + tilt * 0.3], [x, yC1, z], w * 0.85, w)];
    const roots = i >= 5 ? [-1.6, 1.6] : [0];
    for (const o of roots) shapes.push(cone([x + tx * o * 0.3, yC1, z + tz * o * 0.3], [x + tx * o, yR, z + tz * o - tilt], w * 0.72, 0.9));
    const pulp = cone([x, yC0 + dir * 3, z], [x, yR - dir * 2, z - tilt], 0.9, 0.35);
    P(SU(1.5, ...shapes), { cort: 1.1, cd: 1.95, id: 1.15, tex: 0.15, air: [pulp] });
  }
  P(tube([[-20, 127, 8], [-13, 125, 24], [0, 124, 30], [13, 125, 24], [20, 127, 8]], 1.7, 2.2), { cort: 1.2, cd: 0.7 }); // hyoid

  // spine: C1 ring, C2 with the dens, C3 to C7, then T1 to T6
  const Zc = y => y >= 10 ? -30 + 5 * Math.sin(Math.PI * (y - 10) / 150) : -30 - (10 - y) * 0.2;
  {
    const z0 = -30;
    const ring = tube([[0, 178, -12], [12, 178, -16], [20, 178, -27], [19, 178, -44], [10, 178, -56], [0, 178, -60], [-10, 178, -56], [-19, 178, -44], [-20, 178, -27], [-12, 178, -16], [0, 178, -12]], 3.2, 4.2);
    const c1 = [ring, ell([0, 178, -12], [5, 5.5, 3.5]), ell([0, 178, -61], [4, 5, 3.5])];
    both(s => c1.push(ell(m(s, [19, 178, -28]), [8, 8, 10]), tube([m(s, [22, 178, -28]), m(s, [40, 179, -30])], 4, 4)));
    P(SU(2.5, ...c1), { cort: 1.3, air: [-1, 1].map(s => ecyl(m(s, [31, 178, -29]), 2.8, 2.8, 20)) });
    void z0;
  }
  const verts = [ // [centre y, height, spinous length, thoracic?]
    [150, 22, 30, 0], [123, 17, 18, 0], [101, 17, 18, 0], [79, 17, 20, 0], [57, 17, 25, 0], [35, 17, 38, 0],
    [12, 18, 36, 1], [-10, 19, 34, 1], [-32, 19, 34, 1], [-54, 20, 34, 1], [-76, 20, 34, 1], [-98, 21, 34, 1]];
  verts.forEach(([yc, h, sl, th], vi) => {
    const zc = Zc(yc), rx = th ? 15 + vi * 0.3 : 12.5 + vi * 0.25, rz = th ? 12.5 : 9.5, sh = [ecyl([0, yc, zc], rx, rz, h, 2)];
    if (vi === 0) sh.push(cone([0, 158, zc + 5], [0, 188, -21], 5.8, 5)); // the dens
    both(s => {
      sh.push(tube([m(s, [8, yc + 2, zc - 7]), m(s, [13, yc + 2, zc - 15])], 3.2, 3.6, [0, 1, 0]));                     // pedicle
      sh.push(ecyl(m(s, [th ? 15 : 17, yc - 1, zc - 21]), 5.5, 6.5, h + 4, 2.2));                                      // articular pillar
      sh.push(tube([m(s, [16, yc, zc - 25]), m(s, [7, yc - 1, zc - 32]), [0, yc - 2, zc - 34]], 2.6, vi === 0 ? 5 : 3.6)); // lamina
      if (th) sh.push(tube([m(s, [12, yc + 2, zc - 10]), m(s, [28, yc + 1, zc - 22])], 3.6, 4));                       // thoracic transverse process
      else sh.push(tube([m(s, [11, yc + 1, zc - 4]), m(s, [27, yc, zc - 9])], 3.2, 3.4));                               // cervical transverse process
    });
    sh.push(cone([0, yc - 2, zc - 33], [0, yc - 2 - sl * (th ? 0.6 : 0.35), zc - 33 - sl], vi === 0 ? 5 : 3.2, vi === 0 ? 3.5 : 2.5)); // spinous process
    const air = th ? [] : [-1, 1].map(s => ecyl(m(s, [20, yc, zc - 6]), 2.8, 2.8, 20));
    P(SU(2.2, ...sh), { cort: 1.2, id: 0.46, air });
  });
  // upper chest: clavicles, ribs, sternum, shoulder blades, upper arm bones
  both(s => {
    P(tube([m(s, [8, 4, 30]), m(s, [30, 8, 31]), m(s, [60, 12, 20]), m(s, [85, 16, -6]), m(s, [106, 20, -28])], [6, 5.5, 5, 4.6, 5.5], [5.5, 5, 4.6, 4.2, 4.5]), { cort: 1.6 });
    const RX = [0, 44, 60, 72, 80, 86, 90], RZ = [0, 30, 42, 50, 55, 58, 60], DROP = [0, 26, 30, 32, 34, 34, 34];
    for (let k = 1; k <= 6; k++) {
      const yc = verts[5 + k][0], pts = [], p0 = k === 1 ? 0.35 : 0.25, p1 = k === 1 ? 2.75 : 2.45;
      for (let i = 0; i <= 10; i++) { const ph = p0 + (p1 - p0) * i / 10; pts.push(m(s, [RX[k] * Math.sin(ph), yc - DROP[k] * Math.pow(ph / Math.PI, 1.3), -18 - RZ[k] * Math.cos(ph)])) }
      pts.unshift(m(s, [14, yc + 2, Zc(yc) - 16]));
      P(tube(pts, 2.3, 4.4), { cort: 1.1, id: 0.3 });
    }
    P(rotY(ell([s * 84, -40, -62], [26, 44, 4]), [s * 84, -40, -62], s * -0.6), { cort: 1.4, id: 0.35 });          // shoulder blade
    P(tube([m(s, [72, 0, -66]), m(s, [96, 12, -48]), m(s, [108, 22, -30])], 4, 5), { cort: 1.4 });                    // spine of the scapula and acromion
    P(ball(m(s, [116, -6, -22]), 21), { cort: 2, cd: 0.75, id: 0.3 });                                                         // humeral head
    P(cone(m(s, [118, -16, -20]), m(s, [124, -120, -14]), 15, 12), { cort: 2.4, cd: 0.75, id: 0.15 });                          // humerus
  });
  P(ell([0, -20, 34], [21, 19, 5.5]), { cort: 1.4, id: 0.34 }); P(ell([0, -82, 40], [14, 42, 5]), { cort: 1.4, id: 0.32 }); // sternum

  // soft tissue
  soft.push(SU(18, ell([0, 272, -10], [93, 107, 105]), ell([0, 236, -56], [72, 58, 63]),
    ell([0, 192, 76], [52, 52, 32]), cone([0, 236, 101], [0, 206, 113], 5, 8), ell([0, 156, 96], [26, 22, 10]), ell([0, 136, 94], [22, 12, 9]),
    ecyl([0, 90, -14], 44, 50, 170, 10), ell([0, -60, -14], [150, 90, 76])));
  both(s => soft.push(ell(m(s, [90, 200, -34]), [5, 16, 11])));
  softAir.push(tube([[0, -110, 2], [0, -40, 6], [0, 60, 10], [0, 108, 14]], 7, 7), ell([0, 122, 18], [9, 14, 9]),
    tube([[0, 128, 4], [0, 160, -2], [0, 186, -6], [0, 205, 4], [0, 208, 30]], 8, 7), ell([0, 160, 58], [18, 4.5, 26]), airNose, ...airMax);

  /* ---------- the X-ray ---------- */
  const X0 = -128, X1 = 128, Y0 = -114, Y1 = 384, Z0 = -122, Z1 = 122;
  function project(list, step, densFn, onProgress) {
    const nx = Math.round((X1 - X0) / step), ny = Math.round((Y1 - Y0) / step), nz = Math.round((Z1 - Z0) / step);
    const AP = new Float32Array(nx * ny), LAT = new Float32Array(nz * ny), C = 8, cx = Math.ceil((X1 - X0) / C), cy = Math.ceil((Y1 - Y0) / C), cz = Math.ceil((Z1 - Z0) / C);
    let done = 0; const total = cx * cy;
    const job = function* () {
      for (let gy = 0; gy < cy; gy++) for (let gx = 0; gx < cx; gx++) {
        for (let gz = 0; gz < cz; gz++) {
          const bx0 = X0 + gx * C, by0 = Y0 + gy * C, bz0 = Z0 + gz * C, mx = bx0 + C / 2, my = by0 + C / 2, mz = bz0 + C / 2, hd = C * 0.87;
          const cand = [];
          for (const p of list) {
            const b = p.bb; if (b && (bx0 > b[1] + 1 || bx0 + C < b[0] - 1 || by0 > b[3] + 1 || by0 + C < b[2] - 1 || bz0 > b[5] + 1 || bz0 + C < b[4] - 1)) continue;
            const d = p.sf(mx, my, mz); if (d > hd * 1.5 + 1) continue; cand.push(p);
          }
          if (!cand.length) continue;
          const n = C / step;
          for (let iy = 0; iy < n; iy++) { const y = by0 + (iy + 0.5) * step, jy = Math.round((y - Y0) / step - 0.5); if (jy < 0 || jy >= ny) continue;
            for (let ix = 0; ix < n; ix++) { const x = bx0 + (ix + 0.5) * step, jx = Math.round((x - X0) / step - 0.5); if (jx < 0 || jx >= nx) continue;
              for (let iz = 0; iz < n; iz++) { const z = bz0 + (iz + 0.5) * step, jz = Math.round((z - Z0) / step - 0.5); if (jz < 0 || jz >= nz) continue;
                let den = 0; for (const p of cand) { const v = densFn(p, x, y, z); if (v > den) den = v }
                if (den > 0) { AP[jy * nx + jx] += den * step; LAT[jy * nz + jz] += den * step } } } }
        }
        done++; if (done % 40 === 0) yield done / total;
      }
    };
    return { job, AP, LAT, nx, ny, nz, step };
  }
  function boneDensity(p, x, y, z) {
    let d = p.s.f(x, y, z); if (d >= 0.5) return 0;
    for (const a of p.air) { const da = a.f(x, y, z); if (-da > d) d = -da; if (d >= 0.5) return 0 }
    const cov = Math.min(1, 0.5 - d); let den;
    if (p.honey) { const n = fbm(x * 0.32, y * 0.32, z * 0.32); den = Math.abs(n - 0.5) < 0.05 ? 0.85 : 0.06 }
    else if (d > -p.cort) den = p.cd;
    else { den = p.id * (1 - p.tex * 0.5 + p.tex * fbm(x * 0.4, y * 0.4, z * 0.4));
      if (p.cells && fbm(x * 0.42 + 3, y * 0.42, z * 0.42) > 0.5) den *= 0.12 }
    return den * cov;
  }
  function softDensity(p, x, y, z) {
    let d = p.s.f(x, y, z); if (d >= 0.5) return 0;
    for (const a of softAir) { const da = a.f(x, y, z); if (-da > d) d = -da; if (d >= 0.5) return 0 }
    return Math.min(1, 0.5 - d);
  }
  for (const p of parts) p.sf = p.s.f.bind(p.s);
  const softParts = soft.filter(Boolean).map(s => ({ s, sf: s.f.bind(s), bb: s.bb }));
  for (const p of parts) p.bb = p.s.bb;

  /* the two views into one 1024 square: the front view on the left half, the side view (face to the left) on the right */
  function toImage(pr, N = 1024) {
    const out = new Float32Array(N * N), { AP, LAT, nx, ny, nz, step } = pr;
    const samp = (arr, w, fx, fy) => { const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, g = (i, j) => (i < 0 || j < 0 || i >= w || j >= ny) ? 0 : arr[j * w + i];
      return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty };
    for (let py = 0; py < N; py++) { const v = (py + 0.5) * 512 / N, Y = 400 - v, fy = (Y - Y0) / step - 0.5;
      for (let px = 0; px < N; px++) { const u = (px + 0.5) * 512 / N;
        out[py * N + px] = u < 256 ? samp(AP, nx, (u - 128 - X0) / step - 0.5, fy) : samp(LAT, nz, ((384 - u) / 1.05 - Z0) / step - 0.5, fy) } }
    return out;
  }
  function blur(src, N, r) { // three box blurs, roughly gaussian
    let a = Float32Array.from(src), b = new Float32Array(N * N);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < N; y++) { let s = 0; const row = y * N; for (let x = -r; x <= r; x++) s += a[row + Math.min(N - 1, Math.max(0, x))];
        for (let x = 0; x < N; x++) { b[row + x] = s / (2 * r + 1); s += a[row + Math.min(N - 1, x + r + 1)] - a[row + Math.max(0, x - r)] } }
      for (let x = 0; x < N; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(N - 1, Math.max(0, y)) * N + x];
        for (let y = 0; y < N; y++) { a[y * N + x] = s / (2 * r + 1); s += b[Math.min(N - 1, y + r + 1) * N + x] - b[Math.max(0, y - r) * N + x] } }
    }
    return a;
  }
  async function render(onProgress = () => {}, opt = {}) {
    const N = 1024, KB = opt.kb ?? 0.05, KS = opt.ks ?? 0.0032;
    const run = async (pr, w0, w1) => { const it = pr.job(); let r; while (!(r = it.next()).done) { onProgress(w0 + (w1 - w0) * r.value); await new Promise(f => setTimeout(f, 0)) } };
    const bone = project(parts, opt.step ?? 0.5, boneDensity); await run(bone, 0, 0.85);
    const sft = project(softParts, 1, softDensity); await run(sft, 0.85, 0.97);
    const Lb = toImage(bone, N), Ls = toImage(sft, N), R = new Float32Array(N * N), B = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) { R[i] = 1 - Math.exp(-KB * Lb[i]); B[i] = 1 - Math.exp(-KS * Ls[i]) }
    // contours: thin lines denser than their surroundings, plus sharp steps
    const b1 = blur(R, N, 1), b2 = blur(R, N, 3), G = new Float32Array(N * N);
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const i = y * N + x, dog = b1[i] - b2[i], gx = b1[i + 1] - b1[i - 1], gy = b1[i + N] - b1[i - N];
      G[i] = Math.min(1, Math.max(0, dog * (opt.kd ?? 9) - 0.05) + Math.max(0, Math.hypot(gx, gy) * (opt.kg ?? 3) - 0.12)) }
    onProgress(1);
    return { N, R, G, B };
  }
  return { render, parts, noise };
})();
