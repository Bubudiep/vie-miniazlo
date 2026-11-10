/// <reference path="../pb_data/types.d.ts" />

const sameOwnerStore = '@request.auth.id != "" && user = @request.auth.id && store = @request.auth.store'
const adminOwnerStore = `${sameOwnerStore} && @request.auth.role = "admin"`

migrate((app) => {
  try {
    app.findCollectionByNameOrId("user_table_layouts")
    return
  } catch (_) {}

  const users = app.findCollectionByNameOrId("users")
  const stores = app.findCollectionByNameOrId("stores")
  const layouts = new Collection({
    type: "base",
    name: "user_table_layouts",
    fields: [
      new RelationField({ id: "relation_user_table_layout_user", name: "user", collectionId: users.id, required: true, minSelect: 1, maxSelect: 1, cascadeDelete: true }),
      new RelationField({ id: "relation_user_table_layout_store", name: "store", collectionId: stores.id, required: true, minSelect: 1, maxSelect: 1, cascadeDelete: true }),
      new JSONField({ id: "json_user_table_layout_positions", name: "positions", required: true, maxSize: 65536 }),
      new AutodateField({ id: "autodate_user_table_layout_created", name: "created", onCreate: true, onUpdate: false }),
      new AutodateField({ id: "autodate_user_table_layout_updated", name: "updated", onCreate: true, onUpdate: true })
    ],
    indexes: ["CREATE UNIQUE INDEX idx_user_table_layouts_user_store ON user_table_layouts (user, store)"],
    listRule: sameOwnerStore,
    viewRule: sameOwnerStore,
    createRule: adminOwnerStore,
    updateRule: adminOwnerStore,
    deleteRule: adminOwnerStore
  })
  app.save(layouts)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("user_table_layouts")) } catch (_) {}
})
