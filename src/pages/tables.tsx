import { Page, Text, Icon } from "zmp-ui";
import logo from "@/images/logo.png";
import tableAvailable from "@/images/1.webp";
import tablePlaying from "@/images/table-playing.webp";
import tableReserved from "@/images/table-reserved.webp";
import { TbRosetteDiscountCheckFilled } from "react-icons/tb";
import { GiEightBall } from "react-icons/gi";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface TableInfo {
  id: string;
  name: string;
  status: "available" | "playing" | "reserved";
  currentUser?: string;
  timeRemaining?: number; // minutes
  price: number; // per hour
}

const MOCK_TABLES: TableInfo[] = [
  { id: "ban1", name: "Bàn 1", status: "playing", currentUser: "Hùng", timeRemaining: 210, price: 60000 },
  { id: "ban2", name: "Bàn 2", status: "available", price: 60000 },
  { id: "ban3", name: "Bàn 3", status: "reserved", price: 60000 },
  { id: "ban4", name: "Bàn 4", status: "available", price: 60000 },
  { id: "ban5", name: "Bàn 5", status: "playing", currentUser: "Minh", timeRemaining: 120, price: 70000 },
  { id: "ban6", name: "Bàn 6", status: "available", price: 70000 },
  { id: "ban7", name: "Bàn 7", status: "available", price: 70000 },
];

function TablesPage() {
  const navigate = useNavigate();
  const [isLoggedIn] = useState(true); // Mock login state

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-50 border-green-500 text-green-700";
      case "playing":
        return "bg-coral-50 border-coral-500 text-coral-700";
      case "reserved":
        return "bg-yellow-50 border-yellow-500 text-yellow-700";
      default:
        return "bg-slate-50 border-slate-500 text-slate-700";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available":
        return "Trống";
      case "playing":
        return "Đang chơi";
      case "reserved":
        return "Đã đặt";
      default:
        return "";
    }
  };

  const getTableImage = (status: string) => {
    switch (status) {
      case "available":
        return tableAvailable;
      case "playing":
        return tablePlaying;
      case "reserved":
        return tableReserved;
      default:
        return tableAvailable;
    }
  };

  const handleTableClick = (table: TableInfo) => {
    if (table.status === "available") {
      if (isLoggedIn) {
        // Navigate to booking confirmation or directly to playing page
        navigate(`/${table.id}`);
      } else {
        alert("Vui lòng đăng nhập để đặt bàn");
      }
    } else if (table.status === "playing") {
      // View only - can't interact
      return;
    }
  };

  return (
    <Page className="flex flex-col gap-4 bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
      {/* Header */}
      <div className="flex items-center rounded-b-2xl sticky top-0 border-b border-green-100 pb-2 shadow-sm z-10 bg-white/80 backdrop-blur-md justify-between px-4 pt-11">
        <div className="flex flex-col">
          <div className="flex gap-2 items-center">
            <img src={logo} className="w-10 h-10 shadow-md rounded-lg" />
            <div className="flex flex-col">
              <div className="flex font-semibold items-start text-[20px] text-slate-900">
                Tình trạng bàn{" "}
                <div className="flex text-green-500 ml-1">
                  <TbRosetteDiscountCheckFilled size={15} />
                </div>
              </div>
              <div className="flex text-[13px] text-slate-600">CULI BILLIARDS CLUB</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Legend */}
      <div className="px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <Text.Title size="small" className="text-slate-900 mb-3">
            Chú thích
          </Text.Title>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <Text size="xSmall" className="text-slate-700">Trống</Text>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-coral-500"></div>
              <Text size="xSmall" className="text-slate-700">Đang chơi</Text>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <Text size="xSmall" className="text-slate-700">Đã đặt</Text>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Grid - Pool Table Layout */}
      <div className="px-4 flex gap-2">
        {/* Left Column - 3 tables (bottom to top: Bàn 1, 2, 3) */}
        <div className="flex-1 space-y-3 flex flex-col-reverse">
          {MOCK_TABLES.slice(0, 3).map((table) => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              disabled={table.status === "playing" || table.status === "reserved"}
              className={`w-full aspect-[3/2] rounded-2xl overflow-hidden transition-all relative shadow-md ${
                table.status === "available" ? "hover:shadow-lg active:scale-98" : ""
              }`}
              style={{
                backgroundImage: `url(${getTableImage(table.status)})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Table info overlay */}
              <div className="absolute inset-0 flex items-center justify-center p-3 text-white z-10">
                <div className="flex items-center gap-3">
                  <GiEightBall size={40} className="drop-shadow-lg flex-shrink-0" />
                  <div className="flex flex-col">
                    <Text.Title className="font-bold text-[18px] drop-shadow-lg">
                      {table.name}
                    </Text.Title>
                    <Text size="xxSmall" className="font-semibold drop-shadow-lg">
                      {getStatusText(table.status)}
                    </Text>
                    {table.status === "playing" && table.timeRemaining && (
                      <Text size="xSmall" className="font-bold drop-shadow-lg">
                        {Math.floor(table.timeRemaining / 60)}h {table.timeRemaining % 60}m
                      </Text>
                    )}
                    {table.status === "available" && (
                      <Text size="xxSmall" className="drop-shadow-lg">
                        {table.price.toLocaleString("vi")}đ/giờ
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right Column - 4 tables (bottom to top: Bàn 4, 5, 6, 7) */}
        <div className="flex-1 space-y-3 flex flex-col-reverse">
          {MOCK_TABLES.slice(3, 7).map((table) => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              disabled={table.status === "playing" || table.status === "reserved"}
              className={`w-full aspect-[3/2] rounded-2xl overflow-hidden transition-all relative shadow-md ${
                table.status === "available" ? "hover:shadow-lg active:scale-98" : ""
              }`}
              style={{
                backgroundImage: `url(${getTableImage(table.status)})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Table info overlay */}
              <div className="absolute inset-0 flex items-center justify-center p-3 text-white z-10">
                <div className="flex items-center gap-3">
                  <GiEightBall size={40} className="drop-shadow-lg flex-shrink-0" />
                  <div className="flex flex-col">
                    <Text.Title className="font-bold text-[18px] drop-shadow-lg">
                      {table.name}
                    </Text.Title>
                    <Text size="xxSmall" className="font-semibold drop-shadow-lg">
                      {getStatusText(table.status)}
                    </Text>
                    {table.status === "playing" && table.timeRemaining && (
                      <Text size="xSmall" className="font-bold drop-shadow-lg">
                        {Math.floor(table.timeRemaining / 60)}h {table.timeRemaining % 60}m
                      </Text>
                    )}
                    {table.status === "available" && (
                      <Text size="xxSmall" className="drop-shadow-lg">
                        {table.price.toLocaleString("vi")}đ/giờ
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <div className="px-4 pb-4">
        <div className="bg-gradient-to-br from-green-50 to-coral-50 rounded-2xl p-4 border-2 border-green-200 shadow-sm">
          <Text.Title size="small" className="text-slate-900 font-bold mb-2">
            💡 Hướng dẫn
          </Text.Title>
          <Text size="xSmall" className="text-slate-700 leading-relaxed">
            • Bàn trống: Nhấn để đặt bàn (yêu cầu đăng nhập)<br/>
            • Đang chơi: Xem thông tin, không thể tương tác<br/>
            • Quét mã QR trên bàn để bắt đầu chơi ngay
          </Text>
        </div>
      </div>
    </Page>
  );
}

export default TablesPage;
