import { Plugin } from "prosemirror-state";
import NoteTracker from "./NoteTracker";
import NoteTransaction from "./NoteTransaction";
import { createDecorateNotes } from "./utils/DecorationUtils";
import clickHandler from "./clickHandler";
import { notesFromDoc } from "./utils/StateUtils";
import { createNoteMark } from "./utils/SchemaUtils";
import "../css/noting.scss";

const toggleNote = (type, cursorToEnd = false) => (state, dispatch) =>
  dispatch
    ? dispatch(
        state.tr.setMeta("toggle-note", {
          type,
          cursorToEnd
        })
      )
    : true;

const setNotesMeta = (specs = []) => (state, dispatch) =>
  dispatch ? dispatch(state.tr.setMeta("set-notes-meta", specs)) : true;

const setNoteMeta = (id, meta) => setNotesMeta([{ id, meta }]);

const collapseAllNotes = (state, dispatch) => {
  // @TODO: This is searching the entire doc for notes every time.
  // NoteTracker is essentially the state of the Noter plugin, in
  // order to make it act like others, and to clean this up, we
  // should be able to call noter.getState() and read the list of notes from there
  const allNotes = notesFromDoc(state.doc, state.config.schema.marks.note);
  let hidden = !allNotes.every(note => note.meta.hidden === true);

  if (!hidden) {
    return false;
  }

  const specs = allNotes.map(({ id }) => ({
    id,
    meta: {
      hidden: true
    }
  }));

  return setNotesMeta(specs)(state, dispatch);
};

const showAllNotes = (state, dispatch) => {
  const allNotes = notesFromDoc(state.doc, state.config.schema.marks.note);
  let hidden = !allNotes.every(note => note.meta.hidden === true);

  if (hidden) {
    return false;
  }

  const specs = allNotes.map(({ id }) => ({
    id,
    meta: {
      hidden: false
    }
  }));

  return setNotesMeta(specs)(state, dispatch);
};

const toggleAllNotes = (state, dispatch) =>
  collapseAllNotes(state)
    ? collapseAllNotes(state, dispatch)
    : showAllNotes(state, dispatch);

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
  const noteDecorator = createDecorateNotes(markType, noteTransaction);

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

export {
  createNoteMark,
  toggleNote,
  setNoteMeta,
  collapseAllNotes,
  showAllNotes,
  toggleAllNotes,
  noter
};
