import { Plugin } from "prosemirror-state";
import NoteTracker from "./NoteTracker";
import NoteTransaction from "./NoteTransaction";
import { createDecorateNotes } from "./utils/DecorationUtils";
import clickHandler from "./clickHandler";
import { notesFromDoc } from "./utils/StateUtils";
import { createNoteMark } from "./utils/SchemaUtils";

const toggleNote = type => (state, dispatch) =>
  dispatch ? dispatch(state.tr.setMeta("toggle-note", type)) : true;

const setNoteMeta = (id, meta) => (state, dispatch) =>
  dispatch ? dispatch(state.tr.setMeta("set-note-meta", { id, meta })) : true;

/*
 * The main plugin that setups the noter
 * TODO: maybe NoteTracker could extend Plugin which would mean we could
 * use the plugin instance more normally rather than notePlugin.props.noteTracker
 */
const noter = (markType, initDoc, historyPlugin, onNoteCreate = () => {}) => {
  const noteTracker = new NoteTracker([], onNoteCreate);
  const noteTransaction = new NoteTransaction(
    noteTracker,
    markType,
    historyPlugin
  );
  const noteDecorator = createDecorateNotes(markType);

  notesFromDoc(initDoc, markType).forEach(({ start, end, meta, id }) =>
    /*
         * Pass true as fifth argument to make sure that we don't update the
         * meta in the notetracker with the onNoteCreate callback as this is NOT
         * a new note and will not be rerendered to the DOM with the new meta
         * (which it shouldn't) and will cause issues when comparing notes
         */
    noteTracker.addNote(start, end, meta, id, true)
  );

  return new Plugin({
    props: {
      decorations: noteDecorator,
      handleClick: clickHandler
    },
    filterTransaction: (tr, oldState) =>
      noteTransaction.filterTransaction(tr, oldState)
  });
};

export { createNoteMark, toggleNote, setNoteMeta, noter };
