import ValidationWorker from "../ValidationWorker";
import { validationLibrary } from "./helpers/fixtures";
import { ValidationInput, ValidationOutput } from "../validate";
import {
  VALIDATE_RESPONSE,
  VALIDATE_REQUEST,
  WorkerEvents
} from "../WorkerEvents";

(global as any).onmessage = (e: any) => {};

describe("ValidationWorker", () => {
  it("should apply the library to validations and emit an event when done", done => {
    let emitMessage = (e: any) => {};
    new ValidationWorker(
      validationLibrary,
      messageHandler => (emitMessage = messageHandler),
      (e: WorkerEvents) => {
        expect(e).toEqual({
          payload: {
            id: 1,
            validationOutputs: [
              {
                annotation: "Found 'match'",
                from: 30,
                str: "match",
                to: 35,
                type: "legal"
              },
              {
                annotation: "Found 'match'",
                from: 40,
                str: "match",
                to: 45,
                type: "legal"
              }
            ]
          },
          type: VALIDATE_RESPONSE
        });
        done();
      }
    );
    const inputs: ValidationInput[] = [
      {
        str: "example string with match",
        from: 10,
        to: 35
      },
      {
        str: "example string with match also",
        from: 20,
        to: 50
      }
    ];
    emitMessage({
      data: {
        type: VALIDATE_REQUEST,
        payload: {
          id: 1,
          validationInput: inputs
        }
      }
    });
    expect.assertions(1);
  });
  it("should cancel those parts of the current validation inputs that are superseded by subsequent validations", done => {
    let emitMessage = (e: any) => {};
    let eventNo = 0;
    const expectedEvents = [
      {
        type: VALIDATE_RESPONSE,
        payload: {
          id: 1,
          validationOutputs: []
        }
      },
      {
        payload: {
          id: 1,
          validationOutputs: [
            {
              annotation: "Found 'match'",
              from: 30,
              str: "match",
              to: 35,
              type: "legal"
            },
            {
              annotation: "Found 'match'",
              from: 40,
              str: "match",
              to: 45,
              type: "legal"
            }
          ]
        },
        type: VALIDATE_RESPONSE
      }
    ];
    new ValidationWorker(
      validationLibrary,
      messageHandler => (emitMessage = messageHandler),
      (e: WorkerEvents) => {
        expect(e).toEqual(expectedEvents[eventNo]);
        eventNo++;
        if (eventNo === 1) {
          done();
        }
      }
    );
    const inputs: ValidationInput[] = [
      {
        str: "example string with match",
        from: 10,
        to: 35
      },
      {
        str: "example string with match also",
        from: 20,
        to: 50
      }
    ];
    emitMessage({
      data: {
        type: VALIDATE_REQUEST,
        payload: {
          id: 1,
          validationInput: inputs
        }
      }
    });
    // The same ranges should completely invalidate the
    // first validation event.
    emitMessage({
      data: {
        type: VALIDATE_REQUEST,
        payload: {
          id: 1,
          validationInput: inputs
        }
      }
    });
    expect.assertions(2);
  });
});
