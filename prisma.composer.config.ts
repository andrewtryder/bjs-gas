import { defineConfig as composer } from "@prisma/composer/config";
import { nextjsBuild } from "@prisma/composer/nextjs/control";
import { nodeBuild } from "@prisma/composer/node/control";
import { prismaCloud, prismaState } from "@prisma/composer-prisma-cloud/control";

// Explicit CLI 8 config: keep Prisma 6 ORM commands isolated from its marker.
export default {
  $prismaConfig: 1,
  composer: composer({
    entry: "./module.ts",
    extensions: [prismaCloud({ region: "us-east-1" }), nodeBuild(), nextjsBuild()],
    state: prismaState(),
  }),
};
