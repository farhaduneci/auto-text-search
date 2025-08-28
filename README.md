# 📚 Auto Text Search with Definitions - Firefox Extension

A powerful Firefox extension that automatically searches highlighted text and shows instant word definitions with customizable hotkeys and search engines. Simply highlight any text on a webpage and press your configured trigger key to instantly search it or get its definition!

![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-orange?logo=firefox&logoColor=white)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v2-green)
![Feature](https://img.shields.io/badge/NEW-Definitions-red)

## ✨ Features

### Core Features
- **🎯 Instant Search**: Highlight text and press a trigger key to search instantly
- **📖 In-Page Definitions** *(NEW)*: Get instant word definitions without leaving the page
- **🔧 Customizable Hotkeys**: Choose from various key combinations (Alt, Ctrl, Shift, Cmd, and combinations)
- **🌐 Multiple Search Engines**: Support for Google, Bing, and DuckDuckGo
- **📚 Multiple Dictionary Sources** *(NEW)*: Dictionary API, Wiktionary, and Urban Dictionary
- **📱 Smart Tab Management**: Open searches in new tabs or current tab
- **💬 Visual Feedback**: Optional notification popups when searching
- **⚙️ Easy Configuration**: User-friendly popup interface for all settings
- **🔄 Real-time Settings**: Changes apply immediately without restart
- **🌙 Dark Theme UI**: Modern dark interface that's easy on the eyes
- **🚫 Conflict Prevention** *(NEW)*: Smart key binding system prevents conflicting shortcuts

### 🆕 Definition Feature Details
- **Smart Word Detection**: Works with single words and short phrases (up to 3 words)
- **Beautiful Popup Design**: Clean, modern interface that appears near the selected text
- **Rich Information**: Shows pronunciation, part of speech, definitions, and examples
- **Multiple Sources**: Choose between standard dictionary, Wiktionary, or Urban Dictionary
- **Fallback Support**: Automatically tries alternative sources if one fails
- **Non-Intrusive**: Click anywhere outside or press Escape to close
- **Loading Animation**: Shows progress while fetching definitions
- **Quick Actions**: "Search full definition" link for more detailed information
- **No Key Conflicts**: Intelligent system prevents overlapping keyboard shortcuts

## 🚀 How to Use

### Web Search
1. **Highlight** any text on a webpage
2. **Press** your configured search trigger key (default: Alt)
3. **Search** opens automatically in your preferred search engine

### Instant Definitions
1. **Highlight** a word or short phrase
2. **Press** your definition trigger key (default: Ctrl+D)
3. **View** the definition in a beautiful popup right on the page

It's that simple! No right-clicking, no copy-pasting, just highlight and go.

## 📦 Installation

### From Source (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/farhaduneci/auto-text-search.git
   cd auto-text-search
   ```

2. Load the extension in Firefox:
   - Go to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `manifest.json`

3. The extension is now installed and ready to use!

### From Firefox Add-ons Store (Coming Soon)
The extension will be available on the Firefox Add-ons store after review.

## ⚙️ Configuration

Click the extension icon in your toolbar to access settings:

### General Settings
- **Enable/Disable**: Turn the extension on or off

### Search Settings
- **Search Engine**: Choose between Google, Bing, or DuckDuckGo
- **Search Trigger Key**: 
  - Single keys: `Shift`, `Ctrl`, `Alt`, `Cmd` (Mac)
  - Combinations: `Ctrl+Shift`, `Alt+Shift`, `Ctrl+Alt`, `Cmd+Shift`, `Cmd+Alt`

### Definition Settings *(NEW)*
- **Enable Definitions**: Toggle the in-page definition feature
- **Definition Trigger Key**: 
  - Default: `Ctrl+D`
  - Options: `Alt+D`, `Shift+D`, `Cmd+D`, and more combinations
  - **Smart Conflict Prevention**: Keys used for search are automatically disabled in definition options
- **Definition Source**:
  - **Dictionary API**: Standard English dictionary with pronunciations
  - **Wiktionary**: Comprehensive definitions with etymology
  - **Urban Dictionary**: Modern slang and colloquial meanings

### Behavior Settings
- **Open in New Tab**: Choose whether searches open in a new tab or current tab
- **Show Notifications**: Enable/disable visual feedback when searching

### 🎯 Conflict Prevention System
The extension now includes an intelligent conflict prevention system:
- When you select a trigger key for one feature, it becomes unavailable for the other
- Prevents issues like "Shift" for search conflicting with "Shift+D" for definitions
- Disabled options clearly show why they're unavailable
- Automatic conflict resolution when enabling features

## 🛠️ Technical Details

### Architecture
- **Manifest Version**: 2 (compatible with current Firefox)
- **Content Script**: Handles text selection, key detection, and definition popup
- **Background Script**: Manages search execution, tab operations, and API calls
- **Popup Interface**: Provides user-friendly settings management with conflict prevention
- **Definition APIs**: Integrates with multiple dictionary services

### Permissions
- `activeTab`: Access current tab for search operations
- `storage`: Save user preferences
- `https://api.dictionaryapi.dev/*`: Dictionary API access
- `https://en.wiktionary.org/*`: Wiktionary API access
- `https://api.urbandictionary.com/*`: Urban Dictionary API access

## 🔧 Development

### Prerequisites
- Firefox Developer Edition (recommended)
- Basic knowledge of WebExtensions API

### Project Structure
```
auto-text-search/
├── background.js       # Handles search/definition requests and APIs
├── content.js         # Manages user interactions and popup display
├── popup.html         # Settings interface
├── popup.js          # Settings logic with conflict prevention
├── manifest.json     # Extension configuration
├── icons/           # Extension icons
├── LICENSE         # MIT License
└── README.md       # Documentation
```

### Key Components

#### Content Script (`content.js`)
- Monitors text selection events
- Detects trigger key combinations
- Creates and manages definition popup
- Handles visual feedback
- Prevents key conflicts at runtime

#### Background Script (`background.js`)
- Processes search requests
- Fetches definitions from APIs
- Opens new tabs or updates current tab
- Manages search engine URLs
- Handles API fallbacks

#### Popup Interface (`popup.html` + `popup.js`)
- Provides settings configuration
- Implements conflict prevention system
- Syncs with browser storage
- Real-time setting updates
- Dynamic option enabling/disabling

### API Integration

The extension integrates with three dictionary APIs:

1. **Dictionary API** (`api.dictionaryapi.dev`)
   - Free, no authentication required
   - Provides pronunciations and examples
   - Best for standard English words

2. **Wiktionary API** (`en.wiktionary.org`)
   - Comprehensive definitions
   - Includes etymology and usage notes
   - Good for technical terms

3. **Urban Dictionary API** (`api.urbandictionary.com`)
   - Modern slang and colloquialisms
   - User-contributed definitions
   - Best for informal language

## 🎨 Customization

### Adding New Search Engines
Modify the `searchEngines` object in `background.js`:

```javascript
this.searchEngines = {
    google: "https://www.google.com/search?q={query}",
    duckduckgo: "https://duckduckgo.com/?q={query}",
    bing: "https://www.bing.com/search?q={query}",
    // Add your custom search engine here
    yandex: "https://yandex.com/search/?text={query}"
};
```

### Adding New Dictionary Sources
Modify the `definitionAPIs` object in `background.js`:

```javascript
this.definitionAPIs = {
    dictionary: "https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
    wiktionary: "https://en.wiktionary.org/api/rest_v1/page/definition/{word}",
    urban: "https://api.urbandictionary.com/v0/define?term={word}",
    // Add your custom dictionary API here
    custom: "https://your-api.com/define?word={word}"
};
```

### Styling the Definition Popup
Customize the popup appearance in `content.js`:

```javascript
this.definitionPopup.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    // Add your custom styles here
`;
```

## 🐛 Troubleshooting

### Common Issues

**Extension not working on some sites**
- Some websites may prevent content scripts from running
- Try refreshing the page after installing the extension
- Check if the site has Content Security Policy restrictions

**Trigger key not responding**
- Check if another extension or website is capturing the key
- Try a different key combination in settings
- Ensure no conflicts between search and definition triggers

**Definitions not loading**
- Check your internet connection
- Try switching to a different dictionary source
- Some words may not be available in certain dictionaries

**Key conflicts between features**
- The extension prevents conflicting key selections
- If you see disabled options, they're being used by the other feature
- Choose different key combinations for each feature

**Settings not saving**
- Ensure Firefox has permission to access storage
- Try reloading the extension
- Check browser console for error messages

### Debug Mode
1. Open Firefox Developer Tools (F12)
2. Check the Console tab for any error messages
3. Look for messages prefixed with "Auto Text Search:"

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Areas for Improvement
- [x] ~~In-page word definitions~~ ✅ Implemented!
- [x] ~~Conflict prevention for keyboard shortcuts~~ ✅ Implemented!
- [ ] Support for more languages
- [ ] Offline dictionary support
- [ ] Translation feature
- [ ] Custom CSS themes for definition popup
- [ ] Export/import settings
- [ ] Search history with definitions
- [ ] Pronunciation audio playback
- [ ] Synonyms and antonyms display
- [ ] Support for opening highlighted links
- [ ] Keyboard navigation in definition popup
- [ ] Integration with more dictionary APIs
- [ ] Definition caching for offline use
- [ ] Support for medical/technical dictionaries
- [ ] Word of the day feature
- [ ] You say it...

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Dictionary API by [dictionaryapi.dev](https://dictionaryapi.dev)
- Wiktionary API by [Wikimedia](https://www.mediawiki.org/wiki/API:Main_page)
- Urban Dictionary API by [Urban Dictionary](https://www.urbandictionary.com)
- Icons from [Firefox Extension Icons](https://design.firefox.com/)

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/farhaduneci/auto-text-search/issues)
- **Telegram**: [@feriun](https://feriun.t.me)
- **Email**: [your-email@example.com](mailto:your-email@example.com)

## 🎥 Demo

### Search Feature
![Search Demo](https://via.placeholder.com/600x400/1a1a1a/4CAF50?text=Search+Demo)
*Highlight text and press Alt to search instantly*

### Definition Feature
![Definition Demo](https://via.placeholder.com/600x400/1a1a1a/4CAF50?text=Definition+Demo)
*Highlight a word and press Ctrl+D to see its definition*

---

<div align="center">

**Made with ❤️ for Firefox users who love efficiency and learning**

[⭐ Star this repo](https://github.com/farhaduneci/auto-text-search) if you find it useful!

### 🎉 Version 1.1.0 
**Now with instant definitions and smart conflict prevention!**

</div>
