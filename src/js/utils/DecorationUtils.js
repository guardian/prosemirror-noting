import { DecorationSet, Decoration } from "prosemirror-view";

export const MetaIdKey = Symbol("meta-id-key");

const createNoteWrapper = (
  meta,
  cursorPos,
  inside,
  pluginPriority = 1,
  modifyNoteDecoration = () => {}
) => (id, notePos, side) => {
  const cursorAtWidgetAndInsideNote = inside && cursorPos === notePos;
  // If we have a cursor at the note widget position and we're inside a note,
  // we need to ensure that other widgets don't alter its render order, so
  // we keep the sign of the side value and shrink it to ensure it keeps its
  // precedence.
  const sideToRender = cursorAtWidgetAndInsideNote
    ? side - Math.sign(side) / 2
    : 0 - side;

  // To make the order of widgets from different noting plugins stable as the caret
  // moves, we adjust the side properties by a constant derived from the plugin priority
  // (which is effectively an id).
  const sideAdjustedForPluginPriority =
    sideToRender + (pluginPriority / Number.MAX_SAFE_INTEGER) * Math.sign(side);

  // If the meta has changed, a unique key will be set to force a rerender.
  const maybeMetaKey = meta[MetaIdKey] ? `-${meta[MetaIdKey]}` : "";

  // A unique key for the widget. It must change to force a render
  // every time we'd like the cursor behaviour to change.
  const key = `${id}-${sideAdjustedForPluginPriority}${maybeMetaKey}`;

  const toDom = () => {
    const element = document.createElement("span");
    element.classList.add(
      `note-${id}`,
      `note-wrapper--${side < 0 ? "start" : "end"}`,
      `note-wrapper--${meta.type}`,
      // We apply this class to allow us to style the widget decoration
      // relative to the position of the caret. Conditionally applying
      // padding to the left or right of the widget allows us to ensure
      // that the caret, which is actually placed in the center of the
      // span in the space character, appears to the left or right of the
      // widget.
      `note-wrapper--${sideToRender >= 0 ? "left" : "right"}`
    );
    element.innerText = " ";

    // This allows the user to mutate the DOM node we've just created. Consumer beware!
    modifyNoteDecoration(element, meta, side);
    element.dataset.toggleNoteId = id;
    return element;
  };

  return Decoration.widget(notePos, toDom, {
    key,
    side: sideAdjustedForPluginPriority,
    marks: [],
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
        noteWrapper("NONE", state.selection.$cursor.pos, 1),
      ]
    : [];
};

export const createDecorateNotes = (
  noteTransaction,
  noteTracker,
  modifyNoteDecoration,
  pluginPriority
) => (state) => {
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
    ...placeholderDecos(noteTransaction, state),
  ]);
};
