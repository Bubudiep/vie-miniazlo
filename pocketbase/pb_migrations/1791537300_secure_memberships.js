/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("memberships")

  unmarshal({
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("memberships")

  unmarshal({
    "listRule": "@request.auth.id = user || @request.auth.company = company",
    "viewRule": "@request.auth.id = user || @request.auth.company = company",
    "createRule": "@request.auth.company = company && @request.auth.role ?= 'owner'",
    "updateRule": "@request.auth.company = company && @request.auth.role ?= 'owner'",
    "deleteRule": "@request.auth.company = company && @request.auth.role ?= 'owner'"
  }, collection)

  return app.save(collection)
})
