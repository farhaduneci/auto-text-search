class PopupController {
    constructor() {
        // Map setting keys to their corresponding DOM element IDs
        this.elementMap = {
            enabled: "enableToggle",
            searchEngine: "searchEngine",
            triggerKey: "triggerKey",
            openInNewTab: "openInNewTab",
            showNotifications: "showNotifications",
        };

        this.defaultSettings = {
            enabled: true,
            searchEngine: "google",
            triggerKey: "alt",
            openInNewTab: true,
            showNotifications: true,
        };

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

        await this.loadSettings();
        this.setupEventListeners();
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
            element.value = value;
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

        // Listen for storage changes to keep popup in sync
        browser.storage.onChanged.addListener((changes) => {
            Object.keys(changes).forEach((key) => {
                if (this.elements[key]) {
                    this.setElementValue(key, changes[key].newValue);
                    if (key === "enabled") {
                        this.updateStatus();
                    }
                }
            });
        });
    }

    async handleSettingChange(settingKey) {
        const value = this.getElementValue(settingKey);

        try {
            await browser.storage.sync.set({ [settingKey]: value });
            this.showStatus("Setting saved");
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

    updateStatus() {
        const enabled = this.elements.enabled.checked;

        if (enabled) {
            this.statusElement.textContent = "Extension is active";
            this.statusElement.style.color = "#4CAF50";
        } else {
            this.statusElement.textContent = "Extension is disabled";
            this.statusElement.style.color = "#aaa";
        }
    }

    showStatus(message, type = "success") {
        const originalText = this.statusElement.textContent;

        this.statusElement.textContent = message;
        this.statusElement.style.color =
            type === "error" ? "#dc3545" : "#4CAF50";

        // Restore original text after 2 seconds
        setTimeout(() => {
            this.statusElement.textContent = originalText;
            this.updateStatus();
        }, 2000);
    }
}

new PopupController();
