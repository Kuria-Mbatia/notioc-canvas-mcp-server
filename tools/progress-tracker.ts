import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../lib/logger.js';
import { ProgressTracker } from '../lib/progress-tracker.js';

// Phase 3D: Student Progress Tracking MCP Tools
// Personal progress analytics, milestone tracking, goal management, and study optimization

const progressTracker = new ProgressTracker();

// === MCP TOOL DEFINITIONS ===

export const progressTrackerTools: Tool[] = [
  {
    name: 'track_student_progress',
    description: 'Get comprehensive progress analysis including course performance, milestones, and trends',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID to track progress for'
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Force fresh analysis even if recent cached results exist',
          default: false
        }
      },
      required: ['userId']
    },
    handler: async (args: any) => {
      try {
        const { userId, forceRefresh = false } = args;
        
        const progress = await progressTracker.trackStudentProgress(userId, forceRefresh);
        
        const summary = {
          overview: {
            userId: progress.userId,
            completionRate: (progress.progressOverview.overallCompletionRate * 100).toFixed(1) + '%',
            currentGPA: progress.progressOverview.currentGPA.toFixed(2),
            pointsEarned: progress.progressOverview.totalPointsEarned,
            pointsPossible: progress.progressOverview.totalPointsPossible,
            streakDays: progress.progressOverview.streakDays,
            lastActive: progress.progressOverview.lastActiveDate,
            confidenceLevel: (progress.confidenceLevel * 100).toFixed(1) + '%'
          },
          courses: progress.courseProgress.map(course => ({
            name: course.courseName,
            completion: (course.completionRate * 100).toFixed(1) + '%',
            grade: course.currentGrade.toFixed(1) + '%',
            letterGrade: course.gradeLetterEquivalent,
            trajectory: course.progressTrajectory,
            estimatedFinal: course.estimatedFinalGrade.toFixed(1) + '%',
            assignments: {
              completed: course.assignmentProgress.completed,
              pending: course.assignmentProgress.pending,
              overdue: course.assignmentProgress.overdue,
              upcoming: course.assignmentProgress.upcoming
            }
          })),
          recentMilestones: progress.learningMilestones.slice(0, 5).map(milestone => ({
            title: milestone.title,
            type: milestone.type,
            impact: milestone.impact,
            date: milestone.achievedDate,
            celebration: milestone.celebrationMessage,
            skillsGained: milestone.skillsGained
          })),
          studyInsights: {
            averageSessionDuration: `${Math.round(progress.studyPatterns.averageSessionDuration)} minutes`,
            dailyAverage: `${progress.studyPatterns.studyFrequency.dailyAverage} hours`,
            consistencyScore: (progress.studyPatterns.studyFrequency.consistencyScore * 100).toFixed(1) + '%',
            effectiveness: {
              comprehension: (progress.studyPatterns.learningEffectiveness.comprehensionRate * 100).toFixed(1) + '%',
              retention: (progress.studyPatterns.learningEffectiveness.retentionRate * 100).toFixed(1) + '%',
              application: (progress.studyPatterns.learningEffectiveness.applicationSuccess * 100).toFixed(1) + '%'
            }
          },
          keyInsights: progress.insights.slice(0, 3).map(insight => ({
            category: insight.category,
            priority: insight.priority,
            title: insight.title,
            description: insight.description,
            recommendations: insight.recommendations.slice(0, 2)
          })),
          analysisDate: progress.analysisDate
        };

        return {
          success: true,
          data: summary,
          insights: [
            `Overall completion: ${summary.overview.completionRate}`,
            `Current GPA: ${summary.overview.currentGPA}`,
            `Study streak: ${summary.overview.streakDays} days`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to track student progress: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'analyze_learning_milestones',
    description: 'Identify and celebrate recent learning achievements and milestones',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID to analyze milestones for'
        },
        timeframe: {
          type: 'string',
          enum: ['week', 'month', 'semester', 'all'],
          description: 'Timeframe for milestone analysis',
          default: 'month'
        }
      },
      required: ['userId']
    },
    handler: async (args: any) => {
      try {
        const { userId, timeframe = 'month' } = args;
        
        const progress = await progressTracker.trackStudentProgress(userId);
        
        // Filter milestones by timeframe
        const cutoffDate = new Date();
        switch (timeframe) {
          case 'week':
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            break;
          case 'month':
            cutoffDate.setMonth(cutoffDate.getMonth() - 1);
            break;
          case 'semester':
            cutoffDate.setMonth(cutoffDate.getMonth() - 4);
            break;
          case 'all':
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 10);
            break;
        }

        const filteredMilestones = progress.learningMilestones.filter(milestone => 
          new Date(milestone.achievedDate) >= cutoffDate
        );

        const milestonesByType = filteredMilestones.reduce((acc: any, milestone) => {
          if (!acc[milestone.type]) acc[milestone.type] = [];
          acc[milestone.type].push(milestone);
          return acc;
        }, {});

        const summary = {
          timeframe,
          totalMilestones: filteredMilestones.length,
          milestoneTypes: Object.keys(milestonesByType),
          breakdown: milestonesByType,
          recentHighlights: filteredMilestones
            .filter(m => m.impact === 'high')
            .slice(0, 5)
            .map(milestone => ({
              title: milestone.title,
              description: milestone.description,
              celebration: milestone.celebrationMessage,
              skillsGained: milestone.skillsGained,
              achievedDate: milestone.achievedDate,
              nextMilestone: milestone.nextMilestone
            })),
          skillsDeveloped: [...new Set(filteredMilestones.flatMap(m => m.skillsGained))],
          upcomingTargets: filteredMilestones
            .map(m => m.nextMilestone)
            .filter(Boolean)
            .slice(0, 3)
        };

        return {
          success: true,
          data: summary,
          insights: [
            `${summary.totalMilestones} milestones achieved in ${timeframe}`,
            `${summary.skillsDeveloped.length} new skills developed`,
            `${summary.recentHighlights.length} high-impact achievements`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to analyze learning milestones: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'forecast_performance_trends',
    description: 'Analyze performance trends and predict future academic outcomes',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID to analyze trends for'
        },
        forecastPeriod: {
          type: 'string',
          enum: ['next_week', 'next_month', 'end_semester'],
          description: 'Period to forecast performance for',
          default: 'next_month'
        }
      },
      required: ['userId']
    },
    handler: async (args: any) => {
      try {
        const { userId, forecastPeriod = 'next_month' } = args;
        
        const progress = await progressTracker.trackStudentProgress(userId);
        
        const trendAnalysis = {
          currentStatus: {
            gpa: progress.progressOverview.currentGPA,
            completionRate: progress.progressOverview.overallCompletionRate,
            streakDays: progress.progressOverview.streakDays
          },
          trends: progress.performanceTrends.map(trend => ({
            category: trend.category,
            timeframe: trend.timeframe,
            direction: trend.trendDirection,
            changePercent: trend.changePercentage.toFixed(1) + '%',
            analysis: trend.analysis,
            recommendations: trend.recommendations
          })),
          forecasts: {
            gpaProjection: calculateGPAProjection(progress, forecastPeriod),
            completionProjection: calculateCompletionProjection(progress, forecastPeriod),
            riskFactors: identifyRiskFactors(progress),
            opportunities: identifyOpportunities(progress)
          },
          courseProjections: progress.courseProgress.map(course => ({
            courseName: course.courseName,
            currentGrade: course.currentGrade,
            projectedFinal: course.estimatedFinalGrade,
            trajectory: course.progressTrajectory,
            confidence: calculateProjectionConfidence(course)
          }))
        };

        return {
          success: true,
          data: trendAnalysis,
          insights: [
            `Projected GPA: ${trendAnalysis.forecasts.gpaProjection.toFixed(2)}`,
            `Risk factors: ${trendAnalysis.forecasts.riskFactors.length}`,
            `Growth opportunities: ${trendAnalysis.forecasts.opportunities.length}`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to forecast performance trends: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'manage_student_goals',
    description: 'Create, track, and manage student learning goals and objectives',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID for goal management'
        },
        action: {
          type: 'string',
          enum: ['list', 'create', 'update', 'complete'],
          description: 'Goal management action to perform',
          default: 'list'
        },
        goalData: {
          type: 'object',
          description: 'Goal data for create/update actions',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            targetValue: { type: 'number' },
            unit: { type: 'string' },
            deadline: { type: 'string' },
            priority: { type: 'string' }
          }
        }
      },
      required: ['userId']
    },
    handler: async (args: any) => {
      try {
        const { userId, action = 'list', goalData } = args;
        
        const progress = await progressTracker.trackStudentProgress(userId);
        
        if (action === 'list') {
          const goalsSummary = {
            totalGoals: progress.goals.length,
            activeGoals: progress.goals.filter(g => g.status === 'in_progress').length,
            completedGoals: progress.goals.filter(g => g.status === 'completed').length,
            overdueGoals: progress.goals.filter(g => g.status === 'overdue').length,
            goalsByCategory: groupGoalsByCategory(progress.goals),
            upcomingDeadlines: progress.goals
              .filter(g => g.status === 'in_progress')
              .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
              .slice(0, 5)
              .map(goal => ({
                title: goal.title,
                deadline: goal.deadline,
                progress: (goal.progress * 100).toFixed(1) + '%',
                priority: goal.priority,
                estimatedCompletion: goal.estimatedCompletion
              })),
            recentCompletions: progress.goals
              .filter(g => g.status === 'completed')
              .slice(0, 3)
              .map(goal => ({
                title: goal.title,
                category: goal.category,
                targetValue: goal.targetValue,
                unit: goal.unit
              }))
          };

          return {
            success: true,
            data: goalsSummary,
            insights: [
              `${goalsSummary.activeGoals} active goals`,
              `${goalsSummary.completedGoals} completed goals`,
              `${goalsSummary.overdueGoals} goals need attention`
            ]
          };
        }

        // For create/update/complete actions, implement goal management logic
        return {
          success: true,
          message: `Goal ${action} action would be implemented here`,
          data: { action, goalData }
        };
        
      } catch (error) {
        return {
          success: false,
          error: 'Failed to manage student goals: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'analyze_study_patterns',
    description: 'Analyze study habits and provide personalized optimization recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID to analyze study patterns for'
        },
        analysisDepth: {
          type: 'string',
          enum: ['basic', 'detailed', 'comprehensive'],
          description: 'Depth of study pattern analysis',
          default: 'detailed'
        }
      },
      required: ['userId']
    },
    handler: async (args: any) => {
      try {
        const { userId, analysisDepth = 'detailed' } = args;
        
        const progress = await progressTracker.trackStudentProgress(userId);
        const patterns = progress.studyPatterns;
        
        const analysis = {
          studyHabits: {
            averageSessionDuration: `${Math.round(patterns.averageSessionDuration)} minutes`,
            dailyStudyTime: `${patterns.studyFrequency.dailyAverage.toFixed(1)} hours`,
            weeklyStudyTime: `${patterns.studyFrequency.weeklyTotal.toFixed(1)} hours`,
            consistencyScore: (patterns.studyFrequency.consistencyScore * 100).toFixed(1) + '%'
          },
          preferredTimes: patterns.preferredStudyTimes.map(time => ({
            dayOfWeek: time.dayOfWeek,
            timeSlot: `${time.startHour}:00 - ${time.endHour}:00`,
            frequency: time.frequency,
            effectiveness: (time.effectiveness * 100).toFixed(1) + '%'
          })),
          productivityInsights: {
            mostProductiveHour: `${patterns.productivityPatterns.mostProductiveHour}:00`,
            leastProductiveHour: `${patterns.productivityPatterns.leastProductiveHour}:00`,
            optimalSessionLength: `${patterns.productivityPatterns.optimalSessionLength} minutes`,
            recommendedBreakFrequency: `Every ${patterns.productivityPatterns.breakFrequency} minutes`
          },
          learningEffectiveness: {
            comprehensionRate: (patterns.learningEffectiveness.comprehensionRate * 100).toFixed(1) + '%',
            retentionRate: (patterns.learningEffectiveness.retentionRate * 100).toFixed(1) + '%',
            applicationSuccess: (patterns.learningEffectiveness.applicationSuccess * 100).toFixed(1) + '%'
          },
          recommendations: patterns.recommendedSchedule.map(rec => ({
            timeSlot: rec.timeSlot,
            duration: `${rec.duration} minutes`,
            activity: rec.activity,
            rationale: rec.rationale,
            priority: rec.priority
          })),
          optimizationSuggestions: generateOptimizationSuggestions(patterns)
        };

        return {
          success: true,
          data: analysis,
          insights: [
            `Study consistency: ${analysis.studyHabits.consistencyScore}`,
            `Most productive at: ${analysis.productivityInsights.mostProductiveHour}`,
            `Comprehension rate: ${analysis.learningEffectiveness.comprehensionRate}`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to analyze study patterns: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'generate_progress_insights',
    description: 'Generate personalized insights and actionable recommendations for academic improvement',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID to generate insights for'
        },
        insightTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['strengths', 'improvements', 'opportunities', 'warnings', 'celebrations']
          },
          description: 'Types of insights to generate',
          default: ['strengths', 'improvements', 'opportunities']
        },
        priorityLevel: {
          type: 'string',
          enum: ['high', 'medium', 'low', 'all'],
          description: 'Priority level filter for insights',
          default: 'all'
        }
      },
      required: ['userId']
    },
    handler: async (args: any) => {
      try {
        const { userId, insightTypes = ['strengths', 'improvements', 'opportunities'], priorityLevel = 'all' } = args;
        
        const progress = await progressTracker.trackStudentProgress(userId);
        
        // Filter insights by type and priority
        let filteredInsights = progress.insights;
        
        if (insightTypes.length > 0) {
          filteredInsights = filteredInsights.filter(insight => 
            insightTypes.includes(insight.category)
          );
        }
        
        if (priorityLevel !== 'all') {
          filteredInsights = filteredInsights.filter(insight => 
            insight.priority === priorityLevel
          );
        }

        const insightsSummary = {
          totalInsights: filteredInsights.length,
          insightsByCategory: {
            strengths: filteredInsights.filter(i => i.category === 'strength').length,
            improvements: filteredInsights.filter(i => i.category === 'improvement_area').length,
            opportunities: filteredInsights.filter(i => i.category === 'opportunity').length,
            warnings: filteredInsights.filter(i => i.category === 'warning').length,
            celebrations: filteredInsights.filter(i => i.category === 'celebration').length
          },
          priorityBreakdown: {
            high: filteredInsights.filter(i => i.priority === 'high').length,
            medium: filteredInsights.filter(i => i.priority === 'medium').length,
            low: filteredInsights.filter(i => i.priority === 'low').length
          },
          topInsights: filteredInsights
            .sort((a, b) => {
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              return priorityOrder[b.priority as keyof typeof priorityOrder] - 
                     priorityOrder[a.priority as keyof typeof priorityOrder];
            })
            .slice(0, 8)
            .map(insight => ({
              category: insight.category,
              priority: insight.priority,
              title: insight.title,
              description: insight.description,
              evidence: insight.evidence,
              recommendations: insight.recommendations,
              actionItems: insight.actionItems.map(action => ({
                title: action.title,
                effort: action.effort,
                timeframe: action.timeframe,
                expectedImpact: action.expectedImpact
              })),
              impactPotential: insight.impactPotential
            })),
          quickActions: filteredInsights
            .flatMap(i => i.actionItems)
            .filter(action => action.effort === 'low' && action.timeframe === 'immediate')
            .slice(0, 5)
            .map(action => ({
              title: action.title,
              description: action.description,
              expectedImpact: action.expectedImpact
            }))
        };

        return {
          success: true,
          data: insightsSummary,
          insights: [
            `${insightsSummary.totalInsights} insights generated`,
            `${insightsSummary.priorityBreakdown.high} high-priority items`,
            `${insightsSummary.quickActions.length} quick actions available`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to generate progress insights: ' + (error as Error).message
        };
      }
    }
  }
];

