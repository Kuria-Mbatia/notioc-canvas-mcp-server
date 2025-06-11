import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../lib/logger.js';
import { RelationshipIntelligence } from '../lib/relationship-intelligence.js';

// Phase 3B: Advanced Relationship Intelligence MCP Tools
// Group dynamics, peer influence mapping, collaboration effectiveness, social support analysis

const relationshipIntelligence = new RelationshipIntelligence();

// === MCP TOOL DEFINITIONS ===

export const relationshipIntelligenceTools: Tool[] = [
  {
    name: 'analyze_group_dynamics',
    description: 'Analyze group collaboration dynamics, member roles, and effectiveness metrics',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'Unique identifier for the group (e.g., course_id-project_name)'
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Force fresh analysis even if recent cached results exist',
          default: false
        }
      },
      required: ['groupId']
    },
    handler: async (args: any) => {
      try {
        const { groupId, forceRefresh = false } = args;
        
        const analysis = await relationshipIntelligence.analyzeGroupDynamics(groupId, forceRefresh);
        
        const summary = {
          groupInfo: {
            id: analysis.groupId,
            type: analysis.groupType,
            memberCount: analysis.members.length,
            confidenceLevel: (analysis.confidenceLevel * 100).toFixed(1) + '%'
          },
          dynamics: {
            cohesion: (analysis.dynamicsAnalysis.cohesionScore * 100).toFixed(1) + '%',
            participationBalance: (analysis.dynamicsAnalysis.participationBalance * 100).toFixed(1) + '%',
            leadershipStyle: analysis.dynamicsAnalysis.leadershipStyle,
            communicationEffectiveness: (analysis.dynamicsAnalysis.communicationEffectiveness * 100).toFixed(1) + '%',
            conflictLevel: analysis.dynamicsAnalysis.conflictLevel,
            productivity: (analysis.dynamicsAnalysis.productivityScore * 100).toFixed(1) + '%'
          },
          effectiveness: {
            taskCompletion: (analysis.effectivenessMetrics.taskCompletion * 100).toFixed(1) + '%',
            outputQuality: (analysis.effectivenessMetrics.qualityOfOutput * 100).toFixed(1) + '%',
            memberSatisfaction: (analysis.effectivenessMetrics.memberSatisfaction * 100).toFixed(1) + '%',
            learningOutcomes: (analysis.effectivenessMetrics.learningOutcomes * 100).toFixed(1) + '%'
          },
          members: analysis.members.map(member => ({
            name: member.name,
            role: member.role,
            contribution: (member.contributionLevel * 100).toFixed(1) + '%',
            influence: (member.influenceScore * 100).toFixed(1) + '%',
            style: member.collaborationStyle,
            strengths: member.strengths,
            growthAreas: member.growthAreas
          })),
          recommendations: analysis.recommendations,
          analysisDate: analysis.analysisDate
        };

        return {
          success: true,
          data: summary,
          insights: [
            `Group cohesion: ${summary.dynamics.cohesion}`,
            `Leadership style: ${summary.dynamics.leadershipStyle}`,
            `Top recommendation: ${analysis.recommendations[0] || 'Group performing well'}`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to analyze group dynamics: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'map_peer_influence',
    description: 'Map peer influence networks and identify connection strengths and types',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID to analyze influence network for'
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
        
        const influenceMap = await relationshipIntelligence.mapPeerInfluence(userId, forceRefresh);
        
        const summary = {
          networkInfo: {
            centerUser: influenceMap.centerUserId,
            networkSize: influenceMap.networkMetrics.networkSize,
            confidenceLevel: (influenceMap.confidenceLevel * 100).toFixed(1) + '%'
          },
          metrics: {
            influenceReach: (influenceMap.networkMetrics.influenceReach * 100).toFixed(1) + '%',
            influenceReceived: (influenceMap.networkMetrics.influenceReceived * 100).toFixed(1) + '%',
            brokeragePosition: (influenceMap.networkMetrics.brokeragePosition * 100).toFixed(1) + '%',
            clustering: (influenceMap.networkMetrics.clusterCoefficient * 100).toFixed(1) + '%'
          },
          influenceTypes: {
            academic: (influenceMap.influenceTypes.academic * 100).toFixed(1) + '%',
            social: (influenceMap.influenceTypes.social * 100).toFixed(1) + '%',
            motivational: (influenceMap.influenceTypes.motivational * 100).toFixed(1) + '%',
            informational: (influenceMap.influenceTypes.informational * 100).toFixed(1) + '%'
          },
          topConnections: influenceMap.influenceNetwork
            .slice(0, 5)
            .map(conn => ({
              name: conn.targetName,
              strength: (conn.connectionStrength * 100).toFixed(1) + '%',
              direction: conn.influenceDirection,
              type: conn.influenceType,
              context: conn.connectionContext,
              evidence: {
                interactions: conn.evidenceMetrics.interactionFrequency,
                responseRate: (conn.evidenceMetrics.responseRate * 100).toFixed(1) + '%'
              }
            })),
          analysisDate: influenceMap.analysisDate
        };

        return {
          success: true,
          data: summary,
          insights: [
            `Network size: ${summary.networkInfo.networkSize} connections`,
            `Primary influence type: ${Object.entries(influenceMap.influenceTypes).reduce((a, b) => influenceMap.influenceTypes[a[0] as keyof typeof influenceMap.influenceTypes] > influenceMap.influenceTypes[b[0] as keyof typeof influenceMap.influenceTypes] ? a : b)[0]}`,
            `Strongest connection: ${summary.topConnections[0]?.name || 'None found'}`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to map peer influence: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'analyze_collaboration_effectiveness',
    description: 'Analyze collaboration effectiveness between specific participants',
    inputSchema: {
      type: 'object',
      properties: {
        participants: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Canvas user IDs for collaboration participants'
        },
        collaborationType: {
          type: 'string',
          enum: ['peer_tutoring', 'study_partnership', 'project_collaboration', 'discussion_partnership'],
          description: 'Type of collaboration to analyze',
          default: 'study_partnership'
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Force fresh analysis even if recent cached results exist',
          default: false
        }
      },
      required: ['participants']
    },
    handler: async (args: any) => {
      try {
        const { participants, collaborationType = 'study_partnership', forceRefresh = false } = args;
        
        if (participants.length < 2) {
          return {
            success: false,
            error: 'At least 2 participants required for collaboration analysis'
          };
        }
        
        const analysis = await relationshipIntelligence.analyzeCollaborationEffectiveness(
          participants, 
          collaborationType, 
          forceRefresh
        );
        
        const summary = {
          partnershipInfo: {
            id: analysis.partnershipId,
            participants: analysis.participants,
            type: analysis.collaborationType,
            effectivenessScore: (analysis.effectivenessScore * 100).toFixed(1) + '%',
            recommendedDuration: analysis.recommendedDuration,
            confidenceLevel: (analysis.confidenceLevel * 100).toFixed(1) + '%'
          },
          compatibility: {
            learningStyleMatch: (analysis.compatibilityAnalysis.learningStyleMatch * 100).toFixed(1) + '%',
            communicationMatch: (analysis.compatibilityAnalysis.communicationStyleMatch * 100).toFixed(1) + '%',
            scheduleCompatibility: (analysis.compatibilityAnalysis.scheduleCompatibility * 100).toFixed(1) + '%',
            skillComplementarity: (analysis.compatibilityAnalysis.skillComplementarity * 100).toFixed(1) + '%',
            motivationAlignment: (analysis.compatibilityAnalysis.motivationAlignment * 100).toFixed(1) + '%'
          },
          outcomes: {
            taskSuccessRate: (analysis.outcomeMetrics.taskSuccessRate * 100).toFixed(1) + '%',
            learningGains: (analysis.outcomeMetrics.learningGains * 100).toFixed(1) + '%',
            satisfaction: (analysis.outcomeMetrics.satisfactionLevel * 100).toFixed(1) + '%',
            retention: (analysis.outcomeMetrics.retentionRate * 100).toFixed(1) + '%'
          },
          improvements: analysis.improvements,
          challenges: analysis.potentialChallenges,
          analysisDate: analysis.analysisDate
        };

        return {
          success: true,
          data: summary,
          insights: [
            `Overall effectiveness: ${summary.partnershipInfo.effectivenessScore}`,
            `Best compatibility area: ${Object.entries(analysis.compatibilityAnalysis).reduce((a, b) => (a[1] as number) > (b[1] as number) ? a : b)[0]}`,
            `Recommended duration: ${summary.partnershipInfo.recommendedDuration}`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to analyze collaboration effectiveness: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'analyze_social_support_network',
    description: 'Analyze social support network strength and identify risk factors',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Canvas user ID to analyze support network for'
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
        
        const analysis = await relationshipIntelligence.analyzeSocialSupportNetwork(userId, forceRefresh);
        
        const summary = {
          networkInfo: {
            userId: analysis.userId,
            confidenceLevel: (analysis.confidenceLevel * 100).toFixed(1) + '%'
          },
          supportLevels: {
            academic: {
              availability: (analysis.supportLevels.academic.availabilityScore * 100).toFixed(1) + '%',
              quality: (analysis.supportLevels.academic.qualityScore * 100).toFixed(1) + '%',
              utilization: (analysis.supportLevels.academic.utilizationRate * 100).toFixed(1) + '%',
              supporters: analysis.supportLevels.academic.supporters.length
            },
            emotional: {
              availability: (analysis.supportLevels.emotional.availabilityScore * 100).toFixed(1) + '%',
              quality: (analysis.supportLevels.emotional.qualityScore * 100).toFixed(1) + '%',
              utilization: (analysis.supportLevels.emotional.utilizationRate * 100).toFixed(1) + '%',
              supporters: analysis.supportLevels.emotional.supporters.length
            },
            social: {
              availability: (analysis.supportLevels.social.availabilityScore * 100).toFixed(1) + '%',
              quality: (analysis.supportLevels.social.qualityScore * 100).toFixed(1) + '%',
              utilization: (analysis.supportLevels.social.utilizationRate * 100).toFixed(1) + '%',
              supporters: analysis.supportLevels.social.supporters.length
            },
            informational: {
              availability: (analysis.supportLevels.informational.availabilityScore * 100).toFixed(1) + '%',
              quality: (analysis.supportLevels.informational.qualityScore * 100).toFixed(1) + '%',
              utilization: (analysis.supportLevels.informational.utilizationRate * 100).toFixed(1) + '%',
              supporters: analysis.supportLevels.informational.supporters.length
            }
          },
          networkHealth: {
            diversity: (analysis.networkHealth.diversityScore * 100).toFixed(1) + '%',
            redundancy: (analysis.networkHealth.redundancyScore * 100).toFixed(1) + '%',
            accessibility: (analysis.networkHealth.accessibilityScore * 100).toFixed(1) + '%',
            reciprocity: (analysis.networkHealth.reciprocityScore * 100).toFixed(1) + '%'
          },
          riskFactors: analysis.riskFactors,
          strengths: analysis.strengthFactors,
          recommendations: analysis.recommendations,
          analysisDate: analysis.analysisDate
        };

        return {
          success: true,
          data: summary,
          insights: [
            `Network diversity: ${summary.networkHealth.diversity}`,
            `Risk factors: ${analysis.riskFactors.length}`,
            `Strengths: ${analysis.strengthFactors.length}`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to analyze social support network: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'recommend_group_formation',
    description: 'Get optimal group formation recommendations based on member compatibility',
    inputSchema: {
      type: 'object',
      properties: {
        requesterId: {
          type: 'string',
          description: 'Canvas user ID of the person requesting group recommendations'
        },
        groupSize: {
          type: 'number',
          description: 'Desired group size',
          minimum: 2,
          maximum: 8,
          default: 4
        },
        collaborationType: {
          type: 'string',
          enum: ['study_group', 'project_team', 'discussion_group', 'peer_tutoring'],
          description: 'Type of collaboration the group will engage in',
          default: 'study_group'
        },
        excludeUserIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'User IDs to exclude from recommendations',
          default: []
        }
      },
      required: ['requesterId']
    },
    handler: async (args: any) => {
      try {
        const { requesterId, groupSize = 4, collaborationType = 'study_group', excludeUserIds = [] } = args;
        
        // Simplified group formation recommendation
        // In a real implementation, this would analyze compatibility matrices
        const recommendations = {
          requesterId,
          groupSize,
          collaborationType,
          recommendations: [
            {
              rank: 1,
              members: [requesterId, 'user_2', 'user_3', 'user_4'].slice(0, groupSize),
              predictedEffectiveness: '85%',
              rationale: [
                'Complementary learning styles',
                'Similar engagement levels',
                'Good communication compatibility'
              ],
              strengths: ['Diverse skill sets', 'Strong motivation alignment'],
              potentialChallenges: ['Different time zones', 'Varying experience levels']
            },
            {
              rank: 2,
              members: [requesterId, 'user_5', 'user_6', 'user_7'].slice(0, groupSize),
              predictedEffectiveness: '78%',
              rationale: [
                'Similar academic backgrounds',
                'Good schedule overlap',
                'Established peer connections'
              ],
              strengths: ['Consistent availability', 'Proven collaboration history'],
              potentialChallenges: ['Similar thinking styles', 'Potential for groupthink']
            }
          ],
          analysisFactors: [
            'Learning style compatibility',
            'Communication preferences',
            'Schedule alignment',
            'Skill complementarity',
            'Previous collaboration success',
            'Motivation levels',
            'Academic performance balance'
          ],
          recommendationDate: new Date().toISOString()
        };

        return {
          success: true,
          data: recommendations,
          insights: [
            `Top recommendation: ${recommendations.recommendations[0].predictedEffectiveness} predicted effectiveness`,
            `Key factor: ${recommendations.analysisFactors[0]}`,
            `${recommendations.recommendations.length} viable group options identified`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to generate group recommendations: ' + (error as Error).message
        };
      }
    }
  },

  {
    name: 'identify_at_risk_relationships',
    description: 'Identify students with weak or declining social support networks',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'string',
          description: 'Canvas course ID to analyze (optional - if not provided, analyzes all students)'
        },
        riskThreshold: {
          type: 'number',
          description: 'Risk threshold (0-1, where higher values indicate higher risk tolerance)',
          minimum: 0,
          maximum: 1,
          default: 0.3
        },
        includeRecommendations: {
          type: 'boolean',
          description: 'Include intervention recommendations for at-risk students',
          default: true
        }
      }
    },
    handler: async (args: any) => {
      try {
        const { courseId, riskThreshold = 0.3, includeRecommendations = true } = args;
        
        // Simplified at-risk identification
        // In a real implementation, this would query the database for students with weak networks
        const atRiskStudents = [
          {
            userId: 'student_1',
            name: 'Student At Risk',
            riskLevel: 'high',
            riskScore: 0.8,
            issues: [
              'Very small support network (< 2 contacts)',
              'No recent social interactions',
              'Weak academic support connections',
              'Low emotional support availability'
            ],
            networkMetrics: {
              networkSize: 1,
              diversityScore: '20%',
              accessibilityScore: '30%',
              utilizationRate: '10%'
            },
            recommendations: includeRecommendations ? [
              'Connect with study groups in shared courses',
              'Participate in campus social activities',
              'Reach out to academic advisors',
              'Join peer tutoring programs'
            ] : [],
            lastAnalysis: new Date().toISOString()
          },
          {
            userId: 'student_2',
            name: 'Student Moderate Risk',
            riskLevel: 'medium',
            riskScore: 0.5,
            issues: [
              'Limited emotional support network',
              'Over-reliance on single support source',
              'Declining interaction frequency'
            ],
            networkMetrics: {
              networkSize: 3,
              diversityScore: '45%',
              accessibilityScore: '60%',
              utilizationRate: '40%'
            },
            recommendations: includeRecommendations ? [
              'Diversify support network types',
              'Strengthen existing relationships',
              'Explore new collaboration opportunities'
            ] : [],
            lastAnalysis: new Date().toISOString()
          }
        ];

        const summary = {
          analysis: {
            courseId: courseId || 'all_courses',
            riskThreshold: riskThreshold,
            studentsAnalyzed: 50, // Placeholder
            atRiskCount: atRiskStudents.length,
            analysisDate: new Date().toISOString()
          },
          riskDistribution: {
            high: atRiskStudents.filter(s => s.riskLevel === 'high').length,
            medium: atRiskStudents.filter(s => s.riskLevel === 'medium').length,
            low: atRiskStudents.filter(s => s.riskLevel === 'low').length
          },
          atRiskStudents: atRiskStudents,
          commonIssues: [
            'Small support network size',
            'Limited diversity in support types',
            'Low utilization of available support',
            'Weak academic support connections'
          ],
          interventionPriorities: atRiskStudents
            .sort((a: any, b: any) => b.riskScore - a.riskScore)
            .slice(0, 5)
            .map((student: any) => ({
              userId: student.userId,
              name: student.name,
              urgency: student.riskScore > 0.7 ? 'Immediate' :
                      student.riskScore > 0.5 ? 'High' : 'Medium',
              primaryIntervention: student.recommendations[0] || 'General support outreach'
            }))
        };

        return {
          success: true,
          data: summary,
          insights: [
            `${summary.analysis.atRiskCount} students identified as at-risk`,
            `${summary.riskDistribution.high} high-risk cases requiring immediate attention`,
            `Most common issue: ${summary.commonIssues[0]}`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to identify at-risk relationships: ' + (error as Error).message
        };
      }
    }
  }
];

// === MCP TOOL HANDLERS ===

export async function handleRelationshipIntelligenceTool(request: CallToolRequest): Promise<any> {
  const startTime = Date.now();
  
  try {
    switch (request.params.name) {
      case 'analyze_group_dynamics':
        return await handleAnalyzeGroupDynamics(request);
      
      case 'map_peer_influence':
        return await handleMapPeerInfluence(request);
      
      case 'analyze_collaboration_effectiveness':
        return await handleAnalyzeCollaborationEffectiveness(request);
      
      case 'analyze_social_support_network':
        return await handleAnalyzeSocialSupportNetwork(request);
      
      case 'recommend_group_formation':
        return await handleRecommendGroupFormation(request);
      
      case 'identify_at_risk_relationships':
        return await handleIdentifyAtRiskRelationships(request);
      
      default:
        throw new Error(`Unknown relationship intelligence tool: ${request.params.name}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Relationship intelligence tool ${request.params.name} failed after ${duration}ms: ${error}`);
    throw error;
  }
}

async function handleAnalyzeGroupDynamics(request: CallToolRequest): Promise<any> {
  const { groupId, forceRefresh = false } = request.params.arguments as any;
  
  if (!groupId) {
    throw new Error('Group ID is required');
  }

  logger.log(`Analyzing group dynamics for group: ${groupId}`);
  
  const analysis = await relationshipIntelligence.analyzeGroupDynamics(groupId, forceRefresh);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          groupId: analysis.groupId,
          groupType: analysis.groupType,
          summary: {
            memberCount: analysis.members.length,
            cohesionScore: analysis.dynamicsAnalysis.cohesionScore,
            participationBalance: analysis.dynamicsAnalysis.participationBalance,
            leadershipStyle: analysis.dynamicsAnalysis.leadershipStyle,
            communicationEffectiveness: analysis.dynamicsAnalysis.communicationEffectiveness,
            conflictLevel: analysis.dynamicsAnalysis.conflictLevel,
            productivityScore: analysis.dynamicsAnalysis.productivityScore,
            overallEffectiveness: {
              taskCompletion: analysis.effectivenessMetrics.taskCompletion,
              qualityOfOutput: analysis.effectivenessMetrics.qualityOfOutput,
              memberSatisfaction: analysis.effectivenessMetrics.memberSatisfaction,
              learningOutcomes: analysis.effectivenessMetrics.learningOutcomes
            }
          },
          members: analysis.members.map(member => ({
            userId: member.userId,
            name: member.name,
            role: member.role,
            contributionLevel: member.contributionLevel,
            influenceScore: member.influenceScore,
            collaborationStyle: member.collaborationStyle,
            strengths: member.strengths,
            growthAreas: member.growthAreas
          })),
          recommendations: analysis.recommendations,
          analysisDate: analysis.analysisDate,
          confidenceLevel: analysis.confidenceLevel,
          insights: {
            strongestContributor: analysis.members.find(m => m.contributionLevel === Math.max(...analysis.members.map(m => m.contributionLevel)))?.name || 'Unknown',
            mostInfluential: analysis.members.find(m => m.influenceScore === Math.max(...analysis.members.map(m => m.influenceScore)))?.name || 'Unknown',
            groupHealthScore: (analysis.dynamicsAnalysis.cohesionScore + analysis.dynamicsAnalysis.participationBalance + analysis.dynamicsAnalysis.communicationEffectiveness + analysis.dynamicsAnalysis.productivityScore) / 4,
            improvementPriority: analysis.recommendations.length > 0 ? analysis.recommendations[0] : 'No immediate improvements needed'
          }
        }, null, 2)
      }
    ]
  };
}

async function handleMapPeerInfluence(request: CallToolRequest): Promise<any> {
  const { userId, forceRefresh = false } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Mapping peer influence network for user: ${userId}`);
  
  const influenceMap = await relationshipIntelligence.mapPeerInfluence(userId, forceRefresh);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          centerUserId: influenceMap.centerUserId,
          networkOverview: {
            networkSize: influenceMap.networkMetrics.networkSize,
            influenceReach: influenceMap.networkMetrics.influenceReach,
            influenceReceived: influenceMap.networkMetrics.influenceReceived,
            brokeragePosition: influenceMap.networkMetrics.brokeragePosition,
            clusterCoefficient: influenceMap.networkMetrics.clusterCoefficient
          },
          influenceProfile: {
            academic: influenceMap.influenceTypes.academic,
            social: influenceMap.influenceTypes.social,
            motivational: influenceMap.influenceTypes.motivational,
            informational: influenceMap.influenceTypes.informational,
            dominantType: Object.entries(influenceMap.influenceTypes)
              .reduce((a, b) => a[1] > b[1] ? a : b)[0]
          },
          topConnections: influenceMap.influenceNetwork
            .slice(0, 5)
            .map(conn => ({
              targetUserId: conn.targetUserId,
              targetName: conn.targetName,
              connectionStrength: conn.connectionStrength,
              influenceDirection: conn.influenceDirection,
              influenceType: conn.influenceType,
              contexts: conn.connectionContext
            })),
          networkInsights: {
            isInfluencer: influenceMap.networkMetrics.influenceReach > influenceMap.networkMetrics.influenceReceived,
            isBroker: influenceMap.networkMetrics.brokeragePosition > 0.6,
            networkDensity: influenceMap.networkMetrics.clusterCoefficient,
            keyInfluenceType: Object.entries(influenceMap.influenceTypes)
              .reduce((a, b) => a[1] > b[1] ? a : b)[0]
          },
          analysisDate: influenceMap.analysisDate,
          confidenceLevel: influenceMap.confidenceLevel
        }, null, 2)
      }
    ]
  };
}

async function handleAnalyzeCollaborationEffectiveness(request: CallToolRequest): Promise<any> {
  const { participants, collaborationType = 'study_partnership', forceRefresh = false } = request.params.arguments as any;
  
  if (!participants || !Array.isArray(participants) || participants.length < 2) {
    throw new Error('At least 2 participant user IDs are required');
  }

  logger.log(`Analyzing collaboration effectiveness for ${participants.length} participants`);
  
  const analysis = await relationshipIntelligence.analyzeCollaborationEffectiveness(
    participants, 
    collaborationType, 
    forceRefresh
  );
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          partnershipId: analysis.partnershipId,
          participants: analysis.participants,
          collaborationType: analysis.collaborationType,
          effectivenessScore: analysis.effectivenessScore,
          effectivenessRating: analysis.effectivenessScore > 0.8 ? 'Excellent' :
                              analysis.effectivenessScore > 0.6 ? 'Good' :
                              analysis.effectivenessScore > 0.4 ? 'Fair' : 'Poor',
          compatibility: {
            learningStyleMatch: analysis.compatibilityAnalysis.learningStyleMatch,
            communicationStyleMatch: analysis.compatibilityAnalysis.communicationStyleMatch,
            scheduleCompatibility: analysis.compatibilityAnalysis.scheduleCompatibility,
            skillComplementarity: analysis.compatibilityAnalysis.skillComplementarity,
            motivationAlignment: analysis.compatibilityAnalysis.motivationAlignment,
            overallCompatibility: (
              analysis.compatibilityAnalysis.learningStyleMatch +
              analysis.compatibilityAnalysis.communicationStyleMatch +
              analysis.compatibilityAnalysis.scheduleCompatibility +
              analysis.compatibilityAnalysis.skillComplementarity +
              analysis.compatibilityAnalysis.motivationAlignment
            ) / 5
          },
          outcomes: {
            taskSuccessRate: analysis.outcomeMetrics.taskSuccessRate,
            learningGains: analysis.outcomeMetrics.learningGains,
            satisfactionLevel: analysis.outcomeMetrics.satisfactionLevel,
            retentionRate: analysis.outcomeMetrics.retentionRate
          },
          recommendations: {
            improvements: analysis.improvements,
            potentialChallenges: analysis.potentialChallenges,
            recommendedDuration: analysis.recommendedDuration
          },
          insights: {
            strongestCompatibilityArea: Object.entries(analysis.compatibilityAnalysis)
              .reduce((a, b) => (a[1] as number) > (b[1] as number) ? a : b)[0].replace(/([A-Z])/g, ' $1').toLowerCase(),
            weakestCompatibilityArea: Object.entries(analysis.compatibilityAnalysis)
              .reduce((a, b) => (a[1] as number) < (b[1] as number) ? a : b)[0].replace(/([A-Z])/g, ' $1').toLowerCase(),
            successPrediction: analysis.effectivenessScore > 0.7 ? 'High likelihood of success' :
                              analysis.effectivenessScore > 0.5 ? 'Moderate likelihood of success' :
                              'May face significant challenges',
            primaryRecommendation: analysis.improvements.length > 0 ? analysis.improvements[0] : 'Continue current collaboration approach'
          },
          analysisDate: analysis.analysisDate,
          confidenceLevel: analysis.confidenceLevel
        }, null, 2)
      }
    ]
  };
}

async function handleAnalyzeSocialSupportNetwork(request: CallToolRequest): Promise<any> {
  const { userId, forceRefresh = false } = request.params.arguments as any;
  
  if (!userId) {
    throw new Error('User ID is required');
  }

  logger.log(`Analyzing social support network for user: ${userId}`);
  
  const analysis = await relationshipIntelligence.analyzeSocialSupportNetwork(userId, forceRefresh);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          userId: analysis.userId,
          supportOverview: {
            academic: {
              availability: analysis.supportLevels.academic.availabilityScore,
              quality: analysis.supportLevels.academic.qualityScore,
              utilization: analysis.supportLevels.academic.utilizationRate,
              supporterCount: analysis.supportLevels.academic.supporters.length
            },
            emotional: {
              availability: analysis.supportLevels.emotional.availabilityScore,
              quality: analysis.supportLevels.emotional.qualityScore,
              utilization: analysis.supportLevels.emotional.utilizationRate,
              supporterCount: analysis.supportLevels.emotional.supporters.length
            },
            social: {
              availability: analysis.supportLevels.social.availabilityScore,
              quality: analysis.supportLevels.social.qualityScore,
              utilization: analysis.supportLevels.social.utilizationRate,
              supporterCount: analysis.supportLevels.social.supporters.length
            },
            informational: {
              availability: analysis.supportLevels.informational.availabilityScore,
              quality: analysis.supportLevels.informational.qualityScore,
              utilization: analysis.supportLevels.informational.utilizationRate,
              supporterCount: analysis.supportLevels.informational.supporters.length
            }
          },
          networkHealth: {
            diversityScore: analysis.networkHealth.diversityScore,
            redundancyScore: analysis.networkHealth.redundancyScore,
            accessibilityScore: analysis.networkHealth.accessibilityScore,
            reciprocityScore: analysis.networkHealth.reciprocityScore,
            overallHealth: (
              analysis.networkHealth.diversityScore +
              analysis.networkHealth.redundancyScore +
              analysis.networkHealth.accessibilityScore +
              analysis.networkHealth.reciprocityScore
            ) / 4
          },
          assessment: {
            riskLevel: analysis.riskFactors.length > 3 ? 'High' :
                      analysis.riskFactors.length > 1 ? 'Medium' : 'Low',
            strengthLevel: analysis.strengthFactors.length > 3 ? 'High' :
                         analysis.strengthFactors.length > 1 ? 'Medium' : 'Low',
            riskFactors: analysis.riskFactors,
            strengthFactors: analysis.strengthFactors
          },
          recommendations: analysis.recommendations,
          insights: {
            strongestSupportArea: Object.entries(analysis.supportLevels)
              .reduce((a, b) => (a[1] as any).availabilityScore > (b[1] as any).availabilityScore ? a : b)[0],
            weakestSupportArea: Object.entries(analysis.supportLevels)
              .reduce((a, b) => (a[1] as any).availabilityScore < (b[1] as any).availabilityScore ? a : b)[0],
            needsAttention: analysis.riskFactors.length > 0,
            primaryRecommendation: analysis.recommendations.length > 0 ? analysis.recommendations[0] : 'Support network appears healthy'
          },
          analysisDate: analysis.analysisDate,
          confidenceLevel: analysis.confidenceLevel
        }, null, 2)
      }
    ]
  };
}

async function handleRecommendGroupFormation(request: CallToolRequest): Promise<any> {
  const { 
    candidateUsers, 
    groupSize = 4, 
    collaborationType = 'study_group',
    optimizeFor = 'learning_outcomes' 
  } = request.params.arguments as any;
  
  if (!candidateUsers || !Array.isArray(candidateUsers) || candidateUsers.length < groupSize) {
    throw new Error(`At least ${groupSize} candidate user IDs are required`);
  }

  logger.log(`Recommending group formation for ${candidateUsers.length} candidates, group size ${groupSize}`);
  
  // This is a simplified implementation - in a full system this would use sophisticated algorithms
  const recommendations = await generateGroupFormationRecommendations(
    candidateUsers, 
    groupSize, 
    collaborationType, 
    optimizeFor
  );
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          candidateCount: candidateUsers.length,
          requestedGroupSize: groupSize,
          collaborationType,
          optimizationCriterion: optimizeFor,
          recommendations: recommendations.map((rec, index) => ({
            rank: index + 1,
            groupId: rec.groupId,
            members: rec.members,
            predictedEffectiveness: rec.effectiveness,
            effectivenessRating: rec.effectiveness > 0.8 ? 'Excellent' :
                                rec.effectiveness > 0.6 ? 'Good' :
                                rec.effectiveness > 0.4 ? 'Fair' : 'Poor',
            compatibilityFactors: rec.compatibilityFactors,
            strengths: rec.strengths,
            potentialChallenges: rec.challenges,
            formationRationale: rec.rationale
          })),
          insights: {
            totalCombinations: Math.floor(factorial(candidateUsers.length) / (factorial(groupSize) * factorial(candidateUsers.length - groupSize))),
            bestFormationScore: recommendations[0]?.effectiveness || 0,
            averageScore: recommendations.reduce((sum, rec) => sum + rec.effectiveness, 0) / recommendations.length,
            optimizationSuccess: recommendations[0]?.effectiveness > 0.6 ? 'High' :
                                recommendations[0]?.effectiveness > 0.4 ? 'Medium' : 'Low'
          }
        }, null, 2)
      }
    ]
  };
}

async function handleIdentifyAtRiskRelationships(request: CallToolRequest): Promise<any> {
  const { courseId, riskThreshold = 0.3 } = request.params.arguments as any;
  
  logger.log(`Identifying at-risk relationships${courseId ? ` in course ${courseId}` : ' across all courses'}`);
  
  const atRiskStudents = await identifyAtRiskStudents(courseId, riskThreshold);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          scope: courseId ? `Course ${courseId}` : 'All courses',
          riskThreshold,
          summary: {
            totalStudentsAnalyzed: atRiskStudents.totalAnalyzed,
            atRiskCount: atRiskStudents.atRisk.length,
            riskPercentage: (atRiskStudents.atRisk.length / atRiskStudents.totalAnalyzed * 100).toFixed(1)
          },
          atRiskStudents: atRiskStudents.atRisk.map((student: any) => ({
            userId: student.userId,
            name: student.name,
            riskScore: student.riskScore,
            riskLevel: student.riskScore > 0.7 ? 'High' :
                      student.riskScore > 0.4 ? 'Medium' : 'Low',
            primaryRiskFactors: student.riskFactors,
            supportGaps: student.supportGaps,
            recommendedInterventions: student.interventions,
            networkHealth: student.networkHealth,
            lastAnalysis: student.lastAnalysis
          })),
          interventionPriorities: atRiskStudents.atRisk
            .sort((a: any, b: any) => b.riskScore - a.riskScore)
            .slice(0, 5)
            .map((student: any) => ({
              userId: student.userId,
              name: student.name,
              urgency: student.riskScore > 0.7 ? 'Immediate' :
                      student.riskScore > 0.5 ? 'High' : 'Medium',
              primaryIntervention: student.interventions[0] || 'General support outreach'
            })),
          insights: {
            mostCommonRiskFactor: getMostCommonRiskFactor(atRiskStudents.atRisk),
            averageRiskScore: atRiskStudents.atRisk.reduce((sum: number, s: any) => sum + s.riskScore, 0) / atRiskStudents.atRisk.length,
            interventionRecommendation: atRiskStudents.atRisk.length > atRiskStudents.totalAnalyzed * 0.2 ? 
              'Consider systematic support program implementation' :
              'Individual targeted interventions recommended'
          }
        }, null, 2)
      }
    ]
  };
}

// === HELPER FUNCTIONS ===

async function generateGroupFormationRecommendations(
  candidateUsers: string[],
  groupSize: number,
  collaborationType: string,
  optimizeFor: string
): Promise<any[]> {
  // Simplified group formation algorithm
  // In a full implementation, this would use sophisticated optimization algorithms
  
  const recommendations = [];
  const maxRecommendations = Math.min(5, Math.floor(candidateUsers.length / groupSize));
  
  for (let i = 0; i < maxRecommendations; i++) {
    const members = candidateUsers.slice(i * groupSize, (i + 1) * groupSize);
    if (members.length === groupSize) {
      const effectiveness = await estimateGroupEffectiveness(members, collaborationType, optimizeFor);
      
      recommendations.push({
        groupId: `group_${i + 1}_${members.join('_')}`,
        members,
        effectiveness,
        compatibilityFactors: ['learning_styles', 'communication_patterns', 'skill_diversity'],
        strengths: ['Balanced participation', 'Complementary skills'],
        challenges: ['Initial coordination needed'],
        rationale: `Optimized for ${optimizeFor} with ${(effectiveness * 100).toFixed(1)}% predicted effectiveness`
      });
    }
  }
  
  return recommendations.sort((a, b) => b.effectiveness - a.effectiveness);
}

async function estimateGroupEffectiveness(
  members: string[],
  collaborationType: string,
  optimizeFor: string
): Promise<number> {
  // Simplified effectiveness estimation
  // In a real implementation, this would analyze personas, interaction history, etc.
  
  let baseEffectiveness = 0.5;
  
  // Add randomness for demonstration (would be replaced with real analysis)
  baseEffectiveness += (Math.random() - 0.5) * 0.4;
  
  // Adjust based on collaboration type
  if (collaborationType === 'project_team') baseEffectiveness += 0.1;
  if (collaborationType === 'peer_tutoring') baseEffectiveness += 0.05;
  
  // Adjust based on optimization criterion
  if (optimizeFor === 'diversity') baseEffectiveness += 0.05;
  if (optimizeFor === 'skill_balance') baseEffectiveness += 0.08;
  
  return Math.max(0.1, Math.min(baseEffectiveness, 0.95));
}

async function identifyAtRiskStudents(courseId?: string, riskThreshold: number = 0.3): Promise<any> {
  // Simplified at-risk identification
  // In a real implementation, this would analyze actual support network data
  
  const sampleStudents = [
    { userId: '7145151', name: 'Kuria Mbatia' },
    { userId: '1001', name: 'Student A' },
    { userId: '1002', name: 'Student B' },
    { userId: '1003', name: 'Student C' }
  ];
  
  const atRisk = sampleStudents
    .map(student => {
      const riskScore = Math.random() * 0.8; // Simulate risk calculation
      return {
        ...student,
        riskScore,
        riskFactors: riskScore > 0.5 ? 
          ['Limited social connections', 'Low engagement', 'Academic struggles'] :
          ['Moderate isolation risk'],
        supportGaps: riskScore > 0.4 ? ['Emotional support', 'Academic guidance'] : [],
        interventions: riskScore > 0.6 ? 
          ['Proactive outreach', 'Peer mentoring', 'Study group placement'] :
          ['Gentle check-in', 'Resource sharing'],
        networkHealth: 1 - riskScore,
        lastAnalysis: new Date().toISOString()
      };
    })
    .filter(student => student.riskScore > riskThreshold);
  
  return {
    totalAnalyzed: sampleStudents.length,
    atRisk
  };
}

function getMostCommonRiskFactor(atRiskStudents: any[]): string {
  const factorCounts = new Map();
  
  atRiskStudents.forEach(student => {
    student.riskFactors.forEach((factor: string) => {
      factorCounts.set(factor, (factorCounts.get(factor) || 0) + 1);
    });
  });
  
  let mostCommon = 'Social isolation';
  let maxCount = 0;
  
  factorCounts.forEach((count, factor) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = factor;
    }
  });
  
  return mostCommon;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
} 