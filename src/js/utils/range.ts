import flatMap from "lodash/flatten";
import { Range } from "../index";
import { ValidationRange, ValidationInput } from "../validate";

export const findOverlappingRangeIndex = (range: Range, ranges: Range[]) => {
  return ranges.findIndex(
    localRange =>
      // Overlaps to the left of the range
      (localRange.from <= range.from && localRange.to >= range.from) ||
      // Within the range
      (localRange.to >= range.to && localRange.from <= range.to) ||
      // Overlaps to the right of the range
      (localRange.from >= range.from && localRange.to <= range.to)
  );
};

export const mergeRange = (range1: Range, range2: Range): Range => ({
  from: range1.from < range2.from ? range1.from : range2.from,
  to: range1.to > range2.to ? range1.to : range2.to
});

export const mergeRanges = (ranges: Range[]) =>
  ranges.reduce(
    (acc, range) => {
      const index = findOverlappingRangeIndex(range, acc);
      if (index === -1) {
        return acc.concat(range);
      }
      const newRange = acc.slice();
      newRange.splice(index, 1, mergeRange(range, acc[index]));
      return newRange;
    },
    [] as Range[]
  );

/**
 * Return the first set of ranges with any overlaps removed.
 */
export const diffRanges = (
  firstRanges: Range[],
  secondRanges: Range[]
): Range[] => {
  const firstRangesMerged = mergeRanges(firstRanges);
  const secondRangesMerged = mergeRanges(secondRanges);
  return firstRangesMerged.reduce(
    (acc, range) => {
      const overlap = findOverlappingRangeIndex(range, secondRangesMerged);
      if (overlap === -1) {
        return acc.concat(range);
      }
      const overlappingRange = secondRangesMerged[overlap];
      const firstShortenedRange = {
        from: range.from,
        to: secondRangesMerged[overlap].from
      };
      // If the compared range overlaps our range completely, chop the end off...
      if (overlappingRange.to >= range.to) {
        return acc.concat(firstShortenedRange);
      }
      // ... else, split the range and diff the latter segment recursively.
      return acc.concat(
        firstShortenedRange,
        diffRanges(
          [
            {
              from: overlappingRange.to + 1,
              to: range.to
            }
          ],
          secondRangesMerged
        )
      );
    },
    [] as Range[]
  );
};

export const validationInputToRange = (vi: ValidationInput) => ({
  from: vi.offset,
  to: vi.offset + vi.str.length
});

const getValInputsFromRange = (
  range: Range,
  valInputs: ValidationInput[]
): ValidationInput[] =>
  valInputs.reduce(
    (acc, vi) => {
      if (range.from >= vi.offset && range.from <= vi.offset + vi.str.length) {
        const from = range.from - vi.offset;
        const to = range.from - vi.offset + (range.to - range.from);
        return acc.concat({
          offset: range.from,
          str: vi.str.slice(from > 0 ? from - 1 : 0, to)
        });
      }
      return acc.concat({
        str: vi.str,
        offset: range.from
      });
    },
    [] as ValidationInput[]
  );

/**
 * Remove the second validation inputs from the first,
 * producing a new array of validation inputs.
 *
 * This function works on the assumption that all ranges
 * in each set of validation inputs are merged.
 */
export const diffValidationInputs = (
  firstValInputs: ValidationInput[],
  secondValInputs: ValidationInput[]
) =>
  flatMap(
    diffRanges(
      firstValInputs.map(validationInputToRange),
      secondValInputs.map(validationInputToRange)
    ).map(range => getValInputsFromRange(range, firstValInputs))
  );
