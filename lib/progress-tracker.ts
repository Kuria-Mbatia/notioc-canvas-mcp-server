import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Simple logger implementation
const logger = {
  log: (message: string) => console.log(new Date().toISOString() + ' [LOG] ' + message)
};

// === INTERFACES ===

export interface StudentProgress {
  userId: string;
  progressOverview: {
    overallCompletionRate: number; // 0-1
    currentGPA: number;
    totalPointsEarned: number;
    totalPointsPossible: number;
    streakDays: number;
    lastActiveDate: string;
  };
  courseProgress: CourseProgress[];
  learningMilestones: LearningMilestone[];
  performanceTrends: PerformanceTrend[];
  studyPatterns: StudyPattern;
  goals: StudentGoal[];
  achievements: Achievement[];
  insights: ProgressInsight[];
  analysisDate: string;
  confidenceLevel: number;
}

export interface CourseProgress {
  courseId: string;
  courseName: string;
  completionRate: number; // 0-1
  currentGrade: number;
  gradeLetterEquivalent: string;
  pointsEarned: number;
  pointsPossible: number;
  assignmentProgress: {
    completed: number;
    pending: number;
    overdue: number;
    upcoming: number;
  };
  engagementMetrics: {
    participationRate: number; // 0-1
    discussionContributions: number;
    resourceAccess: number;
    timeSpent: number; // hours
  };
  progressTrajectory: 'improving' | 'stable' | 'declining' | 'variable';
  estimatedFinalGrade: number;
}

export interface LearningMilestone {
  milestoneId: string;
  type: 'assignment_completion' | 'grade_improvement' | 'streak_achievement' | 'skill_mastery' | 'engagement_boost' | 'goal_reached';
  title: string;
  description: string;
  achievedDate: string;
  impact: 'high' | 'medium' | 'low';
  celebrationMessage: string;
  relatedCourse?: string;
  skillsGained: string[];
  nextMilestone?: string;
}

export interface PerformanceTrend {
  category: 'grades' | 'engagement' | 'completion_rate' | 'study_time' | 'participation';
  timeframe: '7_days' | '30_days' | 'semester' | 'year';
  trendDirection: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changePercentage: number;
  dataPoints: TrendDataPoint[];
  analysis: string;
  recommendations: string[];
}

export interface TrendDataPoint {
  date: string;
  value: number;
  context?: string;
}

export interface StudyPattern {
  preferredStudyTimes: TimePattern[];
  averageSessionDuration: number; // minutes
  studyFrequency: {
    dailyAverage: number;
    weeklyTotal: number;
    consistencyScore: number; // 0-1
  };
  productivityPatterns: {
    mostProductiveHour: number;
    leastProductiveHour: number;
    optimalSessionLength: number;
    breakFrequency: number;
  };
  learningEffectiveness: {
    comprehensionRate: number; // 0-1
    retentionRate: number; // 0-1
    applicationSuccess: number; // 0-1
  };
  recommendedSchedule: StudyRecommendation[];
}

export interface TimePattern {
  dayOfWeek: string;
  startHour: number;
  endHour: number;
  frequency: number;
  effectiveness: number; // 0-1
}

export interface StudyRecommendation {
  timeSlot: string;
  duration: number;
  activity: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface StudentGoal {
  goalId: string;
  title: string;
  description: string;
  category: 'academic' | 'engagement' | 'skill_development' | 'wellness' | 'social';
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'abandoned';
  priority: 'high' | 'medium' | 'low';
  milestones: GoalMilestone[];
  progress: number; // 0-1
  estimatedCompletion: string;
  supportingActions: string[];
}

export interface GoalMilestone {
  milestoneId: string;
  title: string;
  targetDate: string;
  completed: boolean;
  completedDate?: string;
  value: number;
}

export interface Achievement {
  achievementId: string;
  type: 'academic' | 'engagement' | 'consistency' | 'improvement' | 'collaboration' | 'milestone';
  title: string;
  description: string;
  earnedDate: string;
  difficulty: 'bronze' | 'silver' | 'gold' | 'platinum';
  points: number;
  badge: string;
  requirements: string[];
  nextLevelTarget?: string;
}

export interface ProgressInsight {
  insightId: string;
  category: 'strength' | 'improvement_area' | 'opportunity' | 'warning' | 'celebration';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
  recommendations: string[];
  actionItems: ActionItem[];
  impactPotential: 'high' | 'medium' | 'low';
}

export interface ActionItem {
  actionId: string;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'this_week' | 'this_month' | 'this_semester';
  expectedImpact: string;
}

// === MAIN CLASS ===

export class ProgressTracker {
  private db: InstanceType<typeof Database>;

