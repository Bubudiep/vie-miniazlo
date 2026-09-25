import { Box, Icon, Page, Swiper, Text } from "zmp-ui";
import { banners, offers } from "@/mock/products";
import SectionHeader from "@/components/section-header";
import logo from "@/images/logo.png";
import { TbRosetteDiscountCheckFilled } from "react-icons/tb";
import { GiEightBall } from "react-icons/gi";
import { formatCurrency, formatDateTime, formatMinutes } from "@/utils/format";
import { GoDotFill } from "react-icons/go";
import { FaChevronRight } from "react-icons/fa";
import { RiAppsFill, RiVipCrown2Fill } from "react-icons/ri";
import MemberCard from "@/components/memberCard";
import { useState } from "react";
import Table from "@/components/table";

function HomePage() {
  return (
    <Page className="flex flex-col gap-4 bg-white pb-[calc(env(safe-area-inset-bottom,0px)+96px)] dark:bg-black">
      <div
        className="flex items-center rounded-b-2xl sticky top-0 border-b border-slate-200 pb-1 shadow z-10 bg-white 
        justify-between px-4 pt-11"
      >
        <div className="flex flex-col">
          <div className="flex gap-2">
            <img src={logo} className="w-10 h-10 shadow-md rounded-md" />
            <div className="flex flex-col">
              <div className="flex font-medium items-start text-[22px]">
                CULI BILLIARDS CLUB{" "}
                <div className="flex text-blue-500 ml-1">
                  <TbRosetteDiscountCheckFilled size={15} />
                </div>
              </div>
              <div className="flex text-[15px] text-gray-500">Club of club</div>
            </div>
          </div>
          <Text.Title className="text-[13px] font-normal">
            Xin chào, <div className="font-medium inline-block">Hùng</div>
          </Text.Title>
        </div>
      </div>
      <div className="flex px-4 my-1">
        <Swiper autoplay loop duration={3500}>
          {banners.map((banner) => (
            <Swiper.Slide key={banner.id}>
              <div
                className={`flex h-44 relative flex-col justify-center gap-1 rounded-2xl 
                  overflow-hidden bg-gradient-to-br ${banner.gradient}`}
              >
                <img
                  src={banner?.image}
                  className="w-full h-full object-cover absolute top-0 left-0"
                />
                <div className="flex mt-auto flex-col z-10 bg-[#0003] backdrop-blur-sm px-3 py-2 gap-1">
                  <Text
                    bold
                    size="xLarge"
                    className="text-white text-[22px] flex mt-auto"
                  >
                    {banner.title}
                  </Text>
                  <Text size="small" className="text-white/85 mt-0.5">
                    {banner.subtitle}
                  </Text>
                </div>
              </div>
            </Swiper.Slide>
          ))}
        </Swiper>
      </div>
      <div className="space-y-3 pb-2 dark:border-white/10">
        <SectionHeader title="Sự kiện" />
        <div className="flex gap-3 overflow-x-auto px-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex min-w-[168px] items-center gap-2.5 rounded-2xl border border-dashed border-[#006af5]/40 bg-[#006af5]/5 p-3 dark:bg-[#52a0ff]/10"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#006af5]/10 text-[#006af5] dark:bg-[#52a0ff]/15 dark:text-[#52a0ff]">
                <Icon icon={offer.icon} />
              </div>
              <div className="min-w-0">
                <Text size="small" bold className="truncate">
                  {offer.title}
                </Text>
                <Text
                  size="xxSmall"
                  className="truncate text-[#767a7f] dark:text-[#8f9499]"
                >
                  {offer.description}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </div>
      <MemberCard />
      <Table />
    </Page>
  );
}

export default HomePage;
