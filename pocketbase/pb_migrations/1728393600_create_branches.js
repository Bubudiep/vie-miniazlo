/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const snapshot = [
    {
      "id": "pbc_branches",
      "name": "branches",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.company = company",
      "viewRule": "@request.auth.company = company",
      "createRule": "@request.auth.company = company && @request.auth.role = 'owner'",
      "updateRule": "@request.auth.company = company && @request.auth.role ?= 'owner'",
      "deleteRule": "@request.auth.company = company && @request.auth.role = 'owner'",
      "fields": [
        {
          "cascadeDelete": false,
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
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text_name",
          "max": 200,
          "min": 1,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text_code",
          "max": 50,
          "min": 1,
          "name": "code",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text_address",
          "max": 500,
          "min": 0,
          "name": "address",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text_phone",
          "max": 20,
          "min": 0,
          "name": "phone",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
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
        },
        {
          "help": "",
          "hidden": false,
          "id": "number_sort_order",
          "max": null,
          "min": null,
          "name": "sort_order",
          "noDecimal": true,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_company_code ON branches (company, code)"
      ]
    }
  ];

  return app.importCollections(snapshot, false);
}, (app) => {
  const collection = app.findCollectionByNameOrId("branches");
  return app.delete(collection);
});
