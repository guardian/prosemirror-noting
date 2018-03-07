import Note from "./Note";
import uuid from "uuid/v1";
import { cloneDeep } from "./utils/helpers";

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
  constructor(notes = [], onNoteCreate = () => {}) {
    this.notes = notes.filter(note => !note.isEmpty);
    this.onNoteCreate = onNoteCreate;
  }

  /*
     * Writes does mutate state on this top-level object
     */

  reset() {
    this.notes = [];
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

  /*
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

  noteAt(pos, inside = false) {
    const { notes } = this;

    for (let i = 0; i < notes.length; i += 1) {
      const note = notes[i];
      if (note.containsPosition(pos, inside)) {
        return note;
      }
    }

    return false;
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

  notesTouchingRange(from, to) {
    return this.notes.filter(note => note.touchesRange(from, to));
  }

  mergeableRange(from, to) {
    const mergingNotes = this.notesTouchingRange(from, to);

    const [min, max] = mergingNotes.reduce(
      (out, { start, end }) => [Math.min(out[0], start), Math.max(out[1], end)],
      [from, to]
    );

    return {
      from: min,
      to: max
    };
  }

  rebuildRange(oldState, state) {
    const start = oldState.doc.content.findDiffStart(state.doc.content);

    if (start) {
      const end = oldState.doc.content.findDiffEnd(state.doc.content).b;
      if (start < end) {
        return this.mergeableRange(start, end);
      } else if (oldState.doc.nodeSize < state.doc.nodeSize) {
        // make sure we're over-zealous with our rebuild size
        const diff = state.doc.nodeSize - oldState.doc.nodeSize;
        return this.mergeableRange(start, start + diff);
      }
    }
    return false;
  }
}
