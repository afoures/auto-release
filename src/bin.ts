#!/usr/bin/env node

import { create_cli } from "./lib/cli.js";
import { validate } from "./lib/commands/validate.js";
import { record } from "./lib/commands/record.js";
import { preview } from "./lib/commands/preview.js";
import { prepare_release } from "./lib/commands/prepare-release.js";
import { publish_release } from "./lib/commands/publish-release.js";

const run = create_cli({
  name: "auto-release",
  description: "Changesets-inspired release management tool",
  commands: {
    validate,
    record,
    preview,
    "prepare-release": prepare_release,
    "publish-release": publish_release,
  },
});

run();
