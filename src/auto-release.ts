#!/usr/bin/env node

import { create_cli } from "./cli.js";
import { validate } from "./commands/validate.js";
import { record } from "./commands/record.js";
import { preview } from "./commands/preview.js";
import { release } from "./commands/release.js";
import { deploy } from "./commands/deploy.js";

const run = create_cli({
  name: "auto-release",
  description: "Changesets-inspired release management tool",
  commands: {
    validate,
    record,
    preview,
    release,
    deploy,
  },
});

run();
