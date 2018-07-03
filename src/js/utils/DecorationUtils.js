import { DecorationSet, Decoration } from "prosemirror-view";

const noteWrapper = (id, pos, type, side, inside) => {
  const dom = document.createElement("span");

  // fixes a firefox bug that makes the decos appear selected
  const content = document.createElement("span");
  dom.appendChild(content);

  dom.classList.add(
    `note-${id}`,
    `note-wrapper--${side < 0 ? "start" : "end"}`,
    `note-wrapper--${type}`
  );
  dom.dataset.toggleNoteId = id;
  return Decoration.widget(pos, dom, {
    side: inside ? side : 0 - side,
    marks: []
  });
};

const placeholderDecos = (noteTransaction, state) => {
  const type = noteTransaction.hasPlaceholder(state);
  return state.selection.$cursor && type
    ? [
        noteWrapper("NONE", state.selection.$cursor.pos, type, -1, true),
        noteWrapper("NONE", state.selection.$cursor.pos, type, 1, true)
      ]
    : [];
};

export const createDecorateNotes = (noteTransaction, noteTracker) => state =>
  DecorationSet.create(state.doc, [
    ...noteTracker.notes.reduce(
      (out, { id, start, end, meta: { type } }) => [
        ...out,
        noteWrapper(id, start, type, -1, noteTransaction.insideID === id),
        noteWrapper(id, end, type, 1, noteTransaction.insideID === id)
      ],
      []
    ),
    ...placeholderDecos(noteTransaction, state)
  ]);