// === MCP TOOL HANDLERS ===

export async function handleProgressTrackerTool(request: CallToolRequest): Promise<any> {
  const startTime = Date.now();
  
  try {
    switch (request.params.name) {
      case 'track_student_progress':
        return await handleTrackStudentProgress(request);
      
      case 'analyze_learning_milestones':
        return await handleAnalyzeLearningMilestones(request);
      
      case 'forecast_performance_trends':
        return await handleForecastPerformanceTrends(request);
      
      case 'manage_student_goals':
        return await handleManageStudentGoals(request);
      
      case 'analyze_study_patterns':
        return await handleAnalyzeStudyPatterns(request);
      
      case 'generate_progress_insights':
        return await handleGenerateProgressInsights(request);
      
      default:
        throw new Error(`Unknown progress tracker tool: ${request.params.name}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Progress tracker tool ${request.params.name} failed after ${duration}ms: ${error}`);
    throw error;
  }
}

// === INDIVIDUAL TOOL HANDLERS ===

async function handleTrackStudentProgress(request: CallToolRequest): Promise<any> {
  const { userId, forceRefresh = false } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Tracking comprehensive progress for user: ${userId}`);
  
  const progress = await progressTracker.trackStudentProgress(userId, forceRefresh);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          userId: progress.userId,
          analysisDate: progress.analysisDate,
          confidenceLevel: progress.confidenceLevel,
          overview: {
            completionRate: progress.progressOverview.overallCompletionRate,
            currentGPA: progress.progressOverview.currentGPA,
            totalPoints: `${progress.progressOverview.totalPointsEarned}/${progress.progressOverview.totalPointsPossible}`,
            streakDays: progress.progressOverview.streakDays,
            lastActive: progress.progressOverview.lastActiveDate
          },
          courses: progress.courseProgress.map(course => ({
            name: course.courseName,
            completion: course.completionRate,
            grade: course.currentGrade,
            trajectory: course.progressTrajectory,
            assignments: course.assignmentProgress
          })),
          milestones: progress.learningMilestones.slice(0, 5),
          studyPatterns: {
            averageSession: progress.studyPatterns.averageSessionDuration,
            frequency: progress.studyPatterns.studyFrequency,
            effectiveness: progress.studyPatterns.learningEffectiveness
          },
          goals: {
            active: progress.goals.filter(g => g.status === 'in_progress').length,
            completed: progress.goals.filter(g => g.status === 'completed').length,
            total: progress.goals.length
          },
          achievements: progress.achievements.length,
          keyInsights: progress.insights.slice(0, 3).map(insight => ({
            category: insight.category,
            priority: insight.priority,
            title: insight.title,
            recommendations: insight.recommendations.slice(0, 2)
          }))
        }, null, 2)
      }
    ]
  };
}

async function handleAnalyzeLearningMilestones(request: CallToolRequest): Promise<any> {
  const { userId, timeframe = 'month' } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Analyzing learning milestones for user: ${userId}, timeframe: ${timeframe}`);
  
  const progress = await progressTracker.trackStudentProgress(userId);
  
  // Filter milestones by timeframe
  const cutoffDate = new Date();
  switch (timeframe) {
    case 'week': cutoffDate.setDate(cutoffDate.getDate() - 7); break;
    case 'month': cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
    case 'semester': cutoffDate.setMonth(cutoffDate.getMonth() - 4); break;
    case 'all': cutoffDate.setFullYear(cutoffDate.getFullYear() - 10); break;
  }

  const filteredMilestones = progress.learningMilestones.filter(milestone => 
    new Date(milestone.achievedDate) >= cutoffDate
  );
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          userId,
          timeframe,
          analysis: {
            totalMilestones: filteredMilestones.length,
            highImpact: filteredMilestones.filter(m => m.impact === 'high').length,
            milestonesByType: filteredMilestones.reduce((acc: any, m) => {
              acc[m.type] = (acc[m.type] || 0) + 1;
              return acc;
            }, {}),
            skillsDeveloped: [...new Set(filteredMilestones.flatMap(m => m.skillsGained))],
            recentAchievements: filteredMilestones.slice(0, 10).map(milestone => ({
              title: milestone.title,
              type: milestone.type,
              impact: milestone.impact,
              date: milestone.achievedDate,
              celebration: milestone.celebrationMessage,
              skills: milestone.skillsGained,
              nextTarget: milestone.nextMilestone
            }))
          }
        }, null, 2)
      }
    ]
  };
}

