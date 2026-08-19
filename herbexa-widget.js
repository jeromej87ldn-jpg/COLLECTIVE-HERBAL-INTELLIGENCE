// herbexa-widget.js
// Floating chatbot widget for Herbadex pages

class HerbexaWidget {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.sessionId = `session_${Date.now()}`;
    this.exchangeCount = 0;
    this.maxExchanges = 10;
    this.lessTehnical = false;
    this.apiEndpoint = "/.netlify/functions/herbexa";
    this.init();
  }

  init() {
    this.createWidget();
    this.attachEventListeners();
    this.loadUserPreferences();
  }

  createWidget() {
    // Container
    const container = document.createElement("div");
    container.id = "herbexa-widget";
    container.innerHTML = `
      <style>
        #herbexa-widget {
          position: fixed;
          bottom: 20px;
          right: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 9999;
        }

        .herbexa-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2d5016 0%, #4a7c2f 100%);
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s ease;
          color: white;
        }

        .herbexa-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }

        .herbexa-button.active {
          border-radius: 0;
          width: auto;
          padding: 0;
        }

        .herbexa-chat {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 380px;
          height: 600px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 5px 40px rgba(0,0,0,0.16);
          display: flex;
          flex-direction: column;
          opacity: 0;
          pointer-events: none;
          transform: translateY(20px);
          transition: all 0.3s ease;
        }

        .herbexa-chat.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
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
          line-height: 1.5;
          max-width: 85%;
          word-wrap: break-word;
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

        /* Responsive */
        @media (max-width: 480px) {
          .herbexa-chat {
            width: calc(100vw - 40px);
            height: 70vh;
            max-height: 500px;
            bottom: 80px;
            right: 20px;
            left: 20px;
          }

          .herbexa-text {
            max-width: 95%;
          }
        }
      </style>

      <button class="herbexa-button" id="herbexa-btn" title="Ask Herbexa">🌿</button>

      <div class="herbexa-chat" id="herbexa-chat">
        <div class="herbexa-header">
          <h2 class="herbexa-title">Herbexa</h2>
          <button class="herbexa-close" id="herbexa-close">&times;</button>
        </div>

        <div class="herbexa-body" id="herbexa-body">
          <div class="herbexa-message bot">
            <div class="herbexa-text bot">
              Hi! I'm Herbexa, your herbal guide. Ask me about herbs, wellness, preparations, or combinations. How can I help?
            </div>
          </div>
        </div>

        <div class="herbexa-footer">
          <div class="herbexa-options">
            <label class="herbexa-toggle">
              <input type="checkbox" id="herbexa-less-tech" />
              Less technical
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
    document.getElementById("herbexa-input").focus();
  }

  close() {
    this.isOpen = false;
    const chat = document.getElementById("herbexa-chat");
    const btn = document.getElementById("herbexa-btn");
    chat.classList.remove("open");
    btn.classList.remove("active");
  }

  async sendMessage() {
    const input = document.getElementById("herbexa-input");
    const message = input.value.trim();

    if (!message) return;

    // Check exchange limit
    if (this.exchangeCount >= this.maxExchanges) {
      this.addMessage(
        "bot",
        "You've reached the conversation limit for this session. Start fresh for better answers!"
      );
      input.disabled = true;
      document.getElementById("herbexa-send").disabled = true;
      return;
    }

    // Add user message
    this.addMessage("user", message);
    input.value = "";
    input.style.height = "auto";
    this.exchangeCount++;

    // Show loading state
    const loadingId = this.showLoading();

    try {
      // Call backend
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

      // Update status
      this.updateStatus();
    } catch (error) {
      this.removeLoading(loadingId);
      this.addMessage(
        "bot",
        "Sorry, I couldn't process that. Try again or browse our [Herb Profiles] for direct answers."
      );
      console.error("Herbexa error:", error);
    }
  }

  addMessage(role, content) {
    this.messages.push({ role: role === "user" ? "user" : "assistant", content });

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
        const herbSlug = herb.toLowerCase().replace(/\s+/g, "-");
        return `<a href="/herb-profile.html?herb=${herbSlug}" target="_blank">[${herb} Profile]</a>`;
      })
      .replace(/\[Herb Match\]/g, '<a href="/herb-match.html">[Herb Match]</a>')
      .replace(/\[Herb Profiles\]/g, '<a href="/glossary.html">[Herb Profiles]</a>')
      .replace(/\[Herbal Planner\]/g, '<a href="/garden.html">[Herbal Planner]</a>')
      .replace(/\[Resources\]/g, '<a href="/resources.html">[Resources]</a>');
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
    if (remaining <= 2) {
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

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new HerbexaWidget();
  });
} else {
  new HerbexaWidget();
}