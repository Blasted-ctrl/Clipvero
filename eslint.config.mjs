import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  globalIgnores([
    ".next/**",
    ".tools/**",
    ".venv/**",
    ".local-services/**",
    "packages/shared-types/src/api.d.ts",
    "data/**",
    ".render/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
