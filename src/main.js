import './style.css';
import Papa from 'papaparse';
import { createIcons, Home, ChevronRight, ChevronDown, Folder, FileType, LayoutGrid, LayoutList, Upload, Settings, X, GripVertical, User, MapPin, Table } from 'lucide';

// Initialize state
const state = {
  csvData: [],
  headers: [],
  path: [], // Array of selected values: [region, district, block, ivcs]
  config: {
    hierarchy: ['region', 'district', 'block', 'ivcs'],
    tableColumns: ['ivcs', 'ivcs_manager', 'gender', 'contact', 'status'],
  },
  levelInfo: {
    'region': { label: 'Region', roleTitle: 'RPM', roleKeys: ['rpm'] },
    'district': { label: 'District', roleTitle: 'DPM / Nodal', roleKeys: ['dpm', 'district_nodal'] },
    'block': { label: 'Block', roleTitle: 'Coordinator', roleKeys: ['block_coordinator'] },
    'ivcs': { label: 'IVCS', roleTitle: 'Manager', roleKeys: ['ivcs_manager'] }
  }
};

// DOM references
const contentContainer = document.getElementById('view-content');
const breadcrumbContainer = document.getElementById('breadcrumb-container');

// Initialize the app
async function init() {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    Papa.parse(`${baseUrl}slm_new_data.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        state.csvData = results.data;
        state.headers = results.meta.fields || [];
        render();
      },
      error: (err) => {
        console.error('PapaParse error:', err);
        showErrorUI();
      }
    });
  } catch (error) {
    console.error('Error in init:', error);
  }
}

function render() {
  contentContainer.innerHTML = '';
  renderBreadcrumbs();

  const flowContainer = document.createElement('div');
  flowContainer.className = 'stacked-flow-container';

  // Start rendering from level 0 (Region)
  renderLevel(flowContainer, 0);

  contentContainer.appendChild(flowContainer);
  refreshIcons();
}

function renderLevel(container, levelIndex) {
  const hierarchyField = state.config.hierarchy[levelIndex];
  if (!hierarchyField) return;

  const filteredData = getFilteredData(levelIndex);
  const items = getUniqueItemsWithRoles(filteredData, hierarchyField, levelIndex);

  if (items.length === 0) return;

  // Create level section
  const levelSection = document.createElement('div');
  levelSection.className = 'flow-level';
  levelSection.dataset.level = levelIndex;

  const levelHeader = document.createElement('div');
  levelHeader.className = 'level-header';
  levelHeader.innerHTML = `<span class="level-badge">${state.levelInfo[hierarchyField].label}</span>`;
  levelSection.appendChild(levelHeader);

  const itemsGrid = document.createElement('div');
  itemsGrid.className = 'flow-grid';

  items.forEach(item => {
    const isSelected = state.path[levelIndex] === item.value;
    const card = document.createElement('div');
    card.className = `flow-card ${isSelected ? 'selected' : ''}`;
    
    const roleInfo = state.levelInfo[hierarchyField];
    const roleName = item.roles.join(' / ') || 'Not Assigned';

    card.innerHTML = `
      <div class="card-content">
        <div class="card-main">
          <i data-lucide="${levelIndex === state.config.hierarchy.length - 1 ? 'file-type' : 'folder'}"></i>
          <span class="item-name">${item.value}</span>
        </div>
        <div class="card-role">
          <div class="role-icon"><i data-lucide="user"></i></div>
          <div class="role-details">
            <span class="role-title">${roleInfo.roleTitle}</span>
            <span class="role-name">${roleName}</span>
          </div>
        </div>
      </div>
      ${isSelected ? '<div class="selection-indicator"><i data-lucide="chevron-down"></i></div>' : ''}
    `;

    card.addEventListener('click', () => {
      if (isSelected) {
        state.path = state.path.slice(0, levelIndex);
        render();
      } else {
        state.path = state.path.slice(0, levelIndex);
        state.path.push(item.value);
        render();
        
        // Wait for render to complete, then scroll to the next revealed segment
        setTimeout(() => {
          const nextLevel = levelIndex + 1;
          const target = document.querySelector(`.flow-level[data-level="${nextLevel}"]`) || 
                         document.querySelector('.final-table-section');
          
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    });

    itemsGrid.appendChild(card);
  });

  levelSection.appendChild(itemsGrid);
  container.appendChild(levelSection);

  // If this level is selected, render next
  if (state.path[levelIndex]) {
    const isLastLevel = levelIndex === state.config.hierarchy.length - 1;
    
    if (!isLastLevel) {
        const connector = document.createElement('div');
        connector.className = 'flow-connector';
        container.appendChild(connector);
        renderLevel(container, levelIndex + 1);
    } else {
        // Show table for the final selected IVCS
        const tableSection = document.createElement('div');
        tableSection.className = 'final-table-section view-transition-container';
        renderTable(tableSection, filteredData.filter(r => r['ivcs'] === state.path[levelIndex]));
        container.appendChild(tableSection);
    }
  }
}

function getFilteredData(untilLevel) {
  let filtered = state.csvData;
  for (let i = 0; i < untilLevel; i++) {
    const field = state.config.hierarchy[i];
    const value = state.path[i];
    filtered = filtered.filter(row => row[field] === value);
  }
  return filtered;
}

function getUniqueItemsWithRoles(data, field, levelIndex) {
    const map = new Map();
    const roleKeys = state.levelInfo[field].roleKeys;
    
    data.forEach(row => {
        const val = row[field];
        if (val && !map.has(val)) {
            const roles = [];
            roleKeys.forEach(k => {
                const r = row[k];
                if (r && r !== '-') roles.push(r);
            });
            map.set(val, { value: val, roles });
        }
    });

    return Array.from(map.values());
}

function renderBreadcrumbs() {
  breadcrumbContainer.innerHTML = '';
  const homeItem = document.createElement('span');
  homeItem.className = `breadcrumb-item ${state.path.length === 0 ? 'active' : ''}`;
  homeItem.innerHTML = `<i data-lucide="home"></i> <span>SLM</span>`;
  homeItem.addEventListener('click', () => {
    state.path = [];
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  breadcrumbContainer.appendChild(homeItem);

  state.path.forEach((val, idx) => {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.innerHTML = '<i data-lucide="chevron-right"></i>';
    breadcrumbContainer.appendChild(sep);

    const item = document.createElement('span');
    item.className = `breadcrumb-item ${idx === state.path.length - 1 ? 'active' : ''}`;
    item.innerHTML = `<span>${val}</span>`;
    item.addEventListener('click', () => {
        state.path = state.path.slice(0, idx + 1);
        render();
        
        setTimeout(() => {
          const target = document.querySelector(`.flow-level[data-level="${idx}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
    });
    breadcrumbContainer.appendChild(item);
  });
}

function renderTable(container, blockData) {
  const currentItem = state.path[state.path.length - 1];
  
  const header = document.createElement('h3');
  header.className = 'table-title';
  header.innerHTML = `<i data-lucide="table"></i> Details for ${currentItem}`;
  container.appendChild(header);

  const wrapper = document.createElement('div');
  wrapper.className = 'table-container';

  const headers = state.config.tableColumns;
  wrapper.innerHTML = `
    <table>
      <thead>
        <tr>
          <th class="sl-no">#</th>
          ${headers.map(h => `<th>${h.replace('_', ' ').toUpperCase()}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${blockData.map((row, idx) => `
          <tr>
            <td class="sl-no">${idx + 1}</td>
            ${headers.map(h => `<td>${row[h] || '-'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.appendChild(wrapper);
}

function refreshIcons() {
  createIcons({
    icons: { Home, ChevronRight, ChevronDown, Folder, FileType, LayoutGrid, LayoutList, Upload, Settings, X, GripVertical, User, MapPin, Table }
  });
}

function showErrorUI() {
  contentContainer.innerHTML = `<div class="error-msg">Failed to load API data. Please ensure slm_new_data.csv is present in the workspace.</div>`;
}

init();
