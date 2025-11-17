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

## Environment Variables

- `PORT` - Backend server port (default: 3001)

## Notes

- The backend automatically creates the `server/uploads/` directory if it doesn't exist
- Frontend proxy configuration is set up in `vite.config.ts` to forward `/api` and `/files` requests to the backend
- Both servers must be running for the application to function properly

