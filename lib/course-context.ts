/**
 * Course Context Intelligence
 * Helps determine which courses are "current" based on dates and terms
 */

export interface CourseWithDates {
  id: string;
  name: string;
  courseCode?: string;
  enrollmentState?: string;
  enrollmentType?: string; // 'student', 'teacher', 'ta', 'designer', 'observer'
  startAt?: string;
  endAt?: string;
  termName?: string;
  termStartAt?: string;
  termEndAt?: string;
  termOverrides?: any; // Enrollment-type-specific date overrides from term
  concluded?: boolean; // From Canvas API: true if course has been concluded
  workflowState?: string; // From Canvas API: 'available', 'completed', 'unpublished'
  hasRecentActivity?: boolean; // Has assignments/activity in the near future
  confidenceScore?: number; // 0-100: How confident we are this is a current course
}

export interface CourseContextResult {
  currentCourses: CourseWithDates[];
  upcomingCourses: CourseWithDates[];
  recentlyCompletedCourses: CourseWithDates[];
  allActiveCourses: CourseWithDates[];
}

/**
 * Determine if a course is "current" based on dates
 */
export function isCourseCurrentlyActive(course: CourseWithDates, now: Date = new Date()): boolean {
  // PRIORITY 1: Use Canvas API's concluded flag (most reliable!)
  // If Canvas says the course is concluded, it's NOT current
  if (course.concluded === true) {
    return false;
  }
  
  // PRIORITY 2: Check workflow_state
  // If course is completed or unpublished, it's not current
  if (course.workflowState === 'completed' || course.workflowState === 'unpublished') {
    return false;
  }
  
  const courseText = `${course.name} ${course.courseCode || ''}`.toLowerCase();
  
  // Get current year and semester
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const shortYear = currentYear.toString().slice(-2); // "25" for 2025
  
  // Determine current semester
  let currentSemester = '';
  if (currentMonth >= 0 && currentMonth <= 4) {
    // January - May: Spring semester
    currentSemester = 'sp';
  } else if (currentMonth >= 5 && currentMonth <= 7) {
    // June - August: Summer semester
    currentSemester = 'su';
  } else {
    // September - December: Fall semester
    currentSemester = 'fa';
  }
  
  // PRIORITY 3: Exclude courses with wrong semester in name (Spring/Summer when it's Fall)
  const excludePatterns = [];
  if (currentSemester === 'fa') {
    excludePatterns.push(
      `${shortYear}sp`, `sp${shortYear}`, `sp ${shortYear}`, `${shortYear} sp`,
      `spring${shortYear}`, `${shortYear}spring`, `spring ${shortYear}`, `${shortYear} spring`,
      `${shortYear}su`, `su${shortYear}`, `su ${shortYear}`, `${shortYear} su`,
      `summer${shortYear}`, `${shortYear}summer`, `summer ${shortYear}`, `${shortYear} summer`,
      'su-2', 'su-1', 'su25', '25su', 'sp25', '25sp', 'sp 25', '25 sp'
    );
  } else if (currentSemester === 'sp') {
    excludePatterns.push(
      `${shortYear}fa`, `fa${shortYear}`, `fa ${shortYear}`, `${shortYear} fa`,
      `fall${shortYear}`, `${shortYear}fall`, `fall ${shortYear}`, `${shortYear} fall`,
      `${shortYear}su`, `su${shortYear}`, `su ${shortYear}`, `${shortYear} su`,
      `summer${shortYear}`, `${shortYear}summer`, `summer ${shortYear}`, `${shortYear} summer`
    );
  } else if (currentSemester === 'su') {
    excludePatterns.push(
      `${shortYear}fa`, `fa${shortYear}`, `fa ${shortYear}`, `${shortYear} fa`,
      `fall${shortYear}`, `${shortYear}fall`, `fall ${shortYear}`, `${shortYear} fall`,
      `${shortYear}sp`, `sp${shortYear}`, `sp ${shortYear}`, `${shortYear} sp`,
      `spring${shortYear}`, `${shortYear}spring`, `spring ${shortYear}`, `${shortYear} spring`
    );
  }
  
  for (const pattern of excludePatterns) {
    if (courseText.includes(pattern)) {
      return false;
    }
  }
  
  // PRIORITY 4: If course has ended more than 1 month ago, exclude it
  if (course.endAt) {
    const end = new Date(course.endAt);
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (end < oneMonthAgo) {
      return false;
    }
  }
  
  // PRIORITY 5: If we have course dates, check if we're within range
  if (course.startAt && course.endAt) {
    const start = new Date(course.startAt);
    const end = new Date(course.endAt);
    
    if (now >= start && now <= end) {
      course.confidenceScore = 50; // Highest confidence: exact dates
      return true;
    }
  }
  
  // PRIORITY 6: Check term dates WITH enrollment-type-specific overrides
  if (course.termStartAt && course.termEndAt) {
    let termStart = new Date(course.termStartAt);
    let termEnd = new Date(course.termEndAt);
    
    // Check for enrollment-type-specific overrides
    if (course.termOverrides && course.enrollmentType) {
      const enrollmentKey = `${course.enrollmentType.charAt(0).toUpperCase() + course.enrollmentType.slice(1)}Enrollment`;
      const override = course.termOverrides[enrollmentKey];
      
      if (override) {
        if (override.start_at) {
          termStart = new Date(override.start_at);
        }
        if (override.end_at) {
          termEnd = new Date(override.end_at);
        }
      }
    }
    
    if (now >= termStart && now <= termEnd) {
      course.confidenceScore = 40; // High confidence: term dates
      return true;
    }
  }
  
  // PRIORITY 7: Check for correct semester patterns in course name
  const includePatterns = [
    `${shortYear}${currentSemester}`, // "25fa"
    `${currentSemester}${shortYear}`, // "fa25"
    `${currentSemester}-${shortYear}`, // "fa-25"
    `${shortYear}-${currentSemester}`, // "25-fa"
    `fall2025`, `fall 2025`, `spring2025`, `spring 2025`, `summer2025`, `summer 2025`
  ].filter(p => p.includes(currentSemester) || p.includes(currentYear.toString()));
  
  for (const pattern of includePatterns) {
    if (courseText.includes(pattern)) {
      course.confidenceScore = 35; // High confidence: semester pattern match
      return true;
    }
  }
  
  // PRIORITY 8: For courses with no metadata (training courses), be permissive but careful
  if (!course.startAt && !course.endAt && !course.termStartAt && !course.termEndAt) {
    // If it's available and not concluded, include it
    if (course.workflowState === 'available') {
      course.confidenceScore = 15; // Low confidence: no metadata
      return true;
    }
    return false;
  }
  
  // Default: exclude if we can't determine
  return false;
}

