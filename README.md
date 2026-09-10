

## Project Structure

```
redtooth-website/
├── index.html                      # Main landing page
├── encode.html                     # SVG encoding tool
├── decode.html                     # SVG decoding tool
├── learn-more.html                 # Information hub page
├── what-redtooth-is.html          # About Redtooth protocol
├── how-it-works.html              # Comparison with traditional communication
├── future-of-communication.html   # Redtooth Wide-Network (RWN) future vision
├── codec.js                       # Encoding/decoding JavaScript logic
├── style.css                      # Stylesheet for encode/decode pages
├── redtooth-logo.svg              # Favicon
├── redtooth_logo.jpg              # Main logo image
├── redtooth_par.rar               # Beta download file
├── .vscode/                       # VS Code settings
├── logos/                         # Logo folder (deprecated - logos moved to root)
├── downloads/                     # Download storage folder
└── uploads/                       # Upload storage folder
```


## Getting Started

1. Open `index.html` in a web browser to view the landing page
2. Click "Download Redtooth Beta" to download the beta version
3. Click "Test Beta" to try the encoding/decoding tools
4. Click "Learn More" to explore information about Redtooth



### Encoding
1. Navigate to `encode.html`
2. Upload an SVG file via drag-and-drop or file browser
3. Click "Inscribe" to generate transmission code
4. Copy the code or save as .txt file
5. Share the code with the recipient

### Decoding
1. Navigate to `decode.html`
2. Paste or type the received transmission code
3. Click "Revert" to decode
4. Verify checksum (if provided)
5. Download the restored SVG file

## File Requirements

- **Encode**: Accepts only `.svg` files
- **Decode**: Accepts Redtooth transmission code format
- **Downloads**: Beta file available as `.rar` archive



## Notes

- Logo files have been moved from `logos/` folder to root directory
- Navigation bars removed from information pages for cleaner focus
- Feature section commented out on landing page per user preference
- Empty `downloads/` and `uploads/` folders reserved for future functionality

## License

© 2026 Redtooth. All rights reserved.
