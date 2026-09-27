import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon, useNavigate } from "zmp-ui";
import { HiHome } from "react-icons/hi2";
import { RiHome9Fill, RiHome9Line, RiNewspaperFill, RiNewspaperLine } from "react-icons/ri";
import { BsClockFill, BsClock } from "react-icons/bs";

interface TabItem {
  path: string;
  label: string;
  icon: any;
  activeIcon?: any;
}

const TABS: TabItem[] = [
  {
    path: "/home",
    label: "Bảng tin",
    icon: <RiNewspaperLine size={28} />,
    activeIcon: <RiNewspaperFill size={28} />,
  },
  {
    path: "/",
    label: "Đặt bàn",
    icon: <BsClock size={26} />,
    activeIcon: <BsClockFill size={26} />,
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
        className="mx-auto max-w-sm rounded-full border border-green-100/50 bg-white/70
        py-1.5 shadow-[0_8px_32px_-8px_rgba(26,182,135,0.25)] backdrop-blur-xl
        dark:border-green-500/20 dark:bg-slate-900/70"
      >
        <div className="relative flex items-center">
          <div
            className={`absolute left-0 top-1/2 h-[60px] rounded-full
            transition-all duration-300 ease-in-out bg-gradient-warm`}
            style={{
              width: `${pillWidth}px`,
              left: `calc(${activeIndex * slotWidth}% + (${slotWidth}% - ${pillWidth}px) / 2)`,
              transform: "translateY(-50%)",
              opacity: isStretching ? 0.3 : 1,
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
                      ? "text-white dark:text-white"
                      : "text-slate-500 dark:text-slate-400"
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
