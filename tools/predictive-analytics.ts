import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PredictiveAnalyzer, RiskAssessment, SuccessPrediction, EngagementForecast } from '../lib/predictive-analyzer.js';
import { logger } from '../lib/logger.js';

// MCP Tools for Predictive Analytics System
// Phase 3A: Risk Assessment, Success Prediction, and Engagement Forecasting

const analyzer = new PredictiveAnalyzer();

// === RISK ASSESSMENT TOOL ===

export async function assessStudentRisk(request: any) {
  try {
    logger.log('MCP Tool: assess_student_risk called');
    
    // Handle both direct arguments and request.params.arguments patterns
    const args = request.params?.arguments || request.params || request;
    const { userId, forceRefresh = false } = args;
    
    if (!userId) {
      throw new Error('userId is required');
    }

    const assessment = await analyzer.assessStudentRisk(userId, forceRefresh);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            assessment: {
              userId: assessment.userId,
              riskLevel: assessment.riskLevel,
              riskScore: assessment.riskScore,
              confidenceLevel: assessment.confidenceLevel,
              assessmentDate: assessment.assessmentDate,
              expiresAt: assessment.expiresAt,
              riskFactors: assessment.riskFactors.map(factor => ({
                factor: factor.factor,
                impact: factor.impact,
                category: factor.category,
                description: factor.description
              })),
              interventionRecommendations: assessment.interventionRecommendations
            },
            insights: {
              riskSummary: `${assessment.riskLevel.toUpperCase()} risk level with ${(assessment.riskScore * 100).toFixed(1)}% risk score`,
              primaryConcerns: assessment.riskFactors
                .sort((a, b) => b.impact - a.impact)
                .slice(0, 3)
                .map(f => f.description),
              immediateActions: assessment.interventionRecommendations.slice(0, 3),
              confidenceNote: assessment.confidenceLevel > 0.7 ? 'High confidence assessment' : 
                             assessment.confidenceLevel > 0.5 ? 'Moderate confidence assessment' : 
                             'Low confidence - more data needed for reliable assessment'
            },
            alerts: assessment.riskLevel === 'critical' ? ['URGENT: Immediate intervention required'] :
                   assessment.riskLevel === 'high' ? ['Schedule intervention within 24-48 hours'] : []
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.log(`Error in assess_student_risk: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: 'assess_student_risk'
          }, null, 2)
        }
      ]
    };
  }
}

// === SUCCESS PREDICTION TOOL ===

export async function predictStudentSuccess(request: any) {
  try {
    logger.log('MCP Tool: predict_student_success called');
    
    // Handle both direct arguments and request.params.arguments patterns
    const args = request.params?.arguments || request.params || request;
    const { userId, targetType, targetId } = args;
    
    if (!userId || !targetType || !targetId) {
      throw new Error('userId, targetType, and targetId are required');
    }

    const prediction = await analyzer.predictSuccess(userId, targetType, targetId);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            prediction: {
              userId: prediction.userId,
              target: {
                type: prediction.targetType,
                id: prediction.targetId
              },
              probabilities: {
                success: prediction.successProbability,
                completion: prediction.completionProbability
              },
              predictedOutcome: {
                performanceLevel: prediction.performanceLevel,
                predictedScore: prediction.predictedScore,
                scoreRange: prediction.predictedScore ? {
                  low: Math.max(0, prediction.predictedScore - 0.1),
                  high: Math.min(1, prediction.predictedScore + 0.1)
                } : null
              },
              confidenceLevel: prediction.confidenceLevel,
              predictionDate: prediction.predictionDate,
              predictionFactors: prediction.predictionFactors.map(factor => ({
                factor: factor.factor,
                weight: factor.weight,
                value: factor.value,
                trend: factor.trend,
                description: factor.description
              })),
              recommendedActions: prediction.recommendedActions
            },
            insights: {
              successSummary: `${(prediction.successProbability * 100).toFixed(1)}% probability of success with ${prediction.performanceLevel} performance expected`,
              keyFactors: prediction.predictionFactors
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 3)
                .map(f => `${f.factor}: ${(f.value * 100).toFixed(0)}% (${f.trend})`),
              recommendations: prediction.recommendedActions.slice(0, 3),
              confidenceNote: prediction.confidenceLevel > 0.7 ? 'High confidence prediction' :
                             prediction.confidenceLevel > 0.5 ? 'Moderate confidence prediction' :
                             'Low confidence - prediction may be unreliable'
            },
            warnings: prediction.successProbability < 0.5 ? ['Low success probability - intervention recommended'] : []
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.log(`Error in predict_student_success: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: 'predict_student_success'
          }, null, 2)
        }
      ]
    };
  }
}

// === ENGAGEMENT FORECASTING TOOL ===

