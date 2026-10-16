// Uso: bun run release <x.y.z>
// Sube la versión en package.json, tauri.conf.json y Cargo.toml/Cargo.lock,
// crea el commit "chore: versión x.y.z" y el tag vX.Y.Z, y los sube al remoto.
// El push del tag dispara el workflow de release (.github/workflows/release.yml).
import { $ } from "bun";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const CRATE = "ia-grades-loader-ui";

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const version = process.argv[2]?.replace(/^v/, "");
if (!version || !SEMVER.test(version)) fail("Uso: bun run release <x.y.z>");
const tag = `v${version}`;

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== "main") fail(`Hay que publicar desde main (rama actual: ${branch})`);
if ((await $`git status --porcelain`.text()).trim()) fail("Hay cambios sin commitear");
if ((await $`git tag --list ${tag}`.text()).trim()) fail(`El tag ${tag} ya existe`);

const pkgFile = Bun.file("package.json");
const pkg = await pkgFile.json();
if (pkg.version === version) fail(`La versión ya es ${version}`);
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
