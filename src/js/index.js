import { Plugin } from "prosemirror-state";
import NoteTracker from "./NoteTracker";
import NoteTransaction from "./NoteTransaction";
import { createDecorateNotes } from "./utils/DecorationUtils";
import clickHandler from "./clickHandler";
import { notesFromDoc } from "./utils/StateUtils";
import { createNoteMark } from "./utils/SchemaUtils";
import SharedNoteStateTracker from "./SharedNoteStateTracker";

const toggleNote = key => (type, cursorToEnd = false) => (state, dispatch) =>
  dispatch
    ? dispatch(
        state.tr.setMeta("toggle-note", {
          key,
          type,
          cursorToEnd
        })
      )
    : true;

const setNotesMeta = key => (specs = []) => (state, dispatch) =>
  dispatch
    ? dispatch(
        state.tr.setMeta("set-notes-meta", {
          key,
          specs
        })
      )
    : true;

const setNoteMeta = key => (id, meta) => setNotesMeta(key)([{ id, meta }]);

const collapseAllNotes = key => () => (state, dispatch) => {
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

  return setNotesMeta(key)(specs)(state, dispatch);
};

const showAllNotes = key => () => (state, dispatch) => {
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

  return setNotesMeta(key)(specs)(state, dispatch);
};

const toggleAllNotes = key => () => (state, dispatch) =>
  collapseAllNotes(key)()(state)
    ? collapseAllNotes(key)()(state, dispatch)
    : showAllNotes(key)()(state, dispatch);

const defaultSharedNoteStateTracker = new SharedNoteStateTracker();

let noOfNoterPlugins = 0;

/**
 * The main plugin that setups the noter
 * TODO: maybe NoteTracker could extend Plugin which would mean we could
 * use the plugin instance more normally rather than notePlugin.props.noteTracker
 */
const buildNoter = (
  markType,
  initDoc,
  key,
  historyPlugin,
  {
    onNoteCreate = () => {},
    handleClick = null,
    sharedNoteStateTracker = defaultSharedNoteStateTracker,
    // modifyNoteDecoration provides a callback that's passed a note decoration
    // element and the side that it's rendered on, to allow the consumer to
    // modify the element, e.g. add a title attribute.
    // (element: HTMLElement, side: Boolean) => void
    modifyNoteDecoration = () => {}
  }
) => {
  noOfNoterPlugins++;
  const noteTracker = new NoteTracker([], onNoteCreate, sharedNoteStateTracker);
  const noteTransaction = new NoteTransaction(
    noteTracker,
    markType,
    key,
    historyPlugin
  );
  const noteDecorator = createDecorateNotes(
    noteTransaction,
    noteTracker,
    modifyNoteDecoration,
    noOfNoterPlugins
  );

  notesFromDoc(initDoc, markType).forEach(({ start, end, meta, id }) =>
    /**
     * Pass true as fifth argument to make sure that we don't update the
     * meta in the notetracker with the onNoteCreate callback as this is NOT
     * a new note and will not be rerendered to the DOM with the new meta
     * (which it shouldn't) and will cause issues when comparing notes
     */
    noteTracker.addNote(start, end, meta, id, true)
  );

  return {
    plugin: new Plugin({
      props: {
        decorations: noteDecorator,
        handleClick: handleClick && clickHandler(noteTracker, handleClick)
      },
      filterTransaction: (...args) =>
        noteTransaction.filterTransaction(...args),
      appendTransaction: (...args) => noteTransaction.appendTransaction(...args)
    }),
    toggleNote: toggleNote(key),
    setNoteMeta: setNoteMeta(key),
    collapseAllNotes: collapseAllNotes(key),
    showAllNotes: showAllNotes(key),
    toggleAllNotes: toggleAllNotes(key)
  };
};

export { createNoteMark, buildNoter, toggleNote };
