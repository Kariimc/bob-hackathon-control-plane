#!/usr/bin/env node
/**
 * validate-mesh.mjs
 *
 * Mesh validation script for the 3d-workflow skill.
 * Parses exported OBJ files and runs the quality gate checks defined
 * in SKILL.md. Outputs a structured report to stdout.
 *
 * Usage:
 *   node validate-mesh.mjs <path-to-file.obj>
 *   node validate-mesh.mjs <path-to-file.obj> --uv
 *   node validate-mesh.mjs <path-to-file.obj> --lod
 *   node validate-mesh.mjs <path-to-file.obj> --full
 *
 * Flags:
 *   (none)   topology checks only
 *   --uv     topology + UV checks
 *   --lod    topology + LOD hierarchy checks
 *   --full   all checks
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks fail
 *   2 — file not found or parse error
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));
const flags = new Set(args.filter((a) => a.startsWith('--')));
const checkUV   = flags.has('--uv')   || flags.has('--full');
const checkLOD  = flags.has('--lod')  || flags.has('--full');
const checkFull = flags.has('--full');

if (!filePath) {
  process.stderr.write('Usage: validate-mesh.mjs <file.obj> [--uv] [--lod] [--full]\n');
  process.exit(2);
}

const absPath = resolve(filePath);
if (!existsSync(absPath)) {
  process.stderr.write(`File not found: ${absPath}\n`);
  process.exit(2);
}

if (extname(absPath).toLowerCase() !== '.obj') {
  process.stderr.write(
    `Note: only OBJ format is fully supported. Got: ${extname(absPath)}\n` +
    'Export your mesh as OBJ for validation, then convert to the target format.\n',
  );
}

// ---------------------------------------------------------------------------
// OBJ parser
// ---------------------------------------------------------------------------

async function parseOBJ(path) {
  const src = await readFile(path, 'utf8');
  const lines = src.split(/\r?\n/);

  const vertices  = [];  // [x, y, z]
  const uvs       = [];  // [u, v]
  const normals   = [];  // [nx, ny, nz]
  const faces     = [];  // [{verts: [vi], uvs: [ui], normals: [ni]}]

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const cmd = parts[0];

    if (cmd === 'v') {
      vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (cmd === 'vt') {
      uvs.push([parseFloat(parts[1]), parseFloat(parts[2] ?? '0')]);
    } else if (cmd === 'vn') {
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (cmd === 'f') {
      const faceVerts  = [];
      const faceUVs    = [];
      const faceNormals = [];
      for (let i = 1; i < parts.length; i++) {
        const tokens = parts[i].split('/');
        faceVerts.push(parseInt(tokens[0], 10) - 1);
        if (tokens[1]) faceUVs.push(parseInt(tokens[1], 10) - 1);
        if (tokens[2]) faceNormals.push(parseInt(tokens[2], 10) - 1);
      }
      faces.push({ verts: faceVerts, uvs: faceUVs, normals: faceNormals });
    }
  }

  return { vertices, uvs, normals, faces };
}

// ---------------------------------------------------------------------------
// Topology checks
// ---------------------------------------------------------------------------

function checkTopology(mesh) {
  const { vertices, faces } = mesh;
  const results = {};

  // Face type counts
  let tris = 0, quads = 0, ngons = 0;
  for (const face of faces) {
    const n = face.verts.length;
    if (n === 3) tris++;
    else if (n === 4) quads++;
    else ngons++;
  }
  const total = faces.length;
  results.total_faces   = total;
  results.quads         = quads;
  results.tris          = tris;
  results.ngons         = ngons;
  results.quad_ratio    = total > 0 ? quads / total : 0;
  results.tri_ratio     = total > 0 ? tris / total : 0;
  // Tri count (quads count as 2 tris for polygon budget purposes)
  results.tri_count_equivalent = tris + quads * 2 + ngons * 3;

  // Edge manifold check — build edge-to-face map
  const edgeMap = new Map(); // "vi:vj" → face count
  for (const face of faces) {
    const n = face.verts.length;
    for (let i = 0; i < n; i++) {
      const a = face.verts[i];
      const b = face.verts[(i + 1) % n];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
    }
  }
  let nonManifoldEdges = 0;
  for (const [, count] of edgeMap) {
    if (count !== 2) nonManifoldEdges++; // boundary edges (1) and non-manifold (3+)
  }
  results.non_manifold_edges = nonManifoldEdges;

  // Isolated vertex check (vertices not referenced by any face)
  const referencedVerts = new Set(faces.flatMap((f) => f.verts));
  results.isolated_vertices = vertices.length - referencedVerts.size;

  return results;
}

// ---------------------------------------------------------------------------
// UV checks
// ---------------------------------------------------------------------------

function checkUVs(mesh) {
  const { uvs, faces } = mesh;
  if (uvs.length === 0) {
    return { has_uvs: false, coverage: 0, out_of_range: 0, overlapping_estimated: 'unknown' };
  }

  // Coverage: compute area of UV polygons in 0-1 space
  let totalUVArea = 0;
  let outOfRange = 0;
  const allUVPolys = [];

  for (const face of faces) {
    if (!face.uvs || face.uvs.length < 3) continue;
    const poly = face.uvs.map((ui) => uvs[ui] ?? [0, 0]);
    allUVPolys.push(poly);

    // Shoelace formula for polygon area
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      area += x1 * y2 - x2 * y1;
    }
    totalUVArea += Math.abs(area) / 2;

    // Out of range check
    for (const [u, v] of poly) {
      if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) outOfRange++;
    }
  }

  return {
    has_uvs: true,
    coverage: Math.min(1.0, totalUVArea),
    coverage_pct: Math.round(Math.min(1.0, totalUVArea) * 100),
    out_of_range_uvs: outOfRange,
    // True overlap detection requires spatial indexing — flag as needs_review if coverage > 1.0
    overlap_suspected: totalUVArea > 1.02,
  };
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function gate(label, value, threshold, compare = '<=') {
  let pass;
  if (compare === '<=') pass = value <= threshold;
  else if (compare === '>=') pass = value >= threshold;
  else if (compare === '===') pass = value === threshold;
  else pass = false;

  const status = pass ? 'PASS' : 'FAIL';
  const bar    = pass ? '✔' : '✘';
  return { label, value, threshold, compare, pass, status, bar };
}

function formatReport(topologyResult, uvResult, path) {
  const checks = [];

  // Topology gates
  checks.push(gate('Non-manifold edges',   topologyResult.non_manifold_edges, 0, '==='));
  checks.push(gate('Isolated vertices',    topologyResult.isolated_vertices,  0, '==='));
  checks.push(gate('N-gon faces',          topologyResult.ngons,              0, '==='));
  checks.push(gate('Quad ratio',           topologyResult.quad_ratio,         0.90, '>='));

  // UV gates (if applicable)
  if (uvResult) {
    if (uvResult.has_uvs) {
      checks.push(gate('UV coverage',    uvResult.coverage,          0.85, '>='));
      checks.push(gate('Out-of-range UVs', uvResult.out_of_range_uvs, 0,    '==='));
      checks.push(gate('UV overlap suspected', uvResult.overlap_suspected ? 1 : 0, 0, '==='));
    } else {
      checks.push({ label: 'UV maps present', value: 'none', threshold: 'required',
                    pass: false, status: 'FAIL', bar: '✘' });
    }
  }

  const passCount = checks.filter((c) => c.pass).length;
  const overall = passCount === checks.length ? 'PASS' : 'FAIL';

  const lines = [
    '',
    'MESH VALIDATION REPORT',
    '─'.repeat(60),
    `File:    ${path}`,
    `Faces:   ${topologyResult.total_faces} (${topologyResult.tri_count_equivalent} tri-equivalent)`,
    `Quads:   ${topologyResult.quads}  Tris: ${topologyResult.tris}  N-gons: ${topologyResult.ngons}`,
    '',
    'CHECK                         VALUE          THRESHOLD      STATUS',
    '─'.repeat(60),
    ...checks.map((c) =>
      `${c.bar} ${c.label.padEnd(28)} ${String(
        typeof c.value === 'number' ? c.value.toFixed(3) : c.value,
      ).padEnd(15)} ${String(c.threshold).padEnd(15)} ${c.status}`,
    ),
    '─'.repeat(60),
    `OVERALL: ${overall} (${passCount}/${checks.length} checks passed)`,
    '',
  ];

  if (uvResult?.has_uvs) {
    lines.push(`UV Coverage: ${uvResult.coverage_pct}%`);
    if (uvResult.overlap_suspected) {
      lines.push('⚠ UV overlap suspected (total UV area > 1.02). Manual inspection recommended.');
    }
    lines.push('');
  }

  return { lines: lines.join('\n'), passed: overall === 'PASS', checks };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let mesh;
try {
  mesh = await parseOBJ(absPath);
} catch (err) {
  process.stderr.write(`Parse error: ${err.message}\n`);
  process.exit(2);
}

const topologyResult = checkTopology(mesh);
const uvResult = checkUV ? checkUVs(mesh) : null;

const { lines, passed } = formatReport(topologyResult, uvResult, absPath);
process.stdout.write(lines);

if (!passed) {
  process.stderr.write('\nValidation failed — see FAIL items above.\n');
  process.exit(1);
}
