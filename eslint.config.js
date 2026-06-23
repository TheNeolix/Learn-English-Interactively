// ESLint configuration for linting JavaScript files in the project.
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        API_URL: "readonly",
        userProgress: "writable",
        saveUserProgress: "readonly",
        renderQuestModalContent: "readonly",
        addXP: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-undef": "warn",
      "no-unreachable": "warn",
      "no-empty": "warn"
    }
  }
];
