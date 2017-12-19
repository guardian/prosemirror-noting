import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { nodes, marks } from "prosemirror-schema-basic";
import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { exampleSetup } from "prosemirror-example-setup";
import {
  createNoteMark,
  toggleNote,
  setNoteMeta,
  noter
} from "../../src/js/index";

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

const view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(mySchema).parse(
      document.querySelector("#content")
    ),
    plugins: [
      ...exampleSetup({
        schema: mySchema,
        history: false
      }),
      keymap({
        F10: toggleNote("note")
      }),
      historyPlugin,
      noterPlugin
    ]
  })
});
