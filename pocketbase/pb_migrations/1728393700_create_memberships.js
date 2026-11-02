/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const snapshot = [
    {
      "id": "pbc_memberships",
      "name": "memberships",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id = user || @request.auth.company = company",
      "viewRule": "@request.auth.id = user || @request.auth.company = company",
      "createRule": "@request.auth.company = company && @request.auth.role ?= 'owner'",
      "updateRule": "@request.auth.company = company && @request.auth.role ?= 'owner'",
      "deleteRule": "@request.auth.company = company && @request.auth.role ?= 'owner'",
      "fields": [
        {
          "cascadeDelete": true,
          "collectionId": "_pb_users_auth_",
          "help": "",
          "hidden": false,
          "id": "relation_user",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "user",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": true,
          "collectionId": "pbc_companies",
          "help": "",
          "hidden": false,
          "id": "relation_company",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "company",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": true,
          "collectionId": "pbc_branches",
          "help": "",
          "hidden": false,
          "id": "relation_branch",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "branch",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "help": "",
          "hidden": false,
          "id": "select_role",
          "maxSelect": 1,
          "name": "role",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "select",
          "values": ["owner", "manager", "cashier", "staff", "customer"]
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool_active",
          "name": "active",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "bool"
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_user_company_branch ON memberships (user, company, branch) WHERE branch IS NOT NULL",
        "CREATE UNIQUE INDEX idx_user_company ON memberships (user, company) WHERE branch IS NULL"
      ]
    }
  ];

  return app.importCollections(snapshot, false);
}, (app) => {
  const collection = app.findCollectionByNameOrId("memberships");
  return app.delete(collection);
});
