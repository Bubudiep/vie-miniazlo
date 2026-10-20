import ProductCard from "@/components/product-card";
import React, { useState, useEffect } from "react";
import { Box, Page, Tabs, Text } from "zmp-ui";
import { useAuth } from "@/contexts/AuthContext";
import { productService } from "@/api/services";
import type { Product } from "@/api/pocketbase";

const Menu = () => {
  const { storeId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKind, setActiveKind] = useState<Product['kind'] | 'all'>('all');

  useEffect(() => {
    const loadProducts = async () => {
      if (!storeId) return;

      try {
        const result = await productService.list(storeId, 1, 100);
        setProducts(result.items);
      } catch (err) {
        console.error("Không thể tải sản phẩm", err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [storeId]);

  const filteredProducts = activeKind === 'all'
    ? products
    : products.filter(p => p.kind === activeKind);

  if (loading) {
    return (
      <Page className="flex items-center justify-center h-screen bg-slate-50">
        <Text>Đang tải...</Text>
      </Page>
    );
  }

  return (
    <Page className="flex flex-col gap-5 bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] dark:bg-black">
      <div className="flex items-center rounded-b-2xl sticky top-0 border-b border-green-100 pb-1 shadow-sm z-10 bg-white/80 backdrop-blur-md justify-between px-4 pt-12">
        <div className="flex flex-col">
          <Text.Title size="large" className="text-slate-900">Gian hàng tạo hóa</Text.Title>
          <Text.Title className="text-[13px] font-normal text-slate-600">
            Danh sách sản phẩm tham khảo
          </Text.Title>
        </div>
      </div>

      <div className="px-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveKind('all')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeKind === 'all'
                ? 'bg-green-500 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setActiveKind('food')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeKind === 'food'
                ? 'bg-green-500 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Đồ ăn
          </button>
          <button
            onClick={() => setActiveKind('drink')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeKind === 'drink'
                ? 'bg-green-500 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Đồ uống
          </button>
          <button
            onClick={() => setActiveKind('service')}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              activeKind === 'service'
                ? 'bg-green-500 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Dịch vụ
          </button>
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-200 pb-5 dark:border-white/10">
        {filteredProducts.length === 0 ? (
          <div className="px-4 text-center text-slate-500">
            <Text>Chưa có sản phẩm nào</Text>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
};

export default Menu;
