class BackgroundSearchHandler {
    constructor() {
        this.searchEngines = {
            google: "https://www.google.com/search?q={query}",
            duckduckgo: "https://duckduckgo.com/?q={query}",
            bing: "https://www.bing.com/search?q={query}",
        };

        this.definitionAPIs = {
            dictionary: "https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
            wiktionary: "https://en.wiktionary.org/api/rest_v1/page/definition/{word}",
            urban: "https://api.urbandictionary.com/v0/define?term={word}"
        };

        this.setupMessageListener();
    }

    setupMessageListener() {
        browser.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                if (message.action === "search") {
                    this.handleSearch(message);
                    return true;
                } else if (message.action === "getDefinition") {
                    this.handleDefinitionRequest(message, sender.tab.id);
                    return true;
                }
            }
        );
    }

    async handleSearch(data) {
        const { text, searchEngine, openInNewTab } = data;

        if (!text?.trim()) return;

        try {
            const searchUrl = this.buildSearchUrl(searchEngine, text.trim());

            if (openInNewTab) {
                await browser.tabs.create({
                    url: searchUrl,
                    active: false,
                });
            } else {
                const [activeTab] = await browser.tabs.query({
                    active: true,
                    currentWindow: true,
                });

                if (activeTab) {
                    await browser.tabs.update(activeTab.id, { url: searchUrl });
                }
            }
        } catch (error) {
            console.error("Auto Text Search: Search failed", error);
        }
    }

    async handleDefinitionRequest(data, tabId) {
        const { text, source } = data;
        
        try {
            const definition = await this.fetchDefinition(text, source);
            
            // Send the definition back to the content script
            await browser.tabs.sendMessage(tabId, {
                action: "showDefinition",
                data: definition
            });
        } catch (error) {
            console.error("Auto Text Search: Definition fetch failed", error);
            
            // Send error message back
            await browser.tabs.sendMessage(tabId, {
                action: "showDefinition",
                data: {
                    error: "Could not fetch definition. Please try searching instead.",
                    word: text
                }
            });
        }
    }

    async fetchDefinition(word, source) {
        const apiUrl = this.buildDefinitionUrl(source, word);
        
        try {
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Parse based on the source
            if (source === "dictionary") {
                return this.parseDictionaryAPI(data, word);
            } else if (source === "wiktionary") {
                return this.parseWiktionary(data, word);
            } else if (source === "urban") {
                return this.parseUrbanDictionary(data, word);
            }
            
            return {
                word: word,
                error: "Unknown definition source"
            };
        } catch (error) {
            console.error("Definition fetch error:", error);
            
            // Try a fallback dictionary if the primary fails
            if (source !== "dictionary") {
                try {
                    return await this.fetchDefinition(word, "dictionary");
                } catch (fallbackError) {
                    return {
                        word: word,
                        error: "Definition not found"
                    };
                }
            }
            
            return {
                word: word,
                error: "Definition not found"
            };
        }
    }

    parseDictionaryAPI(data, word) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return {
                word: word,
                error: "No definition found"
            };
        }

        const entry = data[0];
        const meanings = [];

        // Extract meanings
        if (entry.meanings && Array.isArray(entry.meanings)) {
            entry.meanings.forEach(meaning => {
                if (meaning.definitions && Array.isArray(meaning.definitions)) {
                    meaning.definitions.slice(0, 2).forEach(def => {
                        meanings.push({
                            partOfSpeech: meaning.partOfSpeech || "unknown",
                            definition: def.definition || "",
                            example: def.example || null
                        });
                    });
                }
            });
        }

        return {
            word: entry.word || word,
            phonetic: entry.phonetic || null,
            meanings: meanings.slice(0, 3) // Limit to 3 meanings
        };
    }

    parseWiktionary(data, word) {
        // Simplified Wiktionary parsing
        // The actual API response structure may vary
        if (!data || typeof data !== 'object') {
            return {
                word: word,
                error: "No definition found"
            };
        }

        const meanings = [];
        
        // Try to extract definitions from various possible structures
        if (data.en && Array.isArray(data.en)) {
            data.en.slice(0, 3).forEach(entry => {
                if (entry.definitions && Array.isArray(entry.definitions)) {
                    entry.definitions.slice(0, 1).forEach(def => {
                        meanings.push({
                            partOfSpeech: entry.partOfSpeech || "unknown",
                            definition: def.definition || "",
                            example: null
                        });
                    });
                }
            });
        }

        return {
            word: word,
            phonetic: null,
            meanings: meanings
        };
    }

    parseUrbanDictionary(data, word) {
        if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
            return {
                word: word,
                error: "No definition found"
            };
        }

        const meanings = data.list.slice(0, 2).map(entry => ({
            partOfSpeech: "slang",
            definition: entry.definition ? entry.definition.replace(/[\[\]]/g, '') : "",
            example: entry.example ? entry.example.replace(/[\[\]]/g, '') : null
        }));

        return {
            word: word,
            phonetic: null,
            meanings: meanings
        };
    }

    buildSearchUrl(engineKey, query) {
        const template =
            this.searchEngines[engineKey] || this.searchEngines.google;
        return template.replace("{query}", encodeURIComponent(query));
    }

    buildDefinitionUrl(source, word) {
        const template = this.definitionAPIs[source] || this.definitionAPIs.dictionary;
        return template.replace("{word}", encodeURIComponent(word.toLowerCase()));
    }
}

new BackgroundSearchHandler();
