import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import eslint from "rollup-plugin-eslint";
import scss from "rollup-plugin-scss";
import babel from "rollup-plugin-babel";
import typescript from "rollup-plugin-typescript";

export default [
  {
    input: "src/js/index.ts",
    output: {
      file: "dist/noting.js",
      format: "cjs"
    },
    plugins: [
      typescript(),
      scss({
        output: "dist/noting.css"
      }),
      babel()
    ]
  },
  {
    input: "src/js/worker.ts",
    output: {
      file: "dist/worker.js",
      format: "cjs"
    },
    plugins: [typescript(), babel()]
  },
  {
    // Github pages
    input: "pages/index.ts",
    output: {
      file: "pages/dist/bundle.js",
      format: "iife",
      name: "Pages"
    },
    plugins: [
      resolve({ browser: true }),
      typescript(),
      scss({
        output: "pages/dist/styles.css"
      }),
      commonjs()
    ]
  }
];
