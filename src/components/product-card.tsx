import { useSetAtom } from "jotai";
import type { MouseEvent } from "react";
import { Icon, Text, useSnackbar } from "zmp-ui";

import { Product, Product2 } from "@/mock/products";
import { formatCurrency } from "@/utils/format";

function ProductCard({ product }: { product: Product2 }) {
  const { openSnackbar } = useSnackbar();
  const discountPercent = product.originalPrice
    ? Math.round(100 - (product.price / product.originalPrice) * 100)
    : undefined;
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#2a2a2c] dark:to-[#1c1c1e]">
        {product?.image ? (
          <img
            src={product?.image}
            className="object-cover w-full h-full flex items-center justify-center"
          />
        ) : (
          <Icon
            icon="zi-photo"
            size={32}
            className="text-slate-300 dark:text-white/20"
          />
        )}
        {discountPercent ? (
          <span className="absolute left-2 top-2 rounded-full bg-[#dc1f18] px-2 py-0.5 text-[11px] font-semibold text-white">
            -{discountPercent}%
          </span>
        ) : null}
        {product.badge ? (
          <span className="absolute right-2 top-2 rounded-full bg-[#006af5] px-2 py-0.5 text-[11px] font-semibold text-white">
            {product.badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-1 p-2.5">
        <Text
          size="small"
          className="line-clamp-1 text-[#141415] dark:text-[#f4f5f6]"
        >
          {product.name}
        </Text>
        <div className="flex items-end justify-between gap-1">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <Text size="small" bold className="text-[#dc1f18]">
                {formatCurrency(product.price)}
              </Text>
              {product.originalPrice ? (
                <Text size="xxSmall" className="text-[#b9bdc1] line-through">
                  {formatCurrency(product.originalPrice)}
                </Text>
              ) : null}
            </div>
            {product.sold ? (
              <Text
                size="xxSmall"
                className="text-[#767a7f] dark:text-[#8f9499]"
              >
                Đã bán {product.sold}
              </Text>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
