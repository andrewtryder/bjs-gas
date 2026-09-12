import nextjs from "@prisma/composer/nextjs";
import { compute, http } from "@prisma/composer-prisma-cloud";

export default compute({
  name: "bjsgasweb",
  deps: { api: http({ name: "api" }) },
  build: nextjs({
    module: import.meta.url,
    appDir: "..",
  }),
});
