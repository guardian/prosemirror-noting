// import SharedNoteStateTracker from '../src/js/SharedNoteStateTracker';
// import NoteTracker from '../src/js/NoteTracker';

// let sharedNoteStateTracker = null;

// describe("SharedNoteStateTracker", () => {
//     beforeEach(() => {
//        sharedNoteStateTracker = new SharedNoteStateTracker();
//     });
//     it("should register attempts to stall the next cursor movement", () => {
//         sharedNoteStateTracker.requestCursorStall();
//         expect(sharedNoteStateTracker.getStallRequests()).toBe(1);
//         sharedNoteStateTracker.requestCursorStall();
//         expect(sharedNoteStateTracker.getStallRequests()).toBe(2);
//     });
//     it("should calculate the last attempted movement from the set cursor positions", () => {
//         sharedNoteStateTracker.setOldCursorPosition(4);
//         sharedNoteStateTracker.setAttemptedCursorPosition(8);
//         expect(sharedNoteStateTracker.getLastAttemptedMovement()).toBe(4)
//     });
//     it("should reset the appropriate state once all registered trackers have completed their transactions", () => {
//         new NoteTracker([], () => {}, sharedNoteStateTracker);
//         new NoteTracker([], () => {}, sharedNoteStateTracker);
//         sharedNoteStateTracker.requestCursorStall();
//         expect(sharedNoteStateTracker.getStallRequests()).toBe(1);
//         sharedNoteStateTracker.transactionCompleted();
//         sharedNoteStateTracker.transactionCompleted();
//         expect(sharedNoteStateTracker.getStallRequests()).toBe(0);
//     });
// })