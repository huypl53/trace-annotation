import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Parse CLI arguments for port and host
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { port: null, host: null };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      config.port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--host' || args[i] === '-h') {
      config.host = args[i + 1];
      i++;
    }
  }
  
  return config;
}

const cliArgs = parseArgs();
const PORT = cliArgs.port || process.env.PORT || 3001;
const HOST = cliArgs.host || process.env.HOST || 'localhost';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Use original filename
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/files', express.static(UPLOAD_DIR));

// API endpoint: Check if files exist
app.post('/api/files/check', async (req, res) => {
  try {
    const { filenames } = req.body;
    if (!Array.isArray(filenames)) {
      return res.status(400).json({ error: 'filenames must be an array' });
    }

    const existingFiles = [];
    for (const filename of filenames) {
      const filePath = path.join(UPLOAD_DIR, filename);
      try {
        await fs.access(filePath);
        existingFiles.push(filename);
      } catch {
        // File doesn't exist, skip
      }
    }

    res.json({ existingFiles });
  } catch (error) {
    console.error('Error checking files:', error);
    res.status(500).json({ error: 'Failed to check files' });
  }
});

// API endpoint: List all files
app.get('/api/files', async (req, res) => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(UPLOAD_DIR, filename);
        const stats = await fs.stat(filePath);
        return {
          name: filename,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      })
    );
    res.json({ files: fileDetails });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// API endpoint: Upload files
app.post('/api/files/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
      name: file.filename,
      size: file.size,
      path: `/files/${file.filename}`,
    }));

    res.json({ 
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// API endpoint: Delete a file
app.delete('/api/files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    
    try {
      await fs.unlink(filePath);
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Start server
async function startServer() {
  await ensureUploadDir();
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Upload directory: ${UPLOAD_DIR}`);
  });
}

startServer().catch(console.error);

