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
                // Too many words for definition
                this.showDefinitionMessage(
                    selection,
                    "Please select a single word or short phrase for definition."
                );
            }
        }
    }

    showDefinitionLoading(selection) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        
        // Clear existing content safely
        while (this.definitionPopup.firstChild) {
            this.definitionPopup.removeChild(this.definitionPopup.firstChild);
        }

        // Create loading container
        const container = document.createElement("div");
        container.style.textAlign = "center";
        container.style.color = "#666";

        // Create spinner
        const spinner = document.createElement("div");
        spinner.textContent = "⚙";
        spinner.style.fontSize = "24px";
        spinner.style.animation = "spin 1s linear infinite";

        // Create loading text
        const loadingText = document.createElement("p");
        loadingText.textContent = "Loading definition...";
        loadingText.style.margin = "8px 0 0 0";

        container.appendChild(spinner);
        container.appendChild(loadingText);
        this.definitionPopup.appendChild(container);

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
        
        // Clear existing content safely
        while (this.definitionPopup.firstChild) {
            this.definitionPopup.removeChild(this.definitionPopup.firstChild);
        }

        // Create message container
        const container = document.createElement("div");
        container.style.color = "#666";

        const messageText = document.createElement("p");
        messageText.textContent = message;
        messageText.style.margin = "0";

        container.appendChild(messageText);
        this.definitionPopup.appendChild(container);

        this.positionPopup(rect);
        this.definitionPopup.style.display = "block";

        // Auto-hide after 3 seconds
        setTimeout(() => this.hideDefinitionPopup(), 3000);
    }

    displayDefinition(data) {
        if (!data || !this.definitionPopup) return;

        // Clear existing content safely
        while (this.definitionPopup.firstChild) {
            this.definitionPopup.removeChild(this.definitionPopup.firstChild);
        }

        const container = document.createElement("div");

        if (data.error) {
            // Error message
            const errorDiv = document.createElement("div");
            errorDiv.style.color = "#e74c3c";
            
            const errorStrong = document.createElement("strong");
            errorStrong.textContent = "Error: ";
            
            const errorText = document.createTextNode(data.error);
            
            errorDiv.appendChild(errorStrong);
            errorDiv.appendChild(errorText);
            container.appendChild(errorDiv);
        } else {
            // Word title
            const title = document.createElement("h3");
            title.textContent = data.word;
            title.style.margin = "0 0 12px 0";
            title.style.color = "#2c3e50";
            title.style.fontSize = "18px";
            container.appendChild(title);

            // Phonetic
            if (data.phonetic) {
                const phonetic = document.createElement("p");
                phonetic.textContent = data.phonetic;
                phonetic.style.margin = "0 0 12px 0";
                phonetic.style.color = "#7f8c8d";
                phonetic.style.fontStyle = "italic";
                container.appendChild(phonetic);
            }

            // Meanings
            if (data.meanings && data.meanings.length > 0) {
                data.meanings.forEach((meaning, index) => {
                    if (index < 2) { // Show only first 2 meanings
                        const meaningDiv = document.createElement("div");
                        meaningDiv.style.marginBottom = "12px";

                        // Part of speech
                        const partOfSpeech = document.createElement("strong");
                        partOfSpeech.textContent = meaning.partOfSpeech;
                        partOfSpeech.style.color = "#3498db";
                        partOfSpeech.style.textTransform = "capitalize";
                        meaningDiv.appendChild(partOfSpeech);

                        // Definition
                        const definition = document.createElement("p");
                        definition.textContent = meaning.definition;
                        definition.style.margin = "4px 0";
                        definition.style.color = "#555";
                        meaningDiv.appendChild(definition);

                        // Example
                        if (meaning.example) {
                            const example = document.createElement("p");
                            example.textContent = `"${meaning.example}"`;
                            example.style.margin = "4px 0";
                            example.style.paddingLeft = "16px";
                            example.style.color = "#7f8c8d";
                            example.style.fontStyle = "italic";
                            example.style.borderLeft = "3px solid #ecf0f1";
                            meaningDiv.appendChild(example);
                        }

                        container.appendChild(meaningDiv);
                    }
                });
            }

            // Search more link
            const linkContainer = document.createElement("div");
            linkContainer.style.marginTop = "12px";
            linkContainer.style.paddingTop = "12px";
            linkContainer.style.borderTop = "1px solid #ecf0f1";

            const searchLink = document.createElement("a");
            searchLink.href = "#";
            searchLink.id = "ats-search-more";
            searchLink.textContent = "Search full definition →";
            searchLink.style.color = "#3498db";
            searchLink.style.textDecoration = "none";
            searchLink.style.fontSize = "12px";

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

            linkContainer.appendChild(searchLink);
            container.appendChild(linkContainer);
        }

        this.definitionPopup.appendChild(container);
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
        
        // Safely add text content
        const truncatedText = text.substring(0, 30);
        const displayText = truncatedText + (text.length > 30 ? "..." : "");
        feedback.textContent = `Searching: "${displayText}"`;
        
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
