// Uso (en CI): bun scripts/set-version.ts <x.y.z>
// Escribe la versión del tag en package.json, tauri.conf.json y Cargo.toml antes de compilar.
// En el repo la versión se queda fija en 0.0.1 (Android no admite 0.0.0):
// la fuente de verdad son los tags vX.Y.Z.
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("✖ Uso: bun scripts/set-version.ts <x.y.z>");
  process.exit(1);
}

for (const path of ["package.json", "src-tauri/tauri.conf.json"]) {
  const json = await Bun.file(path).json();
  json.version = version;
  await Bun.write(path, `${JSON.stringify(json, null, 2)}\n`);
}

// Solo la versión de [package] (la primera línea `version = ...` del archivo)
const cargoToml = await Bun.file("src-tauri/Cargo.toml").text();
await Bun.write(
  "src-tauri/Cargo.toml",
  cargoToml.replace(/^version = "[^"]*"/m, `version = "${version}"`),
);

console.log(`Versión ${version}`);
