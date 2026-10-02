/**
 * 日期與顯示工具。
 */
const DateUtils = {
  /** 今天 YYYY-MM-DD（本地時區） */
  todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },

  /**
   * 計算剩餘天數；無日期回傳 null。
   * @param {string|null} isoDate
   * @returns {number|null}
   */
  remainingDays(isoDate) {
    if (!isoDate) return null;
    const today = new Date(this.todayIso() + "T00:00:00");
    const expiry = new Date(isoDate + "T00:00:00");
    if (Number.isNaN(expiry.getTime())) return null;
    return Math.round((expiry - today) / 86400000);
  },

  /** 剩餘天數顯示文字 */
  remainingLabel(days) {
    if (days == null) return "無";
    if (days < 0) return `已過期 ${-days} 天`;
    if (days === 0) return "今天到期";
    return `剩 ${days} 天`;
  }
};

/** 分類定義 */
const CATEGORIES = [
  { id: "hall", name: "大廳" },
  { id: "room", name: "雪櫃" },
  { id: "kitchen", name: "廚房" },
  { id: "bathroom", name: "廁所" }
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));

/** 產生唯一 id */
function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** HTML 跳脫 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
