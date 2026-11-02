/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_memberships")

  // update collection data
  unmarshal({
    "createRule": ""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_memberships")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.company = company && @request.auth.role ?= 'owner'"
  }, collection)

  return app.save(collection)
})
