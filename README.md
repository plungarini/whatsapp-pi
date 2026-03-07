# WhatsApp-Pi

WhatsApp-Pi is a microservice that provides a simple API bridge for interacting with WhatsApp.

## Overview

This module enables other services in the "Pi" ecosystem to send and receive WhatsApp messages programmatically. It handles the complexities of authentication, session management, and message delivery.

## Key Features

- **Message API**: Simple HTTP endpoints to trigger WhatsApp notifications.
- **Onboarding Tool**: CLI-based QR code authentication for easy setup.
- **Vector Search (Optional)**: Support for `sqlite-vec` to enable semantic search over message history.
- **Background Service**: Designed to run as a persistent server on a Raspberry Pi.

## Getting Started

1. Install dependencies: `npm install`
2. **Onboarding**: Run `npm run onboard` to interactively setup your environment and scan the WhatsApp QR code.
3. Build and Start: `npm run build && npm start`
