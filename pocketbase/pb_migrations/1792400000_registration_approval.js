/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const companies = app.findCollectionByNameOrId("companies")

  const existingName = users.fields.getByName("full_name")
  if (existingName) {
    existingName.name = "fullname"
    existingName.max = 200
    unmarshal({ indexes: users.indexes.map((index) => index.replace(/`full_name`/g, "`fullname`")) }, users)
  } else {
    users.fields.add(new Field({ id: "text_registration_fullname", name: "fullname", type: "text", required: false, max: 200 }))
  }
  if (!users.fields.getByName("phone")) {
    users.fields.add(new Field({ id: "text_registration_phone", name: "phone", type: "text", required: false, max: 20 }))
  }
  if (!users.fields.getByName("is_approved")) {
    users.fields.add(new Field({ id: "bool_registration_approved", name: "is_approved", type: "bool", required: false }))
  }
  unmarshal({
    authRule: "is_approved = true",
    listRule: '@request.auth.id = id || (@request.auth.role = "admin" && @request.auth.company = company)',
    viewRule: '@request.auth.id = id || (@request.auth.role = "admin" && @request.auth.company = company)',
    updateRule: 'id = @request.auth.id',
    deleteRule: '@request.auth.role = "admin" && @request.auth.company = company',
  }, users)
  app.save(users)
  app.db().newQuery("UPDATE users SET is_approved = true WHERE is_approved = false").execute()

  companies.fields.add(new Field({ id: "bool_company_approval_required", name: "approval_required", type: "bool", required: false }))
  unmarshal({ updateRule: null, deleteRule: null }, companies)
  app.save(companies)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  const companies = app.findCollectionByNameOrId("companies")
  const oldName = users.fields.getById("text2958814687")
  if (oldName && oldName.name === "fullname") {
    oldName.name = "full_name"
    oldName.max = 50
    unmarshal({ indexes: users.indexes.map((index) => index.replace(/`fullname`/g, "`full_name`")) }, users)
  } else {
    users.fields.removeById("text_registration_fullname")
  }
  users.fields.removeById("text_registration_phone")
  users.fields.removeById("bool_registration_approved")
  unmarshal({
    authRule: "",
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    updateRule: 'id = @request.auth.id || @request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  }, users)
  app.save(users)
  companies.fields.removeById("bool_company_approval_required")
  unmarshal({ updateRule: null, deleteRule: null }, companies)
  app.save(companies)
})