/**
 * Determine if a course is upcoming (starts in the future)
 */
export function isCourseUpcoming(course: CourseWithDates, now: Date = new Date()): boolean {
  if (course.startAt) {
    const start = new Date(course.startAt);
    const fourWeeksFromNow = new Date(now);
    fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);
    
    // Course starts in the future but within next 4 weeks
    return start > now && start <= fourWeeksFromNow;
  }
  
  // Check term dates
  if (course.termStartAt) {
    const termStart = new Date(course.termStartAt);
    const fourWeeksFromNow = new Date(now);
    fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);
    
    return termStart > now && termStart <= fourWeeksFromNow;
  }
  
  return false;
}

/**
 * Determine if a course recently completed (ended in last 4 weeks)
 */
export function isCourseRecentlyCompleted(course: CourseWithDates, now: Date = new Date()): boolean {
  if (course.endAt) {
    const end = new Date(course.endAt);
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    // Course ended recently (within last 4 weeks)
    return end < now && end >= fourWeeksAgo;
  }
  
  // Check term dates
  if (course.termEndAt) {
    const termEnd = new Date(course.termEndAt);
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    return termEnd < now && termEnd >= fourWeeksAgo;
  }
  
  return false;
}

/**
 * Categorize courses by their current status
 */
export function categorizeCourses(courses: CourseWithDates[]): CourseContextResult {
  const now = new Date();
  
  const currentCourses: CourseWithDates[] = [];
  const upcomingCourses: CourseWithDates[] = [];
  const recentlyCompletedCourses: CourseWithDates[] = [];
  const allActiveCourses: CourseWithDates[] = [];
  
  for (const course of courses) {
    // All courses with active enrollment
    if (course.enrollmentState === 'active') {
      allActiveCourses.push(course);
    }
    
    // Categorize based on dates
    if (isCourseCurrentlyActive(course, now)) {
      currentCourses.push(course);
    } else if (isCourseUpcoming(course, now)) {
      upcomingCourses.push(course);
    } else if (isCourseRecentlyCompleted(course, now)) {
      recentlyCompletedCourses.push(course);
    }
  }
  
  return {
    currentCourses,
    upcomingCourses,
    recentlyCompletedCourses,
    allActiveCourses,
  };
}

