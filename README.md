# prosemirror-noting
This plugin adds the ability to have ranges added to the document that expand and contract around dependent on the input. These notes are represented as `marks` in the document.

---

## API
### createNoteMark(typeTagMap: string | object, attrGenerator: function): MarkType
Returns a mark to be added to the schema.

- `typeTagMap` - if this is passed with an object it expects a map between a "note type" and a dom tag (e.g. `{ note: "span.note"}`). Otherwise if a string is passed it will expect that string to be simply a tag name and the type will default to a type of `note`. Good for styling.
- `metaGenerator` - this will run when rendering the note to add derived DOM attributes from the meta data.

### toggleNote(type: string = "note"): CommandFunction
Returns a command used for toggling notes based on the cursor position.

- `type` - this will use the type to decide which note type to toggle if there are more than one.

Toggle note works in the following way:
- Selections
  - Completely inside a note - will slice the note
  - Completely outside a note - will add a note
  - Part inside and part outside - will extend the note
- Cursor
  - Inside a note - will remove the note
  - Outside a note - will start a note

### setNoteMeta(id: string, meta: object): CommandFunction
Returns a command to set the meta for a note id

- `id` - the string id of the note to edit.
- `meta` - an object that will be assigned to the current meta (i.e. will not overwrite keys it does not contain).

### noter(markType: MarkType, historyPlugin: Plugin, onNoteCreate: function = () => {}): Plugin
Returns the plugin to add to prosemirror  
- `markType` - the mark type that is being used in the schema to handle the notes.
- `historyPlugin` - pass the history plugin to handle undo / redo.
- `onNoteCreate` -  a callback that is called when a new note is added to the document.

## Roadmap
- Better documentation
- Use proper plugin state in order to expose the state of the notes
- Better CSS / decorations