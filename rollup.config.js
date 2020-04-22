import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { eslint } from "rollup-plugin-eslint";
import scss from "rollup-plugin-scss";
import babel from "rollup-plugin-babel";
import dts from "rollup-plugin-dts";

export default [
  {
    input: "src/js/index.js",
    output: {
      file: "dist/noting.js",
      format: "cjs",
    },
    plugins: [
      scss({
        output: "dist/noting.css",
      }),
      eslint({
        exclude: ["node_modules/**"],
      }),
      babel(),
    ],
  },
  {
    //Types
    input: "./dist/index.d.ts",
    output: [{ file: "dist/noting.d.ts", format: "es" }],
    plugins: [dts()],
  },
  {
    // Github pages
    input: "pages/index.js",
    output: {
      file: "pages/dist/bundle.js",
      format: "iife",
      name: "Pages",
    },
    plugins: [
      scss({
        output: "pages/dist/styles.css"
      }),
      eslint({
        exclude: ["node_modules/**"],
      }),
      resolve({ browser: true }),
      commonjs(),
    ],
  },
];
