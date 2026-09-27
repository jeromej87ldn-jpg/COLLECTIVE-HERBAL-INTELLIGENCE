// herbexa-widget-local.js
// Floating chatbot widget. v2: now calls the live Herbexa Netlify function
// (Claude API, fixed model) so it can handle personalized/follow-up
// questions the static local knowledge base can't. Falls back to the local
// knowledge base (herbexa-knowledge-base.js, loaded before this file) if
// the API call fails for any reason — so the bot never goes silent.

class HerbexaWidget {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.sessionId = `session_${Date.now()}`;
    this.exchangeCount = 0;
    this.maxExchanges = 15;
    this.lessTehnical = false;
    this.apiEndpoint = "/.netlify/functions/herbexa";
    this.init();
  }

  init() {
    this.createWidget();
    this.attachEventListeners();
    this.loadUserPreferences();
    this.applyPosition();
    window.addEventListener("herbadex-edge-prefs", () => this.applyPosition());
  }

  // Side + height from the shared edge prefs (herbadex-edge-tabs.js).
  // Falls back to right edge, lower third if that file isn't loaded.
  applyPosition() {
    const P = window.HerbadexEdgePrefs;
    const prefs = P ? P.get() : { herbexaSide: "right", herbexaHeight: "lower", toolsSide: "left", toolsHeight: "middle" };
    const side = prefs.herbexaSide === "left" ? "left" : "right";
    const top = P ? P.herbexaTop(prefs) : "72%";
    const btn = document.getElementById("herbexa-btn");
    const chat = document.getElementById("herbexa-chat");
    [btn, chat].forEach((el) => {
      if (!el) return;
      el.classList.remove("hdx-side-left", "hdx-side-right");
      el.classList.add("hdx-side-" + side);
    });
    if (btn) btn.style.top = top;
  }

  createWidget() {
    const container = document.createElement("div");
    container.id = "herbexa-widget";
    container.innerHTML = `
      <style>
        /* Edge layout (v3). Side and height come from HerbadexEdgePrefs
           (herbadex-edge-tabs.js), set in Profile → Settings → Display. */
        #herbexa-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .herbexa-button {
          position: fixed;
          top: 72%;
          right: 0;
          z-index: 45;
          display: flex;
          align-items: center;
          gap: 6px;
          writing-mode: vertical-rl;
          transform: translateY(-50%) rotate(180deg);
          background: linear-gradient(135deg, #2d5016 0%, #4a7c2f 100%);
          color: #fff;
          border: 1px solid rgba(200,149,42,.4);
          border-right: none;
          border-radius: 8px 0 0 8px;
          padding: .8rem .42rem;
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: .04em;
          cursor: pointer;
          opacity: .88;
          box-shadow: 0 4px 14px rgba(0,0,0,.3);
          transition: opacity .15s, padding .15s;
          -webkit-tap-highlight-color: transparent;
        }

        .herbexa-button.hdx-side-left {
          right: auto;
          left: 0;
          transform: translateY(-50%);
          border-right: 1px solid rgba(200,149,42,.4);
          border-left: none;
          border-radius: 0 8px 8px 0;
        }

        .herbexa-button:hover,
        .herbexa-button:focus-visible {
          opacity: 1;
        }

        .herbexa-button.hdx-side-right:hover { padding-right: .6rem; }
        .herbexa-button.hdx-side-left:hover { padding-left: .6rem; }
        .herbexa-button:focus-visible { outline: 2px solid #e8b84b; outline-offset: 2px; }

        .herbexa-button-icon {
          writing-mode: horizontal-tb;
          font-size: 12px;
          line-height: 1;
        }

        /* Hide the tab while the panel is open; the panel has its own close. */
        .herbexa-button.active {
          visibility: hidden;
        }

        .herbexa-chat {
          position: fixed;
          bottom: 20px;
          right: 0;
          z-index: 1500;
          width: 380px;
          height: min(600px, calc(100vh - 100px));
          background: white;
          border-radius: 12px 0 0 12px;
          box-shadow: 0 5px 40px rgba(0,0,0,0.22);
          display: flex;
          flex-direction: column;
          opacity: 0;
          pointer-events: none;
          transform: translateX(105%);
          transition: transform 0.3s ease, opacity 0.3s ease;
        }

        .herbexa-chat.hdx-side-left {
          right: auto;
          left: 0;
          border-radius: 0 12px 12px 0;
          transform: translateX(-105%);
        }

        .herbexa-chat.open,
        .herbexa-chat.hdx-side-left.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateX(0);
        }

        .herbexa-header {
          background: linear-gradient(135deg, #2d5016 0%, #4a7c2f 100%);
          color: white;
          padding: 16px;
          border-radius: 12px 0 0 0;
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

        .herbexa-chat.hdx-side-left .herbexa-header {
          border-radius: 0 12px 0 0;
        }

        /* Slimmer tab on phones, matching the tool tabs. */
        @media (max-width: 760px) {
          .herbexa-button { font-size: 10.5px; padding: .6rem .26rem; gap: 4px; }
          .herbexa-button-icon { font-size: 10.5px; }
        }

        @media (max-width: 480px) {
          .herbexa-chat {
            width: calc(100vw - 12px);
            height: 75vh;
            max-height: 560px;
            bottom: 8px;
          }

          .herbexa-text {
            max-width: 95%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .herbexa-chat, .herbexa-button { transition: none; }
        }
      </style>

      <button type="button" class="herbexa-button hdx-side-right" id="herbexa-btn" title="Ask Herbexa" aria-controls="herbexa-chat" aria-expanded="false"><span class="herbexa-button-icon" aria-hidden="true">🌿</span>Herbexa</button>

      <div class="herbexa-chat hdx-side-right" id="herbexa-chat">
        <div class="herbexa-header">
          <h2 class="herbexa-title">Herbexa</h2>
          <button class="herbexa-close" id="herbexa-close">&times;</button>
        </div>

        <div class="herbexa-body" id="herbexa-body">
          <div class="herbexa-message bot">
            <div class="herbexa-text bot">
              Hi! I'm Herbexa, your herbal guide. Ask me about herbs, wellness concerns, preparation methods, or how to get started. What's on your mind?
            </div>
          </div>
        </div>

        <div class="herbexa-footer">
          <div class="herbexa-options">
            <label class="herbexa-toggle">
              <input type="checkbox" id="herbexa-less-tech" />
              Simpler language
            </label>
          </div>
          <div class="herbexa-input-row">
            <textarea
              class="herbexa-input"
              id="herbexa-input"
              placeholder="Ask about herbs..."
              rows="1"
            ></textarea>
            <button class="herbexa-send" id="herbexa-send">→</button>
          </div>
          <div class="herbexa-status" id="herbexa-status"></div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
  }

  attachEventListeners() {
    const btn = document.getElementById("herbexa-btn");
    const closeBtn = document.getElementById("herbexa-close");
    const sendBtn = document.getElementById("herbexa-send");
    const input = document.getElementById("herbexa-input");
    const lessTehnicalToggle = document.getElementById("herbexa-less-tech");

    btn.addEventListener("click", () => this.toggle());
    closeBtn.addEventListener("click", () => this.close());
    sendBtn.addEventListener("click", () => this.sendMessage());
    lessTehnicalToggle.addEventListener("change", (e) => {
      this.lessTehnical = e.target.checked;
      localStorage.setItem("herbexa_less_tech", this.lessTehnical);
    });

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    input.addEventListener("input", (e) => {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    const chat = document.getElementById("herbexa-chat");
    const btn = document.getElementById("herbexa-btn");
    chat.classList.add("open");
    btn.classList.add("active");
    btn.setAttribute("aria-expanded", "true");
    document.getElementById("herbexa-input").focus();
  }

  close() {
    this.isOpen = false;
    const chat = document.getElementById("herbexa-chat");
    const btn = document.getElementById("herbexa-btn");
    chat.classList.remove("open");
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
  }

  async sendMessage() {
    const input = document.getElementById("herbexa-input");
    const message = input.value.trim();

    if (!message) return;

    // Check exchange limit
    if (this.exchangeCount >= this.maxExchanges) {
      this.addMessage(
        "bot",
        "You've reached the conversation limit for this session. Start fresh for more! 🌿"
      );
      input.disabled = true;
      document.getElementById("herbexa-send").disabled = true;
      return;
    }

    // Add user message
    this.addMessage("user", message);
    this.messages.push({ role: "user", content: message });
    input.value = "";
    input.style.height = "auto";
    this.exchangeCount++;

    const loadingId = this.showLoading();

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: this.messages,
          lessTehnical: this.lessTehnical,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      this.removeLoading(loadingId);
      this.addMessage("bot", data.message);
      this.messages.push({ role: "assistant", content: data.message });
      this.updateStatus();
    } catch (error) {
      console.error("Herbexa API error, falling back to local knowledge base:", error);
      this.removeLoading(loadingId);

      // Graceful degrade: use the local static knowledge base rather than
      // going silent if the live API is unreachable for any reason.
      if (window.HERBEXA_ENGINE) {
        const fallback = window.HERBEXA_ENGINE.getResponse(message, this.lessTehnical);
        this.addMessage("bot", fallback);
        this.updateStatus();
      } else {
        this.addMessage(
          "bot",
          "Sorry, I couldn't process that. Try again or browse our [Herb Profiles] for direct answers."
        );
      }
    }
  }

  addMessage(role, content) {
    const body = document.getElementById("herbexa-body");
    const messageDiv = document.createElement("div");
    messageDiv.className = `herbexa-message ${role}`;

    const textDiv = document.createElement("div");
    textDiv.className = `herbexa-text ${role}`;
    textDiv.innerHTML = this.parseLinks(content);

    messageDiv.appendChild(textDiv);
    body.appendChild(messageDiv);
    body.scrollTop = body.scrollHeight;
  }

  parseLinks(text) {
    // Convert [Text] to clickable links
    return text
      .replace(/\[([^\]]+) Profile\]/g, (match, herb) => {
        // supreme.html is the actual Herbadex/profile page on this site —
        // it reads ?herb=name-with-hyphens and converts hyphens back to
        // spaces itself. There is no herb-profile.html; that was the bug.
        const herbSlug = herb.toLowerCase().replace(/\s+/g, "-");
        return `<a href="/supreme.html?herb=${herbSlug}" target="_blank">[${herb} Profile]</a>`;
      })
      .replace(/\[Herb Match\]/g, '<a href="/herb-match.html">[Herb Match]</a>')
      // Herb Profiles / Browse Profiles -> supreme.html (the Herbadex, the
      // actual A-Z herb library). glossary.html is just term definitions,
      // not herb profiles — that was pointing to the wrong page.
      .replace(/\[Herb Profiles\]/g, '<a href="/supreme.html">[Herb Profiles]</a>')
      .replace(/\[Browse Profiles\]/g, '<a href="/supreme.html">[Browse Profiles]</a>')
      // Herbal Planner -> herb-planner.html. garden.html is the community
      // photo gallery, a different page — that was also wrong.
      .replace(/\[Herbal Planner\]/g, '<a href="/herb-planner.html">[Herbal Planner]</a>')
      .replace(/\[Browse Resources\]/g, '<a href="/resources.html">[Browse Resources]</a>')
      // There's no contact.html on the site (and no contact info found
      // elsewhere) — pointing at Resources for now rather than a dead link.
      // Flag to Jerome: worth adding a real contact page/email later.
      .replace(/\[Contact Us\]/g, '<a href="/resources.html">[Contact Us]</a>')
      .replace(/\[Try Herb Match\]/g, '<a href="/herb-match.html">[Try Herb Match]</a>');
  }

  showLoading() {
    const body = document.getElementById("herbexa-body");
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "herbexa-message bot";
    loadingDiv.innerHTML = `
      <div class="herbexa-loading">
        <div class="herbexa-dot"></div>
        <div class="herbexa-dot"></div>
        <div class="herbexa-dot"></div>
      </div>
    `;
    loadingDiv.id = `loading-${Date.now()}`;
    body.appendChild(loadingDiv);
    body.scrollTop = body.scrollHeight;
    return loadingDiv.id;
  }

  removeLoading(loadingId) {
    const loading = document.getElementById(loadingId);
    if (loading) loading.remove();
  }

  updateStatus() {
    const remaining = this.maxExchanges - this.exchangeCount;
    const statusEl = document.getElementById("herbexa-status");
    if (remaining <= 3) {
      statusEl.textContent = `${remaining} message${remaining === 1 ? "" : "s"} left this session`;
    } else {
      statusEl.textContent = "";
    }
  }

  loadUserPreferences() {
    const lessTehnical = localStorage.getItem("herbexa_less_tech") === "true";
    this.lessTehnical = lessTehnical;
    document.getElementById("herbexa-less-tech").checked = lessTehnical;
  }
}

// Initialize when DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new HerbexaWidget();
  });
} else {
  new HerbexaWidget();
}