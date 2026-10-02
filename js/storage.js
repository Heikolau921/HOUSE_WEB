/**
 * 本地儲存：物品、分類警報、主頁篩選。
 * 資料存在瀏覽器 localStorage，下次開啟會沿用。
 */
const Storage = {
  KEYS: {
    items: "house_web_items",
    alerts: "house_web_alerts",
    filters: "house_web_filters"
  },

  /** 讀取全部物品 */
  getItems() {
    try {
      const raw = localStorage.getItem(this.KEYS.items);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /** 儲存全部物品 */
  saveItems(items) {
    localStorage.setItem(this.KEYS.items, JSON.stringify(items));
  },

  /**
   * 讀取分類警報。
   * 格式：{ hall: { quantityThreshold, daysThreshold }, ... }
   */
  getAlerts() {
    try {
      const raw = localStorage.getItem(this.KEYS.alerts);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  saveAlerts(alerts) {
    localStorage.setItem(this.KEYS.alerts, JSON.stringify(alerts));
  },

  getAlert(categoryId) {
    const all = this.getAlerts();
    return all[categoryId] || { quantityThreshold: 0, daysThreshold: 0 };
  },

  setAlert(categoryId, quantityThreshold, daysThreshold) {
    const all = this.getAlerts();
    all[categoryId] = {
      quantityThreshold: Math.max(0, quantityThreshold || 0),
      daysThreshold: Math.max(0, daysThreshold || 0)
    };
    this.saveAlerts(all);
  },

  /** 主頁篩選：{ quantity: "", days: "" } */
  getFilters() {
    try {
      const raw = localStorage.getItem(this.KEYS.filters);
      return raw ? JSON.parse(raw) : { quantity: "", days: "" };
    } catch {
      return { quantity: "", days: "" };
    }
  },

  saveFilters(filters) {
    localStorage.setItem(
      this.KEYS.filters,
      JSON.stringify({
        quantity: filters.quantity || "",
        days: filters.days || ""
      })
    );
  }
};
