import { Selection } from "prosemirror-state";
import { cloneDeep } from "./utils/helpers";
import { charsAdded, notesFromDoc } from "./utils/StateUtils";

export default class NoteTransaction {
  constructor(noteTracker, markType, key, historyPlugin) {
    this.noteTracker = noteTracker;
    this.markType = markType;
    this.key = key;
    this.historyPlugin = historyPlugin;
    this.tr = null;
    this.currentNoteID = false;
    this.sharedNoteStateTracker = noteTracker.getSharedNoteStateTracker();
  }

  static get PLACEHOLDER_ID() {
    return "@@PLACEHOLDER_ID";
  }

  get currentNote() {
    return !!this.currentNoteID && this.noteTracker.getNote(this.currentNoteID);
  }

  filterTransaction(tr, oldState) {
    this.init(tr, oldState);
    let meta;
    if ((meta = tr.getMeta("set-notes-meta")) && meta.key === this.key) {
      const { specs } = tr.getMeta("set-notes-meta");
      specs.forEach(({ id, meta }) => this.updateMeta(id, meta));
    } else if ((meta = tr.getMeta("toggle-note")) && meta.key === this.key) {
      const { type, cursorToEnd } = tr.getMeta("toggle-note");
      this.handleToggle(type, cursorToEnd, oldState);
    } else if (tr.getMeta("paste") || tr.getMeta(this.historyPlugin)) {
      this.handleChange(!!tr.getMeta(this.historyPlugin), oldState);
    } else {
      this.handleInput(oldState);
    }
    this.setCorrectMark();
    return this.tr;
  }

  appendTransaction(tr, oldState, newState) {
    // @todo -- is this the best place for this hook?
    if (this.sharedNoteStateTracker.getStallRequests()) {
      // If we haven't yet set the old cursor positions and there is cursor
      // information, store the attempted cursor movement so we can use the
      // position and direction to find notes for that range. We do this because
      // if there are multiple instances of this plugin, we only have this information
      // on the first call of appendTransaction - in subsequent calls, oldState
      // will already contain the new position information.
      if (
        !this.sharedNoteStateTracker.hasOldCursorPosition() &&
        oldState.selection.$cursor &&
        newState.selection.$cursor
      ) {
        this.sharedNoteStateTracker.setOldCursorPosition(
          oldState.selection.$cursor.pos
        );
        this.sharedNoteStateTracker.setAttemptedCursorPosition(
          newState.selection.$cursor.pos
        );
      }
      let resetStoredMarks = false;
      if (this.sharedNoteStateTracker.isAtBoundaryBetweenTouchingNotes()) {
        this.currentNoteID = false;
        resetStoredMarks = true;
      }
      this.sharedNoteStateTracker.transactionCompleted();
      if (!oldState.selection.$cursor) {
        return;
      }
      // Setting a selection will clear the transaction's stored marks, so if we'd like
      // to keep them, we must re-append them.
      const tr = newState.tr.setSelection(
        Selection.near(oldState.selection.$cursor)
      );
      return resetStoredMarks ? tr : tr.setStoredMarks(newState.storedMarks);
    }
  }

  init(tr, oldState) {
    const { noteTracker, currentNoteID } = this;
    const {
      selection: { $cursor: $oldCursor },
    } = oldState;
    const { $cursor } = tr.selection;

    /**
     * Do all the position mapping, this handle deleted notes, we only ever
     * need to add and rebuild
     */
    noteTracker.mapPositions(
      (pos, id) => tr.mapping.mapResult(pos, id === currentNoteID ? -1 : 1).pos,
      (pos, id) => tr.mapping.mapResult(pos, id === currentNoteID ? 1 : -1).pos
    );

    if (!tr.docChanged && $cursor && $oldCursor) {
      const movement = $cursor.pos - $oldCursor.pos;
      if (movement === 0) {
        // A static cursor change, e.g. selecting into text from an unfocused state.
        this.currentNoteID =
          this.currentNoteID || (noteTracker.noteAt($cursor.pos) || {}).id;
      } else if (Math.abs(movement) !== 1) {
        // A cursor change larger than 1, e.g. selecting another position from a
        // previous position.
        this.currentNoteID = (noteTracker.noteAt($cursor.pos) || {}).id;
      } else if (
        currentNoteID &&
        !noteTracker.noteAt($oldCursor.pos) &&
        (noteTracker.noteAt($oldCursor.pos + movement, -movement) || {}).id !==
          currentNoteID
      ) {
        // A move from an inclusive position to a neutral position.
        this.currentNoteID = false;
        this.sharedNoteStateTracker.requestCursorStall();
      } else if (
        !currentNoteID &&
        !noteTracker.noteAt($oldCursor.pos) &&
        noteTracker.noteAt($oldCursor.pos + movement, -movement)
      ) {
        // A move from a neutral position to an inclusive position.
        this.currentNoteID = noteTracker.noteAt(
          $oldCursor.pos + movement,
          -movement
        ).id;
        this.sharedNoteStateTracker.requestCursorStall();
      } else if (noteTracker.noteAt($cursor.pos)) {
        // A move inside of a note.
        this.currentNoteID = noteTracker.noteAt($cursor.pos).id;
      }
      // If none of these conditions are satisfied, we have a move outside of a note.
    }

    this.tr = tr;
    return this;
  }

  setCorrectMark() {
    const { tr, markType } = this;
    const { $cursor } = tr.selection;
    if ($cursor) {
      const note = this.currentNote;
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
        to: note.end,
      },
      [
        {
          from: note.start,
          to: note.end,
          id: note.id,
          meta: note.meta,
        },
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
      const note = this.currentNote;
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
          meta: cloneDeep(meta),
        });

        // If this is a not of a different type then split add it in
        // the middle
        if (note.meta.type && note.meta.type !== type) {
          notes.push({
            from,
            to,
            meta: {
              type,
            },
          });
        }

        notes.push({
          from: to,
          to: end,
          meta: cloneDeep(meta),
        });

        return this.rebuildRange(
          {
            from: start,
            to: end,
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
  handleChange(undo, oldState) {
    const { noteTracker, tr, markType } = this;
    const rebuildRange = undo
      ? noteTracker.diffRange(tr, oldState)
      : noteTracker.insertedRange(tr);

    if (rebuildRange) {
      const { from, to } = rebuildRange;
      const positions = notesFromDoc(tr.doc, markType, from, to);

      this.rebuildRange(
        rebuildRange,
        positions.map((p) => ({
          id: p.id,
          from: p.start,
          to: p.end,
          meta: p.meta,
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
      const note = this.currentNote;
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
      .filter((note) => note); // remove notes that couldn't be added

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
      this.currentNoteID = notes[notes.length - 1].id;
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
    this.currentNoteID = this.constructor.PLACEHOLDER_ID;
    return this;
  }
}
