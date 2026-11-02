/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const username = users.fields.getByName("username")
  if (!username) throw new Error("users.username field was not found")

  username.pattern = "^[A-Za-z0-9._-]+$"
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  const username = users.fields.getByName("username")
  if (!username) return

  username.pattern = ""
  app.save(users)
})
