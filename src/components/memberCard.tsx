import { formatMinutes } from "@/utils/format";
import React from "react";
import { FaChevronRight } from "react-icons/fa";
import { GiEightBall } from "react-icons/gi";
import { RiVipCrown2Fill } from "react-icons/ri";
import { Box, Text } from "zmp-ui";

const MemberCard = () => {
  return (
    <div className="flex">
      <Box
        className="mx-4 w-full rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#6e2901,#000000)" }}
      >
        <div className="absolute flex gap-2 top-3 items-end right-4 flex-col">
          <Text size="xSmall" className="text-[#fff5] font-bold">
            #Tên người dùng
          </Text>
          <div
            className="flex text-[10px] items-center gap-1 
              font-medium rounded-xl px-2 p-1 bg-[#fff2] 
              text-orange-500 backdrop-blur-xl"
          >
            <RiVipCrown2Fill />
            Khách hàng thân thiết
          </div>
        </div>
        <Box className="absolute -right-6 -top-6 opacity-10">
          <GiEightBall size={140} className="text-orange-100" />
        </Box>
        <div className="flex absolute right-2 bottom-4 items-center">
          <FaChevronRight size={32} className="text-[#fff6]" />
        </div>
        <div className="text-orange-300 mb-2 text-[18px] font-medium">
          HỘI VIÊN CLUB
        </div>
        <Box className="flex items-baseline space-x-1.5 mt-3 relative">
          <Text.Title className="text-white text-[30px] font-bold">
            {(1000).toLocaleString("vi-VN") || "--"}
          </Text.Title>
          <Text className="text-gold mb-0.5">điểm</Text>
        </Box>
        <Text size="xSmall" className="text-gray-400 mt-4 relative">
          Thời gian: {formatMinutes(50)}
        </Text>
      </Box>
    </div>
  );
};

export default MemberCard;
