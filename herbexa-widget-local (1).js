// herbexa-widget-local.js
// Herbexa v3 (Sept 2026): glowing green brain orb, bottom-right.
// - Signed-in users only (no session = no orb).
// - Every question goes through /.netlify/functions/herbexa, which enforces
//   the rules in the database: Premium 25/day then bought extra questions;
//   Free 20 seeds per question. Nothing here can grant free questions.
// - Falls back to the local knowledge base (herbexa-knowledge-base.js) only
//   when the service itself is down, never when a user is out of balance.

const HERBEXA_SB_URL = "https://fspofcdsraldxnnqqyfn.supabase.co";
const HERBEXA_SB_KEY = "sb_publishable_iGOFOZLHE4h5jBjl9i3BuQ_Cu7nYDVg"; // public key
const HERBEXA_LOW_SEEDS = 60; // "running low" = fewer than 3 questions left

const HERBEXA_BRAIN_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 5.2a3 3 0 0 0-5.6-1A3 3 0 0 0 4 8.1a3.2 3.2 0 0 0-.9 4.8A3.2 3.2 0 0 0 5 17.8a3 3 0 0 0 4.2 2.4A2.8 2.8 0 0 0 12 19z"/>' +
  '<path d="M12 5.2a3 3 0 0 1 5.6-1A3 3 0 0 1 20 8.1a3.2 3.2 0 0 1 .9 4.8 3.2 3.2 0 0 1-1.9 4.9 3 3 0 0 1-4.2 2.4A2.8 2.8 0 0 1 12 19z"/>' +
  '<path d="M12 5.2V19"/><path d="M8.3 9.3a2.2 2.2 0 0 1 2.1 1.4"/><path d="M15.7 9.3a2.2 2.2 0 0 0-2.1 1.4"/>' +
  '<path d="M7.6 14.2a2.4 2.4 0 0 0 2.6.6"/><path d="M16.4 14.2a2.4 2.4 0 0 1-2.6.6"/></svg>';

