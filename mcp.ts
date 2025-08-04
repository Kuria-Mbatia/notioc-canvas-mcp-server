import 'dotenv/config';
import { StdioTransport } from '@modelcontextprotocol/sdk';
import { listCourses } from './tools/courses.js';
import { listAssignments } from './tools/assignments.js';
import { listPages, listDiscussions } from './tools/pages-discussions.js';
import { searchFiles } from './tools/files.js';
import { getDashboardSummary } from './tools/dashboard.js';
import { getKnowledgeGraph } from './tools/knowledge.js';
import { createMCP } from './lib/mcp.js';
import { z } from 'zod';

// Environment variable validation
const envSchema = z.object({
  CANVAS_BASE_URL: z.string().url(),
  CANVAS_ACCESS_TOKEN: z.string(),
});

export async function main() {
  const mcp = createMCP({
    // ... existing code ...
    tools: [
      listCourses,
      listAssignments,
      listPages,
      listDiscussions,
      searchFiles,
      getDashboardSummary,
      getKnowledgeGraph,
    ],
    log: true,
    verbose: true,
  });

  const transport = new StdioTransport(mcp);
  transport.run();
}

main();