export async function forecastStudentEngagement(request: any) {
  try {
    logger.log('MCP Tool: forecast_student_engagement called');
    
    // Handle both direct arguments and request.params.arguments patterns
    const args = request.params?.arguments || request.params || request;
    const { userId, period = 'next_week' } = args;
    
    if (!userId) {
      throw new Error('userId is required');
    }

    const forecast = await analyzer.forecastEngagement(userId, period);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            forecast: {
              userId: forecast.userId,
              forecastPeriod: forecast.forecastPeriod,
              engagementProbability: forecast.engagementProbability,
              responseTimeExpectation: forecast.responseTimeExpectation,
              confidenceLevel: forecast.confidenceLevel,
              forecastDate: forecast.forecastDate,
              optimalInteractionTimes: forecast.optimalInteractionTimes.map(time => ({
                dayOfWeek: time.dayOfWeek,
                timeRange: time.timeRange,
                probability: time.probability,
                method: time.method
              })),
              preferredCommunicationMethods: forecast.preferredCommunicationMethods,
              motivationalFactors: forecast.motivationalFactors,
              potentialDisruptors: forecast.potentialDisruptors
            },
            insights: {
              engagementSummary: `${(forecast.engagementProbability * 100).toFixed(1)}% engagement probability with ${Math.round(forecast.responseTimeExpectation / 60)} hour expected response time`,
              bestContactTimes: forecast.optimalInteractionTimes
                .slice(0, 3)
                .map(time => `${time.dayOfWeek} ${time.timeRange} (${(time.probability * 100).toFixed(0)}% success rate)`),
              communicationStrategy: {
                preferredMethods: forecast.preferredCommunicationMethods.slice(0, 2),
                timing: `Best response time: ${Math.round(forecast.responseTimeExpectation / 60)} hours`,
                approach: forecast.motivationalFactors.length > 0 ? 
                         `Focus on: ${forecast.motivationalFactors[0]}` : 
                         'Standard motivational approach'
              },
              riskFactors: forecast.potentialDisruptors.length > 0 ? 
                          forecast.potentialDisruptors : 
                          ['No significant disruptors identified']
            },
            recommendations: {
              immediateActions: [
                `Contact during optimal time: ${forecast.optimalInteractionTimes[0]?.dayOfWeek} ${forecast.optimalInteractionTimes[0]?.timeRange}`,
                `Use preferred method: ${forecast.preferredCommunicationMethods[0]}`,
                forecast.engagementProbability < 0.5 ? 'Consider proactive outreach due to low engagement probability' : 'Standard engagement approach should be effective'
              ],
              monitoringPoints: forecast.potentialDisruptors.length > 0 ? 
                               [`Watch for: ${forecast.potentialDisruptors[0]}`] : 
                               ['Monitor standard engagement metrics']
            }
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.log(`Error in forecast_student_engagement: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: 'forecast_student_engagement'
          }, null, 2)
        }
      ]
    };
  }
}

// === INTERVENTION TRACKING TOOLS ===

export async function recordIntervention(request: any) {
  try {
    logger.log('MCP Tool: record_intervention called');
    
    // Handle both direct arguments and request.params.arguments patterns
    const args = request.params?.arguments || request.params || request;
    const { 
      userId,
      interventionType,
      riskLevelBefore,
      riskScoreBefore,
      interventionActions
    } = args;
    
    if (!userId || !interventionType || !riskLevelBefore || !riskScoreBefore || !interventionActions) {
      throw new Error('All intervention parameters are required');
    }

    const interventionId = await analyzer.recordIntervention(
      userId,
      interventionType,
      riskLevelBefore,
      riskScoreBefore,
      interventionActions
    );
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            intervention: {
              interventionId,
              userId,
              interventionType,
              baseline: {
                riskLevel: riskLevelBefore,
                riskScore: riskScoreBefore
              },
              actions: interventionActions,
              recordedDate: new Date().toISOString()
            },
            nextSteps: [
              'Monitor student progress and engagement',
              'Plan follow-up assessment in 3-7 days',
              'Document intervention effectiveness',
              'Adjust approach based on student response'
            ]
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.log(`Error in record_intervention: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: 'record_intervention'
          }, null, 2)
        }
      ]
    };
  }
}