class HerbexaWidget {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.lessTehnical = false;
    this.busy = false;
    this.status = null;
    this.greeted = false;
    this.apiEndpoint = "/.netlify/functions/herbexa";
    this.checkoutEndpoint = "/.netlify/functions/checkout";
    this._client = null;
    this.init();
  }

  async init() {
    const token = await this.getToken();
    if (!token) return; // logged out: no orb at all
    this.createWidget();
    this.attachEventListeners();
    this.loadUserPreferences();
    this.watchBottomBars();
    this.maybeShowHint();
  }

  // ── Session ─────────────────────────────────────────────────────────
  // Pages that already have a Supabase client (const sb) share it; the
  // rest get one here, which reads/refreshes the same stored session.
  async supabaseClient() {
    try { if (typeof sb !== "undefined" && sb && sb.auth) return sb; } catch (e) {}
    if (this._client) return this._client;
    if (!(window.supabase && window.supabase.createClient)) {
      await new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        s.onload = resolve; s.onerror = resolve;
        document.head.appendChild(s);
      });
    }
    if (!(window.supabase && window.supabase.createClient)) return null;
    this._client = window.supabase.createClient(HERBEXA_SB_URL, HERBEXA_SB_KEY);
    return this._client;
  }

  async getToken() {
    try {
      const client = await this.supabaseClient();
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data && data.session ? data.session.access_token : null;
    } catch (e) {
      return null;
    }
  }

  async post(url, payload) {
    const token = await this.getToken();
    if (!token) return { status: 401, data: { reason: "not_signed_in" } };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, data };
  }

  // ── UI ───────────────────────────────────────────────────────────────
  createWidget() {
    const container = document.createElement("div");
    container.id = "herbexa-widget";
    container.innerHTML = `
      <style>
        #herbexa-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .herbexa-orb {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 45;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          border: 1px solid rgba(190, 255, 170, .55);
          background: radial-gradient(circle at 35% 30%, #7fe07a 0%, #3f9b3a 45%, #1e5a22 100%);
          color: #eaffdf;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 0 14px 3px rgba(111, 227, 111, .45), 0 6px 18px rgba(0,0,0,.35);
          animation: herbexa-glow 2.8s ease-in-out infinite;
          transition: transform .2s ease, bottom .2s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .herbexa-orb:hover { transform: scale(1.06); }
        .herbexa-orb:focus-visible { outline: 2px solid #e8b84b; outline-offset: 3px; }
        .herbexa-orb.active { visibility: hidden; }

        @keyframes herbexa-glow {
          0%, 100% { box-shadow: 0 0 12px 2px rgba(111, 227, 111, .40), 0 6px 18px rgba(0,0,0,.35); }
          50%      { box-shadow: 0 0 24px 7px rgba(111, 227, 111, .65), 0 6px 18px rgba(0,0,0,.35); }
        }

        .herbexa-hint {
          position: absolute;
          right: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          white-space: nowrap;
          background: #1a3a2a;
          color: #eaffdf;
          border: 1px solid rgba(111, 227, 111, .45);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 13px;
          font-weight: 500;
          pointer-events: none;
          opacity: 0;
          transition: opacity .2s ease;
        }
        .herbexa-orb:hover .herbexa-hint,
        .herbexa-orb:focus-visible .herbexa-hint,
        .herbexa-orb.show-hint .herbexa-hint { opacity: 1; }

        .herbexa-chat {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 1500;
          width: 380px;
          height: min(600px, calc(100vh - 100px));
          background: white;
          border-radius: 12px;
          box-shadow: 0 5px 40px rgba(0,0,0,0.22);
          display: flex;
          flex-direction: column;
          opacity: 0;
          pointer-events: none;
          transform: translateY(16px) scale(.98);
          transform-origin: bottom right;
          transition: transform .25s ease, opacity .25s ease;
        }
        .herbexa-chat.open {
          opacity: 1;
          pointer-events: auto;
          transform: none;
        }

        .herbexa-header {
          background: linear-gradient(135deg, #2d5016 0%, #4a7c2f 100%);
          color: white;
          padding: 16px;
          border-radius: 12px 12px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .herbexa-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .herbexa-close {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .herbexa-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .herbexa-message {
          display: flex;
          flex-direction: column;
          gap: 4px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .herbexa-message.user {
          align-items: flex-end;
        }

        .herbexa-message.bot {
          align-items: flex-start;
        }

        .herbexa-text {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.6;
          max-width: 85%;
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        .herbexa-text.user {
          background: #2d5016;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .herbexa-text.bot {
          background: #f0f0f0;
          color: #333;
          border-bottom-left-radius: 4px;
        }

        .herbexa-text a {
          color: #2d5016;
          text-decoration: underline;
          font-weight: 600;
          cursor: pointer;
        }

        .herbexa-text.bot a {
          color: #2d5016;
        }

        .herbexa-loading {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 12px 16px;
        }

        .herbexa-dot {
          width: 8px;
          height: 8px;
          background: #999;
          border-radius: 50%;
          animation: bounce 1.4s infinite;
        }

        .herbexa-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .herbexa-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes bounce {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }

        .herbexa-footer {
          padding: 12px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 8px;
          flex-direction: column;
        }

        .herbexa-input-row {
          display: flex;
          gap: 8px;
        }

        .herbexa-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          max-height: 80px;
        }

        .herbexa-input:focus {
          outline: none;
          border-color: #2d5016;
        }

        .herbexa-send {
          width: 40px;
          height: 40px;
          background: #2d5016;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .herbexa-send:hover {
          background: #1f3c0f;
        }

        .herbexa-send:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .herbexa-options {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 12px;
          padding: 0 4px;
        }

        .herbexa-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          user-select: none;
        }

        .herbexa-toggle input {
          cursor: pointer;
        }

        .herbexa-status {
          font-size: 12px;
          color: #999;
          padding: 4px;
          text-align: center;
        }
        .herbexa-offer {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .herbexa-offer a, .herbexa-offer button {
          font: inherit;
          font-size: 13px;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid #4a7c2f;
          background: #f1f8ec;
          color: #2d5016;
          text-decoration: none;
          cursor: pointer;
        }
        .herbexa-offer a:hover, .herbexa-offer button:hover { background: #e2f1d8; }

        @media (max-width: 480px) {
          .herbexa-orb { right: 14px; bottom: 14px; width: 54px; height: 54px; }
          .herbexa-chat {
            right: 6px;
            width: calc(100vw - 12px);
            height: 75vh;
            max-height: 560px;
            bottom: 8px;
          }
          .herbexa-text { max-width: 95%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .herbexa-orb { animation: none; transition: none; }
          .herbexa-chat { transition: none; }
        }
      </style>

      <button type="button" class="herbexa-orb" id="herbexa-btn" aria-label="Ask Herbexa anything" aria-controls="herbexa-chat" aria-expanded="false">
        ${HERBEXA_BRAIN_SVG}
        <span class="herbexa-hint">Ask me anything</span>
      </button>

      <div class="herbexa-chat" id="herbexa-chat" role="dialog" aria-label="Herbexa">
        <div class="herbexa-header">
          <h2 class="herbexa-title">Herbexa</h2>
          <button class="herbexa-close" id="herbexa-close" aria-label="Close">&times;</button>
        </div>

        <div class="herbexa-body" id="herbexa-body"></div>

        <div class="herbexa-footer">
          <div class="herbexa-options">
            <label class="herbexa-toggle">
              <input type="checkbox" id="herbexa-less-tech" />
              Simpler language
            </label>
          </div>
          <div class="herbexa-input-row">
            <textarea class="herbexa-input" id="herbexa-input" placeholder="Ask about herbs..." rows="1"></textarea>
            <button class="herbexa-send" id="herbexa-send" aria-label="Send">→</button>
          </div>
          <div class="herbexa-status" id="herbexa-status"></div>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  }

  attachEventListeners() {
    const input = document.getElementById("herbexa-input");
    document.getElementById("herbexa-btn").addEventListener("click", () => this.toggle());
    document.getElementById("herbexa-close").addEventListener("click", () => this.close());
    document.getElementById("herbexa-send").addEventListener("click", () => this.sendMessage());
    document.getElementById("herbexa-less-tech").addEventListener("change", (e) => {
      this.lessTehnical = e.target.checked;
      try { localStorage.setItem("herbexa_less_tech", this.lessTehnical); } catch (x) {}
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    input.addEventListener("input", (e) => {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
    });
    document.getElementById("herbexa-body").addEventListener("click", (e) => {
      const b = e.target.closest("[data-herbexa-buy]");
      if (b) this.buy(b.getAttribute("data-herbexa-buy"));
    });
  }

  // Phones have no hover: show "Ask me anything" once, on first view.
  maybeShowHint() {
    let seen = false;
    try { seen = localStorage.getItem("herbexa_hint_seen") === "1"; } catch (e) {}
    if (seen) return;
    const btn = document.getElementById("herbexa-btn");
    setTimeout(() => btn.classList.add("show-hint"), 800);
    setTimeout(() => btn.classList.remove("show-hint"), 4800);
    try { localStorage.setItem("herbexa_hint_seen", "1"); } catch (e) {}
  }

  // Keep the orb above fixed bottom bars (e.g. Herb Planner's footer).
  watchBottomBars() {
    const btn = document.getElementById("herbexa-btn");
    const base = () => (window.innerWidth <= 480 ? 14 : 20);
    let queued = false;
    const update = () => {
      queued = false;
      let lift = 0;
      document.querySelectorAll(".sticky-footer").forEach((el) => {
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom >= window.innerHeight - 2 && getComputedStyle(el).display !== "none") {
          lift = Math.max(lift, r.height);
        }
      });
      const v = (lift ? lift + 12 : base()) + "px";
      if (btn.style.bottom !== v) btn.style.bottom = v;
    };
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    window.addEventListener("resize", schedule);
    if (document.querySelector(".sticky-footer") && window.MutationObserver) {
      const widget = document.getElementById("herbexa-widget");
      new MutationObserver((records) => {
        if (records.some((r) => !widget.contains(r.target))) schedule();
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    }
    schedule();
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  async open() {
    this.isOpen = true;
    document.getElementById("herbexa-chat").classList.add("open");
    const btn = document.getElementById("herbexa-btn");
    btn.classList.add("active");
    btn.setAttribute("aria-expanded", "true");
    if (!this.greeted) {
      this.greeted = true;
      await this.greet();
    }
    document.getElementById("herbexa-input").focus();
  }

  close() {
    this.isOpen = false;
    document.getElementById("herbexa-chat").classList.remove("open");
    const btn = document.getElementById("herbexa-btn");
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
  }

  // First message: the rules for this user, with their current balance.
  async greet() {
    const loadingId = this.showLoading();
    let res;
    try { res = await this.post(this.apiEndpoint, { action: "status" }); }
    catch (e) { res = { status: 0, data: {} }; }
    this.removeLoading(loadingId);

    if (res.status === 401) return this.sessionExpired();
    if (res.status !== 200 || !res.data.status) {
      this.addMessage("bot", "Hi! I'm Herbexa. I can't check your balance right now, but you can still try asking a question.");
      return;
    }
    const st = (this.status = res.data.status);
    if (st.premium) {
      const left = Math.max(st.daily_limit - st.used_today, 0);
      let msg = "Hi! I'm Herbexa, your herbal guide. Ask me about herbs, wellness concerns or preparation methods.\n\n" +
        "You have " + left + " of " + st.daily_limit + " questions left today (resets at midnight).";
      if (st.extra_questions > 0) msg += " Plus " + st.extra_questions + " extra question" + (st.extra_questions === 1 ? "" : "s") + ".";
      this.addMessage("bot", msg);
      if (left === 0 && st.extra_questions <= 0) this.offerPacks();
    } else {
      const n = Math.floor(st.seeds / st.seed_cost);
      this.addMessage("bot",
        "Hi! I'm Herbexa, your herbal guide.\n\n" +
        "Heads up: each question costs " + st.seed_cost + " seeds. You have " + st.seeds + " seeds, " +
        (n > 0 ? "enough for " + n + " question" + (n === 1 ? "" : "s") + "." : "which isn't enough for a question yet.") +
        " Premium members get 25 questions a day without spending seeds.");
      if (st.seeds < st.seed_cost) this.offerSeeds(true);
    }
    this.renderStatus();
  }

  renderStatus(usage) {
    const el = document.getElementById("herbexa-status");
    const st = this.status;
    if (!st) { el.textContent = ""; return; }
    if (usage) {
      if (st.premium) {
        st.used_today = usage.used_today;
        st.extra_questions = usage.extra_questions;
      } else if (typeof usage.seeds === "number") {
        st.seeds = usage.seeds;
      }
    }
    if (st.premium) {
      const left = Math.max(st.daily_limit - st.used_today, 0);
      el.textContent = left > 0
        ? left + " of " + st.daily_limit + " left today" + (st.extra_questions > 0 ? " · " + st.extra_questions + " extra" : "")
        : (st.extra_questions > 0 ? "Using extra questions: " + st.extra_questions + " left" : "Daily questions used");
    } else {
      el.textContent = st.seeds + " seeds · " + st.seed_cost + " per question";
    }
  }

  offerSeeds(empty) {
    this.addOffer(
      empty ? "You're out of seeds for Herbexa." : "You're running low on seeds.",
      '<a href="seeds.html">Get more seeds</a><a href="join.html">Join Herbadex Premium</a>'
    );
  }

  offerPacks() {
    this.addOffer(
      "You've used today's 25 questions. They reset at midnight, or you can buy extra questions (they never expire):",
      '<button type="button" data-herbexa-buy="herbexa_25">25 questions · £2.99</button>' +
      '<button type="button" data-herbexa-buy="herbexa_50">50 questions · £4.99</button>'
    );
  }

  async buy(productId) {
    let res;
    try { res = await this.post(this.checkoutEndpoint, { product_id: productId }); }
    catch (e) { res = { status: 0, data: {} }; }
    if (res.status === 200 && res.data.status === "coming_soon") {
      this.addMessage("bot", "Purchases are launching soon. Your daily questions reset at midnight.");
    } else if (res.status === 200 && res.data.url) {
      window.location.href = res.data.url; // payments live
    } else if (res.status === 401) {
      this.sessionExpired();
    } else {
      this.addMessage("bot", "Sorry, that didn't work. Please try again in a moment.");
    }
  }

  sessionExpired() {
    this.addMessage("bot", "Your session has ended. Please refresh the page or sign in again to keep using Herbexa.");
  }

  async sendMessage() {
    if (this.busy) return;
    const input = document.getElementById("herbexa-input");
    const message = input.value.trim();
    if (!message) return;

    this.addMessage("user", message);
    this.messages.push({ role: "user", content: message });
    input.value = "";
    input.style.height = "auto";

    this.busy = true;
    document.getElementById("herbexa-send").disabled = true;
    const loadingId = this.showLoading();

    let res;
    try {
      res = await this.post(this.apiEndpoint, { messages: this.messages, lessTehnical: this.lessTehnical });
    } catch (e) {
      res = { status: 0, data: {} };
    }
    this.removeLoading(loadingId);
    this.busy = false;
    document.getElementById("herbexa-send").disabled = false;

    if (res.status === 200 && res.data.message) {
      this.addMessage("bot", res.data.message);
      this.messages.push({ role: "assistant", content: res.data.message });
      this.renderStatus(res.data.usage);
      const st = this.status;
      if (st && !st.premium && st.seeds < HERBEXA_LOW_SEEDS) this.offerSeeds(st.seeds < st.seed_cost);
      if (st && st.premium && st.used_today >= st.daily_limit && st.extra_questions <= 0) this.offerPacks();
      return;
    }

    // Not answered and not charged: take the question back out of history.
    this.messages.pop();

    if (res.status === 402) {
      if (res.data.status) { this.status = res.data.status; this.renderStatus(); }
      if (res.data.reason === "daily_limit") this.offerPacks();
      else this.offerSeeds(true);
      return;
    }
    if (res.status === 401) return this.sessionExpired();

    // Service down: answer from the local knowledge base (free, static).
    if (window.HERBEXA_ENGINE) {
      this.addMessage("bot", window.HERBEXA_ENGINE.getResponse(message, this.lessTehnical) +
        "\n\n(Herbexa's live answers are unavailable right now. This one came from the herb library and wasn't charged.)");
    } else {
      this.addMessage("bot", "Sorry, Herbexa is unavailable right now. You haven't been charged. Try again shortly or browse our [Herb Profiles].");
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────
  escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  addMessage(role, content) {
    const body = document.getElementById("herbexa-body");
    const messageDiv = document.createElement("div");
    messageDiv.className = `herbexa-message ${role}`;
    const textDiv = document.createElement("div");
    textDiv.className = `herbexa-text ${role}`;
    // Escape first so neither user text nor model output can inject HTML,
    // then turn the known [Link] tokens into links (bot messages only).
    const safe = this.escapeHtml(content).replace(/\n/g, "<br>");
    textDiv.innerHTML = role === "bot" ? this.parseLinks(safe) : safe;
    messageDiv.appendChild(textDiv);
    body.appendChild(messageDiv);
    body.scrollTop = body.scrollHeight;
  }

  addOffer(text, buttonsHtml) {
    const body = document.getElementById("herbexa-body");
    const messageDiv = document.createElement("div");
    messageDiv.className = "herbexa-message bot";
    messageDiv.innerHTML = `<div class="herbexa-text bot">${this.escapeHtml(text)}<div class="herbexa-offer">${buttonsHtml}</div></div>`;
    body.appendChild(messageDiv);
    body.scrollTop = body.scrollHeight;
  }

  parseLinks(text) {
    return text
      .replace(/\[([^\]]+) Profile\]/g, (match, herb) => {
        const raw = herb.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        const herbSlug = encodeURIComponent(raw.toLowerCase().replace(/\s+/g, "-"));
        return `<a href="/supreme.html?herb=${herbSlug}" target="_blank" rel="noopener">[${herb} Profile]</a>`;
      })
      .replace(/\[Herb Match\]/g, '<a href="/herb-match.html">[Herb Match]</a>')
      .replace(/\[Herb Profiles\]/g, '<a href="/supreme.html">[Herb Profiles]</a>')
      .replace(/\[Browse Profiles\]/g, '<a href="/supreme.html">[Browse Profiles]</a>')
      .replace(/\[Herbal Planner\]/g, '<a href="/herb-planner.html">[Herbal Planner]</a>')
      .replace(/\[Browse Resources\]/g, '<a href="/resources.html">[Browse Resources]</a>')
      .replace(/\[Contact Us\]/g, '<a href="/resources.html">[Contact Us]</a>')
      .replace(/\[Try Herb Match\]/g, '<a href="/herb-match.html">[Try Herb Match]</a>');
  }

  showLoading() {
    const body = document.getElementById("herbexa-body");
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "herbexa-message bot";
    loadingDiv.innerHTML = '<div class="herbexa-loading"><div class="herbexa-dot"></div><div class="herbexa-dot"></div><div class="herbexa-dot"></div></div>';
    loadingDiv.id = `loading-${Date.now()}`;
    body.appendChild(loadingDiv);
    body.scrollTop = body.scrollHeight;
    return loadingDiv.id;
  }

  removeLoading(loadingId) {
    const loading = document.getElementById(loadingId);
    if (loading) loading.remove();
  }

  loadUserPreferences() {
    let v = false;
    try { v = localStorage.getItem("herbexa_less_tech") === "true"; } catch (e) {}
    this.lessTehnical = v;
    document.getElementById("herbexa-less-tech").checked = v;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { window.herbexaWidget = new HerbexaWidget(); });
} else {
  window.herbexaWidget = new HerbexaWidget();
}
