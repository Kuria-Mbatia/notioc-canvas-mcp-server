#!/usr/bin/env node

// Test script to demonstrate the simplified single progress bar
// This simulates the indexing process with just one clean progress bar

function formatProgressBar(current, total, width = 40) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage}%`;
}

function logProgress(tracker) {
  const progressBar = formatProgressBar(tracker.current, tracker.total);
  
  // Truncate long task names to keep everything on one line
  const maxTaskLength = 50;
  let taskText = tracker.currentTask;
  if (taskText.length > maxTaskLength) {
    taskText = taskText.substring(0, maxTaskLength - 3) + '...';
  }
  
  // Simple line clearing - just carriage return to overwrite
  process.stderr.write(`\r🔄 Indexing: ${progressBar} | ${taskText}`);
}

// Simulate indexing process
async function simulateIndexing() {
  console.log('🚀 Demonstrating clean single-line progress bar...\n');
  
  const courses = ['Math 451', 'CMPEN 431', 'EE 353'];
  const totalItems = 21 * courses.length; // 1 syllabus + 8 assignments + 12 files per course
  let currentItem = 0;
  
  const progress = {
    current: 0,
    total: totalItems,
    currentTask: 'Starting...'
  };

  for (const course of courses) {
    // Process syllabus
    progress.currentTask = `Syllabus: ${course}`;
    progress.current = ++currentItem;
    logProgress(progress);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Process assignments (8 per course)
    for (let i = 1; i <= 8; i++) {
      progress.currentTask = `Assignment: ${course} HW${i}`;
      progress.current = ++currentItem;
      logProgress(progress);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Process files (12 per course) 
    for (let i = 1; i <= 12; i++) {
      progress.currentTask = `File: ${course}_lec${i}.pdf`;
      progress.current = ++currentItem;
      logProgress(progress);
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }
  
  // Final completion
  progress.currentTask = 'Completed!';
  logProgress(progress);
  process.stderr.write('\n\n');
  
  console.log('✅ Perfect! Clean single-line progress bar! 🎉');
}

simulateIndexing().catch(console.error); 