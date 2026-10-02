/**
 * 家用物品提醒 — 網頁版主程式（功能對齊 Android 版）。
 */
(() => {
  const appEl = document.getElementById("app");
  const dialog = document.getElementById("item-dialog");
  const form = document.getElementById("item-form");

  /** @type {"home"|"hall"|"room"|"kitchen"|"bathroom"|"fullscreen"} */
  let currentPage = "home";
  /** 編輯中的物品 id；null 表示新增 */
  let editingId = null;
  /** 新增時所屬分類 */
  let addCategoryId = null;

  // —— 瀏覽器全螢幕／橫向鎖定 ——————————————————

  function isBrowserFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement
    );
  }

  /** 進入瀏覽器全螢幕並盡量鎖成橫向 */
  async function enterBrowserFullscreen() {
    const el = document.documentElement;
    try {
      if (!isBrowserFullscreen()) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      }
    } catch (_) {
      /* 部分環境（如未允許）會失敗，仍保留應用內全螢幕頁 */
    }
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (_) {
      /* 桌面或未支援鎖定時忽略；CSS 會輔助橫向呈現 */
    }
    document.body.classList.add("is-browser-fs");
  }

  /** 離開瀏覽器全螢幕並解除方向鎖定 */
  async function exitBrowserFullscreen() {
    document.body.classList.remove("is-browser-fs");
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (_) {
      /* ignore */
    }
    try {
      if (isBrowserFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (_) {
      /* ignore */
    }
  }

  /** 系統退出全螢幕（Esc 等）時同步回到主頁 */
  function onFullscreenChange() {
    if (!isBrowserFullscreen() && currentPage === "fullscreen") {
      document.body.classList.remove("is-browser-fs");
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch (_) {
        /* ignore */
      }
      currentPage = "home";
      render();
    }
  }

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  // —— 資料操作 ——————————————————————————————

  function allItems() {
    return Storage.getItems();
  }

  function enrich(item) {
    const alert = Storage.getAlert(item.category);
    const remaining = DateUtils.remainingDays(item.expiryDate);
    return {
      ...item,
      remainingDays: remaining,
      isQuantityAlert:
        alert.quantityThreshold > 0 && item.quantity < alert.quantityThreshold,
      isExpiryAlert:
        remaining != null &&
        alert.daysThreshold > 0 &&
        remaining <= alert.daysThreshold
    };
  }

  function quantityColumnItems() {
    const filters = Storage.getFilters();
    const qty = filters.quantity === "" ? null : Number(filters.quantity);
    return allItems()
      .map(enrich)
      .filter((i) => qty == null || Number.isNaN(qty) || i.quantity <= qty)
      .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, "zh-Hant"));
  }

  function expiryColumnItems() {
    const filters = Storage.getFilters();
    const days = filters.days === "" ? null : Number(filters.days);
    return allItems()
      .map(enrich)
      .filter((i) => i.remainingDays != null)
      .filter((i) => days == null || Number.isNaN(days) || i.remainingDays <= days)
      .sort(
        (a, b) =>
          a.remainingDays - b.remainingDays || a.name.localeCompare(b.name, "zh-Hant")
      );
  }

  function itemsByCategory(categoryId) {
    return allItems()
      .filter((i) => i.category === categoryId)
      .map(enrich)
      .sort((a, b) => {
        const ra = a.remainingDays ?? Number.MAX_SAFE_INTEGER;
        const rb = b.remainingDays ?? Number.MAX_SAFE_INTEGER;
        return ra - rb || a.name.localeCompare(b.name, "zh-Hant");
      });
  }

  function upsertItem(data) {
    const items = allItems();
    if (data.id) {
      const idx = items.findIndex((i) => i.id === data.id);
      if (idx >= 0) items[idx] = { ...items[idx], ...data };
    } else {
      items.push({
        id: createId(),
        name: data.name,
        quantity: data.quantity,
        expiryDate: data.expiryDate,
        category: data.category
      });
    }
    Storage.saveItems(items);
  }

  function deleteItem(id) {
    Storage.saveItems(allItems().filter((i) => i.id !== id));
  }

  function decreaseQuantity(id) {
    const items = allItems();
    const item = items.find((i) => i.id === id);
    if (!item || item.quantity <= 0) return;
    item.quantity -= 1;
    Storage.saveItems(items);
    render();
  }

  // —— 手勢：雙擊／長按 ——————————————————————

  function bindItemGestures(el, itemId, canEdit) {
    let tapCount = 0;
    let tapTimer = null;
    let longTimer = null;
    let longFired = false;
    let startX = 0;
    let startY = 0;
    let activePointerId = null;
    let lastDecreaseAt = 0;

    const clearLong = () => {
      if (longTimer) {
        clearTimeout(longTimer);
        longTimer = null;
      }
    };

    /** 避免 pointer 雙擊與 dblclick 各減一次 */
    const doDecrease = () => {
      const now = Date.now();
      if (now - lastDecreaseAt < 400) return;
      lastDecreaseAt = now;
      decreaseQuantity(itemId);
    };

    const movedTooFar = (x, y) => {
      const dx = x - startX;
      const dy = y - startY;
      return dx * dx + dy * dy > 100; // 超過約 10px 視為捲動
    };

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      activePointerId = e.pointerId;
      longFired = false;
      startX = e.clientX;
      startY = e.clientY;
      longTimer = setTimeout(() => {
        longFired = true;
        tapCount = 0;
        if (canEdit) openEditDialog(itemId);
      }, 550);
    };

    const onPointerMove = (e) => {
      if (activePointerId !== e.pointerId) return;
      if (movedTooFar(e.clientX, e.clientY)) clearLong();
    };

    const onPointerUp = (e) => {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      clearLong();
      if (longFired) {
        e.preventDefault();
        return;
      }
      // 捲動列表時不計入點擊
      if (movedTooFar(e.clientX, e.clientY)) return;

      tapCount += 1;
      if (tapCount === 1) {
        // 觸控雙擊間隔放寬，較好點
        tapTimer = setTimeout(() => {
          tapCount = 0;
        }, 450);
      } else if (tapCount >= 2) {
        clearTimeout(tapTimer);
        tapCount = 0;
        doDecrease();
      }
    };

    const onPointerCancel = (e) => {
      if (activePointerId != null && e.pointerId !== activePointerId) return;
      activePointerId = null;
      clearLong();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    // 注意：觸控在 pointerup 後常會再觸發 pointerleave，不可因此清掉 tapCount
    el.addEventListener("pointerleave", clearLong);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    // 桌面滑鼠雙擊備援
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      doDecrease();
    });
  }

  // —— 對話框 ————————————————————————————————

  function updateRemainingPreview() {
    const iso = document.getElementById("field-expiry").value || null;
    const days = DateUtils.remainingDays(iso);
    document.getElementById("field-remaining").value =
      days == null ? "—" : DateUtils.remainingLabel(days);
  }

  function openAddDialog(categoryId) {
    editingId = null;
    addCategoryId = categoryId;
    document.getElementById("dialog-title").textContent = "新增物品";
    document.getElementById("field-name").value = "";
    document.getElementById("field-quantity").value = "";
    document.getElementById("field-expiry").value = "";
    document.getElementById("dialog-error").hidden = true;
    updateRemainingPreview();
    dialog.showModal();
    document.getElementById("field-name").focus();
  }

  function openEditDialog(itemId) {
    const item = allItems().find((i) => i.id === itemId);
    if (!item) return;
    editingId = itemId;
    addCategoryId = item.category;
    document.getElementById("dialog-title").textContent = "修改物品";
    document.getElementById("field-name").value = item.name;
    document.getElementById("field-quantity").value = String(item.quantity);
    document.getElementById("field-expiry").value = item.expiryDate || "";
    document.getElementById("dialog-error").hidden = true;
    updateRemainingPreview();
    dialog.showModal();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("field-name").value.trim();
    const quantity = Number(document.getElementById("field-quantity").value);
    const expiryRaw = document.getElementById("field-expiry").value;
    const err = document.getElementById("dialog-error");
    if (!name) {
      err.textContent = "請輸入物品名稱";
      err.hidden = false;
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      err.textContent = "請輸入有效的剩餘數量";
      err.hidden = false;
      return;
    }
    upsertItem({
      id: editingId,
      name,
      quantity: Math.floor(quantity),
      expiryDate: expiryRaw || null,
      category: addCategoryId
    });
    dialog.close();
    render();
  });

  document.getElementById("btn-cancel").addEventListener("click", () => dialog.close());
  document.getElementById("btn-clear-expiry").addEventListener("click", () => {
    document.getElementById("field-expiry").value = "";
    updateRemainingPreview();
  });
  document.getElementById("field-expiry").addEventListener("change", updateRemainingPreview);

  // —— 畫面元件 ——————————————————————————————

  function qtyTileHtml(item) {
    const qtyClass = item.isQuantityAlert ? "alert" : "";
    return `
      <article class="tile tile-qty" data-id="${escapeHtml(item.id)}">
        <span class="tile-name">${escapeHtml(item.name)}</span>
        <span class="tile-mid ${qtyClass}">數量 ${item.quantity}</span>
        <span class="tile-cat">${escapeHtml(CATEGORY_MAP[item.category] || "")}</span>
      </article>`;
  }

  function expiryTileHtml(item) {
    const cls = item.isExpiryAlert ? "alert" : "";
    return `
      <article class="tile tile-expiry" data-id="${escapeHtml(item.id)}">
        <div class="row1">
          <span class="tile-name">${escapeHtml(item.name)}</span>
          <span class="tile-cat">${escapeHtml(CATEGORY_MAP[item.category] || "")}</span>
          <span class="tile-days ${cls}">${escapeHtml(DateUtils.remainingLabel(item.remainingDays))}</span>
        </div>
        <div class="row2 ${cls}">${escapeHtml(item.expiryDate || "")}</div>
      </article>`;
  }

  function dualColumnsHtml() {
    const left = quantityColumnItems();
    const right = expiryColumnItems();
    return `
      <div class="dual">
        <div class="dual-col">
          <h3 class="dual-title">數量</h3>
          <div class="dual-list" data-col="qty">
            ${left.length ? left.map(qtyTileHtml).join("") : `<p class="empty">尚無物品</p>`}
          </div>
        </div>
        <div class="dual-divider"></div>
        <div class="dual-col">
          <h3 class="dual-title">到期日</h3>
          <div class="dual-list" data-col="expiry">
            ${right.length ? right.map(expiryTileHtml).join("") : `<p class="empty">尚無到期物品</p>`}
          </div>
        </div>
      </div>`;
  }

  function bindDualGestures(root) {
    root.querySelectorAll(".tile[data-id]").forEach((el) => {
      bindItemGestures(el, el.dataset.id, true);
    });
  }

  function renderHome() {
    const filters = Storage.getFilters();
    return `
      <header class="page-header">
        <h1>主頁總覽</h1>
      </header>
      <section class="filters">
        <label>
          剩餘數量≤
          <input type="text" inputmode="numeric" id="filter-qty" value="${escapeHtml(filters.quantity)}" placeholder="例如 7" />
        </label>
        <label>
          到期日數內
          <input type="text" inputmode="numeric" id="filter-days" value="${escapeHtml(filters.days)}" placeholder="例如 7" />
        </label>
      </section>
      <hr class="sep" />
      ${dualColumnsHtml()}`;
  }

  function categoryRemainingText(item) {
    if (item.remainingDays == null) return "無";
    if (item.remainingDays < 0) return `已過期 ${-item.remainingDays} 天`;
    if (item.remainingDays === 0) return "今天到期";
    return `${item.remainingDays} 天`;
  }

  function renderCategoryClean(categoryId) {
    const meta = CATEGORIES.find((c) => c.id === categoryId);
    const alert = Storage.getAlert(categoryId);
    const items = itemsByCategory(categoryId);
    const qtyVal = alert.quantityThreshold > 0 ? String(alert.quantityThreshold) : "";
    const daysVal = alert.daysThreshold > 0 ? String(alert.daysThreshold) : "";

    return `
      <header class="page-header">
        <h1>${escapeHtml(meta.name)}</h1>
      </header>
      <section class="alert-card">
        <h2>警報設定</h2>
        <div class="filters">
          <label>
            數量警報
            <input type="text" inputmode="numeric" id="alert-qty" value="${escapeHtml(qtyVal)}" placeholder="例如 3" />
          </label>
          <label>
            到期日數警報
            <input type="text" inputmode="numeric" id="alert-days" value="${escapeHtml(daysVal)}" placeholder="例如 6" />
          </label>
        </div>
      </section>
      <p class="list-hint">${items.length ? `物品列表（${items.length}）` : "尚未新增物品，點右下角 + 開始。"}</p>
      <div class="category-list">
        ${items
          .map((item) => {
            const qtyCls = item.isQuantityAlert ? "alert" : "";
            const dayCls = item.isExpiryAlert ? "alert" : "";
            return `
            <article class="item-card">
              <div class="item-main">
                <strong>${escapeHtml(item.name)}</strong>
                <div class="${qtyCls}">剩餘數量：${item.quantity}</div>
                <div>到期日子：${item.expiryDate ? escapeHtml(item.expiryDate) : "無"}</div>
                <div class="${dayCls}">剩餘多少天：${escapeHtml(categoryRemainingText(item))}</div>
              </div>
              <div class="item-actions">
                <button type="button" class="icon-btn" data-edit="${escapeHtml(item.id)}" aria-label="修改">✎</button>
                <button type="button" class="icon-btn danger" data-del="${escapeHtml(item.id)}" aria-label="刪除">🗑</button>
              </div>
            </article>`;
          })
          .join("")}
      </div>
      <button type="button" class="fab" id="btn-add" aria-label="新增物品">＋</button>`;
  }

  function renderFullscreen() {
    return `
      <div class="fullscreen-body">
        ${dualColumnsHtml()}
      </div>`;
  }

  function navHtml() {
    if (currentPage === "fullscreen") return "";
    const items = [
      { id: "home", label: "主頁", icon: "⌂" },
      { id: "hall", label: "大廳", icon: "🚪" },
      { id: "room", label: "雪櫃", icon: "🧊" },
      { id: "kitchen", label: "廚房", icon: "🍳" },
      { id: "bathroom", label: "廁所", icon: "🛁" },
      { id: "fullscreen", label: "全螢幕", icon: "⛶" }
    ];
    return `
      <nav class="bottom-nav">
        ${items
          .map(
            (n) => `
          <button type="button" class="nav-item ${currentPage === n.id ? "active" : ""}" data-nav="${n.id}">
            <span class="nav-icon">${n.icon}</span>
            <span>${n.label}</span>
          </button>`
          )
          .join("")}
      </nav>`;
  }

  function render() {
    document.body.classList.toggle("is-fullscreen", currentPage === "fullscreen");

    let main = "";
    if (currentPage === "home") main = renderHome();
    else if (currentPage === "fullscreen") main = renderFullscreen();
    else main = renderCategoryClean(currentPage);

    // 關閉鈕放在旋轉內容外，避免直向全螢幕時跑到左下角
    const fsCloseHtml =
      currentPage === "fullscreen"
        ? `<button type="button" class="fs-close" id="btn-fs-close" aria-label="離開全螢幕">✕</button>`
        : "";

    appEl.innerHTML = `
      ${fsCloseHtml}
      <main class="page ${currentPage === "fullscreen" ? "page-fullscreen" : ""}">
        ${main}
      </main>
      ${navHtml()}`;

    // 綁定導覽（進入全螢幕時一併呼叫瀏覽器 Fullscreen API）
    appEl.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const next = btn.dataset.nav;
        if (next === "fullscreen") {
          currentPage = "fullscreen";
          render();
          await enterBrowserFullscreen();
          return;
        }
        if (currentPage === "fullscreen") {
          await exitBrowserFullscreen();
        }
        currentPage = next;
        render();
      });
    });

    // 主頁篩選
    const fq = document.getElementById("filter-qty");
    const fd = document.getElementById("filter-days");
    if (fq && fd) {
      const save = () => {
        Storage.saveFilters({
          quantity: fq.value.replace(/\D/g, ""),
          days: fd.value.replace(/\D/g, "")
        });
        // 只更新數字並重繪列表區較佳，這裡直接重繪
        const pos = { q: fq.selectionStart, d: fd.selectionStart };
        render();
        const nq = document.getElementById("filter-qty");
        const nd = document.getElementById("filter-days");
        if (document.activeElement === nq || fq === document.activeElement) {
          /* restored below */
        }
        // 焦點還原
        requestAnimationFrame(() => {
          const a = document.getElementById("filter-qty");
          const b = document.getElementById("filter-days");
          if (window.__lastFilterFocus === "days" && b) {
            b.focus();
            b.setSelectionRange(pos.d ?? b.value.length, pos.d ?? b.value.length);
          } else if (a) {
            a.focus();
            a.setSelectionRange(pos.q ?? a.value.length, pos.q ?? a.value.length);
          }
        });
      };
      fq.addEventListener("focus", () => {
        window.__lastFilterFocus = "qty";
      });
      fd.addEventListener("focus", () => {
        window.__lastFilterFocus = "days";
      });
      fq.addEventListener("input", () => {
        fq.value = fq.value.replace(/\D/g, "");
        save();
      });
      fd.addEventListener("input", () => {
        fd.value = fd.value.replace(/\D/g, "");
        save();
      });
    }

    // 分類警報自動儲存
    const aq = document.getElementById("alert-qty");
    const ad = document.getElementById("alert-days");
    if (aq && ad) {
      const saveAlert = () => {
        Storage.setAlert(
          currentPage,
          Number(aq.value.replace(/\D/g, "")) || 0,
          Number(ad.value.replace(/\D/g, "")) || 0
        );
        const focus = window.__lastAlertFocus;
        const posQ = aq.selectionStart;
        const posD = ad.selectionStart;
        render();
        requestAnimationFrame(() => {
          const nq = document.getElementById("alert-qty");
          const nd = document.getElementById("alert-days");
          if (focus === "days" && nd) {
            nd.focus();
            nd.setSelectionRange(posD ?? nd.value.length, posD ?? nd.value.length);
          } else if (nq) {
            nq.focus();
            nq.setSelectionRange(posQ ?? nq.value.length, posQ ?? nq.value.length);
          }
        });
      };
      aq.addEventListener("focus", () => {
        window.__lastAlertFocus = "qty";
      });
      ad.addEventListener("focus", () => {
        window.__lastAlertFocus = "days";
      });
      aq.addEventListener("input", () => {
        aq.value = aq.value.replace(/\D/g, "");
        saveAlert();
      });
      ad.addEventListener("input", () => {
        ad.value = ad.value.replace(/\D/g, "");
        saveAlert();
      });
    }

    // 分類頁按鈕
    const addBtn = document.getElementById("btn-add");
    if (addBtn) {
      addBtn.addEventListener("click", () => openAddDialog(currentPage));
    }
    appEl.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openEditDialog(btn.dataset.edit));
    });
    appEl.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("確定刪除此物品？")) {
          deleteItem(btn.dataset.del);
          render();
        }
      });
    });

    // 全螢幕關閉（右上角 X）
    const fsClose = document.getElementById("btn-fs-close");
    if (fsClose) {
      fsClose.addEventListener("click", async () => {
        await exitBrowserFullscreen();
        currentPage = "home";
        render();
      });
    }

    // 雙欄手勢
    if (currentPage === "home" || currentPage === "fullscreen") {
      bindDualGestures(appEl);
    }
  }

  // 啟動
  render();
})();
