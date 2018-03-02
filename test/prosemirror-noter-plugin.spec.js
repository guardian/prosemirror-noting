import { builders } from "prosemirror-test-builder";
import { history } from "prosemirror-history";
import { Schema, Fragment } from "prosemirror-model";
import {
  EditorState,
  TextSelection,
  NodeSelection,
  Selection
} from "prosemirror-state";
import { nodes, marks } from "prosemirror-schema-basic";
import { TestState, removeTags } from "./helpers/prosemirror";
import { noter, createNoteMark } from "../src/js";

const noteSchema = new Schema({
  nodes: nodes,
  marks: Object.assign({}, marks, {
    note: createNoteMark(
      {
        note: "gu-note",
        flag: "gu-flag",
        correct: "gu-correct"
      },
      meta => ({
        class: meta.hidden ? "note--collapsed" : "",
        title: "Test"
      })
    )
  })
});

const build = builders(noteSchema, {
  p: {
    markType: "paragraph"
  }
});

const { doc, p } = build;

const note = (attrs = {}, content) =>
  build.note(Object.assign({}, { meta: { type: "note" } }, attrs), content);

const t = (...content) => doc(...content);

const selFor = initDoc => {
  const { a } = initDoc.tag;
  if (a !== null) {
    const $a = initDoc.resolve(a);
    if ($a.parent.inlineContent) {
      const { b } = initDoc.tag;
      const $b = b ? initDoc.resolve(b) : undefined;
      return new TextSelection($a, $b);
    } else {
      return new NodeSelection($a);
    }
  }
  return Selection.atStart(doc);
};

const initPM = initDoc => {
  const historyPlugin = history();
  const state = EditorState.create({
    doc: initDoc,
    schema: noteSchema,
    selection: selFor(initDoc),
    plugins: [
      historyPlugin,
      noter(noteSchema.marks.note, initDoc, historyPlugin)
    ]
  });
  return new TestState(state);
};

let _id = 1;
const getGetID = () => {
  _id = 1;
  return () => _id++;
};

/* Runs through ids and normalizes them as they don't really matter */
const normalizeIds = (_node, idMap = {}, getID = getGetID()) => {
  const node = _node.copy(Fragment.from(_node.content)).mark(
    _node.marks.map(({ attrs, type }) => {
      idMap[attrs.id] = idMap[attrs.id] || getID();
      return type.create({ id: idMap[attrs.id], meta: attrs.meta });
    })
  );

  const children = [];

  node.content.forEach(_child => {
    const child = normalizeIds(_child, idMap, getID);
    children.push(child);
  });

  return node.copy(Fragment.from(children));
};

const testIO = (label, _input, steps, output, undoSteps = 1) => {
  const state = initPM(_input);
  const input = removeTags(_input);

  describe(label, () => {
    it("do", () => {
      steps(state);
      expect(normalizeIds(state.doc)).toEqual(output);
    });

    it("undo", () => {
      state.undo(undoSteps);
      expect(normalizeIds(state.doc)).toEqual(input);
    });

    it("redo", () => {
      state.redo(undoSteps);
      expect(normalizeIds(state.doc)).toEqual(output);
    });
  });
};

