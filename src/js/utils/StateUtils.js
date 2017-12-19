import { AllSelection } from "prosemirror-state";

export const charsAdded = (oldState, state) =>
  state.doc.textContent.length - oldState.doc.textContent.length;

/*
     * This takes a doc node and a marktype and hunts for them (assuming the have an id
     * on their attrs) and merges their start and ends (for use with the note tracker)
     */
export const notesFromDoc = (doc, markType, min = false, max = false) => {
  const notes = {};

  const { from, to } = new AllSelection(doc);

  const _min = min === false ? from : min;
  const _max = max === false ? to : max;

  doc.nodesBetween(_min, _max, (node, start) => {
    const end = start + node.nodeSize;
    const mark = markType.isInSet(node.marks);

    if (mark) {
      const { id, meta } = mark.attrs;

      notes[id] = notes[id] || {
        id,
        meta, // this should be the same across all notes so just set it here
        nodes: [],
        start: Infinity,
        end: -Infinity
      };

      notes[id] = Object.assign({}, notes[id], {
        start: Math.min(notes[id].start, start),
        end: Math.max(notes[id].end, end),
        nodes: [
          ...notes[id].nodes,
          {
            start,
            end
          }
        ]
      });
    }
  });

  return Object.keys(notes).map(id => notes[id]);
};
