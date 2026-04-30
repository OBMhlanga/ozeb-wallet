import { fetchLiveRates, updateSupabaseRates } from './liveRates';
import { supabase } from './supabaseClient';
import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── COLORS / THEMES ──────────────────────────────────────────────────────────

const DARK_THEME = {
  bg: "#0a0a14",
  bgGradient: "radial-gradient(ellipse at top left, #1a1530 0%, #0a0a14 55%), radial-gradient(ellipse at bottom right, #0e1a2a 0%, #0a0a14 60%)",
  card: "#15151f",
  cardGradient: "linear-gradient(145deg, #181826 0%, #13131c 100%)",
  cardBorder: "#2a2a3d",
  inputBg: "#0f0f1a",
  accent: "#c4ff5a",
  accentDim: "#9fdb3a",
  accentGlow: "#c4ff5a55",
  blue: "#6b8cff",
  purple: "#a66bff",
  pink: "#ff6bc1",
  success: "#1fe49e",
  danger: "#ff5577",
  warning: "#ffb845",
  text: "#f2f2fa",
  textPrimary: "#f2f2fa",
  textMuted: "#7a7a95",
  textSub: "#a8a8c4",
};

const LIGHT_THEME = {
  bg: "#fafbff",
  bgGradient: "radial-gradient(ellipse at top left, #eef6ff 0%, #fafbff 55%), radial-gradient(ellipse at bottom right, #f4eeff 0%, #fafbff 60%)",
  card: "#ffffff",
  cardGradient: "linear-gradient(145deg, #ffffff 0%, #f7f9ff 100%)",
  cardBorder: "#e4e7f2",
  inputBg: "#f5f7fc",
  accent: "#7fc400",
  accentDim: "#5a9000",
  accentGlow: "#7fc40055",
  blue: "#3858d6",
  purple: "#8a3fcc",
  pink: "#d94a94",
  success: "#00a16a",
  danger: "#e0304a",
  warning: "#e89100",
  text: "#0f1222",
  textPrimary: "#0f1222",
  textMuted: "#6b7088",
  textSub: "#3a3f55",
};

const COLORS = { ...DARK_THEME };

function applyTheme(mode) {
  const t = mode === "light" ? LIGHT_THEME : DARK_THEME;
  Object.keys(t).forEach(k => { COLORS[k] = t[k]; });
  rebuildStyles();
  if (typeof document !== "undefined") {
    document.documentElement.style.background = t.bg;
    document.body && (document.body.style.background = t.bg);
  }
}

const CURRENCY_FLAGS = { BWP: "🇧🇼", USD: "🇺🇸", ZAR: "🇿🇦", BTC: "₿", ETH: "Ξ" };
const CURRENCY_NAMES = { BWP: "Botswana Pula", USD: "US Dollar", ZAR: "South African Rand", BTC: "Bitcoin", ETH: "Ethereum" };

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatAmount(amount, currency) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  if (currency === "BTC") return `₿ ${safe.toFixed(8)}`;
  if (currency === "ETH") return `Ξ ${safe.toFixed(6)}`;
  const symbols = { USD: "$", BWP: "P", ZAR: "R" };
  return `${symbols[currency] || ""}${safe.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// convert now takes RATES as a parameter — no global reference
function convertAmount(amount, from, to, RATES) {
  if (!RATES || !RATES[from] || !RATES[to]) return amount;
  return amount * (RATES[to] / RATES[from]);
}

// Username rule used by both register + send/recipient lookup.
// 3–20 chars, lowercase letters, digits, underscore. Anchored.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const isValidUsername = (u) => typeof u === "string" && USERNAME_RE.test(u);

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────

const S = {};
function rebuildStyles() {
  S.page = { background: COLORS.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: COLORS.text };
  S.card = {
    background: COLORS.cardGradient || COLORS.card,
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 16, padding: 24,
    boxShadow: `0 4px 24px -8px ${COLORS.accentGlow || "transparent"}, 0 1px 0 ${COLORS.cardBorder} inset`,
  };
  S.input = {
    width: "100%", background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 10, padding: "12px 16px", color: COLORS.text, fontSize: 14,
    outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s",
  };
  S.btnPrimary = {
    width: "100%", padding: "14px 24px",
    background: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentDim} 100%)`,
    color: "#0b0b0e",
    border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
    transition: "opacity 0.15s, transform 0.1s, box-shadow 0.2s", letterSpacing: "0.02em",
    boxShadow: `0 4px 20px -4px ${COLORS.accentGlow}`,
  };
  S.btnSecondary = {
    width: "100%", padding: "13px 24px", background: "transparent", color: COLORS.text,
    border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, fontWeight: 600, fontSize: 15,
    cursor: "pointer", transition: "border-color 0.2s",
  };
  S.btnDanger = {
    width: "100%", padding: "13px 24px", background: "transparent", color: COLORS.danger,
    border: `1px solid ${COLORS.danger}`, borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer",
  };
  S.label = { fontSize: 12, color: COLORS.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 };
  S.badge = (color) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: color + "22", color: color,
  });
  S.navLink = (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: active ? 600 : 400,
    background: active ? `linear-gradient(90deg, ${COLORS.accent}22, ${COLORS.accent}08)` : "transparent",
    color: active ? COLORS.accent : COLORS.textSub,
    transition: "all 0.15s", border: "none", width: "100%", textAlign: "left",
  });
}
rebuildStyles();

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ toast, onClose }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { if (toast) { const t = setTimeout(() => onCloseRef.current?.(), 4000); return () => clearTimeout(t); } }, [toast]);
  if (!toast) return null;
  const colors = { success: COLORS.success, error: COLORS.danger, info: COLORS.blue };
  const c = colors[toast.type] || COLORS.blue;
  return (
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, animation: "slideIn 0.3s ease" }}>
      <style>{`@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ ...S.card, padding: "14px 18px", maxWidth: 340, borderLeft: `3px solid ${c}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ color: c, fontSize: 18, marginTop: 1 }}>{toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{toast.title}</div>
          {toast.message && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 3 }}>{toast.message}</div>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
    </div>
  );
}

// ─── TRANSACTION ROW ──────────────────────────────────────────────────────────

// Classify a raw transactions row into a UI-friendly shape. Deposits and
// withdrawals are encoded as self→self rows with a "[DEPOSIT]" / "[WITHDRAW]"
// marker in the note (the live schema requires NOT NULL sender/receiver).
function classifyTx(tx, userId) {
  const note = tx.note || "";
  const isDeposit = note.startsWith("[DEPOSIT]");
  const isWithdraw = note.startsWith("[WITHDRAW]");
  const isSelf = tx.sender_id === tx.receiver_id;
  let type;
  if (isDeposit && isSelf) type = "deposit";
  else if (isWithdraw && isSelf) type = "withdrawal";
  else if (tx.sender_id === userId) type = "sent";
  else type = "received";
  const counterparty =
    type === "deposit" || type === "withdrawal"
      ? note.replace(/^\[(DEPOSIT|WITHDRAW)\]\s*/, "") || "—"
      : type === "sent"
      ? tx.receiver?.username
      : tx.sender?.username;
  const isOutflow = type === "sent" || type === "withdrawal";
  return {
    id: tx.id,
    type,
    isOutflow,
    counterparty,
    amount: isOutflow ? tx.sent_amount : tx.received_amount,
    currency: isOutflow ? tx.sent_currency : tx.received_currency,
    status: tx.status,
    date: tx.created_at?.split("T")[0],
    created_at: tx.created_at,
    note: tx.note || "—",
  };
}

const TYPE_LABELS = { sent: "sent", received: "received", deposit: "deposit", withdrawal: "withdrawal" };

function TransactionRow({ tx }) {
  const isOutflow = tx.isOutflow ?? (tx.type === "sent" || tx.type === "withdrawal");
  const statusColors = { completed: COLORS.success, pending: COLORS.warning, failed: COLORS.danger };
  const statusColor = statusColors[tx.status] || COLORS.textMuted;
  const badgeColor = isOutflow ? COLORS.danger : COLORS.success;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 90px 140px 120px 1fr 100px", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${COLORS.cardBorder}`, alignItems: "center" }}>
      <div style={{ fontSize: 13, color: COLORS.textMuted }}>{tx.date}</div>
      <div><span style={{ ...S.badge(badgeColor) }}>{TYPE_LABELS[tx.type] || tx.type}</span></div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{tx.counterparty || "—"}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: isOutflow ? COLORS.danger : COLORS.success }}>{isOutflow ? "-" : "+"}{formatAmount(tx.amount, tx.currency)}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted }}>{tx.note || "—"}</div>
      <div><span style={{ ...S.badge(statusColor) }}>{tx.status}</span></div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "wallet", label: "Wallet", icon: "◈" },
  { id: "send", label: "Send", icon: "↗" },
  { id: "deposit", label: "Deposit", icon: "↓" },
  { id: "withdraw", label: "Withdraw", icon: "↑" },
  { id: "history", label: "History", icon: "≡" },
  { id: "notifications", label: "Messages", icon: "◎" },
  { id: "settings", label: "Account", icon: "⊙" },
  { id: "support", label: "Support", icon: "?" },
];

function Sidebar({ page, setPage, unread, user, onLogout, theme, toggleTheme }) {
  return (
    <div style={{ width: 220, minHeight: "100vh", background: COLORS.cardGradient || COLORS.card, borderRight: `1px solid ${COLORS.cardBorder}`, display: "flex", flexDirection: "column", padding: "24px 16px", position: "sticky", top: 0 }}>
      <div style={{ marginBottom: 36, paddingLeft: 14, cursor: "pointer" }} onClick={() => setPage("dashboard")}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: COLORS.accent }}>OZEB</div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Send money, simply.</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV_ITEMS.map(item => (
          <button key={item.id} style={S.navLink(page === item.id)} onClick={() => setPage(item.id)}>
            <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.id === "notifications" && unread > 0 && (
              <span style={{ marginLeft: "auto", background: COLORS.danger, color: "#fff", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{unread}</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ paddingTop: 16, borderTop: `1px solid ${COLORS.cardBorder}` }}>
        <button onClick={toggleTheme} style={{ ...S.navLink(false), marginBottom: 4 }}>
          <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{theme === "dark" ? "☾" : "☀"}</span>
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 99, background: COLORS.accent + "22", color: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name || "User"}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{user?.currency}</div>
          </div>
        </div>
        <button style={{ ...S.navLink(false), color: COLORS.danger }} onClick={onLogout}>
          <span>⏻</span><span>Logout</span>
        </button>
      </div>
    </div>
  );
}

// ─── HOMEPAGE ─────────────────────────────────────────────────────────────────

