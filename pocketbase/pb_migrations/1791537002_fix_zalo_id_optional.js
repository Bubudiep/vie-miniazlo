/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // Find zalo_id field and set required to false
  for (let i = 0; i < collection.fields.length; i++) {
    const field = collection.fields[i]
    if (field.name === "zalo_id") {
      field.required = false
      break
    }
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // Rollback: set required back to true
  for (let i = 0; i < collection.fields.length; i++) {
    const field = collection.fields[i]
    if (field.name === "zalo_id") {
      field.required = true
      break
    }
  }

  return app.save(collection)
})
