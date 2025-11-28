#!/usr/bin/env node

import { create_cli } from "./cli.js";
import { validate } from "./commands/validate.js";
import { record } from "./commands/record.js";
import { preview } from "./commands/preview.js";
import { prepare_release } from "./commands/prepare-release.js";
import { publish_release } from "./commands/publish-release.js";

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
