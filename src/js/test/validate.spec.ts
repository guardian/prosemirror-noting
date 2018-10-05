import {
  applyLibraryToValidationMap,
  ValidationLibrary,
  Operations,
  ValidationInput,
  ValidationRange
} from "../validate";
import chunk from "lodash/chunk";
import { MarkTypes } from "../utils/prosemirror";

const validationLibrary: ValidationLibrary = [
  [
    {
      regExp: new RegExp("match", "g"),
      annotation: "Found 'match'",
      operation: "ANNOTATE",
      type: "legal"
    },
    {
      regExp: new RegExp("second", "g"),
      annotation: "Found 'second'",
      operation: "ANNOTATE",
      type: "legal"
    },
    {
      regExp: new RegExp("third", "g"),
      annotation: "Found 'third'",
      operation: "ANNOTATE",
      type: "legal"
    }
  ]
];

describe("validate", () => {
  it("should validate a textMap against a validation library, providing a list of validation outputs", () => {
    const generator = applyLibraryToValidationMap(validationLibrary);
    const inputs: ValidationInput[] = [
      {
        str: "example string with match",
        offset: 10
      },
      {
        str: "example string with match also",
        offset: 20
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
    // const generator = applyLibraryToValidationMap(validationLibrary);
    // const inputs: ValidationInput[] = [
    //   {
    //     str: "example string with match",
    //     offset: 10
    //   },
    //   {
    //     str: "example string with match also",
    //     offset: 20
    //   }
    // ];
    // const { done, value } = generator.next(inputs);
    // if (done) {
    //   expect(value).toEqual([
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
    // }
  });
});
