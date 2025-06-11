import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../lib/logger.js';

// Predictive Analytics Engine for Canvas MCP Persona System
// Phase 3A: Core predictive capabilities for student success

export interface RiskAssessment {
  userId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-1, where 1 is highest risk
  riskFactors: RiskFactor[];
  interventionRecommendations: string[];
  confidenceLevel: number;
  assessmentDate: string;
  expiresAt: string;
}

export interface RiskFactor {
  factor: string;
  impact: number; // 0-1, contribution to overall risk
  description: string;
  category: 'academic' | 'engagement' | 'social' | 'temporal' | 'behavioral';
}

export interface SuccessPrediction {
  userId: string;
  targetType: 'assignment' | 'course' | 'module' | 'quiz';
  targetId: string;
  successProbability: number; // 0-1
  completionProbability: number; // 0-1
  performanceLevel: 'poor' | 'below_average' | 'average' | 'above_average' | 'excellent';
  predictedScore: number | null;
  confidenceLevel: number;
  predictionFactors: PredictionFactor[];
  recommendedActions: string[];
  predictionDate: string;
}

export interface PredictionFactor {
  factor: string;
  weight: number; // 0-1, importance in prediction
  value: number; // Current measured value
  trend: 'improving' | 'stable' | 'declining';
  description: string;
}

export interface EngagementForecast {
  userId: string;
  forecastPeriod: string; // e.g., 'next_week', 'next_month'
  optimalInteractionTimes: OptimalTime[];
  preferredCommunicationMethods: string[];
  engagementProbability: number; // 0-1
  responseTimeExpectation: number; // minutes
  motivationalFactors: string[];
  potentialDisruptors: string[];
  confidenceLevel: number;
  forecastDate: string;
}

export interface OptimalTime {
  dayOfWeek: string;
  timeRange: string;
  probability: number; // 0-1, likelihood of engagement
  method: string; // preferred communication method for this time
}

export class PredictiveAnalyzer {
  private db: Database.Database;

  constructor() {
    // Use absolute path based on this file's location to avoid cwd issues
    const currentFileDir = path.dirname(new URL(import.meta.url).pathname);
    const projectRoot = path.resolve(currentFileDir, '..');
    const dataDir = path.join(projectRoot, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'canvas_cache.db');
    this.db = new Database(dbPath);
    
    // Check if we have the existing persona tables
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='student_personas'
    `).get();
    
    if (!tables) {
      logger.log('Warning: student_personas table not found. Make sure you are using the correct database.');
    } else {
      logger.log('Connected to existing Canvas cache database with persona tables');
    }
    
    this.initializeTables();
  }

  private initializeTables() {
    // Only create predictive analytics specific tables
    // Don't recreate existing persona system tables
    
    // Risk assessments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_risk_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        risk_score REAL NOT NULL,
        risk_factors TEXT NOT NULL, -- JSON array
        intervention_recommendations TEXT NOT NULL, -- JSON array  
        confidence_level REAL NOT NULL,
        assessment_date TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES student_personas(user_id)
      )
    `);

