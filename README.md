# 🔍 Auto Text Search - Firefox Extension

A powerful Firefox extension that automatically searches highlighted text with customizable hotkeys and search engines. Simply highlight any text on a webpage and press your configured trigger key to instantly search it!

![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-orange?logo=firefox&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v2-green)

## ✨ Features

- **🎯 Instant Search**: Highlight text and press a trigger key to search instantly
- **🔧 Customizable Hotkeys**: Choose from various key combinations (Alt, Ctrl, Shift, Cmd, and combinations)
- **🌐 Multiple Search Engines**: Support for Google, Bing, and DuckDuckGo
- **📱 Smart Tab Management**: Open searches in new tabs or current tab
- **💬 Visual Feedback**: Optional notification popups when searching
- **⚙️ Easy Configuration**: User-friendly popup interface for all settings
- **🔄 Real-time Settings**: Changes apply immediately without restart
- **🌙 Dark Theme UI**: Modern dark interface that's easy on the eyes

## 🚀 How to Use

1. **Highlight** any text on a webpage
2. **Press** your configured trigger key (default: Alt)
3. **Search** opens automatically in your preferred search engine

It's that simple! No right-clicking, no copy-pasting, just highlight and search.

## 📦 Installation

### From Firefox Add-ons Store

1. Go to [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/auto-text-search/)
2. Click "Add to Firefox"
3. The extension is now installed and ready to use!

## ⚙️ Configuration

Click the extension icon in your toolbar to access settings:

### General Settings
- **Enable/Disable**: Turn the extension on or off
- **Search Engine**: Choose between Google, Bing, or DuckDuckGo

### Trigger Key Options
- Single keys: `Shift`, `Ctrl`, `Alt`, `Cmd` (Mac)
- Key combinations: `Ctrl+Shift`, `Alt+Shift`, `Ctrl+Alt`, `Cmd+Shift`, `Cmd+Alt`

### Behavior Settings
- **Open in New Tab**: Choose whether searches open in a new tab or current tab
- **Show Notifications**: Enable/disable visual feedback when searching

## 🛠️ Technical Details

### Architecture
- **Manifest Version**: 2 (compatible with current Firefox)
- **Content Script**: Handles text selection and key detection
- **Background Script**: Manages search execution and tab operations
- **Popup Interface**: Provides user-friendly settings management

### Permissions
- `activeTab`: Access current tab for search operations
- `storage`: Save user preferences

## 🔧 Development

### Prerequisites
- Firefox Developer Edition (recommended)
- Basic knowledge of WebExtensions API

### Local Development
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

3. Make your changes and reload the extension to test

### Key Components

#### Content Script (`content.js`)
- Monitors text selection events
- Detects trigger key combinations
- Handles visual feedback
- Communicates with background script

#### Background Script (`background.js`)
- Processes search requests
- Opens new tabs or updates current tab
- Manages search engine URLs

#### Popup Interface (`popup.html` + `popup.js`)
- Provides settings configuration
- Syncs with browser storage
- Real-time setting updates

## 🎨 Customization

### Adding New Search Engines
To add a new search engine, modify the `searchEngines` object in `background.js`:

```javascript
this.searchEngines = {
    google: "https://www.google.com/search?q={query}",
    duckduckgo: "https://duckduckgo.com/?q={query}",
    bing: "https://www.bing.com/search?q={query}",
    // Add your custom search engine here
    yandex: "https://yandex.com/search/?text={query}"
};
```

Don't forget to update the popup interface to include the new option!

### Styling the Popup
The popup uses a modern dark theme. You can customize colors and styles in the `<style>` section of `popup.html`.

## 🐛 Troubleshooting

### Common Issues

**Extension not working on some sites**
- Some websites may prevent content scripts from running
- Try refreshing the page after installing the extension

**Trigger key not responding**
- Check if another extension or website is capturing the key
- Try a different key combination in settings

**Settings not saving**
- Ensure Firefox has permission to access storage
- Try reloading the extension

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
- [ ] Add more search engines
- [ ] Implement custom search engine support
- [ ] Add keyboard shortcut customization
- [ ] Create options page for advanced settings
- [ ] Add internationalization (i18n) support
- [ ] Implement search history

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/farhaduneci/auto-text-search/issues)
- **Telegram**: [@feriun](https://feriun.t.me)

---

<div align="center">

**Made with ❤️ for Firefox users who love efficiency**

[⭐ Star this repo](https://github.com/farhaduneci/auto-text-search) if you find it useful!

</div>
