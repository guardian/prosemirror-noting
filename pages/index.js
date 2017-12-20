import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { nodes, marks } from "prosemirror-schema-basic";
import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { exampleSetup, buildMenuItems } from "prosemirror-example-setup";
import { MenuItem } from "prosemirror-menu";

import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "prosemirror-example-setup/style/style.css";
import "../src/css/noting.scss";

import {
  createNoteMark,
  toggleNote,
  // setNoteMeta,
  noter
} from "../src/js/index";

const mySchema = new Schema({
  nodes,
  marks: Object.assign({}, marks, {
    note: createNoteMark(
      {
        note: "span.note"
      },
      meta => ({
        class: meta.hidden ? "note--collapsed" : "",
        title: "My Title",
        contenteditable: !meta.hidden
      })
    )
  })
});

const doc = DOMParser.fromSchema(mySchema).parse(
  document.querySelector("#content")
);

const historyPlugin = history();
const noterPlugin = noter(mySchema.marks.note, doc, historyPlugin, note => {
  note.meta = Object.assign({}, note.meta, {
    createdAt: Date.now()
  });
});

new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(mySchema).parse(
      document.querySelector("#content")
    ),
    plugins: [
      ...exampleSetup({
        schema: mySchema,
        history: false,
        menuContent: [
          ...buildMenuItems(mySchema).fullMenu,
          [
            new MenuItem({
              title: "Toggle Note",
              label: "Toggle Note",
              icon: {
                width: 512,
                height: 512,
                path:
                  "M448,0H64C46.328,0,32,14.313,32,32v448c0,17.688,14.328,32,32,32h288l128-128V32C480,14.313,465.688,0,448,0z M352,466.75  V384h82.75L352,466.75z M448,352h-96c-17.688,0-32,14.313-32,32v96H64V32h384V352z M96,112c0-8.844,7.156-16,16-16h288  c8.844,0,16,7.156,16,16s-7.156,16-16,16H112C103.156,128,96,120.844,96,112z M96,208c0-8.844,7.156-16,16-16h288  c8.844,0,16,7.156,16,16s-7.156,16-16,16H112C103.156,224,96,216.844,96,208z M96,304c0-8.844,7.156-16,16-16h288  c8.844,0,16,7.156,16,16s-7.156,16-16,16H112C103.156,320,96,312.844,96,304z"
              },
              run: toggleNote("note")
            })
          ]
        ]
      }),
      keymap({
        F10: toggleNote("note")
      }),
      historyPlugin,
      noterPlugin
    ]
  })
});
