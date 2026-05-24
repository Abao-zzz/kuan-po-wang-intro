const panels = [...document.querySelectorAll("[data-panel]")];
const navLinks = [...document.querySelectorAll(".site-nav a")];
const progress = document.querySelector("[data-progress]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImg = document.querySelector("[data-lightbox-img]");
const lightboxTitle = document.querySelector("[data-lightbox-title]");
const lightboxClose = document.querySelector("[data-lightbox-close]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let parallaxFrame = 0;

// Lenis — kitamura1923 那種滑順感的關鍵。讓滾輪不再是「直接跳到下一個 pixel」
// 而是「lerp 到目標」，加上 expo easing 給「重量但又輕」的感覺。
let lenis;
if (typeof Lenis !== "undefined" && !reduceMotion.matches) {
  lenis = new Lenis({
    duration: 1.25,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.8,
  });

  const lenisRaf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(lenisRaf);
  };
  requestAnimationFrame(lenisRaf);

  // nav 錨點點擊也走 Lenis，捲動感受一致
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href")?.slice(1);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    });
  });
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

const hudPercent = document.querySelector("[data-hud-percent]");
const hudFill = document.querySelector("[data-hud-progress]");
const hudSection = document.querySelector("[data-hud-section]");

let lastActivePanel = null;
function setActivePanel(panel) {
  const isNewPanel = panel !== lastActivePanel;
  panels.forEach((item) => item.classList.toggle("is-active", item === panel));
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${panel.id}`);
  });
  if (hudSection) {
    const id = panel.id || "interlude";
    hudSection.textContent = id;
  }
  if (isNewPanel) {
    fireEnterScanner();
    syncSceneQuiet(panel);
    lastActivePanel = panel;
  }
}

// 進入新 section 時頂部 teal 橫掃線
function fireEnterScanner() {
  const el = document.querySelector("[data-enter-scanner]");
  if (!el) return;
  el.classList.remove("is-firing");
  void el.offsetWidth;
  el.classList.add("is-firing");
}

// Hero 時把 scene-stage 的 rings / beams / code 收掉，其他 section 才放出來
function syncSceneQuiet(panel) {
  const stage = document.querySelector(".scene-stage");
  if (!stage) return;
  if (panel && panel.id === "intro") {
    stage.classList.add("is-quiet");
  } else {
    stage.classList.remove("is-quiet");
  }
}

// 中央年份舞台 — 改成「捲動連續推進」：scroll 位置線性映射到年份 2017→2025，
// 每跨一個整數年做 tick pulse；label 隨年份段位（STUDENT / PX MART / YIFAN）切換並做 fade
let lastEra = "";
function updateYearStage() {
  const stage = document.querySelector("[data-year-stage]");
  if (!stage) return;
  const currentEl = stage.querySelector("[data-year-current]");
  const labelEl = stage.querySelector("[data-year-label]");

  const schoolEl = document.getElementById("school");
  const yifanEl = document.getElementById("yifan");
  if (!schoolEl || !yifanEl) return;

  const vh = window.innerHeight;
  const startScroll = schoolEl.offsetTop - vh * 0.55;
  const endScroll = yifanEl.offsetTop + yifanEl.offsetHeight - vh * 0.4;

  const startYear = 2017;
  const endYear = 2026;

  const y = window.scrollY;
  if (y < startScroll) {
    stage.classList.remove("is-active");
    return;
  }

  stage.classList.add("is-active");

  const ratio = Math.min(1, Math.max(0, (y - startScroll) / (endScroll - startScroll)));
  const year = Math.floor(startYear + (endYear - startYear) * ratio);
  const yearText = String(year);

  if (currentEl.textContent !== yearText) {
    currentEl.textContent = yearText;
    currentEl.classList.remove("is-ticked");
    void currentEl.offsetWidth;
    currentEl.classList.add("is-ticked");
  }

  const era = year < 2022 ? "STUDENT" : year < 2024 ? "PX MART" : "YIFAN";
  if (labelEl && era !== lastEra) {
    lastEra = era;
    labelEl.textContent = era;
  }
}

function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max <= 0 ? 0 : window.scrollY / max;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  progress.style.width = `${pct}%`;
  if (hudFill) hudFill.style.width = `${pct}%`;
  if (hudPercent) hudPercent.textContent = `${String(Math.round(pct)).padStart(2, "0")}%`;
  updateTimeline();
  updateYearStage();
  updateTransitionGlyph();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// 進場 cascade：每個 panel 內的元素分配 stagger 延遲
// 三組：(1) panel-copy 直系（kicker / heading / lead / metric-row / story-list 容器）
//       (2) metric-row 內每個 metric、story-list 內每個 li 自己再 stagger
//       (3) 右半邊 — 卡片、列表項目
// 每個元素自己 observer 浮現；現代瀏覽器再用 view-timeline 加上「離場」動畫
function setupReveals() {
  panels.forEach((panel) => {
    panel.querySelectorAll(".panel-copy > *, .hero-stage > *, .pxmart-stamp > *").forEach((el, i) => {
      el.classList.add("reveal-step");
      el.style.setProperty("--reveal-delay", `${i * 60}ms`);
    });

    panel.querySelectorAll(".panel-copy .metric, .kpi-widget").forEach((el, i) => {
      el.classList.add("reveal-step", "scroll-flow", "scroll-flow-punch");
      el.style.setProperty("--reveal-delay", `${i * 50}ms`);
    });

    // 卡片列表：奇偶輪流 left / right 入場，給「左右擺動」的方向感
    panel.querySelectorAll(".award-row, .frame .story-list li, .highlight-card").forEach((el, i) => {
      el.classList.add("reveal-step", "scroll-flow");
      el.classList.add(i % 2 === 0 ? "scroll-flow-left" : "scroll-flow-right");
      el.style.setProperty("--reveal-delay", `${i * 35}ms`);
    });

    // 一般 list：scroll-flow（純垂直）
    panel
      .querySelectorAll(".capability-list li, .project-terminal li, .project-mosaic span, .stack-card")
      .forEach((el, i) => {
        el.classList.add("reveal-step", "scroll-flow");
        el.style.setProperty("--reveal-delay", `${i * 35}ms`);
      });

    // migration-visual: punch-in
    panel.querySelectorAll(".migration-visual").forEach((el) => {
      el.classList.add("reveal-step", "scroll-flow", "scroll-flow-punch");
      el.style.setProperty("--reveal-delay", "0ms");
    });

    panel.querySelectorAll(".breath-line").forEach((el) => {
      el.classList.add("reveal-step");
      el.style.setProperty("--reveal-delay", "0ms");
    });
  });
}

// dashboard 上的時鐘 — 每秒 tick，讓「系統運轉中」的感覺持續
function startDashboardClock() {
  const clocks = document.querySelectorAll("[data-clock]");
  if (!clocks.length) return;
  const tick = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const stamp = `${h}:${m}:${s}`;
    clocks.forEach((el) => {
      el.textContent = stamp;
    });
  };
  tick();
  setInterval(tick, 1000);
}
startDashboardClock();

// 只剩「氛圍背景」的滾動連動 — 內容絕不再動，避免拖影
function updateBackground() {
  updateProgress();

  if (reduceMotion.matches) {
    return;
  }

  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max <= 0 ? 0 : clamp(window.scrollY / max, 0, 1);
  const wave = Math.sin(ratio * Math.PI * 2);
  const root = document.documentElement;
  // 「深夜專訪」調性 — 氛圍位移與旋轉都收一半，讓背景不再奪走目光
  const sceneX = wave * 32;
  const sceneY = window.scrollY * -0.06;

  root.style.setProperty("--page-drift", `${window.scrollY * -0.06}px`);
  root.style.setProperty("--page-drift-fast", `${window.scrollY * 0.02}px`);
  root.style.setProperty("--scene-x", `${sceneX}px`);
  root.style.setProperty("--scene-x-neg", `${sceneX * -1}px`);
  root.style.setProperty("--scene-y", `${sceneY}px`);
  root.style.setProperty("--scene-y-soft", `${sceneY * 0.65}px`);
  root.style.setProperty("--ring-one-x", `${sceneX * 0.3}px`);
  root.style.setProperty("--ring-one-y", `${sceneY * -0.26}px`);
  root.style.setProperty("--ring-two-x", `${sceneX * -0.22}px`);
  root.style.setProperty("--ring-two-y", `${sceneY * 0.36}px`);
  root.style.setProperty("--beam-one-x", `${sceneX * 0.78}px`);
  root.style.setProperty("--beam-one-y", `${sceneY * 0.5}px`);
  root.style.setProperty("--beam-two-x", `${sceneX * -0.56}px`);
  root.style.setProperty("--beam-two-y", `${sceneY * -0.42}px`);
  root.style.setProperty("--code-x", `${sceneX * -0.26}px`);
  root.style.setProperty("--code-y", `${sceneY * -0.2}px`);
  root.style.setProperty("--scene-spin", `${ratio * 140}deg`);
  root.style.setProperty("--scene-spin-rev", `${ratio * -110}deg`);
}

function requestParallax() {
  if (parallaxFrame) {
    return;
  }

  parallaxFrame = window.requestAnimationFrame(() => {
    updateBackground();
    parallaxFrame = 0;
  });
}

// 過場 glyph — 顯示「接下來這段是什麼期間」單一年份。
// section 下半部離場時預告下一段，避免 4 -> 5 中間又跳出上一段年份。
function updateTransitionGlyph() {
  const glyph = document.querySelector("[data-transition]");
  if (!glyph) return;
  const yearEl = glyph.querySelector("[data-transition-year]");

  const yearedPanels = panels.filter((p) => p.dataset.year);
  if (!yearedPanels.length) {
    glyph.classList.remove("is-active");
    return;
  }

  const vh = window.innerHeight;
  const scrollMid = window.scrollY + vh / 2;
  const settled = vh * 0.25;

  const firstPanel = yearedPanels[0];
  // 還沒進入第一個 yeared 範圍 (hero / capabilities) — 不顯示
  if (scrollMid < firstPanel.offsetTop) {
    glyph.classList.remove("is-active");
    return;
  }

  const currentIndex = yearedPanels.findIndex((p) => scrollMid >= p.offsetTop && scrollMid < p.offsetTop + p.offsetHeight);
  let closest = currentIndex >= 0 ? yearedPanels[currentIndex] : null;
  let closestDist = Infinity;

  if (!closest) {
    yearedPanels.forEach((p) => {
      const center = p.offsetTop + p.offsetHeight / 2;
      const d = Math.abs(scrollMid - center);
      if (d < closestDist) {
        closestDist = d;
        closest = p;
      }
    });
  } else {
    const center = closest.offsetTop + closest.offsetHeight / 2;
    closestDist = Math.abs(scrollMid - center);
    if (scrollMid > center && currentIndex < yearedPanels.length - 1) {
      closest = yearedPanels[currentIndex + 1];
    }
  }

  if (!closest) {
    glyph.classList.remove("is-active");
    return;
  }

  // 全聯年份要停留久一點，但標題進入主要閱讀區前淡掉，避免蓋到「全聯實業」。
  if (closest.id === "pxmart" && scrollMid >= closest.offsetTop + vh * 0.08) {
    glyph.classList.remove("is-active");
    return;
  }

  // 距離 section 中央太近（在閱讀區內）→ 淡掉
  if (closestDist < settled) {
    glyph.classList.remove("is-active");
    return;
  }

  // 過場中 → 顯示這個 section 的年份範圍
  if (yearEl.textContent !== closest.dataset.year) {
    yearEl.textContent = closest.dataset.year;
  }
  glyph.classList.add("is-active");
}

// 偵測「正在捲動」 — 滾動時 stage 出來，停下 800ms 後淡掉
let scrollIdleTimer = 0;
function pingScrollMotion() {
  const stage = document.querySelector("[data-year-stage]");
  if (stage) stage.classList.add("is-scrolling");
  clearTimeout(scrollIdleTimer);
  scrollIdleTimer = window.setTimeout(() => {
    document.querySelector("[data-year-stage]")?.classList.remove("is-scrolling");
  }, 800);
}

setupReveals();

// Hero 上方的終端機字幕 — 載入時逐行 type-in，完成後讓 hero 名字 wipe 進場
function runHeroTerminal(onDone) {
  const terminal = document.querySelector("[data-hero-terminal]");
  if (!terminal) {
    if (onDone) onDone();
    return;
  }

  const lines = terminal.querySelectorAll("[data-boot-line]");
  if (!lines.length) {
    if (onDone) onDone();
    return;
  }

  let i = 0;
  const step = () => {
    if (i < lines.length) {
      lines[i].classList.add("shown");
      i += 1;
      setTimeout(step, 180);
    } else {
      // 全部 type 完之後等一個短暫拍子才讓主視覺進場
      setTimeout(() => {
        if (onDone) onDone();
      }, 360);
    }
  };

  step();
}

// uptime — 從 page load 開始 mm:ss tick
const uptimeStart = Date.now();
function tickUptime() {
  const el = document.querySelector("[data-uptime]");
  if (!el) return;
  const sec = Math.max(0, Math.floor((Date.now() - uptimeStart) / 1000));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  el.textContent = `${m}:${s}`;
}
tickUptime();
setInterval(tickUptime, 1000);

window.addEventListener("load", () => {
  refreshIcons();
  setActivePanel(panels[0]);
  updateBackground();
  runHeroTerminal(() => {
    panels[0]?.classList.add("is-revealed");
    observeRevealSteps();
    observeCounters();
    buildTimeline();
    updateTimeline();
  });
});

// resize 時 timeline 座標要重算
window.addEventListener("resize", () => {
  buildTimeline();
  updateTimeline();
});

window.addEventListener("scroll", () => {
  requestParallax();
  pingScrollMotion();
}, { passive: true });
window.addEventListener("resize", requestParallax);

// 主動高亮 nav 對應到目前在視野中的 section
const activeObserver = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible) {
      setActivePanel(visible.target);
    }
  },
  { threshold: [0.35, 0.55, 0.75] },
);

panels.forEach((panel) => activeObserver.observe(panel));

// section 級別：只用來推 chrome（frame opacity、ring、ghost number、kpi-bar fill 等）
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
);

panels.forEach((panel) => {
  if (!panel.classList.contains("is-revealed")) {
    revealObserver.observe(panel);
  }
});

// item 級別：每個 .reveal-step 自己等捲到自己才浮現。
// threshold 25% + rootMargin 底邊 -10%，讓元素過了畫面底邊一段才觸發 — 像是「捲過去就帶出來」
const itemObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-shown");
        itemObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
);

function observeRevealSteps() {
  document.querySelectorAll(".reveal-step").forEach((el) => {
    itemObserver.observe(el);
  });
}

// KPI 數字 tick-up — widget 進場時，從 0 滾到目標值
function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.dataset.animated) return;
      el.dataset.animated = "1";
      const target = parseInt(el.dataset.count, 10);
      if (Number.isFinite(target)) animateCounter(el, target);
      counterObserver.unobserve(el);
    });
  },
  { threshold: 0.4, rootMargin: "0px 0px -10% 0px" },
);

function observeCounters() {
  document.querySelectorAll("[data-count]").forEach((el) => counterObserver.observe(el));
}

// 時間軸 — 把帶 data-year 的 section 拉出來建年份標記
function buildTimeline() {
  const pointsRoot = document.querySelector("[data-timeline-points]");
  if (!pointsRoot) return;
  pointsRoot.innerHTML = "";

  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return;

  panels.forEach((panel) => {
    const year = panel.dataset.year;
    if (!year) return;
    const ratio = Math.min(1, Math.max(0, panel.offsetTop / max));
    const point = document.createElement("div");
    point.className = "timeline-point";
    point.dataset.ratio = ratio.toFixed(4);
    point.dataset.panelId = panel.id;
    point.style.top = `${ratio * 100}%`;
    point.innerHTML = `
      <div class="timeline-point-label">
        <span class="timeline-point-year">${year}</span>
        ${panel.dataset.label ? `<span class="timeline-point-name">${panel.dataset.label}</span>` : ""}
      </div>
    `;
    pointsRoot.appendChild(point);
  });
}

function updateTimeline() {
  const fill = document.querySelector("[data-timeline-fill]");
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max));

  if (fill) fill.style.height = `${ratio * 100}%`;

  const points = document.querySelectorAll(".timeline-point");
  // 找最接近當前 ratio 的 point 當「current」
  let currentIdx = -1;
  let minDist = Infinity;
  points.forEach((p, i) => {
    const target = parseFloat(p.dataset.ratio);
    if (Number.isFinite(target)) {
      const dist = Math.abs(target - ratio);
      if (dist < minDist) {
        minDist = dist;
        currentIdx = i;
      }
    }
  });
  points.forEach((p, i) => {
    const target = parseFloat(p.dataset.ratio);
    p.classList.toggle("is-passed", ratio >= target - 0.005);
    p.classList.toggle("is-current", i === currentIdx && minDist < 0.08);
  });
}

document.querySelectorAll("[data-full]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!lightbox || !lightboxImg || !lightboxTitle) return;

    const title = button.getAttribute("data-title") || "資訊服務創新競賽";
    lightboxImg.src = button.getAttribute("data-full") || "";
    lightboxImg.alt = title;
    lightboxTitle.textContent = title;
    lightbox.showModal();
    refreshIcons();
  });
});

lightboxClose?.addEventListener("click", () => lightbox?.close());

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});
