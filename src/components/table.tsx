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
          <div className="flex flex-col rounded-2xl overflow-hidden shadow-lg border-l-4 border-green-500 bg-white w-full">
            <div className="bg-green-50 border-b border-green-100 flex justify-between items-center p-3 text-[18px]">
              <div className="font-bold items-center gap-1 flex text-slate-800">
                <GoDotFill className="text-green-500" /> Bàn {tableUsing?.id}
              </div>
              <div className="flex items-center gap-1 text-coral-600 font-bold">
                {(80000).toLocaleString()} VNĐ
              </div>
            </div>
            <div
              className="flex text-[52px] font-bold text-green-600 justify-center border-b border-slate-100 items-center p-6 pt-5 w-full bg-gradient-to-b from-white to-green-50/30"
            >
              {formatElapsedClock(tableUsing.startTime.toString())}
            </div>
            <div className="flex flex-col p-3 pt-2 bg-slate-50 text-slate-700">
              <div className="border-b border-slate-200 mb-2" />
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="w-[50%] font-medium">Bimbim</td>
                    <td className="text-right text-slate-600">x1</td>
                    <td className="text-left text-slate-500 text-sm">pcs</td>
                    <td className="text-right font-semibold">
                      {(20000).toLocaleString("vi")}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">Bàn</td>
                    <td className="text-right text-slate-600">x1</td>
                    <td className="text-left text-slate-500 text-sm">giờ</td>
                    <td className="text-right font-semibold">
                      {(60000).toLocaleString("vi")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 border-b pt-4 border-t border-slate-200 rounded-t-2xl pb-5 dark:border-white/10">
          <div className="flex justify-between px-4 items-center pb-2">
            <div className="text-[16px] font-semibold text-slate-800">Danh sách bàn</div>
            <div
              className="flex"
              onClick={() =>
                setTableUsing({ id: 1, startTime: dayjs(new Date()) })
              }
            >
              <RiAppsFill size={20} className="text-slate-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 px-4">
            <div className="flex border-2 border-green-200 rounded-xl flex-col bg-green-50/30 hover:bg-green-50 transition-colors">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-50">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t border-green-200 bg-white">
                <div className="font-bold text-slate-700">BÀN 1</div>
                <div className="text-green-600 flex gap-1 items-center font-semibold text-[13px]">
                  <GoDotFill />
                  Sẵn sàng
                </div>
              </div>
            </div>
            <div className="flex border-2 border-green-200 rounded-xl flex-col bg-green-50/30 hover:bg-green-50 transition-colors">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-50">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t border-green-200 bg-white">
                <div className="font-bold text-slate-700">BÀN 2</div>
                <div className="text-green-600 flex gap-1 items-center font-semibold text-[13px]">
                  <GoDotFill />
                  Sẵn sàng
                </div>
              </div>
            </div>
            <div className="flex border-2 border-green-200 rounded-xl flex-col bg-green-50/30 hover:bg-green-50 transition-colors">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-50">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t border-green-200 bg-white">
                <div className="font-bold text-slate-700">BÀN 3</div>
                <div className="text-green-600 flex gap-1 items-center font-semibold text-[13px]">
                  <GoDotFill />
                  Sẵn sàng
                </div>
              </div>
            </div>
            <div className="flex border-2 border-green-200 rounded-xl flex-col bg-green-50/30 hover:bg-green-50 transition-colors">
              <div className="flex w-full items-center justify-center">
                <div className="flex w-20 overflow-hidden py-1 pb-4 opacity-50">
                  <img
                    src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col p-2 border-t border-green-200 bg-white">
                <div className="font-bold text-slate-700">BÀN 4</div>
                <div className="text-green-600 flex gap-1 items-center font-semibold text-[13px]">
                  <GoDotFill />
                  Sẵn sàng
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
