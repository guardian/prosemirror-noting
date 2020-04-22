import { AllSelection } from "prosemirror-state";
import { Fragment } from "prosemirror-model";
import uuid from "uuid/v4";

// Runs through a Fragment's nodes and runs `updater` on them,
// which is expected to return a node - either the same one or a modified one -
// which is then added in place of the old node
const updateFragmentNodes = (updater) => (prevFrag) => {
  let frag = Fragment.empty;

  const appendNodeToFragment = (node) =>
    (frag = frag.append(Fragment.from(node)));

  prevFrag.forEach((node) =>
    appendNodeToFragment(
      node.copy(updateFragmentNodes(updater)(updater(node).content))
    )
  );

  return frag;
};

// Changes the attributes on a Mark or MarkType on a node if it exists on that
// node
const updateNodeMarkAttrs = (node, mark, attrs = {}) =>
  mark.isInSet(node.marks)
    ? node.mark(
        mark
          .removeFromSet(node.marks)
          .concat(mark.type.create(Object.assign(mark.attrs, attrs)))
      )
    : node;

// ensures that there are no notes in the document that have the same note id
// in non-contiguous places, which would result in one large note between the
// extremes of those places on certain edits
// e.g. <note id="1">test</note> some <note id="1">stuff</note>
// results in
// e.g. <note id="1">test</note> some <note id="2">stuff</note>
const sanitizeFragmentInner = (frag, markType, createId = uuid) => {
  let idMap = {};
  // the current id of the node according to the input document
  let currentNoteId = null;

  const setNewId = (prevId) => {
    const newId = !idMap[prevId] ? prevId : createId();
    idMap[prevId] = newId;
    currentNoteId = prevId;
    return newId;
  };

  // This will return an updated id for this id depending on whether it's been
  // seen before in a previous non-contiguous note range, if it's been seen
  // before then a new id will be generated and used for this id while the range
  // is contiguous
  const getAdjustNoteId = (id) => {
    if (id === currentNoteId) {
      return idMap[id];
    }
    return setNewId(id);
  };

  const closeNote = () => {
    currentNoteId = null;
  };

  return updateFragmentNodes((node) => {
    const noteMark = markType.isInSet(node.marks);
    if (noteMark) {
      return updateNodeMarkAttrs(node, noteMark, {
        id: getAdjustNoteId(noteMark.attrs.id),
      });
    }

    // if we're in a text node and we don't have a noteMark then assume we are
    // not in a note and close the range
    if (node.isText) {
      closeNote();
    }

    return node;
  })(frag);
};

const wrap = (value) => (Array.isArray(value) ? value : [value]);

// markTypes can either be a MarkType or MarkType[]
export const sanitizeFragment = (frag, markTypes, createId) =>
  wrap(markTypes).reduce(
    (nextFrag, markType) => sanitizeFragmentInner(nextFrag, markType, createId),
    frag
  );

// Similar to sanitizeFragment but allows a node to be passed instead
export const sanitizeNode = (node, markTypes, createId) =>
  node.copy(sanitizeFragment(node.content, markTypes, createId));

// Return an array of all of the new ranges in a document [[start, end], ...]
export const getInsertedRanges = ({ mapping }) => {
  let ranges = [];
  mapping.maps.forEach((stepMap, i) => {
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      ranges.push([
        mapping.slice(i + 1).map(newStart),
        mapping.slice(i + 1).map(newEnd),
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
 *
 * Unlike sanitizeNode, this will not look for contiguosness when finding the
 * notes as this helper assumes that the consuming code is not interested in
 * sanitizing the code. This should not pose any problems as long as notes
 * are getting sanitized on load and on paste.
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
        end: -Infinity,
      };

      notes[id] = Object.assign({}, notes[id], {
        start: Math.min(notes[id].start, start),
        end: Math.max(notes[id].end, end),
        nodes: [
          ...notes[id].nodes,
          {
            start,
            end,
          },
        ],
      });
    }
  });

  return Object.keys(notes).map((id) => notes[id]);
};
