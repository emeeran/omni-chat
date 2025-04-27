# OmniChat HTML/CSS/JSX Version

This is a simplified HTML/CSS/JSX version of the OmniChat application, converted from the original Next.js frontend.

## Project Structure

- `index.html` - The main HTML file
- `css/styles.css` - CSS styling
- `js/` - JavaScript and JSX files
  - `components/` - React components
  - `App.jsx` - Main application component
  - `index.jsx` - Entry point for React rendering
- `server.js` - Simple Node.js HTTP server

## Running the Application

1. Make sure you have Node.js installed
2. Navigate to this directory in a terminal
3. Start the server:

```bash
node server.js
```

4. Open your browser and navigate to: http://localhost:3000

## Features

- Chat interface with user and AI messages
- Code block formatting with syntax highlighting
- Copy and run code buttons
- Dark/light mode toggle
- Responsive design

## Implementation Details

This version uses:
- Plain HTML/CSS
- React loaded via CDN (no build step required)
- Browser-based Babel transformation for JSX
- highlight.js for code syntax highlighting

## Differences from Next.js Version

- No server-side rendering
- No TypeScript
- No module bundling
- Simplified component structure
- Basic CSS instead of Tailwind
- In-browser JSX transformation 