/**
 * Get smart course summary for LLM context
 */
export function getCourseContextSummary(result: CourseContextResult): string {
  let summary = '## 📚 Course Context Summary\n\n';
  
  if (result.currentCourses.length > 0) {
    summary += `### ✅ Currently Active Courses (${result.currentCourses.length})\n`;
    summary += `These are your courses that are actively running right now:\n\n`;
    result.currentCourses.forEach(c => {
      summary += `- **${c.name}** (ID: ${c.id}, Code: ${c.courseCode || 'N/A'})\n`;
    });
    summary += `\n`;
  } else {
    summary += `### ⚠️ No Currently Active Courses Found\n\n`;
    summary += `It looks like you don't have any courses actively running right now. `;
    summary += `This could mean:\n`;
    summary += `- You're between semesters\n`;
    summary += `- Your courses haven't started yet\n`;
    summary += `- Course dates aren't properly configured in Canvas\n\n`;
  }
  
  if (result.upcomingCourses.length > 0) {
    summary += `### 🔜 Upcoming Courses (${result.upcomingCourses.length})\n`;
    summary += `These courses will start soon:\n\n`;
    result.upcomingCourses.forEach(c => {
      summary += `- **${c.name}** (ID: ${c.id})\n`;
    });
    summary += `\n`;
  }
  
  if (result.recentlyCompletedCourses.length > 0) {
    summary += `### ✅ Recently Completed (${result.recentlyCompletedCourses.length})\n`;
    summary += `These courses recently ended:\n\n`;
    result.recentlyCompletedCourses.forEach(c => {
      summary += `- **${c.name}** (ID: ${c.id})\n`;
    });
    summary += `\n`;
  }
  
  if (result.allActiveCourses.length > result.currentCourses.length) {
    const otherCount = result.allActiveCourses.length - result.currentCourses.length;
    summary += `### 📋 Other Active Enrollments (${otherCount})\n`;
    summary += `You have ${otherCount} other courses with active enrollment that aren't currently running. `;
    summary += `These might be training courses, templates, or courses from other terms.\n\n`;
  }
  
  summary += `---\n\n`;
  summary += `**💡 Tip for LLMs:** When users ask about "my courses" or "what's due", `;
  summary += `use the "Currently Active Courses" list above unless they specify otherwise.\n`;
  
  return summary;
}

/**
 * Extract term information from course name/code
 */
export function extractTermInfo(courseName: string, courseCode?: string): {
  year?: number;
  semester?: 'spring' | 'summer' | 'fall';
  termString?: string;
} {
  const text = `${courseName} ${courseCode || ''}`.toLowerCase();
  
  // Extract year (look for 4-digit or 2-digit year)
  const year4Match = text.match(/20\d{2}/);
  const year2Match = text.match(/\b(\d{2})(fa|sp|su)\b/);
  
  let year: number | undefined;
  if (year4Match) {
    year = parseInt(year4Match[0]);
  } else if (year2Match) {
    year = 2000 + parseInt(year2Match[1]);
  }
  
  // Extract semester
  let semester: 'spring' | 'summer' | 'fall' | undefined;
  if (text.includes('fa') || text.includes('fall')) {
    semester = 'fall';
  } else if (text.includes('sp') || text.includes('spring')) {
    semester = 'spring';
  } else if (text.includes('su') || text.includes('summer')) {
    semester = 'summer';
  }
  
  let termString: string | undefined;
  if (year && semester) {
    termString = `${semester.charAt(0).toUpperCase() + semester.slice(1)} ${year}`;
  }
  
  return { year, semester, termString };
}
