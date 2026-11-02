/// <reference path="../pb_data/types.d.ts" />

/**
 * Internal Staff Leaderboard API
 *
 * Endpoint: GET /api/leaderboard/:month
 * Phân quyền:
 * - Admin: xem toàn bộ
 * - Internal staff: xem top N + rank của mình
 * - User thường: 403 Forbidden
 */

const RATE_KEYS = ["r100", "r130", "r150", "r200", "r270", "r300", "r390"];

function sumBuckets(summary) {
  if (!summary || typeof summary !== "object") return 0;
  let total = 0;
  for (const key of RATE_KEYS) {
    total += Math.max(0, Number(summary[key]) || 0);
  }
  return total;
}

function latestByWorker(items) {
  const result = new Map();
  for (const item of items) {
    if (!item.user) continue;
    const current = result.get(item.user);
    if (!current || Number(item.round_no || 0) > Number(current.round_no || 0)) {
      result.set(item.user, item);
    }
  }
  return result;
}

routerAdd("GET", "/api/leaderboard/:month", (c) => {
  const month = c.pathParam("month");
  const auth = c.get("authRecord");

  if (!auth) {
    return c.json(401, { error: "Cần đăng nhập" });
  }

  const isAdmin = auth.get("role") === "admin";
  const isInternal = auth.get("is_internal") === true;

  if (!isAdmin && !isInternal) {
    return c.json(403, { error: "Chỉ nhân viên nội bộ mới được xem bảng xếp hạng" });
  }

  try {
    // Lấy attendance items của tháng
    const attendanceItems = $app.dao().findRecordsByFilter(
      "check_attendance_items",
      `month = {:month}`,
      "-created",
      500,
      0,
      { month: month }
    );

    // Lấy salary items của tháng (backup source)
    const salaryItems = $app.dao().findRecordsByFilter(
      "check_salary_items",
      `month = {:month}`,
      "-created",
      500,
      0,
      { month: month }
    );

    // Chọn bản ghi mới nhất theo round_no
    const attendanceByUser = latestByWorker(attendanceItems);
    const salaryByUser = latestByWorker(salaryItems);

    // Lấy thông tin users nội bộ
    const internalUsers = $app.dao().findRecordsByFilter(
      "users",
      "is_internal = true",
      "fullname",
      1000,
      0
    );

    const internalUserIds = new Set(internalUsers.map(u => u.id));

    // Tính giờ cho từng internal user
    const stats = [];
    for (const user of internalUsers) {
      const attendanceItem = attendanceByUser.get(user.id);
      const salaryItem = salaryByUser.get(user.id);

      if (!attendanceItem && !salaryItem) continue;

      const sourceItem = attendanceItem || salaryItem;
      const hours = attendanceItem
        ? sumBuckets(attendanceItem.get("summary"))
        : 0;

      stats.push({
        userId: user.id,
        fullName: user.get("fullname") || user.get("username") || "Chưa có tên",
        employeeCode: user.get("employee_code") || "Chưa có",
        hours: hours,
        roundNo: Number(sourceItem.get("round_no") || 0)
      });
    }

    // Sắp xếp theo giờ giảm dần
    stats.sort((a, b) => b.hours - a.hours);

    // Lấy cài đặt số lượng hiển thị (mặc định 10)
    let topLimit = 10;
    try {
      const settings = $app.dao().findFirstRecordByFilter("settings", "key = 'leaderboard_top_limit'");
      topLimit = Number(settings.get("value")) || 10;
    } catch (e) {
      // Không có setting, dùng mặc định
    }

    // Build leaderboard response
    const leaderboard = [];
    let currentUserRank = null;
    let currentUserData = null;

    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const rank = i + 1;

      if (stat.userId === auth.id) {
        currentUserRank = rank;
        currentUserData = {
          rank: rank,
          userId: stat.userId,
          fullName: stat.fullName,
          employeeCode: stat.employeeCode,
          hours: stat.hours,
          isCurrentUser: true
        };
      }

      // Admin xem tất cả, user thường chỉ xem top N
      if (isAdmin || rank <= topLimit || stat.userId === auth.id) {
        leaderboard.push({
          rank: rank,
          userId: stat.userId,
          fullName: stat.fullName,
          employeeCode: stat.employeeCode,
          hours: stat.hours,
          isCurrentUser: stat.userId === auth.id
        });
      }
    }

    // Nếu user không nằm trong top, thêm riêng
    if (currentUserRank && currentUserRank > topLimit && !isAdmin) {
      const filtered = leaderboard.filter(item => !item.isCurrentUser);
      return c.json(200, {
        month: month,
        topLimit: topLimit,
        total: stats.length,
        leaderboard: filtered,
        currentUser: currentUserData
      });
    }

    return c.json(200, {
      month: month,
      topLimit: topLimit,
      total: stats.length,
      leaderboard: leaderboard,
      currentUser: currentUserData
    });

  } catch (e) {
    console.error("Leaderboard error:", e);
    return c.json(500, { error: "Lỗi khi lấy dữ liệu bảng xếp hạng" });
  }
});
