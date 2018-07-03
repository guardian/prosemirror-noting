import { Selection } from "prosemirror-state";
import { cloneDeep } from "./utils/helpers";
import { charsAdded, notesFromDoc } from "./utils/StateUtils";

export default class NoteTransaction {
  constructor(noteTracker, markType, historyPlugin) {
    this.noteTracker = noteTracker;
    this.markType = markType;
    this.historyPlugin = historyPlugin;
    this.tr = null;
    this.insideID = false;
  }

  static get PLACEHOLDER_ID() {
    return "@@PLACEHOLDER_ID";
  }

  get insideNote() {
    return !!this.insideID && this.noteTracker.getNote(this.insideID);
  }

  filterTransaction(tr, oldState) {
    this.init(tr, oldState);
    if (tr.getMeta("set-notes-meta")) {
      const specs = tr.getMeta("set-notes-meta");
      specs.forEach(({ id, meta }) => this.updateMeta(id, meta));
    } else if (tr.getMeta("toggle-note")) {
      const { type, cursorToEnd } = tr.getMeta("toggle-note");
      this.handleToggle(type, cursorToEnd, oldState);
    } else if (tr.getMeta("paste") || tr.getMeta(this.historyPlugin)) {
      this.handlePaste(oldState);
    } else {
      this.handleInput(oldState);
    }
    this.setCorrectMark();
    return this.tr;
  }

  init(tr, oldState) {
    const { noteTracker, insideID } = this;
    const { selection: { $cursor: $oldCursor } } = oldState;
    const { $cursor } = tr.selection;

    /**
     * Do all the position mapping, this handle deleted notes, we only ever
     * need to add and rebuild
     */
    noteTracker.mapPositions(
      (pos, id) => tr.mapping.mapResult(pos, id === insideID ? -1 : 1).pos,
      (pos, id) => tr.mapping.mapResult(pos, id === insideID ? 1 : -1).pos
    );

    if (!tr.docChanged && $cursor && $oldCursor) {
      const movement = $cursor.pos - $oldCursor.pos;
      if (movement === 0) {
        this.insideID =
          this.insideID || (noteTracker.noteAt($cursor.pos) || {}).id;
      } else if (Math.abs(movement) !== 1) {
        this.insideID = (noteTracker.noteAt($cursor.pos) || {}).id;
      } else if (
        insideID &&
        !noteTracker.noteAt($oldCursor.pos) &&
        (noteTracker.noteAt($oldCursor.pos + movement, -movement) || {}).id !==
          insideID
      ) {
        // We're moving from an inclusive position to a neutral position.
        console.log("outside but inclusive, moving neutral");
        this.insideID = false;
        tr.setSelection(Selection.near($oldCursor));
      } else if (
        !insideID &&
        !noteTracker.noteAt($oldCursor.pos) &&
        noteTracker.noteAt($oldCursor.pos + movement, -movement)
      ) {
        // We're moving from a neutral position to an inclusive position.
        console.log("neutral, moving outside inclusive");
        this.insideID = noteTracker.noteAt(
          $oldCursor.pos + movement,
          -movement
        ).id;
        tr.setSelection(Selection.near($oldCursor));
      } else if (noteTracker.noteAt($cursor.pos)) {
        console.log("inside a note");
        this.insideID = noteTracker.noteAt($cursor.pos).id;
      }

      // if (
      //   !inside &&
      //   (note = noteTracker.movingIntoNote($oldCursor.pos, $cursor.pos, false))
      // ) {
      //   console.log("moving in", note);
      //   tr.setSelection(Selection.near($oldCursor));
      //   this.inside = note.id;
      // } else if (
      //   (note = noteTracker.movingOutOfNote($oldCursor.pos, $cursor.pos, true)) &&
      //   inside === note.id
      // ) {
      //   console.log("moving out", note);
      //   tr.setSelection(Selection.near($oldCursor));
      //   this.inside = false;
      // }
    }

    this.tr = tr;
    return this;
  }

  setCorrectMark() {
    const { tr, markType } = this;
    const { $cursor } = tr.selection;
    if ($cursor) {
      const note = this.insideNote;
      if (note) {
        const { id, meta } = note;
        const newMark = markType.create({ id, meta });
        if (!newMark.isInSet(tr.storedMarks || $cursor.marks())) {
          this.tr = tr.addStoredMark(newMark);
        }
      } else if (!this.hasPlaceholder(this.tr)) {
        this.tr = tr.removeStoredMark(markType);
      }
    }
    return this;
  }

  updateMeta(id, meta = {}) {
    const note = this.noteTracker.getNote(id);
    if (!note) {
      return;
    }
    note.updateMeta(meta);
    this.rebuildRange(
      {
        from: note.start,
        to: note.end
      },
      [
        {
          from: note.start,
          to: note.end,
          id: note.id,
          meta: note.meta
        }
      ]
    );
    return this;
  }

