Project: CS2 SERVER MANAGEMENT SYSTEM

## 1. Tổng Quan Dự Án

### 1.1. Bối Cảnh & Vấn Đề
Trong cộng đồng Counter-Strike 2 (CS2), việc tổ chức các trận đấu tập (scrim) hoặc giải đấu bán chuyên thường gặp nhiều trở ngại thủ công:
- **Cấu hình server phức tạp**: Admin phải nhập hàng tá lệnh console để setup đúng thể thức (Competitive, Wingman, Overtime).
- **Quy trình Veto thủ công**: Hai đội trưởng thường phải "chat" với nhau để cấm chọn map, dễ gây nhầm lẫn và thiếu chuyên nghiệp.
- **Thiếu dữ liệu tập trung**: Kết quả trận đấu thường chỉ được chụp ảnh màn hình, không có hệ thống lưu trữ chỉ số (K/D, ADR, HS%) để phân tích phong độ lâu dài.
- **Skin Changer thủ công**: Người chơi thường phải gõ lệnh console để thay đổi skin, không có giao diện trực quan.

### 1.2. Giải Pháp Đề Xuất
Xây dựng nền tảng **"Automated CS2 Match Platform"**. Đây là một hệ thống khép kín nơi Web Server điều khiển Game Server.
- **Tự động hóa 100%**: Từ lúc tạo phòng đến lúc vào game.
- **Trải nghiệm Esports**: Giao diện Veto Map chuyên nghiệp như các giải đấu lớn.
- **Real-time**: Cập nhật tỉ số trực tiếp từ trong game ra ngoài web.

---

## 2. Kiến Trúc Kỹ Thuật (Technical Architecture)

Hệ thống hoạt động dựa trên mô hình **3-Way Handshake** giữa: **Client (Người dùng)** - **Web Server** - **Game Server (CS2)**.

### 2.1. Tech Stack
*   **Backend**: Node.js & Express.
    *   *Lý do*: Tối ưu cho các tác vụ I/O (Input/Output) như xử lý hàng trăm kết nối Socket và request HTTP từ Game Server đồng thời.
*   **Frontend**: React (Vite) + Tailwind CSS.
    *   *Lý do*: Cần một SPA (Single Page Application) để đảm bảo trạng thái Veto không bị reset khi reload trang.
*   **Database**: MySQL.
    *   *Lý do*: Dữ liệu có tính quan hệ cao (Một giải đấu có nhiều trận, một trận có nhiều người chơi, một người chơi có nhiều chỉ số).
*   **Game Server Integration**: Plugin **MatchZy** + giao thức **RCON**.

### 2.2. Luồng Dữ Liệu (Data Flow Diagram)

1.  **Giai đoạn Setup (Web)**:
    - Người chơi tạo phòng -> Mời thành viên -> Hệ thống chuyển sang trạng thái `VETO`.
    - Hai đội thực hiện Ban/Pick trên giao diện Web. Socket.io đồng bộ trạng thái này tới tất cả người xem.
2.  **Giai đoạn Handshake (Web -> Game)**:
    - Khi Veto xong, Backend tạo ra một file cấu hình JSON (chứa danh sách map, tên team, SteamID người chơi).
    - Backend gửi lệnh qua RCON tới Server CS2: *"Hãy tải file cấu hình từ URL này về và khởi động trận đấu"*.
3.  **Giai đoạn Gameplay (Game -> Web)**:
    - Trận đấu diễn ra trên CS2 Server.
    - Plugin **MatchZy** lắng nghe sự kiện (Round End, Match End, Series End).
    - MatchZy gửi HTTP POST Request (Webhook) ngược lại về Backend.
    - Backend nhận dữ liệu -> Lưu Database -> Bắn Socket update UI cho người dùng.

### 2.3. Module Skin Changer (Web-Based Customization)
Đây là tính năng cho phép người chơi tùy chỉnh giao diện vũ khí (Agents, Skins, Musics, Pins, Gloves, Knives) trên Web thay vì gõ lệnh trong game.
- **Cơ chế hoạt động**: Sử dụng chung Cơ sở dữ liệu với plugin **CS2 WeaponPaints**.
- **Luồng dữ liệu**:
    1. Người dùng chọn Skin trên Web (UI trực quan với hình ảnh).
    2. Web Server lưu thông tin vào bảng dữ liệu của plugin.
    3. Plugin trên CS2 Server đọc DB và áp dụng Skin tương ứng cho SteamID đó.

### 2.4. Content System (Posts & News)
Hệ thống quản lý nội dung cho phép Admin đăng thông báo giải đấu và người chơi tương tác.
- **Tính năng**: Tạo bài viết, Rich Text Editor, Comment, Like.
- **Mục đích**: Thông báo bảo trì, công bố giải đấu mới, hoặc Changelog cập nhật hệ thống.

