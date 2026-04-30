# Architecture

## High-Level

Browser Extension (Content Scripts + Background)
- Injects UI into GitHub pages
- Calls GitHub REST API
- Stores lightweight cache locally

## Components

- Content Scripts: DOM parsing + UI injection
- Background Service Worker: API + auth + caching
- UI Components: Buttons, badges, filter bar, batch toolbar

## Data Flow

GitHub DOM → Content Script → API (optional) → UI update

## No backend required for V1