  /*
     * If we are pressing the menu button then if we have a cursor
     * and are in a note then remove that note otherwise set a placeholder
     * to start a note.
     *
     * If we have a selection decide whether to grow the note or slice it
     */
  handleToggle(type, cursorToEnd, oldState) {
    const { noteTracker, tr, markType } = this;
    const { $cursor, from, to } = tr.selection;

    if ($cursor) {
      const note = this.insideNote;
      if (note) {
        const { start, end } = note;
        return this.removeRanges([{ from: start, to: end }]);
      } else if (this.hasPlaceholder(oldState)) {
        return tr.removeStoredMark(markType);
      }
      return this.startNote(type);
    } else {
      const note = noteTracker.noteCoveringRange(from, to, true);
      if (note) {
        const { start, end, meta } = note;

        const notes = [];
        notes.push({
          from: start,
          to: from,
          meta: cloneDeep(meta)
        });

        // If this is a not of a different type then split add it in
        // the middle
        if (note.meta.type && note.meta.type !== type) {
          notes.push({
            from,
            to,
            meta: {
              type
            }
          });
        }

        notes.push({
          from: to,
          to: end,
          meta: cloneDeep(meta)
        });

        return this.rebuildRange(
          {
            from: start,
            to: end
          },
          notes
        );
      }
      return this.addNotes([{ from, to, meta: { type } }], cursorToEnd);
    }
  }

  /*
     * If we are pasting or undoing gather the extent of the new content
     * find any notes overlapping this range, and from this get the max
     * range to edit.
     *
     * Then rebuild this range my removing all the notes and adding them
     * back in
     */
  handlePaste(oldState) {
    const { noteTracker, tr, markType } = this;
    const rebuildRange = noteTracker.rebuildRange(oldState, tr);

    if (rebuildRange) {
      const { from, to } = rebuildRange;
      const positions = notesFromDoc(tr.doc, markType, from, to);

      this.rebuildRange(
        rebuildRange,
        positions.map(p => ({
          id: p.id,
          from: p.start,
          to: p.end,
          meta: p.meta
        }))
      );

      return this;
    }

    // Else if rebuildRange is false, mappingPositions will handle removal

    return this;
  }

  /*
     * Otherwise if we just have a cursor and this is a normal typing
     * type update then check whether we need to add a note from a
     * placeholder
     */
  handleInput(oldState) {
    const { tr } = this;
    const { $cursor } = tr.selection;
    if ($cursor) {
      const { pos } = $cursor;
      const type = this.hasPlaceholder(oldState);
      const note = this.insideNote;
      if (!note && type) {
        const addedChars = charsAdded(oldState, tr);

        if (addedChars > 0) {
          const from = pos - addedChars;
          const to = pos;
          return this.addNotes([{ from, to, meta: { type } }], false, true);
        }
      }
    }

    return this;
  }

  placeholder(type) {
    const { PLACEHOLDER_ID } = this.constructor;
    return this.markType.create({ id: PLACEHOLDER_ID, meta: { type } });
  }

  hasPlaceholder(state) {
    const mark = this.markType.isInSet(state.storedMarks || []);
    return mark && mark.attrs.id === this.constructor.PLACEHOLDER_ID
      ? mark.attrs.meta.type
      : false;
  }

  rebuildRange(range, noteRanges) {
    return this.removeRanges([range]).addNotes(noteRanges);
  }

  addNotes(ranges, cursorToEnd = false, insideLast = false) {
    const { tr, noteTracker, markType } = this;
    const notes = ranges
      .map(({ from, to, meta, id }) => noteTracker.addNote(from, to, meta, id))
      .filter(note => note); // remove notes that couldn't be added

    this.tr = notes.reduce((_tr, { id, meta, start, end }) => {
      const newMark = markType.create({ id, meta });
      return _tr.removeMark(start, end, markType).addMark(start, end, newMark);
    }, tr);

    if (cursorToEnd && ranges.length) {
      const { to } = ranges[ranges.length - 1];
      const { end } = noteTracker.noteAt(to, -1);
      const $end = this.tr.doc.resolve(end);
      this.tr = this.tr.setSelection(Selection.near($end), 1);
    } else if (insideLast && notes.length) {
      this.insideID = notes[notes.length - 1].id;
    }

    return this;
  }

  removeRanges(ranges) {
    const { tr, noteTracker, markType } = this;
    this.tr = ranges.reduce((_tr, { from, to }) => {
      noteTracker.removeRange(from, to);
      return _tr.removeMark(from, to, markType);
    }, tr);
    return this;
  }

  startNote(type) {
    this.tr = this.tr.addStoredMark(this.placeholder(type));
    this.insideID = this.constructor.PLACEHOLDER_ID;
    return this;
  }
}
