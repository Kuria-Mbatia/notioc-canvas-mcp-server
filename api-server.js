#!/usr/bin/env node

// REST API Wrapper for Notioc Canvas MCP Server
// Converts HTTP requests to MCP tool calls for Custom GPT Actions

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  
  // In production, you should validate against a real API key
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  next();
};

app.use(authenticateApiKey);

// Helper function to call MCP server
async function callMCPTool(toolName, params = {}) {
  return new Promise((resolve, reject) => {
    const mcpServerPath = path.join(__dirname, 'dist/src/server.js');
    const mcpProcess = spawn('node', [mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    };

    let stdout = '';
    let stderr = '';

    mcpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    mcpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    mcpProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse the JSON response from stdout
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const response = JSON.parse(lastLine);
        
        if (response.error) {
          reject(new Error(response.error.message || 'MCP server error'));
        } else {
          const content = response.result?.content?.[0]?.text;
          if (content) {
            resolve(JSON.parse(content));
          } else {
            resolve({ success: false, error: 'No content returned' });
          }
        }
      } catch (error) {
        reject(new Error(`Failed to parse MCP response: ${error.message}`));
      }
    });

    // Send the request to MCP server
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();
  });
}

// API Routes

// Get courses
app.get('/api/courses', async (req, res) => {
  try {
    const { enrollmentState = 'active' } = req.query;
    const result = await callMCPTool('getting courses', { enrollmentState });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pages in a course
app.get('/api/courses/:courseId/pages', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sort, order, searchTerm } = req.query;
    
    const result = await callMCPTool('getting pages', {
      courseId,
      sort,
      order,
      searchTerm
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read a specific page
app.get('/api/courses/:courseId/pages/:pageId', async (req, res) => {
  try {
    const { courseId, pageId } = req.params;
    
    const result = await callMCPTool('reading page', {
      courseId,
      pageUrl: pageId // Using pageUrl parameter
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get discussions in a course
app.get('/api/courses/:courseId/discussions', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { onlyAnnouncements, orderBy, searchTerm } = req.query;
    
    const result = await callMCPTool('getting discussions', {
      courseId,
      onlyAnnouncements: onlyAnnouncements === 'true',
      orderBy,
      searchTerm
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read a specific discussion
app.get('/api/courses/:courseId/discussions/:discussionId', async (req, res) => {
  try {
    const { courseId, discussionId } = req.params;
    const { includeReplies } = req.query;
    
    const result = await callMCPTool('reading discussion', {
      courseId,
      discussionId,
      includeReplies: includeReplies !== 'false'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get assignments in a course
app.get('/api/courses/:courseId/assignments', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { includeSubmissions } = req.query;
    
    const result = await callMCPTool('getting assignments', {
      courseId,
      includeSubmissions: includeSubmissions === 'true'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find files in a course
app.get('/api/courses/:courseId/files', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { searchTerm } = req.query;
    
    const result = await callMCPTool('finding files', {
      courseId,
      searchTerm
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read a specific file
app.get('/api/courses/:courseId/files/:fileId', async (req, res) => {
  try {
    const { courseId, fileId } = req.params;
    
    const result = await callMCPTool('reading file', {
      courseId,
      fileId
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Notioc Canvas API' });
});

// Serve OpenAPI schema
app.get('/api/openapi.json', (req, res) => {
  // You can serve the schema file here if needed
  res.json({ message: 'OpenAPI schema available' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Notioc Canvas API server running on port ${PORT}`);
  console.log(`📋 API available at: http://localhost:${PORT}/api`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
