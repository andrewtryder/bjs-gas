import nextjs from "@prisma/composer/nextjs";
import { rawHttp } from "@prisma/composer/http";
import { compute } from "@prisma/composer-prisma-cloud";
import { type } from "arktype";
import { secretString } from "@prisma/composer/arktype";

const webInput = type({
  "cartoApiKey?": secretString(),
  "honeybadgerApiKey?": secretString(),
});

export default compute({
  name: "bjsgasweb",
  deps: { api: rawHttp() },
  input: webInput,
  build: nextjs({
    module: import.meta.url,
    appDir: "..",
  }),
});