    // Success predictions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS success_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        success_probability REAL NOT NULL,
        completion_probability REAL NOT NULL,
        performance_level TEXT NOT NULL,
        predicted_score REAL,
        confidence_level REAL NOT NULL,
        prediction_factors TEXT NOT NULL, -- JSON array
        recommended_actions TEXT NOT NULL, -- JSON array
        prediction_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES student_personas(user_id)
      )
    `);

    // Engagement forecasts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS engagement_forecasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        forecast_period TEXT NOT NULL,
        optimal_interaction_times TEXT NOT NULL, -- JSON array
        preferred_communication_methods TEXT NOT NULL, -- JSON array
        engagement_probability REAL NOT NULL,
        response_time_expectation INTEGER NOT NULL,
        motivational_factors TEXT NOT NULL, -- JSON array
        potential_disruptors TEXT NOT NULL, -- JSON array
        confidence_level REAL NOT NULL,
        forecast_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES student_personas(user_id)
      )
    `);

    // Intervention history for tracking effectiveness
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS intervention_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        intervention_type TEXT NOT NULL,
        risk_level_before TEXT NOT NULL,
        risk_score_before REAL NOT NULL,
        intervention_actions TEXT NOT NULL, -- JSON array
        intervention_date TEXT NOT NULL,
        followup_date TEXT,
        risk_level_after TEXT,
        risk_score_after REAL,
        effectiveness_score REAL, -- 0-1, how effective the intervention was
        success BOOLEAN,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES student_personas(user_id)
      )
    `);

    logger.log('Predictive analytics tables initialized');
  }

  // === RISK ASSESSMENT FUNCTIONS ===

  async assessStudentRisk(userId: string, forceRefresh: boolean = false): Promise<RiskAssessment> {
    logger.log(`Starting risk assessment for user: ${userId}`);

    // Check for recent assessment if not forcing refresh
    if (!forceRefresh) {
      const existingAssessment = this.getRecentRiskAssessment(userId);
      if (existingAssessment) {
        logger.log(`Using cached risk assessment for user: ${userId}`);
        return existingAssessment;
      }
    }

    // Gather comprehensive student data
    const studentData = await this.gatherStudentData(userId);
    
    // Calculate risk factors
    const riskFactors = this.calculateRiskFactors(studentData);
    
    // Determine overall risk level and score
    const riskScore = this.calculateOverallRiskScore(riskFactors);
    const riskLevel = this.determineRiskLevel(riskScore);
    
    // Generate intervention recommendations
    const interventionRecommendations = this.generateInterventionRecommendations(riskFactors, riskLevel);
    
    // Calculate confidence based on data completeness
    const confidenceLevel = this.calculateRiskConfidence(studentData, riskFactors);

    const assessment: RiskAssessment = {
      userId,
      riskLevel,
      riskScore,
      riskFactors,
      interventionRecommendations,
      confidenceLevel,
      assessmentDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    // Store in database
    this.storeRiskAssessment(assessment);

    logger.log(`Risk assessment completed for user ${userId}: ${riskLevel} (${riskScore.toFixed(3)})`);
    return assessment;
  }

  private getRecentRiskAssessment(userId: string): RiskAssessment | null {
    const stmt = this.db.prepare(`
      SELECT * FROM student_risk_assessments 
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `);
    
    const row = stmt.get(userId) as any;
    if (!row) return null;

    return {
      userId: row.user_id,
      riskLevel: row.risk_level,
      riskScore: row.risk_score,
      riskFactors: JSON.parse(row.risk_factors),
      interventionRecommendations: JSON.parse(row.intervention_recommendations),
      confidenceLevel: row.confidence_level,
      assessmentDate: row.assessment_date,
      expiresAt: row.expires_at
    };
  }

  private async gatherStudentData(userId: string): Promise<any> {
    try {
      // Gather data from all persona system tables
      logger.log(`Querying student_personas for user: ${userId}`);
      const personaData = this.db.prepare(`
        SELECT * FROM student_personas WHERE user_id = ?
      `).get(userId);

      logger.log(`Querying interaction_history for user: ${userId}`);
      const interactions = this.db.prepare(`
        SELECT * FROM interaction_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC LIMIT 50
      `).all(userId);

      logger.log(`Querying academic_context for user: ${userId}`);
      const academicContext = this.db.prepare(`
        SELECT * FROM academic_context WHERE user_id = ?
      `).get(userId);

      logger.log(`Querying student_relationships for user: ${userId}`);
      const relationships = this.db.prepare(`
        SELECT * FROM student_relationships WHERE student_user_id = ?
      `).all(userId);

      logger.log(`Data gathering completed. Found: persona=${!!personaData}, interactions=${interactions.length}, academic=${!!academicContext}, relationships=${relationships.length}`);

      return {
        persona: personaData,
        interactions,
        academic: academicContext,
        relationships,
        analysisDate: new Date().toISOString()
      };
    } catch (error) {
      logger.log(`Error in gatherStudentData: ${error}`);
      throw error;
    }
  }

  private calculateRiskFactors(studentData: any): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Academic performance risk factors
    if (studentData.academic) {
      // Handle the actual database structure with individual columns
      const academic = {
        current_workload_level: studentData.academic.current_workload_level || 'moderate',
        challenge_areas: studentData.academic.challenge_areas ? JSON.parse(studentData.academic.challenge_areas) : [],
        upcoming_deadlines: studentData.academic.upcoming_deadlines ? JSON.parse(studentData.academic.upcoming_deadlines) : [],
        strength_areas: studentData.academic.strength_areas ? JSON.parse(studentData.academic.strength_areas) : []
      };
      
      // Workload stress factor
      if (academic.current_workload_level === 'overwhelming') {
        factors.push({
          factor: 'overwhelming_workload',
          impact: 0.7,
          description: 'Student reports overwhelming workload level',
          category: 'academic'
        });
      } else if (academic.current_workload_level === 'heavy') {
        factors.push({
          factor: 'heavy_workload',
          impact: 0.4,
          description: 'Student reports heavy workload level',
          category: 'academic'
        });
      }

      // Challenge areas factor
      if (academic.challenge_areas && academic.challenge_areas.length > 3) {
        factors.push({
          factor: 'multiple_challenge_areas',
          impact: 0.5,
          description: `Student has ${academic.challenge_areas.length} identified challenge areas`,
          category: 'academic'
        });
      }

      // Upcoming deadlines stress
      if (academic.upcoming_deadlines && academic.upcoming_deadlines.length > 5) {
        factors.push({
          factor: 'deadline_pressure',
          impact: 0.6,
          description: `${academic.upcoming_deadlines.length} upcoming deadlines creating pressure`,
          category: 'academic'
        });
      }
    }

    // Engagement risk factors
    if (studentData.interactions && studentData.interactions.length > 0) {
      const recentInteractions = studentData.interactions.slice(0, 10);
      const avgSentiment = recentInteractions.reduce((sum: number, i: any) => 
        sum + (i.sentiment_score || 0), 0) / recentInteractions.length;

      if (avgSentiment < -0.3) {
        factors.push({
          factor: 'declining_sentiment',
          impact: 0.6,
          description: 'Recent interactions show declining sentiment',
          category: 'behavioral'
        });
      }

      // Interaction frequency decline
      const recentWeek = studentData.interactions.filter((i: any) => 
        new Date(i.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      
      if (recentWeek.length < 2) {
        factors.push({
          factor: 'low_recent_engagement',
          impact: 0.4,
          description: 'Very few interactions in the past week',
          category: 'engagement'
        });
      }
    }

    // Social isolation risk factors
    if (studentData.relationships && studentData.relationships.length === 0) {
      factors.push({
        factor: 'social_isolation',
        impact: 0.3,
        description: 'No recorded collaborative relationships',
        category: 'social'
      });
    }

    // Temporal patterns (missed optimal interaction times)
    if (studentData.persona) {
      // Use flat column structure
      if (studentData.persona.response_time_pattern === 'delayed') {
        factors.push({
          factor: 'delayed_responses',
          impact: 0.2,
          description: 'Pattern of delayed responses may indicate disengagement',
          category: 'temporal'
        });
      }

      // Low engagement level
      if (studentData.persona.engagement_level === 'low') {
        factors.push({
          factor: 'low_engagement',
          impact: 0.5,
          description: 'Student shows consistently low engagement levels',
          category: 'engagement'
        });
      }
    }

    return factors;
  }

  private calculateOverallRiskScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0.1; // Low baseline risk

    // Weighted average of risk factors with diminishing returns
    const totalImpact = riskFactors.reduce((sum, factor) => sum + factor.impact, 0);
    const maxPossibleImpact = riskFactors.length * 1.0;
    
    // Apply diminishing returns to prevent single factors from dominating
    const rawScore = totalImpact / Math.max(maxPossibleImpact, 1.0);
    const adjustedScore = 1 - Math.exp(-2 * rawScore); // Logarithmic scaling
    
    return Math.min(Math.max(adjustedScore, 0.1), 0.95); // Clamp between 0.1 and 0.95
  }

  private determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  private generateInterventionRecommendations(riskFactors: RiskFactor[], riskLevel: string): string[] {
    const recommendations: string[] = [];

    // Academic interventions
    const academicFactors = riskFactors.filter(f => f.category === 'academic');
    if (academicFactors.length > 0) {
      recommendations.push('Schedule academic check-in and study planning session');
      recommendations.push('Connect with course instructors for additional support');
      if (academicFactors.some(f => f.factor === 'overwhelming_workload')) {
        recommendations.push('Discuss workload management and prioritization strategies');
      }
    }

    // Engagement interventions
    const engagementFactors = riskFactors.filter(f => f.category === 'engagement');
    if (engagementFactors.length > 0) {
      recommendations.push('Increase proactive outreach and engagement activities');
      recommendations.push('Explore alternative communication methods and timing');
    }

    // Social interventions
    const socialFactors = riskFactors.filter(f => f.category === 'social');
    if (socialFactors.length > 0) {
      recommendations.push('Encourage participation in study groups or collaborative activities');
      recommendations.push('Connect with peer mentoring or social support resources');
    }

    // Behavioral interventions
    const behavioralFactors = riskFactors.filter(f => f.category === 'behavioral');
    if (behavioralFactors.length > 0) {
      recommendations.push('Monitor emotional well-being and provide appropriate support');
      recommendations.push('Consider referral to counseling or wellness resources');
    }

    // Risk level specific recommendations
    if (riskLevel === 'critical') {
      recommendations.push('URGENT: Schedule immediate intervention meeting');
      recommendations.push('Activate comprehensive support network including advisors and counselors');
    } else if (riskLevel === 'high') {
      recommendations.push('Schedule intervention meeting within 24-48 hours');
      recommendations.push('Notify relevant support staff and instructors');
    }

    return recommendations;
  }

  private calculateRiskConfidence(studentData: any, riskFactors: RiskFactor[]): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data completeness
    if (studentData.persona) confidence += 0.15;
    if (studentData.interactions && studentData.interactions.length > 5) confidence += 0.15;
    if (studentData.academic) confidence += 0.1;
    if (studentData.relationships && studentData.relationships.length > 0) confidence += 0.05;

    // Increase confidence based on number of risk factors identified
    confidence += Math.min(riskFactors.length * 0.05, 0.15);

    return Math.min(confidence, 0.95);
  }

  private storeRiskAssessment(assessment: RiskAssessment): void {
    const stmt = this.db.prepare(`
      INSERT INTO student_risk_assessments (
        user_id, risk_level, risk_score, risk_factors, 
        intervention_recommendations, confidence_level, 
        assessment_date, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      assessment.userId,
      assessment.riskLevel,
      assessment.riskScore,
      JSON.stringify(assessment.riskFactors),
      JSON.stringify(assessment.interventionRecommendations),
      assessment.confidenceLevel,
      assessment.assessmentDate,
      assessment.expiresAt
    );
  }

  // === SUCCESS PREDICTION FUNCTIONS ===

  async predictSuccess(userId: string, targetType: string, targetId: string): Promise<SuccessPrediction> {
    logger.log(`Predicting success for user ${userId}, target: ${targetType}:${targetId}`);

    // Gather relevant data for prediction
    const studentData = await this.gatherStudentData(userId);
    const historicalPerformance = this.getHistoricalPerformance(userId, targetType);

    // Calculate prediction factors
    const predictionFactors = this.calculatePredictionFactors(studentData, targetType, historicalPerformance);
    
    // Calculate success and completion probabilities
    const successProbability = this.calculateSuccessProbability(predictionFactors);
    const completionProbability = this.calculateCompletionProbability(predictionFactors);
    
    // Predict performance level and score
    const performanceLevel = this.predictPerformanceLevel(successProbability, predictionFactors);
    const predictedScore = this.predictScore(predictionFactors, targetType);
    
    // Generate recommendations
    const recommendedActions = this.generateSuccessRecommendations(predictionFactors, successProbability);
    
    // Calculate confidence
    const confidenceLevel = this.calculatePredictionConfidence(studentData, predictionFactors);

    const prediction: SuccessPrediction = {
      userId,
      targetType: targetType as 'assignment' | 'course' | 'module' | 'quiz',
      targetId,
      successProbability,
      completionProbability,
      performanceLevel: performanceLevel as 'poor' | 'below_average' | 'average' | 'above_average' | 'excellent',
      predictedScore,
      confidenceLevel,
      predictionFactors,
      recommendedActions,
      predictionDate: new Date().toISOString()
    };

    // Store prediction
    this.storeSuccessPrediction(prediction);

    logger.log(`Success prediction completed for ${userId}: ${(successProbability * 100).toFixed(1)}% success probability`);
    return prediction;
  }

  private getHistoricalPerformance(userId: string, targetType: string): any {
    // This would typically query Canvas API for historical grades and performance
    // For now, we'll simulate with available data
    return {
      averageScore: 0.78,
      completionRate: 0.85,
      submissionTiming: 'on_time',
      improvementTrend: 'stable'
    };
  }

  private calculatePredictionFactors(studentData: any, targetType: string, historicalPerformance: any): PredictionFactor[] {
    const factors: PredictionFactor[] = [];

    // Historical performance factor
    factors.push({
      factor: 'historical_performance',
      weight: 0.4,
      value: historicalPerformance.averageScore,
      trend: historicalPerformance.improvementTrend,
      description: 'Past academic performance in similar tasks'
    });

    // Current engagement factor
    if (studentData.interactions && studentData.interactions.length > 0) {
      const recentEngagement = this.calculateRecentEngagement(studentData.interactions);
      factors.push({
        factor: 'current_engagement',
        weight: 0.25,
        value: recentEngagement,
        trend: recentEngagement > 0.6 ? 'improving' : 'declining',
        description: 'Recent engagement level and interaction patterns'
      });
    }

    // Workload pressure factor
    if (studentData.academic) {
      const academic = {
        current_workload_level: studentData.academic.current_workload_level || 'moderate',
        upcoming_deadlines: studentData.academic.upcoming_deadlines ? JSON.parse(studentData.academic.upcoming_deadlines) : []
      };
      const workloadPressure = this.calculateWorkloadPressure(academic);
      factors.push({
        factor: 'workload_pressure',
        weight: 0.15,
        value: 1 - workloadPressure, // Invert since high pressure = lower success probability
        trend: 'stable',
        description: 'Current academic workload and deadline pressure'
      });
    }

    // Social support factor
    const socialSupport = studentData.relationships ? studentData.relationships.length / 10 : 0;
    factors.push({
      factor: 'social_support',
      weight: 0.1,
      value: Math.min(socialSupport, 1),
      trend: 'stable',
      description: 'Available peer support and collaboration network'
    });

    // Communication responsiveness factor
    if (studentData.persona) {
      const responsiveness = this.calculateResponsiveness(studentData.persona);
      factors.push({
        factor: 'communication_responsiveness',
        weight: 0.1,
        value: responsiveness,
        trend: 'stable',
        description: 'Responsiveness to communications and support'
      });
    }

    return factors;
  }

  private calculateRecentEngagement(interactions: any[]): number {
    if (interactions.length === 0) return 0;

    const recentInteractions = interactions.slice(0, 10);
    const avgSentiment = recentInteractions.reduce((sum, i) => sum + (i.sentiment_score || 0), 0) / recentInteractions.length;
    const interactionFrequency = interactions.length / 30; // Interactions per day over last month
    
    // Normalize to 0-1 scale
    const sentimentScore = (avgSentiment + 1) / 2; // Convert from -1,1 to 0,1
    const frequencyScore = Math.min(interactionFrequency / 2, 1); // Cap at 2 interactions per day = 1.0
    
    return (sentimentScore * 0.6) + (frequencyScore * 0.4);
  }

  private calculateWorkloadPressure(academic: any): number {
    let pressure = 0;

    const workloadLevel = academic?.current_workload_level || 'moderate';
    switch (workloadLevel) {
      case 'overwhelming': pressure += 0.8; break;
      case 'heavy': pressure += 0.6; break;
      case 'moderate': pressure += 0.3; break;
      case 'light': pressure += 0.1; break;
    }

    const deadlineCount = academic?.upcoming_deadlines?.length || 0;
    pressure += Math.min(deadlineCount / 10, 0.2); // Max 0.2 additional pressure from deadlines

    return Math.min(pressure, 1);
  }

  private calculateResponsiveness(persona: any): number {
    if (!persona) return 0.5;

    // Use flat column structure
    switch (persona.response_time_pattern) {
      case 'immediate': return 0.9;
      case 'quick': return 0.8;
      case 'thoughtful': return 0.6;
      case 'delayed': return 0.3;
      default: return 0.5;
    }
  }

  private calculateSuccessProbability(factors: PredictionFactor[]): number {
    if (factors.length === 0) return 0.5;

    const weightedSum = factors.reduce((sum, factor) => sum + (factor.value * factor.weight), 0);
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);

    return weightedSum / totalWeight;
  }

  private calculateCompletionProbability(factors: PredictionFactor[]): number {
    // Completion probability is generally higher than success probability
    const successProb = this.calculateSuccessProbability(factors);
    return Math.min(successProb + 0.15, 0.95);
  }

  private predictPerformanceLevel(successProbability: number, factors: PredictionFactor[]): string {
    if (successProbability >= 0.85) return 'excellent';
    if (successProbability >= 0.7) return 'above_average';
    if (successProbability >= 0.5) return 'average';
    if (successProbability >= 0.3) return 'below_average';
    return 'poor';
  }

  private predictScore(factors: PredictionFactor[], targetType: string): number | null {
    const historicalFactor = factors.find(f => f.factor === 'historical_performance');
    const engagementFactor = factors.find(f => f.factor === 'current_engagement');
    
    if (!historicalFactor) return null;

    let predictedScore = historicalFactor.value;
    
    // Adjust based on current engagement
    if (engagementFactor) {
      const engagementAdjustment = (engagementFactor.value - 0.5) * 0.2; // ±10% adjustment
      predictedScore += engagementAdjustment;
    }

    return Math.max(0, Math.min(1, predictedScore));
  }

  private generateSuccessRecommendations(factors: PredictionFactor[], successProbability: number): string[] {
    const recommendations: string[] = [];

    if (successProbability < 0.6) {
      recommendations.push('Schedule additional support sessions before deadline');
      recommendations.push('Connect with instructor for clarification on requirements');
    }

    const workloadFactor = factors.find(f => f.factor === 'workload_pressure');
    if (workloadFactor && workloadFactor.value < 0.4) {
      recommendations.push('Discuss time management and prioritization strategies');
      recommendations.push('Consider deadline extension or workload adjustment');
    }

    const engagementFactor = factors.find(f => f.factor === 'current_engagement');
    if (engagementFactor && engagementFactor.value < 0.5) {
      recommendations.push('Increase check-ins and motivational support');
      recommendations.push('Explore alternative learning approaches or resources');
    }

    const socialFactor = factors.find(f => f.factor === 'social_support');
    if (socialFactor && socialFactor.value < 0.3) {
      recommendations.push('Connect with study groups or peer support networks');
      recommendations.push('Consider collaborative learning opportunities');
    }

    return recommendations;
  }

  private calculatePredictionConfidence(studentData: any, factors: PredictionFactor[]): number {
    let confidence = 0.3; // Base confidence

    // Increase based on data availability
    if (studentData.persona) confidence += 0.2;
    if (studentData.interactions && studentData.interactions.length > 10) confidence += 0.2;
    if (studentData.academic) confidence += 0.15;
    if (factors.length >= 4) confidence += 0.15;

    return Math.min(confidence, 0.9);
  }

  private storeSuccessPrediction(prediction: SuccessPrediction): void {
    const stmt = this.db.prepare(`
      INSERT INTO success_predictions (
        user_id, target_type, target_id, success_probability,
        completion_probability, performance_level, predicted_score,
        confidence_level, prediction_factors, recommended_actions,
        prediction_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      prediction.userId,
      prediction.targetType,
      prediction.targetId,
      prediction.successProbability,
      prediction.completionProbability,
      prediction.performanceLevel,
      prediction.predictedScore,
      prediction.confidenceLevel,
      JSON.stringify(prediction.predictionFactors),
      JSON.stringify(prediction.recommendedActions),
      prediction.predictionDate
    );
  }

  // === ENGAGEMENT FORECASTING FUNCTIONS ===

  async forecastEngagement(userId: string, period: string = 'next_week'): Promise<EngagementForecast> {
    logger.log(`Forecasting engagement for user ${userId}, period: ${period}`);

    const studentData = await this.gatherStudentData(userId);
    
    // Analyze communication patterns
    const optimalTimes = this.analyzeOptimalInteractionTimes(studentData);
    const preferredMethods = this.identifyPreferredCommunicationMethods(studentData);
    
    // Calculate engagement probability
    const engagementProbability = this.calculateEngagementProbability(studentData);
    
    // Predict response time
    const responseTimeExpectation = this.predictResponseTime(studentData);
    
    // Identify motivational factors and disruptors
    const motivationalFactors = this.identifyMotivationalFactors(studentData);
    const potentialDisruptors = this.identifyPotentialDisruptors(studentData);
    
    // Calculate confidence
    const confidenceLevel = this.calculateForecastConfidence(studentData);

    const forecast: EngagementForecast = {
      userId,
      forecastPeriod: period,
      optimalInteractionTimes: optimalTimes,
      preferredCommunicationMethods: preferredMethods,
      engagementProbability,
      responseTimeExpectation,
      motivationalFactors,
      potentialDisruptors,
      confidenceLevel,
      forecastDate: new Date().toISOString()
    };

    // Store forecast
    this.storeEngagementForecast(forecast);

    logger.log(`Engagement forecast completed for ${userId}: ${(engagementProbability * 100).toFixed(1)}% engagement probability`);
    return forecast;
  }

  private analyzeOptimalInteractionTimes(studentData: any): OptimalTime[] {
    const optimalTimes: OptimalTime[] = [];

    // Analyze interaction history for patterns
    if (studentData.interactions && studentData.interactions.length > 0) {
      const timePatterns = this.analyzeInteractionTimingPatterns(studentData.interactions);
      
      // Generate optimal times based on patterns
      timePatterns.forEach(pattern => {
        optimalTimes.push({
          dayOfWeek: pattern.dayOfWeek,
          timeRange: pattern.timeRange,
          probability: pattern.engagementRate,
          method: pattern.preferredMethod || 'message'
        });
      });
    }

    // Default patterns if no data available
    if (optimalTimes.length === 0) {
      optimalTimes.push(
        { dayOfWeek: 'Monday', timeRange: '10:00-12:00', probability: 0.7, method: 'message' },
        { dayOfWeek: 'Wednesday', timeRange: '14:00-16:00', probability: 0.6, method: 'message' },
        { dayOfWeek: 'Friday', timeRange: '09:00-11:00', probability: 0.5, method: 'message' }
      );
    }

    return optimalTimes.sort((a, b) => b.probability - a.probability);
  }

  private analyzeInteractionTimingPatterns(interactions: any[]): any[] {
    // This would analyze actual timing patterns from interaction history
    // For now, return simulated patterns
    return [
      { dayOfWeek: 'Monday', timeRange: '10:00-12:00', engagementRate: 0.8, preferredMethod: 'message' },
      { dayOfWeek: 'Wednesday', timeRange: '14:00-16:00', engagementRate: 0.7, preferredMethod: 'discussion' },
      { dayOfWeek: 'Friday', timeRange: '09:00-11:00', engagementRate: 0.6, preferredMethod: 'message' }
    ];
  }

  private identifyPreferredCommunicationMethods(studentData: any): string[] {
    const methods = ['message', 'discussion', 'email'];

    // Analyze interaction types to determine preferences
    if (studentData.interactions && studentData.interactions.length > 0) {
      const methodCounts = studentData.interactions.reduce((counts: any, interaction: any) => {
        const type = interaction.interaction_type;
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {});

      // Sort by frequency
      return Object.entries(methodCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .map(([method]) => method)
        .slice(0, 3);
    }

    return methods;
  }

  private calculateEngagementProbability(studentData: any): number {
    let probability = 0.5; // Base probability

    // Recent engagement trends
    if (studentData.interactions && studentData.interactions.length > 0) {
      const recentEngagement = this.calculateRecentEngagement(studentData.interactions);
      probability = (probability + recentEngagement) / 2;
    }

    // Academic pressure impact
    if (studentData.academic) {
      const academic = {
        current_workload_level: studentData.academic.current_workload_level || 'moderate',
        upcoming_deadlines: studentData.academic.upcoming_deadlines ? JSON.parse(studentData.academic.upcoming_deadlines) : []
      };
      const workloadPressure = this.calculateWorkloadPressure(academic);
      probability = probability * (1 - workloadPressure * 0.3); // High pressure reduces engagement
    }

    return Math.max(0.1, Math.min(0.95, probability));
  }

  private predictResponseTime(studentData: any): number {
    // Default to 240 minutes (4 hours)
    let responseTime = 240;

    if (studentData.persona) {
      // Use flat column structure from actual database
      const responsePattern = studentData.persona.response_time_pattern;

      if (responsePattern) {
        switch (responsePattern) {
          case 'immediate': responseTime = 15; break;
          case 'quick': responseTime = 60; break;
          case 'thoughtful': responseTime = 240; break;
          case 'delayed': responseTime = 720; break; // 12 hours
          default: responseTime = 240; break;
        }
      }
    }

    return responseTime;
  }

  private identifyMotivationalFactors(studentData: any): string[] {
    const factors: string[] = [];

    if (studentData.academic) {
      const strengthAreas = studentData.academic.strength_areas ? JSON.parse(studentData.academic.strength_areas) : [];
      const upcomingDeadlines = studentData.academic.upcoming_deadlines ? JSON.parse(studentData.academic.upcoming_deadlines) : [];
      
      if (strengthAreas && strengthAreas.length > 0) {
        factors.push(`Leverage strengths in: ${strengthAreas.slice(0, 2).join(', ')}`);
      }
      
      if (upcomingDeadlines && upcomingDeadlines.length > 0) {
        factors.push('Deadline-driven motivation');
      }
    }

    if (studentData.relationships && studentData.relationships.length > 0) {
      factors.push('Peer collaboration and social learning');
    }

    // Default motivational factors
    if (factors.length === 0) {
      factors.push('Academic achievement and progress');
      factors.push('Learning new skills and knowledge');
    }

    return factors;
  }

  private identifyPotentialDisruptors(studentData: any): string[] {
    const disruptors: string[] = [];

    if (studentData.academic) {
      const workloadLevel = studentData.academic.current_workload_level;
      const challengeAreas = studentData.academic.challenge_areas ? JSON.parse(studentData.academic.challenge_areas) : [];
      
      if (workloadLevel === 'overwhelming') {
        disruptors.push('Overwhelming academic workload');
      }
      
      if (challengeAreas && challengeAreas.length > 2) {
        disruptors.push('Multiple academic challenge areas');
      }
    }

    // Risk assessment based disruptors
    if (studentData.interactions && studentData.interactions.length > 0) {
      const recentSentiment = this.calculateRecentEngagement(studentData.interactions);
      if (recentSentiment < 0.4) {
        disruptors.push('Declining engagement and motivation');
      }
    }

    return disruptors;
  }

  private calculateForecastConfidence(studentData: any): number {
    let confidence = 0.4; // Base confidence

    if (studentData.interactions && studentData.interactions.length > 5) confidence += 0.2;
    if (studentData.persona) confidence += 0.15;
    if (studentData.academic) confidence += 0.15;
    if (studentData.relationships && studentData.relationships.length > 0) confidence += 0.1;

    return Math.min(confidence, 0.9);
  }

  private storeEngagementForecast(forecast: EngagementForecast): void {
    const stmt = this.db.prepare(`
      INSERT INTO engagement_forecasts (
        user_id, forecast_period, optimal_interaction_times,
        preferred_communication_methods, engagement_probability,
        response_time_expectation, motivational_factors,
        potential_disruptors, confidence_level, forecast_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      forecast.userId,
      forecast.forecastPeriod,
      JSON.stringify(forecast.optimalInteractionTimes),
      JSON.stringify(forecast.preferredCommunicationMethods),
      forecast.engagementProbability,
      forecast.responseTimeExpectation,
      JSON.stringify(forecast.motivationalFactors),
      JSON.stringify(forecast.potentialDisruptors),
      forecast.confidenceLevel,
      forecast.forecastDate
    );
  }

  // === INTERVENTION TRACKING ===

  async recordIntervention(
    userId: string,
    interventionType: string,
    riskLevelBefore: string,
    riskScoreBefore: number,
    interventionActions: string[]
  ): Promise<string> {
    const stmt = this.db.prepare(`
      INSERT INTO intervention_history (
        user_id, intervention_type, risk_level_before, risk_score_before,
        intervention_actions, intervention_date
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      interventionType,
      riskLevelBefore,
      riskScoreBefore,
      JSON.stringify(interventionActions),
      new Date().toISOString()
    );

    logger.log(`Intervention recorded for user ${userId}: ${interventionType}`);
    return result.lastInsertRowid.toString();
  }

  async updateInterventionOutcome(
    interventionId: string,
    riskLevelAfter: string,
    riskScoreAfter: number,
    effectivenessScore: number,
    success: boolean,
    notes?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE intervention_history SET
        followup_date = ?, risk_level_after = ?, risk_score_after = ?,
        effectiveness_score = ?, success = ?, notes = ?
      WHERE id = ?
    `);

    stmt.run(
      new Date().toISOString(),
      riskLevelAfter,
      riskScoreAfter,
      effectivenessScore,
      success ? 1 : 0,
      notes || null,
      interventionId
    );

    logger.log(`Intervention outcome updated for intervention ${interventionId}: ${success ? 'Success' : 'Needs follow-up'}`);
  }
} 