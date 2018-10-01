import { ValidationRange } from "./validate";
import { Range } from ".";
import {
  VALIDATE_REQUEST,
  VALIDATE_RESPONSE,
  CANCEL_REQUEST,
  CANCEL_RESPONSE,
  WorkerEvents
} from "./WorkerEvents";
import { EventEmitter } from "./EventEmitter";

export type RunningServiceValidation = {
  id: string;
  ranges?: Range[];
  resolve: (ranges: ValidationRange[]) => void;
  reject: (reason: string) => void;
};

export type RunningWorkerValidation = {
  id: string;
  ranges?: Range[];
  promise: Promise<ValidationRange[]>;
  cancel: () => void;
};

/**
 * A base class to handle the state of running validations
 * and provide methods common operations on that state.
 */
class ValidationStateManager<
  T extends RunningServiceValidation | RunningWorkerValidation
> extends EventEmitter {
  private runningValidations: T[] = [];

  protected addRunningValidation = (rv: T) => {
    this.runningValidations.push(rv);
  };

  protected removeRunningValidation = (validation: T) => {
    this.runningValidations.splice(
      this.runningValidations.indexOf(validation),
      1
    );
  };

  protected findRunningValidation = (id: string) => {
    return this.runningValidations.find(_ => _.id === id);
  };

  /**
   * Get validation ids for the given ranges. If no ranges are supplied,
   * return all current validation ids.
   */
  protected getIdsOfRunningValidations = (ranges?: Range[]) => {
    // @todo: get validations by range
    return this.runningValidations.map(_ => _.id);
  };
}

export default ValidationStateManager;
