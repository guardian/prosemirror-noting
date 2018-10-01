import { ValidationRange, ValidationInput } from "./validate";
import { Range } from ".";
import {
  VALIDATE_REQUEST,
  VALIDATE_RESPONSE,
  CANCEL_REQUEST,
  CANCEL_RESPONSE,
  WorkerEvents
} from "./WorkerEvents";
import v4 from "uuid/v4";
import ValidationStateManager, {
  RunningServiceValidation
} from "./ValidationStateManager";
import { EventEmitter } from "events";

const serviceName = "[validationService]";

export const ValidationEvents = {
  VALIDATION_COMPLETE: "VALIDATION_COMPLETE",
  VALIDATION_ERROR: "VALIDATION_ERROR"
};

export type ValidationResponse = {
  ranges: ValidationRange[];
  id: string;
};

class ValidationService extends ValidationStateManager<
  RunningServiceValidation
> {
  private worker = new Worker("./worker.js");

  constructor() {
    super();
    this.worker.onmessage = this.handleMessage;
  }

  /**
   * Validate a Prosemirror node, restricting checks to ranges if they're supplied.
   */
  public validate(
    validationInput: ValidationInput[],
    ranges?: Range[]
  ): Promise<ValidationRange[]> {
    const id = v4();
    this.worker.postMessage({
      type: VALIDATE_REQUEST,
      payload: {
        validationInput,
        ranges,
        id
      }
    } as WorkerEvents);

    return new Promise((resolve, reject) => {
      this.addRunningValidation({
        id,
        ranges,
        resolve,
        reject
      });
    });
  }

  /**
   * Cancel running validations. If no ranges are supplied, cancel all validations,
   * else just cancel the validations running for the given ranges.
   */
  public cancelValidation = (ranges?: Range[]) => {
    // @todo: partially cancel validations
    this.worker.postMessage({
      type: CANCEL_REQUEST,
      payload: {
        ids: this.getIdsOfRunningValidations(ranges)
      }
    } as WorkerEvents);
  };

  /**
   * Handle a worker message.
   */
  private handleMessage = (e: MessageEvent) => {
    console.log("serviceMessage", e.data);
    const event: WorkerEvents = e.data;
    if (event.type === CANCEL_RESPONSE) {
      this.handleCancelledValidations(event.payload.ids);
    }
    if (event.type === VALIDATE_RESPONSE) {
      this.handleCompleteValidation(
        event.payload.id,
        event.payload.validationRanges
      );
    }
  };

  /**
   * Handle cancelled validations.
   */
  handleCancelledValidations = (ids: string[]) => {
    ids.forEach(id => {
      const runningValidation = this.findRunningValidation(id);
      if (runningValidation) {
        this.removeRunningValidation(runningValidation);
      } else {
        console.warn(
          `${serviceName} Received cancellation from worker, but no match in running validations for id ${id}`
        );
      }
    });
  };

  /**
   * Handle a completed validation.
   */
  private handleCompleteValidation = (
    id: string,
    validationRanges: ValidationRange[]
  ) => {
    const completeValidation = this.findRunningValidation(id);
    if (!completeValidation) {
      return console.warn(
        `${serviceName} Received validation from worker, but no match in running validations for id ${id}`
      );
    }
    this.emit(ValidationEvents.VALIDATION_COMPLETE, {
      id,
      ranges: validationRanges
    });
    this.removeRunningValidation(completeValidation);
  };
}

const validationService = new ValidationService();

export default validationService;
