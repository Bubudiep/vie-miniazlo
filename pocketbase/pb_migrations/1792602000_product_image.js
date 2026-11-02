/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const products = app.findCollectionByNameOrId("products")
  if (!products.fields.getByName("image")) {
    products.fields.add(new FileField({
      id: "file_product_image",
      name: "image",
      maxSize: 5 * 1024 * 1024,
      maxSelect: 1,
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      thumbs: ["300x300"],
      protected: false,
      required: false
    }))
  }
  app.save(products)
}, (app) => {
  const products = app.findCollectionByNameOrId("products")
  if (products.fields.getByName("image")) products.fields.removeByName("image")
  app.save(products)
})
