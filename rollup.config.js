import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import eslint from "rollup-plugin-eslint";

// TODO: make this less generic, stuff is getting run twice
const createConfig = (input, file, name) => ({
  input,
  output: {
    file,
    format: name ? "iife" : "cjs",
    name
  },
  plugins: [
    eslint({
      exclude: ["node_modules/**", "dist/**", "test/**"],
      include: ["test/**/*.spec.js"]
    }),
    resolve({ browser: true }),
    commonjs()
  ]
});

export default [
  createConfig("src/js/index.js", "dist/noting.js"),
  createConfig("test/visual/index.js", "test/visual/bundle.js", "TestVisual")
];