function HomepagePage({ setPage, RATES, theme, toggleTheme }) {
  const cursorOuterRef = useRef(null);
  const cursorInnerRef = useRef(null);
  const mousePos = useRef({ x: -200, y: -200 });
  const cursorPos = useRef({ x: -200, y: -200 });
  const rafRef = useRef(null);
  const magneticRef = useRef([]);

  // ── Body scroll unlock ──
  useEffect(() => {
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowY = "auto";
    const root = document.getElementById("root");
    if (root) root.style.overflowY = "auto";
    return () => {
      document.documentElement.style.overflowY = "";
      document.body.style.overflowY = "";
      if (root) root.style.overflowY = "";
    };
  }, []);

  // ── Custom cursor ──
  useEffect(() => {
    const onMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (cursorInnerRef.current) {
        cursorInnerRef.current.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
      }
    };
    const lerp = (a, b, t) => a + (b - a) * t;
    const tick = () => {
      cursorPos.current.x = lerp(cursorPos.current.x, mousePos.current.x, 0.12);
      cursorPos.current.y = lerp(cursorPos.current.y, mousePos.current.y, 0.12);
      if (cursorOuterRef.current) {
        cursorOuterRef.current.style.transform = `translate(${cursorPos.current.x - 20}px, ${cursorPos.current.y - 20}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Magnetic buttons ──
  useEffect(() => {
    const els = magneticRef.current.filter(Boolean);
    const onMove = (e) => {
      els.forEach(el => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = 90;
        if (dist < r) {
          const s = (1 - dist / r) * 0.32;
          el.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
          el.style.transition = "transform 0.1s";
        } else {
          el.style.transform = "";
          el.style.transition = "transform 0.55s cubic-bezier(0.23,1,0.32,1)";
        }
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ── Scroll reveal ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-reveal]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const revealBase = (delay = 0) => ({
    opacity: 0,
    transform: "translateY(64px)",
    transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  });

  const bigBtn = (onClick, children, accent = true) => (
    <button
      ref={el => { magneticRef.current[magneticRef.current.length] = el; }}
      onClick={onClick}
      onMouseEnter={() => cursorOuterRef.current?.classList.add("oz-big")}
      onMouseLeave={() => cursorOuterRef.current?.classList.remove("oz-big")}
      style={{
        padding: "17px 44px", border: accent ? "none" : `1px solid ${COLORS.cardBorder}`,
        background: accent ? COLORS.accent : "transparent",
        color: accent ? "#0b0b0e" : COLORS.text,
        borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: "none", letterSpacing: "0.01em",
      }}
    >{children}</button>
  );

  const features = [
    { icon: "◈", title: "Pay Online", desc: "Make payments without sharing your bank details. Shop anywhere that accepts Ozeb." },
    { icon: "↗", title: "Send Money", desc: "Send to a bank account or another Ozeb user instantly, in any currency." },
    { icon: "↙", title: "Receive Money", desc: "Receive from anywhere in the world via bank transfer, email or username." },
    { icon: "✦", title: "Loyalty Rewards", desc: "Earn points on every transaction. Unlock VIP benefits as your balance grows." },
  ];

  const stats = [
    { num: "5M+", label: "Active Users" },
    { num: "150+", label: "Countries" },
    { num: "5", label: "Currencies" },
    { num: "0.1s", label: "Transfer Speed" },
  ];

  const ticker = ["Send Money", "◆", "Multi-Currency Wallets", "◆", "Instant Transfers", "◆", "Earn Rewards", "◆", "Live FX Rates", "◆", "Secure & Fast", "◆", "BWP · USD · ZAR · BTC · ETH", "◆"];

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden", cursor: "none" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #44445a; }
        input, button { font-family: inherit; }

        .oz-cur-o {
          position: fixed; top: 0; left: 0; width: 40px; height: 40px;
          border: 1.5px solid ${COLORS.accent}; border-radius: 50%;
          pointer-events: none; z-index: 99998;
          transition: width .22s, height .22s, border-color .22s;
          mix-blend-mode: difference;
        }
        .oz-cur-o.oz-big { width: 68px; height: 68px; border-color: #fff; }
        .oz-cur-i {
          position: fixed; top: 0; left: 0; width: 8px; height: 8px;
          background: ${COLORS.accent}; border-radius: 50%;
          pointer-events: none; z-index: 99999;
        }

        .oz-hero-line { overflow: hidden; }
        .oz-hero-line > span { display: block; }
        .oz-hero-line:nth-child(1) > span { animation: oz-up 1.1s cubic-bezier(.16,1,.3,1) .05s both; }
        .oz-hero-line:nth-child(2) > span { animation: oz-up 1.1s cubic-bezier(.16,1,.3,1) .22s both; }
        .oz-hero-line:nth-child(3) > span { animation: oz-up 1.1s cubic-bezier(.16,1,.3,1) .39s both; }
        @keyframes oz-up { from { transform: translateY(110%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .oz-fi { animation: oz-fi .9s cubic-bezier(.16,1,.3,1) both; }
        .oz-fi-1 { animation-delay: .65s; }
        .oz-fi-2 { animation-delay: .85s; }
        .oz-fi-3 { animation-delay: 1.1s; }
        @keyframes oz-fi { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }

        @keyframes oz-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        .oz-card-hover { transition: transform .35s cubic-bezier(.16,1,.3,1), border-color .22s !important; }
        .oz-card-hover:hover { transform: translateY(-8px) !important; border-color: ${COLORS.accent}44 !important; }

        .oz-ghost-btn { transition: border-color .2s, color .2s; }
        .oz-ghost-btn:hover { border-color: ${COLORS.accent} !important; color: ${COLORS.accent} !important; }

        @keyframes oz-pulse { 0%, 100% { opacity: .25; transform: translateX(-50%) scaleY(.4); } 50% { opacity: 1; transform: translateX(-50%) scaleY(1); } }
        @keyframes oz-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes oz-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Cursor */}
      <div ref={cursorOuterRef} className="oz-cur-o" />
      <div ref={cursorInnerRef} className="oz-cur-i" />

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 900, padding: "18px 60px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(20px)", background: COLORS.bg + "cc", borderBottom: `1px solid ${COLORS.cardBorder}44` }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: "-0.05em", color: COLORS.accent }}>OZEB</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={toggleTheme}
            onMouseEnter={() => cursorOuterRef.current?.classList.add("oz-big")}
            onMouseLeave={() => cursorOuterRef.current?.classList.remove("oz-big")}
            style={{ width: 38, height: 38, borderRadius: 99, border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.text, fontSize: 16, cursor: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <button className="oz-ghost-btn" onClick={() => setPage("login")}
            onMouseEnter={() => cursorOuterRef.current?.classList.add("oz-big")}
            onMouseLeave={() => cursorOuterRef.current?.classList.remove("oz-big")}
            style={{ padding: "9px 22px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.textSub, fontSize: 14, fontWeight: 600, cursor: "none" }}>
            Log In
          </button>
          {bigBtn(() => setPage("register"), "Get Started →")}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "140px 60px 100px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 55% at 50% -5%, ${COLORS.accent}0e 0%, transparent 65%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "8%", right: "4%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.accent}07 0%, transparent 70%)`, pointerEvents: "none", animation: "oz-float 9s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "28%", right: "18%", width: 1, height: 180, background: `linear-gradient(to bottom, transparent, ${COLORS.accent}33, transparent)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "55%", left: "8%", width: 1, height: 120, background: `linear-gradient(to bottom, transparent, ${COLORS.accent}22, transparent)`, pointerEvents: "none" }} />

        <div style={{ maxWidth: 1100, position: "relative" }}>
          <div className="oz-fi oz-fi-1" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", color: COLORS.accent, textTransform: "uppercase", marginBottom: 36, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 28, height: 1, background: COLORS.accent, display: "inline-block" }} />
            The Future of Digital Payments
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(58px, 9.5vw, 132px)", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em", margin: "0 0 52px" }}>
            <div className="oz-hero-line"><span>Move</span></div>
            <div className="oz-hero-line"><span style={{ color: COLORS.accent }}>Money.</span></div>
            <div className="oz-hero-line"><span>Freely.</span></div>
          </h1>
          <p className="oz-fi oz-fi-2" style={{ fontSize: "clamp(15px, 1.4vw, 18px)", color: COLORS.textSub, maxWidth: 500, lineHeight: 1.78, marginBottom: 56 }}>
            Send, receive, and manage your money across borders. Multi-currency wallets, real-time exchange rates, and instant transfers — all in one place.
          </p>
          <div className="oz-fi oz-fi-2" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {bigBtn(() => setPage("register"), "Create Free Wallet →")}
            <button className="oz-ghost-btn" onClick={() => setPage("login")}
              onMouseEnter={() => cursorOuterRef.current?.classList.add("oz-big")}
              onMouseLeave={() => cursorOuterRef.current?.classList.remove("oz-big")}
              style={{ padding: "16px 36px", background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "none" }}>
              Sign In
            </button>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="oz-fi oz-fi-3" style={{ position: "absolute", bottom: 44, left: 60, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 30, height: 50, border: `1.5px solid ${COLORS.cardBorder}`, borderRadius: 15, position: "relative" }}>
            <div style={{ position: "absolute", top: 8, left: "50%", width: 4, height: 9, borderRadius: 2, background: COLORS.accent, animation: "oz-pulse 2.2s ease-in-out infinite" }} />
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: "0.2em", textTransform: "uppercase" }}>Scroll to explore</span>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{ overflow: "hidden", borderTop: `1px solid ${COLORS.cardBorder}`, borderBottom: `1px solid ${COLORS.cardBorder}`, padding: "15px 0", background: COLORS.card }}>
        <div style={{ display: "flex", animation: "oz-marquee 24s linear infinite", width: "max-content" }}>
          {[0, 1].map(ri => (
            <div key={ri} style={{ display: "flex", alignItems: "center" }}>
              {ticker.map((item, i) => (
                <span key={`${ri}-${i}`} style={{ padding: "0 28px", fontSize: 12, fontWeight: item === "◆" ? 900 : 600, color: item === "◆" ? COLORS.accent : COLORS.textSub, whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase" }}>{item}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section style={{ padding: "120px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div data-reveal style={{ marginBottom: 72, ...revealBase() }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", color: COLORS.accent, textTransform: "uppercase", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 28, height: 1, background: COLORS.accent, display: "inline-block" }} />What We Offer
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(36px, 5.5vw, 72px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.93 }}>
              Your Complete<br />Payment Solution
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} data-reveal className="oz-card-hover"
                onMouseEnter={() => cursorOuterRef.current?.classList.add("oz-big")}
                onMouseLeave={() => cursorOuterRef.current?.classList.remove("oz-big")}
                style={{ ...S.card, ...revealBase(i * 80), display: "flex", flexDirection: "column", gap: 14, padding: 28 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: COLORS.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: COLORS.accent }}>{f.icon}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: COLORS.textSub, lineHeight: 1.72, flex: 1 }}>{f.desc}</div>
                <span onClick={() => setPage("register")} style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, cursor: "none", letterSpacing: "0.02em" }}>Learn more →</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: `linear-gradient(135deg, ${COLORS.card} 0%, #14141c 100%)`, borderTop: `1px solid ${COLORS.cardBorder}`, borderBottom: `1px solid ${COLORS.cardBorder}`, padding: "80px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div data-reveal style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40, ...revealBase() }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(34px, 4.5vw, 58px)", fontWeight: 900, color: COLORS.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FX RATES ── */}
      <section style={{ padding: "120px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 100, alignItems: "center" }}>
          <div data-reveal style={{ ...revealBase() }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", color: COLORS.accent, textTransform: "uppercase", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 28, height: 1, background: COLORS.accent, display: "inline-block" }} />Live Exchange Rates
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 4vw, 62px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.97, marginBottom: 28 }}>
              Stay ahead<br />of the rate
            </h2>
            <p style={{ fontSize: 15, color: COLORS.textSub, lineHeight: 1.78, marginBottom: 36, maxWidth: 400 }}>
              Take control of your FX with Ozeb rate alerts. Set your target rate and get notified the moment it hits.
            </p>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 14, marginBottom: 44 }}>
              {["Custom rate notifications", "Daily updates, when you want", "Smarter conversions, better timing"].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 14, color: COLORS.textSub }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: COLORS.accent + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.accent, fontWeight: 900, flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            {bigBtn(() => setPage("register"), "Set FX alerts now →")}
          </div>

          <div data-reveal style={{ ...revealBase(160) }}>
            <div style={{ ...S.card, padding: 28, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.accent}09, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 22, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.success, display: "inline-block", boxShadow: `0 0 6px ${COLORS.success}` }} />
                Live Rates
              </div>
              {RATES && [
                { from: "USD", to: "BWP", rate: RATES.BWP / RATES.USD },
                { from: "USD", to: "ZAR", rate: RATES.ZAR / RATES.USD },
                { from: "BWP", to: "ZAR", rate: RATES.ZAR / RATES.BWP },
                { from: "USD", to: "BTC", rate: RATES.BTC },
              ].map(({ from, to, rate }, i, arr) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.cardBorder}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                    <span style={{ fontSize: 22 }}>{CURRENCY_FLAGS[from]}</span>
                    <span style={{ fontWeight: 600 }}>1 {from}</span>
                    <span style={{ color: COLORS.textMuted, fontSize: 13 }}>→</span>
                    <span style={{ fontSize: 22 }}>{CURRENCY_FLAGS[to]}</span>
                    <span style={{ color: COLORS.textMuted }}>{to}</span>
                  </div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 900, color: COLORS.accent }}>
                    {to === "BTC" ? rate.toFixed(8) : rate.toFixed(4)}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, fontSize: 11, color: COLORS.textMuted, textAlign: "right" }}>Auto-updates every hour</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BIG CTA ── */}
      <section style={{ padding: "140px 60px", position: "relative", overflow: "hidden", background: COLORS.card, borderTop: `1px solid ${COLORS.cardBorder}` }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${COLORS.accent}0c, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", left: "5%", width: 2, height: 140, background: `linear-gradient(to bottom, transparent, ${COLORS.accent}44, transparent)`, transform: "translateY(-50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", right: "5%", width: 2, height: 140, background: `linear-gradient(to bottom, transparent, ${COLORS.accent}44, transparent)`, transform: "translateY(-50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "15%", right: "12%", width: 80, height: 80, borderRadius: "50%", border: `1px solid ${COLORS.accent}22`, animation: "oz-spin-slow 18s linear infinite", pointerEvents: "none" }} />
        <div data-reveal style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", ...revealBase() }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", color: COLORS.accent, textTransform: "uppercase", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ width: 28, height: 1, background: COLORS.accent, display: "inline-block" }} />
            Get Started Today
            <span style={{ width: 28, height: 1, background: COLORS.accent, display: "inline-block" }} />
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(44px, 8.5vw, 108px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, marginBottom: 36 }}>
            Your Money,<br /><span style={{ color: COLORS.accent }}>Your Rules.</span>
          </h2>
          <p style={{ fontSize: 17, color: COLORS.textSub, maxWidth: 480, margin: "0 auto 52px", lineHeight: 1.75 }}>
            Join thousands who trust Ozeb for fast, secure, multi-currency transfers across Africa and beyond.
          </p>
          <button
            ref={el => { magneticRef.current[99] = el; }}
            onClick={() => setPage("register")}
            onMouseEnter={() => cursorOuterRef.current?.classList.add("oz-big")}
            onMouseLeave={() => cursorOuterRef.current?.classList.remove("oz-big")}
            style={{ padding: "20px 64px", background: COLORS.accent, color: "#0b0b0e", border: "none", borderRadius: 12, fontSize: 18, fontWeight: 900, cursor: "none", letterSpacing: "0.01em" }}>
            Create Your Free Wallet →
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${COLORS.cardBorder}`, padding: "36px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.bg }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: "-0.05em", color: COLORS.accent }}>OZEB</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>© 2026 Ozeb. All rights reserved.</div>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: COLORS.textMuted }}>
          <span style={{ cursor: "none" }}>Privacy</span>
          <span style={{ cursor: "none" }}>Terms</span>
          <span style={{ cursor: "none", color: COLORS.accent, fontWeight: 700 }} onClick={() => setPage("register")}>Sign Up →</span>
        </div>
      </footer>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

function LoginPage({ setPage, setUser, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", data.user.id).single();
    setUser({
      id: data.user.id,
      name: profile?.full_name || "User",
      email: data.user.email,
      currency: wallet?.currency || "BWP",
      balance: wallet?.balance || 0,
      username: profile?.username || "",
    });
    setPage("dashboard");
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address first, then click Forgot Password."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("That doesn't look like a valid email address."); return; }
    setError("");
    const { error: rpErr } = await supabase.auth.resetPasswordForEmail(email);
    if (rpErr) { showToast?.("error", "Couldn't send reset email", rpErr.message); return; }
    showToast?.("success", "Reset email sent", `Check ${email} for a password reset link.`);
  };

  const handleEmailChange = (e) => setEmail(e.target.value.trim().toLowerCase());

  return (
    <div style={{ ...S.page, background: COLORS.bgGradient || COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800;900&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } html, body, #root { height: 100%; width: 100%; background: ${COLORS.bg}; } input::placeholder { color: ${COLORS.textMuted}; }`}</style>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 60% at 50% 10%, ${COLORS.accent}0a 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.06em", color: COLORS.accent, fontFamily: "'Syne', sans-serif" }}>OZEB</div>
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>Join the Network. Send money, simply.</div>
        </div>
        <div style={S.card}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", fontFamily: "'Syne', sans-serif" }}>Welcome back</h2>
            <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>Sign in to your Ozeb account</p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Email Address</label>
            <input style={S.input} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={handleEmailChange} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={S.label}>Password</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...S.input, paddingRight: 44 }} type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 14 }}>{showPw ? "Hide" : "Show"}</button>
            </div>
          </div>
          <div style={{ textAlign: "right", marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: COLORS.blue, cursor: "pointer" }} onClick={handleForgotPassword}>Forgot password?</span>
          </div>
          {error && <div style={{ background: COLORS.danger + "15", border: `1px solid ${COLORS.danger}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: COLORS.danger }}>{error}</div>}
          <button style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: COLORS.textMuted }}>
            Don't have an account?{" "}
            <span style={{ color: COLORS.accent, cursor: "pointer", fontWeight: 600 }} onClick={() => setPage("register")}>Create Account</span>
          </div>
          <div style={{ marginTop: 16, padding: "10px 14px", background: COLORS.inputBg, borderRadius: 8, fontSize: 12, color: COLORS.textMuted, textAlign: "center" }}>
            Demo: <span style={{ color: COLORS.textSub }}>demo@ozeb.com</span> / <span style={{ color: COLORS.textSub }}>demo1234</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REGISTER PAGE ────────────────────────────────────────────────────────────

function RegisterPage({ setUser, setPage, showToast }) {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirm: "", currency: "BWP" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);
  // OTP step state
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);

  const currencies = ["BWP", "USD", "ZAR", "BTC", "ETH"];
  const currencyFlags = { BWP: "🇧🇼", USD: "🇺🇸", ZAR: "🇿🇦", BTC: "₿", ETH: "Ξ" };

  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 7) errors.push("at least 7 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("a capital letter");
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) errors.push("a special character");
    return errors;
  };

  const getStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "", color: "transparent" };
    let score = 0;
    if (pwd.length >= 7) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) score++;
    if (score <= 1) return { score, label: "Weak", color: COLORS.danger };
    if (score <= 2) return { score, label: "Fair", color: COLORS.warning };
    if (score <= 3) return { score, label: "Good", color: COLORS.blue };
    return { score, label: "Strong", color: COLORS.success };
  };

  const usernameDebounceRef = useRef(null);
  const usernameReqIdRef = useRef(0);

  const checkUsername = (raw) => {
    const val = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    setForm(f => ({ ...f, username: val }));
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    if (!val) { setUsernameStatus(null); return; }
    if (!isValidUsername(val)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    usernameDebounceRef.current = setTimeout(async () => {
      const reqId = ++usernameReqIdRef.current;
      const { data } = await supabase.from("profiles").select("id").eq("username", val).maybeSingle();
      if (reqId !== usernameReqIdRef.current) return;
      setUsernameStatus(data ? "taken" : "available");
    }, 350);
  };

  useEffect(() => () => { if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current); }, []);

  const requestOtp = async () => {
    if (!form.name.trim() || !form.username || !form.email || !form.password) { setError("All fields are required."); return; }
    if (form.name.trim().length < 2) { setError("Please enter your full name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Enter a valid email address."); return; }
    if (!isValidUsername(form.username)) { setError("Username must be 3–20 chars: letters, digits, underscore."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    const pwdErrors = validatePassword(form.password);
    if (pwdErrors.length > 0) { setError("Password needs: " + pwdErrors.join(", ")); return; }
    if (usernameStatus === "taken") { setError("That username is already taken."); return; }
    if (usernameStatus === "checking") { setError("Hold on while we check that username."); return; }
    if (usernameStatus !== "available") { setError("Pick a valid, available username before continuing."); return; }
    setLoading(true); setError("");

    // Supabase emails a 6-digit OTP; shouldCreateUser creates the auth user
    // (unconfirmed) so verifyOtp returns a session we can attach a password to.
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: form.email,
      options: {
        shouldCreateUser: true,
        data: { full_name: form.name, username: form.username, primary_currency: form.currency },
      },
    });
    if (otpErr) {
      setError(otpErr.message || "Could not send verification code. Please try again.");
      setLoading(false);
      return;
    }
    setOtpStep(true);
    setLoading(false);
    if (showToast) showToast("info", "Verification code sent", `We emailed a 6-digit code to ${form.email}.`);
  };

  const resendOtp = async () => {
    if (otpSending) return;
    setOtpSending(true);
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: form.email,
      options: {
        shouldCreateUser: true,
        data: { full_name: form.name, username: form.username, primary_currency: form.currency },
      },
    });
    setOtpSending(false);
    if (otpErr) { setError(otpErr.message || "Failed to resend code."); return; }
    setError("");
    if (showToast) showToast("info", "Code resent", `Check ${form.email} again.`);
  };

  const verifyOtpAndRegister = async () => {
    if (!/^\d{4,8}$/.test(otpCode)) { setError("Enter the code from your email."); return; }
    setLoading(true); setError("");

    // Verify the OTP — this confirms the email and returns a live session.
    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      email: form.email,
      token: otpCode,
      type: "email",
    });
    if (verifyErr || !verifyData?.user) {
      setError(verifyErr?.message || "That code didn't match. Try again.");
      setLoading(false);
      return;
    }

    // Attach the password the user chose on the signup form.
    const { error: pwdErr } = await supabase.auth.updateUser({ password: form.password });
    if (pwdErr) { setError(pwdErr.message); setLoading(false); return; }

    const userId = verifyData.user.id;

    // Poll for the on-signup trigger to create profile + wallet rows. We try for
    // up to ~6 seconds (200ms cadence) before giving up and using form defaults
    // — the realtime subscriptions will pick up the rows when they exist.
    let profile = null, wallet = null;
    for (let i = 0; i < 30; i++) {
      const [{ data: p }, { data: w }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      profile = p; wallet = w;
      if (profile && wallet) break;
      await new Promise(res => setTimeout(res, 200));
    }

    setUser({
      id: userId,
      name: profile?.full_name || form.name,
      email: verifyData.user.email,
      currency: wallet?.currency || form.currency,
      balance: wallet?.balance || 0,
      username: profile?.username || form.username,
    });
    setPage("dashboard");
    setLoading(false);
  };

  const strength = getStrength(form.password);

  if (otpStep) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", overflowY: "auto", background: COLORS.bg }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.accent, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>OZEB</div>
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>Verify your email</div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 36, textAlign: "center", marginBottom: 6 }}>✉️</div>
          <div style={{ fontSize: 16, fontWeight: 800, textAlign: "center", marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>Enter the 6-digit code</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginBottom: 20 }}>
            We sent a verification code to <span style={{ color: COLORS.text, fontWeight: 700 }}>{form.email}</span>.
          </div>
          <input autoFocus value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="123456" inputMode="numeric"
            style={{ ...S.input, fontSize: 22, fontWeight: 700, textAlign: "center", letterSpacing: "0.4em" }}
            onKeyDown={e => e.key === "Enter" && verifyOtpAndRegister()} />
          {error && <div style={{ background: COLORS.danger + "15", border: `1px solid ${COLORS.danger}33`, borderRadius: 8, padding: "10px 14px", marginTop: 14, fontSize: 13, color: COLORS.danger }}>{error}</div>}
          <button onClick={verifyOtpAndRegister} disabled={loading}
            style={{ ...S.btnPrimary, marginTop: 18, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Verifying…" : "Verify & Create Account"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: COLORS.textMuted }}>
            <span onClick={() => { setOtpStep(false); setOtpCode(""); setError(""); }} style={{ color: COLORS.accent, cursor: "pointer", fontWeight: 600 }}>← Back</span>
            <span onClick={resendOtp} style={{ color: otpSending ? COLORS.textMuted : COLORS.blue, cursor: otpSending ? "default" : "pointer", fontWeight: 600 }}>
              {otpSending ? "Resending…" : "Resend code"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", overflowY: "auto", background: COLORS.bg }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.accent, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>OZEB</div>
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>Create your account</div>
        </div>
        <div style={S.card}>
          {/* Name + Username */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Full Name</div>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Obakeng"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Username</div>
              <div style={{ position: "relative" }}>
                <input value={form.username} onChange={e => checkUsername(e.target.value)} placeholder="ob_bw" maxLength={20}
                  style={{ width: "100%", padding: "10px 36px 10px 14px", borderRadius: 10, border: `1px solid ${usernameStatus === "available" ? COLORS.success : (usernameStatus === "taken" || usernameStatus === "invalid") ? COLORS.danger : COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
                {usernameStatus && usernameStatus !== "checking" && (
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: usernameStatus === "available" ? COLORS.success : COLORS.danger }}>
                    {usernameStatus === "available" ? "✓" : "✗"}
                  </span>
                )}
                {usernameStatus === "checking" && (
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: COLORS.textMuted }}>…</span>
                )}
              </div>
              {usernameStatus === "taken" && <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>Username already taken</div>}
              {usernameStatus === "available" && <div style={{ fontSize: 11, color: COLORS.success, marginTop: 4 }}>Username available</div>}
              {usernameStatus === "invalid" && <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>3–20 chars: letters, digits, underscore</div>}
            </div>
          </div>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email Address</div>
            <input type="email" autoComplete="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value.trim().toLowerCase() }))} placeholder="you@example.com"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          {/* Password */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</div>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 7 chars, 1 capital, 1 special"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          {/* Strength bar + pills */}
          {form.password && (
            <>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= strength.score ? strength.color : COLORS.cardBorder, transition: "background 0.2s" }} />
                ))}
                <span style={{ fontSize: 11, color: strength.color, marginLeft: 6, fontWeight: 600 }}>{strength.label}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {[
                  { label: "7+ characters", pass: form.password.length >= 7 },
                  { label: "Capital letter", pass: /[A-Z]/.test(form.password) },
                  { label: "Special character", pass: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password) },
                ].map(r => (
                  <span key={r.label} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: r.pass ? COLORS.success + "18" : COLORS.danger + "18", color: r.pass ? COLORS.success : COLORS.danger, border: `1px solid ${r.pass ? COLORS.success : COLORS.danger}`, transition: "all 0.2s" }}>
                    {r.pass ? "✓" : "✗"} {r.label}
                  </span>
                ))}
              </div>
            </>
          )}
          {/* Confirm Password */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Confirm Password</div>
            <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Re-enter password"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${form.confirm && form.confirm !== form.password ? COLORS.danger : form.confirm && form.confirm === form.password ? COLORS.success : COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
            {form.confirm && form.confirm !== form.password && <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>Passwords do not match</div>}
            {form.confirm && form.confirm === form.password && <div style={{ fontSize: 11, color: COLORS.success, marginTop: 4 }}>✓ Passwords match</div>}
          </div>
          {/* Currency */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wallet Currency</div>
            <div style={{ display: "flex", gap: 8 }}>
              {currencies.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, currency: c }))}
                  style={{
                    flex: 1, padding: "10px 6px", borderRadius: 12,
                    border: `2px solid ${form.currency === c ? COLORS.accent : COLORS.cardBorder}`,
                    background: form.currency === c
                      ? `linear-gradient(135deg, ${COLORS.accent}2e, ${COLORS.accent}10)`
                      : COLORS.inputBg,
                    boxShadow: form.currency === c ? `0 4px 16px -6px ${COLORS.accentGlow}` : "none",
                    cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                  }}>
                  <div style={{ fontSize: 18 }}>{currencyFlags[c]}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: form.currency === c ? COLORS.accent : COLORS.textSub, marginTop: 4 }}>{c}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>You can change your currency later in Settings.</div>
          </div>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: COLORS.danger + "18", border: `1px solid ${COLORS.danger}40`, color: COLORS.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <button onClick={requestOtp} disabled={loading}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: loading ? COLORS.cardBorder : COLORS.accent, color: loading ? COLORS.textMuted : "#000", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
            {loading ? "Sending code…" : "Continue → Verify Email"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: COLORS.textMuted }}>
            Already have an account?{" "}
            <span onClick={() => setPage("login")} style={{ color: COLORS.accent, cursor: "pointer", fontWeight: 600 }}>Sign In</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function DashboardPage({ user, setPage, setUser, RATES }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState({ sent: 0, sentCount: 0, received: 0, receivedCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      const { data: walletData } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
      if (walletData) {
        setWallet(walletData);
        setUser(prev => ({ ...prev, balance: walletData.balance, currency: walletData.currency }));
      }

      const { data: txData } = await supabase
        .from("transactions")
        .select(`*, sender:profiles!sender_id(username), receiver:profiles!receiver_id(username)`)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: true });

      if (txData) {
        const classified = txData.map(tx => classifyTx(tx, user.id));

        // Build real running balance chart
        let running = 0;
        const points = classified.map(tx => {
          running += tx.isOutflow ? -Number(tx.amount || 0) : Number(tx.amount || 0);
          return {
            d: new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
            v: parseFloat(running.toFixed(4)),
          };
        });
        if (walletData) points.push({ d: "Now", v: parseFloat(Number(walletData.balance).toFixed(4)) });
        setChartData(points.length < 2 ? [{ d: "Start", v: 0 }, { d: "Now", v: walletData?.balance || 0 }] : points);

        // Recent 4 transactions (most recent first)
        setTransactions(classified.slice(-4).reverse());

        // 30-day stats: outflow vs inflow (counts deposits and withdrawals too)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const recent = classified.filter(t => t.created_at >= thirtyDaysAgo);
        const out = recent.filter(t => t.isOutflow);
        const inn = recent.filter(t => !t.isOutflow);
        setStats({
          sent: out.reduce((s, t) => s + Number(t.amount || 0), 0),
          sentCount: out.length,
          received: inn.reduce((s, t) => s + Number(t.amount || 0), 0),
          receivedCount: inn.length,
        });
      }
      setLoading(false);
    };

    loadData();

    const walletChannel = supabase.channel("dash-wallet")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => loadData())
      .subscribe();
    const txChannel = supabase.channel("dash-tx")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `sender_id=eq.${user.id}` }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `receiver_id=eq.${user.id}` }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(walletChannel); supabase.removeChannel(txChannel); };
    // setUser from useState is stable, intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const balance = wallet?.balance || 0;
  const currency = wallet?.currency || user?.currency || "BWP";
  const rate = RATES[currency] || 1;

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", fontFamily: "'Syne', sans-serif" }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: COLORS.textMuted, margin: 0 }}>Good day, {user?.name?.split(" ")[0] || "User"} 👋</p>
      </div>
      {loading ? (
        <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Loading your wallet...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Total Balance", value: formatAmount(balance, currency), sub: `~$${(balance / rate).toFixed(2)} USD`, color: COLORS.accent },
              { label: "Sent (30d)", value: formatAmount(stats.sent, currency), sub: `${stats.sentCount} transfer${stats.sentCount !== 1 ? "s" : ""}`, color: COLORS.danger },
              { label: "Received (30d)", value: formatAmount(stats.received, currency), sub: `${stats.receivedCount} transfer${stats.receivedCount !== 1 ? "s" : ""}`, color: COLORS.success },
            ].map((stat, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontSize: 12, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 10 }}>{stat.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{stat.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Balance History</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>All time</div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.accent} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="d" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 8, fontSize: 12 }}/>
                  <Area type="monotone" dataKey="v" stroke={COLORS.accent} strokeWidth={2} fill="url(#grad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Quick Actions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Send Money", icon: "↗", action: "send", color: COLORS.accent },
                  { label: "Deposit", icon: "↓", action: "deposit", color: COLORS.success },
                  { label: "Withdraw", icon: "↑", action: "withdraw", color: COLORS.danger },
                  { label: "View History", icon: "≡", action: "history", color: COLORS.blue },
                ].map(a => (
                  <button key={a.action} onClick={() => setPage(a.action)} style={{ padding: "16px 12px", borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, background: a.color + "10", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                    <div style={{ fontSize: 22, color: a.color, marginBottom: 6 }}>{a.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSub }}>{a.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ ...S.card, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Recent Transactions</div>
              <span style={{ fontSize: 13, color: COLORS.accent, cursor: "pointer" }} onClick={() => setPage("history")}>View all →</span>
            </div>
            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: COLORS.textMuted }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No transactions yet</div>
                <div style={{ fontSize: 13 }}>Send money to get started</div>
              </div>
            ) : (
              transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── WALLET PAGE ──────────────────────────────────────────────────────────────

function WalletPage({ user, setUser, RATES }) {
  const [wallet, setWallet] = useState(null);
  const [walletChartData, setWalletChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const loadAll = async () => {
      const [{ data: walletData }, { data: txData }] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id).single(),
        supabase.from("transactions")
          .select("created_at, sender_id, receiver_id, sent_amount, received_amount, sent_currency, received_currency, status, note")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order("created_at", { ascending: true }),
      ]);
      if (walletData) {
        setWallet(walletData);
        setUser(prev => ({ ...prev, balance: walletData.balance, currency: walletData.currency }));
      }
      // Running-balance chart. classifyTx handles deposits (self-self with
      // [DEPOSIT] note → inflow) and withdrawals ([WITHDRAW] → outflow).
      let running = 0;
      const points = (txData || []).map(raw => {
        const tx = classifyTx(raw, user.id);
        running += tx.isOutflow ? -Number(tx.amount || 0) : Number(tx.amount || 0);
        return {
          d: new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          v: parseFloat(running.toFixed(4)),
        };
      });
      if (walletData) points.push({ d: "Now", v: parseFloat(Number(walletData.balance).toFixed(4)) });
      setWalletChartData(points.length < 2 ? [{ d: "Start", v: 0 }, { d: "Now", v: walletData?.balance || 0 }] : points);
      setLoading(false);
    };
    loadAll();
    const walletCh = supabase.channel("live-wallet")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => loadAll())
      .subscribe();
    const txCh = supabase.channel("live-wallet-tx")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `sender_id=eq.${user.id}` }, () => loadAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `receiver_id=eq.${user.id}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(walletCh); supabase.removeChannel(txCh); };
    // setUser from useState is stable, intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const balance = wallet?.balance || 0;
  const currency = wallet?.currency || user?.currency || "BWP";
  const usdValue = RATES[currency] ? (balance / RATES[currency]).toFixed(2) : "0.00";

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 24px", fontFamily: "'Syne', sans-serif" }}>My Wallet</h1>
      {loading ? (
        <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Loading wallet...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={S.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: "0.06em", marginBottom: 8 }}>PRIMARY WALLET</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                {CURRENCY_FLAGS[currency]} {CURRENCY_NAMES[currency]}
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: COLORS.success, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>
                {formatAmount(balance, currency)}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6 }}>≈ ${usdValue} USD</div>
              <div style={{ marginTop: 12, display: "inline-block", padding: "4px 12px", borderRadius: 99, background: COLORS.success + "20", color: COLORS.success, fontSize: 12, fontWeight: 600 }}>✓ Active</div>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Portfolio Breakdown</div>
              {["BWP", "USD", "ZAR", "BTC", "ETH"].map(c => (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 99, background: COLORS.cardBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    {CURRENCY_FLAGS[c]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>{CURRENCY_NAMES[c]}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c === currency ? formatAmount(balance, currency) : formatAmount(0, c)}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>${c === currency ? usdValue : "0.00"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Balance Over Time — {currency}</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={walletChartData}>
                <defs><linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3}/><stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="d" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 8, fontSize: 12 }}/>
                <Area type="monotone" dataKey="v" stroke={COLORS.success} strokeWidth={2} fill="url(#wgrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SEND PAGE ────────────────────────────────────────────────────────────────

function SendPage({ user, setUser, showToast, setPage, RATES }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recipientStatus, setRecipientStatus] = useState(null);
  const [recipientCurrency, setRecipientCurrency] = useState("USD");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const recipientDebounceRef = useRef(null);
  const recipientReqIdRef = useRef(0);

  const checkRecipient = (val) => {
    if (recipientDebounceRef.current) clearTimeout(recipientDebounceRef.current);
    if (!val) { setRecipientStatus(null); return; }
    if (val.toLowerCase() === (user?.username || "").toLowerCase()) { setRecipientStatus("self"); return; }
    if (!isValidUsername(val.toLowerCase())) { setRecipientStatus("invalid"); return; }
    setRecipientStatus("checking");
    recipientDebounceRef.current = setTimeout(async () => {
      const reqId = ++recipientReqIdRef.current;
      const { data } = await supabase.from("profiles").select("id, username, primary_currency").eq("username", val.toLowerCase()).maybeSingle();
      // Drop stale responses if a newer query has fired since.
      if (reqId !== recipientReqIdRef.current) return;
      if (data && data.id !== user.id) {
        setRecipientStatus("found");
        setRecipientCurrency(data.primary_currency);
      } else {
        setRecipientStatus("not_found");
      }
    }, 300);
  };

  useEffect(() => () => { if (recipientDebounceRef.current) clearTimeout(recipientDebounceRef.current); }, []);

  // Esc closes the confirm modal.
  useEffect(() => {
    if (!showConfirm) return;
    const onKey = (e) => { if (e.key === "Escape") setShowConfirm(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showConfirm]);

  const parsedAmount = parseFloat(amount) || 0;
  const senderCurrency = user?.currency || "BWP";
  const convertedAmount = parsedAmount > 0 ? convertAmount(parsedAmount, senderCurrency, recipientCurrency, RATES) : 0;
  const isCross = senderCurrency !== recipientCurrency;
  const balance = user?.balance || 0;
  const FEE_RATE = 0.05;
  const fee = parsedAmount > 0 ? parsedAmount * FEE_RATE : 0;
  const totalDeducted = parsedAmount + fee;
  const insufficient = totalDeducted > balance;

  if (showSuccess) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 36 }}>
      <div style={{ ...S.card, maxWidth: 400, width: "100%", textAlign: "center", padding: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: 99, background: COLORS.success + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>✓</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.success, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Transfer Complete</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 28 }}>Your money has been sent successfully.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button style={S.btnSecondary} onClick={() => setPage("dashboard")}>Back to Dashboard</button>
          <button style={S.btnPrimary} onClick={() => { setShowSuccess(false); setRecipient(""); setAmount(""); setNote(""); }}>Send Another</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 28px", fontFamily: "'Syne', sans-serif" }}>Send Money</h1>
      <div style={{ maxWidth: 540 }}>
        <div style={S.card}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Recipient Username</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...S.input, paddingRight: 36, borderColor: (recipientStatus === "not_found" || recipientStatus === "self" || recipientStatus === "invalid") ? COLORS.danger : recipientStatus === "found" ? COLORS.success : COLORS.cardBorder }}
                placeholder="e.g. ob_bw" value={recipient}
                onChange={e => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""); setRecipient(v); checkRecipient(v); }}
                maxLength={20} />
              {recipientStatus === "found" && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.success }}>✓</span>}
              {(recipientStatus === "not_found" || recipientStatus === "self" || recipientStatus === "invalid") && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.danger }}>✕</span>}
              {recipientStatus === "checking" && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted, fontSize: 12 }}>…</span>}
            </div>
            {recipientStatus === "found" && <div style={{ fontSize: 12, color: COLORS.success, marginTop: 6 }}>✓ User found · Wallet currency: {recipientCurrency}</div>}
            {recipientStatus === "not_found" && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 6 }}>✕ No user found with that username</div>}
            {recipientStatus === "self" && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 6 }}>✕ You can't send money to yourself</div>}
            {recipientStatus === "invalid" && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 6 }}>✕ Username must be 3–20 chars: letters, digits, underscore</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Amount ({senderCurrency})</label>
            <input style={{ ...S.input, fontSize: 22, fontWeight: 700, borderColor: insufficient ? COLORS.danger : COLORS.cardBorder }}
              type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: COLORS.textMuted }}>
              <span>Available: {formatAmount(balance, senderCurrency)}</span>
              {insufficient && <span style={{ color: COLORS.danger }}>Insufficient (incl. 5% fee)</span>}
            </div>
            {parsedAmount > 0 && (
              <div style={{ background: COLORS.warning + "10", border: `1px solid ${COLORS.warning}22`, borderRadius: 8, padding: "8px 14px", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span style={{ color: COLORS.textMuted }}>5% transfer fee</span>
                <span style={{ color: COLORS.warning, fontWeight: 700 }}>+ {formatAmount(fee, senderCurrency)}</span>
              </div>
            )}
          </div>
          {parsedAmount > 0 && recipientStatus === "found" && isCross && (
            <div style={{ background: COLORS.blue + "12", border: `1px solid ${COLORS.blue}33`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>Cross-currency conversion</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{formatAmount(parsedAmount, senderCurrency)} → {formatAmount(convertedAmount, recipientCurrency)}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                Rate: 1 {senderCurrency} = {RATES[senderCurrency] && RATES[recipientCurrency] ? (RATES[recipientCurrency] / RATES[senderCurrency]).toFixed(6) : "—"} {recipientCurrency}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Note (optional)</label>
            <input style={S.input} placeholder="What's this for?" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <button style={{ ...S.btnPrimary, opacity: (!recipient || parsedAmount <= 0 || recipientStatus !== "found" || insufficient) ? 0.4 : 1 }}
            onClick={() => setShowConfirm(true)} disabled={!recipient || parsedAmount <= 0 || recipientStatus !== "found" || insufficient}>
            Review Transfer →
          </button>
        </div>
      </div>
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowConfirm(false)}>
          <div style={{ ...S.card, width: "100%", maxWidth: 420, margin: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💸</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", fontFamily: "'Syne', sans-serif" }}>Confirm Transfer</h2>
              <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>Please review before confirming</p>
            </div>
            <div style={{ background: COLORS.inputBg, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              {[
                ["To", recipient, null],
                ["Amount", formatAmount(parsedAmount, senderCurrency), null],
                ["Fee (5%)", formatAmount(fee, senderCurrency), COLORS.warning],
                ["Total Charged", formatAmount(totalDeducted, senderCurrency), COLORS.accent],
                isCross ? ["They Receive", formatAmount(convertedAmount, recipientCurrency), null] : null,
                ["Note", note || "—", null],
              ].filter(Boolean).map(([k, v, vc], idx) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: idx < 5 ? 10 : 0, fontSize: 14,
                  ...(k === "Total Charged" ? { borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: 12, marginTop: 4, marginBottom: 12 } : {}),
                }}>
                  <span style={{ color: k === "Total Charged" ? COLORS.text : COLORS.textMuted, fontWeight: k === "Total Charged" ? 700 : 400 }}>{k}</span>
                  <span style={{ fontWeight: 700, color: vc || COLORS.text }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button style={S.btnSecondary} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }}
                onClick={async () => {
                  if (parsedAmount <= 0) { showToast("error", "Invalid amount", "Amount must be greater than zero."); return; }
                  if (insufficient) { showToast("error", "Insufficient balance", "You can't cover this transfer plus the 5% fee."); return; }
                  setLoading(true);
                  try {
                    const { data, error } = await supabase.rpc("send_money", {
                      p_sender_id: user.id,
                      p_receiver_username: recipient,
                      p_amount: parsedAmount,
                      p_note: note || null,
                    });
                    if (error) throw new Error(error.message);
                    if (!data?.success) throw new Error(data?.error || "Transfer failed");
                    // Re-fetch wallet so the displayed balance matches what the RPC actually wrote.
                    const { data: w } = await supabase.from("wallets").select("balance, currency").eq("user_id", user.id).single();
                    if (w) setUser(prev => ({ ...prev, balance: Number(w.balance), currency: w.currency }));
                    setShowConfirm(false);
                    setShowSuccess(true);
                    showToast("success", "Transfer Sent!", `${formatAmount(parsedAmount, senderCurrency)} sent to ${recipient}`);
                  } catch (err) {
                    showToast("error", "Transfer Failed", err.message);
                    setShowConfirm(false);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}>
                {loading ? "Sending…" : "Confirm ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

function HistoryPage({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const loadTransactions = async () => {
      const { data } = await supabase
        .from("transactions")
        .select(`*, sender:profiles!sender_id(username), receiver:profiles!receiver_id(username)`)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (data) setTransactions(data.map(tx => classifyTx(tx, user.id)));
      setLoading(false);
    };
    loadTransactions();
    const channel = supabase.channel("live-history")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `sender_id=eq.${user.id}` }, async () => await loadTransactions())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `receiver_id=eq.${user.id}` }, async () => await loadTransactions())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const filtered = transactions.filter(tx => filter === "all" ? true : tx.type === filter);

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, fontFamily: "'Syne', sans-serif" }}>Transaction History</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "sent", "received", "deposit", "withdrawal"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 16px", borderRadius: 8, border: `1px solid ${filter === f ? COLORS.accent : COLORS.cardBorder}`, background: filter === f ? COLORS.accent : "transparent", color: filter === f ? "#000" : COLORS.textMuted, fontSize: 13, cursor: "pointer", fontWeight: filter === f ? 700 : 400, textTransform: "capitalize", transition: "all 0.15s" }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: COLORS.textMuted, fontSize: 14 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: COLORS.textMuted }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No transactions yet</div>
            <div style={{ fontSize: 13 }}>Send money to get started</div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "120px 90px 140px 120px 1fr 100px", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${COLORS.cardBorder}`, marginBottom: 4 }}>
              {["DATE", "TYPE", "COUNTERPARTY", "AMOUNT", "NOTE", "STATUS"].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: "0.06em" }}>{h}</div>
              ))}
            </div>
            {filtered.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
          </>
        )}
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS PAGE ───────────────────────────────────────────────────────

