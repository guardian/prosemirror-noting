import Note from "./Note";
import uuid from "uuid/v1";
import { cloneDeep } from "./utils/helpers";
import { getInsertedRanges } from "./utils/StateUtils";

const ensureType = meta => {
  if (!meta) {
    return {
      type: "note"
    };
  } else if (!meta.type) {
    return Object.assign({}, meta, {
      type: "note"
    });
  }
  return meta;
};

export default class NoteTracker {
  constructor(notes = [], onNoteCreate = () => {}, sharedNoteStateTracker) {
    if (!sharedNoteStateTracker) {
      throw new Error(
        "[prosemirror-noting]: NoteTracker must be passed an instance of SharedNoteStateTracker on construction"
      );
    }
    this.notes = notes.filter(note => !note.isEmpty);
    this.onNoteCreate = onNoteCreate;
    this.sharedNoteStateTracker = sharedNoteStateTracker;
    sharedNoteStateTracker.addNoteTracker(this);
  }

  getSharedNoteStateTracker() {
    return this.sharedNoteStateTracker;
  }

  /*
   * Writes does mutate state on this top-level object
   */

  reset() {
    this.notes = [];
  }

  sortNotes() {
    const toSort = this.notes.slice();
    toSort.sort((a, b) => a.start - b.start);
    this.notes = toSort;
  }

  addNote(from, to, _meta, id = null, ignoreCallback = false) {
    if (from >= to) {
      return false;
    }

    const meta = ensureType(_meta);
    const range = this.mergeableRange(from, to, meta.type);
    this.removeRange(range.from, range.to);
    if (!id || this.hasNoteId(id)) {
      id = this.nextId();
    }
    const note = new Note(range.from, range.to, id, meta);
    if (!ignoreCallback) {
      this.onNoteCreate(note); // may mutate the note
    }
    this.notes.push(note);
    this.sortNotes();
    return note;
  }

  removeRange(from, to) {
    let nextId = this.nextId();
    this.notes = this.notes.reduce(
      (newNotes, note) => [
        ...newNotes,
        ...note
          .rangesAround(from, to)
          .filter(({ start, end }) => end > start)
          .map(
            ({ start, end }, i, arr) =>
              new Note(
                start,
                end,
                arr.length === 1 ? note.id : nextId++,
                arr.length === 1 ? note.meta : cloneDeep(note.meta)
              )
          )
      ],
      []
    );
  }

  mapPositions(startFunc, endFunc = startFunc) {
    this.notes = this.notes
      .map(note => note.mapPositions(startFunc, endFunc))
      .filter(note => !note.isEmpty);
  }

  /**
   * Reads
   */

  getNote(noteId) {
    return this.notes.filter(({ id }) => id === noteId)[0];
  }

  nextId() {
    return uuid();
  }

  hasNoteId(noteId) {
    return !!this.getNote(noteId);
  }

  noteAt(pos, _bias = 0) {
    const bias = Math.sign(_bias);
    const range = [pos, pos + bias];
    range.sort();
    const [from, to] = range;
    return (
      this.notes.find(note => note.coversRange(from, to, bias !== 0)) || false
    );
  }

  noteCoveringRange(from, to, inside = false) {
    const { notes } = this;

    for (let i = 0; i < notes.length; i += 1) {
      const note = notes[i];
      if (note.coversRange(from, to, inside)) {
        return note;
      }
    }

    return false;
  }

  notesTouchingRange(from, to, type) {
    return this.notes.filter(
      note => (!type || note.meta.type === type) && note.touchesRange(from, to)
    );
  }

  mergeableRange(from, to, type) {
    // We filter by type to ensure that only notes of the same type are merged.
    const mergingNotes = this.notesTouchingRange(from, to, type);

    const [min, max] = mergingNotes.reduce(
      (out, { start, end }) => [Math.min(out[0], start), Math.max(out[1], end)],
      [from, to]
    );

    return {
      from: min,
      to: max
    };
  }

  rebuildRange(state) {
    let ranges = getInsertedRanges(state);

    if (!ranges.length) {
      return false;
    }

    const start = ranges.reduce(
      (acc, [from, to]) => Math.min(acc, from, to),
      Infinity
    );

    const end = ranges.reduce(
      (acc, [from, to]) => Math.max(acc, from, to),
      -Infinity
    );

    return start < end ? this.mergeableRange(start, end) : false;
  }
}
