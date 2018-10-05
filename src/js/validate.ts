import flatMap from "lodash/flatten";
import { diffValidationInputs } from "./utils/range";

export type ValidationInput = { str: string; offset: number };
export type ValidationLibrary = {
  regExp: RegExp;
  annotation: string;
  operation: "ANNOTATE" | "REPLACE";
  type: string;
}[][];
export type ValidationRange = {
  origin: number;
  annotation: string;
  type: string;
  startPos: number;
  endPos: number;
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
const getMatchIndexes = (str: string, offset: number, regExp: RegExp) => {
  const matches = [];
  let match;
  while ((match = regExp.exec(str))) {
    matches.push({ index: match.index + offset, item: match[0] });
  }
  return matches;
};

export const validationRunner = (
  validationInputs: ValidationInput[],
  validationLibrary: ValidationLibrary
) => {
  const gen = applyLibraryToValidationMap(validationLibrary);
  let cancelled = false;
  let currentInputs = validationInputs;

  return {
    promise: new Promise((resolve, reject) => {
      const getNextRange = () => {
        const { done, value } = gen.next(currentInputs);
        if (done) {
          resolve(value);
        }
        setTimeout(getNextRange);
      };
    }),
    cancel: () => (cancelled = true),
    omitRanges: (newInputs: ValidationInput[]) =>
      (currentInputs = diffValidationInputs(currentInputs, newInputs))
  };
};

/**
 * Apply a library to a text map, returning a list of validation ranges.
 */
export function* applyLibraryToValidationMap(
  validationLibrary: ValidationLibrary
) {
  let matches: ValidationRange[] = [];
  for (let i = 0; i < validationLibrary.length; i++) {
    const validationInputs: ValidationInput[] = yield matches;
    for (let j = 0; j < validationLibrary[i].length; j++) {
      const rule = validationLibrary[i][j];
      const ruleMatches = flatMap(
        validationInputs.map(vi =>
          getMatchIndexes(vi.str, vi.offset || 0, rule.regExp)
        )
      );
      matches = matches.concat(
        ruleMatches
          .map(match => ({
            origin: match.index,
            annotation: rule.annotation,
            type: rule.type,
            startPos: match.index,
            endPos: match.index + match.item.length
          }))
          .filter(match => match)
      );
    }
  }

  return matches;
}
