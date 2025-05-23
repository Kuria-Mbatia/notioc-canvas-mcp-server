#!/usr/bin/env node

// Test script to verify the stdout/stderr separation in MCP Server
// This verifies our fix for the "Unexpected token M" error

// Function to send a basic JSON-RPC request to the MCP server
function sendRequest(requestObj) {
  // Convert the request object to a JSON string with a trailing newline
  const requestStr = JSON.stringify(requestObj) + "\n";
  
  // Write to stdout (which is connected to the MCP server's stdin)
  process.stdout.write(requestStr);
}

// Listen for responses from the MCP server (which are written to our stdin)
process.stdin.on('data', (data) => {
  try {
    // Try to parse each line as JSON
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response = JSON.parse(line);
        console.error("✅ Successfully parsed JSON response:", response);
      } catch (parseError) {
        console.error("❌ Failed to parse JSON response:", parseError.message);
        console.error("Raw response:", line);
      }
    }
  } catch (error) {
    console.error("❌ Error processing response:", error);
  }
});

// Main test function
async function runTest() {
  console.error("🧪 Testing MCP Server JSON-RPC Protocol");
  console.error("Sending list_tools request...");
  
  // Send a request to list the available tools
  sendRequest({
    jsonrpc: "2.0",
    id: "test-1",
    method: "list_tools",
    params: {}
  });
  
  // Wait a bit, then send another request
  setTimeout(() => {
    console.error("\nSending call_tool request for list_courses...");
    sendRequest({
      jsonrpc: "2.0", 
      id: "test-2",
      method: "call_tool",
      params: {
        name: "list_courses",
        arguments: { enrollmentState: "active" }
      }
    });
  }, 2000);
}

// Run the test
runTest();

// Keep the process running for a while to collect responses
setTimeout(() => {
  console.error("🧪 Test completed");
  process.exit(0);
}, 10000);
