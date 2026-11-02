/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // Find the is_system_admin field and set required to false
  const field = collection.fields.getById("bool1791537000")
  if (field) {
    field.required = false
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // Rollback: set required back to true
  const field = collection.fields.getById("bool1791537000")
  if (field) {
    field.required = true
  }

  return app.save(collection)
})