async function handleForecastPerformanceTrends(request: CallToolRequest): Promise<any> {
  const { userId, forecastPeriod = 'next_month' } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Forecasting performance trends for user: ${userId}, period: ${forecastPeriod}`);
  
  const progress = await progressTracker.trackStudentProgress(userId);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          userId,
          forecastPeriod,
          currentMetrics: {
            gpa: progress.progressOverview.currentGPA,
            completionRate: progress.progressOverview.overallCompletionRate,
            streakDays: progress.progressOverview.streakDays
          },
          trends: progress.performanceTrends.map(trend => ({
            category: trend.category,
            direction: trend.trendDirection,
            changePercent: trend.changePercentage,
            analysis: trend.analysis,
            recommendations: trend.recommendations
          })),
          projections: {
            estimatedGPA: calculateGPAProjection(progress, forecastPeriod),
            completionRateProjection: calculateCompletionProjection(progress, forecastPeriod),
            courseProjections: progress.courseProgress.map(course => ({
              name: course.courseName,
              currentGrade: course.currentGrade,
              projectedFinal: course.estimatedFinalGrade,
              trajectory: course.progressTrajectory
            }))
          },
          riskFactors: identifyRiskFactors(progress),
          opportunities: identifyOpportunities(progress)
        }, null, 2)
      }
    ]
  };
}

async function handleManageStudentGoals(request: CallToolRequest): Promise<any> {
  const { userId, action = 'list', goalData } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Managing student goals for user: ${userId}, action: ${action}`);
  
  const progress = await progressTracker.trackStudentProgress(userId);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          userId,
          action,
          goalManagement: {
            totalGoals: progress.goals.length,
            activeGoals: progress.goals.filter(g => g.status === 'in_progress').length,
            completedGoals: progress.goals.filter(g => g.status === 'completed').length,
            overdueGoals: progress.goals.filter(g => g.status === 'overdue').length,
            goalsByCategory: groupGoalsByCategory(progress.goals),
            upcomingDeadlines: progress.goals
              .filter(g => g.status === 'in_progress')
              .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
              .slice(0, 5)
              .map(goal => ({
                title: goal.title,
                deadline: goal.deadline,
                progress: goal.progress,
                priority: goal.priority
              }))
          }
        }, null, 2)
      }
    ]
  };
}

