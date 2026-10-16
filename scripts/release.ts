// Uso: bun run release:patch | release:minor | release:major
// Publica lo que ya está commiteado y subido a origin/main: calcula la siguiente
// versión a partir del último tag vX.Y.Z, crea el tag sobre ese commit y lo sube.
// No modifica archivos ni hace commits: la versión sale del tag y el workflow de
// release (.github/workflows/release.yml) la inyecta al compilar.
import { $ } from "bun";

const BUMPS = ["patch", "minor", "major"] as const;
type Bump = (typeof BUMPS)[number];

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function nextVersion(current: string, bump: Bump): string {
  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const bump = process.argv[2] as Bump;
if (!BUMPS.includes(bump)) fail("Uso: bun run release:patch | release:minor | release:major");

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== "main") fail(`Hay que publicar desde main (rama actual: ${branch})`);
if ((await $`git status --porcelain`.text()).trim()) fail("Hay cambios sin commitear");

const fetch = await $`git fetch origin main --tags --quiet`.nothrow().quiet();
if (fetch.exitCode !== 0) fail("No se pudo leer origin/main: ¿has hecho push de main?");
const head = (await $`git rev-parse HEAD`.text()).trim();
const remote = (await $`git rev-parse origin/main`.text()).trim();
if (head !== remote)
  fail("main no está sincronizada con origin/main: haz push (o pull) antes de publicar");

const tags = (await $`git tag --list ${"v*"} --sort=-v:refname`.text())
  .split("\n")
  .map((t) => t.trim())
  .filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
const lastTag = tags[0];
if (lastTag && (await $`git rev-list -n 1 ${lastTag}`.text()).trim() === head) {
  fail(`El último commit ya está publicado como ${lastTag}`);
}

const version = nextVersion(lastTag?.slice(1) ?? "0.0.0", bump);
const tag = `v${version}`;
console.log(`${lastTag ?? "(sin versiones)"} → ${tag}`);

await $`git tag -a ${tag} -m ${tag}`;
await $`git push origin ${tag}`;

console.log(`✔ Publicado ${tag}. Sigue el build en la pestaña Actions de GitHub.`);
