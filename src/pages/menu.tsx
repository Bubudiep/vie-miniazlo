import ProductCard from "@/components/product-card";
import React, { useState } from "react";
import { Box, Page, Tabs, Text } from "zmp-ui";
import { banners, products } from "@/mock/products";

const Menu = () => {
  const [tabActive, setTabActive] = useState("1");
  return (
    <Page className="flex flex-col gap-5 bg-white pb-[calc(env(safe-area-inset-bottom,0px)+96px)] dark:bg-black">
      <div className="flex items-center rounded-b-2xl sticky top-0 border-b border-slate-200 pb-1 shadow z-10 bg-white justify-between px-4 pt-12">
        <div className="flex flex-col">
          <Text.Title size="large">Gian hàng tạo hóa</Text.Title>
          <Text.Title className="text-[13px] font-normal">
            Danh sách sản phẩm tham khảo
          </Text.Title>
        </div>
      </div>
      <div className="space-y-3 border-b border-black/5 pb-5 dark:border-white/10">
        <div className="grid grid-cols-2 gap-3 px-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </Page>
  );
};

export default Menu;
