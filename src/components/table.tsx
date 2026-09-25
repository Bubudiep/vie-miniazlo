import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { GoDotFill } from "react-icons/go";
import { RiAppsFill } from "react-icons/ri";
import { formatElapsedClock } from "./../utils/format";
import { Box, Sheet } from "zmp-ui";
import { IoAlarm } from "react-icons/io5";
import { IoIosShareAlt } from "react-icons/io";
import { TbFileInfoFilled } from "react-icons/tb";
import { FaHeadphones } from "react-icons/fa";

const Table = () => {
  const [tableUsing, setTableUsing] = useState({ id: 0, startTime: dayjs() });
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!tableUsing) return;
    const id = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [tableUsing?.id]);
  const [tableOption, setTableOption] = useState(false);
  return (
    <>
      {tableUsing?.id ? (
        <div className="flex p-4 pt-0" onClick={() => setTableOption(true)}>
          <div className="flex flex-col rounded-2xl overflow-hidden shadow-sm bg-[#270601] text-white w-full">
            <div className="bg-[#270601] border-black flex justify-between items-center p-2 text-[18px]">
              <div className="font-bold items-center gap-1 flex">
                <GoDotFill className="text-orange-100" /> Bàn {tableUsing?.id}
              </div>
              <div className="flex items-center gap-1 text-orange-500 font-medium">
                {(80000).toLocaleString()} VNĐ
              </div>
            </div>
            <div
              style={{
                background: "linear-gradient(180deg, #270601, #000000)",
              }}
              className="flex text-[48px] font-bold text-slate-50 justify-center border-black border-b items-center p-6 pt-4 w-full"
            >
              {formatElapsedClock(tableUsing.startTime.toString())}
            </div>
            <div className="flex flex-col p-2 pt-1 bg-black text-gray-300">
              <div className="border-b border-[#fff4] mb-2" />
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-[50%]">Bimbim</td>
                    <td className="text-right">x1</td>
                    <td className="text-left text-gray-400">pcs</td>
                    <td className="text-right">
                      {(20000).toLocaleString("vi")}
                    </td>
                  </tr>
                  <tr>
                    <td>Bàn</td>
                    <td className="text-right">x1</td>
                    <td className="text-left text-gray-400">giờ</td>
                    <td className="text-right">
                      {(60000).toLocaleString("vi")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 border-b pt-4 border-t border-black/5 rounded-t-2xl pb-5 dark:border-white/10">
          <div className="flex justify-between px-4 items-center pb-2">
            <div className="text-[15px] font-medium">Danh sách bàn</div>
            <div
              className="flex"
              onClick={() =>
                setTableUsing({ id: 1, startTime: dayjs(new Date()) })
              }
            >
              <RiAppsFill size={20} className="text-gray-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 px-4">
            <div className="flex border rounded-xl flex-col">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-60">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t">
                <div className="font-bold text-slate-600">BÀN 1</div>
                <div className="text-blue-500 flex gap-1 items-center font-medium text-[13px]">
                  <GoDotFill />
                  Sãn sàng
                </div>
              </div>
            </div>
            <div className="flex border rounded-xl flex-col">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-60">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t">
                <div className="font-bold text-slate-600">BÀN 2</div>
                <div className="text-blue-500 flex gap-1 items-center font-medium text-[13px]">
                  <GoDotFill />
                  Sãn sàng
                </div>
              </div>
            </div>
            <div className="flex border rounded-xl flex-col">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-60">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t">
                <div className="font-bold text-slate-600">BÀN 3</div>
                <div className="text-blue-500 flex gap-1 items-center font-medium text-[13px]">
                  <GoDotFill />
                  Sãn sàng
                </div>
              </div>
            </div>
            <div className="flex border rounded-xl flex-col">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-60">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t">
                <div className="font-bold text-slate-600">BÀN 4</div>
                <div className="text-blue-500 flex gap-1 items-center font-medium text-[13px]">
                  <GoDotFill />
                  Sãn sàng
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Sheet
        visible={tableOption}
        onClose={() => setTableOption(false)}
        autoHeight
      >
        <Box className="px-4 pb-6 max-h-100 overflow-y-auto">
          <div className="flex items-center text-[18px] gap-3 border-b p-5">
            <IoAlarm size={24} />
            Gọi nhân viên
          </div>
          <div className="flex items-center text-[18px] gap-3 border-b p-5">
            <IoIosShareAlt size={24} />
            Share bill
          </div>
          <div className="flex items-center text-[18px] gap-3 border-b p-5">
            <TbFileInfoFilled size={24} />
            Thông tin
          </div>
          <div className="flex text-gray-400 gap-3 p-5 flex-col">
            Mọi thông tin góp ý hoặc phản ánh vui lòng gửi về chủ tiệm
            <div className="flex">
              <div className="border border-gray-300 shadow rounded-xl p-3 font-bold gap-2 text-[18px] text-gray-700 items-center flex">
                <FaHeadphones />
                0343.151.269
              </div>
            </div>
          </div>
        </Box>
      </Sheet>
    </>
  );
};

export default Table;
