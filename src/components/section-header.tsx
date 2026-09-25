import { Icon, Text } from "zmp-ui";

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4">
      <Text.Title size="small">{title}</Text.Title>
      <button
        type="button"
        onClick={onSeeAll}
        className="flex items-center gap-0.5 text-[13px] font-medium text-[#006af5] dark:text-[#52a0ff]"
      >
        Xem tất cả
        <Icon icon="zi-chevron-right" size={16} />
      </button>
    </div>
  );
}

export default SectionHeader;
