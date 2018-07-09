import { Plugin } from "prosemirror-state";
import NoteTracker from "./NoteTracker";
import NoteTransaction from "./NoteTransaction";
import { createDecorateNotes } from "./utils/DecorationUtils";
import clickHandler from "./clickHandler";
import { notesFromDoc } from "./utils/StateUtils";
import { createNoteMark } from "./utils/SchemaUtils";

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

/**
 * @class CurrentNoteTracker
 *
 * Registers NoteTrackers and current note selections from multiple plugins,
 * to enable us to reason about their interactions.
 */
class CurrentNoteTracker {
  constructor() {
    this.currentNotesByKey = {};
    this.noteTrackers = [];
    this.resetCounters();
  }

  /**
   * Indicate that the transaction has been completed. Once all of the noteTrackers
   * are completed, we can reset the counters.
   */
  transactionCompleted() {
    this.transactionsCompleted++;
    if (this.transactionsCompleted === this.noteTrackers.length) {
      this.resetCounters();
    }
  }

  resetCounters() {
    this.stallNextCursorMovement = 0;
    this.transactionsCompleted = 0;
    this.oldCursorPosition = 0;
    this.attemptedCursorPosition = 0;
    this.attemptedMovement = 0;
  }

  get lastAttemptedMovement() {
    return this.attemptedCursorPosition - this.oldCursorPosition;
  }

  /**
   * Add a NoteTracker instance to the state.
   *
   * @param {NoteTracker} noteTracker
   */
  addNoteTracker(noteTracker) {
    this.noteTrackers.push(noteTracker);
  }

  /**
   * Set the current note for a given key, which should correspond to the appropriate mark.
   *
   * @param {string} key
   * @param {string} currentNoteId
   */
  setCurrentNoteByKey(key, currentNoteId) {
    this.currentNotesByKey[key] = currentNoteId;
  }

  /**
   * Return the note ids for all registered noteTrackers at this position.
   *
   * @param {pos} number The cursor position.
   */
  notesAt(pos, bias) {
    return this.noteTrackers
      .map(noteTracker => noteTracker.noteAt(pos, bias))
      .filter(noteOption => !!noteOption);
  }
}

const currentNoteTracker = new CurrentNoteTracker();

/*
 * The main plugin that setups the noter
 * TODO: maybe NoteTracker could extend Plugin which would mean we could
 * use the plugin instance more normally rather than notePlugin.props.noteTracker
 */
const buildNoter = (
  markType,
  initDoc,
  key,
  historyPlugin,
  onNoteCreate = () => {},
  handleClick = null
) => {
  const noteTracker = new NoteTracker([], onNoteCreate);
  const noteTransaction = new NoteTransaction(
    noteTracker,
    markType,
    key,
    historyPlugin,
    currentNoteTracker
  );
  const noteDecorator = createDecorateNotes(noteTransaction, noteTracker);

  notesFromDoc(initDoc, markType).forEach(({ start, end, meta, id }) =>
    /*
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
