import NoteTracker from "../src/js/NoteTracker";

const getNoteRanges = notes => notes.map(({ start, end }) => [start, end]);

describe("NoteTracker", () => {
  let noteTracker;

  beforeEach(() => {
    noteTracker = new NoteTracker();
  });

  describe("addNote", () => {
    it("adds notes correctly", () => {
      const start = 5;
      const end = 7;

      const note = noteTracker.addNote(start, end);
      noteTracker.addNote(8, 11);

      expect(noteTracker.notes).toHaveLength(2);
      expect(note.start).toBe(start);
      expect(note.end).toBe(end);
    });

    it("accepts custom ids", () => {
      const id = 975;

      const note = noteTracker.addNote(5, 7, {}, id);
      const foundNote = noteTracker.noteAt(6);

      expect(note.id).toBe(id);
      expect(foundNote.id).toBe(id);
    });

    it("merges added notes", () => {
      noteTracker.addNote(10, 15);
      noteTracker.addNote(14, 23);

      expect(noteTracker.notes).toHaveLength(1);

      expect(getNoteRanges(noteTracker.notes)).toEqual([[10, 23]]);
    });

    it("swallows notes that are added in the middle of a note", () => {
      noteTracker.addNote(2, 20);
      noteTracker.addNote(3, 5);
      noteTracker.addNote(7, 9);
      noteTracker.addNote(12, 20);

      const firstNote = noteTracker.noteAt(2, true);

      expect(noteTracker.notes).toHaveLength(1);
      expect(firstNote.start).toBe(2);
      expect(firstNote.end).toBe(20);
    });

    it("doesn't add invalid notes", () => {
      const note1 = noteTracker.addNote(10, 9);

      expect(note1).toBe(false);
      expect(noteTracker.notes).toHaveLength(0);
    });

    it("keeps ids when specifying them", () => {
      noteTracker.addNote(2, 4, {}, 1);
      noteTracker.addNote(6, 8, {}, 2);
      noteTracker.addNote(10, 12, {}, 3);
      noteTracker.addNote(14, 16, {}, 4);

      expect(noteTracker.notes.map(({ id }) => id)).toEqual([1, 2, 3, 4]);
    });
  });

  describe("removeRange", () => {
    beforeEach(() => {
      noteTracker.addNote(5, 10);
      noteTracker.addNote(15, 20);
      noteTracker.addNote(25, 30);
    });

    it("removes all notes inside it's area", () => {
      noteTracker.removeRange(0, 50);

      expect(noteTracker.notes).toHaveLength(0);
    });

    it("splits notes it overlaps", () => {
      noteTracker.removeRange(8, 28);

      expect(noteTracker.notes).toHaveLength(2);

      // This expects noteTracker.notes to put notes in ascending order
      // this need not be guaranteed
      expect(getNoteRanges(noteTracker.notes)).toEqual([[5, 8], [28, 30]]);
    });
  });

  describe("noteAt", () => {
    it("correctly gets the note for a given position", () => {
      const note1 = noteTracker.addNote(3, 7);
      const note2 = noteTracker.addNote(11, 15);

      expect(noteTracker.noteAt(3)).toBe(false);
      expect(noteTracker.noteAt(3, true).eq(note1)).toBe(true);
      expect(noteTracker.noteAt(14).eq(note2)).toBe(true);
      expect(noteTracker.noteAt(16)).toBe(false);
      expect(noteTracker.noteAt(19)).toBe(false);
    });
  });

  describe("reset", () => {
    it("correctly removes all the notes", () => {
      noteTracker.addNote(3, 7);
      noteTracker.addNote(11, 15);
      noteTracker.reset();

      expect(noteTracker.notes).toHaveLength(0);
    });
  });

  describe("mapPositions", () => {
    it("correctly maps positions", () => {
      noteTracker.addNote(5, 7);
      noteTracker.addNote(11, 19);
      noteTracker.mapPositions(pos => pos + 1);

      expect(getNoteRanges(noteTracker.notes)).toEqual([[6, 8], [12, 20]]);
    });

    it("correctly removes 0 length notes", () => {
      noteTracker.addNote(5, 7);
      noteTracker.addNote(11, 19);
      noteTracker.mapPositions(pos => (pos < 9 ? 5 : pos));

      expect(getNoteRanges(noteTracker.notes)).toEqual([[11, 19]]);
    });

    it("correctly shrinks notes", () => {
      noteTracker.addNote(3, 8);
      noteTracker.addNote(11, 19);
      noteTracker.mapPositions(pos => Math.max(pos, 5));

      expect(getNoteRanges(noteTracker.notes)).toEqual([[5, 8], [11, 19]]);
    });
  });
});
