import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * A Server Action's signature is fixed by `useActionState`: it always
       * receives the previous state and the form data, whether or not it needs
       * them. An action that takes no input still has to declare both, so the
       * leading-underscore convention this codebase already writes is made to
       * mean what it looks like it means rather than being reported as dead
       * code.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
