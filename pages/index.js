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

const toggleNoteIcon = {
  width: 512,
  height: 512,
  path:
    "M448,0H64C46.328,0,32,14.313,32,32v448c0,17.688,14.328,32,32,32h288l128-128V32C480,14.313,465.688,0,448,0z M352,466.75  V384h82.75L352,466.75z M448,352h-96c-17.688,0-32,14.313-32,32v96H64V32h384V352z M96,112c0-8.844,7.156-16,16-16h288  c8.844,0,16,7.156,16,16s-7.156,16-16,16H112C103.156,128,96,120.844,96,112z M96,208c0-8.844,7.156-16,16-16h288  c8.844,0,16,7.156,16,16s-7.156,16-16,16H112C103.156,224,96,216.844,96,208z M96,304c0-8.844,7.156-16,16-16h288  c8.844,0,16,7.156,16,16s-7.156,16-16,16H112C103.156,320,96,312.844,96,304z"
};

const collapseNoteIcon = {
  width: 128,
  height: 121.451,
  path: `M39.637 53.63H8.69l-.01 10.105h30.945L25.68 81.865l4.468 4.46L56.07 60.41v-3.476l-25.918-25.91-4.46 4.47zm48.504 10.1h30.27l.008-10.1-30.266-.007 13.942-18.13-4.465-4.47L71.714 56.94l-.008 3.484 25.91 25.902 4.47-4.468z`
};

import { createNoteMark, buildNoter } from "../src/js/index";

const mySchema = new Schema({
  nodes,
  marks: Object.assign({}, marks, {
    note: createNoteMark("gu-note", meta => ({
      class: meta.hidden ? "note--collapsed" : "",
      title: "My Title",
      contenteditable: !meta.hidden
    })),
    flag: createNoteMark(
      {
        flag: "gu-flag",
        correct: "gu-correct"
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

const onNoteCreate = note => {
  note.meta = Object.assign({}, note.meta, {
    createdAt: Date.now()
  });
};

const historyPlugin = history();
const {
  plugin: noterPlugin,
  toggleAllNotes,
  showAllNotes,
  toggleNote,
  setNoteMeta
} = buildNoter(
  mySchema.marks.note,
  doc,
  "noter",
  historyPlugin,
  onNoteCreate,
  note =>
    setNoteMeta(note.id, {
      hidden: !note.meta.hidden
    })
);

const {
  plugin: flagPlugin,
  toggleNote: toggleFlag,
  setNoteMeta: setFlagMeta
} = buildNoter(
  mySchema.marks.flag,
  doc,
  "flagger",
  historyPlugin,
  onNoteCreate,
  note => {
    const toggleTypes = ["flag", "correct"];
    const toggleIndex = toggleTypes.indexOf(note.meta.type);
    return toggleIndex > -1
      ? setFlagMeta(note.id, {
          type: toggleTypes[1 - toggleIndex]
        })
      : null;
  }
);

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
              icon: toggleNoteIcon,
              run: toggleNote("note")
            }),
            new MenuItem({
              title: "Collapse Notes",
              icon: collapseNoteIcon,
              run: toggleAllNotes(),
              active: showAllNotes()
            })
          ]
        ]
      }),
      keymap({
        F6: toggleFlag("flag", true),
        F7: toggleFlag("correct", true),
        F10: toggleNote("note", true)
      }),
      historyPlugin,

      flagPlugin,
      noterPlugin
    ]
  })
});
