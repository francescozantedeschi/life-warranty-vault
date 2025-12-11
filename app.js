// Life Warranty Vault - Core Logic
class LifeWarrantyVault {
    constructor() {
        try {
            this.items = this.loadItems();
            this.customCategories = this.loadCustomCategories(); // Load custom categories
            this.editingItemId = null; // Track which item is being edited
            this.editingCategoryId = null; // Track which category is being edited
            this.init();
            this.logInfo('System', 'App inizializzata con successo');
        } catch (error) {
            console.error('Initialization error:', error);
            this.items = [];
            this.customCategories = [];
            this.showError('Errore di inizializzazione: ' + error.message);
        }
    }

    init() {
        this.setupEventListeners();
        this.updateCategorySelect(); // Initialize category select with custom categories
        this.renderDashboard();
        this.renderItems();
        this.setDefaultDate();
        this.setupGlobalErrorHandler();
    }

    // Custom Categories Management
    loadCustomCategories() {
        const stored = localStorage.getItem('customCategories');
        return stored ? JSON.parse(stored) : [];
    }

    saveCustomCategories() {
        localStorage.setItem('customCategories', JSON.stringify(this.customCategories));
        this.logInfo('Custom Categories', `${this.customCategories.length} categorie salvate`);
    }

    // Global Error Handler
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            this.logError('Global Error', {
                message: event.message,
                filename: event.filename,
                line: event.lineno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', event.reason);
        });
    }

    // Local Storage Management
    loadItems() {
        const stored = localStorage.getItem('vaultItems');
        if (!stored) return [];
        
        const items = JSON.parse(stored);
        
        // Migrate old data structure (receiptImage -> receiptDocuments array)
        return items.map(item => {
            // If item has old receiptImage but not receiptDocuments, migrate it
            if (item.receiptImage && !item.receiptDocuments) {
                item.receiptDocuments = [{
                    id: Date.now() + Math.random(),
                    type: 'image',
                    name: 'scontrino.jpg',
                    data: item.receiptImage,
                    addedAt: item.purchaseDate || new Date().toISOString()
                }];
                delete item.receiptImage; // Remove old field
            }
            
            // Ensure receiptDocuments exists
            if (!item.receiptDocuments) {
                item.receiptDocuments = [];
            }
            
            return item;
        });
    }

    saveItems() {
        localStorage.setItem('vaultItems', JSON.stringify(this.items));
    }

    // Event Listeners
    setupEventListeners() {
        // Modal Controls
        document.getElementById('addItemBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('closeDetailBtn').addEventListener('click', () => this.closeDetailModal());
        
        // Manage Categories
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => this.openManageCategoriesModal());
        document.getElementById('closeManageCategoriesBtn').addEventListener('click', () => this.closeManageCategoriesModal());

        // Category Select Change
        document.getElementById('category').addEventListener('change', (e) => {
            if (e.target.value === '__customize__') {
                this.showCustomCategoryInput();
            } else {
                this.hideCustomCategoryInput();
            }
        });

        // Photo Upload - Receipt Documents (multiple)
        document.getElementById('uploadReceiptBtn').addEventListener('click', () => {
            document.getElementById('receiptDocuments').click();
        });

        document.getElementById('receiptDocuments').addEventListener('change', (e) => {
            this.handleReceiptDocuments(e);
        });

        // Photo Upload - Product Image
        document.getElementById('uploadProductBtn').addEventListener('click', () => {
            document.getElementById('productPhoto').click();
        });

        document.getElementById('productPhoto').addEventListener('change', (e) => {
            this.handlePhotoUpload(e, 'productPhotoPreview');
        });

        // Form Submit
        document.getElementById('addItemForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItem();
        });

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterItems(e.target.dataset.filter);
            });
        });

        // Close modal on outside click (only on backdrop, not inside modal-content)
        document.getElementById('addModal').addEventListener('click', (e) => {
            if (e.target.id === 'addModal') {
                this.closeModal();
            }
        });

        document.getElementById('detailModal').addEventListener('click', (e) => {
            if (e.target.id === 'detailModal') {
                this.closeDetailModal();
            }
        });

        document.getElementById('manageCategoriesModal').addEventListener('click', (e) => {
            if (e.target.id === 'manageCategoriesModal') {
                this.closeManageCategoriesModal();
            }
        });

        // Prevent modal content clicks from closing modal
        document.querySelectorAll('.modal-content').forEach(content => {
            content.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('purchaseDate').value = today;
    }

    // Photo Handling
    handlePhotoUpload(event, previewId) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                this.showError('La foto è troppo grande. Massimo 5MB');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById(previewId);
                preview.innerHTML = `<img src="${e.target.result}" alt="Photo">`;
                preview.classList.add('active');
            };
            reader.readAsDataURL(file);
        }
    }

    // Handle multiple receipt documents (photos/PDFs)
    handleReceiptDocuments(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        // Initialize receiptDocuments array if not editing
        if (!this.tempReceiptDocuments) {
            this.tempReceiptDocuments = [];
        }

        // Check file sizes
        for (let file of files) {
            if (file.size > 10 * 1024 * 1024) {
                this.showError(`Il file ${file.name} è troppo grande. Massimo 10MB per file`);
                return;
            }
        }

        // Process files
        let processed = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const docData = {
                    id: Date.now() + Math.random(), // Unique ID
                    type: file.type.includes('pdf') ? 'pdf' : 'image',
                    name: file.name,
                    data: e.target.result,
                    addedAt: new Date().toISOString()
                };
                
                this.tempReceiptDocuments.push(docData);
                processed++;
                
                if (processed === files.length) {
                    this.renderReceiptDocumentsPreview();
                }
            };
            reader.onerror = () => {
                this.showError(`Errore nel caricamento di ${file.name}`);
            };
            reader.readAsDataURL(file);
        });
    }

    // Render receipt documents preview
    renderReceiptDocumentsPreview() {
        const container = document.getElementById('receiptDocumentsPreview');
        if (!this.tempReceiptDocuments || this.tempReceiptDocuments.length === 0) {
            container.innerHTML = '';
            container.classList.remove('active');
            return;
        }

        container.classList.add('active');
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: var(--vault-darker); border-radius: var(--radius-sm);">
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">
                        📎 ${this.tempReceiptDocuments.length} ${this.tempReceiptDocuments.length === 1 ? 'documento' : 'documenti'} caricato/i
                    </span>
                    <button type="button" onclick="vault.clearAllReceiptDocuments()" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--red-loss); color: var(--red-loss); border-radius: var(--radius-sm); cursor: pointer;">
                        🗑️ Rimuovi Tutti
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.5rem;">
                    ${this.tempReceiptDocuments.map((doc, index) => `
                        <div style="position: relative; aspect-ratio: 1; border-radius: var(--radius-sm); overflow: hidden; border: 2px solid var(--vault-border); background: var(--vault-darker);">
                            ${doc.type === 'pdf' ? `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 0.5rem; text-align: center;">
                                    <div style="font-size: 2rem;">📄</div>
                                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">PDF</div>
                                </div>
                            ` : `
                                <img src="${doc.data}" style="width: 100%; height: 100%; object-fit: cover;">
                            `}
                            <button type="button" onclick="vault.removeReceiptDocument(${index})" style="position: absolute; top: 0.25rem; right: 0.25rem; width: 20px; height: 20px; border-radius: 50%; background: var(--red-loss); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; padding: 0;">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Remove single receipt document
    removeReceiptDocument(index) {
        if (this.tempReceiptDocuments) {
            this.tempReceiptDocuments.splice(index, 1);
            this.renderReceiptDocumentsPreview();
        }
    }

    // Clear all receipt documents
    clearAllReceiptDocuments() {
        this.tempReceiptDocuments = [];
        this.renderReceiptDocumentsPreview();
        document.getElementById('receiptDocuments').value = '';
    }

    // Get purchase statistics by month/year
    getPurchaseStatistics() {
        const stats = {
            byMonth: {},
            byYear: {},
            byCategory: {},
            total: 0,
            count: 0
        };
        
        this.items.forEach(item => {
            const date = new Date(item.purchaseDate);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const yearKey = date.getFullYear().toString();
            const categoryKey = item.category;
            
            // By month
            if (!stats.byMonth[monthKey]) {
                stats.byMonth[monthKey] = { total: 0, count: 0, items: [] };
            }
            stats.byMonth[monthKey].total += item.price;
            stats.byMonth[monthKey].count += 1;
            stats.byMonth[monthKey].items.push(item);
            
            // By year
            if (!stats.byYear[yearKey]) {
                stats.byYear[yearKey] = { total: 0, count: 0, items: [] };
            }
            stats.byYear[yearKey].total += item.price;
            stats.byYear[yearKey].count += 1;
            stats.byYear[yearKey].items.push(item);
            
            // By category
            if (!stats.byCategory[categoryKey]) {
                stats.byCategory[categoryKey] = { total: 0, count: 0, items: [] };
            }
            stats.byCategory[categoryKey].total += item.price;
            stats.byCategory[categoryKey].count += 1;
            stats.byCategory[categoryKey].items.push(item);
            
            // Total
            stats.total += item.price;
            stats.count += 1;
        });
        
        return stats;
    }

    // Show detailed purchase statistics modal
    showPurchaseStatistics() {
        const stats = this.getPurchaseStatistics();
        
        // Get available years
        const availableYears = Object.keys(stats.byYear).sort().reverse();
        const currentYear = new Date().getFullYear().toString();
        const selectedYear = availableYears.includes(currentYear) ? currentYear : availableYears[0];
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'statsModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>📊 Dettaglio Spese</h2>
                    <button class="close-btn" onclick="document.getElementById('statsModal').remove()">&times;</button>
                </div>
                
                <div style="padding: 2rem;">
                    <!-- Summary -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Totale Speso</div>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.75rem; font-weight: 700; color: var(--gold-accent);">${this.formatCurrency(stats.total)}</div>
                        </div>
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Oggetti Totali</div>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.75rem; font-weight: 700; color: var(--blue-info);">${stats.count}</div>
                        </div>
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Spesa Media</div>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.75rem; font-weight: 700; color: var(--green-value);">${this.formatCurrency(stats.total / stats.count)}</div>
                        </div>
                    </div>
                    
                    <!-- Tabs and Year Selector -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid var(--vault-border);">
                        <div style="display: flex; gap: 1rem;">
                            <button onclick="vault.switchStatsTab('year')" id="statsTabYear" class="stats-tab active" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-primary); cursor: pointer; border-bottom: 2px solid var(--gold-accent); margin-bottom: -2px; font-weight: 600;">
                                Per Anno
                            </button>
                            <button onclick="vault.switchStatsTab('month')" id="statsTabMonth" class="stats-tab" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer; margin-bottom: -2px;">
                                Per Mese
                            </button>
                            <button onclick="vault.switchStatsTab('category')" id="statsTabCategory" class="stats-tab" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer; margin-bottom: -2px;">
                                Per Categoria
                            </button>
                        </div>
                        
                        <!-- Year selector (visible only in month tab) -->
                        <div id="yearSelector" style="display: none; align-items: center; gap: 0.5rem;">
                            <label style="color: var(--text-secondary); font-size: 0.875rem;">Anno:</label>
                            <select id="selectedYear" onchange="vault.switchStatsTab('month')" style="padding: 0.5rem 1rem; background: var(--vault-surface); border: 1px solid var(--vault-border); color: var(--text-primary); border-radius: var(--radius-sm); font-family: 'Sora', sans-serif; cursor: pointer;">
                                ${availableYears.map(year => `
                                    <option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div id="statsContent">
                        <!-- Will be filled by switchStatsTab -->
                    </div>
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
        
        // Store stats for tab switching
        this.currentStats = stats;
        this.selectedYear = selectedYear;
        
        // Show default tab (year)
        this.switchStatsTab('year');
    }

    // Generate spending chart (SVG)
    generateSpendingChart(data, type = 'month', year = null) {
        if (!data || Object.keys(data).length === 0) {
            return '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Nessun dato disponibile</div>';
        }

        let entries;
        
        // If it's a month chart, fill in all 12 months
        if (type === 'month' && year) {
            const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            entries = monthNames.map(month => {
                const key = `${year}-${month}`;
                return [key, data[key] || { total: 0, count: 0, items: [] }];
            });
        } else {
            entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
        }
        
        const maxValue = Math.max(...entries.map(([_, d]) => d.total), 100); // Min 100 for scale
        const chartHeight = 300;
        const chartWidth = Math.min(entries.length * 80, 1000);
        const barWidth = Math.max(30, Math.min(60, (chartWidth / entries.length) - 20));
        const padding = { top: 20, right: 20, bottom: 80, left: 60 };
        const innerHeight = chartHeight - padding.top - padding.bottom;
        const innerWidth = chartWidth - padding.left - padding.right;
        
        // Format labels based on type
        const formatLabel = (key) => {
            if (type === 'month') {
                const [year, month] = key.split('-');
                const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                return `${monthNames[parseInt(month) - 1]}`;
            } else if (type === 'year') {
                return key;
            } else {
                return this.getCategoryLabel(key);
            }
        };

        // Generate bars
        const bars = entries.map(([key, value], index) => {
            const barHeight = value.total > 0 ? (value.total / maxValue) * innerHeight : 2; // Min 2px for empty months
            const x = padding.left + (index * (innerWidth / entries.length)) + (innerWidth / entries.length - barWidth) / 2;
            const y = padding.top + (innerHeight - barHeight);
            
            const isEmpty = value.total === 0;
            const barClass = isEmpty ? 'bar-empty' : 'bar-filled';
            
            return `
                <g class="bar-group ${barClass}" data-key="${key}" data-hasdata="${!isEmpty}" style="cursor: ${isEmpty ? 'default' : 'pointer'};">
                    <!-- Bar background (hover effect) -->
                    <rect 
                        x="${x - 2}" 
                        y="${padding.top}" 
                        width="${barWidth + 4}" 
                        height="${innerHeight}" 
                        fill="transparent"
                        class="bar-hover-area"
                    />
                    
                    <!-- Main bar -->
                    <rect 
                        x="${x}" 
                        y="${y}" 
                        width="${barWidth}" 
                        height="${barHeight}" 
                        rx="4"
                        fill="${isEmpty ? 'url(#barGradientEmpty)' : 'url(#barGradient)'}"
                        class="bar-main"
                        style="transition: all 0.3s ease;"
                    />
                    
                    <!-- Value label on top (only if not empty) -->
                    ${!isEmpty ? `
                        <text 
                            x="${x + barWidth / 2}" 
                            y="${y - 8}" 
                            text-anchor="middle" 
                            fill="var(--gold-accent)" 
                            font-size="11" 
                            font-weight="600"
                            font-family="'JetBrains Mono', monospace"
                            class="bar-value"
                        >
                            ${this.formatCurrency(value.total, true)}
                        </text>
                    ` : ''}
                    
                    <!-- Month label -->
                    <text 
                        x="${x + barWidth / 2}" 
                        y="${padding.top + innerHeight + 20}" 
                        text-anchor="middle" 
                        fill="${isEmpty ? 'var(--text-muted)' : 'var(--text-secondary)'}" 
                        font-size="13" 
                        font-weight="${isEmpty ? '400' : '600'}"
                    >
                        ${formatLabel(key)}
                    </text>
                    
                    <!-- Count label (only if not empty) -->
                    ${!isEmpty ? `
                        <text 
                            x="${x + barWidth / 2}" 
                            y="${padding.top + innerHeight + 38}" 
                            text-anchor="middle" 
                            fill="var(--text-muted)" 
                            font-size="10"
                        >
                            ${value.count} ${value.count === 1 ? 'item' : 'items'}
                        </text>
                    ` : `
                        <text 
                            x="${x + barWidth / 2}" 
                            y="${padding.top + innerHeight + 38}" 
                            text-anchor="middle" 
                            fill="var(--text-muted)" 
                            font-size="9"
                            opacity="0.5"
                        >
                            nessuna spesa
                        </text>
                    `}
                </g>
            `;
        }).join('');

        // Y-axis labels
        const yAxisSteps = 5;
        const yAxisLabels = Array.from({ length: yAxisSteps + 1 }, (_, i) => {
            const value = (maxValue / yAxisSteps) * i;
            const y = padding.top + innerHeight - (i * innerHeight / yAxisSteps);
            return `
                <text 
                    x="${padding.left - 10}" 
                    y="${y + 4}" 
                    text-anchor="end" 
                    fill="var(--text-muted)" 
                    font-size="11"
                    font-family="'JetBrains Mono', monospace"
                >
                    ${this.formatCurrency(value, true)}
                </text>
                <line 
                    x1="${padding.left}" 
                    y1="${y}" 
                    x2="${padding.left + innerWidth}" 
                    y2="${y}" 
                    stroke="var(--vault-border)" 
                    stroke-width="1" 
                    opacity="0.3"
                />
            `;
        }).join('');

        return `
            <div style="width: 100%; overflow-x: auto; overflow-y: visible;">
                <svg width="${chartWidth}" height="${chartHeight + 20}" style="display: block; margin: 0 auto;">
                    <defs>
                        <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color: var(--gold-accent); stop-opacity: 1" />
                            <stop offset="100%" style="stop-color: var(--gold-accent); stop-opacity: 0.6" />
                        </linearGradient>
                        <linearGradient id="barGradientEmpty" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color: var(--vault-border); stop-opacity: 0.3" />
                            <stop offset="100%" style="stop-color: var(--vault-border); stop-opacity: 0.1" />
                        </linearGradient>
                    </defs>
                    
                    <!-- Grid lines and Y-axis -->
                    ${yAxisLabels}
                    
                    <!-- X-axis -->
                    <line 
                        x1="${padding.left}" 
                        y1="${padding.top + innerHeight}" 
                        x2="${padding.left + innerWidth}" 
                        y2="${padding.top + innerHeight}" 
                        stroke="var(--text-muted)" 
                        stroke-width="2"
                    />
                    
                    <!-- Y-axis -->
                    <line 
                        x1="${padding.left}" 
                        y1="${padding.top}" 
                        x2="${padding.left}" 
                        y2="${padding.top + innerHeight}" 
                        stroke="var(--text-muted)" 
                        stroke-width="2"
                    />
                    
                    <!-- Bars -->
                    ${bars}
                </svg>
            </div>
            
            <style>
                .bar-group.bar-filled:hover .bar-main {
                    filter: brightness(1.2);
                    transform: translateY(-2px);
                }
                
                .bar-group.bar-filled:hover .bar-value {
                    font-size: 13px;
                    font-weight: 700;
                }
                
                .bar-group.bar-empty {
                    opacity: 0.5;
                }
            </style>
            
            <script>
                document.querySelectorAll('.bar-group').forEach(bar => {
                    const hasData = bar.getAttribute('data-hasdata') === 'true';
                    if (hasData) {
                        bar.addEventListener('click', function() {
                            const key = this.getAttribute('data-key');
                            vault.showMonthDetail(key);
                        });
                    }
                });
            </script>
        `;
    }

    // Format currency with optional short format
    formatCurrency(amount, short = false) {
        if (short && amount >= 1000) {
            return `€${(amount / 1000).toFixed(1)}k`;
        }
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Show month detail when clicking on bar
    showMonthDetail(monthKey) {
        const stats = this.currentStats;
        const monthData = stats.byMonth[monthKey];
        
        if (!monthData) return;
        
        const [year, monthNum] = monthKey.split('-');
        const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        const monthName = monthNames[parseInt(monthNum) - 1];
        
        // Close stats modal and show month detail
        const statsModal = document.getElementById('statsModal');
        if (statsModal) statsModal.remove();
        
        // Create month detail modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'monthDetailModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2>📅 ${monthName} ${year}</h2>
                    <button class="close-btn" onclick="document.getElementById('monthDetailModal').remove(); vault.showPurchaseStatistics();">&times;</button>
                </div>
                
                <div style="padding: 2rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Spesa Totale</div>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--gold-accent);">${this.formatCurrency(monthData.total)}</div>
                        </div>
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Acquisti</div>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--blue-info);">${monthData.count}</div>
                        </div>
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Spesa Media</div>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--green-value);">${this.formatCurrency(monthData.total / monthData.count)}</div>
                        </div>
                    </div>
                    
                    <h3 style="color: var(--gold-accent); margin-bottom: 1rem;">Acquisti del Mese</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto;">
                        ${monthData.items.map(item => `
                            <div onclick="document.getElementById('monthDetailModal').remove(); vault.showItemDetail('${item.id}');" style="background: var(--vault-darker); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--vault-border); cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${item.name}</div>
                                        <div style="font-size: 0.875rem; color: var(--text-muted);">${this.getCategoryLabel(item.category)} • ${this.formatDate(item.purchaseDate)}</div>
                                    </div>
                                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; font-weight: 700; color: var(--gold-accent);">${this.formatCurrency(item.price)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                this.showPurchaseStatistics();
            }
        });
        
        document.body.appendChild(modal);
    }
    // Switch statistics tab
    switchStatsTab(tab) {
        // Update active tab
        document.querySelectorAll('.stats-tab').forEach(btn => {
            btn.style.borderBottom = 'none';
            btn.style.fontWeight = '400';
            btn.style.color = 'var(--text-secondary)';
        });
        const activeTab = document.getElementById(`statsTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        if (activeTab) {
            activeTab.style.borderBottom = '2px solid var(--gold-accent)';
            activeTab.style.fontWeight = '600';
            activeTab.style.color = 'var(--text-primary)';
            activeTab.style.marginBottom = '-2px';
        }
        
        // Show/hide year selector
        const yearSelector = document.getElementById('yearSelector');
        if (yearSelector) {
            yearSelector.style.display = tab === 'month' ? 'flex' : 'none';
        }
        
        const stats = this.currentStats;
        const content = document.getElementById('statsContent');
        
        if (tab === 'year') {
            const sortedYears = Object.keys(stats.byYear).sort().reverse();
            const chartHtml = this.generateSpendingChart(stats.byYear, 'year');
            content.innerHTML = `
                <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem; border: 1px solid var(--vault-border);">
                    <h3 style="color: var(--gold-accent); margin-bottom: 1.5rem;">📊 Grafico Spese per Anno</h3>
                    ${chartHtml}
                </div>
                <h3 style="color: var(--gold-accent); margin-bottom: 1rem;">Dettaglio per Anno</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto;">
                    ${sortedYears.map(year => `
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--vault-border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <div>
                                    <h3 style="color: var(--gold-accent); margin: 0; font-size: 1.25rem;">📅 ${year}</h3>
                                    <div style="color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem;">${stats.byYear[year].count} acquisti</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--gold-accent);">${this.formatCurrency(stats.byYear[year].total)}</div>
                                    <div style="color: var(--text-muted); font-size: 0.875rem;">Media: ${this.formatCurrency(stats.byYear[year].total / stats.byYear[year].count)}</div>
                                </div>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${stats.byYear[year].items.slice(0, 5).map(item => `
                                    <div onclick="vault.showItemDetail('${item.id}'); document.getElementById('statsModal').remove();" style="padding: 0.5rem 0.75rem; background: var(--vault-surface); border-radius: var(--radius-sm); font-size: 0.875rem; cursor: pointer; border: 1px solid var(--vault-border);">
                                        ${item.name} - ${this.formatCurrency(item.price)}
                                    </div>
                                `).join('')}
                                ${stats.byYear[year].items.length > 5 ? `
                                    <div style="padding: 0.5rem 0.75rem; background: var(--vault-surface); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-muted);">
                                        +${stats.byYear[year].items.length - 5} altri
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (tab === 'month') {
            // Get selected year from dropdown
            const selectedYearElement = document.getElementById('selectedYear');
            const selectedYear = selectedYearElement ? selectedYearElement.value : (new Date().getFullYear().toString());
            
            // Filter months for selected year
            const yearMonthsData = {};
            Object.keys(stats.byMonth).forEach(monthKey => {
                if (monthKey.startsWith(selectedYear + '-')) {
                    yearMonthsData[monthKey] = stats.byMonth[monthKey];
                }
            });
            
            // Generate chart with all 12 months for selected year
            const chartHtml = this.generateSpendingChart(yearMonthsData, 'month', selectedYear);
            
            // Get all months for the list (sorted)
            const sortedMonths = Object.keys(stats.byMonth).filter(m => m.startsWith(selectedYear + '-')).sort().reverse();
            
            content.innerHTML = `
                <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem; border: 1px solid var(--vault-border);">
                    <h3 style="color: var(--gold-accent); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        📊 Grafico Spese ${selectedYear}
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">(Tutti i 12 mesi - Click su barra per dettagli)</span>
                    </h3>
                    ${chartHtml}
                </div>
                ${sortedMonths.length > 0 ? `
                    <h3 style="color: var(--gold-accent); margin-bottom: 1rem;">Mesi con Acquisti in ${selectedYear}</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto;">
                        ${sortedMonths.map(month => {
                            const [year, monthNum] = month.split('-');
                            const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                            const monthName = monthNames[parseInt(monthNum) - 1];
                            
                            return `
                                <div onclick="vault.showMonthDetail('${month}')" style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--vault-border); cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                        <div>
                                            <h3 style="color: var(--gold-accent); margin: 0; font-size: 1.25rem;">📅 ${monthName} ${year}</h3>
                                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem;">${stats.byMonth[month].count} acquisti</div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--gold-accent);">${this.formatCurrency(stats.byMonth[month].total)}</div>
                                            <div style="color: var(--text-muted); font-size: 0.875rem;">Media: ${this.formatCurrency(stats.byMonth[month].total / stats.byMonth[month].count)}</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                        ${stats.byMonth[month].items.slice(0, 3).map(item => `
                                            <div onclick="event.stopPropagation(); vault.showItemDetail('${item.id}'); document.getElementById('statsModal').remove();" style="padding: 0.5rem 0.75rem; background: var(--vault-surface); border-radius: var(--radius-sm); font-size: 0.875rem; cursor: pointer; border: 1px solid var(--vault-border);">
                                                ${item.name} - ${this.formatCurrency(item.price)}
                                            </div>
                                        `).join('')}
                                        ${stats.byMonth[month].items.length > 3 ? `
                                            <div style="padding: 0.5rem 0.75rem; background: var(--vault-surface); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-muted);">
                                                +${stats.byMonth[month].items.length - 3} altri
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--vault-border); text-align: center; color: var(--gold-accent); font-size: 0.875rem;">
                                        👆 Clicca per vedere tutti gli acquisti
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        Nessun acquisto nel ${selectedYear}
                    </div>
                `}
            `;
        } else if (tab === 'category') {
            const chartHtml = this.generateSpendingChart(stats.byCategory, 'category');
            content.innerHTML = `
                <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem; border: 1px solid var(--vault-border);">
                    <h3 style="color: var(--gold-accent); margin-bottom: 1.5rem;">📊 Grafico Spese per Categoria</h3>
                    ${chartHtml}
                </div>
                <h3 style="color: var(--gold-accent); margin-bottom: 1rem;">Dettaglio per Categoria</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto;">
                    ${Object.keys(stats.byCategory).map(categoryKey => `
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--vault-border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <div>
                                    <h3 style="color: var(--gold-accent); margin: 0; font-size: 1.25rem;">${this.getCategoryLabel(categoryKey)}</h3>
                                    <div style="color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem;">${stats.byCategory[categoryKey].count} oggetti</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--gold-accent);">${this.formatCurrency(stats.byCategory[categoryKey].total)}</div>
                                    <div style="color: var(--text-muted); font-size: 0.875rem;">Media: ${this.formatCurrency(stats.byCategory[categoryKey].total / stats.byCategory[categoryKey].count)}</div>
                                </div>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${stats.byCategory[categoryKey].items.slice(0, 5).map(item => `
                                    <div onclick="vault.showItemDetail('${item.id}'); document.getElementById('statsModal').remove();" style="padding: 0.5rem 0.75rem; background: var(--vault-surface); border-radius: var(--radius-sm); font-size: 0.875rem; cursor: pointer; border: 1px solid var(--vault-border);">
                                        ${item.name} - ${this.formatCurrency(item.price)}
                                    </div>
                                `).join('')}
                                ${stats.byCategory[categoryKey].items.length > 5 ? `
                                    <div style="padding: 0.5rem 0.75rem; background: var(--vault-surface); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-muted);">
                                        +${stats.byCategory[categoryKey].items.length - 5} altri
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    // Download receipt documents (all as ZIP would be complex, so download one by one)
    downloadReceipt(itemId, docIndex = null) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || !item.receiptDocuments || item.receiptDocuments.length === 0) {
            this.showError('Nessuno scontrino disponibile');
            return;
        }

        try {
            if (docIndex !== null) {
                // Download specific document
                const doc = item.receiptDocuments[docIndex];
                const link = document.createElement('a');
                link.href = doc.data;
                const ext = doc.type === 'pdf' ? 'pdf' : 'jpg';
                link.download = `scontrino_${item.name.replace(/\s+/g, '_')}_${docIndex + 1}.${ext}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showNotification('✅ Documento salvato!');
            } else {
                // Download all documents
                item.receiptDocuments.forEach((doc, idx) => {
                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = doc.data;
                        const ext = doc.type === 'pdf' ? 'pdf' : 'jpg';
                        link.download = `scontrino_${item.name.replace(/\s+/g, '_')}_${idx + 1}.${ext}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }, idx * 500); // Stagger downloads
                });
                this.showNotification(`✅ Download di ${item.receiptDocuments.length} documenti avviato!`);
            }
        } catch (error) {
            this.showError('Errore nel salvataggio: ' + error.message);
            this.logError('Download receipt', error);
        }
    }

    // Delete single receipt document from item
    deleteReceiptDocument(itemId, docIndex) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || !item.receiptDocuments) return;

        if (confirm('Sei sicuro di voler eliminare questo documento?')) {
            item.receiptDocuments.splice(docIndex, 1);
            this.saveItems();
            this.showItemDetail(itemId); // Refresh detail view
            this.showNotification('🗑️ Documento eliminato');
        }
    }

    // View receipt documents in gallery/fullscreen
    viewReceiptFullscreen(itemId, startIndex = 0) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || !item.receiptDocuments || item.receiptDocuments.length === 0) {
            this.showError('Nessuno scontrino disponibile');
            return;
        }

        let currentIndex = startIndex;

        const updateViewer = () => {
            const doc = item.receiptDocuments[currentIndex];
            const viewer = document.getElementById('receiptViewer');
            
            const contentHtml = doc.type === 'pdf' 
                ? `<iframe src="${doc.data}" style="width: 100%; height: 80vh; border: none; border-radius: var(--radius-md); background: white;"></iframe>`
                : `<img src="${doc.data}" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: var(--radius-md);">`;

            viewer.innerHTML = `
                <div style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%; max-width: 1200px;">
                    ${item.receiptDocuments.length > 1 ? `
                        <div style="display: flex; gap: 1rem; align-items: center; color: white; margin-bottom: 0.5rem;">
                            <button onclick="vault.navigateReceipt('prev')" ${currentIndex === 0 ? 'disabled' : ''} 
                                style="padding: 0.5rem 1rem; background: var(--vault-surface); border: 1px solid var(--gold-accent); color: var(--gold-accent); border-radius: var(--radius-sm); cursor: pointer; font-size: 1.2rem;" 
                                ${currentIndex === 0 ? 'style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                                ◀
                            </button>
                            <span style="font-size: 1rem; min-width: 100px; text-align: center;">
                                ${currentIndex + 1} / ${item.receiptDocuments.length}
                            </span>
                            <button onclick="vault.navigateReceipt('next')" ${currentIndex === item.receiptDocuments.length - 1 ? 'disabled' : ''} 
                                style="padding: 0.5rem 1rem; background: var(--vault-surface); border: 1px solid var(--gold-accent); color: var(--gold-accent); border-radius: var(--radius-sm); cursor: pointer; font-size: 1.2rem;"
                                ${currentIndex === item.receiptDocuments.length - 1 ? 'style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                                ▶
                            </button>
                        </div>
                    ` : ''}
                    
                    ${contentHtml}
                    
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">
                        <button class="btn-primary" onclick="vault.downloadReceipt('${itemId}', ${currentIndex})">
                            💾 Salva Questo
                        </button>
                        ${item.receiptDocuments.length > 1 ? `
                            <button class="btn-primary" onclick="vault.downloadReceipt('${itemId}')">
                                📦 Salva Tutti (${item.receiptDocuments.length})
                            </button>
                        ` : ''}
                        <button class="btn-secondary" onclick="document.getElementById('receiptViewerModal').remove()">
                            ✕ Chiudi
                        </button>
                    </div>
                </div>
            `;
        };

        // Create viewer modal
        const existingViewer = document.getElementById('receiptViewerModal');
        if (existingViewer) existingViewer.remove();

        const viewer = document.createElement('div');
        viewer.id = 'receiptViewerModal';
        viewer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            overflow-y: auto;
        `;

        viewer.innerHTML = `<div id="receiptViewer"></div>`;

        viewer.addEventListener('click', (e) => {
            if (e.target === viewer) {
                viewer.remove();
            }
        });

        document.body.appendChild(viewer);
        
        // Store navigation function
        this.currentReceiptIndex = currentIndex;
        this.currentReceiptItemId = itemId;
        
        updateViewer();
        
        // Update viewer function
        this.updateReceiptViewer = updateViewer;
    }

    // Navigate between receipt documents
    navigateReceipt(direction) {
        const item = this.items.find(i => i.id === this.currentReceiptItemId);
        if (!item) return;

        if (direction === 'next' && this.currentReceiptIndex < item.receiptDocuments.length - 1) {
            this.currentReceiptIndex++;
        } else if (direction === 'prev' && this.currentReceiptIndex > 0) {
            this.currentReceiptIndex--;
        }

        if (this.updateReceiptViewer) {
            this.updateReceiptViewer();
        }
    }

    // Calculate if it's a good time to sell
    shouldSellNow(item) {
        const currentValue = this.calculateDepreciation(item.price, item.purchaseDate, item.category);
        const valuePercent = (currentValue / item.price) * 100;
        const now = new Date();
        const purchase = new Date(item.purchaseDate);
        const monthsOwned = (now - purchase) / (1000 * 60 * 60 * 24 * 30);
        
        // Get depreciation curve
        let depreciationCurve = item.category;
        if (item.category.startsWith('custom_')) {
            const customCat = this.customCategories.find(cat => cat.id === item.category);
            if (customCat && customCat.depreciationCurve) {
                depreciationCurve = customCat.depreciationCurve;
            } else {
                depreciationCurve = 'generic';
            }
        }
        
        let shouldSell = false;
        let reason = '';
        let urgency = 'low'; // low, medium, high
        
        switch(depreciationCurve) {
            case 'electronics':
                // Electronics: Sweet spot is 12-18 months, value 50-65%
                if (monthsOwned >= 12 && monthsOwned <= 24 && valuePercent >= 45 && valuePercent <= 70) {
                    shouldSell = true;
                    urgency = monthsOwned >= 18 ? 'high' : 'medium';
                    reason = `Ha ${monthsOwned.toFixed(0)} mesi e vale ancora il ${valuePercent.toFixed(0)}%. È il momento ideale per vendere prima che perda più valore!`;
                } else if (monthsOwned > 24 && valuePercent > 40) {
                    shouldSell = true;
                    urgency = 'medium';
                    reason = `Vale ancora il ${valuePercent.toFixed(0)}% ma sta perdendo valore velocemente. Considera la vendita.`;
                }
                break;
                
            case 'appliances':
                // Appliances: Less urgent, sweet spot 24-36 months if value > 60%
                if (monthsOwned >= 24 && monthsOwned <= 48 && valuePercent >= 55 && valuePercent <= 75) {
                    shouldSell = true;
                    urgency = 'low';
                    reason = `Vale ancora il ${valuePercent.toFixed(0)}%. Se pensi di sostituirlo, questo è un buon momento.`;
                }
                break;
                
            case 'vehicles':
                // Vehicles: Sweet spot 18-30 months if value > 55%
                if (monthsOwned >= 18 && monthsOwned <= 36 && valuePercent >= 50 && valuePercent <= 70) {
                    shouldSell = true;
                    urgency = monthsOwned >= 24 ? 'medium' : 'low';
                    reason = `Ha ${monthsOwned.toFixed(0)} mesi e vale il ${valuePercent.toFixed(0)}%. Buon momento per la vendita.`;
                }
                break;
                
            case 'generic':
                // Generic: Sweet spot when value is 50-70% and owned 12-24 months
                if (monthsOwned >= 12 && monthsOwned <= 30 && valuePercent >= 45 && valuePercent <= 70) {
                    shouldSell = true;
                    urgency = 'low';
                    reason = `Vale il ${valuePercent.toFixed(0)}% del prezzo originale. Considera la vendita se vuoi sostituirlo.`;
                }
                break;
        }
        
        return { shouldSell, reason, urgency, valuePercent: valuePercent.toFixed(0), monthsOwned: monthsOwned.toFixed(0) };
    }

    // Get items that should be sold
    getItemsToSell() {
        return this.items.map(item => {
            const sellAnalysis = this.shouldSellNow(item);
            return { ...item, sellAnalysis };
        }).filter(item => item.sellAnalysis.shouldSell);
    }
    calculateDepreciation(purchasePrice, purchaseDate, category) {
        const now = new Date();
        const purchase = new Date(purchaseDate);
        const monthsOwned = (now - purchase) / (1000 * 60 * 60 * 24 * 30);
        const yearsOwned = monthsOwned / 12;

        // Check if it's a custom category and get its depreciation curve
        let depreciationCurve = category;
        if (category.startsWith('custom_')) {
            const customCat = this.customCategories.find(cat => cat.id === category);
            if (customCat && customCat.depreciationCurve) {
                depreciationCurve = customCat.depreciationCurve;
            } else {
                depreciationCurve = 'generic';
            }
        }
        
        switch(depreciationCurve) {
            case 'electronics':
                // Tech: -25% immediately, then -15% per year
                if (monthsOwned < 1) {
                    return purchasePrice * 0.75; // Initial drop
                }
                return purchasePrice * 0.75 * Math.pow(0.85, yearsOwned);
                
            case 'appliances':
                // Appliances: -20% immediately, then -5% per year
                if (monthsOwned < 1) {
                    return purchasePrice * 0.80;
                }
                return purchasePrice * 0.80 * Math.pow(0.95, yearsOwned);
                
            case 'vehicles':
                // Vehicles: -15% immediately, then -10% per year
                if (monthsOwned < 1) {
                    return purchasePrice * 0.85;
                }
                return purchasePrice * 0.85 * Math.pow(0.90, yearsOwned);
            
            case 'none':
                // No depreciation: maintains value (for jewelry, art, collectibles)
                return purchasePrice;
                
            case 'generic':
            default:
                // Generic/Other: -15% immediately, then -8% per year
                if (monthsOwned < 1) {
                    return purchasePrice * 0.85;
                }
                return purchasePrice * 0.85 * Math.pow(0.92, yearsOwned);
        }
    }

    // Warranty Calculation
    calculateWarrantyStatus(purchaseDate, warrantyMonths) {
        const purchase = new Date(purchaseDate);
        const expiryDate = new Date(purchase);
        expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);
        
        const now = new Date();
        const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        return {
            expiryDate: expiryDate,
            daysRemaining: daysRemaining,
            isExpiring: daysRemaining <= 30 && daysRemaining > 0,
            isExpired: daysRemaining <= 0,
            isActive: daysRemaining > 30
        };
    }

    // Add or Update Item
    addItem() {
        const form = document.getElementById('addItemForm');
        
        // Clear previous errors
        this.clearFormErrors();
        
        // Validate form
        const errors = this.validateForm();
        if (errors.length > 0) {
            this.showFormErrors(errors);
            return;
        }

        const productPhotoInput = document.getElementById('productPhoto');
        
        try {
            const itemData = {
                name: document.getElementById('itemName').value.trim(),
                category: document.getElementById('category').value,
                purchaseDate: document.getElementById('purchaseDate').value,
                price: parseFloat(document.getElementById('price').value),
                warrantyMonths: parseInt(document.getElementById('warrantyMonths').value),
                condition: document.getElementById('condition').value,
            };

            // Check if we're editing or creating
            if (this.editingItemId) {
                // EDITING existing item
                const itemIndex = this.items.findIndex(item => item.id === this.editingItemId);
                if (itemIndex !== -1) {
                    // Keep the existing ID and data
                    itemData.id = this.editingItemId;
                    itemData.receiptDocuments = this.items[itemIndex].receiptDocuments || [];
                    itemData.productImage = this.items[itemIndex].productImage;
                    
                    // Update receipt documents if new ones were added
                    if (this.tempReceiptDocuments && this.tempReceiptDocuments.length > 0) {
                        itemData.receiptDocuments = [...itemData.receiptDocuments, ...this.tempReceiptDocuments];
                    }
                    
                    // Handle product photo
                    if (productPhotoInput.files[0]) {
                        const file = productPhotoInput.files[0];
                        
                        if (file.size > 5 * 1024 * 1024) {
                            this.showError('La foto prodotto è troppo grande. Massimo 5MB');
                            return;
                        }
                        
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            itemData.productImage = e.target.result;
                            this.updateItemInStorage(itemIndex, itemData);
                            this.tempReceiptDocuments = null;
                        };
                        reader.onerror = (e) => {
                            this.showError('Errore nel caricamento della foto');
                            this.logError('FileReader error', e);
                        };
                        reader.readAsDataURL(file);
                    } else {
                        // No new product photo
                        this.updateItemInStorage(itemIndex, itemData);
                        this.tempReceiptDocuments = null;
                    }
                }
            } else {
                // CREATING new item
                itemData.id = Date.now().toString();
                itemData.receiptDocuments = this.tempReceiptDocuments || [];
                itemData.productImage = null;
                
                // Handle product photo
                if (productPhotoInput.files[0]) {
                    const file = productPhotoInput.files[0];
                    
                    if (file.size > 5 * 1024 * 1024) {
                        this.showError('La foto prodotto è troppo grande. Massimo 5MB');
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        itemData.productImage = e.target.result;
                        this.saveNewItemToStorage(itemData);
                        this.tempReceiptDocuments = null;
                    };
                    reader.onerror = (e) => {
                        this.showError('Errore nel caricamento della foto');
                        this.logError('FileReader error', e);
                    };
                    reader.readAsDataURL(file);
                } else {
                    this.saveNewItemToStorage(itemData);
                    this.tempReceiptDocuments = null;
                }
            }
        } catch (error) {
            this.showError('Errore nel salvataggio: ' + error.message);
            this.logError('Add/Update item error', error);
        }
    }

    // Validate Form
    validateForm() {
        const errors = [];
        
        const name = document.getElementById('itemName').value.trim();
        if (!name) {
            errors.push({ field: 'itemName', message: 'Il nome è obbligatorio' });
        } else if (name.length < 2) {
            errors.push({ field: 'itemName', message: 'Il nome deve avere almeno 2 caratteri' });
        }
        
        const category = document.getElementById('category').value;
        if (!category) {
            errors.push({ field: 'category', message: 'Seleziona una categoria' });
        }
        
        const date = document.getElementById('purchaseDate').value;
        if (!date) {
            errors.push({ field: 'purchaseDate', message: 'La data è obbligatoria' });
        } else {
            const purchaseDate = new Date(date);
            const today = new Date();
            if (purchaseDate > today) {
                errors.push({ field: 'purchaseDate', message: 'La data non può essere nel futuro' });
            }
            const tooOld = new Date();
            tooOld.setFullYear(tooOld.getFullYear() - 50);
            if (purchaseDate < tooOld) {
                errors.push({ field: 'purchaseDate', message: 'La data sembra troppo vecchia' });
            }
        }
        
        const price = document.getElementById('price').value;
        if (!price || price <= 0) {
            errors.push({ field: 'price', message: 'Il prezzo deve essere maggiore di 0' });
        } else if (price > 1000000) {
            errors.push({ field: 'price', message: 'Il prezzo sembra troppo alto. Controlla!' });
        }
        
        const warranty = document.getElementById('warrantyMonths').value;
        if (!warranty || warranty < 0) {
            errors.push({ field: 'warrantyMonths', message: 'La garanzia deve essere 0 o più mesi' });
        } else if (warranty > 120) {
            errors.push({ field: 'warrantyMonths', message: 'La garanzia sembra troppo lunga (max 10 anni)' });
        }
        
        return errors;
    }

    // Show Form Errors
    showFormErrors(errors) {
        // Remove existing error container
        const existingError = document.querySelector('.form-error-summary');
        if (existingError) existingError.remove();
        
        // Create error summary
        const errorContainer = document.createElement('div');
        errorContainer.className = 'form-error-summary';
        errorContainer.innerHTML = `
            <div class="error-header">
                <span class="error-icon">⚠️</span>
                <strong>Correggi i seguenti errori:</strong>
            </div>
            <ul class="error-list">
                ${errors.map(err => `<li>${err.message}</li>`).join('')}
            </ul>
        `;
        
        const form = document.getElementById('addItemForm');
        form.insertBefore(errorContainer, form.firstChild);
        
        // Highlight error fields
        errors.forEach(err => {
            const field = document.getElementById(err.field);
            if (field) {
                field.classList.add('error');
                
                // Create inline error message
                const errorMsg = document.createElement('div');
                errorMsg.className = 'field-error-message';
                errorMsg.textContent = err.message;
                
                const formGroup = field.closest('.form-group');
                if (formGroup && !formGroup.querySelector('.field-error-message')) {
                    formGroup.appendChild(errorMsg);
                }
                
                // Remove error on input
                field.addEventListener('input', function clearError() {
                    field.classList.remove('error');
                    const msg = field.closest('.form-group')?.querySelector('.field-error-message');
                    if (msg) msg.remove();
                    field.removeEventListener('input', clearError);
                }, { once: true });
            }
        });
        
        // Scroll to errors
        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Clear Form Errors
    clearFormErrors() {
        document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        document.querySelectorAll('.field-error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-error-summary').forEach(el => el.remove());
    }

    saveItemToStorage(item) {
        try {
            this.items.push(item);
            this.saveItems();
            this.closeModal();
            this.renderDashboard();
            this.renderItems();
            this.showNotification('✅ Oggetto aggiunto con successo!');
            this.logInfo('Item added', `${item.name} - €${item.price}`);
        } catch (error) {
            this.showError('Errore nel salvataggio: ' + error.message);
            this.logError('Save item to storage', error);
        }
    }

    saveNewItemToStorage(item) {
        try {
            this.items.push(item);
            this.saveItems();
            this.editingItemId = null;
            this.closeModal();
            this.renderDashboard();
            this.renderItems();
            this.showNotification('✅ Oggetto aggiunto con successo!');
            this.logInfo('Item added', `${item.name} - €${item.price}`);
        } catch (error) {
            this.showError('Errore nel salvataggio: ' + error.message);
            this.logError('Save new item to storage', error);
        }
    }

    updateItemInStorage(itemIndex, itemData) {
        try {
            this.items[itemIndex] = itemData;
            this.saveItems();
            this.editingItemId = null;
            this.closeModal();
            this.renderDashboard();
            this.renderItems();
            this.showNotification('✅ Oggetto aggiornato con successo!');
            this.logInfo('Item updated', `${itemData.name} - €${itemData.price}`);
        } catch (error) {
            this.showError('Errore nell\'aggiornamento: ' + error.message);
            this.logError('Update item in storage', error);
        }
    }

    // Delete Item
    deleteItem(id) {
        if (confirm('Sei sicuro di voler eliminare questo oggetto?')) {
            this.items = this.items.filter(item => item.id !== id);
            this.saveItems();
            this.renderDashboard();
            this.renderItems();
            this.closeDetailModal();
            this.showNotification('🗑️ Oggetto eliminato');
        }
    }

    // Edit Item
    editItem(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) {
            this.showError('Oggetto non trovato');
            return;
        }

        try {
            // Set editing mode
            this.editingItemId = id;
            
            // Initialize temp documents with existing ones
            this.tempReceiptDocuments = item.receiptDocuments ? [...item.receiptDocuments] : [];
            
            // Close detail modal
            this.closeDetailModal();
            
            // Open add modal with different title
            const modal = document.getElementById('addModal');
            const modalTitle = modal.querySelector('.modal-header h2');
            const submitBtn = modal.querySelector('button[type="submit"]');
            
            modalTitle.textContent = 'Modifica Oggetto';
            submitBtn.innerHTML = '💾 Aggiorna Oggetto';
            
            // Populate form with item data
            document.getElementById('itemName').value = item.name;
            document.getElementById('category').value = item.category;
            document.getElementById('purchaseDate').value = item.purchaseDate;
            document.getElementById('price').value = item.price;
            document.getElementById('warrantyMonths').value = item.warrantyMonths;
            document.getElementById('condition').value = item.condition;
            
            // Show existing receipt documents
            this.renderReceiptDocumentsPreview();
            
            // Show existing product photo if available
            const productPhotoPreview = document.getElementById('productPhotoPreview');
            if (item.productImage) {
                productPhotoPreview.innerHTML = `
                    <img src="${item.productImage}" alt="Product">
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">
                        📷 Foto esistente (carica una nuova per sostituirla)
                    </div>
                `;
                productPhotoPreview.classList.add('active');
            } else {
                productPhotoPreview.innerHTML = '';
                productPhotoPreview.classList.remove('active');
            }
            
            // Clear file inputs
            document.getElementById('receiptDocuments').value = '';
            document.getElementById('productPhoto').value = '';
            
            // Open modal
            modal.classList.add('active');
            
            this.logInfo('Edit mode', `Modifica ${item.name}`);
        } catch (error) {
            this.showError('Errore nel caricamento dei dati');
            this.logError('Edit item', error);
        }
    }

    // Render Dashboard
    renderDashboard() {
        try {
            // Initialize year filter if not set
            if (!this.selectedYearFilter) {
                this.selectedYearFilter = 'all';
            }
            
            // Filter items by selected year
            let filteredItems = this.items;
            if (this.selectedYearFilter !== 'all') {
                filteredItems = this.items.filter(item => {
                    const itemYear = new Date(item.purchaseDate).getFullYear().toString();
                    return itemYear === this.selectedYearFilter;
                });
            }
            
            const totalPurchase = filteredItems.reduce((sum, item) => sum + item.price, 0);
            const currentValue = filteredItems.reduce((sum, item) => {
                const value = this.calculateDepreciation(item.price, item.purchaseDate, item.category);
                return sum + value;
            }, 0);

            // Expiring items and sellable items use ALL items (not filtered)
            const expiringItems = this.items.filter(item => {
                const warranty = this.calculateWarrantyStatus(item.purchaseDate, item.warrantyMonths);
                return warranty.isExpiring;
            });
            
            const expiringCount = expiringItems.length;
            
            // Get items to sell
            const itemsToSell = this.getItemsToSell();
            const sellCount = itemsToSell.length;
            
            // Update dashboard cards
            document.getElementById('totalPurchaseValue').textContent = this.formatCurrency(totalPurchase);
            document.getElementById('currentValue').textContent = this.formatCurrency(currentValue);
            document.getElementById('itemCount').textContent = this.items.length; // Always show total items
            document.getElementById('expiringWarranties').textContent = expiringCount;
            document.getElementById('sellableItems').textContent = sellCount;

            const change = currentValue - totalPurchase;
            const changePercent = totalPurchase > 0 ? ((change / totalPurchase) * 100).toFixed(1) : 0;
            const changeElement = document.getElementById('valueChange');
            
            if (change < 0) {
                changeElement.textContent = `${changePercent}% (${this.formatCurrency(Math.abs(change))})`;
                changeElement.className = 'stat-change negative';
            } else {
                changeElement.textContent = `+${changePercent}% (+${this.formatCurrency(change)})`;
                changeElement.className = 'stat-change positive';
            }
            
            // Update year selector
            this.updateYearSelector();
            
            // Render warranty expiring alert
            this.renderWarrantyAlert(expiringItems);
        } catch (error) {
            this.showError('Errore nel caricamento della dashboard');
            this.logError('Render dashboard', error);
        }
    }
    
    // Update year selector dropdown
    updateYearSelector() {
        const yearSelector = document.getElementById('yearFilterSelector');
        if (!yearSelector) return;
        
        // Get unique years from items
        const years = [...new Set(this.items.map(item => 
            new Date(item.purchaseDate).getFullYear().toString()
        ))].sort().reverse();
        
        // Clear and rebuild selector
        yearSelector.innerHTML = `
            <option value="all">Totale</option>
            ${years.map(year => `
                <option value="${year}" ${this.selectedYearFilter === year ? 'selected' : ''}>${year}</option>
            `).join('')}
        `;
        
        // Update card title
        const cardTitle = document.getElementById('purchaseCardTitle');
        if (cardTitle) {
            if (this.selectedYearFilter === 'all') {
                cardTitle.textContent = 'Valore Totale Acquisto';
            } else {
                cardTitle.textContent = `Acquisti ${this.selectedYearFilter}`;
            }
        }
    }
    
    // Change year filter
    changeYearFilter(year) {
        this.selectedYearFilter = year;
        this.renderDashboard();
    }

    renderWarrantyAlert(expiringItems) {
        const alertBox = document.getElementById('warrantyAlert');
        const alertContent = document.getElementById('warrantyAlertContent');
        
        if (expiringItems.length === 0) {
            alertBox.style.display = 'none';
            return;
        }
        
        alertBox.style.display = 'block';
        alertContent.innerHTML = expiringItems.map(item => {
            const warranty = this.calculateWarrantyStatus(item.purchaseDate, item.warrantyMonths);
            return `
                <div class="warranty-alert-item" onclick="vault.showItemDetail('${item.id}')">
                    <div class="warranty-alert-info">
                        <div class="warranty-alert-name">${item.name}</div>
                        <div class="warranty-alert-days">⏰ Garanzia scade tra ${warranty.daysRemaining} ${warranty.daysRemaining === 1 ? 'giorno' : 'giorni'}</div>
                    </div>
                    <button class="warranty-alert-action" onclick="event.stopPropagation(); vault.showItemDetail('${item.id}')">
                        Vedi Suggerimenti
                    </button>
                </div>
            `;
        }).join('');
    }

    // Show sellable items modal
    showSellableItems() {
        const itemsToSell = this.getItemsToSell();
        
        if (itemsToSell.length === 0) {
            this.showNotification('📊 Nessun dispositivo da vendere al momento. Continua a monitorare!');
            return;
        }
        
        // Sort by urgency
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        itemsToSell.sort((a, b) => urgencyOrder[a.sellAnalysis.urgency] - urgencyOrder[b.sellAnalysis.urgency]);
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'sellableModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>💰 Dispositivi da Vendere</h2>
                    <button class="close-btn" onclick="document.getElementById('sellableModal').remove()">&times;</button>
                </div>
                
                <div style="padding: 2rem;">
                    <div style="background: var(--vault-darker); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; border-left: 4px solid var(--gold-accent);">
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            💡 <strong>Questi dispositivi sono nel "sweet spot"</strong> - hanno ancora un buon valore ma la svalutazione sta accelerando. Vendili ora per massimizzare il ritorno!
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 500px; overflow-y: auto;">
                        ${itemsToSell.map(item => {
                            const currentValue = this.calculateDepreciation(item.price, item.purchaseDate, item.category);
                            const urgencyColors = {
                                high: 'var(--red-loss)',
                                medium: 'var(--gold-accent)',
                                low: 'var(--green-value)'
                            };
                            const urgencyLabels = {
                                high: 'ALTA',
                                medium: 'MEDIA',
                                low: 'BASSA'
                            };
                            
                            return `
                                <div onclick="vault.showItemDetail('${item.id}'); document.getElementById('sellableModal').remove();" style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); border: 2px solid ${urgencyColors[item.sellAnalysis.urgency]}; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                        <div style="flex: 1;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                                <h3 style="color: var(--text-primary); margin: 0; font-size: 1.125rem;">${item.name}</h3>
                                                <span style="padding: 0.25rem 0.75rem; background: ${urgencyColors[item.sellAnalysis.urgency]}; color: white; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600;">
                                                    ${urgencyLabels[item.sellAnalysis.urgency]}
                                                </span>
                                            </div>
                                            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.75rem;">
                                                ${this.getCategoryLabel(item.category)} • ${item.sellAnalysis.monthsOwned} mesi
                                            </div>
                                            <div style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.6;">
                                                ${item.sellAnalysis.reason}
                                            </div>
                                        </div>
                                        <div style="text-align: right; margin-left: 1rem;">
                                            <div style="color: var(--text-muted); font-size: 0.75rem;">Pagato</div>
                                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">${this.formatCurrency(item.price)}</div>
                                            <div style="color: var(--text-muted); font-size: 0.75rem;">Vale Ora</div>
                                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; font-weight: 700; color: var(--green-value);">${this.formatCurrency(currentValue)}</div>
                                            <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.25rem;">(${item.sellAnalysis.valuePercent}%)</div>
                                        </div>
                                    </div>
                                    <div style="padding-top: 0.75rem; border-top: 1px solid var(--vault-border); text-align: center; color: var(--gold-accent); font-size: 0.875rem;">
                                        👆 Clicca per vedere i dettagli
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }

    // Render Items
    renderItems(filter = 'all') {
        try {
            const grid = document.getElementById('itemsGrid');
            const emptyState = document.getElementById('emptyState');

            if (this.items.length === 0) {
                grid.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }

            emptyState.classList.add('hidden');

            const filteredItems = filter === 'all' 
                ? this.items 
                : this.items.filter(item => item.category === filter);

            if (filteredItems.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
                        Nessun oggetto in questa categoria
                    </div>
                `;
                return;
            }

            grid.innerHTML = filteredItems.map(item => {
                try {
                    const currentValue = this.calculateDepreciation(item.price, item.purchaseDate, item.category);
                    const warranty = this.calculateWarrantyStatus(item.purchaseDate, item.warrantyMonths);
                    
                    let warrantyText = '';
                    let warrantyClass = 'active';
                    
                    if (warranty.isExpired) {
                        warrantyText = '❌ Scaduta';
                        warrantyClass = 'expiring';
                    } else if (warranty.isExpiring) {
                        warrantyText = `⚠️ Scade tra ${warranty.daysRemaining} giorni`;
                        warrantyClass = 'expiring';
                    } else {
                        warrantyText = `✅ Attiva (${Math.floor(warranty.daysRemaining / 30)} mesi)`;
                    }

                    const categoryEmojis = {
                        'electronics': '📱',
                        'appliances': '🏠',
                        'vehicles': '🚗',
                        'other': '📦'
                    };

                    // Get image for card (priority: productImage > first receipt image > category emoji)
                    let cardImageHtml;
                    if (item.productImage) {
                        cardImageHtml = `<img src="${item.productImage}" alt="${item.name}">`;
                    } else if (item.receiptDocuments && item.receiptDocuments.length > 0) {
                        const firstImageDoc = item.receiptDocuments.find(doc => doc.type === 'image');
                        if (firstImageDoc) {
                            cardImageHtml = `<img src="${firstImageDoc.data}" alt="${item.name}">`;
                        } else {
                            cardImageHtml = categoryEmojis[item.category] || '📦';
                        }
                    } else {
                        cardImageHtml = categoryEmojis[item.category] || '📦';
                    }

                    return `
                        <div class="item-card" onclick="vault.showItemDetail('${item.id}')">
                            <div class="item-image">
                                ${cardImageHtml}
                            </div>
                            <div class="item-content">
                                <div class="item-header">
                                    <div class="item-category">${this.getCategoryLabel(item.category)}</div>
                                    <h3 class="item-name">${item.name}</h3>
                                    <div class="item-date">Acquistato il ${this.formatDate(item.purchaseDate)}</div>
                                </div>
                                <div class="item-values">
                                    <div class="value-box">
                                        <div class="value-label">Pagato</div>
                                        <div class="value-amount">${this.formatCurrency(item.price)}</div>
                                    </div>
                                    <div class="value-box">
                                        <div class="value-label">Vale Ora</div>
                                        <div class="value-amount" style="color: var(--green-value)">${this.formatCurrency(currentValue)}</div>
                                    </div>
                                </div>
                                <div class="warranty-status ${warrantyClass}">
                                    ${warrantyText}
                                </div>
                            </div>
                        </div>
                    `;
                } catch (error) {
                    this.logError('Render item', error);
                    return `
                        <div class="item-card">
                            <div class="item-content">
                                <p style="color: var(--red-loss);">Errore nel caricamento di ${item.name || 'questo oggetto'}</p>
                            </div>
                        </div>
                    `;
                }
            }).join('');
            
            this.logInfo('Render', `${filteredItems.length} oggetti visualizzati`);
        } catch (error) {
            this.showError('Errore nel caricamento degli oggetti');
            this.logError('Render items', error);
        }
    }

    // Show Item Detail
    showItemDetail(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        const currentValue = this.calculateDepreciation(item.price, item.purchaseDate, item.category);
        const warranty = this.calculateWarrantyStatus(item.purchaseDate, item.warrantyMonths);
        const loss = item.price - currentValue;
        const lossPercent = ((loss / item.price) * 100).toFixed(1);

        document.getElementById('detailTitle').textContent = item.name;
        
        document.getElementById('detailContent').innerHTML = `
            <div style="padding: 2rem;">
                ${item.productImage ? `
                    <div style="margin-bottom: 2rem; border-radius: var(--radius-md); overflow: hidden; background: var(--vault-darker); padding: 1rem;">
                        <div style="text-align: center; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.875rem;">Immagine Prodotto</div>
                        <img src="${item.productImage}" alt="Product" style="width: 100%; max-height: 300px; object-fit: contain;">
                    </div>
                ` : ''}
                
                ${item.receiptDocuments && item.receiptDocuments.length > 0 ? `
                    <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--vault-darker); border-radius: var(--radius-md); border: 1px solid var(--gold-accent);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                            <h3 style="color: var(--gold-accent); margin: 0;">📄 Documenti Scontrino (${item.receiptDocuments.length})</h3>
                            <div style="display: flex; gap: 0.75rem;">
                                <button onclick="vault.viewReceiptFullscreen('${item.id}', 0)" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                                    👁️ Visualizza
                                </button>
                                <button onclick="vault.downloadReceipt('${item.id}')" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                                    💾 Salva Tutti
                                </button>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.75rem; margin-top: 1rem;">
                            ${item.receiptDocuments.map((doc, idx) => `
                                <div style="position: relative; border-radius: var(--radius-sm); overflow: hidden; border: 2px solid var(--vault-border); background: var(--vault-bg); cursor: pointer; aspect-ratio: 1;" onclick="vault.viewReceiptFullscreen('${item.id}', ${idx})">
                                    ${doc.type === 'pdf' ? `
                                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 1rem; text-align: center;">
                                            <div style="font-size: 3rem;">📄</div>
                                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">PDF ${idx + 1}</div>
                                        </div>
                                    ` : `
                                        <img src="${doc.data}" style="width: 100%; height: 100%; object-fit: cover;">
                                        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 0.25rem; text-align: center; font-size: 0.75rem; color: white;">
                                            Foto ${idx + 1}
                                        </div>
                                    `}
                                    <button onclick="event.stopPropagation(); vault.deleteReceiptDocument('${item.id}', ${idx})" 
                                        style="position: absolute; top: 0.25rem; right: 0.25rem; width: 24px; height: 24px; border-radius: 50%; background: var(--red-loss); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.875rem; padding: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                                        ×
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md); border: 1px solid var(--red-loss); text-align: center;">
                        <div style="color: var(--text-muted); font-size: 0.875rem;">⚠️ Nessuno scontrino caricato</div>
                        <div style="margin-top: 0.5rem;">
                            <button onclick="vault.editItem('${item.id}')" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                                Aggiungi Scontrino
                            </button>
                        </div>
                    </div>
                `}
                
                <div style="display: grid; gap: 1.5rem;">
                    <div>
                        <h3 style="color: var(--gold-accent); margin-bottom: 1rem;">💰 Analisi Valore</h3>
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md);">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                                <div>
                                    <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Prezzo Acquisto</div>
                                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--gold-accent);">${this.formatCurrency(item.price)}</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Valore Attuale</div>
                                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--green-value);">${this.formatCurrency(currentValue)}</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Svalutazione</div>
                                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--red-loss);">-${this.formatCurrency(loss)} (-${lossPercent}%)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 style="color: var(--gold-accent); margin-bottom: 1rem;">🛡️ Stato Garanzia</h3>
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md);">
                            <div style="display: grid; gap: 1rem;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Data Acquisto</span>
                                    <span style="font-weight: 600;">${this.formatDate(item.purchaseDate)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Scadenza Garanzia</span>
                                    <span style="font-weight: 600;">${this.formatDate(warranty.expiryDate)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Giorni Rimanenti</span>
                                    <span style="font-weight: 600; color: ${warranty.isExpiring || warranty.isExpired ? 'var(--red-loss)' : 'var(--green-value)'};">
                                        ${warranty.isExpired ? 'SCADUTA' : warranty.daysRemaining + ' giorni'}
                                    </span>
                                </div>
                            </div>
                            ${warranty.isExpiring ? `
                                <div style="margin-top: 1rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm); color: var(--red-loss); font-weight: 600;">
                                    ⚠️ ATTENZIONE: La garanzia scade tra ${warranty.daysRemaining} giorni!
                                </div>
                                <div style="margin-top: 1rem; padding: 1.5rem; background: rgba(96, 165, 250, 0.1); border: 1px solid var(--blue-info); border-radius: var(--radius-md);">
                                    <h4 style="color: var(--blue-info); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                        💡 Suggerimenti Prima della Scadenza
                                    </h4>
                                    ${this.getWarrantySuggestions(item.category, item.name)}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div>
                        <h3 style="color: var(--gold-accent); margin-bottom: 1rem;">📋 Dettagli</h3>
                        <div style="background: var(--vault-darker); padding: 1.5rem; border-radius: var(--radius-md); display: grid; gap: 0.75rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Categoria</span>
                                <span style="font-weight: 600;">${this.getCategoryLabel(item.category)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Condizione</span>
                                <span style="font-weight: 600;">${this.getConditionLabel(item.condition)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Durata Garanzia</span>
                                <span style="font-weight: 600;">${item.warrantyMonths} mesi</span>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--vault-border);">
                        <button onclick="vault.editItem('${item.id}')" class="btn-primary" style="flex: 1;">
                            ✏️ Modifica Oggetto
                        </button>
                        <button onclick="vault.deleteItem('${item.id}')" class="btn-secondary" style="background: rgba(239, 68, 68, 0.1); border-color: var(--red-loss); color: var(--red-loss);">
                            🗑️ Elimina
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('detailModal').classList.add('active');
    }

    // Filter Items
    filterItems(category) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === category);
        });
        this.renderItems(category);
    }

    // Modal Controls
    openModal() {
        // Reset editing state
        this.editingItemId = null;
        this.tempReceiptDocuments = [];
        
        const modal = document.getElementById('addModal');
        const modalTitle = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        
        // Reset to "Add" mode
        modalTitle.textContent = 'Aggiungi Nuovo Oggetto';
        submitBtn.innerHTML = '💾 Salva Oggetto';
        
        // Reset form
        document.getElementById('addItemForm').reset();
        
        // Clear photo previews
        document.getElementById('productPhotoPreview').classList.remove('active');
        document.getElementById('productPhotoPreview').innerHTML = '';
        
        // Clear receipt documents preview
        this.renderReceiptDocumentsPreview();
        
        this.setDefaultDate();
        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('addModal').classList.remove('active');
        this.editingItemId = null; // Reset editing state
        this.tempReceiptDocuments = null; // Reset temp documents
        this.clearFormErrors(); // Clear any errors
        
        // Clear photo previews
        document.getElementById('productPhotoPreview').classList.remove('active');
        document.getElementById('productPhotoPreview').innerHTML = '';
        
        const receiptPreview = document.getElementById('receiptDocumentsPreview');
        if (receiptPreview) {
            receiptPreview.innerHTML = '';
            receiptPreview.classList.remove('active');
        }
    }

    closeDetailModal() {
        document.getElementById('detailModal').classList.remove('active');
    }

    // Custom Categories Functions
    updateCategorySelect() {
        const select = document.getElementById('category');
        const currentValue = select.value;
        
        // Clear custom categories options (keep base ones and "Personalizza")
        const options = Array.from(select.options);
        options.forEach(option => {
            if (option.value.startsWith('custom_')) {
                option.remove();
            }
        });
        
        // Add custom categories before "Personalizza"
        const customizeOption = select.querySelector('option[value="__customize__"]');
        this.customCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.insertBefore(option, customizeOption);
        });
        
        // Restore selection if it was a custom category
        if (currentValue && currentValue.startsWith('custom_')) {
            select.value = currentValue;
        }
        
        // Update filters
        this.updateFilters();
    }

    updateFilters() {
        const filtersContainer = document.querySelector('.filters');
        if (!filtersContainer) return;
        
        // Build filters HTML
        let filtersHTML = '<button class="filter-btn active" data-filter="all">Tutti</button>';
        filtersHTML += '<button class="filter-btn" data-filter="electronics">Elettronica</button>';
        filtersHTML += '<button class="filter-btn" data-filter="appliances">Elettrodomestici</button>';
        filtersHTML += '<button class="filter-btn" data-filter="vehicles">Veicoli</button>';
        
        this.customCategories.forEach(cat => {
            filtersHTML += `<button class="filter-btn" data-filter="${cat.id}">${cat.name}</button>`;
        });
        
        filtersContainer.innerHTML = filtersHTML;
        
        // Re-attach event listeners
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterItems(e.target.dataset.filter);
            });
        });
    }

    showCustomCategoryInput() {
        document.getElementById('customCategoryInput').style.display = 'block';
        document.getElementById('customCategoryName').focus();
    }

    hideCustomCategoryInput() {
        document.getElementById('customCategoryInput').style.display = 'none';
        document.getElementById('customCategoryName').value = '';
    }

    saveCustomCategory() {
        const input = document.getElementById('customCategoryName');
        const depreciationSelect = document.getElementById('customCategoryDepreciation');
        const name = input.value.trim();
        const depreciationCurve = depreciationSelect.value;
        
        if (!name) {
            this.showError('Il nome della categoria non può essere vuoto');
            return;
        }
        
        if (name.length < 2) {
            this.showError('Il nome deve avere almeno 2 caratteri');
            return;
        }
        
        // Check if name already exists
        const exists = this.customCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            this.showError('Esiste già una categoria con questo nome');
            return;
        }
        
        // Create new category
        const newCategory = {
            id: 'custom_' + Date.now(),
            name: name,
            depreciationCurve: depreciationCurve
        };
        
        this.customCategories.push(newCategory);
        this.saveCustomCategories();
        
        // Update UI
        this.updateCategorySelect();
        this.hideCustomCategoryInput();
        
        // Select the new category
        document.getElementById('category').value = newCategory.id;
        
        const curveLabel = this.getDepreciationCurveLabel(depreciationCurve);
        this.showNotification(`✅ Categoria "${name}" creata con curva: ${curveLabel}`);
        this.logInfo('Custom Category', `Creata: ${name} (${curveLabel})`);
    }

    cancelCustomCategory() {
        this.hideCustomCategoryInput();
        document.getElementById('category').value = '';
    }

    // Manage Categories Modal
    openManageCategoriesModal() {
        this.renderCustomCategoriesList();
        document.getElementById('manageCategoriesModal').classList.add('active');
    }

    closeManageCategoriesModal() {
        document.getElementById('manageCategoriesModal').classList.remove('active');
        this.editingCategoryId = null;
    }

    renderCustomCategoriesList() {
        const container = document.getElementById('customCategoriesList');
        
        if (this.customCategories.length === 0) {
            container.className = 'custom-categories-list empty';
            container.innerHTML = 'Nessuna categoria personalizzata. Creane una usando "Personalizza" nel form!';
            return;
        }
        
        container.className = 'custom-categories-list';
        container.innerHTML = this.customCategories.map(cat => {
            const usageCount = this.items.filter(item => item.category === cat.id).length;
            const isEditing = this.editingCategoryId === cat.id;
            const curveLabel = this.getDepreciationCurveLabel(cat.depreciationCurve || 'generic');
            
            if (isEditing) {
                return `
                    <div class="category-item editing" data-id="${cat.id}">
                        <div class="category-info" style="width: 100%;">
                            <input type="text" class="category-name-input" id="editCategoryName_${cat.id}" value="${cat.name}" maxlength="30" style="margin-bottom: 0.75rem;">
                            
                            <div style="margin-bottom: 0.5rem;">
                                <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Curva di svalutazione:</label>
                                <select id="editCategoryCurve_${cat.id}" style="width: 100%; background: var(--vault-surface); border: 1px solid var(--blue-info); color: var(--text-primary); padding: 0.5rem; border-radius: var(--radius-sm); font-family: 'Sora', sans-serif; font-size: 0.875rem;">
                                    <option value="electronics" ${cat.depreciationCurve === 'electronics' ? 'selected' : ''}>📱 Come Elettronica</option>
                                    <option value="appliances" ${cat.depreciationCurve === 'appliances' ? 'selected' : ''}>🏠 Come Elettrodomestici</option>
                                    <option value="vehicles" ${cat.depreciationCurve === 'vehicles' ? 'selected' : ''}>🚗 Come Veicoli</option>
                                    <option value="generic" ${cat.depreciationCurve === 'generic' || !cat.depreciationCurve ? 'selected' : ''}>📦 Generica</option>
                                    <option value="none" ${cat.depreciationCurve === 'none' ? 'selected' : ''}>💎 Nessuna svalutazione</option>
                                </select>
                            </div>
                            
                            <div class="category-usage">Usata in ${usageCount} ${usageCount === 1 ? 'oggetto' : 'oggetti'}</div>
                        </div>
                        <div class="category-actions" style="margin-top: 0.75rem;">
                            <button class="btn-save-category-edit" onclick="vault.saveEditCategory('${cat.id}')">✓ Salva</button>
                            <button class="btn-cancel-category-edit" onclick="vault.cancelEditCategory()">✗ Annulla</button>
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="category-item" data-id="${cat.id}">
                    <div class="category-info">
                        <div class="category-name">
                            <span>🏷️</span>
                            <span>${cat.name}</span>
                        </div>
                        <div class="category-usage">
                            Usata in ${usageCount} ${usageCount === 1 ? 'oggetto' : 'oggetti'}
                            <span style="margin-left: 1rem; color: var(--gold-accent);">📊 ${curveLabel}</span>
                        </div>
                    </div>
                    <div class="category-actions">
                        <button class="btn-category-action btn-edit-category" onclick="vault.startEditCategory('${cat.id}')">
                            ✏️ Modifica
                        </button>
                        <button class="btn-category-action btn-delete-category" onclick="vault.deleteCategory('${cat.id}')">
                            🗑️ Elimina
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    startEditCategory(categoryId) {
        this.editingCategoryId = categoryId;
        this.renderCustomCategoriesList();
        
        // Focus on input
        setTimeout(() => {
            const input = document.getElementById(`editCategoryName_${categoryId}`);
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    saveEditCategory(categoryId) {
        const input = document.getElementById(`editCategoryName_${categoryId}`);
        const curveSelect = document.getElementById(`editCategoryCurve_${categoryId}`);
        const newName = input.value.trim();
        const newCurve = curveSelect.value;
        
        if (!newName) {
            this.showError('Il nome della categoria non può essere vuoto');
            return;
        }
        
        if (newName.length < 2) {
            this.showError('Il nome deve avere almeno 2 caratteri');
            return;
        }
        
        // Check if name already exists (excluding current)
        const exists = this.customCategories.some(cat => 
            cat.id !== categoryId && cat.name.toLowerCase() === newName.toLowerCase()
        );
        if (exists) {
            this.showError('Esiste già una categoria con questo nome');
            return;
        }
        
        // Update category
        const category = this.customCategories.find(cat => cat.id === categoryId);
        if (category) {
            const oldName = category.name;
            const oldCurve = category.depreciationCurve || 'generic';
            category.name = newName;
            category.depreciationCurve = newCurve;
            
            this.saveCustomCategories();
            this.updateCategorySelect();
            this.editingCategoryId = null;
            this.renderCustomCategoriesList();
            
            // Recalculate values if curve changed
            if (oldCurve !== newCurve) {
                this.renderDashboard();
                this.renderItems();
                const curveLabel = this.getDepreciationCurveLabel(newCurve);
                this.showNotification(`✅ "${oldName}" → "${newName}" (curva: ${curveLabel})`);
                this.logInfo('Custom Category', `Modificata: ${oldName} → ${newName}, Curva: ${curveLabel}`);
            } else {
                this.showNotification(`✅ Categoria rinominata: "${oldName}" → "${newName}"`);
                this.logInfo('Custom Category', `Modificata: ${oldName} → ${newName}`);
            }
        }
    }

    cancelEditCategory() {
        this.editingCategoryId = null;
        this.renderCustomCategoriesList();
    }

    deleteCategory(categoryId) {
        const category = this.customCategories.find(cat => cat.id === categoryId);
        if (!category) return;
        
        const usageCount = this.items.filter(item => item.category === categoryId).length;
        
        let confirmMessage = `Sei sicuro di voler eliminare la categoria "${category.name}"?`;
        if (usageCount > 0) {
            confirmMessage += `\n\n⚠️ Attenzione: ${usageCount} ${usageCount === 1 ? 'oggetto usa' : 'oggetti usano'} questa categoria. ${usageCount === 1 ? 'Verrà impostato' : 'Verranno impostati'} come "Altro".`;
        }
        
        if (!confirm(confirmMessage)) return;
        
        try {
            // Remove category
            this.customCategories = this.customCategories.filter(cat => cat.id !== categoryId);
            this.saveCustomCategories();
            
            // Update items that used this category
            if (usageCount > 0) {
                this.items.forEach(item => {
                    if (item.category === categoryId) {
                        item.category = 'other';
                    }
                });
                this.saveItems();
            }
            
            // Update UI
            this.updateCategorySelect();
            this.renderCustomCategoriesList();
            this.renderDashboard();
            this.renderItems();
            
            this.showNotification(`🗑️ Categoria "${category.name}" eliminata`);
            this.logInfo('Custom Category', `Eliminata: ${category.name}`);
        } catch (error) {
            this.showError('Errore nell\'eliminazione della categoria');
            this.logError('Delete category', error);
        }
    }

    // Utilities
    formatCurrency(amount) {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    getCategoryLabel(category) {
        const baseLabels = {
            'electronics': 'Elettronica',
            'appliances': 'Elettrodomestici',
            'vehicles': 'Veicoli',
            'other': 'Altro'
        };
        
        // Check if it's a base category
        if (baseLabels[category]) {
            return baseLabels[category];
        }
        
        // Check if it's a custom category
        const customCat = this.customCategories.find(cat => cat.id === category);
        if (customCat) {
            return customCat.name;
        }
        
        // Fallback
        return 'Altro';
    }

    getConditionLabel(condition) {
        const labels = {
            'new': 'Nuovo',
            'excellent': 'Ottimo',
            'good': 'Buono',
            'fair': 'Discreto'
        };
        return labels[condition] || 'Buono';
    }

    getDepreciationCurveLabel(curve) {
        const labels = {
            'electronics': 'Come Elettronica',
            'appliances': 'Come Elettrodomestici',
            'vehicles': 'Come Veicoli',
            'generic': 'Generica',
            'none': 'Nessuna svalutazione'
        };
        return labels[curve] || 'Generica';
    }

    getWarrantySuggestions(category, itemName) {
        // Get actual category if custom
        let actualCategory = category;
        if (category.startsWith('custom_')) {
            const customCat = this.customCategories.find(cat => cat.id === category);
            if (customCat && customCat.depreciationCurve) {
                actualCategory = customCat.depreciationCurve === 'none' ? 'other' : customCat.depreciationCurve;
            }
        }

        const suggestions = {
            electronics: `
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
                    <li><strong>Verifica la batteria:</strong> Testa la durata e eventuali gonfiori</li>
                    <li><strong>Controlla schermo/display:</strong> Cerca pixel morti, macchie o scolorimenti</li>
                    <li><strong>Testa tutte le porte:</strong> USB, jack audio, connettori</li>
                    <li><strong>Verifica sensori:</strong> Touch, fotocamera, microfono, altoparlanti</li>
                    <li><strong>Software:</strong> Aggiorna all'ultima versione disponibile</li>
                    <li><strong>Backup dei dati:</strong> Prima di portarlo in assistenza!</li>
                </ul>
                <div style="margin-top: 1rem; padding: 0.75rem; background: var(--vault-darker); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-muted);">
                    💡 Anche piccoli difetti possono essere coperti da garanzia. Meglio controllare ora che pagare riparazioni dopo!
                </div>
            `,
            appliances: `
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
                    <li><strong>Test completo:</strong> Fai funzionare tutti i programmi/modalità</li>
                    <li><strong>Rumori strani:</strong> Ascolta attentamente durante il funzionamento</li>
                    <li><strong>Perdite:</strong> Controlla eventuali perdite d'acqua o liquidi</li>
                    <li><strong>Efficienza:</strong> Verifica consumi e prestazioni (lava/raffredda bene?)</li>
                    <li><strong>Controllo filtri:</strong> Pulisci e verifica che funzionino</li>
                    <li><strong>Documentazione:</strong> Tieni pronti scontrino e libretto istruzioni</li>
                </ul>
                <div style="margin-top: 1rem; padding: 0.75rem; background: var(--vault-darker); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-muted);">
                    💡 Gli elettrodomestici spesso mostrano problemi dopo 1-2 anni. Un controllo ora può evitare costose riparazioni!
                </div>
            `,
            vehicles: `
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
                    <li><strong>Test completo:</strong> Prova freni, accelerazione, cambio marce</li>
                    <li><strong>Rumori sospetti:</strong> Durante guida, in curva, in frenata</li>
                    <li><strong>Verifica batteria:</strong> Autonomia e ricarica (se elettrico)</li>
                    <li><strong>Controllo sospensioni:</strong> Ammortizzatori, molle, forcella</li>
                    <li><strong>Parte elettrica:</strong> Luci, display, sensori</li>
                    <li><strong>Revisione preventiva:</strong> Porta dal rivenditore per check-up gratuito</li>
                </ul>
                <div style="margin-top: 1rem; padding: 0.75rem; background: var(--vault-darker); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-muted);">
                    💡 Molti concessionari offrono check-up gratuiti prima della scadenza garanzia. Approfittane!
                </div>
            `,
            other: `
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
                    <li><strong>Ispezione visiva:</strong> Cerca crepe, rotture, usura anomala</li>
                    <li><strong>Test funzionale:</strong> Verifica che tutto funzioni come al momento dell'acquisto</li>
                    <li><strong>Materiali:</strong> Controlla cuciture, giunzioni, parti mobili</li>
                    <li><strong>Difetti nascosti:</strong> A volte i problemi non sono evidenti subito</li>
                    <li><strong>Documentazione:</strong> Tieni pronti scontrino e certificati</li>
                    <li><strong>Contatta il venditore:</strong> Chiedi se offrono check-up pre-scadenza</li>
                </ul>
                <div style="margin-top: 1rem; padding: 0.75rem; background: var(--vault-darker); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-muted);">
                    💡 È tuo diritto far valere la garanzia per difetti di fabbricazione. Non aspettare che scada!
                </div>
            `
        };

        return suggestions[actualCategory] || suggestions.other;
    }

    showNotification(message) {
        // Simple notification (can be enhanced later)
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: var(--vault-surface);
            color: var(--text-primary);
            padding: 1rem 2rem;
            border-radius: var(--radius-md);
            border: 1px solid var(--gold-accent);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <span style="margin-right: 0.5rem;">❌</span>
            ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: var(--vault-surface);
            color: var(--red-loss);
            padding: 1rem 2rem;
            border-radius: var(--radius-md);
            border: 1px solid var(--red-loss);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    logError(context, error) {
        console.error(`[Life Warranty Vault] ${context}:`, error);
        
        // Add to debug log if exists
        const debugLog = document.getElementById('debugLog');
        if (debugLog) {
            const entry = document.createElement('div');
            entry.className = 'debug-entry error';
            entry.innerHTML = `
                <div class="debug-time">${new Date().toLocaleTimeString()}</div>
                <div class="debug-context">${context}</div>
                <div class="debug-message">${error?.message || error}</div>
            `;
            debugLog.insertBefore(entry, debugLog.firstChild);
            
            // Keep only last 50 entries
            while (debugLog.children.length > 50) {
                debugLog.removeChild(debugLog.lastChild);
            }
        }
    }

    logInfo(context, message) {
        console.log(`[Life Warranty Vault] ${context}:`, message);
        
        const debugLog = document.getElementById('debugLog');
        if (debugLog) {
            const entry = document.createElement('div');
            entry.className = 'debug-entry info';
            entry.innerHTML = `
                <div class="debug-time">${new Date().toLocaleTimeString()}</div>
                <div class="debug-context">${context}</div>
                <div class="debug-message">${message}</div>
            `;
            debugLog.insertBefore(entry, debugLog.firstChild);
            
            while (debugLog.children.length > 50) {
                debugLog.removeChild(debugLog.lastChild);
            }
        }
    }
}

// Initialize the app
const vault = new LifeWarrantyVault();

// Check for warranty expiring and show notifications
setInterval(() => {
    vault.items.forEach(item => {
        const warranty = vault.calculateWarrantyStatus(item.purchaseDate, item.warrantyMonths);
        if (warranty.isExpiring && warranty.daysRemaining === 7) {
            vault.showNotification(`⚠️ La garanzia di ${item.name} scade tra 7 giorni!`);
        }
    });
}, 60000 * 60); // Check every hour
