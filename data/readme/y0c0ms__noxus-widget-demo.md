# Noxus Cloudflare Pages Domain Locking Demo

A minimal, zero-dependency static HTML demonstration deployed on **Cloudflare Pages** (`https://<project-name>.pages.dev`) to test and prove Noxus **Domain Locking** and **Content-Security-Policy** enforcement.

## Overview

This repository demonstrates Noxus domain restriction enforcement using standard browser CSP headers (`Content-Security-Policy: frame-ancestors`).

When hosted on Cloudflare Pages:
1. **If Cloudflare Pages origin is NOT in Noxus Allowed Domains**:
   Opening the Cloudflare Pages URL in Chrome/Edge will fail to frame the widget, throwing a CSP Security Error in DevTools console:
   `Refused to frame 'https://noxus.jmartins.com/' because it violates the following Content Security Policy directive: "frame-ancestors ..."`
2. **If Cloudflare Pages origin IS added to Noxus Allowed Domains**:
   The widget frames successfully and authenticates with HS256 signed JWT tokens.

## Deployment to Cloudflare Pages

1. Create a new Cloudflare Pages project linked to this Git repository.
2. Build Settings:
   - **Framework Preset**: None (Static HTML)
   - **Build Command**: Leave empty
   - **Build Output Directory**: `/` (or leave empty)
3. Deploy! Cloudflare will generate your live URL (e.g. `https://noxus-widget-demo.pages.dev`).

## Testing Domain Restriction

1. In your Noxus Dashboard under **Deployments → Widget → Access & Security**:
   - Toggle **Restrict embedding to allowed domains** $\rightarrow$ **ON**.
   - Set **Allowed domains** to a domain *other than* your Cloudflare Pages URL (e.g. `https://recheio.pt`).
2. Visit your Cloudflare Pages URL in Chrome.
3. Open DevTools (`F12` $\rightarrow$ **Console** tab).
4. Observe Chrome blocking the iframe with the CSP `frame-ancestors` violation error!
