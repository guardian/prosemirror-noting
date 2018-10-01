import { Range } from ".";
import { ValidationRange, ValidationInput } from "./validate";

export type WorkerEventTypes = "VALIDATE" | "CANCEl";

export const VALIDATE_REQUEST = "VALIDATE_REQUEST";
export const VALIDATE_RESPONSE = "VALIDATE_RESPONSE";
export const CANCEL_REQUEST = "CANCEL_REQUEST";
export const CANCEL_RESPONSE = "CANCEL_RESPONSE";

export type WorkerEvents =
  | {
      type: "VALIDATE_REQUEST";
      payload: {
        id: string;
        validationInput: ValidationInput[];
        ranges: Range[];
      };
    }
  | {
      type: "VALIDATE_RESPONSE";
      payload: {
        id: string;
        validationRanges: ValidationRange[];
      };
    }
  | {
      type: "CANCEL_REQUEST";
      payload: {
        ids: string[];
      };
    }
  | {
      type: "CANCEL_RESPONSE";
      payload: {
        ids: string[];
      };
    };
