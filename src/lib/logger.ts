// MCP Server Logger
// Ensures logs don't interfere with JSON-RPC protocol by directing to stderr

/**
 * Custom logger that redirects all output to stderr instead of stdout
 * to avoid interfering with JSON-RPC messages.
 */
export const logger = {
  log: (...args: any[]) => {
    console.error("[MCP INFO]", ...args);
  },

  info: (...args: any[]) => {
    console.error("[MCP INFO]", ...args);
  },

  warn: (...args: any[]) => {
    console.error("[MCP WARN]", ...args);
  },

  error: (...args: any[]) => {
    console.error("[MCP ERROR]", ...args);
  },

  debug: (...args: any[]) => {
    if (process.env.DEBUG) {
      console.error("[MCP DEBUG]", ...args);
    }
  },
};
