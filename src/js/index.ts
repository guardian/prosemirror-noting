import { Plugin, Transaction, EditorState } from "prosemirror-state";
import { Node, Schema } from "prosemirror-model";
import { DecorationSet, Decoration, EditorView } from "prosemirror-view";
import flatMap from "lodash/flatten";
import { mergeRanges } from "./utils/range";
import { getExpandedRange } from "./utils/string";
import { ReplaceStep, ReplaceAroundStep } from "prosemirror-transform";
import uuid from "uuid/v4";
import clamp from "lodash/clamp";
import { ValidationOutput } from "./validate";
import { getTextMaps } from "./utils/prosemirror";
import validationService, {
  ValidationEvents,
  ValidationResponse
} from "./ValidationService";

const TransactionMetaKeys = {
  VALIDATION_RESPONSE: "VALIDATION_RESPONSE"
};

/**
 * Get a widget DOM node given a validation range.
 * Keeps our DOM magic out of the way of lifecycle methods.
 */
const getWidgetNode = (range: ValidationOutput) => {
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
 * Create a validation decoration for the given range.
 */
const createDecorationForValidationRange = (range: ValidationOutput) => {
  const validationId = uuid();
  return [
    Decoration.inline(range.from, range.to, {
      class: "validation-decoration",
      "data-attr-validation-id": validationId
    } as any),
    Decoration.widget(range.from, getWidgetNode(range), { validationId })
  ];
};

/**
 * Given a validation library, gets validation decorations for a node.
 */
const getValidationRangesForDocument = async (doc: Node) => {
  const textMap = getTextMaps(doc);
  return validationService.validate(textMap, 0);
  // return applyLibraryToValidationMapCancelable(textMap, lib);
};

const getValidationRangesForRanges = async (
  ranges: Range[],
  tr: Transaction
) => {
  // Revalidate and redecorate each range.

  return validationService.validate(
    ranges.map(range => ({
      str: tr.doc.textBetween(range.from, range.to),
      ...range
    })),
    tr.time
  );
};

const getDecorationsForValidationRanges = (ranges: ValidationOutput[]) =>
  flatMap(ranges.map(createDecorationForValidationRange));

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
  decoration.type.widget &&
    decoration.type.widget.classList.remove(
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
 * Given a schema, create a function that invalidates a set of decorations
 * for the given ranges, supplying a new range to validate.
 */
const revalidationRangefinder = (
  ranges: Range[],
  decorations: DecorationSet,
  doc: Node
) => {
  const { decorations: localDecorations, validationRanges } = ranges.reduce(
    (acc, range: Range) => {
      // @todo - there will be a bug here for large ranges, as the widget decorator
      // lives on the left of the inline decoration and if this range doesn't reach it
      // stale widgets will be left in the document. Buuuut, this is innovation
      // week (tm), so...
      const removalRange = expandRange({ from: range.from, to: range.to }, doc);
      const decorationsToRemove = decorations.find(
        removalRange.from,
        removalRange.to
      );
      const decorationRanges = decorationsToRemove.length
        ? decorationsToRemove.map(dec => ({
            from: dec.from,
            to: dec.to
          }))
        : [removalRange];

      // Expand the ranges. This is an arbitrary expansion of a few words but could,
      // for example, relate to the longest match in the dictionary or similar.
      const validationRanges = decorationRanges.map(decRange => ({
        from: decRange.from,
        to: clamp(decRange.to, doc.content.size)
      }));

      return {
        validationRanges: acc.validationRanges.concat(validationRanges),
        decorations: decorations.remove(decorationsToRemove)
      };
    },
    { decorations, validationRanges: [] as Range[] }
  );
  return {
    decorations: localDecorations,
    rangesToValidate: mergeRanges(validationRanges)
  };
};

const getNewDecorationsForValidationResponse = (
  response: ValidationResponse,
  decorationSet: DecorationSet,
  trs: Transaction[],
  currentTr: Transaction
) => {
  console.log(trs);
  const initialTransaction = trs.find(tr => tr.time === parseInt(response.id));
  if (!initialTransaction && trs.length > 1) {
    console.log("No initial transaction found", response.id);

    return decorationSet;
  }

  // There are new validations available; apply them to the document.
  const decorationsToAdd = getDecorationsForValidationRanges(
    response.validationOutputs
  );

  const existingDecorations = decorationSet.find();
    
  // We map the decorations through the accumulated tr maps until
  // they map on to the new document using the transaction times.
  decorationSet = trs.reduce((acc, tr) => {
    return tr.time >= parseInt(response.id) ? acc.map(tr.mapping, tr.doc) : acc;
  }, DecorationSet.create((initialTransaction || currentTr).doc, decorationsToAdd));

  // Finally, we add the existing decorations to this new map.
  return decorationSet.add(currentTr.doc, existingDecorations);
};

type PluginState = {
  decorations: DecorationSet;
  bufferedTrs: Transaction[];
  bufferedRanges: Range[];
  lastValidationTime: number;
};

/**
 * The document validator plugin. Listens for validation commands and applies
 * validation decorations to the document.
 */
const documentValidatorPlugin = (schema: Schema) => {
  let localView: undefined | EditorView = undefined;
  const plugin: Plugin = new Plugin({
    state: {
      init(_, { doc }) {
        getValidationRangesForDocument(doc);

        // Hook up our validation events.
        validationService.on(
          ValidationEvents.VALIDATION_COMPLETE,
          (validationResponse: ValidationResponse) =>
            console.log(
              TransactionMetaKeys.VALIDATION_RESPONSE,
              validationResponse
            ) ||
            (localView &&
              localView.dispatch(
                localView.state.tr.setMeta(
                  TransactionMetaKeys.VALIDATION_RESPONSE,
                  validationResponse
                )
              ))
        );

        return {
          decorations: DecorationSet.create(doc, [])
        };
      },
      apply(
        tr: Transaction,
        {
          decorations,
          bufferedTrs = [],
          bufferedRanges = [],
          lastValidationTime = 0
        }: PluginState
      ) {
        const replaceRanges = getReplaceStepRangesFromTransaction(tr);
        const isValidating = validationService.getRunningValidations().length;
        let _bufferedTrs = bufferedTrs;
        (window as any).bufferedTrs = bufferedTrs;
        let _newDecorations = decorations.map(tr.mapping, tr.doc);

        // We need to aggregate ranges here, before we submit them to the
        // validation service. Effectively this means batching ranges; once
        // we're ready to submit we join the ranges, examine the document to
        // grab the relevant text and submit as usual.

        // if lastValidationTime < window
        // add to buffered ranges
        // else
        // collapse validation ranges
        // submit validations

        if (replaceRanges.length) {
          _bufferedTrs =
            bufferedTrs.length > 25
              ? bufferedTrs.slice(1).concat(tr)
              : bufferedTrs.concat(tr);
          const {
            decorations: prunedDecorations,
            rangesToValidate
          } = revalidationRangefinder(replaceRanges, _newDecorations, tr.doc);
          _newDecorations = prunedDecorations;
          getValidationRangesForRanges(rangesToValidate, tr);
        }

        const response: ValidationResponse = tr.getMeta(
          TransactionMetaKeys.VALIDATION_RESPONSE
        );

        if (response && response.validationOutputs.length) {
          _newDecorations = getNewDecorationsForValidationResponse(
            response,
            _newDecorations,
            bufferedTrs,
            tr
          );
        }
        return {
          decorations: _newDecorations,
          isValidating,
          bufferedTrs: _bufferedTrs
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
            const targetAttr = (target as HTMLElement).getAttribute(
              "data-attr-validation-id"
            );
            const newValidationId = targetAttr ? targetAttr : undefined;
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
      localView = view;
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
