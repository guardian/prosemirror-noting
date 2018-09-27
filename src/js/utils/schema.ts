import { Mark, MarkSpec } from "prosemirror-model";

export const markTypes = {
    legal: 'legal',
    warn: 'warn'
};

/**
 * Create a validation mark spec for the given mark name.
 */
const createValidationMark = (markName: string) => ({
  attrs: {},
  inclusive: false,
  parseDOM: [{
    tag: `span.${markName}`,
    getAttrs: () => ({})
  }],
  toDOM: (mark: Mark, inline: boolean) => [`span.${markName}`]
});

export const validationMarks = Object.keys(markTypes).reduce(
  (acc, markName: string) => {
    return {
      ...acc,
      [markName]: createValidationMark(markName)
    };
  },
  {} as { [markName: string]: MarkSpec }
);
