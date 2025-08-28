class AutoTextSearch {
    constructor() {
        this.enabled = true;
        this.settings = {
            searchEngine: "google",
            triggerKey: "alt",
            openInNewTab: true,
            showNotifications: true,
            enableInPageDefinition: false,
            definitionTriggerKey: "ctrl+d",
            definitionSource: "dictionary"
        };

        this.keysPressed = new Set();
        this.lastSelection = "";
        this.searchCooldown = false;
        this.pendingSearch = null;
        this.selectionStartTime = 0;
        this.currentEvent = null;
        this.definitionPopup = null;
        
        // Add delay mechanism to prevent conflicts
        this.keyPressTimeout = null;
        this.waitingForCombo = false;
        this.comboWaitTime = 100; // milliseconds to wait for combo keys

        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.createDefinitionPopup();
    }

    async loadSettings() {
        try {
            const result = await browser.storage.sync.get([
                "enabled",
                "searchEngine",
                "triggerKey",
                "openInNewTab",
                "showNotifications",
                "enableInPageDefinition",
                "definitionTriggerKey",
                "definitionSource"
            ]);

            this.enabled = result.enabled !== false;
            this.settings = {
                searchEngine: result.searchEngine || "google",
                triggerKey: result.triggerKey || "alt",
                openInNewTab: result.openInNewTab !== false,
                showNotifications: result.showNotifications !== false,
                enableInPageDefinition: result.enableInPageDefinition || false,
                definitionTriggerKey: result.definitionTriggerKey || "ctrl+d",
                definitionSource: result.definitionSource || "dictionary"
            };

            // Initialize default settings in storage if they don't exist
            const defaultSettings = {
                enabled: true,
                searchEngine: "google",
                triggerKey: "alt",
                openInNewTab: true,
                showNotifications: true,
                enableInPageDefinition: false,
                definitionTriggerKey: "ctrl+d",
                definitionSource: "dictionary"
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
                this.settings.showNotifications = changes.showNotifications.newValue;
            }
            if (changes.enableInPageDefinition) {
                this.settings.enableInPageDefinition = changes.enableInPageDefinition.newValue;
            }
            if (changes.definitionTriggerKey) {
                this.settings.definitionTriggerKey = changes.definitionTriggerKey.newValue;
            }
            if (changes.definitionSource) {
                this.settings.definitionSource = changes.definitionSource.newValue;
            }
        });

        // Key event listeners
        document.addEventListener("keydown", (e) => this.handleKeyDown(e));
        document.addEventListener("keyup", (e) => this.handleKeyUp(e));

        // Selection change listener
        document.addEventListener("selectionchange", () =>
            this.handleSelectionChange()
        );

        // Click outside to close popup
        document.addEventListener("click", (e) => {
            if (this.definitionPopup && !this.definitionPopup.contains(e.target)) {
                this.hideDefinitionPopup();
            }
        });

        // Listen for messages from background script
        browser.runtime.onMessage.addListener((message) => {
            if (message.action === "showDefinition") {
                this.displayDefinition(message.data);
            }
        });
    }

    createDefinitionPopup() {
        // Create the popup element but keep it hidden
        this.definitionPopup = document.createElement("div");
        this.definitionPopup.id = "ats-definition-popup";
        this.definitionPopup.style.cssText = `
            position: absolute;
            display: none;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            max-width: 400px;
            min-width: 250px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #333;
            line-height: 1.6;
        `;
        document.body.appendChild(this.definitionPopup);
    }

    handleKeyDown(event) {
        if (!this.enabled) return;

        // Store current event for trigger key checking
        this.currentEvent = event;

        const key = this.getKeyFromEvent(event);
        this.keysPressed.add(key);

        // Clear any existing timeout
        if (this.keyPressTimeout) {
            clearTimeout(this.keyPressTimeout);
            this.keyPressTimeout = null;
        }

        // Check if current keys might be part of a combination
        const mightBeCombo = this.mightBePartOfCombo(event);
        
        if (mightBeCombo) {
            // Wait a bit to see if more keys are pressed (combo)
            this.waitingForCombo = true;
            this.keyPressTimeout = setTimeout(() => {
                this.processKeyPress();
                this.waitingForCombo = false;
            }, this.comboWaitTime);
        } else if (!this.waitingForCombo) {
            // Process immediately if not waiting for combo
            this.processKeyPress();
        }
    }

    handleKeyUp(event) {
        if (!this.enabled) return;

        const key = this.getKeyFromEvent(event);
        this.keysPressed.delete(key);
        
        // Clear the current event when all modifier keys are released
        if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            this.currentEvent = null;
        }
    }

    mightBePartOfCombo(event) {
        // Check if this key press might be part of a combination
        const searchKey = this.settings.triggerKey;
        const defKey = this.settings.definitionTriggerKey;
        
        // If either trigger contains a combo, and we're pressing a modifier
        const hasComboTriggers = searchKey.includes('+') || defKey.includes('+');
        const isModifier = event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
        
        // If definition feature is enabled and we have combo triggers
        if (this.settings.enableInPageDefinition && hasComboTriggers && isModifier) {
            // Check if this modifier is the start of either combo
            const modifierKey = this.getModifierName(event);
            
            // Check if this modifier is part of a combo trigger
            const isPartOfSearchCombo = searchKey.includes('+') && searchKey.toLowerCase().includes(modifierKey);
            const isPartOfDefCombo = defKey.includes('+') && defKey.toLowerCase().includes(modifierKey);
            
            return isPartOfSearchCombo || isPartOfDefCombo;
        }
        
        return false;
    }

    getModifierName(event) {
        if (event.ctrlKey) return "ctrl";
        if (event.shiftKey) return "shift";
        if (event.altKey) return "alt";
        if (event.metaKey) return "cmd";
        return "";
    }

    processKeyPress() {
        // First check for definition trigger (if enabled)
        if (this.settings.enableInPageDefinition && this.isDefinitionTriggerPressed()) {
            this.checkForDefinition();
            return; // Stop here, don't check for search trigger
        }
        
        // Then check for search trigger
        if (this.isTriggerKeyPressed()) {
            // Only trigger search if it's not part of a definition combo
            if (!this.isPartOfDefinitionCombo()) {
                this.checkForImmediateSearch();
            }
        }
    }

    isPartOfDefinitionCombo() {
        // Check if current keys are part of the definition trigger combo
        if (!this.settings.enableInPageDefinition) return false;
        
        const defTrigger = this.settings.definitionTriggerKey;
        if (!defTrigger.includes('+')) return false;
        
        // Get current modifiers
        const currentModifiers = [];
        if (this.currentEvent?.ctrlKey) currentModifiers.push('ctrl');
        if (this.currentEvent?.shiftKey) currentModifiers.push('shift');
        if (this.currentEvent?.altKey) currentModifiers.push('alt');
        if (this.currentEvent?.metaKey) currentModifiers.push('cmd');
        
        // Check if current modifiers are ALL part of definition trigger
        const defParts = defTrigger.toLowerCase().split('+').map(p => p.trim());
        return currentModifiers.every(mod => defParts.includes(mod)) && currentModifiers.length > 0;
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
            this.hideDefinitionPopup();
        }
    }

    checkForDefinition() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText) {
            // Check if it's a single word or short phrase
            const wordCount = selectedText.split(/\s+/).length;
            
            if (wordCount <= 3) {
                // Request definition from background script
                browser.runtime
                    .sendMessage({
                        action: "getDefinition",
                        text: selectedText,
                        source: this.settings.definitionSource
                    })
                    .catch((error) => {
                        console.warn("Auto Text Search: Failed to get definition", error);
                    });

                // Show loading state
                this.showDefinitionLoading(selection);
            } else {
                // Too many words for definition, maybe show a message
                this.showDefinitionMessage(
                    selection,
                    "Please select a single word or short phrase for definition."
                );
            }
        }
    }

    showDefinitionLoading(selection) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        
        this.definitionPopup.innerHTML = `
            <div style="text-align: center; color: #666;">
                <div style="font-size: 24px; animation: spin 1s linear infinite;">⚙</div>
                <p style="margin: 8px 0 0 0;">Loading definition...</p>
            </div>
        `;

        // Add spinning animation
        if (!document.getElementById("ats-spinner-style")) {
            const style = document.createElement("style");
            style.id = "ats-spinner-style";
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        this.positionPopup(rect);
        this.definitionPopup.style.display = "block";
    }

    showDefinitionMessage(selection, message) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        
        this.definitionPopup.innerHTML = `
            <div style="color: #666;">
                <p style="margin: 0;">${message}</p>
            </div>
        `;

        this.positionPopup(rect);
        this.definitionPopup.style.display = "block";

        // Auto-hide after 3 seconds
        setTimeout(() => this.hideDefinitionPopup(), 3000);
    }

    displayDefinition(data) {
        if (!data || !this.definitionPopup) return;

        let content = "";
        
        if (data.error) {
            content = `
                <div style="color: #e74c3c;">
                    <strong>Error:</strong> ${data.error}
                </div>
            `;
        } else {
            content = `
                <div>
                    <h3 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 18px;">
                        ${data.word}
                    </h3>
            `;

            if (data.phonetic) {
                content += `
                    <p style="margin: 0 0 12px 0; color: #7f8c8d; font-style: italic;">
                        ${data.phonetic}
                    </p>
                `;
            }

            if (data.meanings && data.meanings.length > 0) {
                data.meanings.forEach((meaning, index) => {
                    if (index < 2) { // Show only first 2 meanings
                        content += `
                            <div style="margin-bottom: 12px;">
                                <strong style="color: #3498db; text-transform: capitalize;">
                                    ${meaning.partOfSpeech}
                                </strong>
                                <p style="margin: 4px 0; color: #555;">
                                    ${meaning.definition}
                                </p>
                        `;
                        
                        if (meaning.example) {
                            content += `
                                <p style="margin: 4px 0; padding-left: 16px; color: #7f8c8d; 
                                         font-style: italic; border-left: 3px solid #ecf0f1;">
                                    "${meaning.example}"
                                </p>
                            `;
                        }
                        
                        content += `</div>`;
                    }
                });
            }

            content += `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ecf0f1;">
                    <a href="#" id="ats-search-more" style="color: #3498db; text-decoration: none; 
                                                            font-size: 12px;">
                        Search full definition →
                    </a>
                </div>
            </div>
            `;
        }

        this.definitionPopup.innerHTML = content;

        // Add click handler for "search more" link
        const searchLink = document.getElementById("ats-search-more");
        if (searchLink) {
            searchLink.addEventListener("click", (e) => {
                e.preventDefault();
                this.hideDefinitionPopup();
                // Trigger regular search
                this.pendingSearch = {
                    text: data.word,
                    timestamp: Date.now()
                };
                this.executeSearch();
            });
        }
    }

    positionPopup(rect) {
        const popup = this.definitionPopup;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        // Position below the selection
        let top = rect.bottom + scrollY + 10;
        let left = rect.left + scrollX;

        // Check if popup would go off screen
        const popupRect = popup.getBoundingClientRect();
        
        // Adjust if too close to right edge
        if (left + 400 > window.innerWidth) {
            left = window.innerWidth - 420;
        }
        
        // Adjust if too close to bottom
        if (top + 200 > window.innerHeight + scrollY) {
            top = rect.top + scrollY - 220; // Show above selection
        }

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
    }

    hideDefinitionPopup() {
        if (this.definitionPopup) {
            this.definitionPopup.style.display = "none";
        }
    }

    isDefinitionTriggerPressed() {
        const triggerKey = this.settings.definitionTriggerKey;
        return this.isExactKeyComboPressed(triggerKey);
    }

    isTriggerKeyPressed() {
        const triggerKey = this.settings.triggerKey;
        return this.isExactKeyComboPressed(triggerKey);
    }

    isExactKeyComboPressed(keyCombo) {
        // Check for exact key combination match
        if (keyCombo.includes("+")) {
            const keys = keyCombo.toLowerCase().split("+").map((k) => k.trim());
            const modifiers = keys.filter(k => ['ctrl', 'shift', 'alt', 'cmd'].includes(k));
            const regularKeys = keys.filter(k => !['ctrl', 'shift', 'alt', 'cmd'].includes(k));
            
            // Check all required modifiers are pressed
            const modifiersPressed = 
                modifiers.every(mod => {
                    switch (mod) {
                        case "ctrl": return this.currentEvent?.ctrlKey;
                        case "shift": return this.currentEvent?.shiftKey;
                        case "alt": return this.currentEvent?.altKey;
                        case "cmd": return this.currentEvent?.metaKey;
                        default: return false;
                    }
                });
            
            // Check no extra modifiers are pressed
            const noExtraModifiers = 
                (!modifiers.includes("ctrl") ? !this.currentEvent?.ctrlKey : true) &&
                (!modifiers.includes("shift") ? !this.currentEvent?.shiftKey : true) &&
                (!modifiers.includes("alt") ? !this.currentEvent?.altKey : true) &&
                (!modifiers.includes("cmd") ? !this.currentEvent?.metaKey : true);
            
            // Check regular keys
            const regularKeysPressed = regularKeys.every(key => this.keysPressed.has(key));
            
            return modifiersPressed && noExtraModifiers && regularKeysPressed;
        } else {
            // Single key check - make sure NO modifiers are pressed
            const noModifiers = !this.currentEvent?.ctrlKey && 
                               !this.currentEvent?.shiftKey && 
                               !this.currentEvent?.altKey && 
                               !this.currentEvent?.metaKey;
            
            switch (keyCombo) {
                case "ctrl": return this.currentEvent?.ctrlKey && !this.currentEvent?.shiftKey && !this.currentEvent?.altKey && !this.currentEvent?.metaKey;
                case "shift": return this.currentEvent?.shiftKey && !this.currentEvent?.ctrlKey && !this.currentEvent?.altKey && !this.currentEvent?.metaKey;
                case "alt": return this.currentEvent?.altKey && !this.currentEvent?.ctrlKey && !this.currentEvent?.shiftKey && !this.currentEvent?.metaKey;
                case "cmd": return this.currentEvent?.metaKey && !this.currentEvent?.ctrlKey && !this.currentEvent?.shiftKey && !this.currentEvent?.altKey;
                default: return noModifiers && this.keysPressed.has(keyCombo);
            }
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
        // Return the specific key that was pressed
        if (event.key === "Control") return "ctrl";
        if (event.key === "Shift") return "shift";
        if (event.key === "Alt") return "alt";
        if (event.key === "Meta") return "cmd";

        // For regular keys, return the key name
        return event.key.toLowerCase();
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
