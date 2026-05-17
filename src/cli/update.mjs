import { spawn } from "node:child_process";

import { INSTALL_REPO } from "./constants.mjs";

function runInherited(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
    child.on("close", (code) => resolve(code || 0));
  });
}

export async function updateCli(options) {
  const ref = options.ref || "main";
  const spec = `${INSTALL_REPO}#${ref}`;
  console.log(`Updating iVista CLI from ${spec}`);
  console.log("");
  const code = await runInherited("npm", ["install", "-g", spec]);
  if (code !== 0) process.exit(code);
  console.log("");
  console.log("iVista CLI updated.");
}
