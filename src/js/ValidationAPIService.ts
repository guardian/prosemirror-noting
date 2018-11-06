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
import { createStringFromValidationInputs } from "./utils/string";
import { LTReplacement, LTResponse } from "./interfaces/LanguageTool";
import flatten from 'lodash/flatten';

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
class ValidationService extends ValidationStateManager<RunningServiceValidation>
  implements IValidationService {
  /**
   * Validate a Prosemirror node, restricting checks to ranges if they're supplied.
   */
  public async validate(
    inputs: ValidationInput[],
    id: string | number
  ) {
    const results = await Promise.all(inputs.map(async input => {
      const body = new URLSearchParams();
      body.append(
        "data",
        JSON.stringify({
          annotation: [
            {
              text: input.str
            }
          ]
        })
      );
      body.append("language", "en-US");
      const validation = {
        id,
        validationInputs: inputs
      };
      this.addRunningValidation(validation);
      const response = await fetch("http://localhost:9001", {
        method: "POST",
        headers: new Headers({
          "Content-Type": "x-www-form-urlencoded"
        }),
        body
      });
      const validationData: LTResponse = await response.json();
      const validationOutputs: ValidationOutput[] = validationData.matches.map(
        match => ({
          str: match.sentence,
          from: match.offset,
          to: match.offset + match.length,
          annotation: match.message,
          type: match.rule.description
        })
      );
      this.handleCompleteValidation(id, validationOutputs);
      return validationOutputs;
    }));
    return flatten(results);
  }

  /**
   * Cancel all running validations.
   */
  public cancelValidation = () => {
    this.cancelValidation();
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
    id: string | number,
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
