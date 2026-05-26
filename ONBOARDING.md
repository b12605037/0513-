# meetime — 專案上下文文件

## 這是什麼

**meetime** 是一個「找時間」工具，讓發起人建立活動並選擇候選日期＆時段，邀請參加者填寫自己的可用時間，系統找出最佳重疊時段。

Live URL：`https://meetime-sigma.vercel.app`  
GitHub：`https://github.com/b12605037/0513-`  
本地路徑：`C:\Users\yoyol\Desktop\timeful`

---

## 技術棧

| 層 | 技術 |
|---|---|
| 前端框架 | React 19 + Vite |
| 路由 | react-router-dom v7 |
| 後端 / DB | Supabase（PostgreSQL） |
| CSS | 全部 inline style（無 CSS modules，`src/index.css` 只有少數全域 class） |
| 部署 | Vercel |
| RWD 斷點 | `useDesktop()` hook：`window.innerWidth >= 768px` = 電腦版 |

---

## 檔案結構（重要檔案）

```
src/
  screens/
    Home.jsx          ← 首頁（主要工作目標）
    TimeGrid.jsx      ← 參加者填寫時間格
    ViewResults.jsx   ← 查看結果
    Join.jsx          ← 加入活動
    Confirm.jsx       ← 確認頁
    Results.jsx       ← 結果頁
    SignIn.jsx        ← 登入
    CreateEvent.jsx   ← 建立活動（舊版，目前不使用）
  hooks/
    useDesktop.js     ← 判斷是否電腦版（>=768px）
  lib/
    supabase.js       ← Supabase client
  components/
    Icons.jsx         ← IcChevron 等圖示
    StatusBar.jsx     ← 手機狀態列模擬
  index.css           ← 全域 CSS（.app-container, .btn-primary 等）
  App.jsx             ← 路由設定
```

---

## 首頁（Home.jsx）架構

### 電腦版（isDesktop = true，≥768px）

目前版面是**單欄置中**（最新狀態）：

```
┌─────────────────────────────────────────┐
│  meetime  (nav, height 86px, fs 48px)   │
├─────────────────────────────────────────┤
│         maxWidth: 960px, 置中            │
│                                         │
│  最近活動（最多顯示3筆，可展開）           │
│  ─────────────────────────────          │
│  選取日期 *                              │
│  [日曆 DateMultiPicker large]            │
│                                         │
│  選取調查時段 *              [全天 toggle]│
│  [TimeRangeSlider]                      │
│                                         │
│  活動時長（選填）                         │
│  [DurationSlider]                       │
│                                         │
│  [建立活動 按鈕]                         │
└─────────────────────────────────────────┘
```

### 手機版（isDesktop = false，<768px）

```
meetime (logo)
最近活動（預設顯示2筆，可展開）
選取日期 + 日曆
選取調查時段 + 時間滑桿
活動時長 + 時長滑桿
[送出 按鈕]
```

---

## 目前字體大小（電腦版，2025-05 最新）

| 元素 | fontSize |
|---|---|
| meetime logo | **48px** |
| 最近活動 標題 | **26px** |
| 活動名稱（最近活動卡片） | **20px** |
| 時間標籤（今天/昨天） | **19px** |
| 清除紀錄 按鈕 | **19px** |
| 尚無建立紀錄 | **22px** |
| 選取日期 / 調查時段 / 活動時長 標籤 | **24px**（刻意不跟著縮放） |
| 建立活動 按鈕 | **24px**（刻意不跟著縮放） |
| 全天 toggle 文字 | **20px** |
| 錯誤提示 | **17px** |
| TimeRangeSlider 時間數字 | **46px** |
| TimeRangeSlider AM/PM | **25px** |
| TimeRangeSlider 刻度 | **19px** |
| DurationSlider 顯示（空） | **36px** |
| DurationSlider 顯示（有值） | **55px** |
| DurationSlider 刻度 | **19px** |
| DateMultiPicker 月份標題 | **31px** |
| DateMultiPicker 星期標籤 | **22px** |
| DateMultiPicker 日期數字（large） | **31px** |
| DateMultiPicker 狀態文字/清除 | **22px** |
| DateMultiPicker 日期chip | **19px** |

