# Data Annotation Tool

A web-based annotation tool for image data with XML export capabilities. The system consists of a React frontend and an Express.js backend server for file management.

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the System

The project provides a convenient script to run both frontend and backend simultaneously:

```bash
npm run dev:all
```

This will start:
- **Frontend**: Vite dev server (typically at `http://localhost:5173`)
- **Backend**: Express API server at `http://localhost:3001`

### Alternative: Run Services Separately

If you prefer to run services in separate terminals:

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
npm run dev:server
```

### Custom Ports and Hosts

You can customize ports and hosts using CLI arguments or environment variables:

#### Backend Server

**Using CLI arguments:**
```bash
# Custom port
node server/index.js --port 4000
# or short form
node server/index.js -p 4000

# Custom host
node server/index.js --host 0.0.0.0
# or short form
node server/index.js -h 0.0.0.0

# Both port and host
node server/index.js --port 4000 --host 0.0.0.0
```

**Using environment variables:**
```bash
PORT=4000 HOST=0.0.0.0 node server/index.js
```

#### Frontend Server

**Using CLI arguments (Vite native):**
```bash
# Custom frontend port
npx vite --port 8080

# Custom frontend host
npx vite --host 0.0.0.0

# Both port and host
npx vite --port 8080 --host 0.0.0.0
```

**Using environment variables:**
```bash
# Frontend configuration
VITE_PORT=8080 VITE_HOST=0.0.0.0 npx vite

# Backend proxy configuration (when backend runs on different port/host)
BACKEND_PORT=4000 BACKEND_HOST=192.168.1.100 npx vite

# All together
VITE_PORT=8080 VITE_HOST=0.0.0.0 BACKEND_PORT=4000 BACKEND_HOST=localhost npx vite
```

**Note:** When using custom backend ports/hosts, ensure the frontend proxy configuration matches your backend server settings.

#### Example: Running with Custom Ports

**Terminal 1 - Backend on port 4000:**
```bash
node server/index.js --port 4000
```

**Terminal 2 - Frontend on port 8080, pointing to backend on 4000:**
```bash
BACKEND_PORT=4000 npx vite --port 8080
```

Or using npm scripts with environment variables:
```bash
# Backend
PORT=4000 npm run dev:server

# Frontend
BACKEND_PORT=4000 VITE_PORT=8080 npm run dev
```

## Development

### Frontend Development

- **Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Preview Production Build**: `npm run preview`

The frontend is configured to proxy API requests to the backend server automatically.

### Backend Development

- **Dev Server**: `npm run dev:server`
- **Port**: Configurable via `PORT` environment variable (default: 3001)
- **Upload Directory**: `server/uploads/` (created automatically)

## Project Structure

```
data-anno/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── models/             # TypeScript models
│   └── utils/              # Utility functions
├── server/                 # Backend Express server
│   ├── index.js           # Server entry point
│   └── uploads/           # File upload directory
└── public/                 # Static assets
```

## API Endpoints

The backend server provides the following endpoints:

- `GET /api/files` - List all uploaded files
- `POST /api/files/upload` - Upload files (multipart/form-data)
- `POST /api/files/check` - Check if files exist
- `DELETE /api/files/:filename` - Delete a file
- `GET /files/:filename` - Serve uploaded files

## Configuration Options

### CLI Arguments

#### Backend Server (`server/index.js`)
- `--port` / `-p` - Server port (default: 3001)
- `--host` / `-h` - Server host (default: localhost)

#### Frontend Server (`npx vite`)
- `--port` - Frontend dev server port (default: 5173) - Vite native CLI argument
- `--host` - Frontend dev server host (default: localhost) - Vite native CLI argument
- Note: Backend proxy settings must be configured via environment variables (see below)
- Note: Use `npx vite` to run Vite from local node_modules, or use `npm run dev` which handles this automatically

### Environment Variables

- `PORT` - Backend server port (default: 3001)
- `HOST` - Backend server host (default: localhost)
- `VITE_PORT` - Frontend dev server port (default: 5173)
- `VITE_HOST` - Frontend dev server host (default: localhost)
- `BACKEND_PORT` - Backend server port for frontend proxy (default: 3001)
- `BACKEND_HOST` - Backend server host for frontend proxy (default: localhost)

**Priority:** CLI arguments > Environment variables > Defaults

## Notes

- The backend automatically creates the `server/uploads/` directory if it doesn't exist
- Frontend proxy configuration is set up in `vite.config.ts` to forward `/api` and `/files` requests to the backend
- Both servers must be running for the application to function properly

