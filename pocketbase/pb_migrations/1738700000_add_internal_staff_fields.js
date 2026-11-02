/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("_pb_users_auth_");

    // Thêm field is_internal vào users
    users.fields.addAt(0, new Field({
      id: "is_internal_field",
      name: "is_internal",
      type: "bool",
      required: false,
      options: {},
    }));

    // Thêm field employee_code vào users
    users.fields.addAt(1, new Field({
      id: "employee_code_field",
      name: "employee_code",
      type: "text",
      required: false,
      presentable: false,
      options: {
        min: null,
        max: 50,
        pattern: "",
      },
    }));

    return app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("_pb_users_auth_");

    // Remove fields
    users.fields.removeById("is_internal_field");
    users.fields.removeById("employee_code_field");

    return app.save(users);
  }
);
