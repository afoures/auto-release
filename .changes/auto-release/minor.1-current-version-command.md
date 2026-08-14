- Add a `current-version` command

  Prints the current version of registered projects as raw, script-friendly output: `<name> <version>` per line, the bare version with `--project <name>`, or a JSON array with `--json`. 
  No decoration, so `VERSION=$(auto-release current-version --project my-app)` works.