### 2.5. Real-time Chat System
Hệ thống trò chuyện thời gian thực tích hợp Socket.io.
- **Phân loại kênh**:
    - **Lobby Chat**: Chat chung cho tất cả người chơi trong phòng chờ.
    - **Team Chat**: Kênh riêng tư chỉ thành viên cùng đội thấy (dùng cho chiến thuật).
    - **System Logs**: Thông báo tự động (Ví dụ: "Player A đã ban Map Mirage").
- **Lưu trữ**: Tin nhắn có thể lưu tạm thời trên RAM hoặc Database tùy nhu cầu lịch sử.

---

## 3. Phân Tích Chức Năng Cốt Lõi (Deep Dive)

### 3.1. Hệ Thống Veto (Map Veto System)
Đây là "bộ não" logic của ứng dụng.
- **Cấu hình động**: Hỗ trợ BO1 (Best of 1), BO3, BO5.
- **Logic**:
    - *BO1*: Team A Ban -> Team B Ban -> ... -> Còn 1 Map cuối cùng là map thi đấu.
    - *BO3*: Team A Ban -> Team B Ban -> Team A Pick -> Team B Pick -> ...
- **Xử lý bất đồng bộ**: Cần đảm bảo khi Team A bấm Ban, Team B phải thấy ngay lập tức (độ trễ < 100ms) để đảm bảo tính công bằng.

### 3.2. Cơ Chế Xác Thực (Authentication)
- Không sử dụng Email/Pass thông thường. Bắt buộc sử dụng **Steam OpenID**.
- Lợi ích: Lấy được chính xác `SteamID64`. Đây là khóa chính để hệ thống nhận diện người chơi khi họ tham gia vào Server CS2 (Server sẽ kick người lạ không có trong whitelist).

### 3.3. Thống Kê (Statistics Engine)
Dữ liệu không chỉ là Tỉ số (13-10). Hệ thống cần phân tích sâu:
- **ADR (Average Damage per Round)**: Sát thương trung bình.
- **KAST**: % số round có Kill, Assist, Survive hoặc Trade.
- **Entry Frags**: Số lần mở combat thành công.
- **HS%**: % số Kill có Headshot.
- **...**

*Dữ liệu này được parse từ JSON payload mà MatchZy gửi về sau mỗi round.*

---

## 4. Lộ Trình Phát Triển (Development Roadmap)

Dự kiến chia làm 5 Sprint (mỗi Sprint 1-2 tuần).

### Sprint 1: The Foundation (Nền Móng)
- **Mục tiêu**: Dựng khung server, kết nối Database, Đăng nhập Steam.
- **Output**:
    - User đăng nhập được, thông tin lưu vào DB.
    - Cấu trúc thư mục Backend/Frontend chuẩn MVC.

### Sprint 2: The Lobby & Socket (Phòng Chờ)
- **Mục tiêu**: Người dùng nhìn thấy nhau trong phòng chờ.
- **Output**:
    - Tạo trận đấu (Match Lobby).
    - **Chat System**: Tích hợp Chat chung và Team Chat (Chat kín).
    - Real-time update: A vào phòng, B thấy ngay lập tức.

### Sprint 3: The Veto Logic (Logic Cấm Chọn)
- **Mục tiêu**: Hoàn thiện quy trình Ban/Pick map.
- **Output**:
    - Giao diện VetoBoard.
    - Backend xử lý logic lượt đi (Turn-based logic).
    - Lưu kết quả map đã chọn vào DB.

### Sprint 4: The Bridge (Kết Nối Game Server)
- **Mục tiêu**: Web điều khiển được Game.
- **Output**:
    - Module RCON: Gửi lệnh `status`, `matchzy_load_match` từ web.
    - API Endpoint trả về config JSON cho MatchZy.
    - Quy trình tự động: Veto xong -> Server tự đổi map và load config.

### Sprint 5: Data Integration (Xử Lý Dữ Liệu)
- **Mục tiêu**: Hiển thị kết quả trận đấu.
- **Output**:
    - Webhook Receiver (`/api/matchzy/event`).
    - Bảng Scoreboard chi tiết sau trận.

### Sprint 6: Skin Changer Integration (Cá Nhân Hóa)
- **Mục tiêu**: Người chơi chỉnh skin trên web, vào game tự có skin.
- **Output**:
    - **Database Bridge**: Kết nối Web DB với cấu trúc bảng của Plugin `CS2 WeaponPaints`.
    - **Frontend UI**: Trang `SkinsChanger` với bộ lọc (Agents, Skins, Musics, Pins, Gloves, Knives) và xem trước hình ảnh.
    - **Sync Logic**: API update dữ liệu skin theo SteamID.

### Sprint 7: Community & Content (Cộng Đồng)
- **Mục tiêu**: Xây dựng kênh thông tin giữa Ban quản trị và Người chơi.
- **Output**:
    - **Post Management**: CRUD bài viết (Create, Read, Update, Delete) cho Admin.
    - **News Feed**: Trang chủ hiển thị tin tức mới nhất.
    - **Interactions**: Hệ thống Comment và Like đơn giản.

---
