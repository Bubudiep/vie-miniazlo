# PocketBase Collections - Quick Import Guide

PocketBase đang chạy tại: http://127.0.0.1:8390/_/

## Cách tạo collections nhanh nhất:

### Option 1: Tạo từng collection qua UI (khuyến nghị)

Truy cập http://127.0.0.1:8390/_/ và tạo theo thứ tự:

**Bắt đầu với 5 collections cơ bản để test:**

1. **companies** (base)
   - name: text (required)
   - business_code: text
   - service_type: select (values: retail, restaurant, wholesale, service, other)
   - address: text

2. **customers** (base)
   - company: relation → companies (cascade delete)
   - name: text (required)
   - phone: text
   - email: email

3. **products** (base)
   - company: relation → companies (cascade delete)
   - name: text (required)
   - price: number (required)
   - kind: select (values: goods, food, drink)
   - is_active: bool

4. **floors** (base)
   - company: relation → companies (cascade delete)
   - name: text (required)
   - order: number

5. **tables** (base)
   - company: relation → companies (cascade delete)
   - floor: relation → floors (cascade delete)
   - name: text (required)
   - table_type: select (values: dining, billiards, karaoke, other)
   - status: select (values: available, occupied, reserved, cleaning)
   - capacity: number
   - is_active: bool

### Option 2: Tôi sẽ tạo script Node.js

Vì Python gặp vấn đề với PocketBase API, tôi có thể viết Node.js script để tự động tạo collections qua Admin SDK nếu bạn muốn.

---

## Bạn muốn:
- **A**: Tự tạo 5 collections cơ bản trên qua UI (5 phút) - sau đó tôi update frontend
- **B**: Tôi viết Node.js script tự động tạo tất cả collections (10 phút)

Chọn A hoặc B để tiếp tục.
