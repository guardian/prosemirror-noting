import { ValidationOutput, ValidationInput } from "./interfaces/Validation";
import {
  VALIDATE_REQUEST,
  VALIDATE_RESPONSE,
  CANCEL_REQUEST,
  CANCEL_RESPONSE,
  WorkerEvents
} from "./WorkerEvents";
import ValidationStateManager, {
  RunningServiceValidation
} from "./ValidationStateManager";
import IValidationService from "./interfaces/IValidationService";
import { createStringFromValidationInputs } from './utils/string';

const serviceName = "[validationAPIService]";

export const ValidationEvents = {
  VALIDATION_COMPLETE: "VALIDATION_COMPLETE",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CANCELLATION_COMPLETE: "CANCELLATION_COMPLETE"
};

/**
 * The validation service. Calls to validate() begin validations
 * for ranges, which are returned via an event, VALIDATION_COMPLETE.
 *
 */
class ValidationService extends ValidationStateManager<
  RunningServiceValidation
> implements IValidationService {
  private worker = new Worker("./worker.js");

  constructor() {
    super();
    this.worker.onmessage = this.handleMessage;
  }

  /**
   * Validate a Prosemirror node, restricting checks to ranges if they're supplied.
   */
  public validate(
    inputs: ValidationInput[],
    id: string | number
  ): Promise<ValidationOutput[]> {
    fetch('https://languagetool.org/api/v2/check', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({
        'data': {
          'annotation': [{
            'text': createStringFromValidationInputs(inputs)
          }]
        }
      })
    })

    return new Promise((resolve, reject) => {
      this.addRunningValidation({
        id,
        validationInputs: inputs
      });
    });
  }

  /**
   * Cancel all running validations.
   */
  public cancelValidation = () => {
    // @todo: partially cancel validations
    this.worker.postMessage({
      type: CANCEL_REQUEST
    } as WorkerEvents);
  };

  /**
   * Handle a worker message.
   */
  private handleMessage = (e: MessageEvent) => {
    console.log("serviceMessage", e.data);
    const event: WorkerEvents = e.data;
    if (event.type === CANCEL_RESPONSE) {
      this.handleCancelledValidations();
    }
    if (event.type === VALIDATE_RESPONSE) {
      this.handleCompleteValidation(
        event.payload.id,
        event.payload.validationOutputs
      );
    }
  };

  /**
   * Handle cancelled validations.
   */
  handleCancelledValidations = () => {
    this.emit(ValidationEvents.CANCELLATION_COMPLETE);
  };

  /**
   * Handle a completed validation.
   */
  private handleCompleteValidation = (
    id: string,
    validationOutputs: ValidationOutput[]
  ) => {
    const completeValidation = this.findRunningValidation(id);
    if (!completeValidation) {
      return console.warn(
        `${serviceName} Received validation from worker, but no match in running validations for id ${id}`
      );
    }
    this.emit(ValidationEvents.VALIDATION_COMPLETE, {
      id,
      validationOutputs
    });
    this.removeRunningValidation(completeValidation);
  };
}

const validationService = new ValidationService();

export default validationService;
