/**
 * @class CurrentNoteTracker
 *
 * Registers NoteTrackers and current note selections from multiple plugins,
 * to enable us to reason about their interactions.
 */
class SharedNoteStateTracker {
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
    this.stallRequests = 0;
    this.transactionsCompleted = 0;
    this.oldCursorPosition = null;
    this.attemptedCursorPosition = null;
  }

  hasOldCursorPosition() {
    return this.oldCursorPosition !== null;
  }

  setOldCursorPosition(pos) {
    this.oldCursorPosition = pos;
  }

  setAttemptedCursorPosition(pos) {
    this.attemptedCursorPosition = pos;
  }

  getAttemptedCursorPosition() {
    return this.attemptedCursorPosition;
  }

  getLastAttemptedMovement() {
    return this.attemptedCursorPosition - this.oldCursorPosition;
  }

  getStallRequests() {
    return this.stallRequests;
  }

  /**
   * Register an attempt to stall the next cursor movement.
   */
  requestCursorStall() {
    this.stallRequests++;
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
   * Return the note ids for all registered noteTrackers at this position.
   *
   * @param {number} pos The cursor position.
   * @param {number} bias Bias the selected range forward (+), backward (-) or address a point with 0.
   */
  notesAt(pos, bias = 0) {
    return this.noteTrackers
      .map(noteTracker => noteTracker.noteAt(pos, bias))
      .filter(noteOption => !!noteOption);
  }
}

export default SharedNoteStateTracker;
