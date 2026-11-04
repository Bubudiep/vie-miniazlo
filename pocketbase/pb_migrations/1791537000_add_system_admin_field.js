/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  let existing = null
  for (let i = 0; i < collection.fields.length; i++) {
    const field = collection.fields[i]
    if (field.id === "bool1791537000" || field.name === "is_system_admin") {
      existing = field
      break
    }
  }
  if (!existing) collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "bool1791537000",
    "max": 0,
    "min": 0,
    "name": "is_system_admin",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "bool",
    "default": false
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")
  collection.fields.removeById("bool1791537000")
  return app.save(collection)
})
