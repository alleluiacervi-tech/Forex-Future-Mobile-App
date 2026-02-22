import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const rootDir = process.cwd();
const installedClientPkgPath = path.join(rootDir, "node_modules", "@prisma", "client", "package.json");
const generatedClientPkgPath = path.join(rootDir, "node_modules", ".prisma", "client", "package.json");

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
};

const installedClientPkg = readJson(installedClientPkgPath);
if (!installedClientPkg?.version) {
  console.warn("[prisma] @prisma/client is not installed yet; skipping client sync check.");
  process.exit(0);
}

const installedVersion = String(installedClientPkg.version);
const generatedClientPkg = readJson(generatedClientPkgPath);
const generatedVersion = generatedClientPkg?.version ? String(generatedClientPkg.version) : null;

if (generatedVersion === installedVersion) {
  process.exit(0);
}

const mismatchReason = generatedVersion
  ? `generated Prisma client (${generatedVersion}) does not match @prisma/client (${installedVersion})`
  : "generated Prisma client is missing";

if (process.env.PRISMA_SKIP_GENERATE === "true") {
  console.warn(`[prisma] ${mismatchReason}. Skipping prisma generate because PRISMA_SKIP_GENERATE=true.`);
  process.exit(0);
}

console.log(`[prisma] ${mismatchReason}. Running prisma generate...`);

const prismaCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(prismaCommand, ["prisma", "generate"], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env
});

if (result.error) {
  console.error("[prisma] Failed to execute prisma generate.", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const regeneratedClientPkg = readJson(generatedClientPkgPath);
const regeneratedVersion = regeneratedClientPkg?.version ? String(regeneratedClientPkg.version) : null;
if (regeneratedVersion !== installedVersion) {
  console.error(
    `[prisma] prisma generate completed but client is still out of sync (generated=${regeneratedVersion || "missing"}, installed=${installedVersion}).`
  );
  process.exit(1);
}

console.log(`[prisma] Prisma client synchronized (v${installedVersion}).`);
