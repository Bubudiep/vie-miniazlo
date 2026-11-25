/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("report_settings")
  if (!collection.fields.getByName("shift_type")) collection.fields.add(new NumberField({ id: "number_report_settings_shift_type", name: "shift_type", required: false, min: 2, max: 3, onlyInt: true, default: 2 }))
  if (!collection.fields.getByName("shifts")) collection.fields.add(new TextField({ id: "text_report_settings_shifts", name: "shifts", required: false, min: 0, max: 4000, pattern: "" }))
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("report_settings")
  collection.fields.removeByName("shift_type")
  collection.fields.removeByName("shifts")
  app.save(collection)
})
