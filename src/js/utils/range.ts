import { Range } from "../index";
import { access } from "fs";

export const findOverlappingRangeIndex = (ranges: Range[], range: Range) => {
    return ranges.findIndex(localRange => (
        localRange.from <= range.from && localRange.to >= range.from)
        || (localRange.to >= range.to && localRange.from <= range.to)
        || (localRange.from >= range.from && localRange.to <= range.to))
}

export const mergeRange = (range1: Range, range2: Range): Range => ({
    from: range1.from < range2.from ? range1.from : range2.from,
    to: range1.to > range2.to ? range1.to : range2.to,
})

export const mergeRanges = (ranges: Range[]) => ranges.reduce((acc, range) => {
    const index = findOverlappingRangeIndex(acc, range);
    if (index === -1) {
        return acc.concat(range);
    }
    const newRange = acc.slice();
    newRange.splice(index, 1, mergeRange(range, acc[index]))
    return newRange;
}, [] as Range[]);
