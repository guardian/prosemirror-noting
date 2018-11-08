import {
  Plugin,
  Transaction,
  EditorState,
  NodeSelection
} from "prosemirror-state";
import { Node, Schema } from "prosemirror-model";
import { DecorationSet, Decoration, EditorView } from "prosemirror-view";
import flatMap from "lodash/flatten";
import { mergeRanges } from "./utils/range";
import { getExpandedRange } from "./utils/string";
import { ReplaceStep, ReplaceAroundStep } from "prosemirror-transform";
import uuid from "uuid/v4";
import clamp from "lodash/clamp";
import { ValidationOutput, ValidationResponse } from "./interfaces/Validation";
import { getTextMaps } from "./utils/prosemirror";
import validationService, { ValidationEvents } from "./ValidationAPIService";
import { findParentNode } from "prosemirror-utils";
import difference from "lodash/difference";

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
  const validationId = pluginState.hoverId;
  const prevValidationId = plugin.getState(prevState).hoverId;
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
  getReplaceTransactions(tr).map((step: ReplaceStep | ReplaceAroundStep) => ({
    from: step.from,
    to: step.to
  }));

/**
 * Get all of the ranges of any replace steps in the given transaction.
 */
const getReplaceTransactions = (tr: Transaction) =>
  tr.steps.filter(
    step => step instanceof ReplaceStep || step instanceof ReplaceAroundStep
  );

export type Range = { from: number; to: number };

/**
 * Expand a range in a document to encompass the words adjacent to the range.
 */
const expandRange = (range: Range, doc: Node): Range => {
  const $fromPos = doc.resolve(range.from);
  const parentNode = findParentNode(node => node.isBlock)(
    new NodeSelection($fromPos)
  );
  if (!parentNode) {
    throw new Error(
      `Parent node not found for position ${$fromPos.start}, ${$fromPos.end}`
    );
  }
  console.log(parentNode.start, parentNode.node.textContent, 2);
  return {
    from: parentNode.start,
    to: parentNode.start + parentNode.node.textContent.length
  };
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
      const validationRanges = [
        {
          from: removalRange.from,
          to: clamp(removalRange.to, doc.content.size)
        }
      ];
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
  const initialTransaction = trs.find(tr => tr.time === parseInt(response.id));
  if (!initialTransaction && trs.length > 1) {
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
  dirtiedRanges: Range[];
  lastValidationTime: number;
  hoverId: string;
  validationPending: boolean;
};

const getMergedDirtiedRanges = (tr: Transaction, oldRanges: Range[]) =>
  mergeRanges(
    oldRanges
      .map(range => ({
        from: tr.mapping.map(range.from),
        to: tr.mapping.map(range.to)
      }))
      .concat(getReplaceStepRangesFromTransaction(tr))
  );

/**
 * The document validator plugin. Listens for validation commands and applies
 * validation decorations to the document.
 */
const documentValidatorPlugin = (schema: Schema, throttleInMs = 1500) => {
  let localView: undefined | EditorView = undefined;
  const plugin: Plugin = new Plugin({
    state: {
      init(_, { doc }) {
        // getValidationRangesForDocument(doc);

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
          dirtiedRanges = [],
          validationPending = false
        }: PluginState
      ) {
        const isValidating = validationService.getRunningValidations().length;
        let _newDecorations = decorations.map(tr.mapping, tr.doc);
        const response: ValidationResponse = tr.getMeta(
          TransactionMetaKeys.VALIDATION_RESPONSE
        );

        if (response && response.validationOutputs.length) {
          _newDecorations = getNewDecorationsForValidationResponse(
            response,
            _newDecorations,
            [],
            tr
          );
        }

        // We need to aggregate ranges here, before we submit them to the
        // validation service. Effectively this means batching ranges; once
        // we're ready to submit we join the ranges, examine the document to
        // grab the relevant text and submit as usual.

        // if lastValidationTime < window
        // add to buffered ranges
        // else
        // collapse validation ranges
        // submit validations

        // Map our dirtied ranges through the current transaction, and append
        // any new ranges it has dirtied.
        const newDirtiedRanges = getMergedDirtiedRanges(tr, dirtiedRanges);
        const currentDirtiedRanges = getReplaceStepRangesFromTransaction(tr);
        const decorationsToAdd = currentDirtiedRanges.map(range =>
          Decoration.inline(
            range.from,
            range.to + 1,
            {
              class: "validation-dirty-range"
            },
            {
              type: "validation-dirty-range"
            }
          )
        );
        _newDecorations = _newDecorations.add(tr.doc, decorationsToAdd);

        let newValidationPending = false;
        if (newDirtiedRanges.length && !validationPending) {
          setTimeout(() => {
            localView &&
              localView.dispatch(
                localView.state.tr.setMeta("validate-ranges", true)
              );
          }, throttleInMs);
          newValidationPending = true;
        }

        let validationSent = false;
        if (tr.getMeta("validate-ranges")) {
          // Ditch any decorations marking dirty positions
          const decsToRemove = _newDecorations.find(
            undefined,
            undefined,
            _ => _.type === "validation-dirty-range"
          );
          _newDecorations = _newDecorations.remove(decsToRemove);
          validationSent = true;
        }

        // if (replaceRanges.length) {
        //   _bufferedTrs =
        //     bufferedTrs.length > 25
        //       ? bufferedTrs.slice(1).concat(tr)
        //       : bufferedTrs.concat(tr);
        //   const {
        //     decorations: prunedDecorations,
        //     rangesToValidate
        //   } = revalidationRangefinder(replaceRanges, _newDecorations, tr.doc);
        //   _newDecorations = prunedDecorations;
        //   getValidationRangesForRanges(rangesToValidate, tr);
        // }

        return {
          decorations: _newDecorations,
          isValidating,
          dirtiedRanges: validationSent ? [] : newDirtiedRanges,
          validationPending: validationSent
            ? false
            : newValidationPending || validationPending,
          hoverId: tr.getMeta("hoverId")
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
            if (newValidationId !== plugin.getState(view.state).hoverId) {
              view.dispatch(view.state.tr.setMeta("hoverId", newValidationId));
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
