import { AllSelection } from "prosemirror-state";
import { Fragment } from "prosemirror-model";

const updateFragmentNodes = updater => prevFrag => {
  let frag = Fragment.empty;

  const appendNodeToFragment = node =>
    (frag = frag.append(Fragment.from(node)));

  prevFrag.forEach(node =>
    appendNodeToFragment(
      node.copy(updateFragmentNodes(updater)(updater(node).content))
    )
  );

  return frag;
};

const updateNodeMarkAttrs = (node, mark, attrs = {}) =>
  mark.isInSet(node.marks)
    ? node.mark(
        mark
          .removeFromSet(node.marks)
          .concat(mark.type.create(Object.assign(mark.attrs, attrs)))
      )
    : node;

const defaultGetId = () => {
  let id = 0;
  return () => {
    id++;
    return id;
  };
};

// ensures that there are no notes in the document that have the same note id
// in non-contiguous places, which would result in one large note between the
// extremes of those places on certain edits
// e.g. <note id="1">test</note> some <note id="1">stuff</note>
// results in
// e.g. <note id="1">test</note> some <note id="2">stuff</note>
export const sanitizeFragment = (frag, markType, getId = defaultGetId()) => {
  let idMap = {};
  // the current id of the node according to the input document
  let currentNoteId = null;

  const getAdjustNoteId = id => {
    if (id === currentNoteId) {
      return idMap[id];
    }

    const newId = getId();
    idMap[id] = newId;
    currentNoteId = id;
    return newId;
  };

  const closeNote = () => {
    currentNoteId = null;
  };

  return updateFragmentNodes(node => {
    const noteMark = markType.isInSet(node.marks);
    if (noteMark) {
      return updateNodeMarkAttrs(node, noteMark, {
        id: getAdjustNoteId(noteMark.attrs.id)
      });
    }

    if (node.isText) {
      closeNote();
    }

    return node;
  })(frag);
};

export const sanitizeNode = (node, markType, getId) =>
  node.copy(sanitizeFragment(node.content, markType, getId));

export const getInsertedRanges = ({ mapping }) => {
  let ranges = [];
  mapping.maps.forEach((stepMap, i) => {
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      ranges.push([
        mapping.slice(i + 1).map(newStart),
        mapping.slice(i + 1).map(newEnd)
      ]);
    });
  });
  return ranges;
};

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
