#!/usr/bin/env node

// Test script for the Notioc Canvas MCP Server
// This script tests the MCP server functionality without requiring MCP client setup

import dotenv from 'dotenv';
import { listCourses } from './dist/tools/courses.js';
import { listAssignments } from './dist/tools/assignments.js';
import { searchFiles } from './dist/tools/files.js';
import { getDashboardSummary } from './dist/tools/dashboard.js';
import { getKnowledgeGraph } from './dist/tools/knowledge.js';
import { createMCP } from './dist/lib/mcp.js';
import { generateQAPrompt } from './dist/tools/prompts.js';
import { runFullIndex } from './dist/lib/indexer.js';

// Load environment variables
dotenv.config();

// MCP setup for findCourseId
const mcp = createMCP({
  // Minimal setup just to get the context helper
  tools: [listCourses],
  log: false,
  verbose: false,
});

const { findCourseId } = mcp.context;

async function testMcpServer() {
  console.log('🧪 Testing Notioc Canvas MCP Server...\n');

  // Check configuration
  const baseUrl = process.env.CANVAS_BASE_URL;
  const accessToken = process.env.CANVAS_ACCESS_TOKEN;

  if (!baseUrl || !accessToken) {
    console.error('❌ Missing Canvas configuration!');
    console.error('Please set CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN in your .env file');
    process.exit(1);
  }

  console.log(`✅ Configuration loaded:`);
  console.log(`   Canvas URL: ${baseUrl}`);
  console.log(`   Token: ${accessToken.substring(0, 10)}...`);
  console.log('');

  try {
    // Test 1: List Courses
    console.log('📚 Test 1: List Courses');
    const courses = await listCourses({
      canvasBaseUrl: baseUrl,
      accessToken: accessToken,
      enrollmentState: 'active'
    });
    
    if (courses.length > 0) {
      console.log(`✅ Found ${courses.length} courses:`);
      courses.slice(0, 3).forEach(course => {
        console.log(`   - ${course.name} (ID: ${course.id})`);
      });
      if (courses.length > 3) {
        console.log(`   ... and ${courses.length - 3} more`);
      }
    } else {
      console.log('⚠️  No active courses found');
    }
    console.log('');

    // Test 2: List Assignments (if we have courses)
    if (courses.length > 0) {
      const testCourse = courses[0];
      console.log(`📝 Test 2: List Assignments for "${testCourse.name}"`);
      
      try {
        const assignments = await listAssignments({
          canvasBaseUrl: baseUrl,
          accessToken: accessToken,
          courseId: testCourse.id
        });
        
        if (assignments.length > 0) {
          console.log(`✅ Found ${assignments.length} assignments:`);
          assignments.slice(0, 3).forEach(assignment => {
            console.log(`   - ${assignment.name}${assignment.dueAt ? ` (Due: ${new Date(assignment.dueAt).toLocaleDateString()})` : ''}`);
          });
          if (assignments.length > 3) {
            console.log(`   ... and ${assignments.length - 3} more`);
          }
        } else {
          console.log('⚠️  No assignments found in this course');
        }
      } catch (error) {
        console.log(`⚠️  Could not access assignments: ${error.message}`);
      }
      console.log('');

      // Test 3: Search Files
      console.log(`📁 Test 3: Search Files in "${testCourse.name}"`);
      
      try {
        const files = await searchFiles({
          canvasBaseUrl: baseUrl,
          accessToken: accessToken,
          courseId: testCourse.id
        });
        
        if (files.length > 0) {
          console.log(`✅ Found ${files.length} files:`);
          files.slice(0, 5).forEach(file => {
            console.log(`   - ${file.name} (Module: ${file.moduleName || 'Unknown'})`);
          });
          if (files.length > 5) {
            console.log(`   ... and ${files.length - 5} more`);
          }
        } else {
          console.log('⚠️  No files found in course modules');
        }
      } catch (error) {
        console.log(`⚠️  Could not access files: ${error.message}`);
      }
      console.log('');
    }

    // Test 4: Get Dashboard Summary
    console.log('📊 Test 4: Get Dashboard Summary');
    try {
      const summary = await getDashboardSummary({
        canvasBaseUrl: baseUrl,
        accessToken: accessToken,
      });
      console.log(`✅ Found ${summary.upcomingAssignments.length} upcoming assignments.`);
      console.log(`✅ Found ${summary.unreadAnnouncements.length} unread announcements.`);
    } catch (error) {
      console.log(`⚠️  Could not get dashboard summary: ${error.message}`);
    }
    console.log('');

    // Test 5: Run the indexer to populate the local DB
    console.log('💾 Test 5: Run full data indexer');
    try {
        await runFullIndex({
            canvasBaseUrl: baseUrl,
            accessToken: accessToken,
        });
        console.log('✅ Indexer completed successfully.');
    } catch (error) {
        console.log(`⚠️  Indexer failed: ${error.message}`);
    }
    console.log('');

    // Test 6: Build a knowledge graph for the first course FROM THE LOCAL DB
    if (courses.length > 0) {
        const testCourse = courses[0];
        console.log(`🧠 Test 6: Build knowledge graph for "${testCourse.name}" from local index`);
        try {
          const knowledgeGraph = await getKnowledgeGraph({
            courseName: testCourse.name,
          });
          console.log(`✅ Knowledge graph built successfully from local index for "${knowledgeGraph.courseName}":`);
          console.log(`   - Syllabus: ${knowledgeGraph.syllabus?.body ? 'Found' : 'Not found'}`);
          console.log(`   - Assignments: ${knowledgeGraph.assignments.length}`);
          console.log(`   - Files: ${knowledgeGraph.files.length}`);
        } catch (error) {
          console.log(`⚠️  Could not build knowledge graph from index: ${error.message}`);
        }
        console.log('');
    }

    // Test 7: Generate a Q&A prompt FROM THE LOCAL DB using SEMANTIC SEARCH
    if (courses.length > 0) {
        const testCourse = courses[0];
        const testQuestion = "What is the policy on late submissions?";
        console.log(`❓ Test 7: Generate semantic Q&A prompt for "${testCourse.name}"`);
        console.log(`   Question: "${testQuestion}"`);
        try {
          const prompt = await generateQAPrompt({
            courseName: testCourse.name,
            question: testQuestion,
          });
          console.log(`✅ Semantic prompt generated successfully.`);
          if (prompt.includes(testQuestion) && prompt.includes("semantically relevant excerpts")) {
            console.log(`   - Prompt contains the question and correct instructions.`);
          } else {
            console.warn(`   - Prompt seems malformed.`);
          }
        } catch (error) {
          console.log(`⚠️  Could not generate prompt from index: ${error.message}`);
        }
        console.log('');
    }

    console.log('🎉 MCP Server test and index completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the server with `npm start`');
    console.log('2. Connect your MCP client and ask a question about your course, like:');
    console.log('   "What is the policy on late submissions for Intro to Everything?"');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('Common issues:');
    console.error('- Check your Canvas base URL (should not end with /)');
    console.error('- Verify your API token is correct and not expired');
    console.error('- Ensure you have access to Canvas and courses');
    process.exit(1);
  }
}

// Run the test
testMcpServer().catch(console.error);
