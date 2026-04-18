# Supply Chain Attack Simulator

An interactive browser-based visualisation that simulates how a compromised dependency propagates through a software supply chain - from a malicious leaf package all the way up to the root system.

Built as a learning tool for understanding real-world supply chain attacks like SolarWinds, XZ Utils, and npm package hijacking.

![Demo](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

- Renders a live dependency tree from a JSON file using D3.js
- Lets you select any package in the tree as the attack vector
- Flashes the target node before propagation begins so you can clearly see where the infection starts
- Animates the compromise spreading upward through the dependency chain, one node at a time
- Highlights nodes as **Safe**, **At Risk**, or **Compromised** with colour and glow effects
- Includes a **colorblind mode** that replaces colour-only encoding with distinct shapes (circle / diamond / square ×) and dashed edge patterns

---

## Project structure

```
supply-chain-simulator/
├── index.html              # Main HTML shell
├── style.css               # Dark UI styles
├── script.js               # D3 graph logic, propagation engine, CB mode
└── data/
    └── dependencies.json   # Dependency tree (edit this to model your own system)
```

---

## Getting started

### Prerequisites

- A modern browser (Chrome, Firefox, Edge, Safari)
- A local web server (required because `fetch()` won't work from `file://`)

### Option 1 - Python (simplest, no install needed)

```bash
git clone https://github.com/YOUR_USERNAME/supply-chain-simulator.git
cd supply-chain-simulator
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Option 2 - Node.js / npx

```bash
git clone https://github.com/YOUR_USERNAME/supply-chain-simulator.git
cd supply-chain-simulator
npx serve .
```

### Option 3 - VS Code Live Server

Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer), open the folder, and click **Go Live** in the status bar.

---

## How to use

1. Start the local server and open the app in your browser
2. The dependency tree renders automatically from `data/dependencies.json`
3. Click any package in the left sidebar to select it as the attack target
4. Click **Inject Attack** - the target node will flash to signal the injection point, then the compromise propagates upward through the tree
5. Click **Reset** to clear all state and run again with a different target
6. Toggle **Colorblind mode** in the sidebar to switch from colour-only encoding to shape-based encoding

### Node states

| State | Normal mode | Colorblind mode |
|---|---|---|
| Safe | Green circle | Blue circle |
| At Risk | Yellow circle | Orange diamond |
| Compromised | Red circle + glow | Dark square with × |

---

## Customising the dependency tree

Edit `data/dependencies.json` to model your own system. The format is a recursive tree:

```json
{
  "name": "My-App",
  "dependencies": [
    {
      "name": "Auth-Service",
      "dependencies": [
        { "name": "JWT-Handler", "dependencies": [] },
        { "name": "Crypto-Lib", "dependencies": [] }
      ]
    },
    {
      "name": "Payment-Service",
      "dependencies": [
        { "name": "Stripe-SDK", "dependencies": [] }
      ]
    }
  ]
}
```

Reload the page after saving - no build step needed.

---

## Tech stack

| Tool | Purpose |
|---|---|
| [D3.js v7](https://d3js.org/) | Tree layout and SVG rendering |
| Vanilla JS (ES6+) | Propagation logic, state management |
| CSS custom properties | Theming and dark UI |
| Python / npx serve | Local dev server |

No frameworks. No build tools. No `node_modules`. Just open and run.

---

## Real-world context

This simulator is inspired by actual supply chain attacks:

- **SolarWinds (2020)** - Malicious code injected into a build pipeline, compromising thousands of downstream customers
- **XZ Utils (2024)** - A backdoor planted in a widely-used compression library, targeting SSH servers
- **event-stream (2018)** - A malicious npm package injected into a popular library's dependency chain

The key insight all three share: **attacking a dependency is often easier than attacking the target directly**, because the target implicitly trusts its dependencies.

---

## Roadmap / ideas

- [ ] Load custom JSON from file upload in the browser
- [ ] Add a "patch" mode that lets you mark nodes as fixed and re-run the simulation
- [ ] Export the compromised tree as a report
- [ ] Add SBOM (Software Bill of Materials) import support
- [ ] Animate individual edges lighting up as infection travels along them

---

## License

MIT 
