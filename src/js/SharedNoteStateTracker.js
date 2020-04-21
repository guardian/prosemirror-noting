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

  isAtBoundaryBetweenTouchingNotes() {
    // If we have two stall requests pending and there's less than two notes in the
    // position the cursor *would* have entered, we're at a boundary between two
    // touching notes. We check for two notes because this condition can also occur
    // when two different note types begin at once in the same position; in this
    // situation, we continue without a reset, or the cursor would be stuck.
    return (
      this.getStallRequests() > 1 &&
      this.notesAt(
        this.getAttemptedCursorPosition(),
        -this.getLastAttemptedMovement()
      ).length < 2
    );
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
