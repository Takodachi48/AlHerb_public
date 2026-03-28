import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
    {
        ignores: ["dist", "node_modules"],
    },
    js.configs.recommended,
    {
        files: ["**/*.{js,jsx}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.es2022,
                ...globals.node,
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            "react-hooks": reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "no-console": "off",
            "no-unused-vars": "off",
            "no-undef": "off",
            "no-empty": "off",
            "no-useless-escape": "off",
            "no-useless-catch": "off",
            "react-hooks/exhaustive-deps": "off",
        },
    },
];
