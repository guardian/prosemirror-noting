import { Plugin, Transaction, EditorState } from "prosemirror-state";
import { Node, Schema, Slice } from "prosemirror-model";
import { DecorationSet, Decoration, EditorView } from "prosemirror-view";
import flatMap from "lodash/flatten";
import { markTypes } from "./utils/schema";
import { mergeRanges } from "./utils/range";
import { getExpandedRange, isString } from "./utils/string";
import { ReplaceStep, ReplaceAroundStep } from "prosemirror-transform";
import uuid from 'uuid/v4';

/**
 * Flatten a node and its children into a single array of objects, containing
 * the node and the node's position in the document.
 */
const flatten = (node: Node, descend = true) => {
  if (!node) {
    throw new Error('Invalid "node" parameter');
  }
  const result: { node: Node; parent: Node; pos: number }[] = [];
  node.descendants((child, pos, parent) => {
    result.push({ node: child, parent, pos });
    if (!descend) {
      return false;
    }
  });
  return result;
};

/**
 * Find all children in a node that satisfy the given predicate.
 */
const findChildren = (
  node: Node,
  predicate: (node: Node) => boolean,
  descend: boolean
): { node: Node; parent: Node; pos: number }[] => {
  if (!node) {
    throw new Error('Invalid "node" parameter');
  } else if (!predicate) {
    throw new Error('Invalid "predicate" parameter');
  }
  return flatten(node, descend).filter(child => predicate(child.node));
};

/**
 * Find any text nodes in the given node.
 */
const findTextNodes = (
  node: Node,
  descend: boolean = true
): { node: Node; parent: Node; pos: number }[] => {
  return findChildren(node, child => child.isText, descend);
};

type TextMap = { text: string; start: number; offset: number };

/**
 * Get a single string of text, and an array of position mappings,
 * from a Prosemirror document. The mappings can be used to map an
 * index in the text back to a position in the document.
 */
const getTextMaps = (doc: Node) =>
  (doc instanceof Node ? findTextNodes(doc) : [doc]).reduce(
    (
      acc: { positionMap: TextMap[]; length: number },
      textNodeWrapper,
      index,
      textNodes
    ) => {
      const previousMap = acc.positionMap[acc.positionMap.length - 1];
      const text = textNodeWrapper.node.text || "";
      const previousNodeWrapper = textNodes[index - 1];
      const sharesParentWithPreviousNode =
        previousNodeWrapper &&
        textNodeWrapper.parent === previousNodeWrapper.parent;
      if (sharesParentWithPreviousNode) {
        // If this node shares a parent with the previous, add its text and
        // mapping to the last node's position map. In this way, contiguous
        // text nodes are treated as single lines of text for validation.
        const previousPositionMaps = acc.positionMap.slice(
          0,
          acc.positionMap.length - 1
        );
        const currentText = (previousMap ? previousMap.text : "") + text;
        return {
          length: acc.length + text.length,
          positionMap: previousPositionMaps.concat({
            text: currentText,
            start: acc.length - (previousNodeWrapper.node.text || "").length,
            offset: previousMap.offset
          })
        };
      }
      // Add a new position map.
      return {
        length: acc.length + text.length,
        positionMap: acc.positionMap.concat({
          text,
          start: acc.length,
          offset: textNodeWrapper.pos
        })
      };
    },
    {
      positionMap: [],
      length: 0
    }
  ).positionMap;

const Operations: {
  [key: string]: "ANNOTATE" | "REPLACE";
} = {
  ANNOTATE: "ANNOTATE",
  REPLACE: "REPLACE"
};

type ValidationLibrary = {
  regExp: RegExp;
  annotation: string;
  operation: "ANNOTATE" | "REPLACE";
  type: string;
}[];

const validationLibrary: ValidationLibrary = [
  {
    regExp: new RegExp("some validation", "g"),
    annotation: "You used the word 'validation'",
    operation: Operations.ANNOTATE,
    type: markTypes.legal
  },
  {
    regExp: new RegExp("Prosemirror", "g"),
    annotation: "You used the word 'Prosemirror'",
    operation: Operations.REPLACE,
    type: markTypes.legal
  },
  {
    regExp: new RegExp("require", "g"),
    annotation: "You used the word 'require'",
    operation: Operations.REPLACE,
    type: markTypes.legal
  },
  {
    regExp: new RegExp("Happy", "g"),
    annotation: "You used the word 'happy'",
    operation: Operations.REPLACE,
    type: markTypes.warn
  }
];

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

