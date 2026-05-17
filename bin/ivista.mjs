#!/usr/bin/env node
import { main } from "../src/cli/main.mjs";

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
