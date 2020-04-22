import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { eslint } from "rollup-plugin-eslint";
import scss from "rollup-plugin-scss";
import babel from "rollup-plugin-babel";

export default [
  {
    input: "src/js/index.js",
    output: {
      file: "dist/noting.js",
      format: "cjs"
    },
    plugins: [
      scss({
        output: "dist/noting.css"
      }),
      eslint({
        exclude: ["node_modules/**"]
      }),
      babel()
    ]
  },
  {
    // Github pages
    input: "pages/index.js",
    output: {
      file: "pages/dist/bundle.js",
      format: "iife",
      name: "Pages"
    },
    plugins: [
      scss({
        output: "pages/dist/styles.css"
      }),
      eslint({
        exclude: ["node_modules/**"]
      }),
      resolve({ browser: true }),
      commonjs()
    ]
  }
];