async function handleAnalyzeStudyPatterns(request: CallToolRequest): Promise<any> {
  const { userId, analysisDepth = 'detailed' } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Analyzing study patterns for user: ${userId}, depth: ${analysisDepth}`);
  
  const progress = await progressTracker.trackStudentProgress(userId);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          userId,
          analysisDepth,
          studyPatterns: {
            sessionMetrics: {
              averageDuration: progress.studyPatterns.averageSessionDuration,
              frequency: progress.studyPatterns.studyFrequency,
              consistency: progress.studyPatterns.studyFrequency.consistencyScore
            },
            timePreferences: progress.studyPatterns.preferredStudyTimes,
            productivity: progress.studyPatterns.productivityPatterns,
            effectiveness: progress.studyPatterns.learningEffectiveness,
            recommendations: progress.studyPatterns.recommendedSchedule,
            optimizationTips: generateOptimizationSuggestions(progress.studyPatterns)
          }
        }, null, 2)
      }
    ]
  };
}

async function handleGenerateProgressInsights(request: CallToolRequest): Promise<any> {
  const { userId, insightTypes = ['strengths', 'improvements', 'opportunities'], priorityLevel = 'all' } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Generating progress insights for user: ${userId}`);
  
  const progress = await progressTracker.trackStudentProgress(userId);
  
  // Filter insights
  let filteredInsights = progress.insights;
  if (insightTypes.length > 0) {
    filteredInsights = filteredInsights.filter(insight => insightTypes.includes(insight.category));
  }
  if (priorityLevel !== 'all') {
    filteredInsights = filteredInsights.filter(insight => insight.priority === priorityLevel);
  }
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          userId,
          insightFilters: { types: insightTypes, priority: priorityLevel },
          analysis: {
            totalInsights: filteredInsights.length,
            breakdown: {
              strengths: filteredInsights.filter(i => i.category === 'strength').length,
              improvements: filteredInsights.filter(i => i.category === 'improvement_area').length,
              opportunities: filteredInsights.filter(i => i.category === 'opportunity').length,
              warnings: filteredInsights.filter(i => i.category === 'warning').length,
              celebrations: filteredInsights.filter(i => i.category === 'celebration').length
            },
            priorityDistribution: {
              high: filteredInsights.filter(i => i.priority === 'high').length,
              medium: filteredInsights.filter(i => i.priority === 'medium').length,
              low: filteredInsights.filter(i => i.priority === 'low').length
            }
          },
          insights: filteredInsights.slice(0, 10).map(insight => ({
            category: insight.category,
            priority: insight.priority,
            title: insight.title,
            description: insight.description,
            evidence: insight.evidence,
            recommendations: insight.recommendations,
            actionItems: insight.actionItems,
            impact: insight.impactPotential
          }))
        }, null, 2)
      }
    ]
  };
}

