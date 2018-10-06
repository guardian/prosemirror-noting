import flatMap from "lodash/flatten";
import { diffValidationInputs } from "./utils/range";

export type ValidationInput = { str: string; from: number; to: number };
export type ValidationLibrary = {
  regExp: RegExp;
  annotation: string;
  operation: "ANNOTATE" | "REPLACE";
  type: string;
}[][];
export type ValidationOutput = ValidationInput & {
  annotation: string;
  type: string;
};

export const Operations: {
  [key: string]: "ANNOTATE" | "REPLACE";
} = {
  ANNOTATE: "ANNOTATE",
  REPLACE: "REPLACE"
};

/**
 * Get the matches and indexes for a given string and regex.
 */
const getMatchIndexes = (str: string, from: number, regExp: RegExp) => {
  const matches = [];
  let match;
  while ((match = regExp.exec(str))) {
    matches.push({ index: match.index + from, item: match[0] });
  }
  return matches;
};

export const validationRunner = (
  validationInputs: ValidationInput[],
  validationLibrary: ValidationLibrary
): {
  cancel: () => {};
  omitOverlappingInputs: (inputs: ValidationInput[]) => void;
  promise: Promise<ValidationOutput[]>;
} => {
  const gen = applyLibraryToValidationMap(validationLibrary);
  let cancelled = false;
  let currentInputs = validationInputs;
  let inputsToOmit: ValidationInput[] = [];

  return {
    promise: new Promise(resolve => {
      const getNextRange = () => {
        if (cancelled) {
          resolve([]);
        }
        const { done, value } = gen.next(currentInputs);
        if (done) {
          return resolve(diffValidationInputs(value, inputsToOmit));
        }
        setTimeout(getNextRange);
      };
      getNextRange();
    }),
    cancel: () => (cancelled = true),
    omitOverlappingInputs: (newInputs: ValidationInput[]) => {
      currentInputs = diffValidationInputs(currentInputs, newInputs);
      inputsToOmit = inputsToOmit.concat(newInputs);
    }
  };
};

/**
 * Apply a library to a text map, returning a list of validation ranges.
 */
export function* applyLibraryToValidationMap(
  validationLibrary: ValidationLibrary
) {
  let matches: ValidationOutput[] = [];
  for (let i = 0; i < validationLibrary.length; i++) {
    const validationInputs: ValidationInput[] = yield matches;
    for (let j = 0; j < validationLibrary[i].length; j++) {
      const rule = validationLibrary[i][j];
      const ruleMatches = flatMap(
        validationInputs.map(vi =>
          getMatchIndexes(vi.str, vi.from || 0, rule.regExp)
        )
      );
      matches = matches.concat(
        ruleMatches
          .map(match => ({
            annotation: rule.annotation,
            type: rule.type,
            from: match.index,
            to: match.index + match.item.length,
            str: match.item
          }))
          .filter(match => match)
      );
    }
  }

  return matches;
}
