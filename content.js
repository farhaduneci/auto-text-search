class AutoTextSearch {
    constructor() {
        this.enabled = true;
        this.settings = {
            searchEngine: "google",
            triggerKey: "alt",
            openInNewTab: true,
            showNotifications: true,
        };

        this.keysPressed = new Set();
        this.lastSelection = "";
        this.searchCooldown = false;
        this.pendingSearch = null;
        this.selectionStartTime = 0;
        this.currentEvent = null;

        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
    }

    async loadSettings() {
        try {
            const result = await browser.storage.sync.get([
                "enabled",
                "searchEngine",
                "triggerKey",
                "openInNewTab",
                "showNotifications",
            ]);

            this.enabled = result.enabled !== false;
            this.settings = {
                searchEngine: result.searchEngine || "google",
                triggerKey: result.triggerKey || "alt",
                openInNewTab: result.openInNewTab !== false,
                showNotifications: result.showNotifications !== false,
            };

            // Initialize default settings in storage if they don't exist
            const defaultSettings = {
                enabled: true,
                searchEngine: "google",
                triggerKey: "alt",
                openInNewTab: true,
                showNotifications: true,
            };

            const settingsToSave = {};
            for (const [key, defaultValue] of Object.entries(defaultSettings)) {
                if (result[key] === undefined) {
                    settingsToSave[key] = defaultValue;
                }
            }

            if (Object.keys(settingsToSave).length > 0) {
                await browser.storage.sync.set(settingsToSave);
            }
        } catch (error) {
            console.warn("Auto Text Search: Failed to load settings", error);
        }
    }

    setupEventListeners() {
        // Listen for storage changes
        browser.storage.onChanged.addListener((changes) => {
            if (changes.enabled) {
                this.enabled = changes.enabled.newValue;
            }
            if (changes.searchEngine) {
                this.settings.searchEngine = changes.searchEngine.newValue;
            }
            if (changes.triggerKey) {
                this.settings.triggerKey = changes.triggerKey.newValue;
            }
            if (changes.openInNewTab) {
                this.settings.openInNewTab = changes.openInNewTab.newValue;
            }

            if (changes.showNotifications) {
                this.settings.showNotifications =
                    changes.showNotifications.newValue;
            }
        });

        // Key event listeners
        document.addEventListener("keydown", (e) => this.handleKeyDown(e));
        document.addEventListener("keyup", (e) => this.handleKeyUp(e));

        // Selection change listener - only track selection, don't search yet
        document.addEventListener("selectionchange", () =>
            this.handleSelectionChange()
        );
    }

    handleKeyDown(event) {
        if (!this.enabled) return;

        // Store current event for trigger key checking
        this.currentEvent = event;

        const key = this.getKeyFromEvent(event);
        this.keysPressed.add(key);

        // Check for immediate search when trigger key is pressed
        if (this.isTriggerKeyPressed()) {
            this.checkForImmediateSearch();
        }
    }

    handleKeyUp(event) {
        if (!this.enabled) return;

        // Store current event for trigger key checking
        this.currentEvent = event;

        const key = this.getKeyFromEvent(event);
        this.keysPressed.delete(key);
    }

    handleSelectionChange() {
        if (!this.enabled) return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText !== this.lastSelection) {
            this.lastSelection = selectedText;
            this.selectionStartTime = Date.now();
        } else if (!selectedText) {
            // Selection cleared
            this.lastSelection = "";
            this.pendingSearch = null;
        }
    }

    checkForImmediateSearch() {
        if (this.searchCooldown) return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText) {
            this.pendingSearch = {
                text: selectedText,
                timestamp: Date.now(),
            };
            this.executeSearch();
        }
    }

    executeSearch() {
        if (!this.pendingSearch || this.searchCooldown) return;

        const { text, timestamp } = this.pendingSearch;

        // Check if selection is still valid (not too old)
        if (Date.now() - timestamp > 5000) {
            this.pendingSearch = null;
            return;
        }

        // Set cooldown to prevent multiple searches
        this.searchCooldown = true;
        this.pendingSearch = null;

        // Reset cooldown after 1 second
        setTimeout(() => {
            this.searchCooldown = false;
        }, 1000);

        // Send message to background script
        browser.runtime
            .sendMessage({
                action: "search",
                text: text,
                searchEngine: this.settings.searchEngine,
                openInNewTab: this.settings.openInNewTab,
            })
            .catch((error) => {
                console.warn(
                    "Auto Text Search: Failed to send search message",
                    error
                );
            });

        // Visual feedback (if enabled)
        if (this.settings.showNotifications) {
            this.showSearchFeedback(text);
        }
    }

    getKeyFromEvent(event) {
        // Return the specific key that was pressed, not all active modifiers
        if (event.key === "Control") return "ctrl";
        if (event.key === "Shift") return "shift";
        if (event.key === "Alt") return "alt";
        if (event.key === "Meta") return "cmd";

        // For regular keys, return the key name
        return event.key.toLowerCase();
    }

    isTriggerKeyPressed() {
        const triggerKey = this.settings.triggerKey;

        // Handle combination keys
        if (triggerKey.includes("+")) {
            const keys = triggerKey.split("+").map((k) => k.trim());
            // Check if all required keys are currently pressed (not just in our set)
            return keys.every((key) => {
                switch (key) {
                    case "ctrl":
                        return this.currentEvent?.ctrlKey || false;
                    case "shift":
                        return this.currentEvent?.shiftKey || false;
                    case "alt":
                        return this.currentEvent?.altKey || false;
                    case "cmd":
                        return this.currentEvent?.metaKey || false;
                    default:
                        return this.keysPressed.has(key);
                }
            });
        }

        // Handle single keys - check the actual key state, not our tracking set
        switch (triggerKey) {
            case "ctrl":
                return this.currentEvent?.ctrlKey || false;
            case "shift":
                return this.currentEvent?.shiftKey || false;
            case "alt":
                return this.currentEvent?.altKey || false;
            case "cmd":
                return this.currentEvent?.metaKey || false;
            default:
                return this.keysPressed.has(triggerKey);
        }
    }

    showSearchFeedback(text) {
        // Create temporary visual feedback
        const feedback = document.createElement("div");
        feedback.textContent = `Searching: "${text.substring(0, 30)}${
            text.length > 30 ? "..." : ""
        }"`;
        feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
    `;

        // Add animation styles
        const style = document.createElement("style");
        style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
        document.head.appendChild(style);

        document.body.appendChild(feedback);

        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
            if (style.parentNode) {
                style.remove();
            }
        }, 2000);
    }
}

new AutoTextSearch();
