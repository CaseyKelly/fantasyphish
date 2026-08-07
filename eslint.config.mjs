import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import jsxA11y from "eslint-plugin-jsx-a11y"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the "jsx-a11y" plugin (with a small
  // rule subset) via its own bundled copy, so re-declaring the plugin here
  // would conflict ("Cannot redefine plugin"). Only pull in the rule set
  // from jsx-a11y's own recommended config, which resolves against the
  // plugin instance next already registered.
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // This codebase nests label text a few levels deep inside icon +
      // copy wrapper divs (see NotificationSettings.tsx); the rule's
      // default depth of 2 doesn't reach it even though the label/control
      // association is otherwise valid.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 5 }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Disable React hooks rules for test files (not React code)
  {
    files: ["tests/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
])

export default eslintConfig
