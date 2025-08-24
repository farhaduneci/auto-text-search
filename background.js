class BackgroundSearchHandler {
    constructor() {
        this.searchEngines = {
            google: "https://www.google.com/search?q={query}",
            duckduckgo: "https://duckduckgo.com/?q={query}",
            bing: "https://www.bing.com/search?q={query}",
        };

        this.setupMessageListener();
    }

    setupMessageListener() {
        browser.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                if (message.action === "search") {
                    this.handleSearch(message);
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

    buildSearchUrl(engineKey, query) {
        const template =
            this.searchEngines[engineKey] || this.searchEngines.google;
        return template.replace("{query}", encodeURIComponent(query));
    }
}

new BackgroundSearchHandler();
