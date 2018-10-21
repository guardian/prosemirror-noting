import { ValidationInput, ValidationOutput } from "./Validation";
import { EventEmitter } from "../EventEmitter";

/**
 * A service that receives requests for validation and emits responses.
 */
interface IValidationService extends EventEmitter {
	validate(inputs: ValidationInput[], id: string|number): Promise<ValidationOutput[]>;
	cancelValidation(): void;
}


export default IValidationService;