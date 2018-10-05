import {
  VALIDATE_REQUEST,
  VALIDATE_RESPONSE,
  CANCEL_REQUEST,
  CANCEL_RESPONSE,
  WorkerEvents
} from "./WorkerEvents";
import { ValidationInput } from "./validate";
import ValidationStateManager, {
  RunningWorkerValidation
} from "./ValidationStateManager";
import { applyLibraryToValidationMapCancelable } from "./validate";
import { ValidationLibrary, Operations } from "./validate";
import chunk from "lodash/chunk";
import { MarkTypes } from "./utils/prosemirror";
import { Range } from ".";

// A temporary validation library
const withoutIndex = <T>(arr: Array<T>, index: number) =>
  arr.slice(0, index).concat(arr.slice(index + 1));

const permutations: <T>(seq: Array<T>) => T[][] = seq =>
  seq.reduce((acc, el, index, arr) => {
    if (!arr.length) return [[]];
    if (arr.length === 1) return [arr];
    return [
      ...acc,
      ...permutations(withoutIndex(arr, index)).map(perms => [el, ...perms], [])
    ];
  }, []);

const validationLibrary: ValidationLibrary = chunk(
  permutations(Array.from("qwertyuio")).map(perm => {
    const str = perm.join("");
    return {
      regExp: new RegExp(str, "g"),
      annotation: `You used the word ${str}`,
      operation: Operations.ANNOTATE,
      type: MarkTypes.legal
    };
  }),
  500
);

class ValidationWorker extends ValidationStateManager<RunningWorkerValidation> {
  constructor() {
    super();
    onmessage = this.handleMessage;
  }

  private handleMessage = (e: MessageEvent) => {
    console.log("workerMessage", e.data);
    const event: WorkerEvents = e.data;
    if (event.type === CANCEL_REQUEST) {
      this.cancelValidation();
    }
    if (event.type === VALIDATE_REQUEST) {
      this.beginValidation(
        event.payload.id,
        event.payload.ranges,
        event.payload.validationInput
      );
    }
  };

  private cancelValidation = () => {};

  private beginValidation = (
    id: string,
    ranges: Range[],
    validationTarget: ValidationInput[]
  ) => {
    const { promise, cancel } = applyLibraryToValidationMapCancelable(
      validationTarget,
      validationLibrary
    );

    promise.then(validationRanges => {
      postMessage({
        type: VALIDATE_RESPONSE,
        payload: {
          id,
          validationRanges
        }
      } as WorkerEvents);
    });

    this.addRunningValidation({
      id,
      ranges,
      promise,
      cancel
    });
  };
}

const validationWorker = new ValidationWorker();