type ValidationRange = {
  origin: number;
  annotation: string;
  type: string;
  startPos: number;
  endPos: number;
};

/**
 * Apply a library to a text map, returning a list of validation ranges.
 */
const applyLibraryToValidationMap = (
  arrayToValidate: TextMap[] | string[],
  validationLibrary: ValidationLibrary,
  offset = 0
) =>
  validationLibrary.reduce(
    (acc, item) => {
      const isStringMap = isString(arrayToValidate[0]);
      const matches = flatMap(
        isStringMap
          ? (arrayToValidate as string[]).map(str =>
              getMatchIndexes(str, offset, item.regExp)
            )
          : (arrayToValidate as TextMap[]).map((textMap: TextMap) =>
              getMatchIndexes(textMap.text, textMap.offset, item.regExp)
            )
      );
      return acc.concat(
        matches
          .map(match => ({
            origin: match.index,
            annotation: item.annotation,
            type: item.type,
            startPos: match.index,
            endPos: match.index + match.item.length
          }))
          .filter(match => match)
      );
    },
    [] as ValidationRange[]
  );

/**
 * Get a widget DOM node given a validation range.
 * Keeps our DOM magic out of the way of lifecycle methods.
 */
const getWidgetNode = (range: ValidationRange) => {
  const widget = document.createElement("span");
  widget.className = "validation-widget-container";

  const contentNode = document.createElement("span");
  contentNode.className = "validation-widget";
  widget.appendChild(contentNode);

  const labelNode = document.createElement("span");
  const labelTextNode = document.createTextNode(range.type);
  labelNode.appendChild(labelTextNode);
  labelNode.className = "validation-widget-label";
  contentNode.appendChild(labelNode);

  const textNode = document.createTextNode(range.annotation);
  contentNode.appendChild(textNode);

  return widget;
};

/**
 * Given a validation library, gets validation decorations for a node.
 */
const getValidationDecorationsForNode = (
  doc: Node,
  validationLibrary: ValidationLibrary
) => {
  const textMap = getTextMaps(doc);
  const ranges = applyLibraryToValidationMap(textMap, validationLibrary);
  const validationDecs = ranges.map(createDecorationForValidationRange);
  return DecorationSet.create(doc, flatMap(validationDecs));
};

const createDecorationForValidationRange = (
  range: ValidationRange
) => {
  const validationId = uuid();
  console.log('Creating decoration', range);
  return [
    Decoration.inline(range.startPos, range.endPos, {
      class: "validation-decoration",
      "data-attr-validation-id": validationId
    } as any),
    Decoration.widget(range.startPos, getWidgetNode(range), { validationId })
  ];
};

const findSingleDecoration = (
  state: PluginState,
  predicate: (spec: any) => boolean
): Decoration | undefined => {
  const decorations = state.decorations.find(undefined, undefined, predicate);
  if (!decorations[0]) {
    return undefined;
  }
  return decorations[0];
};

/**
 * Create a function responsible for updating the view. We update the view
 * when we need to update our decorations with hover information.
 */
const updateView = (plugin: Plugin) => (
  view: EditorView,
  prevState: EditorState
) => {
  const pluginState: PluginState = plugin.getState(view.state);
  const validationId = pluginState.validationId;
  const prevValidationId = plugin.getState(prevState).validationId;
  if (prevValidationId === validationId) {
    return;
  }
  if (!prevValidationId && validationId) {
    const decoration = findSingleDecoration(
      pluginState,
      spec => spec.validationId === validationId
    );
    if (!decoration) {
      return;
    }
    decoration.type.widget.classList.add(
      "validation-widget-container--is-hovering"
    );
    return;
  }
  const decoration = findSingleDecoration(
    pluginState,
    spec => spec.validationId === prevValidationId
  );
  if (!decoration) {
    return;
  }
  decoration.type.widget && decoration.type.widget.classList.remove(
    "validation-widget-container--is-hovering"
  );
};

/**
 * Get all of the ranges of any replace steps in the given transaction.
 */
const getReplaceStepRangesFromTransaction = (tr: Transaction) =>
  tr.steps
    .filter(
      step => step instanceof ReplaceStep || step instanceof ReplaceAroundStep
    )
    .map((step: ReplaceStep | ReplaceAroundStep) => ({
      from: step.from,
      to: step.to
    }));

export type Range = { from: number; to: number };

