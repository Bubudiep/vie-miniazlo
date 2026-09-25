import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon, useNavigate } from "zmp-ui";
import { HiHome } from "react-icons/hi2";
import { RiHome9Fill, RiHome9Line } from "react-icons/ri";

interface TabItem {
  path: string;
  label: string;
  icon: any;
  activeIcon?: any;
}

const TABS: TabItem[] = [
  {
    path: "/menu",
    label: "Menu",
    icon: (
      <Icon
        className="flex items-center justify-center"
        icon="zi-more-grid"
        size={28}
      />
    ),
    activeIcon: (
      <Icon
        className="flex items-center justify-center"
        icon="zi-more-grid-solid"
        size={28}
      />
    ),
  },
  {
    path: "/",
    label: "Trang chủ",
    icon: <RiHome9Line size={28} />,
    activeIcon: <RiHome9Fill size={28} />,
  },
  {
    path: "/account",
    label: "Tài khoản",
    icon: (
      <Icon
        className="flex items-center justify-center"
        icon="zi-user"
        size={28}
      />
    ),
    activeIcon: (
      <Icon
        className="flex items-center justify-center"
        icon="zi-user-solid"
        size={28}
      />
    ),
  },
];

const PILL_REST_WIDTH = 60;
const PILL_STRETCH_WIDTH = 120;

const TabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeIndex = useMemo(() => {
    const index = TABS.findIndex((tab) => tab.path === location.pathname);
    return index === -1 ? 0 : index;
  }, [location.pathname]);

  const [isStretching, setIsStretching] = useState(false);

  useEffect(() => {
    setIsStretching(true);
    const timer = setTimeout(() => setIsStretching(false), 220);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  const handleNavigate = (path: string, index: number) => {
    if (index === activeIndex) return;
    navigate(path, {
      animate: true,
      direction: index > activeIndex ? "forward" : "backward",
    });
  };

  if (location.pathname === "/cart") return null;

  const slotWidth = 100 / TABS.length;
  const pillWidth = isStretching ? PILL_STRETCH_WIDTH : PILL_REST_WIDTH;

  return (
    <nav
      className="fixed inset-x-4 z-40"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
    >
      <div
        className="mx-auto max-w-sm rounded-full border border-black/5 bg-white/25
        py-1.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.25)] backdrop-blur-md
        dark:border-white/10 dark:bg-[#141415]/70"
      >
        <div className="relative flex items-center">
          <div
            className={`absolute left-0 top-1/2 h-[60px] rounded-full
            transition-all dark:bg-[#52a0ff]/90 duration-300 ease-in-out`}
            style={{
              background: "linear-gradient(180deg, #c21a00, #000000)",
              width: `${pillWidth}px`,
              left: `calc(${activeIndex * slotWidth}% + (${slotWidth}% - ${pillWidth}px) / 2)`,
              transform: "translateY(-50%)",
              opacity: isStretching ? 0.2 : 1,
            }}
          />
          {TABS.map((tab, index) => {
            const active = index === activeIndex;
            return (
              <div
                key={tab.path}
                onClick={() => handleNavigate(tab.path, index)}
                className="relative z-10 flex-col flex flex-1 items-center justify-center py-1 h-[60px] "
              >
                <div
                  className={`${
                    active
                      ? "text-[#ff6017] dark:text-white"
                      : "text-[#662000] dark:text-[#8f9499]"
                  } flex items-center justify-center transition-all w-10 h-10 duration-300`}
                >
                  {active && tab.activeIcon ? tab.activeIcon : tab.icon}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default TabBar;
