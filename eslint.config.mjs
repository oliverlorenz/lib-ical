import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import checkFileEslint from "eslint-plugin-check-file";
import noOnlyTests from "eslint-plugin-no-only-tests";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
});

export default [{
    ignores: ["**/proto-types/**/*.ts"],
}, ...compat.extends("prettier"), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        "check-file": checkFileEslint,
        "no-only-tests": noOnlyTests,
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.jest,
        },

        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "module",

        parserOptions: {
            project: "tsconfig.test.json",
        },
    },

    rules: {
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/no-floating-promises": "error",

        "@typescript-eslint/explicit-member-accessibility": ["error", {
            accessibility: "explicit",

            overrides: {
                constructors: "no-public",
            },
        }],

        "no-unused-vars": "off",

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
        }],

        "check-file/filename-naming-convention": ["error", {
            "src/**/[A-Z]*.ts": "PASCAL_CASE",
        }, {
            ignoreMiddleExtensions: true,
        }],
    },
}, {
    files: ["**/*.spec.ts"],

    rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "no-only-tests/no-only-tests": "error",
    },
}];