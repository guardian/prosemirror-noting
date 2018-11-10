import { builders } from "prosemirror-test-builder";
import { nodes, marks } from "prosemirror-schema-basic";
import { Transaction } from "prosemirror-state";
import { Schema } from "prosemirror-model";
import {
  validationPluginReducer,
  validationRequestError,
  validationRequestPending,
  validationRequestStart,
  validationRequestSuccess,
  newHoverIdReceived
} from "../state";
import { DecorationSet } from "prosemirror-view";

const noteSchema = new Schema({
  nodes,
  marks
});

const build = builders(noteSchema, {
  p: {
    markType: "paragraph"
  }
});

const { doc, p } = build;

const initialState = {
  currentThrottle: 100,
  initialThrottle: 100,
  maxThrottle: 1000,
  decorations: DecorationSet.create(doc, []),
  dirtiedRanges: [],
  lastValidationTime: 0,
  hoverId: undefined,
  trHistory: [],
  validationInFlight: undefined,
  validationPending: false,
  error: undefined
};

describe("State management", () => {
  //   describe("validationRequestPending", () => {});
  //   describe("validationRequestStart", () => {});
  //   describe("validationRequestSuccess", () => {});
  //   describe("validationRequestError", () => {});
  describe("newHoverIdReceived", () => {
    it("should update the hover id", () => {
      expect(
        validationPluginReducer(
          new Transaction(doc),
          initialState,
          newHoverIdReceived("exampleHoverId")
        )
      ).toEqual({
        ...initialState,
        hoverId: "exampleHoverId"
      });
    });
  });
});
