// Hook commit-msg (lefthook): rechaza mensajes de commit que atribuyan el trabajo a una IA
// (Co-Authored-By de Claude/Copilot/etc. o líneas tipo "Generated with ...").
const file = process.argv[2];
if (!file) {
  console.error("✖ Uso: bun scripts/check-commit-msg.ts <archivo-del-mensaje>");
  process.exit(1);
}

const AI = "claude|anthropic|copilot|openai|chatgpt|gpt|gemini|cursor|codex|\bai\b|\bia\b";
const FORBIDDEN = [
  new RegExp(`^co-authored-by:.*(${AI})`, "im"),
  new RegExp(`(generated|created|written) (with|by) .*(${AI})`, "im"),
  /noreply@anthropic\.com/i,
  /🤖/u,
];

const message = (await Bun.file(file).text())
  .split("\n")
  .filter((line) => !line.startsWith("#"))
  .join("\n");

if (FORBIDDEN.some((pattern) => pattern.test(message))) {
  console.error(
    "✖ El mensaje de commit no puede atribuir el trabajo a una IA (Co-Authored-By, 'Generated with...').",
  );
  console.error("  Quita esas líneas y vuelve a hacer el commit.");
  process.exit(1);
}