export async function updateInterventionOutcome(request: any) {
  try {
    logger.log('MCP Tool: update_intervention_outcome called');
    
    // Handle both direct arguments and request.params.arguments patterns
    const args = request.params?.arguments || request.params || request;
    const { 
      interventionId,
      riskLevelAfter,
      riskScoreAfter,
      effectivenessScore,
      success,
      notes
    } = args;
    
    if (!interventionId || !riskLevelAfter || !riskScoreAfter || effectivenessScore === undefined || success === undefined) {
      throw new Error('All outcome parameters are required');
    }

    await analyzer.updateInterventionOutcome(
      interventionId,
      riskLevelAfter,
      riskScoreAfter,
      effectivenessScore,
      success,
      notes
    );
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            outcome: {
              interventionId,
              result: {
                riskLevel: riskLevelAfter,
                riskScore: riskScoreAfter,
                improvement: riskScoreAfter < 0.6 ? 'Significant improvement' :
                           riskScoreAfter < 0.8 ? 'Moderate improvement' :
                           'Needs additional intervention'
              },
              effectiveness: {
                score: effectivenessScore,
                rating: effectivenessScore > 0.7 ? 'Highly effective' :
                       effectivenessScore > 0.5 ? 'Moderately effective' :
                       'Low effectiveness'
              },
              interventionSuccess: success,
              notes: notes || 'No additional notes provided',
              updatedDate: new Date().toISOString()
            },
            insights: [
              success ? '✅ Intervention successful - student risk reduced' : 
                       '⚠️ Intervention needs follow-up - risk remains elevated',
              effectivenessScore > 0.7 ? 'Approach was highly effective - use similar strategies' :
              effectivenessScore > 0.5 ? 'Approach had moderate success - consider adjustments' :
                                         'Approach needs significant revision - try different strategies'
            ]
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.log(`Error in update_intervention_outcome: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: 'update_intervention_outcome'
          }, null, 2)
        }
      ]
    };
  }
}

// === COMPREHENSIVE ANALYTICS TOOL ===

export async function getStudentAnalytics(request: any) {
  try {
    logger.log('MCP Tool: get_student_analytics called');
    
    // Handle both direct arguments and request.params.arguments patterns
    const args = request.params?.arguments || request.params || request;
    const { userId } = args;
    
    if (!userId) {
      throw new Error('userId is required');
    }

    // Get all analytics for comprehensive view
    const [riskAssessment, engagementForecast] = await Promise.all([
      analyzer.assessStudentRisk(userId, false),
      analyzer.forecastEngagement(userId, 'next_week')
    ]);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            userId,
            generatedAt: new Date().toISOString(),
            analytics: {
              riskAssessment: {
                level: riskAssessment.riskLevel,
                score: riskAssessment.riskScore,
                confidence: riskAssessment.confidenceLevel,
                primaryRisks: riskAssessment.riskFactors
                  .sort((a, b) => b.impact - a.impact)
                  .slice(0, 3)
                  .map(f => ({
                    factor: f.factor,
                    impact: f.impact,
                    category: f.category
                  })),
                interventionsNeeded: riskAssessment.interventionRecommendations.length
              },
              engagementForecast: {
                probability: engagementForecast.engagementProbability,
                responseTime: engagementForecast.responseTimeExpectation,
                confidence: engagementForecast.confidenceLevel,
                optimalContactDay: engagementForecast.optimalInteractionTimes[0]?.dayOfWeek,
                optimalContactTime: engagementForecast.optimalInteractionTimes[0]?.timeRange,
                preferredMethod: engagementForecast.preferredCommunicationMethods[0],
                disruptorsCount: engagementForecast.potentialDisruptors.length
              }
            },
            overallInsights: {
              studentStatus: riskAssessment.riskLevel === 'low' ? 'Student appears to be doing well' :
                           riskAssessment.riskLevel === 'medium' ? 'Student may benefit from additional support' :
                           riskAssessment.riskLevel === 'high' ? 'Student needs proactive intervention' :
                           'URGENT: Student requires immediate attention',
              engagementOutlook: engagementForecast.engagementProbability > 0.7 ? 'High engagement expected' :
                               engagementForecast.engagementProbability > 0.5 ? 'Moderate engagement expected' :
                               'Low engagement - proactive outreach recommended',
              recommendedApproach: {
                urgency: riskAssessment.riskLevel === 'critical' || riskAssessment.riskLevel === 'high' ? 'immediate' : 'routine',
                method: engagementForecast.preferredCommunicationMethods[0],
                timing: `${engagementForecast.optimalInteractionTimes[0]?.dayOfWeek} ${engagementForecast.optimalInteractionTimes[0]?.timeRange}`,
                focus: riskAssessment.riskFactors.length > 0 ? 
                      riskAssessment.riskFactors[0].category : 
                      'general support and encouragement'
              }
            },
            actionPlan: {
              immediate: riskAssessment.riskLevel === 'critical' ? 
                        ['URGENT: Contact student immediately', 'Activate comprehensive support network'] :
                        riskAssessment.riskLevel === 'high' ?
                        ['Schedule intervention meeting within 24-48 hours', 'Notify relevant support staff'] :
                        ['Continue regular monitoring', 'Schedule routine check-in'],
              shortTerm: riskAssessment.interventionRecommendations.slice(0, 3),
              monitoring: [
                'Track engagement patterns',
                'Monitor risk factor changes',
                'Assess intervention effectiveness',
                'Update predictions based on new data'
              ]
            }
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.log(`Error in get_student_analytics: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: 'get_student_analytics'
          }, null, 2)
        }
      ]
    };
  }
} 