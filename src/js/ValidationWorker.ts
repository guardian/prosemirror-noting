import {
  VALIDATE_REQUEST,
  VALIDATE_RESPONSE,
  CANCEL_REQUEST,
  WorkerEvents
} from "./WorkerEvents";
import { ValidationInput,ValidationLibrary } from "./interfaces/Validation";
import ValidationStateManager, {
  RunningWorkerValidation
} from "./ValidationStateManager";
import { validationRunner } from "./validate";
import {  } from "./validate";

class ValidationWorker extends ValidationStateManager<RunningWorkerValidation> {
  private validationLibrary: ValidationLibrary;
  private emitEvent?: (e: WorkerEvents) => void;
  constructor(
    validationLibrary: ValidationLibrary,
    registerEventHandler?: (handler: (e: MessageEvent) => void) => void,
    eventEmitter?: (e: WorkerEvents) => void
  ) {
    super();
    if (registerEventHandler) {
      registerEventHandler(this.handleMessage);
    } else {
      onmessage = this.handleMessage;
    }
    this.emitEvent = eventEmitter;
    this.validationLibrary = validationLibrary;
  }

  /**
   * We expose this part of the API for testing purposes.
   *
   */
  public handleMessage = (e: MessageEvent) => {
    console.log("workerMessage", e.data);
    const event: WorkerEvents = e.data;
    if (event.type === CANCEL_REQUEST) {
      this.cancelValidation();
    }
    if (event.type === VALIDATE_REQUEST) {
      this.beginValidation(event.payload.id, event.payload.validationInputs);
    }
  };

  private cancelValidation = () => {};

  private beginValidation = (
    id: string,
    validationInputs: ValidationInput[]
  ) => {
    const { promise, omitOverlappingInputs } = validationRunner(
      validationInputs,
      this.validationLibrary
    );

    this.runningValidations.forEach(_ =>
      _.omitOverlappingInputs(validationInputs)
    );

    promise.then(validationOutputs => {
      this.postMessage({
        type: VALIDATE_RESPONSE,
        payload: {
          id,
          validationOutputs
        }
      } as WorkerEvents);
    });

    this.addRunningValidation({
      id,
      validationInputs,
      promise,
      omitOverlappingInputs
    });
  };
  private postMessage(e: WorkerEvents) {
    this.emitEvent ? this.emitEvent(e) : postMessage(e);
  }
}

export default ValidationWorker;
