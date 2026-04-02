import './style.css';
import Papa from 'papaparse';
import { createIcons, Home, ChevronRight, ChevronLeft, Folder, FileType, LayoutGrid, LayoutList, Upload, Settings, X, GripVertical } from 'lucide';

// Initialize state
const state = {
  csvData: [],
  headers: [],
  currentLevel: 0,
  path: [], // Array of { header, value } selected at each level
  currentPage: 1,
  pageSize: 25,
  config: {

    hierarchy: [], // Ordered list of headers for drill-down
    tableLevel: 0, // Level index where it becomes a table
    tableColumns: [], // Selected columns for the table view
  }
};

// DOM references
const breadcrumbContainer = document.getElementById('breadcrumb-container');
const contentContainer = document.getElementById('view-content');
const configModal = document.getElementById('config-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeConfigBtn = document.getElementById('close-config');
const applyConfigBtn = document.getElementById('apply-config');
const fileNameDisplay = document.getElementById('file-name');

// Initialize the app
async function init() {
  try {
    refreshIcons(); // Initial icon load for static HTML buttons
    loadConfig();

    const baseUrl = import.meta.env.BASE_URL || '/';
    Papa.parse(`${baseUrl}data.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        state.csvData = results.data;
        state.headers = results.meta.fields || [];

        // If no config exists, set defaults based on first few columns
        if (state.config.hierarchy.length === 0) {
          state.config.hierarchy = state.headers.slice(0, 3);
          state.config.tableColumns = [...state.headers];
          state.config.tableLevel = state.config.hierarchy.length;
        }

        updateHeaderUI('data.csv');
        render();
      },
      error: (err) => {
        console.error('PapaParse error:', err);
        showErrorUI();
      }
    });

    setupEventListeners();
  } catch (error) {
    console.error('Error in init:', error);
    showErrorUI();
  }
}

function updateHeaderUI(fileName) {
  if (state.csvData.length > 0) {
    settingsBtn.style.display = 'inline-flex';
    if (fileNameDisplay) {
      fileNameDisplay.textContent = fileName;
    }
  } else {
    settingsBtn.style.display = 'none';
  }
}

function loadConfig() {
  const saved = localStorage.getItem('drill_down_config');
  if (saved) {
    state.config = JSON.parse(saved);
  }
}

function saveConfig() {
  localStorage.setItem('drill_down_config', JSON.stringify(state.config));
}

function setupEventListeners() {
  setupBreadcrumbListeners();
  setupUploadListeners();

  settingsBtn?.addEventListener('click', openConfigModal);
  closeConfigBtn?.addEventListener('click', () => configModal.style.display = 'none');
  applyConfigBtn?.addEventListener('click', applyNewConfig);

  // Close modal on outside click
  configModal?.addEventListener('click', (e) => {
    if (e.target === configModal) configModal.style.display = 'none';
  });
}

function openConfigModal() {
  const hierarchyList = document.getElementById('hierarchy-sortable');
  const columnsList = document.getElementById('columns-sortable');

  // 1. Render Hierarchy Settings
  const sortedHierarchyHeaders = [...state.headers].sort((a, b) => {
    const indexA = state.config.hierarchy.indexOf(a);
    const indexB = state.config.hierarchy.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  hierarchyList.innerHTML = sortedHierarchyHeaders.map(header => {
    const isChecked = state.config.hierarchy.includes(header);
    return renderSortableItem(header, isChecked, 'hierarchy');
  }).join('');

  // 2. Render Table Column Settings
  const sortedColumnHeaders = [...state.headers].sort((a, b) => {
    const indexA = state.config.tableColumns.indexOf(a);
    const indexB = state.config.tableColumns.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  columnsList.innerHTML = sortedColumnHeaders.map(header => {
    const isChecked = state.config.tableColumns.includes(header);
    return renderSortableItem(header, isChecked, 'column');
  }).join('');

  setupSortableDragAndDrop(hierarchyList);
  setupSortableDragAndDrop(columnsList);

  updateTransitionOptions();

  configModal.style.display = 'flex';
  refreshIcons();
}

function renderSortableItem(label, checked, type) {
  return `
    <div class="sortable-item" draggable="true" data-type="${type}" data-label="${label}">
      <span class="drag-handle"><i data-lucide="grip-vertical"></i></span>
      <input type="checkbox" ${checked ? 'checked' : ''}>
      <span class="item-label">${label}</span>
    </div>
  `;
}

function setupSortableDragAndDrop(container) {
  container.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.sortable-item');
    if (!item) return;
    item.classList.add('dragging');
  });

  container.addEventListener('dragend', (e) => {
    const item = e.target.closest('.sortable-item');
    if (!item) return;
    item.classList.remove('dragging');
    if (item.dataset.type === 'hierarchy') {
      updateTransitionOptions();
    }
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingItem = container.querySelector('.dragging');
    const siblings = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
    const nextSibling = siblings.find(sibling => {
      return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
    });
    container.insertBefore(draggingItem, nextSibling);
  });

  // Listen for checkbox changes to update transition levels
  container.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const item = e.target.closest('.sortable-item');
      if (item.dataset.type === 'hierarchy') {
        updateTransitionOptions();
      }
    }
  });
}

function updateTransitionOptions() {
  const transitionSelect = document.getElementById('table-transition-level');
  const items = [...document.querySelectorAll('#hierarchy-sortable .sortable-item')];
  const selectedHierarchy = items
    .filter(item => item.querySelector('input').checked)
    .map(item => item.dataset.label);

  transitionSelect.innerHTML = selectedHierarchy.map((header, idx) => `
    <option value="${idx}" ${state.config.tableLevel === idx ? 'selected' : ''}>After ${header}</option>
  `).join('');

  transitionSelect.innerHTML += `<option value="${selectedHierarchy.length}" ${state.config.tableLevel === selectedHierarchy.length ? 'selected' : ''}>Never (Always show list until last level)</option>`;
}

function applyNewConfig() {
  const hierarchyItems = [...document.querySelectorAll('#hierarchy-sortable .sortable-item')];
  const columnItems = [...document.querySelectorAll('#columns-sortable .sortable-item')];
  const transitionSelect = document.getElementById('table-transition-level');

  state.config.hierarchy = hierarchyItems
    .filter(item => item.querySelector('input').checked)
    .map(item => item.dataset.label);

  state.config.tableColumns = columnItems
    .filter(item => item.querySelector('input').checked)
    .map(item => item.dataset.label);

  state.config.tableLevel = parseInt(transitionSelect.value);

  saveConfig();
  configModal.style.display = 'none';

  // Reset view
  state.currentLevel = 0;
  state.path = [];
  state.currentPage = 1;
  render();
}

function setupUploadListeners() {
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('csv-upload');

  uploadBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        state.csvData = results.data;
        state.headers = results.meta.fields || [];

        // Reset hierarchy if headers changed significantly
        state.config.hierarchy = state.headers.slice(0, 3);
        state.config.tableColumns = [...state.headers];
        state.config.tableLevel = state.config.hierarchy.length;

        state.currentLevel = 0;
        state.path = [];
        state.currentPage = 1;
        saveConfig();
        updateHeaderUI(file.name);
        render();
      },
      error: (err) => {
        console.error('Upload Error:', err);
        alert('Failed to parse the uploaded CSV. Please check the file format.');
      }
    });
  });
}

function showErrorUI() {
  contentContainer.innerHTML = `
    <div style="text-align: center; padding: 3rem; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--glass-border);">
      <h2 style="color: var(--accent); margin-bottom: 1rem;">Data Connection Failure</h2>
      <p>Ensure <b>data.csv</b> exists in the public directory and is correctly formatted.</p>
      <button onclick="window.location.reload()" style="margin-top: 1.5rem; padding: 0.5rem 1rem; border-radius: 8px; border: none; background: var(--primary); color: white; cursor: pointer;">Retry Connection</button>
    </div>
  `;
}

// Function to get current filtered data based on path
function getFilteredData() {
  let filtered = state.csvData;
  state.path.forEach((p, idx) => {
    filtered = filtered.filter(item => item[state.config.hierarchy[idx]] === p.value);
  });
  return filtered;
}

// Function to handle drill-down
function drillDown(value) {
  const currentHeader = state.config.hierarchy[state.currentLevel];
  if (!value) return;

  state.path.push({ header: currentHeader, value });
  state.currentLevel++;
  state.currentPage = 1; // Reset pagination
  render();
}

// Function to navigate back to a specific level
function navigateToLevel(level) {
  state.path = state.path.slice(0, level);
  state.currentLevel = level;
  state.currentPage = 1; // Reset pagination
  render();
}

// Helper to enable grab scroll for an element
function setupGrabScroll(element) {
  let isDown = false;
  let startX;
  let scrollLeft;
  let hasMoved = false;

  element.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - element.offsetLeft;
    scrollLeft = element.scrollLeft;
    hasMoved = false;
  });

  element.addEventListener('mouseleave', () => {
    isDown = false;
  });

  element.addEventListener('mouseup', () => {
    isDown = false;
  });

  element.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - element.offsetLeft;
    const walk = (x - startX) * 2;
    if (Math.abs(walk) > 5) {
      hasMoved = true;
      element.scrollLeft = scrollLeft - walk;
    }
  });

  // Block clicks if we dragged the table
  element.addEventListener('click', (e) => {
    if (hasMoved) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

// Rendering logic
function render() {
  if (!state.headers.length) return;

  // Clear and animate
  contentContainer.classList.remove('view-transition-container');
  void contentContainer.offsetWidth; // Trigger reflow
  contentContainer.classList.add('view-transition-container');

  renderBreadcrumbs();

  const filteredData = getFilteredData();
  const isLastLevel = state.currentLevel === state.config.hierarchy.length;
  const shouldShowTable = state.currentLevel >= state.config.tableLevel || isLastLevel;

  if (shouldShowTable) {
    renderTable(filteredData);
  } else {
    const currentHeader = state.config.hierarchy[state.currentLevel];
    const uniqueItems = [...new Set(filteredData.map(item => item[currentHeader]).filter(v => v))];

    if (uniqueItems.length > 20) {
      renderTableList(uniqueItems, currentHeader);
    } else {
      renderListView(uniqueItems);
    }
  }

  refreshIcons();
}

function refreshIcons() {
  createIcons({
    icons: { Home, ChevronRight, ChevronLeft, Folder, FileType, LayoutGrid, LayoutList, Upload, Settings, X, GripVertical }
  });
}

function renderBreadcrumbs() {
  breadcrumbContainer.innerHTML = '';

  // Home Breadcrumb
  const homeItem = document.createElement('span');
  homeItem.className = `breadcrumb-item ${state.currentLevel === 0 ? 'active' : ''}`;
  homeItem.dataset.level = '0';
  homeItem.innerHTML = `<i data-lucide="home"></i> <span>Home</span>`;
  breadcrumbContainer.appendChild(homeItem);

  state.path.forEach((p, idx) => {
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.innerHTML = '<i data-lucide="chevron-right"></i>';
    breadcrumbContainer.appendChild(separator);

    const levelIndex = idx + 1;
    const item = document.createElement('span');
    item.className = `breadcrumb-item ${levelIndex === state.currentLevel ? 'active' : ''}`;
    item.dataset.level = levelIndex.toString();
    item.innerHTML = `<span>${p.value}</span>`;
    breadcrumbContainer.appendChild(item);
  });
}

function renderListView(items) {
  const grid = document.createElement('div');
  grid.className = 'tree-grid';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'tree-item';
    card.innerHTML = `
      <i data-lucide="folder"></i>
      <span class="item-name">${item}</span>
    `;
    card.addEventListener('click', () => drillDown(item));
    grid.appendChild(card);
  });

  contentContainer.innerHTML = '';
  contentContainer.appendChild(grid);
}

function renderTableList(items, header) {
  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';

  tableContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th class="sl-no">Sl No</th>
          <th>${header} (Grouped)</th>
          <th style="text-align: right;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr data-value="${item}">
            <td class="sl-no">${idx + 1}</td>
            <td>${item}</td>
            <td style="text-align: right; color: var(--primary);">Explore <i data-lucide="chevron-right" style="width: 14px; height: 14px; vertical-align: middle;"></i></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  tableContainer.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', () => drillDown(tr.dataset.value));
  });

  setupGrabScroll(tableContainer);

  contentContainer.innerHTML = '';
  contentContainer.appendChild(tableContainer);
}

function renderPaginationControls(currentPage, totalPages, totalItems) {
  const pagination = document.createElement('div');
  pagination.className = 'pagination-container';
  pagination.style.margin = '1rem auto';
  pagination.innerHTML = `
    <div class="pagination-left">
      <span class="page-size-label">Rows:</span>
      <select class="page-size-select">
        ${[10, 25, 50, 100, 500].map(size => `
          <option value="${size}" ${state.pageSize === size ? 'selected' : ''}>${size}</option>
        `).join('')}
      </select>
    </div>
    <div class="pagination-center">
      <button class="pagination-btn prev-page" ${currentPage === 1 ? 'disabled' : ''}>
        <i data-lucide="chevron-left"></i> Previous
      </button>
      <span class="page-info">Page ${currentPage} of ${totalPages}</span>
      <button class="pagination-btn next-page" ${currentPage === totalPages ? 'disabled' : ''}>
        Next <i data-lucide="chevron-right"></i>
      </button>
    </div>
    <div class="pagination-right">
      <span class="total-count">Total: ${totalItems}</span>
    </div>
  `;

  pagination.querySelector('.prev-page')?.addEventListener('click', () => {
    state.currentPage--;
    render();
  });

  pagination.querySelector('.next-page')?.addEventListener('click', () => {
    state.currentPage++;
    render();
  });

  pagination.querySelector('.page-size-select')?.addEventListener('change', (e) => {
    state.pageSize = parseInt(e.target.value);
    state.currentPage = 1;
    render();
  });

  return pagination;
}


function renderTable(data) {
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1; // Minimum 1 page even if empty
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const paginatedData = data.slice(startIndex, startIndex + state.pageSize);

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.width = '100%';

  // Always show pagination controls if we are in table mode
  container.appendChild(renderPaginationControls(state.currentPage, totalPages, totalItems));

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-container';

  const headers = state.config.tableColumns;

  if (totalItems === 0) {
    tableWrapper.innerHTML = `
      <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
        <p>No records found at this level.</p>
      </div>
    `;
  } else {
    tableWrapper.innerHTML = `
      <table>
        <thead>
          <tr>
            <th class="sl-no">Sl No</th>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${paginatedData.map((row, idx) => `
            <tr>
              <td class="sl-no">${startIndex + idx + 1}</td>
              ${headers.map(h => `<td>${row[h] || '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    setupGrabScroll(tableWrapper);
  }

  container.appendChild(tableWrapper);
  container.appendChild(renderPaginationControls(state.currentPage, totalPages, totalItems));

  contentContainer.innerHTML = '';
  contentContainer.appendChild(container);
}


function setupBreadcrumbListeners() {
  breadcrumbContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.breadcrumb-item');
    if (item && !item.classList.contains('active')) {
      const level = parseInt(item.dataset.level);
      navigateToLevel(level);
    }
  });
}

// Start the app
init();