// === HELPER FUNCTIONS ===

function calculateGPAProjection(progress: any, period: string): number {
  const currentGPA = progress.progressOverview.currentGPA;
  const trends = progress.performanceTrends.find((t: any) => t.category === 'grades');
  
  if (!trends) return currentGPA;
  
  let projectionFactor = 1;
  switch (period) {
    case 'next_week': projectionFactor = 0.1; break;
    case 'next_month': projectionFactor = 0.3; break;
    case 'end_semester': projectionFactor = 1; break;
  }
  
  const trendAdjustment = trends.changePercentage / 100 * projectionFactor;
  return Math.max(0, Math.min(4.0, currentGPA + trendAdjustment));
}

function calculateCompletionProjection(progress: any, period: string): number {
  const currentRate = progress.progressOverview.overallCompletionRate;
  const trends = progress.performanceTrends.find((t: any) => t.category === 'completion_rate');
  
  if (!trends) return currentRate;
  
  let projectionFactor = 1;
  switch (period) {
    case 'next_week': projectionFactor = 0.1; break;
    case 'next_month': projectionFactor = 0.3; break;
    case 'end_semester': projectionFactor = 1; break;
  }
  
  const trendAdjustment = trends.changePercentage / 100 * projectionFactor;
  return Math.max(0, Math.min(1.0, currentRate + trendAdjustment));
}

