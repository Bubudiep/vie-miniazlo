import { useState } from "react";
import { Box, Icon, Page, Text, Sheet, Button } from "zmp-ui";
import { formatElapsedClock } from "@/utils/format";
import dayjs from "dayjs";
import { GiEightBall } from "react-icons/gi";
import { IoGift, IoClose, IoArrowBack } from "react-icons/io5";
import { FaFire } from "react-icons/fa";
import { MdQrCode2 } from "react-icons/md";
import logo from "@/images/logo.png";
import { useParams, useNavigate } from "react-router-dom";

const MOCK_OFFERS = [
  {
    id: 1,
    title: "Giảm 20% đồ uống",
    desc: "Áp dụng từ 14h-17h",
    icon: "zi-star",
  },
  {
    id: 2,
    title: "Tặng 1 giờ chơi",
    desc: "Khi nạp 5 giờ",
    icon: "zi-clock-1",
  },
  { id: 3, title: "Free snack", desc: "Cho đơn trên 200k", icon: "zi-poll" },
];

const MOCK_MENU_HOT = [
  {
    id: 1,
    name: "Sting dâu",
    price: 15000,
    image: "https://via.placeholder.com/80",
  },
  {
    id: 2,
    name: "Bimbim",
    price: 10000,
    image: "https://via.placeholder.com/80",
  },
];

const MOCK_MENU_ALL = [
  {
    id: 3,
    name: "Coca Cola",
    price: 12000,
    image: "https://via.placeholder.com/80",
  },
  { id: 4, name: "7Up", price: 12000, image: "https://via.placeholder.com/80" },
  {
    id: 5,
    name: "Pepsi",
    price: 12000,
    image: "https://via.placeholder.com/80",
  },
];

const BILL_SERVICES = [
  { name: "Nước ngọt", quantity: 2, price: 15000 },
  { name: "Bimbim", quantity: 3, price: 10000 },
  { name: "Gậy thuê", quantity: 1, price: 20000 },
  { name: "Tiền bàn", quantity: 1, price: 60000 },
];

function PlayingPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("offers");
  const [showBill, setShowBill] = useState(false);
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const startTime = dayjs().subtract(1, "hour").subtract(23, "minute");
  const endTime = dayjs();
  const hoursRemaining = 3.5;
  const timeToReward = 37; // minutes

  const billTotal = BILL_SERVICES.reduce(
    (sum, service) => sum + service.price * service.quantity,
    0,
  );

  // Get table name from tableId
  const tableName = tableId
    ? `Bàn ${tableId.replace("ban", "")}`
    : "Bàn không xác định";

  return (
    <Page className="flex flex-col bg-slate-50 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
      {/* Header */}
      <div className="bg-white border-b border-green-100 shadow-sm sticky top-0 z-10 pt-11 pb-3 px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <IoArrowBack size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div>
              <Text.Title className="text-[16px] font-semibold text-slate-900">
                {tableName}
              </Text.Title>
            </div>
          </div>
          <div className="w-9"></div>
        </div>

        <div className="flex items-center justify-between mt-3 bg-gradient-to-r from-green-50 to-coral-50 rounded-xl p-3 border border-green-200">
          <div>
            <Text size="xSmall" className="text-slate-600">
              Thời gian còn lại
            </Text>
            <Text.Title className="text-green-600 text-[20px] font-bold">
              {hoursRemaining} giờ
            </Text.Title>
          </div>
          <button className="bg-coral-500 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md hover:bg-coral-600 transition-colors">
            Nạp thêm
          </button>
        </div>
      </div>

      {/* Body - Table Image */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-green-50/50 to-transparent opacity-60" />
            <div className="flex items-center justify-center py-8 relative">
              <div className="relative">
                <GiEightBall
                  size={120}
                  className="text-green-600 opacity-20 absolute -top-4 -left-4"
                />
                <img
                  src="https://cdn-icons-png.magnific.com/512/15005/15005573.png"
                  className="w-32 h-20 object-contain relative z-10"
                  alt="Billiard Table"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white to-green-50/30 p-4 border-t border-green-100">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <Text size="xSmall" className="text-slate-600 mb-1">
                  Giờ bắt đầu
                </Text>
                <Text.Title className="text-slate-900 font-bold text-[20px]">
                  {startTime.format("HH:mm")}
                </Text.Title>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex flex-col justify-center">
                <div className="flex items-center gap-1 mb-0.5">
                  <IoGift className="text-yellow-600 text-sm" />
                  <Text size="xxSmall" className="text-slate-600">
                    Nhận quà
                  </Text>
                </div>
                <Text.Title className="text-yellow-700 font-bold text-[16px]">
                  Còn {timeToReward} phút
                </Text.Title>
              </div>
            </div>

            <button
              onClick={() => setShowBill(true)}
              className="w-full bg-coral-500 hover:bg-coral-600 text-white font-semibold py-3 rounded-xl transition-colors shadow-md"
            >
              Thanh toán
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("offers")}
              className={`flex-1 py-3 text-center font-semibold transition-colors ${
                activeTab === "offers"
                  ? "text-green-600 border-b-2 border-green-500"
                  : "text-slate-600"
              }`}
            >
              Ưu đãi
            </button>
            <button
              onClick={() => setActiveTab("menu")}
              className={`flex-1 py-3 text-center font-semibold transition-colors ${
                activeTab === "menu"
                  ? "text-green-600 border-b-2 border-green-500"
                  : "text-slate-600"
              }`}
            >
              Gọi đồ
            </button>
          </div>

          <div className="p-4">
            {activeTab === "offers" ? (
              <div className="space-y-3">
                {MOCK_OFFERS.map((offer) => (
                  <div
                    key={offer.id}
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-coral-50 rounded-xl border border-green-200"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral-100 text-coral-600">
                      <Icon icon={offer.icon as any} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text size="small" bold className="text-slate-900">
                        {offer.title}
                      </Text>
                      <Text size="xxSmall" className="text-slate-600">
                        {offer.desc}
                      </Text>
                    </div>
                  </div>
                ))}
                <button className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors">
                  Xem toàn bộ ưu đãi
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Hot Section */}
                <div>
                  <div className="flex items-center gap-1 mb-3">
                    <FaFire className="text-coral-500" />
                    <Text.Title size="small" className="text-slate-900">
                      Hot
                    </Text.Title>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {MOCK_MENU_HOT.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200 overflow-hidden"
                      >
                        <div className="aspect-square bg-white p-2">
                          <img
                            src={item.image}
                            className="w-full h-full object-cover rounded-lg"
                            alt={item.name}
                          />
                        </div>
                        <div className="p-2">
                          <Text size="small" bold className="text-slate-900">
                            {item.name}
                          </Text>
                          <Text
                            size="xSmall"
                            className="text-coral-600 font-semibold"
                          >
                            {item.price.toLocaleString("vi")}đ
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* All Section */}
                <div>
                  <Text.Title size="small" className="text-slate-900 mb-3">
                    Toàn bộ
                  </Text.Title>
                  <div className="space-y-2">
                    {MOCK_MENU_ALL.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <img
                          src={item.image}
                          className="w-12 h-12 object-cover rounded-lg"
                          alt={item.name}
                        />
                        <div className="flex-1">
                          <Text size="small" className="text-slate-900">
                            {item.name}
                          </Text>
                          <Text
                            size="xSmall"
                            className="text-slate-600 font-semibold"
                          >
                            {item.price.toLocaleString("vi")}đ
                          </Text>
                        </div>
                        <button className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg font-medium">
                          Gọi
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill Sheet */}
      <Sheet
        visible={showBill}
        onClose={() => {
          setShowBill(false);
          setShowPaymentMethod(false);
          setShowQR(false);
        }}
        autoHeight
        swipeToClose
      >
        <Box className="px-4 pb-6 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between py-4 border-b border-slate-200">
            <Text.Title className="text-slate-900 font-bold text-[18px]">
              Thông tin thanh toán
            </Text.Title>
            <button
              onClick={() => {
                setShowBill(false);
                setShowPaymentMethod(false);
                setShowQR(false);
              }}
              className="text-slate-600"
            >
              <IoClose size={24} />
            </button>
          </div>

          {!showQR ? (
            <>
              {/* Bill Info */}
              <div className="py-4 space-y-3">
                <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                  <div className="flex justify-between items-center mb-2">
                    <Text size="small" className="text-slate-600">
                      Bàn số
                    </Text>
                    <Text.Title className="text-slate-900 font-bold">
                      {tableName}
                    </Text.Title>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <Text size="small" className="text-slate-600">
                      Thời gian bắt đầu
                    </Text>
                    <Text className="text-slate-900 font-semibold">
                      {startTime.format("HH:mm")}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text size="small" className="text-slate-600">
                      Thời gian kết thúc
                    </Text>
                    <Text className="text-slate-900 font-semibold">
                      {endTime.format("HH:mm")}
                    </Text>
                  </div>
                </div>

                {/* Services */}
                <div>
                  <Text.Title size="small" className="text-slate-900 mb-2">
                    Dịch vụ sử dụng
                  </Text.Title>
                  <div className="space-y-2">
                    {BILL_SERVICES.map((service, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 border-b border-slate-100"
                      >
                        <div className="flex-1">
                          <Text size="small" className="text-slate-900">
                            {service.name}
                          </Text>
                          <Text size="xxSmall" className="text-slate-600">
                            {service.price.toLocaleString("vi")}đ x{" "}
                            {service.quantity}
                          </Text>
                        </div>
                        <Text className="text-slate-900 font-semibold">
                          {(service.price * service.quantity).toLocaleString(
                            "vi",
                          )}
                          đ
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="bg-slate-100 rounded-xl p-4 flex justify-between items-center">
                  <Text.Title className="text-slate-900 font-bold text-[16px]">
                    Tổng cộng
                  </Text.Title>
                  <Text.Title className="text-coral-600 font-bold text-[20px]">
                    {billTotal.toLocaleString("vi")}đ
                  </Text.Title>
                </div>
              </div>

              {/* Payment Button */}
              {!showPaymentMethod ? (
                <button
                  onClick={() => setShowPaymentMethod(true)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-colors"
                >
                  Thanh toán
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowQR(true)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <MdQrCode2 size={20} />
                    Chuyển khoản
                  </button>
                  <button
                    onClick={() => alert("Trừ số dư tài khoản")}
                    className="w-full bg-coral-500 hover:bg-coral-600 text-white font-semibold py-4 rounded-xl transition-colors"
                  >
                    Trừ số dư tài khoản
                  </button>
                </div>
              )}
            </>
          ) : (
            // QR Code View
            <div className="py-4">
              <div className="flex flex-col items-center space-y-4">
                <Text.Title className="text-slate-900 font-bold text-[18px]">
                  Quét mã để thanh toán
                </Text.Title>
                <div className="bg-white p-4 rounded-xl border-2 border-green-200 shadow-lg">
                  <div className="w-64 h-64 bg-slate-100 rounded-lg flex items-center justify-center">
                    <MdQrCode2 size={200} className="text-slate-400" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <Text className="text-slate-900 font-semibold text-[16px]">
                    Số tiền:{" "}
                    <span className="text-coral-600">
                      {billTotal.toLocaleString("vi")}đ
                    </span>
                  </Text>
                  <Text size="small" className="text-slate-600">
                    Ngân hàng: MB Bank
                  </Text>
                  <Text size="small" className="text-slate-600">
                    STK: 0343151269
                  </Text>
                </div>
                <button
                  onClick={() => {
                    setShowQR(false);
                    setShowPaymentMethod(false);
                  }}
                  className="w-full bg-slate-500 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Quay lại
                </button>
              </div>
            </div>
          )}
        </Box>
      </Sheet>
    </Page>
  );
}

export default PlayingPage;
