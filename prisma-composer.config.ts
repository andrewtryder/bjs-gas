import { defineConfig } from "@prisma/composer/config";
import { nextjsBuild } from "@prisma/composer/nextjs/control";
import { nodeBuild } from "@prisma/composer/node/control";
import { prismaCloud, prismaState } from "@prisma/composer-prisma-cloud/control";

export default defineConfig({
  // This project predates project-level default regions. Keep deployment
  // deterministic instead of relying on the platform's "inherit" fallback.
  extensions: [
    prismaCloud({ region: "us-east-1" }),
    nodeBuild(),
    nextjsBuild(),
  ],
  state: prismaState(),
});
