import { DecorationSet, Decoration } from "prosemirror-view";

const noteWrapper = (id, notePos, cursorPos, type, side, inside) => {
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
  const cursorAtWidgetAndInsideNote = inside && cursorPos === notePos;
  // If we have a cursor at the note widget position and we're inside a note,
  // we need to ensure that other widgets don't alter its render order, so
  // we keep the sign of the side value and shrink it to ensure it keeps its
  // precedence.
  const sideToRender = cursorAtWidgetAndInsideNote
    ? side - Math.sign(side) / 2
    : 0 - side;
  return Decoration.widget(notePos, dom, {
    side: sideToRender,
    marks: []
  });
};

const placeholderDecos = (noteTransaction, state) => {
  const type = noteTransaction.hasPlaceholder(state);
  return state.selection.$cursor && type
    ? [
        noteWrapper(
          "NONE",
          state.selection.$cursor.pos,
          state.selection.$cursor.pos,
          type,
          -1,
          true
        ),
        noteWrapper(
          "NONE",
          state.selection.$cursor.pos,
          state.selection.$cursor.pos,
          type,
          1,
          true
        )
      ]
    : [];
};

export const createDecorateNotes = (noteTransaction, noteTracker) => state =>
  DecorationSet.create(state.doc, [
    ...noteTracker.notes.reduce(
      (out, { id, start, end, meta: { type } }) => [
        ...out,
        noteWrapper(
          id,
          start,
          state.selection.$cursor && state.selection.$cursor.pos,
          type,
          -1,
          noteTransaction.currentNoteID === id
        ),
        noteWrapper(
          id,
          end,
          state.selection.$cursor && state.selection.$cursor.pos,
          type,
          1,
          noteTransaction.currentNoteID === id
        )
      ],
      []
    ),
    ...placeholderDecos(noteTransaction, state)
  ]);