function NotificationsPage({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const loadNotifications = async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) setNotifications(data);
      setLoading(false);
    };
    loadNotifications();
    const channel = supabase.channel("live-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const markAll = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markOne = async (id) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const typeIcons = { transfer: "💸", deposit: "↓", withdrawal: "↑", system: "⚙️", security: "🔒" };
  const typeColors = { transfer: COLORS.success, deposit: COLORS.success, withdrawal: COLORS.danger, system: COLORS.blue, security: COLORS.warning };

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, fontFamily: "'Syne', sans-serif" }}>Notifications</h1>
        <button style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }} onClick={markAll}>Mark all read</button>
      </div>
      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: COLORS.textMuted, fontSize: 14 }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: COLORS.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No notifications yet</div>
            <div style={{ fontSize: 13 }}>You'll see transfers and updates here</div>
          </div>
        ) : (
          notifications.map((n, i) => (
            <div key={n.id} onClick={() => markOne(n.id)} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: i < notifications.length - 1 ? `1px solid ${COLORS.cardBorder}` : "none", cursor: "pointer", opacity: n.is_read ? 0.6 : 1, transition: "opacity 0.2s" }}>
              <div style={{ width: 42, height: 42, borderRadius: 99, background: (typeColors[n.type] || COLORS.blue) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{typeIcons[n.type] || "📢"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 3 }}>{n.message}</div>
              </div>
              {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: 99, background: COLORS.blue, alignSelf: "center", flexShrink: 0 }} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── DEPOSIT PAGE ─────────────────────────────────────────────────────────────

function DepositPage({ user, setUser, showToast, setPage }) {
  // Steps: "method" → ("mobile"|"card") → "amount" → "success"
  const [step, setStep] = useState("method");
  const [method, setMethod] = useState(null); // "myzaka" | "orange" | "card"
  const [mobile, setMobile] = useState({ number: "", pin: "" });
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositedAmount, setDepositedAmount] = useState(0);

  const currency = user?.currency || "BWP";
  const balance = user?.balance || 0;

  const METHODS = [
    { id: "myzaka",  label: "MyZaka",       sub: "Mascom mobile money", icon: "📱" },
    { id: "orange",  label: "Orange Money", sub: "Orange mobile money", icon: "🟠" },
    { id: "card",    label: "Card",         sub: "Visa / Mastercard",   icon: "💳" },
  ];

  const selectMethod = (id) => {
    setMethod(id);
    setStep(id === "card" ? "card" : "mobile");
  };

  // Botswana mobile numbers: exactly 8 digits, starting with 7 (e.g. 71234567).
  // We accept an optional +267 / 267 country prefix and strip it before checking.
  // This applies to both MyZaka (Mascom) and Orange Money.
  const normalizeBwNumber = (raw) => {
    let d = (raw || "").replace(/\D/g, "");
    if (d.startsWith("267")) d = d.slice(3);
    return d;
  };
  const mobileValid = () => {
    const digits = normalizeBwNumber(mobile.number);
    // PIN is 4–5 digits across the major Botswana mobile-money providers.
    return /^7\d{7}$/.test(digits) && /^\d{4,5}$/.test(mobile.pin);
  };

  // Luhn check — catches typos in card numbers without making it impossible to test.
  const luhnOk = (num) => {
    if (!/^\d+$/.test(num)) return false;
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = parseInt(num[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  };

  const expiryOk = (exp) => {
    const m = /^(\d{2})\/(\d{2})$/.exec(exp);
    if (!m) return false;
    const month = parseInt(m[1], 10);
    const year = 2000 + parseInt(m[2], 10);
    if (month < 1 || month > 12) return false;
    // Card is valid through the LAST day of its expiry month.
    const now = new Date();
    const endOfExpiry = new Date(year, month, 0, 23, 59, 59);
    if (endOfExpiry < now) return false;
    // No card legitimately expires more than 20 years out — reject obvious typos.
    if (year > now.getFullYear() + 20) return false;
    return true;
  };

  const cardValid = () => {
    const num = card.number.replace(/\s/g, "");
    return /^\d{13,19}$/.test(num) && luhnOk(num) && expiryOk(card.expiry) && /^\d{3,4}$/.test(card.cvv) && card.name.trim().length >= 2;
  };

  const formatCardNumber = (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  // Format the BW number progressively as "7X XXX XXX" (8 digits).
  const formatBwNumber = (v) => {
    let d = (v || "").replace(/\D/g, "");
    if (d.startsWith("267")) d = d.slice(3);
    d = d.slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  };

  const submitDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast("error", "Invalid amount", "Enter an amount greater than zero."); return; }
    if (amt > 1000000) { showToast("error", "Amount too large", "Please enter a smaller amount."); return; }

    setLoading(true);
    try {
      // Simulate network latency — mobile money/card processing
      await new Promise(r => setTimeout(r, 1500));

      const newBalance = Number(balance) + amt;

      const { error: walletErr } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", user.id);
      if (walletErr) throw new Error(walletErr.message);

      // Schema requires NOT NULL sender_id/receiver_id and has no `type` column,
      // so we encode deposits as a self→self row tagged in the note. The
      // History/Dashboard mappers detect the [DEPOSIT] marker.
      const methodLabel = method === "myzaka" ? "MyZaka" : method === "orange" ? "Orange Money" : "Card";
      const { error: txErr } = await supabase.from("transactions").insert({
        sender_id: user.id,
        receiver_id: user.id,
        sent_amount: amt,
        received_amount: amt,
        sent_currency: currency,
        received_currency: currency,
        status: "completed",
        note: `[DEPOSIT] via ${methodLabel}`,
      });
      if (txErr) console.warn("Deposit transaction insert failed:", txErr.message);
      const { error: nErr } = await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Deposit successful",
        message: `${formatAmount(amt, currency)} added via ${methodLabel}.`,
        is_read: false,
        type: "transfer",
      });
      if (nErr) console.warn("Deposit notification insert failed:", nErr.message);

      setUser(prev => ({ ...prev, balance: newBalance }));
      setDepositedAmount(amt);
      setStep("success");
      showToast("success", "Deposit successful", `${formatAmount(amt, currency)} added to your wallet.`);
    } catch (err) {
      showToast("error", "Deposit failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("method"); setMethod(null);
    setMobile({ number: "", pin: "" });
    setCard({ number: "", expiry: "", cvv: "", name: "" });
    setAmount(""); setDepositedAmount(0);
  };

  const methodLabel = method === "myzaka" ? "MyZaka" : method === "orange" ? "Orange Money" : "Card";

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", fontFamily: "'Syne', sans-serif" }}>Deposit</h1>
      <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 24 }}>
        Add funds to your Ozeb wallet · Balance: <span style={{ color: COLORS.accent, fontWeight: 700 }}>{formatAmount(balance, currency)}</span>
      </p>

      <div style={{ maxWidth: 520 }}>
        {/* Step: method */}
        {step === "method" && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Choose a deposit method</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {METHODS.map(m => (
                <button key={m.id} onClick={() => selectMethod(m.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.accent + "22", color: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>{m.sub}</div>
                  </div>
                  <div style={{ color: COLORS.accent, fontSize: 18 }}>›</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: mobile money details */}
        {step === "mobile" && (
          <div style={S.card}>
            <button onClick={() => setStep("method")} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{methodLabel} details</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 18 }}>Enter the phone number and PIN registered with {methodLabel}.</div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Phone Number</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ ...S.input, width: 70, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSub, fontWeight: 600, padding: "12px 0" }}>+267</div>
                <input style={{ ...S.input, flex: 1, borderColor: mobile.number && !/^7\d{7}$/.test(normalizeBwNumber(mobile.number)) ? COLORS.danger : COLORS.cardBorder }}
                  type="tel" inputMode="numeric" placeholder="7X XXX XXX" value={mobile.number}
                  onChange={e => setMobile(m => ({ ...m, number: formatBwNumber(e.target.value) }))} />
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
                Botswana mobile number — 8 digits, any 7X prefix (71, 72, 73, 74, 75, 76, 77).
              </div>
              {mobile.number && !/^7\d{7}$/.test(normalizeBwNumber(mobile.number)) && (
                <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>Enter a valid Botswana mobile number (e.g. 74 568 942).</div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>PIN</label>
              <input style={S.input} type="password" inputMode="numeric" maxLength={5} placeholder="••••" value={mobile.pin}
                onChange={e => setMobile(m => ({ ...m, pin: e.target.value.replace(/\D/g, "").slice(0, 5) }))} />
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>4–5 digit mobile money PIN.</div>
            </div>
            <button style={{ ...S.btnPrimary, opacity: mobileValid() ? 1 : 0.4 }}
              disabled={!mobileValid()} onClick={() => setStep("amount")}>
              Continue →
            </button>
          </div>
        )}

        {/* Step: card details */}
        {step === "card" && (
          <div style={S.card}>
            <button onClick={() => setStep("method")} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Card details</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 18 }}>Simulated — no real card will be charged.</div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Card Number</label>
              <input style={{ ...S.input, borderColor: card.number && !luhnOk(card.number.replace(/\s/g, "")) ? COLORS.danger : COLORS.cardBorder }}
                inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.number}
                onChange={e => setCard(c => ({ ...c, number: formatCardNumber(e.target.value) }))} />
              {card.number && card.number.replace(/\s/g, "").length >= 13 && !luhnOk(card.number.replace(/\s/g, "")) && (
                <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>That card number doesn't look right.</div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={S.label}>Expiry</label>
                <input style={{ ...S.input, borderColor: card.expiry.length === 5 && !expiryOk(card.expiry) ? COLORS.danger : COLORS.cardBorder }}
                  placeholder="MM/YY" inputMode="numeric" maxLength={5} value={card.expiry}
                  onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))} />
                {card.expiry.length === 5 && !expiryOk(card.expiry) && (
                  <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>Expired or invalid.</div>
                )}
              </div>
              <div>
                <label style={S.label}>CVV</label>
                <input style={S.input} type="password" inputMode="numeric" maxLength={4} placeholder="123" value={card.cvv}
                  onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Cardholder Name</label>
              <input style={S.input} placeholder="As shown on card" value={card.name} maxLength={64}
                onChange={e => setCard(c => ({ ...c, name: e.target.value }))} />
            </div>
            <button style={{ ...S.btnPrimary, opacity: cardValid() ? 1 : 0.4 }}
              disabled={!cardValid()} onClick={() => setStep("amount")}>
              Continue →
            </button>
          </div>
        )}

        {/* Step: amount + confirm */}
        {step === "amount" && (
          <div style={S.card}>
            <button onClick={() => setStep(method === "card" ? "card" : "mobile")} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Enter amount</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 18 }}>Depositing via <span style={{ color: COLORS.text, fontWeight: 700 }}>{methodLabel}</span></div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Amount ({currency})</label>
              <input style={{ ...S.input, fontSize: 22, fontWeight: 700 }} type="number" placeholder="0.00" value={amount}
                onChange={e => setAmount(e.target.value)} autoFocus />
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {[50, 100, 500, 1000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    +{v}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: COLORS.inputBg, borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: COLORS.textMuted }}>Method</span>
                <span style={{ fontWeight: 700 }}>{methodLabel}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: COLORS.textMuted }}>Current balance</span>
                <span style={{ fontWeight: 700 }}>{formatAmount(balance, currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${COLORS.cardBorder}` }}>
                <span style={{ color: COLORS.textMuted }}>New balance</span>
                <span style={{ fontWeight: 700, color: COLORS.success }}>{formatAmount(Number(balance) + (parseFloat(amount) || 0), currency)}</span>
              </div>
            </div>
            <button style={{ ...S.btnPrimary, opacity: (loading || !parseFloat(amount)) ? 0.6 : 1 }}
              disabled={loading || !parseFloat(amount)} onClick={submitDeposit}>
              {loading ? "Processing…" : `Deposit ${amount ? formatAmount(parseFloat(amount), currency) : ""}`}
            </button>
          </div>
        )}

        {/* Step: success */}
        {step === "success" && (
          <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ width: 72, height: 72, borderRadius: 99, background: COLORS.success + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px", color: COLORS.success }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.success, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Deposit Successful</h2>
            <p style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 20 }}>
              {formatAmount(depositedAmount, currency)} added via {methodLabel}.
            </p>
            <div style={{ background: COLORS.inputBg, borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: COLORS.textMuted }}>New balance</span>
                <span style={{ fontWeight: 700, color: COLORS.success }}>{formatAmount(user?.balance || 0, currency)}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button style={S.btnSecondary} onClick={() => setPage("dashboard")}>Back to Dashboard</button>
              <button style={S.btnPrimary} onClick={reset}>Deposit Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WITHDRAW PAGE ────────────────────────────────────────────────────────────
//
// Mirror of DepositPage but money flows OUT: balance is decremented, the
// transactions row is recorded with sender_id = user, receiver_id = null,
// type = "withdrawal".

function WithdrawPage({ user, setUser, showToast, setPage }) {
  // Steps: "method" → ("mobile"|"card") → "amount" → "success"
  const [step, setStep] = useState("method");
  const [method, setMethod] = useState(null); // "myzaka" | "orange" | "card"
  const [mobile, setMobile] = useState({ number: "", pin: "" });
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [withdrawnAmount, setWithdrawnAmount] = useState(0);

  const currency = user?.currency || "BWP";
  const balance = Number(user?.balance) || 0;

  const METHODS = [
    { id: "myzaka", label: "MyZaka",       sub: "Cash out to Mascom mobile money",  icon: "📱" },
    { id: "orange", label: "Orange Money", sub: "Cash out to Orange mobile money",  icon: "🟠" },
    { id: "card",   label: "Card / Bank",  sub: "Payout to Visa / Mastercard",      icon: "💳" },
  ];

  const selectMethod = (id) => {
    setMethod(id);
    setStep(id === "card" ? "card" : "mobile");
  };

  // Reuse the same Botswana mobile validation as deposit.
  const normalizeBwNumber = (raw) => {
    let d = (raw || "").replace(/\D/g, "");
    if (d.startsWith("267")) d = d.slice(3);
    return d;
  };
  const mobileValid = () => {
    const digits = normalizeBwNumber(mobile.number);
    return /^7\d{7}$/.test(digits) && /^\d{4,5}$/.test(mobile.pin);
  };

  const luhnOk = (num) => {
    if (!/^\d+$/.test(num)) return false;
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = parseInt(num[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  };

  const expiryOk = (exp) => {
    const m = /^(\d{2})\/(\d{2})$/.exec(exp);
    if (!m) return false;
    const month = parseInt(m[1], 10);
    const year = 2000 + parseInt(m[2], 10);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    const endOfExpiry = new Date(year, month, 0, 23, 59, 59);
    if (endOfExpiry < now) return false;
    if (year > now.getFullYear() + 20) return false;
    return true;
  };

  const cardValid = () => {
    const num = card.number.replace(/\s/g, "");
    return /^\d{13,19}$/.test(num) && luhnOk(num) && expiryOk(card.expiry) && /^\d{3,4}$/.test(card.cvv) && card.name.trim().length >= 2;
  };

  const formatCardNumber = (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  const formatBwNumber = (v) => {
    let d = (v || "").replace(/\D/g, "");
    if (d.startsWith("267")) d = d.slice(3);
    d = d.slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  };

  const parsedAmount = parseFloat(amount) || 0;
  const insufficient = parsedAmount > balance;

  const submitWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast("error", "Invalid amount", "Enter an amount greater than zero."); return; }
    if (amt > balance) { showToast("error", "Insufficient balance", "You don't have enough in your wallet."); return; }

    setLoading(true);
    try {
      // Simulate processing latency — mobile money/card payout
      await new Promise(r => setTimeout(r, 1500));

      const newBalance = Number(balance) - amt;

      const { error: walletErr } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", user.id);
      if (walletErr) throw new Error(walletErr.message);

      const methodLabel = method === "myzaka" ? "MyZaka" : method === "orange" ? "Orange Money" : "Card";
      // Schema requires NOT NULL sender_id/receiver_id, so we encode withdrawals
      // as a self→self row tagged with the [WITHDRAW] marker in the note.
      const { error: txErr } = await supabase.from("transactions").insert({
        sender_id: user.id,
        receiver_id: user.id,
        sent_amount: amt,
        received_amount: amt,
        sent_currency: currency,
        received_currency: currency,
        status: "completed",
        note: `[WITHDRAW] via ${methodLabel}`,
      });
      if (txErr) console.warn("Withdrawal transaction insert failed:", txErr.message);
      const { error: nErr } = await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Withdrawal successful",
        message: `${formatAmount(amt, currency)} sent to ${methodLabel}.`,
        is_read: false,
        type: "transfer",
      });
      if (nErr) console.warn("Withdrawal notification insert failed:", nErr.message);

      setUser(prev => ({ ...prev, balance: newBalance }));
      setWithdrawnAmount(amt);
      setStep("success");
      showToast("success", "Withdrawal successful", `${formatAmount(amt, currency)} sent to ${methodLabel}.`);
    } catch (err) {
      showToast("error", "Withdrawal failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("method"); setMethod(null);
    setMobile({ number: "", pin: "" });
    setCard({ number: "", expiry: "", cvv: "", name: "" });
    setAmount(""); setWithdrawnAmount(0);
  };

  const methodLabel = method === "myzaka" ? "MyZaka" : method === "orange" ? "Orange Money" : "Card";

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", fontFamily: "'Syne', sans-serif" }}>Withdraw</h1>
      <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 24 }}>
        Move money out of your Ozeb wallet · Balance: <span style={{ color: COLORS.accent, fontWeight: 700 }}>{formatAmount(balance, currency)}</span>
      </p>

      <div style={{ maxWidth: 520 }}>
        {/* Step: method */}
        {step === "method" && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Choose a withdrawal method</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {METHODS.map(m => (
                <button key={m.id} onClick={() => selectMethod(m.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.accent + "22", color: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSub, marginTop: 2 }}>{m.sub}</div>
                  </div>
                  <div style={{ color: COLORS.accent, fontSize: 18 }}>›</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: mobile money details */}
        {step === "mobile" && (
          <div style={S.card}>
            <button onClick={() => setStep("method")} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{methodLabel} details</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 18 }}>Enter the phone number and PIN of the {methodLabel} account that should receive the cash-out.</div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Phone Number</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ ...S.input, width: 70, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSub, fontWeight: 600, padding: "12px 0" }}>+267</div>
                <input style={{ ...S.input, flex: 1, borderColor: mobile.number && !/^7\d{7}$/.test(normalizeBwNumber(mobile.number)) ? COLORS.danger : COLORS.cardBorder }}
                  type="tel" inputMode="numeric" placeholder="7X XXX XXX" value={mobile.number}
                  onChange={e => setMobile(m => ({ ...m, number: formatBwNumber(e.target.value) }))} />
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
                Botswana mobile number — 8 digits, any 7X prefix (71, 72, 73, 74, 75, 76, 77).
              </div>
              {mobile.number && !/^7\d{7}$/.test(normalizeBwNumber(mobile.number)) && (
                <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>Enter a valid Botswana mobile number (e.g. 74 568 942).</div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>PIN</label>
              <input style={S.input} type="password" inputMode="numeric" maxLength={5} placeholder="••••" value={mobile.pin}
                onChange={e => setMobile(m => ({ ...m, pin: e.target.value.replace(/\D/g, "").slice(0, 5) }))} />
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>4–5 digit mobile money PIN.</div>
            </div>
            <button style={{ ...S.btnPrimary, opacity: mobileValid() ? 1 : 0.4 }}
              disabled={!mobileValid()} onClick={() => setStep("amount")}>
              Continue →
            </button>
          </div>
        )}

        {/* Step: card details */}
        {step === "card" && (
          <div style={S.card}>
            <button onClick={() => setStep("method")} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Card / Bank details</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 18 }}>Simulated — no real card will be credited.</div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Card Number</label>
              <input style={{ ...S.input, borderColor: card.number && !luhnOk(card.number.replace(/\s/g, "")) ? COLORS.danger : COLORS.cardBorder }}
                inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.number}
                onChange={e => setCard(c => ({ ...c, number: formatCardNumber(e.target.value) }))} />
              {card.number && card.number.replace(/\s/g, "").length >= 13 && !luhnOk(card.number.replace(/\s/g, "")) && (
                <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>That card number doesn't look right.</div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={S.label}>Expiry</label>
                <input style={{ ...S.input, borderColor: card.expiry.length === 5 && !expiryOk(card.expiry) ? COLORS.danger : COLORS.cardBorder }}
                  placeholder="MM/YY" inputMode="numeric" maxLength={5} value={card.expiry}
                  onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))} />
                {card.expiry.length === 5 && !expiryOk(card.expiry) && (
                  <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 4 }}>Expired or invalid.</div>
                )}
              </div>
              <div>
                <label style={S.label}>CVV</label>
                <input style={S.input} type="password" inputMode="numeric" maxLength={4} placeholder="123" value={card.cvv}
                  onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Cardholder Name</label>
              <input style={S.input} placeholder="As shown on card" value={card.name} maxLength={64}
                onChange={e => setCard(c => ({ ...c, name: e.target.value }))} />
            </div>
            <button style={{ ...S.btnPrimary, opacity: cardValid() ? 1 : 0.4 }}
              disabled={!cardValid()} onClick={() => setStep("amount")}>
              Continue →
            </button>
          </div>
        )}

        {/* Step: amount + confirm */}
        {step === "amount" && (
          <div style={S.card}>
            <button onClick={() => setStep(method === "card" ? "card" : "mobile")} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Back</button>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Enter amount</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 18 }}>Withdrawing via <span style={{ color: COLORS.text, fontWeight: 700 }}>{methodLabel}</span></div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Amount ({currency})</label>
              <input style={{ ...S.input, fontSize: 22, fontWeight: 700, borderColor: insufficient ? COLORS.danger : COLORS.cardBorder }}
                type="number" placeholder="0.00" value={amount}
                onChange={e => setAmount(e.target.value)} autoFocus />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: COLORS.textMuted }}>
                <span>Available: {formatAmount(balance, currency)}</span>
                {insufficient && <span style={{ color: COLORS.danger }}>Insufficient balance</span>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {[50, 100, 500, 1000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))}
                    style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {v}
                  </button>
                ))}
                <button onClick={() => setAmount(String(balance))}
                  style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Max
                </button>
              </div>
            </div>
            <div style={{ background: COLORS.inputBg, borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: COLORS.textMuted }}>Method</span>
                <span style={{ fontWeight: 700 }}>{methodLabel}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: COLORS.textMuted }}>Current balance</span>
                <span style={{ fontWeight: 700 }}>{formatAmount(balance, currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${COLORS.cardBorder}` }}>
                <span style={{ color: COLORS.textMuted }}>New balance</span>
                <span style={{ fontWeight: 700, color: insufficient ? COLORS.danger : COLORS.success }}>{formatAmount(Math.max(0, Number(balance) - parsedAmount), currency)}</span>
              </div>
            </div>
            <button style={{ ...S.btnPrimary, opacity: (loading || parsedAmount <= 0 || insufficient) ? 0.6 : 1 }}
              disabled={loading || parsedAmount <= 0 || insufficient} onClick={submitWithdraw}>
              {loading ? "Processing…" : `Withdraw ${amount ? formatAmount(parsedAmount, currency) : ""}`}
            </button>
          </div>
        )}

        {/* Step: success */}
        {step === "success" && (
          <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ width: 72, height: 72, borderRadius: 99, background: COLORS.success + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px", color: COLORS.success }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: COLORS.success, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Withdrawal Successful</h2>
            <p style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 20 }}>
              {formatAmount(withdrawnAmount, currency)} sent to {methodLabel}.
            </p>
            <div style={{ background: COLORS.inputBg, borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: COLORS.textMuted }}>New balance</span>
                <span style={{ fontWeight: 700, color: COLORS.success }}>{formatAmount(user?.balance || 0, currency)}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button style={S.btnSecondary} onClick={() => setPage("dashboard")}>Back to Dashboard</button>
              <button style={S.btnPrimary} onClick={reset}>Withdraw Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────

