import { type } from "arktype";
import { secretString } from "@prisma/composer/arktype";
import node from "@prisma/composer/node";
import { compute, rawPostgres } from "@prisma/composer-prisma-cloud";
import { triggerContract } from "@prisma/composer-prisma-cloud/cron";

const apiInput = type({
  collectorSecret: secretString(),
  "honeybadgerApiKey?": secretString(),
});

export default compute({
  name: "bjsgasapi",
  deps: { db: rawPostgres() },
  input: apiInput,
  expose: { trigger: triggerContract },
  // Ship the whole dist/ tree (server.mjs + Linux query engine).
  build: node({
    module: import.meta.url,
    dir: "../dist",
    entry: "server.mjs",
  }),
});
