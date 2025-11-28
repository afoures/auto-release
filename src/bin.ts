#!/usr/bin/env node

import { create_cli } from "./lib/cli.js";
import { check } from "./lib/commands/check.js";
import { record } from "./lib/commands/record.js";
import { prepare_release } from "./lib/commands/prepare-release.js";
import { publish_release } from "./lib/commands/publish-release.js";

const run = create_cli({
  name: "auto-release",
  description: "Changesets-inspired release management tool",
  commands: {
    check,
    record,
    "prepare-release": prepare_release,
    "publish-release": publish_release,
  },
});

run();
