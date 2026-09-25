# The checkpoint loop

Every planning skill ends with this loop for the checkpoint it owns.

1. Run `lb validate`. Fix every error in the files this skill wrote, and run it again, until there is no error for them. Read the warnings too: fix each one, or tell the user why it stays.
2. Run `lb gate <checkpoint>`.
   - **CLEARED** (the checkpoint is off): tell the user in two or three lines what you wrote, then run `lb status` and continue with the skill it names.
   - **BLOCKED, waiting for user approval**: show the user a short summary of the output and the file paths. Name every `open` decision that you made, so they can lock or change it. Ask: approve, or what to change?
3. When the user asks for changes: make them, set `status: draft` in each changed file, and go back to step 1.
4. When the user approves: run `lb approve <checkpoint>`. It refuses if errors came back; then fix them and ask again. After it succeeds, run `lb status` and offer the next step it names.

A later change to an approved file sets that file back to `status: draft`, and its checkpoint needs approval again.