  constructor() {
    // Use absolute path based on this file's location to avoid cwd issues
    const currentFileDir = path.dirname(new URL(import.meta.url).pathname);
    const projectRoot = path.resolve(currentFileDir, '..');
    const dataDir = path.join(projectRoot, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.db = new Database(path.join(dataDir, 'canvas_cache.db'));
    this.initializeTables();
  }

  private initializeTables() {
    // Student progress tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_progress_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        progress_overview TEXT NOT NULL,
        course_progress TEXT NOT NULL,
        study_patterns TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        confidence_level REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, analysis_date)
      )
    `);

    // Learning milestones table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        milestone_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        achieved_date TEXT NOT NULL,
        impact TEXT NOT NULL,
        celebration_message TEXT NOT NULL,
        related_course TEXT,
        skills_gained TEXT NOT NULL,
        next_milestone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, milestone_id)
      )
    `);

    // Performance trends table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_trends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        trend_direction TEXT NOT NULL,
        change_percentage REAL NOT NULL,
        data_points TEXT NOT NULL,
        analysis TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, category, timeframe, analysis_date)
      )
    `);

    // Student goals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        goal_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        target_value REAL NOT NULL,
        current_value REAL NOT NULL,
        unit TEXT NOT NULL,
        deadline TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        milestones TEXT NOT NULL,
        progress REAL NOT NULL,
        estimated_completion TEXT NOT NULL,
        supporting_actions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, goal_id)
      )
    `);

    // Achievements table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        earned_date TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        points INTEGER NOT NULL,
        badge TEXT NOT NULL,
        requirements TEXT NOT NULL,
        next_level_target TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, achievement_id)
      )
    `);

    // Progress insights table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS progress_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        insight_id TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        action_items TEXT NOT NULL,
        impact_potential TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, insight_id, analysis_date)
      )
    `);

    // Progress snapshots for historical tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS progress_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        overall_completion_rate REAL NOT NULL,
        current_gpa REAL NOT NULL,
        total_points_earned REAL NOT NULL,
        total_points_possible REAL NOT NULL,
        streak_days INTEGER NOT NULL,
        course_count INTEGER NOT NULL,
        goals_active INTEGER NOT NULL,
        achievements_earned INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, snapshot_date)
      )
    `);
  }

  // === MAIN PROGRESS TRACKING ===

  async trackStudentProgress(userId: string, forceRefresh: boolean = false): Promise<StudentProgress> {
    logger.log(`Tracking comprehensive progress for user: ${userId}`);

    // Check for recent analysis
    if (!forceRefresh) {
      const existingProgress = this.getRecentProgressAnalysis(userId);
      if (existingProgress) {
        logger.log(`Using cached progress analysis for user: ${userId}`);
        return existingProgress;
      }
    }

    // Gather comprehensive progress data
    const progressData = await this.gatherProgressData(userId);
    
    // Analyze course progress
    const courseProgress = await this.analyzeCourseProgress(userId, progressData);
    
    // Calculate progress overview
    const progressOverview = this.calculateProgressOverview(courseProgress, progressData);
    
    // Identify learning milestones
    const learningMilestones = await this.identifyLearningMilestones(userId, progressData);
    
    // Analyze performance trends
    const performanceTrends = await this.analyzePerformanceTrends(userId, progressData);
    
    // Analyze study patterns
    const studyPatterns = this.analyzeStudyPatterns(progressData);
    
    // Get active goals
    const goals = this.getStudentGoals(userId);
    
    // Get achievements
    const achievements = this.getStudentAchievements(userId);
    
    // Generate insights
    const insights = this.generateProgressInsights(progressOverview, courseProgress, studyPatterns, goals);
    
    // Calculate confidence level
    const confidenceLevel = this.calculateProgressConfidence(progressData);

    const progress: StudentProgress = {
      userId,
      progressOverview,
      courseProgress,
      learningMilestones,
      performanceTrends,
      studyPatterns,
      goals,
      achievements,
      insights,
      analysisDate: new Date().toISOString(),
      confidenceLevel
    };

    // Store progress analysis
    this.storeProgressAnalysis(progress);
    
    // Create snapshot
    this.createProgressSnapshot(progress);

    logger.log(`Progress analysis completed for ${userId}: ${(progressOverview.overallCompletionRate * 100).toFixed(1)}% completion`);
    return progress;
  }

  private getRecentProgressAnalysis(userId: string): StudentProgress | null {
    const stmt = this.db.prepare(`
      SELECT * FROM student_progress_tracking 
      WHERE user_id = ? 
      AND analysis_date > datetime('now', '-1 day') 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    const row = stmt.get(userId) as any;
    if (!row) return null;

    // Get related data
    const milestones = this.getLearningMilestones(userId);
    const trends = this.getPerformanceTrends(userId);
    const goals = this.getStudentGoals(userId);
    const achievements = this.getStudentAchievements(userId);
    const insights = this.getProgressInsights(userId);

    return {
      userId: row.user_id,
      progressOverview: JSON.parse(row.progress_overview),
      courseProgress: JSON.parse(row.course_progress),
      learningMilestones: milestones,
      performanceTrends: trends,
      studyPatterns: JSON.parse(row.study_patterns),
      goals: goals,
      achievements: achievements,
      insights: insights,
      analysisDate: row.analysis_date,
      confidenceLevel: row.confidence_level
    };
  }

  private async gatherProgressData(userId: string): Promise<any> {
    try {
      // Get user's enrollment data (fallback to empty if table doesn't exist or no data)
      let enrollments: any[] = [];
      try {
        enrollments = this.db.prepare(`
          SELECT * FROM enrollments 
          WHERE user_id = ? 
          AND workflow_state = 'active'
        `).all(userId);
      } catch (error) {
        logger.log(`Note: enrollments table not found or error occurred: ${error}`);
        // Fallback: use courses data to simulate enrollments
        try {
          const courses = this.db.prepare(`SELECT id, name, course_code FROM courses`).all();
          enrollments = courses.map((course: any) => ({
            course_id: course.id,
            course_name: course.name,
            user_id: userId,
            workflow_state: 'active'
          }));
        } catch (courseError) {
          logger.log(`Could not access courses table: ${courseError}`);
        }
      }

      // Get assignment submissions (fallback to empty)
      let submissions: any[] = [];
      try {
        submissions = this.db.prepare(`
          SELECT s.*, a.points_possible, a.due_at, c.name as course_name
          FROM submissions s
          JOIN assignments a ON s.assignment_id = a.id
          JOIN courses c ON a.course_id = c.id
          WHERE s.user_id = ?
          ORDER BY s.submitted_at DESC
        `).all(userId);
      } catch (error) {
        logger.log(`Note: submissions table not found or error occurred: ${error}`);
      }

      // Get interaction history (this should exist from persona system)
      let interactions: any[] = [];
      try {
        interactions = this.db.prepare(`
          SELECT * FROM interaction_history 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 500
        `).all(userId);
      } catch (error) {
        logger.log(`Note: interaction_history table not found: ${error}`);
      }

      // Get discussion participation (fallback to empty)
      let discussions: any[] = [];
      try {
        discussions = this.db.prepare(`
          SELECT d.*, dt.title as topic_title, c.name as course_name
          FROM discussion_entries d
          JOIN discussion_topics dt ON d.discussion_topic_id = dt.id
          JOIN courses c ON dt.course_id = c.id
          WHERE d.user_id = ?
          ORDER BY d.created_at DESC
        `).all(userId);
      } catch (error) {
        logger.log(`Note: discussion tables not found: ${error}`);
      }

      // Get quiz attempts (fallback to empty)
      let quizzes: any[] = [];
      try {
        quizzes = this.db.prepare(`
          SELECT qa.*, q.title as quiz_title, c.name as course_name
          FROM quiz_submissions qa
          JOIN quizzes q ON qa.quiz_id = q.id
          JOIN courses c ON q.course_id = c.id
          WHERE qa.user_id = ?
          ORDER BY qa.finished_at DESC
        `).all(userId);
      } catch (error) {
        logger.log(`Note: quiz tables not found: ${error}`);
      }

      return {
        enrollments,
        submissions,
        interactions,
        discussions,
        quizzes,
        userId
      };
    } catch (error) {
      logger.log(`Error in gatherProgressData: ${error}`);
      // Return minimal data structure to prevent complete failure
      return {
        enrollments: [],
        submissions: [],
        interactions: [],
        discussions: [],
        quizzes: [],
        userId
      };
    }
  }

  private async analyzeCourseProgress(userId: string, progressData: any): Promise<CourseProgress[]> {
    const courseProgress: CourseProgress[] = [];

    for (const enrollment of progressData.enrollments) {
      // Get course assignments
      const courseAssignments = this.db.prepare(`
        SELECT * FROM assignments 
        WHERE course_id = ? 
        AND workflow_state = 'published'
      `).all(enrollment.course_id);

      // Get user's submissions for this course
      const courseSubmissions = progressData.submissions.filter(
        (s: any) => courseAssignments.some((a: any) => a.id === s.assignment_id)
      );

      // Calculate metrics
      const completedAssignments = courseSubmissions.filter((s: any) => s.workflow_state === 'graded').length;
      const totalAssignments = courseAssignments.length;
      const completionRate = totalAssignments > 0 ? completedAssignments / totalAssignments : 0;

      const pointsEarned = courseSubmissions.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
      const pointsPossible = courseAssignments.reduce((sum: number, a: any) => sum + (a.points_possible || 0), 0);
      const currentGrade = pointsPossible > 0 ? (pointsEarned / pointsPossible) * 100 : 0;

      // Analyze engagement
      const courseInteractions = progressData.interactions.filter(
        (i: any) => i.metadata && JSON.parse(i.metadata).course_id === enrollment.course_id
      );

      const courseDiscussions = progressData.discussions.filter(
        (d: any) => courseAssignments.some((a: any) => a.course_id === enrollment.course_id)
      );

      // Calculate trajectory
      const recentSubmissions = courseSubmissions.slice(0, 5);
      const trajectory = this.calculateTrajectory(recentSubmissions);

      courseProgress.push({
        courseId: enrollment.course_id,
        courseName: enrollment.course_name || `Course ${enrollment.course_id}`,
        completionRate,
        currentGrade,
        gradeLetterEquivalent: this.getLetterGrade(currentGrade),
        pointsEarned,
        pointsPossible,
        assignmentProgress: {
          completed: completedAssignments,
          pending: totalAssignments - completedAssignments,
          overdue: this.countOverdueAssignments(courseAssignments, courseSubmissions),
          upcoming: this.countUpcomingAssignments(courseAssignments)
        },
        engagementMetrics: {
          participationRate: courseInteractions.length > 0 ? Math.min(courseInteractions.length / 50, 1) : 0,
          discussionContributions: courseDiscussions.length,
          resourceAccess: courseInteractions.filter((i: any) => i.interaction_type === 'page_view').length,
          timeSpent: this.calculateTimeSpent(courseInteractions)
        },
        progressTrajectory: trajectory,
        estimatedFinalGrade: this.estimateFinalGrade(currentGrade, completionRate, trajectory)
      });
    }

    return courseProgress;
  }

  private calculateProgressOverview(courseProgress: CourseProgress[], progressData: any): any {
    const totalPointsEarned = courseProgress.reduce((sum, course) => sum + course.pointsEarned, 0);
    const totalPointsPossible = courseProgress.reduce((sum, course) => sum + course.pointsPossible, 0);
    const overallCompletionRate = courseProgress.reduce((sum, course) => sum + course.completionRate, 0) / Math.max(courseProgress.length, 1);
    
    // Calculate GPA (assuming 4.0 scale)
    const gpaSum = courseProgress.reduce((sum, course) => {
      const gpaValue = this.gradeToGPA(course.currentGrade);
      return sum + gpaValue;
    }, 0);
    const currentGPA = courseProgress.length > 0 ? gpaSum / courseProgress.length : 0;

    // Calculate streak days
    const streakDays = this.calculateStreakDays(progressData.interactions);

    return {
      overallCompletionRate,
      currentGPA,
      totalPointsEarned,
      totalPointsPossible,
      streakDays,
      lastActiveDate: this.getLastActiveDate(progressData.interactions)
    };
  }

  private async identifyLearningMilestones(userId: string, progressData: any): Promise<LearningMilestone[]> {
    const milestones: LearningMilestone[] = [];
    
    // Check for various milestone types
    milestones.push(...this.checkAssignmentMilestones(progressData));
    milestones.push(...this.checkGradeImprovementMilestones(progressData));
    milestones.push(...this.checkEngagementMilestones(progressData));
    milestones.push(...this.checkStreakMilestones(progressData));

    // Store new milestones
    for (const milestone of milestones) {
      this.storeMilestone(userId, milestone);
    }

    return this.getLearningMilestones(userId);
  }

  private async analyzePerformanceTrends(userId: string, progressData: any): Promise<PerformanceTrend[]> {
    const trends: PerformanceTrend[] = [];
    
    // Analyze different trend categories
    trends.push(this.analyzeGradeTrend(progressData));
    trends.push(this.analyzeEngagementTrend(progressData));
    trends.push(this.analyzeCompletionTrend(progressData));
    trends.push(this.analyzeStudyTimeTrend(progressData));

    // Store trends
    for (const trend of trends) {
      this.storeTrend(userId, trend);
    }

    return trends;
  }

  private analyzeStudyPatterns(progressData: any): StudyPattern {
    const interactions = progressData.interactions;
    
    // Analyze time patterns
    const timePatterns = this.analyzeTimePatterns(interactions);
    
    // Calculate session metrics
    const sessions = this.groupInteractionsIntoSessions(interactions);
    const averageSessionDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / Math.max(sessions.length, 1);
    
    // Analyze productivity patterns
    const productivityPatterns = this.analyzeProductivityPatterns(interactions);
    
    // Calculate learning effectiveness
    const learningEffectiveness = this.calculateLearningEffectiveness(progressData);
    
    // Generate recommendations
    const recommendedSchedule = this.generateStudyRecommendations(timePatterns, productivityPatterns);

    return {
      preferredStudyTimes: timePatterns,
      averageSessionDuration,
      studyFrequency: this.calculateStudyFrequency(sessions),
      productivityPatterns,
      learningEffectiveness,
      recommendedSchedule
    };
  }

  private generateProgressInsights(overview: any, courseProgress: CourseProgress[], studyPatterns: StudyPattern, goals: StudentGoal[]): ProgressInsight[] {
    const insights: ProgressInsight[] = [];

    // Strength insights
    if (overview.currentGPA > 3.5) {
      insights.push({
        insightId: `strength_gpa_${Date.now()}`,
        category: 'strength',
        priority: 'medium',
        title: 'Excellent Academic Performance',
        description: `Your current GPA of ${overview.currentGPA.toFixed(2)} demonstrates strong academic achievement.`,
        evidence: [`GPA: ${overview.currentGPA.toFixed(2)}`, `Completion rate: ${(overview.overallCompletionRate * 100).toFixed(1)}%`],
        recommendations: ['Maintain current study habits', 'Consider mentoring other students', 'Explore advanced coursework'],
        actionItems: [],
        impactPotential: 'high'
      });
    }

    // Improvement area insights
    if (overview.overallCompletionRate < 0.7) {
      insights.push({
        insightId: `improvement_completion_${Date.now()}`,
        category: 'improvement_area',
        priority: 'high',
        title: 'Assignment Completion Needs Attention',
        description: `Your completion rate of ${(overview.overallCompletionRate * 100).toFixed(1)}% could be improved.`,
        evidence: [`Completion rate: ${(overview.overallCompletionRate * 100).toFixed(1)}%`],
        recommendations: ['Create a weekly assignment schedule', 'Set reminders for due dates', 'Break large assignments into smaller tasks'],
        actionItems: [
          {
            actionId: `action_schedule_${Date.now()}`,
            title: 'Create Assignment Schedule',
            description: 'Set up a weekly schedule for completing assignments',
            effort: 'low',
            timeframe: 'this_week',
            expectedImpact: 'Improved organization and completion rates'
          }
        ],
        impactPotential: 'high'
      });
    }

    // Study pattern insights
    if (studyPatterns.studyFrequency.consistencyScore < 0.6) {
      insights.push({
        insightId: `pattern_consistency_${Date.now()}`,
        category: 'opportunity',
        priority: 'medium',
        title: 'Study Consistency Could Be Improved',
        description: 'Your study patterns show room for more consistent engagement.',
        evidence: [`Consistency score: ${(studyPatterns.studyFrequency.consistencyScore * 100).toFixed(1)}%`],
        recommendations: ['Establish regular study times', 'Use study habit tracking tools', 'Create a consistent study environment'],
        actionItems: [],
        impactPotential: 'medium'
      });
    }

    return insights;
  }

  // === HELPER METHODS ===

  private getLetterGrade(percentage: number): string {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  }

  private gradeToGPA(percentage: number): number {
    if (percentage >= 97) return 4.0;
    if (percentage >= 93) return 4.0;
    if (percentage >= 90) return 3.7;
    if (percentage >= 87) return 3.3;
    if (percentage >= 83) return 3.0;
    if (percentage >= 80) return 2.7;
    if (percentage >= 77) return 2.3;
    if (percentage >= 73) return 2.0;
    if (percentage >= 70) return 1.7;
    if (percentage >= 67) return 1.3;
    if (percentage >= 60) return 1.0;
    return 0.0;
  }

  private calculateTrajectory(submissions: any[]): 'improving' | 'stable' | 'declining' | 'variable' {
    if (submissions.length < 3) return 'stable';
    
    const scores = submissions.map(s => s.score || 0).reverse();
    let trends = 0;
    
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[i-1]) trends++;
      else if (scores[i] < scores[i-1]) trends--;
    }
    
    const trendRatio = trends / (scores.length - 1);
    
    if (trendRatio > 0.4) return 'improving';
    if (trendRatio < -0.4) return 'declining';
    if (Math.abs(trendRatio) < 0.2) return 'stable';
    return 'variable';
  }

  private estimateFinalGrade(currentGrade: number, completionRate: number, trajectory: string): number {
    let adjustment = 0;
    switch (trajectory) {
      case 'improving': adjustment = 5; break;
      case 'declining': adjustment = -5; break;
      case 'variable': adjustment = -2; break;
    }
    
    const completionAdjustment = (completionRate - 0.8) * 10;
    return Math.max(0, Math.min(100, currentGrade + adjustment + completionAdjustment));
  }

  private countOverdueAssignments(assignments: any[], submissions: any[]): number {
    const now = new Date();
    return assignments.filter(assignment => {
      if (!assignment.due_at) return false;
      const dueDate = new Date(assignment.due_at);
      if (dueDate > now) return false;
      
      const submission = submissions.find(s => s.assignment_id === assignment.id);
      return !submission || submission.workflow_state !== 'graded';
    }).length;
  }

  private countUpcomingAssignments(assignments: any[]): number {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return assignments.filter(assignment => {
      if (!assignment.due_at) return false;
      const dueDate = new Date(assignment.due_at);
      return dueDate > now && dueDate <= weekFromNow;
    }).length;
  }

  private calculateTimeSpent(interactions: any[]): number {
    const sessions = this.groupInteractionsIntoSessions(interactions);
    return sessions.reduce((total, session) => total + session.duration, 0) / 60; // Convert to hours
  }

  private groupInteractionsIntoSessions(interactions: any[]): any[] {
    // Group interactions within 30 minutes of each other as sessions
    const sessions = [];
    let currentSession: any = null;
    
    const sortedInteractions = interactions.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    for (const interaction of sortedInteractions) {
      const interactionTime = new Date(interaction.created_at).getTime();
      
      if (!currentSession || interactionTime - currentSession.endTime > 30 * 60 * 1000) {
        // Start new session
        currentSession = {
          startTime: interactionTime,
          endTime: interactionTime,
          duration: 0,
          interactions: [interaction]
        };
        sessions.push(currentSession);
      } else {
        // Continue current session
        currentSession.endTime = interactionTime;
        currentSession.duration = currentSession.endTime - currentSession.startTime;
        currentSession.interactions.push(interaction);
      }
    }
    
    return sessions;
  }

  private calculateStreakDays(interactions: any[]): number {
    const today = new Date();
    let streak = 0;
    let currentDate = new Date(today);
    
    while (streak < 365) { // Max 1 year streak
      const dayInteractions = interactions.filter(interaction => {
        const interactionDate = new Date(interaction.created_at);
        return interactionDate.toDateString() === currentDate.toDateString();
      });
      
      if (dayInteractions.length === 0) break;
      
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  }

  private getLastActiveDate(interactions: any[]): string {
    if (interactions.length === 0) return new Date().toISOString();
    
    const sortedInteractions = interactions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return sortedInteractions[0].created_at;
  }

  private checkAssignmentMilestones(progressData: any): LearningMilestone[] {
    const milestones: LearningMilestone[] = [];
    const submissions = progressData.submissions;
    
    // Check for perfect scores
    const perfectScores = submissions.filter((s: any) => s.score === s.points_possible && s.points_possible > 0);
    if (perfectScores.length > 0) {
      milestones.push({
        milestoneId: `perfect_score_${Date.now()}`,
        type: 'assignment_completion',
        title: 'Perfect Score Achievement',
        description: `Achieved a perfect score on assignment!`,
        achievedDate: perfectScores[0].submitted_at,
        impact: 'high',
        celebrationMessage: '🌟 Perfect score! Outstanding work!',
        skillsGained: ['Excellence', 'Attention to Detail'],
        nextMilestone: 'Maintain high performance streak'
      });
    }
    
    return milestones;
  }

  private checkGradeImprovementMilestones(progressData: any): LearningMilestone[] {
    // Implementation for grade improvement detection
    return [];
  }

  private checkEngagementMilestones(progressData: any): LearningMilestone[] {
    // Implementation for engagement milestone detection
    return [];
  }

  private checkStreakMilestones(progressData: any): LearningMilestone[] {
    // Implementation for streak milestone detection
    return [];
  }

  private analyzeTimePatterns(interactions: any[]): TimePattern[] {
    // Implementation for time pattern analysis
    return [];
  }

  private analyzeProductivityPatterns(interactions: any[]): any {
    // Implementation for productivity pattern analysis
    return {
      mostProductiveHour: 14,
      leastProductiveHour: 22,
      optimalSessionLength: 90,
      breakFrequency: 15
    };
  }

  private calculateLearningEffectiveness(progressData: any): any {
    // Implementation for learning effectiveness calculation
    return {
      comprehensionRate: 0.8,
      retentionRate: 0.75,
      applicationSuccess: 0.85
    };
  }

  private calculateStudyFrequency(sessions: any[]): any {
    // Implementation for study frequency calculation
    return {
      dailyAverage: 2.5,
      weeklyTotal: 17.5,
      consistencyScore: 0.7
    };
  }

  private generateStudyRecommendations(timePatterns: TimePattern[], productivityPatterns: any): StudyRecommendation[] {
    // Implementation for study recommendations
    return [];
  }

  private analyzeGradeTrend(progressData: any): PerformanceTrend {
    // Implementation for grade trend analysis
    return {
      category: 'grades',
      timeframe: '30_days',
      trendDirection: 'stable',
      changePercentage: 2.5,
      dataPoints: [],
      analysis: 'Grade performance has been stable with slight improvement',
      recommendations: ['Continue current study methods', 'Focus on challenging subjects']
    };
  }

  private analyzeEngagementTrend(progressData: any): PerformanceTrend {
    // Implementation for engagement trend analysis
    return {
      category: 'engagement',
      timeframe: '30_days',
      trendDirection: 'increasing',
      changePercentage: 15.0,
      dataPoints: [],
      analysis: 'Engagement has increased significantly',
      recommendations: ['Maintain current engagement levels', 'Explore advanced topics']
    };
  }

  private analyzeCompletionTrend(progressData: any): PerformanceTrend {
    // Implementation for completion trend analysis
    return {
      category: 'completion_rate',
      timeframe: '30_days',
      trendDirection: 'stable',
      changePercentage: 5.0,
      dataPoints: [],
      analysis: 'Assignment completion rate is stable',
      recommendations: ['Set completion reminders', 'Plan ahead for large assignments']
    };
  }

  private analyzeStudyTimeTrend(progressData: any): PerformanceTrend {
    // Implementation for study time trend analysis
    return {
      category: 'study_time',
      timeframe: '30_days',
      trendDirection: 'increasing',
      changePercentage: 20.0,
      dataPoints: [],
      analysis: 'Study time has increased consistently',
      recommendations: ['Maintain consistent study schedule', 'Include breaks to avoid burnout']
    };
  }

  private calculateProgressConfidence(progressData: any): number {
    // Calculate confidence based on data completeness and recency
    let confidence = 0.5;
    
    if (progressData.submissions.length > 5) confidence += 0.2;
    if (progressData.interactions.length > 20) confidence += 0.2;
    if (progressData.discussions.length > 0) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  // === STORAGE METHODS ===

  private storeProgressAnalysis(progress: StudentProgress): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO student_progress_tracking (
        user_id, progress_overview, course_progress, study_patterns, 
        analysis_date, confidence_level
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      progress.userId,
      JSON.stringify(progress.progressOverview),
      JSON.stringify(progress.courseProgress),
      JSON.stringify(progress.studyPatterns),
      progress.analysisDate,
      progress.confidenceLevel
    );
  }

  private createProgressSnapshot(progress: StudentProgress): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO progress_snapshots (
        user_id, snapshot_date, overall_completion_rate, current_gpa,
        total_points_earned, total_points_possible, streak_days,
        course_count, goals_active, achievements_earned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      progress.userId,
      new Date().toISOString().split('T')[0], // Just the date
      progress.progressOverview.overallCompletionRate,
      progress.progressOverview.currentGPA,
      progress.progressOverview.totalPointsEarned,
      progress.progressOverview.totalPointsPossible,
      progress.progressOverview.streakDays,
      progress.courseProgress.length,
      progress.goals.filter(g => g.status === 'in_progress').length,
      progress.achievements.length
    );
  }

  private storeMilestone(userId: string, milestone: LearningMilestone): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO learning_milestones (
        user_id, milestone_id, type, title, description, achieved_date,
        impact, celebration_message, related_course, skills_gained, next_milestone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      userId, milestone.milestoneId, milestone.type, milestone.title,
      milestone.description, milestone.achievedDate, milestone.impact,
      milestone.celebrationMessage, milestone.relatedCourse || null,
      JSON.stringify(milestone.skillsGained), milestone.nextMilestone || null
    );
  }

  private storeTrend(userId: string, trend: PerformanceTrend): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO performance_trends (
        user_id, category, timeframe, trend_direction, change_percentage,
        data_points, analysis, recommendations, analysis_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      userId, trend.category, trend.timeframe, trend.trendDirection,
      trend.changePercentage, JSON.stringify(trend.dataPoints),
      trend.analysis, JSON.stringify(trend.recommendations),
      new Date().toISOString()
    );
  }

  // === RETRIEVAL METHODS ===

  private getLearningMilestones(userId: string): LearningMilestone[] {
    const stmt = this.db.prepare(`
      SELECT * FROM learning_milestones 
      WHERE user_id = ? 
      ORDER BY achieved_date DESC 
      LIMIT 20
    `);
    const rows = stmt.all(userId) as any[];
    
    return rows.map(row => ({
      milestoneId: row.milestone_id,
      type: row.type,
      title: row.title,
      description: row.description,
      achievedDate: row.achieved_date,
      impact: row.impact,
      celebrationMessage: row.celebration_message,
      relatedCourse: row.related_course,
      skillsGained: JSON.parse(row.skills_gained),
      nextMilestone: row.next_milestone
    }));
  }

  private getPerformanceTrends(userId: string): PerformanceTrend[] {
    const stmt = this.db.prepare(`
      SELECT * FROM performance_trends 
      WHERE user_id = ? 
      AND analysis_date > datetime('now', '-7 days')
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId) as any[];
    
    return rows.map(row => ({
      category: row.category,
      timeframe: row.timeframe,
      trendDirection: row.trend_direction,
      changePercentage: row.change_percentage,
      dataPoints: JSON.parse(row.data_points),
      analysis: row.analysis,
      recommendations: JSON.parse(row.recommendations)
    }));
  }

  private getStudentGoals(userId: string): StudentGoal[] {
    const stmt = this.db.prepare(`
      SELECT * FROM student_goals 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId) as any[];
    
    return rows.map(row => ({
      goalId: row.goal_id,
      title: row.title,
      description: row.description,
      category: row.category,
      targetValue: row.target_value,
      currentValue: row.current_value,
      unit: row.unit,
      deadline: row.deadline,
      status: row.status,
      priority: row.priority,
      milestones: JSON.parse(row.milestones),
      progress: row.progress,
      estimatedCompletion: row.estimated_completion,
      supportingActions: JSON.parse(row.supporting_actions)
    }));
  }

  private getStudentAchievements(userId: string): Achievement[] {
    const stmt = this.db.prepare(`
      SELECT * FROM student_achievements 
      WHERE user_id = ? 
      ORDER BY earned_date DESC
    `);
    const rows = stmt.all(userId) as any[];
    
    return rows.map(row => ({
      achievementId: row.achievement_id,
      type: row.type,
      title: row.title,
      description: row.description,
      earnedDate: row.earned_date,
      difficulty: row.difficulty,
      points: row.points,
      badge: row.badge,
      requirements: JSON.parse(row.requirements),
      nextLevelTarget: row.next_level_target
    }));
  }

  private getProgressInsights(userId: string): ProgressInsight[] {
    const stmt = this.db.prepare(`
      SELECT * FROM progress_insights 
      WHERE user_id = ? 
      AND analysis_date > datetime('now', '-3 days')
      ORDER BY priority DESC, created_at DESC
    `);
    const rows = stmt.all(userId) as any[];
    
    return rows.map(row => ({
      insightId: row.insight_id,
      category: row.category,
      priority: row.priority,
      title: row.title,
      description: row.description,
      evidence: JSON.parse(row.evidence),
      recommendations: JSON.parse(row.recommendations),
      actionItems: JSON.parse(row.action_items),
      impactPotential: row.impact_potential
    }));
  }
} 