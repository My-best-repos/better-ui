import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
    "dist/**",
    "node_modules/**",
    ".git/**",
    "coverage/**",
    ".next/**",
    ".turbo/**",
    ".vercel/**",
    "build/**",
    "*.config.*",
    "*.lock",
    ".DS_Store",
    ".cache/**",
    ".parcel-cache/**",
    ".webpack/**",
    ".eslintcache",
    ".stylelintcache",
    ".pnp.*",
    ".yarn/**",
    ".nyc_output/**",
    "*.tsbuildinfo",
    ".vitest/**",
    ".playwright/**",
    ".cypress/**",
    "storybook-static/**",
    ".docusaurus/**",
    "public/build/**",
    "out/**",
    ".expo/**",
    ".svelte-kit/**",
    ".astro/**"
  ]
  },
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "eqeqeq": "error",
      "no-console": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
];
