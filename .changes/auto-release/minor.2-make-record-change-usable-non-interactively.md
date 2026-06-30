Make `record-change` usable non-interactively

Add a `--content` flag that writes the change body directly and skips the editor, plus an optional `--slug` flag. When stdin is not a TTY (or in CI), missing required input now errors clearly instead of hanging. This lets scripts and AI agents record changes in a single command.