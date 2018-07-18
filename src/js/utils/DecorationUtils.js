import { DecorationSet, Decoration } from "prosemirror-view";

const createNoteWrapper = (
  meta,
  cursorPos,
  inside,
  pluginPriority = 1,
  modifyNoteDecoration = () => {}
) => (id, notePos, side) => {
  const dom = document.createElement("span");

  // fixes a firefox bug that makes the decos appear selected
  const content = document.createElement("span");
  dom.appendChild(content);

  dom.classList.add(
    `note-${id}`,
    `note-wrapper--${side < 0 ? "start" : "end"}`,
    `note-wrapper--${meta.type}`
  );
  // This allows the user to mutate the DOM node we've just created. Consumer beware!
  modifyNoteDecoration(dom, side);
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
    // MAX_SAFE_INTEGER is here to order note decorations consistently across
    // plugins without imposing a (realistic) limit on the number of noting
    // plugins that can run concurrently.
    side:
      sideToRender + pluginPriority / Number.MAX_SAFE_INTEGER * Math.sign(side),
    marks: []
  });
};

const placeholderDecos = (noteTransaction, state) => {
  const type = noteTransaction.hasPlaceholder(state);
  const noteWrapper = createNoteWrapper(
    { type },
    state.selection.$cursor && state.selection.$cursor.pos,
    true
  );
  return state.selection.$cursor && type
    ? [
        noteWrapper("NONE", state.selection.$cursor.pos, -1),
        noteWrapper("NONE", state.selection.$cursor.pos, 1)
      ]
    : [];
};

export const createDecorateNotes = (
  noteTransaction,
  noteTracker,
  modifyNoteDecoration,
  pluginPriority
) => state => {
  return DecorationSet.create(state.doc, [
    ...noteTracker.notes.reduce((out, { id, start, end, meta }) => {
      const noteWrapper = createNoteWrapper(
        meta,
        state.selection.$cursor && state.selection.$cursor.pos,
        noteTransaction.currentNoteID === id,
        pluginPriority,
        modifyNoteDecoration
      );
      return [...out, noteWrapper(id, start, -1), noteWrapper(id, end, 1)];
    }, []),
    ...placeholderDecos(noteTransaction, state)
  ]);
};
