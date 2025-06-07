import { listCoursesTool } from './tools/courses.js';
import { listAssignmentsTool } from './tools/assignments.js';
import { listPagesTool, listDiscussionsTool } from './tools/pages-discussions.js';
import { searchFilesTool } from './tools/files.js';
import { getDashboardSummaryTool } from './tools/dashboard.js';
import { getKnowledgeGraphTool } from './tools/knowledge.js';
import { createMCP } from './lib/mcp.js';
import { z } from 'zod';

// Environment variable validation
const envSchema = z.object({
  // ... existing code ...
},
});

export async function main() {
  const mcp = createMCP({
    // ... existing code ...
    tools: [
      listCoursesTool,
      listAssignmentsTool,
      listPagesTool,
      listDiscussionsTool,
      searchFilesTool,
      getDashboardSummaryTool,
      getKnowledgeGraphTool,
    ],
    log: true,
    verbose: true,
  });
  // ... existing code ...
} 