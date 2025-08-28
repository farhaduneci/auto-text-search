class PopupController {
    constructor() {
        // Map setting keys to their corresponding DOM element IDs
        this.elementMap = {
            enabled: "enableToggle",
            searchEngine: "searchEngine",
            triggerKey: "triggerKey",
            openInNewTab: "openInNewTab",
            showNotifications: "showNotifications",
            enableInPageDefinition: "enableInPageDefinition",
            definitionTriggerKey: "definitionTriggerKey",
            definitionSource: "definitionSource"
        };

        this.defaultSettings = {
            enabled: true,
            searchEngine: "google",
            triggerKey: "alt",
            openInNewTab: true,
            showNotifications: true,
            enableInPageDefinition: false,
            definitionTriggerKey: "ctrl+d",
            definitionSource: "dictionary"
        };

        // Available key options for both triggers
        this.availableKeys = [
            { value: "shift", label: "Shift" },
            { value: "ctrl", label: "Ctrl" },
            { value: "alt", label: "Alt" },
            { value: "cmd", label: "Cmd (Mac)" },
            { value: "ctrl+shift", label: "Ctrl + Shift" },
            { value: "alt+shift", label: "Alt + Shift" },
            { value: "ctrl+alt", label: "Ctrl + Alt" },
            { value: "cmd+shift", label: "Cmd + Shift" },
            { value: "cmd+alt", label: "Cmd + Alt" },
            { value: "ctrl+d", label: "Ctrl + D" },
            { value: "alt+d", label: "Alt + D" },
            { value: "shift+d", label: "Shift + D" },
            { value: "cmd+d", label: "Cmd + D" },
            { value: "ctrl+shift+d", label: "Ctrl + Shift + D" },
            { value: "alt+shift+d", label: "Alt + Shift + D" }
        ];

        // Cache DOM elements
        this.elements = {};
        this.statusElement = document.getElementById("status");

        this.init();
    }

    async init() {
        if (!this.cacheElements()) {
            console.error("Failed to initialize: missing DOM elements");
            return;
        }

        // Populate the dropdowns with options
        this.populateKeyDropdowns();

        await this.loadSettings();
        this.setupEventListeners();
        this.updateKeyDropdownConflicts();
    }

    cacheElements() {
        // Cache all form elements
        for (const [settingKey, elementId] of Object.entries(this.elementMap)) {
            const element = document.getElementById(elementId);
            if (!element) {
                console.error(
                    `Missing element: ${elementId} for setting: ${settingKey}`
                );
                return false;
            }
            this.elements[settingKey] = element;
        }

        if (!this.statusElement) {
            console.error("Missing status element");
            return false;
        }

        return true;
    }

    populateKeyDropdowns() {
        // Populate search trigger dropdown
        const searchSelect = this.elements.triggerKey;
        searchSelect.innerHTML = '';
        
        // Add only non-definition keys to search trigger
        const searchKeys = this.availableKeys.filter(key => !key.value.includes('d'));
        searchKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key.value;
            option.textContent = key.label;
            searchSelect.appendChild(option);
        });

        // Populate definition trigger dropdown  
        const defSelect = this.elements.definitionTriggerKey;
        defSelect.innerHTML = '';
        
        // Add all keys to definition trigger (will be filtered dynamically)
        this.availableKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key.value;
            option.textContent = key.label;
            defSelect.appendChild(option);
        });
    }

    async loadSettings() {
        try {
            const settings = await browser.storage.sync.get(
                Object.keys(this.defaultSettings)
            );

            // Apply settings to UI elements
            Object.keys(this.defaultSettings).forEach((key) => {
                const value = settings.hasOwnProperty(key)
                    ? settings[key]
                    : this.defaultSettings[key];
                this.setElementValue(key, value);
            });

            this.updateStatus();
            this.updateDefinitionSettingsVisibility();
        } catch (error) {
            console.error("Failed to load settings:", error);
            this.showStatus("Failed to load settings", "error");
        }
    }

    setElementValue(key, value) {
        const element = this.elements[key];
        if (!element) return;

        if (element.type === "checkbox") {
            element.checked = Boolean(value);
        } else {
            // For select elements, check if the option exists
            if (element.tagName === 'SELECT') {
                const optionExists = Array.from(element.options).some(opt => opt.value === value);
                if (optionExists) {
                    element.value = value;
                } else {
                    // If the saved value doesn't exist (might be disabled), keep current selection
                    console.log(`Saved value ${value} not available for ${key}`);
                }
            } else {
                element.value = value;
            }
        }
    }

    getElementValue(key) {
        const element = this.elements[key];
        if (!element) return null;

        return element.type === "checkbox" ? element.checked : element.value;
    }

    setupEventListeners() {
        // Add change listeners to all form elements
        Object.keys(this.elements).forEach((key) => {
            this.elements[key].addEventListener("change", () =>
                this.handleSettingChange(key)
            );
        });

        // Special handlers for trigger key changes to prevent conflicts
        this.elements.triggerKey.addEventListener("change", () => {
            this.updateKeyDropdownConflicts();
        });

        this.elements.definitionTriggerKey.addEventListener("change", () => {
            this.updateKeyDropdownConflicts();
        });

        // Special handler for definition feature toggle
        this.elements.enableInPageDefinition.addEventListener("change", () => {
            this.updateDefinitionSettingsVisibility();
            this.updateKeyDropdownConflicts();
        });

        // Listen for storage changes to keep popup in sync
        browser.storage.onChanged.addListener((changes) => {
            Object.keys(changes).forEach((key) => {
                if (this.elements[key]) {
                    this.setElementValue(key, changes[key].newValue);
                    if (key === "enabled") {
                        this.updateStatus();
                    }
                    if (key === "enableInPageDefinition") {
                        this.updateDefinitionSettingsVisibility();
                    }
                    if (key === "triggerKey" || key === "definitionTriggerKey") {
                        this.updateKeyDropdownConflicts();
                    }
                }
            });
        });
    }

    updateKeyDropdownConflicts() {
        const searchTrigger = this.elements.triggerKey.value;
        const defTrigger = this.elements.definitionTriggerKey.value;
        const defEnabled = this.elements.enableInPageDefinition.checked;

        // Clear all disabled states first
        const searchOptions = this.elements.triggerKey.options;
        const defOptions = this.elements.definitionTriggerKey.options;

        // Enable all options first
        for (let option of searchOptions) {
            option.disabled = false;
            option.style.color = '';
        }
        for (let option of defOptions) {
            option.disabled = false;
            option.style.color = '';
        }

        if (!defEnabled) {
            // If definition feature is disabled, no conflicts to manage
            return;
        }

        // Disable conflicting options in definition dropdown
        for (let option of defOptions) {
            if (this.hasKeyConflict(option.value, searchTrigger)) {
                option.disabled = true;
                option.style.color = '#888';
                
                // Add explanation to the label if not already there
                if (!option.textContent.includes('(used for search)')) {
                    option.textContent = `${option.textContent} (used for search)`;
                }
            } else {
                // Remove the explanation if it was added
                option.textContent = option.textContent.replace(' (used for search)', '');
            }
        }

        // Disable conflicting options in search dropdown
        for (let option of searchOptions) {
            if (this.hasKeyConflict(option.value, defTrigger)) {
                option.disabled = true;
                option.style.color = '#888';
                
                // Add explanation to the label if not already there
                if (!option.textContent.includes('(used for definition)')) {
                    option.textContent = `${option.textContent} (used for definition)`;
                }
            } else {
                // Remove the explanation if it was added
                option.textContent = option.textContent.replace(' (used for definition)', '');
            }
        }

        // If current selection is now disabled, switch to a non-conflicting option
        this.resolveConflictingSelection();
    }

    hasKeyConflict(key1, key2) {
        // Check if two key combinations conflict
        if (key1 === key2) return true;

        // Parse keys into components
        const parseKeys = (keyStr) => {
            const keys = keyStr.toLowerCase().split('+').map(k => k.trim());
            return {
                ctrl: keys.includes('ctrl'),
                shift: keys.includes('shift'),
                alt: keys.includes('alt'),
                cmd: keys.includes('cmd'),
                other: keys.filter(k => !['ctrl', 'shift', 'alt', 'cmd'].includes(k))
            };
        };

        const k1 = parseKeys(key1);
        const k2 = parseKeys(key2);

        // Check for subset conflicts
        // For example, "shift" conflicts with "shift+d"
        const k1ModifierCount = [k1.ctrl, k1.shift, k1.alt, k1.cmd].filter(Boolean).length;
        const k2ModifierCount = [k2.ctrl, k2.shift, k2.alt, k2.cmd].filter(Boolean).length;

        // If one is a subset of the other (same modifiers but one has extra keys)
        if (k1.ctrl === k2.ctrl && k1.shift === k2.shift && 
            k1.alt === k2.alt && k1.cmd === k2.cmd) {
            // They share the same modifiers, check if one has extra keys
            if (k1.other.length === 0 || k2.other.length === 0) {
                return true; // One is a pure modifier, conflicts with modifier+key
            }
        }

        return false;
    }

    resolveConflictingSelection() {
        const searchTrigger = this.elements.triggerKey.value;
        const defTrigger = this.elements.definitionTriggerKey.value;
        const defEnabled = this.elements.enableInPageDefinition.checked;

        if (!defEnabled) return;

        // Check if current definition trigger conflicts with search trigger
        if (this.hasKeyConflict(defTrigger, searchTrigger)) {
            // Find first non-conflicting option for definition trigger
            const defOptions = this.elements.definitionTriggerKey.options;
            for (let option of defOptions) {
                if (!this.hasKeyConflict(option.value, searchTrigger)) {
                    this.elements.definitionTriggerKey.value = option.value;
                    this.handleSettingChange('definitionTriggerKey');
                    this.showStatus('Definition trigger changed to avoid conflict', 'warning');
                    break;
                }
            }
        }
    }

    async handleSettingChange(settingKey) {
        const value = this.getElementValue(settingKey);

        try {
            await browser.storage.sync.set({ [settingKey]: value });
            
            // Show different messages for different settings
            if (settingKey === "enableInPageDefinition") {
                if (value) {
                    this.showStatus("Definition feature enabled!");
                } else {
                    this.showStatus("Definition feature disabled");
                }
            } else if (settingKey === "definitionSource") {
                this.showStatus(`Using ${value} for definitions`);
            } else if (settingKey === "triggerKey" || settingKey === "definitionTriggerKey") {
                this.showStatus("Trigger key updated");
                // Update conflicts after saving
                setTimeout(() => this.updateKeyDropdownConflicts(), 100);
            } else {
                this.showStatus("Setting saved");
            }
            
            if (settingKey === "enabled") {
                this.updateStatus();
            }
        } catch (error) {
            console.error("Failed to save setting:", error);
            this.showStatus("Failed to save setting", "error");

            // Revert the change on error
            const currentSettings = await browser.storage.sync.get([
                settingKey,
            ]);
            const previousValue =
                currentSettings[settingKey] ?? this.defaultSettings[settingKey];
            this.setElementValue(settingKey, previousValue);
        }
    }

    updateDefinitionSettingsVisibility() {
        const isEnabled = this.elements.enableInPageDefinition.checked;
        const definitionTriggerRow = this.elements.definitionTriggerKey.closest('.setting-item');
        const definitionSourceRow = this.elements.definitionSource.closest('.setting-item');
        
        if (isEnabled) {
            definitionTriggerRow.style.display = 'flex';
            definitionSourceRow.style.display = 'flex';
            definitionTriggerRow.style.opacity = '1';
            definitionSourceRow.style.opacity = '1';
        } else {
            definitionTriggerRow.style.opacity = '0.5';
            definitionSourceRow.style.opacity = '0.5';
            // Keep them visible but disabled-looking
            this.elements.definitionTriggerKey.disabled = true;
            this.elements.definitionSource.disabled = true;
            
            setTimeout(() => {
                this.elements.definitionTriggerKey.disabled = false;
                this.elements.definitionSource.disabled = false;
            }, 100);
        }
    }

    updateStatus() {
        const enabled = this.elements.enabled.checked;
        const definitionEnabled = this.elements.enableInPageDefinition.checked;

        if (enabled) {
            if (definitionEnabled) {
                this.statusElement.textContent = "Extension active with definitions";
                this.statusElement.style.color = "#4CAF50";
            } else {
                this.statusElement.textContent = "Extension is active";
                this.statusElement.style.color = "#4CAF50";
            }
        } else {
            this.statusElement.textContent = "Extension is disabled";
            this.statusElement.style.color = "#aaa";
        }
    }

    showStatus(message, type = "success") {
        const originalText = this.statusElement.textContent;

        this.statusElement.textContent = message;
        
        if (type === "error") {
            this.statusElement.style.color = "#dc3545";
        } else if (type === "warning") {
            this.statusElement.style.color = "#ffc107";
        } else {
            this.statusElement.style.color = "#4CAF50";
        }

        // Add a subtle animation
        this.statusElement.style.transition = "all 0.3s ease";
        this.statusElement.style.transform = "scale(1.05)";
        
        setTimeout(() => {
            this.statusElement.style.transform = "scale(1)";
        }, 200);

        // Restore original text after 2 seconds
        setTimeout(() => {
            this.statusElement.textContent = originalText;
            this.updateStatus();
        }, 2000);
    }
}

new PopupController();
