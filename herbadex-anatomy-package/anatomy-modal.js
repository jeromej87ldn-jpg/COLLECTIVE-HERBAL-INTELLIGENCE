/**
 * HERBADEX Anatomy Education Modal
 *
 * Integrates with herb profiles to show which organs they support
 *
 * Usage:
 * 1. Include anatomy-data.js first
 * 2. Include anatomy-styles.css
 * 3. Include this file
 * 4. Add button to herb profile: <button onclick="openAnatomyModal('herb-name')">📖 See organs</button>
 * 5. Add modal container: <div id="anatomyModalContainer"></div>
 */

class AnatomyModal {
  constructor(options = {}) {
    this.options = {
      containerId: options.containerId || 'anatomyModalContainer',
      currentHerb: options.currentHerb || 'ginger',
      organImagesPath: options.organImagesPath || 'herbadex-anatomy-package/organs/',
      ...options
    };

    this.currentSystem = null;
    this.selectedOrgan = null;
    this.modalElement = null;
    this.herbSystems = []; // Systems this herb affects

    this.init();
  }

  init() {
    this.createModal();
    this.attachEventListeners();
  }

  createModal() {
    const container = document.getElementById(this.options.containerId);
    if (!container) {
      console.error(`Container #${this.options.containerId} not found`);
      return;
    }

    container.innerHTML = `
      <div class="anatomy-modal-overlay" id="anatomyOverlay">
        <div class="anatomy-modal">
          <div class="anatomy-modal-header">
            <h2 id="modalTitle">Organ Support Map</h2>
            <button class="anatomy-modal-close" id="anatomyClose">✕</button>
          </div>

          <div class="anatomy-modal-body">
            <!-- Left: Organ Gallery -->
            <div class="anatomy-organs-gallery">
              <div class="anatomy-system-tabs" id="systemTabs">
                <!-- Tabs will be populated here -->
              </div>
              <div class="anatomy-organs-grid" id="organsGrid">
                <!-- Organs will be populated here -->
              </div>
            </div>

            <!-- Right: Organ Details -->
            <div class="anatomy-detail-section" id="detailSection">
              <div class="anatomy-detail-empty">
                ← Click an organ to learn more
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalElement = container.querySelector('.anatomy-modal-overlay');
  }

  attachEventListeners() {
    // Close button
    document.getElementById('anatomyClose').addEventListener('click', () => this.close());

    // Close on overlay click
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });

    // Keyboard: ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  // Determine which systems the herb affects
  getHerbSystems() {
    const herbData = ANATOMY_DATA.herbSupport[this.options.currentHerb.toLowerCase()];
    if (!herbData) return [];

    const affectedSystemIds = new Set();
    
    // Get all organs the herb affects (primary + secondary)
    const supportedOrgans = [...herbData.primaryOrgans, ...herbData.secondaryOrgans];
    
    // Find which systems these organs belong to
    Object.entries(ANATOMY_DATA.systems).forEach(([systemId, system]) => {
      const systemHasOrgans = system.organs.some(organId => supportedOrgans.includes(organId));
      if (systemHasOrgans) {
        affectedSystemIds.add(systemId);
      }
    });

    return Array.from(affectedSystemIds);
  }

  open(herbName = null) {
    if (herbName) {
      this.options.currentHerb = herbName;
    }

    // Determine which systems this herb affects
    this.herbSystems = this.getHerbSystems();

    // Update title
    const title = document.getElementById('modalTitle');
    if (title) {
      title.textContent = `${this.capitalize(this.options.currentHerb)}'s Organ Support Map`;
    }

    // Render system tabs (only for systems the herb affects)
    this.renderSystemTabs();

    // Switch to first available system
    if (this.herbSystems.length > 0) {
      this.switchSystem(this.herbSystems[0]);
    }

