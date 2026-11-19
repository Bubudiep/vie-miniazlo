/// <reference path="../pb_data/types.d.ts" />

const ownAdminNotification = '@request.auth.id != "" && @request.auth.role = "admin" && recipient = @request.auth.id && store = @request.auth.store'

migrate((app) => {
  const collection = app.findCollectionByNameOrId("admin_notifications")
  collection.listRule = ownAdminNotification
  collection.viewRule = ownAdminNotification
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("admin_notifications")
  collection.listRule = null
  collection.viewRule = null
  app.save(collection)
})
