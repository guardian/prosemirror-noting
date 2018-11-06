import { applyLibraryToValidationMap, validationRunner } from "../validate";
import { ValidationInput } from "../interfaces/Validation";
import { validationLibrary } from "./helpers/fixtures";

describe("Validation functions", () => {
  describe("validate", () => {
    it("should validate a textMap against a validation library, providing a list of validation outputs", () => {
      const generator = applyLibraryToValidationMap(validationLibrary);
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
      while (true) {
        const { done, value } = generator.next(inputs);
        if (done) {
          expect(value).toEqual([
            {
              annotation: "Found 'match'",
              endPos: 35,
              origin: 30,
              startPos: 30,
              type: "legal"
            },
            {
              annotation: "Found 'match'",
              endPos: 45,
              origin: 40,
              startPos: 40,
              type: "legal"
            }
          ]);
        }
        break;
      }
    });
    it("should remove or reduce the current validation inputs when additional, overlapping validation inputs are supplied", () => {
      const generator = applyLibraryToValidationMap(validationLibrary);
      // This iteration kicks off the generator
      generator.next([]);
      // Each iteration against the library receives a different set of inputs
      generator.next([
        {
          str: "example string with first match",
          from: 20
        }
      ]);
      const { value } = generator.next([
        {
          str: "late example string with second match",
          from: 10
        }
      ]);
      // Both inputs should be present in the final validation ranges
      expect(value).toEqual([
        {
          annotation: "Found 'first match'",
          from: 40,
          str: "first match",
          to: 51,
          type: "legal"
        },
        {
          annotation: "Found 'second match'",
          from: 35,
          str: "second match",
          to: 47,
          type: "legal"
        },
        {
          annotation: "Found 'match'",
          from: 42,
          str: "match",
          to: 47,
          type: "legal"
        }
      ]);
    });
  });
  describe("validationRunner", () => {
    // it("should run validations as expected", () => {
    //   const inputs: ValidationInput[] = [
    //     {
    //       str: "example string with match",
    //       from: 10
    //     },
    //     {
    //       str: "example string with match also",
    //       from: 20
    //     }
    //   ];
    //   return expect(
    //     validationRunner(inputs, validationLibrary).promise
    //   ).resolves.toEqual([
    //     {
    //       annotation: "Found 'match'",
    //       endPos: 35,
    //       origin: 30,
    //       startPos: 30,
    //       type: "legal"
    //     },
    //     {
    //       annotation: "Found 'match'",
    //       endPos: 45,
    //       origin: 40,
    //       startPos: 40,
    //       type: "legal"
    //     }
    //   ]);
    // });
    it("should remove overlapping validation inputs from previous inputs", () => {
      const inputs: ValidationInput[] = [
        {
          str: "example string with match",
          from: 10,
          to: 35
        },
        {
          str: "example string with match also",
          from: 40,
          to: 70
        }
      ];
      jest.useFakeTimers();
      const { promise, omitOverlappingInputs } = validationRunner(
        inputs,
        validationLibrary
      );
      jest.runOnlyPendingTimers();
      omitOverlappingInputs([
        {
          str: "example string with no match",
          from: 10,
          to: 38
        }
      ]);
      jest.runAllTimers();
      return expect(promise).resolves.toEqual([
        {
          annotation: "Found 'match'",
          from: 60,
          str: "match",
          to: 65,
          type: "legal"
        }
      ]);
    });
    it("should remove overlapping validation inputs midway through validation", () => {
      const inputs: ValidationInput[] = [
        {
          str: "example string with match",
          from: 10,
          to: 35
        },
        {
          str: "example string with match also",
          from: 40,
          to: 70
        },
        {
          str: "example string with first match",
          from: 75,
          to: 106
        }
      ];
      jest.useFakeTimers();
      const { promise, omitOverlappingInputs } = validationRunner(
        inputs,
        validationLibrary
      );
      jest.runOnlyPendingTimers();
      omitOverlappingInputs([
        {
          str: "example string with no match",
          from: 10,
          to: 38
        },
        {
          str: "example string with no second match also",
          from: 73,
          to: 113
        }
      ]);
      jest.runAllTimers();
      return expect(promise).resolves.toEqual([
        {
          annotation: "Found 'match'",
          from: 60,
          str: "match",
          to: 65,
          type: "legal"
        }
      ]);
    });
  });
});
