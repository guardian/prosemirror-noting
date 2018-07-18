const clickHandler = (noteTracker, handleClick) => (
  { dispatch, state },
  _,
  { target }
) => {
  const { toggleNoteId } = target.dataset || {};
  const el = document.querySelector(`[data-note-id="${toggleNoteId}"]`);
  if (el) {
    const note = noteTracker.getNote(toggleNoteId);
    if (note) {
      // may be from another note mark
      const command = handleClick(note);

      if (command) {
        command(state, dispatch);
        return true;
      }
    }
  }
};

export default clickHandler;