function identifyRiskFactors(progress: any): string[] {
  const risks = [];
  
  if (progress.progressOverview.currentGPA < 2.0) {
    risks.push('Low GPA requires immediate attention');
  }
  
  if (progress.progressOverview.overallCompletionRate < 0.7) {
    risks.push('Assignment completion rate below acceptable threshold');
  }
  
  if (progress.progressOverview.streakDays < 3) {
    risks.push('Inconsistent engagement pattern');
  }
  
  const decliningCourses = progress.courseProgress.filter((c: any) => c.progressTrajectory === 'declining');
  if (decliningCourses.length > 0) {
    risks.push(`${decliningCourses.length} course(s) showing declining performance`);
  }
  
  return risks;
}

function identifyOpportunities(progress: any): string[] {
  const opportunities = [];
  
  if (progress.progressOverview.currentGPA > 3.5) {
    opportunities.push('Excellent performance - consider advanced coursework or mentoring');
  }
  
  if (progress.studyPatterns.studyFrequency.consistencyScore > 0.8) {
    opportunities.push('Strong study habits - optimize for efficiency');
  }
  
  const improvingCourses = progress.courseProgress.filter((c: any) => c.progressTrajectory === 'improving');
  if (improvingCourses.length > 0) {
    opportunities.push(`${improvingCourses.length} course(s) showing positive trends`);
  }
  
  if (progress.progressOverview.streakDays > 14) {
    opportunities.push('Excellent engagement streak - maintain momentum');
  }
  
  return opportunities;
}