    // Show modal
    this.modalElement.classList.add('active');
  }

  close() {
    this.modalElement.classList.remove('active');
  }

  isOpen() {
    return this.modalElement.classList.contains('active');
  }

  renderSystemTabs() {
    const tabsContainer = document.getElementById('systemTabs');
    const herbData = ANATOMY_DATA.herbSupport[this.options.currentHerb.toLowerCase()];
    
    if (!herbData || this.herbSystems.length === 0) {
      tabsContainer.innerHTML = '<p style="color: #999; font-size: 12px;">No systems affected by this herb</p>';
      return;
    }

    const tabs = this.herbSystems.map(systemId => {
      const system = ANATOMY_DATA.systems[systemId];
      const isActive = systemId === (this.currentSystem || this.herbSystems[0]) ? 'active' : '';
      return `
        <button class="anatomy-system-tab ${isActive}"
                data-system="${systemId}"
                onclick="window.anatomyModal.switchSystem('${systemId}')">
          ${system.name}
        </button>
      `;
    }).join('');

    tabsContainer.innerHTML = tabs;
  }

  switchSystem(systemId) {
    // Only allow switching to systems the herb affects
    if (!this.herbSystems.includes(systemId)) {
      return;
    }

    this.currentSystem = systemId;
    this.selectedOrgan = null;

    // Update active tab
    document.querySelectorAll('.anatomy-system-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.system === systemId);
    });

    // Render organs for system (filtered by herb support)
    this.renderOrgans(systemId);

    // Clear detail
    this.renderDetails();
  }

  renderOrgans(systemId) {
    const system = ANATOMY_DATA.systems[systemId];
    const herbData = ANATOMY_DATA.herbSupport[this.options.currentHerb.toLowerCase()];
    const gridContainer = document.getElementById('organsGrid');

    if (!herbData) {
      gridContainer.innerHTML = '<p style="color: #999;">No herb data available</p>';
      return;
    }

    // Only show organs this herb supports in this system
    const supportedInSystem = system.organs.filter(organId => 
      herbData.primaryOrgans.includes(organId) || herbData.secondaryOrgans.includes(organId)
    );

    const organCards = supportedInSystem.map(organId => {
      const organ = ANATOMY_DATA.organs[organId];
      const imagePath = `${this.options.organImagesPath}${organId}.png`;
      const isPrimary = herbData.primaryOrgans.includes(organId);
      const supportBadge = isPrimary ? '★' : '◆';

      return `
        <div class="anatomy-organ-card ${this.selectedOrgan === organId ? 'active' : ''}"
             data-organ="${organId}"
             title="${isPrimary ? 'Primary Support' : 'Secondary Support'}"
             onclick="window.anatomyModal.selectOrgan('${organId}')">
          <img src="${imagePath}" alt="${organ.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2280%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%2280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2212%22 fill=%22%23999%22%3E${organId}%3C/text%3E%3C/svg%3E'">
          <div class="anatomy-organ-label">${organ.name}</div>
          <div style="font-size: 11px; color: var(--anatomy-gold); margin-top: 2px;">${supportBadge}</div>
        </div>
      `;
    }).join('');

    if (supportedInSystem.length === 0) {
      gridContainer.innerHTML = '<p style="color: #999; grid-column: 1/-1;">No organs in this system are supported by this herb</p>';
    } else {
      gridContainer.innerHTML = organCards;
    }
  }

  selectOrgan(organId) {
    this.selectedOrgan = organId;

    // Update active card
    document.querySelectorAll('.anatomy-organ-card').forEach(card => {
      card.classList.toggle('active', card.dataset.organ === organId);
    });

    // Render details
    this.renderDetails();
  }

  renderDetails() {
    const detailSection = document.getElementById('detailSection');

    if (!this.selectedOrgan || !ANATOMY_DATA.organs[this.selectedOrgan]) {
      detailSection.innerHTML = '<div class="anatomy-detail-empty">← Click an organ to learn more</div>';
      return;
    }

    const organ = ANATOMY_DATA.organs[this.selectedOrgan];
    const herbData = ANATOMY_DATA.herbSupport[this.options.currentHerb.toLowerCase()];
    const herbSupports = herbData && (
      herbData.primaryOrgans.includes(this.selectedOrgan) ||
      herbData.secondaryOrgans.includes(this.selectedOrgan)
    );

    let herbConnectionHTML = '';
    if (herbSupports && herbData) {
      const isPrimary = herbData.primaryOrgans.includes(this.selectedOrgan);
      herbConnectionHTML = `
        <div class="anatomy-herb-connection ${isPrimary ? 'primary' : 'secondary'}">
          <strong>🌱 ${this.capitalize(this.options.currentHerb)} Supports This Organ</strong>
          <p>${herbData.description}</p>
          <div class="anatomy-support-level">
            ${isPrimary
              ? '<span class="anatomy-badge-primary">★ Primary Support</span>'
              : '<span class="anatomy-badge-secondary">◆ Secondary Support</span>'}
          </div>
        </div>
      `;
    }

    let processesHTML = '';
    if (organ.processes && organ.processes.length > 0) {
      processesHTML = `
        <div class="anatomy-processes">
          <h4>Deep Dive</h4>
          ${organ.processes.map((p, idx) => `
            <div class="anatomy-process-item" onclick="this.classList.toggle('expanded')">
              <div class="anatomy-process-title">${p.title}</div>
              <div class="anatomy-process-content">${p.description}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const relatedHerbsHTML = organ.relatedHerbs.map(h =>
      `<span class="anatomy-herb-tag">${h}</span>`
    ).join('');

    detailSection.innerHTML = `
      <div class="anatomy-organ-detail">
        <h3>${organ.name}</h3>
        <span class="anatomy-system-badge">${ANATOMY_DATA.systems[organ.system].name}</span>

        <p class="anatomy-organ-description">${organ.description}</p>

        <h4>What It Does</h4>
        <ul class="anatomy-list">
          ${organ.functions.map(f => `<li>${f}</li>`).join('')}
        </ul>

        <h4>What It Needs</h4>
        <ul class="anatomy-list">
          ${organ.needs.map(n => `<li>${n}</li>`).join('')}
        </ul>

        ${herbConnectionHTML}

        ${processesHTML}

        <h4>Other Herbs That Support This Organ</h4>
        <div class="anatomy-related-herbs">
          ${relatedHerbsHTML}
        </div>

        <div class="anatomy-action-buttons">
          <button class="anatomy-btn-secondary" onclick="alert('Discover herbs feature - coming soon')">
            Discover These Herbs
          </button>
          <button class="anatomy-btn-primary" onclick="alert('Add to stack feature - coming soon')">
            + Add to My Stack
          </button>
        </div>
      </div>
    `;

    // Re-attach expand listeners for processes
    document.querySelectorAll('.anatomy-process-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.classList.contains('anatomy-process-content')) return;
        this.classList.toggle('expanded');
      });
    });
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Global instance
let window_anatomyModal = null;

// Helper functions for HTML onclick attributes
function openAnatomyModal(herbName = null) {
  if (!window_anatomyModal) {
    window_anatomyModal = new AnatomyModal();
    window.anatomyModal = window_anatomyModal;
  }
  window_anatomyModal.open(herbName);
}

function closeAnatomyModal() {
  if (window_anatomyModal) {
    window_anatomyModal.close();
  }
}

// Auto-initialize if ANATOMY_DATA is available
document.addEventListener('DOMContentLoaded', () => {
  if (typeof ANATOMY_DATA !== 'undefined' && !window_anatomyModal) {
    window_anatomyModal = new AnatomyModal();
    window.anatomyModal = window_anatomyModal;
  }
});
