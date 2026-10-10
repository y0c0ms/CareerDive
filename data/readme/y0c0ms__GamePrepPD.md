# GamePrep - Liga Portugal & Pingo Doce Finder

GamePrep is a data-driven dashboard that helps football fans find the closest Pingo Doce stores to their match venues in Portugal. 

## ✨ Features
- **Real-time Match Data**: Automatically updated via Flashscore scraping.
- **Stadium Proximity**: Calculates the nearest stores using stadium coordinates.
- **Store Details**: Name, address, and opening hours for pre-match shopping.
- **Automated Updates**: Powered by GitHub Actions every 12 hours.
- **Premium Design**: Built with React + Vite and glassmorphism styling.

## 🛠️ Architecture
1. **Flashscore Scraper (Node.js/Playwright)**: Extracts Liga Portugal matches.
2. **Matching Engine (Python)**: Uses Haversine distance to pair stadiums with Pingo Doce stores from OpenStreetMap.
3. **React Dashboard**: Modern frontend displaying the results.

## 🚀 Deployment
This project is designed to be hosted on **Cloudflare Pages**.
- **Host**: [GamePrep Dashboard](https://your-site.pages.dev)
- **CI/CD**: GitHub Actions updates the `matches.json` data, triggering an automatic redeploy.

## 💻 Local Development
```bash
# To run the dashboard
cd dashboard
bun install
bun dev

# To manual update data
node FlashscoreScraping/src/index.js country=portugal league=liga-portugal
python3 match_locations.py
```

## 🏗️ Project Structure
- `.github/workflows/`: Automation scripts.
- `dashboard/`: React application.
- `FlashscoreScraping/`: Scraper module.
- `match_locations.py`: Matching logic.
- `stadiums.json`: Coordinate database.