function groupGoalsByCategory(goals: any[]): any {
  return goals.reduce((acc: any, goal) => {
    if (!acc[goal.category]) acc[goal.category] = [];
    acc[goal.category].push(goal);
    return acc;
  }, {});
}

function generateOptimizationSuggestions(patterns: any): string[] {
  const suggestions = [];
  
  if (patterns.studyFrequency.consistencyScore < 0.6) {
    suggestions.push('Establish fixed study times to improve consistency');
  }
  
  if (patterns.averageSessionDuration > 120) {
    suggestions.push('Consider shorter study sessions with breaks to maintain focus');
  }
  
  if (patterns.learningEffectiveness.retentionRate < 0.7) {
    suggestions.push('Implement spaced repetition techniques for better retention');
  }
  
  if (patterns.productivityPatterns.optimalSessionLength > patterns.averageSessionDuration + 30) {
    suggestions.push('Extend study sessions closer to your optimal length');
  }
  
  return suggestions;
}

function calculateProjectionConfidence(course: any): number {
  let confidence = 0.5;
  if (course.assignmentProgress.completed > 5) confidence += 0.2;
  if (course.assignmentProgress.completed > 10) confidence += 0.1;
  if (course.progressTrajectory === 'stable' || course.progressTrajectory === 'improving') {
    confidence += 0.2;
  } else if (course.progressTrajectory === 'variable') {
    confidence -= 0.1;
  }
  if (course.pointsEarned > 100) confidence += 0.1;
  return Math.min(confidence, 0.95);
} 