/**
 * Expand a range in a document to encompass the words adjacent to the range.
 */
const expandRange = (range: Range, doc: Node): Range => {
  const fromPos = doc.resolve(range.from);
  const parent = fromPos.node(fromPos.depth);
  const { diffFrom, diffTo } = getExpandedRange(
    fromPos.parentOffset,
    parent.textContent,
    2
  );
  return { from: range.from + diffFrom, to: range.to + diffTo };
};

/**
 * Given a schema, create a function that revalidates a set of decorations
 * for the given ranges.
 */
const createDecorationRevalidator = (schema: Schema) => (
  ranges: Range[],
  decorations: DecorationSet,
  doc: Node
) => {
  console.log(decorations.find().length);
  // Remove any decorations that impinge on these ranges, retaining their
  // ranges for revalidation
  let {
    decorations: newDecorations,
    validationRanges: newRanges
  } = ranges.reduce(
    (acc, range: Range) => {
      // @todo - there will be a bug here for large ranges, as the widget decorator
      // lives on the left of the inline decoration and if this range doesn't reach it
      // stale widgets will be left in the document. Buuuut, this is innovation
      // week (tm), so...
      const removalRange = expandRange({ from: range.from, to: range.to }, doc)
      const decorationsToRemove = decorations.find(removalRange.from, removalRange.to);
      decorationsToRemove.map(console.log)
      const decorationRanges = decorationsToRemove.length
        ? decorationsToRemove.map(dec => ({
            from: dec.from,
            to: dec.to
          }))
        : [removalRange];

      // Expand the ranges. This is an arbitrary expansion of a few words but could,
      // for example, relate to the longest match in the dictionary or similar.
      const validationRanges = decorationRanges.map(decRange =>
        expandRange({ from: decRange.from, to: decRange.to }, doc)
      );

      return {
        validationRanges: acc.validationRanges.concat(validationRanges),
        decorations: decorations.remove(decorationsToRemove)
      };
    },
    { decorations, validationRanges: [] as Range[] }
  );


  // Revalidate and redecorate each range.
  const validationRanges = flatMap(
    mergeRanges(newRanges).map(range =>
      applyLibraryToValidationMap(
        [doc.textBetween(range.from, range.to)],
        validationLibrary,
        range.from
      )
    )
  );

  const additionalDecorations = validationRanges.map(
    createDecorationForValidationRange
  );
  
  const finalDecs = additionalDecorations.reduce(
    (acc: DecorationSet, decoration) => acc.add(doc, decoration),
    newDecorations
  );

  return finalDecs;
};

type PluginState = {
  decorations: DecorationSet;
  validationId?: string;
};

/**
 * The document validator plugin. Listens for validation commands and applies
 * validation decorations to the document.
 */
const documentValidatorPlugin = (schema: Schema) => {
  const decorationRevalidator = createDecorationRevalidator(schema);
  const plugin: Plugin = new Plugin({
    state: {
      init(_, { doc }) {
        return {
          decorations: getValidationDecorationsForNode(doc, validationLibrary)
        };
      },
      apply(tr: Transaction, { decorations }: PluginState) {
        const replaceRanges = getReplaceStepRangesFromTransaction(tr);
        let newDecorations = decorations.map(tr.mapping, tr.doc);
        if (replaceRanges.length) {
          newDecorations = decorationRevalidator(
            replaceRanges,
            newDecorations,
            tr.doc
          );
        }
        return {
          decorations: newDecorations,
          validationId: tr.getMeta("validationId")
        };
      }
    },
    props: {
      decorations: state => {
        return plugin.getState(state).decorations;
      },
      handleDOMEvents: {
        mouseover: (view: EditorView, e: Event) => {
          const target = e.target;
          if (target) {
            const targetAttr = target.getAttribute("data-attr-validation-id");
            const newValidationId = targetAttr
              ? targetAttr
              : undefined;
            if (newValidationId !== plugin.getState(view.state).validationId) {
              view.dispatch(
                view.state.tr.setMeta("validationId", newValidationId)
              );
            }
          }
          return false;
        }
      }
    },
    view(view: EditorView) {
      return {
        update: updateView(plugin)
      };
    }
  });
  return plugin;
};

/**
 * The 'validate document' Prosemirror command.
 */
const validateDocument = (
  state: EditorState,
  dispatch: (tr: Transaction) => void
) => dispatch && dispatch(state.tr.setMeta("validate-document", true));

export default documentValidatorPlugin;
export { validateDocument };
