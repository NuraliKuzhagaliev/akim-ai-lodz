// Uses the real frontend Zod schemas without editing frontend files.
// Run from repository root after installing frontend dependencies.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const frontend = path.resolve(process.argv[2] ?? path.join(root, "frontend"));
const require = createRequire(path.join(frontend, "package.json"));
const ts = require("typescript");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "akim-contract-"));
try {
  for (const name of ["types", "ai-contract"]) {
    let code = ts.transpileModule(
      fs.readFileSync(path.join(frontend, "lib", `${name}.ts`), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      },
    ).outputText;
    code = code.replace(
      /from ['"]zod['"]/,
      `from ${JSON.stringify(pathToFileURL(require.resolve("zod")).href)}`,
    );
    fs.writeFileSync(path.join(temporary, `${name}.mjs`), code);
  }
  const schemas = await import(
    pathToFileURL(path.join(temporary, "types.mjs"))
  );
  const ai = await import(
    pathToFileURL(path.join(temporary, "ai-contract.mjs"))
  );
  const read = (name) =>
    JSON.parse(
      fs.readFileSync(path.join(root, "shared/fixtures", name), "utf8"),
    );
  const result = schemas.simulationSchema.parse(read("official-result.json"));
  const measures = schemas.measuresSchema.parse(read("measures.json"));
  schemas.districtsSchema.parse(read("districts.json"));
  for (const file of ["preview.json", "invalid-result.json"])
    schemas.simulationSchema.parse(read(file));
  schemas.recommendationSchema.parse(read("recommendation.json"));
  const request = ai.createAnalysisRequest(result, measures);
  if (request.scenario.decisions.length !== 5)
    throw new Error("Unexpected AI request shape");
  // The Python integration test consumes this exact frontend payload and writes its response.
  // Keep both outside the repository (e.g. RUNNER_TEMP), never in committed fixtures.
  if (process.env.AKIM_FRONTEND_REQUEST) {
    const requestPath = path.resolve(process.env.AKIM_FRONTEND_REQUEST);
    fs.mkdirSync(path.dirname(requestPath), { recursive: true });
    fs.writeFileSync(requestPath, JSON.stringify(request), "utf8");
    const responsePath = path.join(
      path.dirname(requestPath),
      "ai-response.json",
    );
    if (fs.existsSync(responsePath)) {
      const response = ai.aiResponseSchema.parse(
        JSON.parse(fs.readFileSync(responsePath, "utf8")),
      );
      const normalized = ai.normalizeAnalysis(response);
      if (normalized.source !== "ai")
        throw new Error("Unexpected normalized AI source");
      console.log(
        "PASS: actual FastAPI response satisfies frontend AI schema and normalizer.",
      );
    }
  }
  console.log(
    "PASS: six engine fixtures satisfy the real frontend schemas; AI request adapter works.",
  );
} finally {
  if (
    path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) ||
    !path.basename(temporary).startsWith("akim-contract-")
  ) {
    throw new Error(
      "Refusing cleanup outside the specific temporary directory.",
    );
  }
  fs.rmSync(temporary, { recursive: true, force: true });
}
