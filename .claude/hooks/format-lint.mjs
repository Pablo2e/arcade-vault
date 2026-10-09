#!/usr/bin/env node
// Hook PostToolUse: formatea con Prettier y pasa ESLint --fix al archivo
// que Claude acaba de crear o editar. Solo aplica dentro de este proyecto.
//
// Contrato del hook (PostToolUse de Claude Code):
//   - Recibe el JSON del evento por stdin; la ruta está en tool_input.file_path.
//   - Salir con código 2 muestra stderr a Claude (así ve los errores de lint
//     que no se pueden arreglar solos y los corrige en el mismo turno).
//   - Cualquier otro resultado es silencioso.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const PRETTIER_EXTS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
  ".mdx",
  ".html",
  ".yml",
  ".yaml",
]);
const ESLINT_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

const payload = readPayload();
const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== "string" || filePath.length === 0) process.exit(0);

const base =
  typeof payload.cwd === "string" && payload.cwd ? payload.cwd : projectDir;
const absPath = path.resolve(base, filePath);

// Guarda de alcance: solo archivos dentro del proyecto y fuera de artefactos.
const rel = path.relative(projectDir, absPath);
const inProject = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
const blocked = ["node_modules", ".next", ".git", "references"].some((seg) =>
  absPath.split(path.sep).includes(seg),
);
if (!inProject || blocked || !existsSync(absPath)) process.exit(0);

const ext = path.extname(absPath).toLowerCase();
const node = process.execPath;
const steps = [];

if (PRETTIER_EXTS.has(ext)) {
  steps.push({
    name: "Prettier",
    args: [
      path.join(projectDir, "node_modules", "prettier", "bin", "prettier.cjs"),
      "--write",
      absPath,
    ],
  });
}
if (ESLINT_EXTS.has(ext)) {
  steps.push({
    name: "ESLint",
    args: [
      path.join(projectDir, "node_modules", "eslint", "bin", "eslint.js"),
      "--fix",
      "--no-warn-ignored",
      absPath,
    ],
  });
}
if (steps.length === 0) process.exit(0);

const errors = [];
for (const step of steps) {
  try {
    execFileSync(node, step.args, {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const out = [err.stdout?.toString(), err.stderr?.toString()]
      .filter(Boolean)
      .join("\n")
      .trim();
    errors.push(`[${step.name}] ${out || err.message}`);
  }
}

if (errors.length > 0) {
  process.stderr.write(
    `Formato/lint encontró problemas en ${path.basename(absPath)}:\n${errors.join("\n")}\n`,
  );
  process.exit(2);
}
process.exit(0);
