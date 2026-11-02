import { useSetAtom } from "jotai";
import type { MouseEvent } from "react";
import { Icon, Text, useSnackbar } from "zmp-ui";

import pb, { type Product, type TableBillProduct } from "@/api/pocketbase";
import { formatCurrency } from "@/utils/format";

function ProductCard({ product }: { product: Product | TableBillProduct }) {
  const { openSnackbar } = useSnackbar();
  const billingUnit = "billingUnit" in product ? product.billingUnit : product.billing_unit;
  const unitLabel = "unitLabel" in product ? product.unitLabel : product.unit_label;
  const image = "image" in product ? product.image : undefined;
  const imageUrl = image ? pb.files.getURL({ id: product.id, collectionName: "products" }, image) : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#2a2a2c] dark:to-[#1c1c1e]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="object-cover w-full h-full flex items-center justify-center"
          />
        ) : (
          <Icon
            icon="zi-photo"
            size={32}
            className="text-slate-300 dark:text-white/20"
          />
        )}
        {product.category && (
          <span className="absolute right-2 top-2 rounded-full bg-[#006af5] px-2 py-0.5 text-[11px] font-semibold text-white">
            {product.category}
          </span>
        )}
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
                {formatCurrency(product.price)}{billingUnit === 'hour' ? '/giờ' : `/${unitLabel || (billingUnit === 'weight' ? 'kg' : 'lần')}`}
              </Text>
            </div>
          </div>
        </div>
        {product.description && (
          <Text
            size="xxSmall"
            className="text-[#767a7f] dark:text-[#8f9499] line-clamp-2"
          >
            {product.description}
          </Text>
        )}
      </div>
    </div>
  );
}

export default ProductCard;