function SettingsPage({ user, setUser, showToast, setPage, RATES }) {
  const [profile, setProfile] = useState({ name: user?.name || "", email: user?.email || "", username: user?.username || "" });
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [newCurrency, setNewCurrency] = useState(user?.currency || "BWP");
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const currencies = ["BWP", "USD", "ZAR", "BTC", "ETH"];
  const currencyFlags = { BWP: "🇧🇼", USD: "🇺🇸", ZAR: "🇿🇦", BTC: "₿", ETH: "Ξ" };

  // Esc closes whichever modal is open.
  useEffect(() => {
    if (!showCurrencyModal && !showDeleteModal) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (showCurrencyModal) setShowCurrencyModal(false);
      if (showDeleteModal) setShowDeleteModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCurrencyModal, showDeleteModal]);

  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 7) errors.push("at least 7 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("a capital letter");
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) errors.push("a special character");
    return errors;
  };

  const handleProfileSave = async () => {
    if (!profile.name.trim()) { showToast("error", "Missing Field", "Full name cannot be empty."); return; }
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: profile.name, username: profile.username }).eq("id", user.id);
    if (error) { showToast("error", "Save Failed", error.message); }
    else { setUser(prev => ({ ...prev, name: profile.name, username: profile.username })); showToast("success", "Profile Updated", "Your profile has been saved."); }
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) { showToast("error", "Missing Fields", "Fill in all password fields."); return; }
    if (newPwd !== confirmPwd) { showToast("error", "Mismatch", "New passwords do not match."); return; }
    const pwdErrors = validatePassword(newPwd);
    if (pwdErrors.length > 0) { showToast("error", "Weak Password", "Password needs: " + pwdErrors.join(", ")); return; }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd });
    if (signInError) { showToast("error", "Wrong Password", "Current password is incorrect."); setLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) { showToast("error", "Update Failed", error.message); }
    else { showToast("success", "Password Updated", "Your password has been changed."); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }
    setLoading(false);
  };

  const handleCurrencyChange = async () => {
    if (!newCurrency || newCurrency === user.currency) { showToast("error", "Same Currency", "Please select a different currency."); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("change_wallet_currency", { p_user_id: user.id, p_new_currency: newCurrency });
    if (error || !data?.success) { showToast("error", "Change Failed", error?.message || data?.error || "Could not change currency."); setLoading(false); return; }
    const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single();
    setUser(prev => ({ ...prev, currency: newCurrency, balance: wallet?.balance || 0 }));
    showToast("success", "Currency Changed", `Wallet switched to ${newCurrency}`);
    setShowCurrencyModal(false);
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { showToast("error", "Type DELETE", "You must type DELETE to confirm."); return; }
    setLoading(true);
    // Prefer a server RPC (`delete_account`) that runs SECURITY DEFINER and removes
    // the auth.users row + its dependent rows atomically. Fall back to client-side
    // cleanup if the RPC isn't deployed yet, but log a warning so this gets fixed.
    const { error: rpcErr } = await supabase.rpc("delete_account", { p_user_id: user.id });
    if (rpcErr) {
      console.warn("delete_account RPC missing or failed, falling back to client cleanup:", rpcErr.message);
      await supabase.from("wallets").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);
    }
    await supabase.auth.signOut();
    setUser(null); setPage("home"); setLoading(false);
    showToast("success", "Account deleted", "Your account has been removed.");
  };

  const currentBalance = user?.balance || 0;
  const currentRate = RATES[user?.currency] || 1;
  const newRate = RATES[newCurrency] || 1;
  const convertedPreview = ((currentBalance / currentRate) * newRate).toFixed(6);

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.inputBg, color: COLORS.text, fontSize: 14, boxSizing: "border-box" };

  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 24px", fontFamily: "'Syne', sans-serif" }}>Account Settings</h1>

      {/* Profile */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>Profile Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[{ label: "Full Name", key: "name" }, { label: "Username", key: "username" }].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</div>
              <input value={profile[f.key]} onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Address</div>
          <input value={profile.email} disabled style={{ ...inputStyle, background: COLORS.cardBorder, color: COLORS.textMuted, cursor: "not-allowed" }} />
        </div>
        <button onClick={handleProfileSave} disabled={loading} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: COLORS.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Save Changes
        </button>
      </div>

      {/* Security */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>Security</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
          {[{ label: "Current Password", val: currentPwd, set: setCurrentPwd }, { label: "New Password", val: newPwd, set: setNewPwd }, { label: "Confirm Password", val: confirmPwd, set: setConfirmPwd }].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</div>
              <input type="password" value={f.val} onChange={e => f.set(e.target.value)} style={inputStyle} />
            </div>
          ))}
        </div>
        {newPwd && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {[{ label: "7+ characters", pass: newPwd.length >= 7 }, { label: "Capital letter", pass: /[A-Z]/.test(newPwd) }, { label: "Special character", pass: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPwd) }].map(r => (
              <span key={r.label} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: r.pass ? COLORS.success + "18" : COLORS.danger + "18", color: r.pass ? COLORS.success : COLORS.danger, border: `1px solid ${r.pass ? COLORS.success : COLORS.danger}` }}>
                {r.pass ? "✓" : "✗"} {r.label}
              </span>
            ))}
          </div>
        )}
        <button onClick={handlePasswordChange} disabled={loading} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: COLORS.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Update Password
        </button>
      </div>

      {/* Wallet Currency */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Wallet Currency</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
          Current: <span style={{ color: COLORS.text, fontWeight: 700 }}>{user?.currency}</span> · Balance: <span style={{ color: COLORS.accent, fontWeight: 700 }}>{formatAmount(user?.balance || 0, user?.currency)}</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {currencies.map(c => (
            <button key={c} onClick={() => setNewCurrency(c)} style={{
              padding: "12px 16px", borderRadius: 12,
              border: `2px solid ${newCurrency === c ? COLORS.accent : COLORS.cardBorder}`,
              background: newCurrency === c
                ? `linear-gradient(135deg, ${COLORS.accent}2e, ${COLORS.accent}10)`
                : COLORS.inputBg,
              boxShadow: newCurrency === c ? `0 4px 16px -6px ${COLORS.accentGlow}` : "none",
              cursor: "pointer", textAlign: "center", minWidth: 64, transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 18 }}>{currencyFlags[c]}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: newCurrency === c ? COLORS.accent : COLORS.textSub, marginTop: 4 }}>{c}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setShowCurrencyModal(true)} disabled={newCurrency === user?.currency}
          style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: newCurrency === user?.currency
              ? COLORS.inputBg
              : `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentDim} 100%)`,
            color: newCurrency === user?.currency ? COLORS.textMuted : "#0b0b0e",
            fontWeight: 700, fontSize: 14,
            cursor: newCurrency === user?.currency ? "not-allowed" : "pointer",
            boxShadow: newCurrency === user?.currency ? "none" : `0 4px 16px -4px ${COLORS.accentGlow}`,
            transition: "all 0.15s",
          }}>
          Switch to {newCurrency}
        </button>
      </div>

      {/* Danger Zone */}
      <div style={{ ...S.card, border: `1px solid ${COLORS.danger}30` }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.danger, marginBottom: 8 }}>⚠ Danger Zone</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>Deleting your account is permanent and cannot be undone.</div>
        <button onClick={() => setShowDeleteModal(true)} style={{ padding: "10px 24px", borderRadius: 10, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Delete Account
        </button>
      </div>

      {/* Currency Modal */}
      {showCurrencyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowCurrencyModal(false)}>
          <div style={{ ...S.card, width: 420, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, textAlign: "center", marginBottom: 12 }}>💱</div>
            <div style={{ fontWeight: 800, fontSize: 18, textAlign: "center", marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>Switch Currency</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginBottom: 20 }}>Your balance will be converted at the current live rate</div>
            <div style={{ background: COLORS.inputBg, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
              {[["From", `${formatAmount(currentBalance, user?.currency)} ${user?.currency}`], ["To", `${parseFloat(convertedPreview)} ${newCurrency}`], ["Rate (live)", `1 ${user?.currency} = ${(newRate / currentRate).toFixed(6)} ${newCurrency}`]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: COLORS.textMuted }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: COLORS.warning + "15", border: `1px solid ${COLORS.warning}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: COLORS.warning }}>
              ⚠ This action cannot be undone. Your balance will be converted immediately.
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowCurrencyModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.text, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCurrencyChange} disabled={loading} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: COLORS.accent, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {loading ? "Switching..." : `Confirm → ${newCurrency}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowDeleteModal(false)}>
          <div style={{ ...S.card, width: 400, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 18, textAlign: "center", marginBottom: 8, color: COLORS.danger, fontFamily: "'Syne', sans-serif" }}>Delete Account</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginBottom: 20 }}>This will permanently delete your profile, wallet, and all transaction history. Type <strong style={{ color: COLORS.text }}>DELETE</strong> to confirm.</div>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE here"
              style={{ ...inputStyle, border: `1px solid ${COLORS.danger}`, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.text, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteAccount} disabled={loading || deleteConfirm !== "DELETE"}
                style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: deleteConfirm === "DELETE" ? COLORS.danger : COLORS.cardBorder, color: deleteConfirm === "DELETE" ? "#fff" : COLORS.textMuted, fontWeight: 700, fontSize: 14, cursor: deleteConfirm === "DELETE" ? "pointer" : "not-allowed" }}>
                {loading ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUPPORT PAGE ─────────────────────────────────────────────────────────────

function SupportPage() {
  const [open, setOpen] = useState(null);
  const faqs = [
    { q: "How do I send money?", a: "Go to Send Money from the dashboard, enter the recipient's username, amount, and an optional note. Review the transfer and confirm." },
    { q: "What currencies does Ozeb support?", a: "Ozeb supports BWP, USD, ZAR, BTC, and ETH. You select your primary wallet currency at registration." },
    { q: "How are exchange rates calculated?", a: "We use live exchange rates from ExchangeRate-API (fiat) and CoinGecko (crypto). Rates update every hour automatically." },
    { q: "How do I change my wallet currency?", a: "Go to Settings → Wallet Currency section. Select a new currency and confirm. Your balance will be converted at the current live rate." },
    { q: "Is my money secure?", a: "Yes. We use Supabase's enterprise-grade authentication and encryption. Passwords are never stored in plain text." },
    { q: "How do I contact support?", a: "Email us at support@ozeb.com or use the form below. We typically respond within 24 hours." },
  ];
  return (
    <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", fontFamily: "'Syne', sans-serif" }}>Support</h1>
      <p style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 28 }}>How can we help you today?</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
        {[{ icon: "📧", title: "Email Support", sub: "support@ozeb.com" }, { icon: "💬", title: "Live Chat", sub: "Mon–Fri, 9am–5pm" }, { icon: "📖", title: "Documentation", sub: "Read our guides" }].map(c => (
          <div key={c.title} style={{ ...S.card, textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", fontFamily: "'Syne', sans-serif" }}>Frequently Asked Questions</h3>
        {faqs.map((faq, i) => (
          <div key={i} style={{ borderBottom: i < faqs.length - 1 ? `1px solid ${COLORS.cardBorder}` : "none" }}>
            <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", background: "none", border: "none", color: COLORS.text, textAlign: "left", padding: "14px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 600 }}>
              {faq.q}<span style={{ color: COLORS.textMuted, fontSize: 18, transition: "transform 0.2s", transform: open === i ? "rotate(180deg)" : "none" }}>⌄</span>
            </button>
            {open === i && <div style={{ fontSize: 13, color: COLORS.textMuted, paddingBottom: 14, lineHeight: 1.6 }}>{faq.a}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPageRaw] = useState(() => {
    try { return localStorage.getItem("ozeb-page") || "home"; } catch { return "home"; }
  });
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [toast, setToast] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [RATES, setRATES] = useState({ USD: 1, BWP: 13.81, ZAR: 16.03, BTC: 0.0000146105, ETH: 0.00051151 });
  const [theme, setThemeState] = useState(() => {
    let t = "dark";
    try { t = localStorage.getItem("ozeb-theme") || "dark"; } catch { /* localStorage unavailable */ }
    applyTheme(t);
    return t;
  });

  const setPage = (p) => {
    setPageRaw(p);
    // Only remember auth-gated pages across reloads. Pre-login pages (home,
    // login, register) should never be "sticky" — a fresh visit always lands
    // on the homepage.
    const stickyPages = new Set(["dashboard", "wallet", "send", "deposit", "withdraw", "history", "notifications", "settings", "support"]);
    try {
      if (stickyPages.has(p)) localStorage.setItem("ozeb-page", p);
      else localStorage.removeItem("ozeb-page");
    } catch { /* localStorage unavailable */ }
  };

  const toggleTheme = () => {
    setThemeState(prev => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("ozeb-theme", next); } catch { /* localStorage unavailable */ }
      return next;
    });
  };

  const showToast = (type, title, message) => setToast({ type, title, message });
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setPage("home"); setUnreadCount(0);
  };

  // ── Rehydrate session on reload ──
  // If Supabase has a live session, skip the login page and restore the user
  // from profiles + wallets, landing them on whatever page they were on.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // No session → always land on the homepage. The user can pick Sign In
        // or Sign Up from there.
        if (!cancelled) { setPageRaw("home"); setAuthChecked(true); }
        return;
      }
      const [{ data: profile }, { data: wallet }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("wallets").select("*").eq("user_id", session.user.id).single(),
      ]);
      if (cancelled) return;
      setUser({
        id: session.user.id,
        name: profile?.full_name || "User",
        email: session.user.email,
        currency: wallet?.currency || "BWP",
        balance: wallet?.balance || 0,
        username: profile?.username || "",
      });
      // Logged in: keep the stored auth-gated page if any, else dashboard.
      const authPages = new Set(["dashboard", "wallet", "send", "deposit", "withdraw", "history", "notifications", "settings", "support"]);
      setPageRaw(prev => authPages.has(prev) ? prev : "dashboard");
      setAuthChecked(true);
    };
    hydrate();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) setUser(null);
    });
    return () => { cancelled = true; sub?.subscription?.unsubscribe(); };
  }, []);

  // Fetch live rates on mount for homepage display (no auth required)
  useEffect(() => {
    fetchLiveRates().then(rates => { if (rates) setRATES(rates); });
  }, []);

  // Live exchange rates — fetch on login, refresh every hour
  useEffect(() => {
    if (!user?.id) return;
    const refresh = async () => {
      const rates = await fetchLiveRates();
      setRATES(rates);
      await updateSupabaseRates(supabase, rates);
    };
    refresh();
    const interval = setInterval(refresh, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Global realtime notifications
  useEffect(() => {
    if (!user?.id) return;
    const loadUnread = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      setUnreadCount(count || 0);
    };
    loadUnread();
    const channel = supabase.channel("global-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        setUnreadCount(prev => prev + 1);
        const successTypes = new Set(["transfer", "deposit", "withdrawal"]);
        showToast(successTypes.has(payload.new.type) ? "success" : "info", payload.new.title, payload.new.message);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const appStyle = `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } html, body, #root { height: 100%; width: 100%; background: ${COLORS.bg}; } input::placeholder { color: ${COLORS.textMuted}; } input, button { font-family: inherit; } input:focus { border-color: ${COLORS.accent} !important; box-shadow: 0 0 0 3px ${COLORS.accentGlow} !important; }`;

  if (!authChecked) return (
    <div key={theme} style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{appStyle}</style>
      <div style={{ fontSize: 13 }}>Loading…</div>
    </div>
  );

  const authPages = new Set(["dashboard", "wallet", "send", "deposit", "withdraw", "history", "notifications", "settings", "support"]);
  const currentPage = authPages.has(page) && !user ? "login" : page;

  if (currentPage === "home") return (
    <div key={theme}>
      <style>{appStyle}</style>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      <HomepagePage setPage={setPage} RATES={RATES} theme={theme} toggleTheme={toggleTheme} />
    </div>
  );

  return (
    <div key={theme} style={{ display: "flex", height: "100vh", background: COLORS.bgGradient || COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>
      <style>{appStyle}</style>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      {user && <Sidebar page={currentPage} setPage={setPage} unread={unreadCount} user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {currentPage === "login"         && <LoginPage setUser={setUser} setPage={setPage} theme={theme} toggleTheme={toggleTheme} showToast={showToast} />}
        {currentPage === "register"      && <RegisterPage setUser={setUser} setPage={setPage} theme={theme} toggleTheme={toggleTheme} showToast={showToast} />}
        {currentPage === "dashboard"     && <DashboardPage user={user} setPage={setPage} setUser={setUser} RATES={RATES} />}
        {currentPage === "wallet"        && <WalletPage user={user} setUser={setUser} RATES={RATES} />}
        {currentPage === "send"          && <SendPage user={user} setUser={setUser} showToast={showToast} setPage={setPage} RATES={RATES} />}
        {currentPage === "deposit"       && <DepositPage user={user} setUser={setUser} showToast={showToast} setPage={setPage} />}
        {currentPage === "withdraw"      && <WithdrawPage user={user} setUser={setUser} showToast={showToast} setPage={setPage} />}
        {currentPage === "history"       && <HistoryPage user={user} />}
        {currentPage === "notifications" && <NotificationsPage user={user} />}
        {currentPage === "settings"      && <SettingsPage user={user} setUser={setUser} showToast={showToast} setPage={setPage} RATES={RATES} theme={theme} toggleTheme={toggleTheme} />}
        {currentPage === "support"       && <SupportPage />}
      </div>
    </div>
  );
}
