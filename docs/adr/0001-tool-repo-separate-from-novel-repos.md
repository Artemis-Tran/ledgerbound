# The tool is a plugin; each novel is its own repo

Ledgerbound (skills, CLI, default guidelines) is a Claude Code plugin in this repo. Each novel is a separate git repo that uses the plugin and keeps its own copy of `guidelines/writing.md`, which it can change. We chose this so that a novel's git history shows only story changes and the tool can get updates without a change to the novels. The test novel is a fixture in `examples/`.
