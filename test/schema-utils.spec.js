import { removeUndefinedValues } from "../src/js/utils/SchemaUtils";

describe('SchemaUtils', () => {
  describe('removeUndefinedValues', () => {
    it('should remove only undefined values', () => {
      expect(removeUndefinedValues({
        a: undefined,
        b: 'undefined',
        c: false,
        d: null,
        e: undefined,
        f: 'hi',
        g: 0
      })).toEqual({
        b: 'undefined',
        c: false,
        d: null,
        f: 'hi',
        g: 0
      })
    })
  })
})