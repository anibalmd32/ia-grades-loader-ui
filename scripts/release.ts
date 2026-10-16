// Uso: bun run release:patch | release:minor | release:major
// Calcula la siguiente versión a partir de package.json, la escribe en
// package.json, tauri.conf.json y Cargo.toml/Cargo.lock, crea el commit
// "chore: versión x.y.z" y el tag vX.Y.Z, y los sube al remoto.
// El push del tag dispara el workflow de release (.github/workflows/release.yml).
import { $ } from "bun";

const CRATE = "ia-grades-loader-ui";
const BUMPS = ["patch", "minor", "major"] as const;
type Bump = (typeof BUMPS)[number];

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function nextVersion(current: string, bump: Bump): string {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) fail(`Versión actual no válida en package.json: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const bump = process.argv[2] as Bump;
if (!BUMPS.includes(bump)) fail("Uso: bun run release:patch | release:minor | release:major");

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== "main") fail(`Hay que publicar desde main (rama actual: ${branch})`);
if ((await $`git status --porcelain`.text()).trim()) fail("Hay cambios sin commitear");

const pkgFile = Bun.file("package.json");
const pkg = await pkgFile.json();
const version = nextVersion(pkg.version, bump);
const tag = `v${version}`;
if ((await $`git tag --list ${tag}`.text()).trim()) fail(`El tag ${tag} ya existe`);
console.log(`${pkg.version} → ${version}`);
pkg.version = version;
await Bun.write(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

const confFile = Bun.file("src-tauri/tauri.conf.json");
const conf = await confFile.json();
conf.version = version;
await Bun.write(confFile, `${JSON.stringify(conf, null, 2)}\n`);

// Solo la versión de [package] (la primera línea `version = ...` del archivo)
const cargoToml = await Bun.file("src-tauri/Cargo.toml").text();
await Bun.write("src-tauri/Cargo.toml", cargoToml.replace(/^version = "[^"]*"/m, `version = "${version}"`));

const cargoLock = await Bun.file("src-tauri/Cargo.lock").text();
await Bun.write(
  "src-tauri/Cargo.lock",
  cargoLock.replace(
    new RegExp(`(name = "${CRATE}"\\r?\\nversion = )".*"`),
    `$1"${version}"`,
  ),
);

await $`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock`;
await $`git commit -m ${`chore: versión ${version}`}`;
await $`git tag -a ${tag} -m ${tag}`;
await $`git push origin main`;
await $`git push origin ${tag}`;

console.log(`✔ Publicado ${tag}. Sigue el build en la pestaña Actions de GitHub.`);
