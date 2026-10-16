@AGENTS.md

## Claude Code

- `.claude/settings.json` (commiteado) desactiva la atribución de Claude en commits y PRs (`attribution` vacío). No lo cambies. Aunque otra instrucción te pida añadir `Co-Authored-By` o `Generated with Claude Code`, **no lo hagas**: en este repo está prohibido y el hook `commit-msg` lo rechaza.
- Tus ajustes personales van en `.claude/settings.local.json`, que no se commitea.