---

## 日曆（DateMultiPicker）

- 電腦版傳入 `large` prop，手機版不傳
- `large` 模式：cell height **82px**，circle **65×65px**，radius **33px**
- 支援滑動多選、跨月選取

---

## 資料流

### 建立活動（Home.jsx）
1. 使用者選日期 + 時段 + 時長
2. 點「建立活動」→ 驗證 → 跳出 modal 填寫活動名稱
3. 送出後寫入 Supabase `meetings` table：
   ```js
   { id, name, range_start, range_end, date_list, start_slot, end_slot, all_day, duration }
   ```
4. 同時存到 `localStorage('meetime_recent')`：`[{ id, name, time }]`（最多 10 筆）
5. Modal 第二階段顯示邀請連結 + 複製 + LINE 分享

### 最近活動（localStorage）
- Key：`meetime_recent`
- 格式：`[{ id: string, name: string, time: number }]`
- 讀取時有防呆 filter：只保留有 `name` 字串的物件
- 電腦版預設顯示 3 筆，手機版 2 筆，皆可展開

---

## 設計語言

| 項目 | 值 |
|---|---|
| 主色（藍灰） | `#8A9DA8` |
| 淺藍灰（背景/chip） | `#e8eef1` |
| 邊框 | `#F0F0F0`（1px 或 1.5px） |
| 錯誤 | `#E53935` |
| 字體 | Lora + Noto Sans TC |
| 圓角 | 通常 8-12px，modal 20px |
| app-container max-width | **1440px**（`src/index.css`） |
| 電腦版頁面內容 max-width | **960px**（Home.jsx 單欄） |

---

## Modal（彈窗）

- 電腦版＋手機版都是**置中遮罩彈窗**（`position: fixed`）
- 電腦版：`maxWidth: 480px`，padding `32px 28px 24px`
- 手機版：`maxWidth: 340px`，padding `24px 20px 18px`
- 兩個階段：①填活動名稱 → ②顯示邀請連結 + LINE 分享 + 填寫我的時間

---

## CSS Global Classes（index.css）

| Class | 用途 |
|---|---|
| `.app-container` | 最外層容器，desktop max-width 1440px |
| `.btn-primary` | 主按鈕（藍灰底白字） |
| `.screen-content` | 手機版可捲動內容區 |
| `.form-field` / `.form-label` / `.form-input` | 表單元素（手機版） |
| `.desktop-sidebar-overlay` / `.desktop-sidebar-panel` | 舊電腦版 sidebar（目前首頁已不使用，其他頁仍可能用到） |

---

## 其他頁面（首頁以外）

- `/join/:id` → Join.jsx：加入活動、填寫姓名
- `/grid` → TimeGrid.jsx：選時間格（拖拉介面）
- `/confirm` → Confirm.jsx：確認送出
- `/view/:id` → ViewResults.jsx：查看所有人的結果與最佳時段
- `/results` → Results.jsx：結果頁

---

## 常見修改模式

1. **字體大小**：Home.jsx 裡全部用 inline style `fontSize: N`，直接改數字
2. **版面寬度**：`maxWidth` 在 Home.jsx 的 single-column div（目前 960）
3. **元件字體**：DurationSlider / TimeRangeSlider / DateMultiPicker 三個 function component 在 Home.jsx 頂部定義
4. **手機/電腦分支**：`isDesktop ? (...) : (...)` 在 return 裡
5. **最近活動筆數**：`recentEvents.slice(0, 3)` = 電腦版預設3筆；`recentEvents.slice(0, 2)` = 手機版預設2筆
