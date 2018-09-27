import { mergeRanges, findOverlappingRangeIndex } from "../utils/range";

describe("Range utils", () => {
    describe("findOverlappingRangeIndex", () => {
        it('should find overlapping ranges', () => {
            const ranges = [{ from: 5, to: 10 }];
            expect(findOverlappingRangeIndex(ranges, {
                from: 0,
                to: 4
            })).toBe(-1);
            expect(findOverlappingRangeIndex(ranges, {
                from: 0,
                to: 6
            })).toEqual(0);
            expect(findOverlappingRangeIndex(ranges, {
                from: 6,
                to: 8
            })).toEqual(0);
            expect(findOverlappingRangeIndex(ranges, {
                from: 8,
                to: 15
            })).toEqual(0);
            expect(findOverlappingRangeIndex(ranges, {
                from: 11,
                to: 15
            })).toEqual(-1);
        });
    });
    describe("mergeRanges", () => {
        it("merge the ranges dammit", () => {
          const ranges = [
            {
              from: 0,
              to: 10
            },
            {
              from: 5,
              to: 15
            },
            {
              from: 5,
              to: 20
            }
          ];
          expect(mergeRanges(ranges)).toEqual([{
            from: 0,
            to: 20
          }]);
        });
      });
});