describe("Noter Plugin", () => {
  describe("toggle note", () => {
    testIO(
      "adds a note when at a cursor then typing",
      t(p("foo<a>")),
      s => s.toggleNote().type("hi"),
      t(p("foo", note({ id: 1 }, "hi")))
    );

    testIO(
      "removes a note when at a cursor if toggled off before typing",
      t(p("foo<a>")),
      s =>
        s
          .toggleNote()
          .toggleNote()
          .type("hi"),
      t(p("foohi"))
    );

    testIO(
      "removes a note when cursor inside one",
      t(p("foo", note({ id: 1 }, "no<a>te"), "more")),
      s => s.toggleNote(),
      t(p("foonotemore"))
    );

    testIO(
      "enlarges a note when selection outside one",
      t(p("f<a>oo", note({ id: 1 }, "note"), "mo<b>re")),
      s => s.toggleNote(),
      t(p("f", note({ id: 1 }, "oonotemo"), "re"))
    );

    testIO(
      "slices a note when selection inside one",
      t(p("foo", note({ id: 1 }, "n<a>ot<b>e"), "more")),
      s => s.toggleNote(),
      t(p("foo", note({ id: 1 }, "n"), "ot", note({ id: 2 }, "e"), "more"))
    );

    testIO(
      "slices a note when selection at the front and inside",
      t(p("foo", note({ id: 1 }, "<a>not<b>e"), "more")),
      s => s.toggleNote(),
      t(p("foonot", note({ id: 1 }, "e"), "more"))
    );

    testIO(
      "slices a note when selection at the back and inside",
      t(p("foo", note({ id: 1 }, "n<a>ote<b>"), "more")),
      s => s.toggleNote(),
      t(p("foo", note({ id: 1 }, "n"), "otemore"))
    );

    testIO(
      "deletes a note when covering one",
      t(p("foo", note({ id: 1 }, "<a>note<b>"), "more")),
      s => s.toggleNote(),
      t(p("foonotemore"))
    );

    testIO(
      "merges multiple notes when covering them to the outside",
      t(
        p(
          "foo",
          note({ id: 1 }, "<a>note"),
          "bar",
          note({ id: 2 }, "note<b>"),
          "more"
        )
      ),
      s => s.toggleNote(),
      t(p("foo", note({ id: 1 }, "notebarnote"), "more"))
    );

    testIO(
      "merges multiple notes when covering them to the inside",
      t(
        p(
          "foo",
          note({ id: 1 }, "not<a>e"),
          "bar",
          note({ id: 2 }, "n<b>ote"),
          "more"
        )
      ),
      s => s.toggleNote(),
      t(p("foo", note({ id: 1 }, "notebarnote"), "more"))
    );
  });

  testIO(
    "stays inside notes with newlines",
    t(p("foo", note({ id: 1 }, "no<a>te"), "more")),
    s =>
      s
        .enter(2)
        .left()
        .type("hello"),
    t(
      p("foo", note({ id: 1 }, "no")),
      p(note({ id: 1 }, "hello")),
      p(note({ id: 1 }, "te"), "more")
    )
  );

  testIO(
    "doesn't extend note at beginning",
    t(p("foo", note({ id: 1 }, "<a>note"), "more")),
    s => s.type("bar"),
    t(p("foobar", note({ id: 1 }, "note"), "more"))
  );

  testIO(
    "does extend note at the end",
    t(p("foo", note({ id: 1 }, "note<a>"), "more")),
    s => s.type("bar"),
    t(p("foo", note({ id: 1 }, "notebar"), "more"))
  );

  testIO(
    "can handle pasting into a note",
    t(p("<a>foo<b>", note({ id: 1 }, "note"), "more")),
    s =>
      s
        .cut()
        .right()
        .paste(),
    t(p(note({ id: 1 }, "nfooote"), "more")),
    2
  );

  testIO(
    "can handle cutting and pasting a split note after it",
    t(p("foo", note({ id: 1 }, "no<a>te"), "mo<b>re")),
    s =>
      s
        .cut()
        .right()
        .paste(2),
    t(
      p(
        "foo",
        note({ id: 1 }, "no"),
        "r",
        note({ id: 2 }, "te"),
        "mo",
        note({ id: 3 }, "te"),
        "mo",
        "e"
      )
    ),
    3
  );

  testIO(
    "can handle copying and pasting a split note after it",
    t(p("foo", note({ id: 1 }, "no<a>te"), "mo<b>re")),
    s =>
      s
        .copy()
        .right(4)
        .paste(2),
    t(
      p(
        "foo",
        note({ id: 1 }, "note"),
        "mo",
        note({ id: 2 }, "te"),
        "mo",
        note({ id: 3 }, "te"),
        "more"
      )
    ),
    3
  );

  testIO(
    "can handle cutting and pasting a split note before it",
    t(p("test", note({ id: 1 }, "no<a>te"), "te<b>st")),
    s =>
      s
        .cut()
        .left(4)
        .paste(),
    t(
      p(
        "te",
        note({ id: 1 }, "te"),
        "test",
        note({ id: 2 }, "no"),
        "st"
      )
    ),
    3
  );

  testIO(
    "can handle pasting a note into a note",
    t(
      p(
        "<a>f",
        note({ id: 1 }, "o"),
        "o",
        note({ id: 2 }, "o"),
        "o<b>",
        note({ id: 3 }, "note"),
        "more"
      )
    ),
    s =>
      s
        .cut()
        .right()
        .paste(),
    t(p(note({ id: 1 }, "nfooooote"), "more")),
    2
  );

  describe("Backspace", () => {
    testIO(
      "can handle backspacing from ahead",
      t(p("foo", note({ id: 1 }, "bar"), "m<a>ore")),
      s => s.backspace(2),
      t(p("foo", note({ id: 1 }, "ba"), "ore"))
    );

    testIO(
      "can handle backspacing from inside",
      t(p("foo", note({ id: 1 }, "b<a>ar"), "more")),
      s => s.backspace(2),
      t(p("fo", note({ id: 1 }, "ar"), "more"))
    );

    testIO(
      "can handle backspacing from behind",
      t(p("foo", note({ id: 1 }, "<a>bar"), "more")),
      s => s.backspace(2),
      t(p("f", note({ id: 1 }, "bar"), "more"))
    );
  });

  describe("Delete", () => {
    testIO(
      "can handle deleting from ahead",
      t(p("foo", note({ id: 1 }, "bar<a>"), "more")),
      s => s.delete(2),
      t(p("foo", note({ id: 1 }, "bar"), "re"))
    );

    testIO(
      "can handle deleting from inside",
      t(p("foo", note({ id: 1 }, "b<a>ar"), "more")),
      s => s.delete(3),
      t(p("foo", note({ id: 1 }, "b"), "ore"))
    );

    testIO(
      "can handle deleting from behind",
      t(p("foo", note({ id: 1 }, "<a>bar"), "more")),
      s => s.delete(2),
      t(p("foo", note({ id: 1 }, "r"), "more"))
    );
  });
});
