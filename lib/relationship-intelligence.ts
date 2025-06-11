import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Simple logger implementation for standalone use
const logger = {
  log: (message: string) => console.log(new Date().toISOString() + ' [LOG] ' + message)
};

// === INTERFACES ===

export interface GroupDynamics {
  groupId: string;
  groupType: 'study_group' | 'project_team' | 'discussion_group' | 'informal_network';
  members: GroupMember[];
  dynamicsAnalysis: {
    cohesionScore: number; // 0-1, how well the group works together
    participationBalance: number; // 0-1, how evenly participation is distributed
    leadershipStyle: 'democratic' | 'autocratic' | 'laissez_faire' | 'situational';
    communicationEffectiveness: number; // 0-1
    conflictLevel: 'low' | 'medium' | 'high';
    productivityScore: number; // 0-1
  };
  effectivenessMetrics: {
    taskCompletion: number; // 0-1
    qualityOfOutput: number; // 0-1
    memberSatisfaction: number; // 0-1
    learningOutcomes: number; // 0-1
  };
  recommendations: string[];
  analysisDate: string;
  confidenceLevel: number;
}

export interface GroupMember {
  userId: string;
  name: string;
  role: 'leader' | 'contributor' | 'supporter' | 'observer';
  contributionLevel: number; // 0-1
  influenceScore: number; // 0-1, how much they influence group decisions
  collaborationStyle: string;
  strengths: string[];
  growthAreas: string[];
}

export interface PeerInfluenceMap {
  centerUserId: string;
  influenceNetwork: InfluenceConnection[];
  networkMetrics: {
    networkSize: number;
    influenceReach: number; // How many people they can influence
    influenceReceived: number; // How much they're influenced by others
    brokeragePosition: number; // 0-1, position as information broker
    clusterCoefficient: number; // 0-1, how connected their connections are
  };
  influenceTypes: {
    academic: number; // 0-1
    social: number; // 0-1
    motivational: number; // 0-1
    informational: number; // 0-1
  };
  analysisDate: string;
  confidenceLevel: number;
}

export interface InfluenceConnection {
  targetUserId: string;
  targetName: string;
  connectionStrength: number; // 0-1
  influenceDirection: 'outgoing' | 'incoming' | 'bidirectional';
  influenceType: 'academic' | 'social' | 'motivational' | 'informational';
  connectionContext: string[]; // courses, projects, etc.
  evidenceMetrics: {
    interactionFrequency: number;
    responseRate: number;
    behaviorCorrelation: number; // How similar their behaviors are
  };
}

export interface CollaborationEffectiveness {
  partnershipId: string;
  participants: string[];
  collaborationType: 'peer_tutoring' | 'study_partnership' | 'project_collaboration' | 'discussion_partnership';
  effectivenessScore: number; // 0-1
  compatibilityAnalysis: {
    learningStyleMatch: number; // 0-1
    communicationStyleMatch: number; // 0-1
    scheduleCompatibility: number; // 0-1
    skillComplementarity: number; // 0-1
    motivationAlignment: number; // 0-1
  };
  outcomeMetrics: {
    taskSuccessRate: number; // 0-1
    learningGains: number; // 0-1
    satisfactionLevel: number; // 0-1
    retentionRate: number; // 0-1
  };
  improvements: string[];
  potentialChallenges: string[];
  recommendedDuration: string;
  analysisDate: string;
  confidenceLevel: number;
}

export interface SocialSupportNetwork {
  userId: string;
  supportLevels: {
    academic: SupportLevel;
    emotional: SupportLevel;
    social: SupportLevel;
    informational: SupportLevel;
  };
  networkHealth: {
    diversityScore: number; // 0-1, variety of support sources
    redundancyScore: number; // 0-1, backup support availability
    accessibilityScore: number; // 0-1, how easily support can be accessed
    reciprocityScore: number; // 0-1, balance of giving/receiving support
  };
  riskFactors: string[];
  strengthFactors: string[];
  recommendations: string[];
  analysisDate: string;
  confidenceLevel: number;
}

export interface SupportLevel {
  availabilityScore: number; // 0-1
  qualityScore: number; // 0-1
  utilizationRate: number; // 0-1
  supporters: SupportProvider[];
}

export interface SupportProvider {
  userId: string;
  name: string;
  supportType: string[];
  relationship: string;
  availability: number; // 0-1
  effectiveness: number; // 0-1
}

// === MAIN CLASS ===

export class RelationshipIntelligence {
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
    // Group dynamics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_dynamics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        group_type TEXT NOT NULL,
        members TEXT NOT NULL,
        dynamics_analysis TEXT NOT NULL,
        effectiveness_metrics TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        confidence_level REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, analysis_date)
      )
    `);

    // Peer influence networks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS peer_influence_networks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        center_user_id TEXT NOT NULL,
        influence_network TEXT NOT NULL,
        network_metrics TEXT NOT NULL,
        influence_types TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        confidence_level REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(center_user_id, analysis_date)
      )
    `);

    // Collaboration effectiveness table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collaboration_effectiveness (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partnership_id TEXT NOT NULL,
        participants TEXT NOT NULL,
        collaboration_type TEXT NOT NULL,
        effectiveness_score REAL NOT NULL,
        compatibility_analysis TEXT NOT NULL,
        outcome_metrics TEXT NOT NULL,
        improvements TEXT NOT NULL,
        potential_challenges TEXT NOT NULL,
        recommended_duration TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        confidence_level REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(partnership_id, analysis_date)
      )
    `);

    // Social support networks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_support_networks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        support_levels TEXT NOT NULL,
        network_health TEXT NOT NULL,
        risk_factors TEXT NOT NULL,
        strength_factors TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        analysis_date TEXT NOT NULL,
        confidence_level REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, analysis_date)
      )
    `);

    // Group formation recommendations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_formation_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id TEXT NOT NULL,
        group_size INTEGER NOT NULL,
        collaboration_type TEXT NOT NULL,
        recommended_members TEXT NOT NULL,
        rationale TEXT NOT NULL,
        predicted_effectiveness REAL NOT NULL,
        recommendation_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // === GROUP DYNAMICS ANALYSIS ===

  async analyzeGroupDynamics(groupId: string, forceRefresh: boolean = false): Promise<GroupDynamics> {
    logger.log('Analyzing group dynamics for group: ' + groupId);

    // Check for recent analysis if not forcing refresh
    if (!forceRefresh) {
      const existingAnalysis = this.getRecentGroupAnalysis(groupId);
      if (existingAnalysis) {
        logger.log('Using cached group dynamics analysis for: ' + groupId);
        return existingAnalysis;
      }
    }

    // Gather group data
    const groupData = await this.gatherGroupData(groupId);
    
    // Identify group members and their roles
    const members = await this.identifyGroupMembers(groupData);
    
    // Calculate group dynamics
    const dynamicsAnalysis = this.calculateGroupDynamics(groupData, members);
    
    // Calculate effectiveness metrics
    const effectivenessMetrics = this.calculateGroupEffectiveness(groupData, members);
    
    // Generate recommendations
    const recommendations = this.generateGroupRecommendations(dynamicsAnalysis, effectivenessMetrics, members);
    
    // Determine group type
    const groupType = this.determineGroupType(groupData);
    
    // Calculate confidence level
    const confidenceLevel = this.calculateGroupAnalysisConfidence(groupData, members);

    const analysis: GroupDynamics = {
      groupId,
      groupType,
      members,
      dynamicsAnalysis,
      effectivenessMetrics,
      recommendations,
      analysisDate: new Date().toISOString(),
      confidenceLevel
    };

    // Store analysis
    this.storeGroupDynamics(analysis);

    logger.log('Group dynamics analysis completed for ' + groupId + ': ' + (dynamicsAnalysis.cohesionScore * 100).toFixed(1) + '% cohesion');
    return analysis;
  }

  private getRecentGroupAnalysis(groupId: string): GroupDynamics | null {
    const stmt = this.db.prepare('SELECT * FROM group_dynamics WHERE group_id = ? AND analysis_date > datetime(?, \'-7 days\') ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(groupId, 'now') as any;
    if (!row) return null;

    return {
      groupId: row.group_id,
      groupType: row.group_type,
      members: JSON.parse(row.members),
      dynamicsAnalysis: JSON.parse(row.dynamics_analysis),
      effectivenessMetrics: JSON.parse(row.effectiveness_metrics),
      recommendations: JSON.parse(row.recommendations),
      analysisDate: row.analysis_date,
      confidenceLevel: row.confidence_level
    };
  }

  private async gatherGroupData(groupId: string): Promise<any> {
    // Get group interactions (simplified - would need proper group identification logic)
    const interactions = this.db.prepare('SELECT * FROM interaction_history WHERE interaction_type = ? AND JSON_EXTRACT(metadata, ?) = ? ORDER BY created_at DESC').all('group_activity', '$.group_id', groupId);

    // Get group members from interactions
    const memberIds = new Set<string>();
    interactions.forEach((interaction: any) => {
      memberIds.add(interaction.user_id);
      try {
        const recipients = JSON.parse(interaction.recipient_ids || '[]');
        recipients.forEach((id: string) => memberIds.add(id));
      } catch (e) {
        // Handle parsing errors
      }
    });

    const timespan = this.calculateGroupTimespan(interactions);

    return {
      groupId,
      interactions,
      memberIds: Array.from(memberIds),
      memberCount: memberIds.size,
      timespan,
      activityLevel: interactions.length
    };
  }

  private calculateGroupTimespan(interactions: any[]): number {
    if (interactions.length === 0) return 0;
    
    const dates = interactions.map(i => new Date(i.created_at).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    
    return (maxDate - minDate) / (1000 * 60 * 60 * 24); // Days
  }

  private async identifyGroupMembers(groupData: any): Promise<GroupMember[]> {
    const members: GroupMember[] = [];

    for (const memberId of groupData.memberIds) {
      // Get member's persona
      const persona = this.db.prepare('SELECT * FROM student_personas WHERE user_id = ?').get(memberId) as any;
      
      // Get member's interaction data within this group
      const memberInteractions = groupData.interactions.filter((i: any) => i.user_id === memberId);
      
      // Calculate contribution level
      const contributionLevel = this.calculateContributionLevel(memberInteractions, groupData);
      
      // Calculate influence score
      const influenceScore = this.calculateMemberInfluence(memberInteractions, groupData);
      
      // Determine role
      const role = this.determineMemberRole(contributionLevel, influenceScore, memberInteractions);
      
      // Determine collaboration style
      const collaborationStyle = this.determineMemberCollaborationStyle(persona);
      
      // Identify strengths and growth areas
      const strengths = this.identifyMemberStrengths(persona);
      const growthAreas = this.identifyMemberGrowthAreas(persona, role);

      members.push({
        userId: memberId,
        name: persona?.student_name || 'Unknown Student',
        role,
        contributionLevel,
        influenceScore,
        collaborationStyle,
        strengths,
        growthAreas
      });
    }

    return members;
  }

  private calculateContributionLevel(memberData: any, groupData: any): number {
    if (groupData.activityLevel === 0) return 0;
    
    const memberContributions = Array.isArray(memberData) ? memberData.length : 0;
    const totalContributions = groupData.activityLevel;
    
    return Math.min(memberContributions / (totalContributions / groupData.memberCount), 1);
  }

  private calculateMemberInfluence(memberData: any, groupData: any): number {
    // Simplified influence calculation based on response patterns
    const memberInteractions = Array.isArray(memberData) ? memberData : [];
    
    // Count responses to this member's messages
    let responsesReceived = 0;
    memberInteractions.forEach((interaction: any) => {
      const responseTime = new Date(interaction.created_at).getTime();
      const subsequentMessages = groupData.interactions.filter((i: any) => 
        new Date(i.created_at).getTime() > responseTime &&
        new Date(i.created_at).getTime() < responseTime + (60 * 60 * 1000) // Within 1 hour
      );
      responsesReceived += subsequentMessages.length;
    });

    // Normalize by member's contribution level
    const normalizedInfluence = memberInteractions.length > 0 ? 
      responsesReceived / memberInteractions.length : 0;

    return Math.min(normalizedInfluence / 2, 1); // Scale to 0-1
  }

  private determineMemberRole(contributionLevel: number, influenceScore: number, memberData: any): 'leader' | 'contributor' | 'supporter' | 'observer' {
    if (influenceScore > 0.7 && contributionLevel > 0.6) return 'leader';
    if (contributionLevel > 0.5) return 'contributor';
    if (contributionLevel > 0.2) return 'supporter';
    return 'observer';
  }

  private determineMemberCollaborationStyle(memberData: any): string {
    if (!memberData) return 'balanced';
    
    const style = memberData.collaboration_style || 'balanced';
    return style;
  }

  private identifyMemberStrengths(memberData: any): string[] {
    if (!memberData) return ['participation'];
    
    const strengths: string[] = [];
    
    try {
      const indicators = JSON.parse(memberData.learning_style_indicators || '{}');
      Object.entries(indicators).forEach(([style, score]: [string, any]) => {
        if (score > 0.6) {
          strengths.push(style + ' learning');
        }
      });
    } catch (e) {
      // Handle parsing errors
    }
    
    if (memberData.engagement_level === 'high') {
      strengths.push('high engagement');
    }
    
    return strengths.length > 0 ? strengths : ['participation'];
  }

  private identifyMemberGrowthAreas(memberData: any, role: string): string[] {
    const growthAreas: string[] = [];
    
    if (role === 'observer') {
      growthAreas.push('increase participation', 'active contribution');
    } else if (role === 'supporter') {
      growthAreas.push('leadership skills', 'initiative taking');
    }
    
    if (memberData?.communication_style === 'passive') {
      growthAreas.push('assertive communication');
    }
    
    return growthAreas.length > 0 ? growthAreas : ['collaboration skills'];
  }

  private calculateGroupDynamics(groupData: any, members: GroupMember[]): any {
    const cohesionScore = this.calculateCohesionScore(groupData, members);
    const participationBalance = this.calculateParticipationBalance(members);
    const leadershipStyle = this.identifyLeadershipStyle(members);
    const communicationEffectiveness = this.calculateCommunicationEffectiveness(groupData);
    const conflictLevel = this.assessConflictLevel(groupData);
    const productivityScore = this.calculateProductivityScore(groupData, members);

    return {
      cohesionScore,
      participationBalance,
      leadershipStyle,
      communicationEffectiveness,
      conflictLevel,
      productivityScore
    };
  }

  private calculateCohesionScore(groupData: any, members: GroupMember[]): number {
    // Base cohesion on interaction density and sentiment
    const interactionDensity = groupData.activityLevel / Math.max(groupData.memberCount * groupData.timespan, 1);
    
    // Calculate sentiment variance (lower variance = more cohesion)
    const sentimentVariance = this.calculateSentimentVariance(groupData.interactions);
    const sentimentCohesion = 1 - Math.min(sentimentVariance, 1);
    
    return (interactionDensity * 0.4 + sentimentCohesion * 0.6) * 0.8; // Scale to realistic range
  }

  private calculateSentimentVariance(interactions: any[]): number {
    const sentiments = interactions.map(i => i.sentiment_score || 0).filter(s => s !== 0);
    if (sentiments.length === 0) return 0.5; // Default variance
    
    const mean = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
    return variance;
  }

  private calculateParticipationBalance(members: GroupMember[]): number {
    if (members.length === 0) return 0;
    
    const contributions = members.map(m => m.contributionLevel);
    const variance = this.calculateVariance(contributions);
    
    // Lower variance = better balance
    return Math.max(0, 1 - (variance * 2));
  }

  private identifyLeadershipStyle(members: GroupMember[]): 'democratic' | 'autocratic' | 'laissez_faire' | 'situational' {
    const leaders = members.filter(m => m.role === 'leader');
    
    if (leaders.length === 0) return 'laissez_faire';
    if (leaders.length === 1 && leaders[0].influenceScore > 0.8) return 'autocratic';
    if (leaders.length > 1) return 'democratic';
    
    return 'situational';
  }

  private calculateCommunicationEffectiveness(groupData: any): number {
    if (groupData.activityLevel === 0) return 0;
    
    // Base effectiveness on interaction frequency and response patterns
    const avgDaily = groupData.activityLevel / Math.max(groupData.timespan, 1);
    const responseRate = this.calculateResponseRate(groupData.interactions);
    
    return Math.min((avgDaily / 5) * 0.5 + responseRate * 0.5, 1);
  }

  private calculateResponseRate(interactions: any[]): number {
    if (interactions.length < 2) return 0.5;
    
    let responses = 0;
    for (let i = 0; i < interactions.length - 1; i++) {
      const timeGap = new Date(interactions[i + 1].created_at).getTime() - new Date(interactions[i].created_at).getTime();
      if (timeGap < 24 * 60 * 60 * 1000) { // Within 24 hours
        responses++;
      }
    }
    
    return responses / (interactions.length - 1);
  }

  private assessConflictLevel(groupData: any): 'low' | 'medium' | 'high' {
    const negativeSentiments = groupData.interactions.filter((i: any) => (i.sentiment_score || 0) < -0.3);
    const conflictRatio = negativeSentiments.length / Math.max(groupData.activityLevel, 1);
    
    if (conflictRatio > 0.3) return 'high';
    if (conflictRatio > 0.1) return 'medium';
    return 'low';
  }

  private calculateProductivityScore(groupData: any, members: GroupMember[]): number {
    // Base productivity on activity level, participation balance, and cohesion
    const activityScore = Math.min(groupData.activityLevel / 20, 1); // 20+ interactions = high activity
    const balanceScore = this.calculateParticipationBalance(members);
    const cohesionScore = this.calculateCohesionScore(groupData, members);
    
    return (activityScore * 0.4 + balanceScore * 0.3 + cohesionScore * 0.3);
  }

  private calculateGroupEffectiveness(groupData: any, members: GroupMember[]): any {
    const taskCompletion = this.estimateTaskCompletion(groupData, members);
    const qualityOfOutput = this.estimateOutputQuality(groupData, members);
    const memberSatisfaction = this.estimateMemberSatisfaction(groupData, members);
    const learningOutcomes = this.estimateLearningOutcomes(groupData, members);

    return {
      taskCompletion,
      qualityOfOutput,
      memberSatisfaction,
      learningOutcomes
    };
  }

  private estimateTaskCompletion(groupData: any, members: GroupMember[]): number {
    // Based on sustained activity and member engagement
    const sustainedActivity = groupData.timespan > 7 ? 0.8 : groupData.timespan / 7 * 0.8;
    const engagementLevel = members.reduce((sum, m) => sum + m.contributionLevel, 0) / members.length;
    
    return (sustainedActivity * 0.6 + engagementLevel * 0.4);
  }

  private estimateOutputQuality(groupData: any, members: GroupMember[]): number {
    // Based on member diversity, collaboration styles, and communication effectiveness
    const roleVariety = new Set(members.map(m => m.role)).size / 4; // 4 possible roles
    const styleVariety = new Set(members.map(m => m.collaborationStyle)).size / members.length;
    const communicationQuality = this.calculateCommunicationEffectiveness(groupData);
    
    return (roleVariety * 0.3 + styleVariety * 0.3 + communicationQuality * 0.4);
  }

  private estimateMemberSatisfaction(groupData: any, members: GroupMember[]): number {
    // Based on positive sentiment and balanced participation
    const avgSentiment = groupData.interactions.reduce((sum: number, i: any) => sum + (i.sentiment_score || 0), 0) / Math.max(groupData.interactions.length, 1);
    const normalizedSentiment = (avgSentiment + 1) / 2; // Convert from [-1,1] to [0,1]
    const participationBalance = this.calculateParticipationBalance(members);
    
    return (normalizedSentiment * 0.6 + participationBalance * 0.4);
  }

  private estimateLearningOutcomes(groupData: any, members: GroupMember[]): number {
    // Based on interaction diversity, member strengths, and sustained engagement
    const interactionVariety = Math.min(groupData.activityLevel / 15, 1); // 15+ interactions = good variety
    const strengthDiversity = members.reduce((sum, m) => sum + m.strengths.length, 0) / members.length / 3; // Avg 3 strengths
    const sustainedEngagement = groupData.timespan > 14 ? 1 : groupData.timespan / 14;
    
    return (interactionVariety * 0.4 + strengthDiversity * 0.3 + sustainedEngagement * 0.3);
  }

  private generateGroupRecommendations(dynamics: any, effectiveness: any, members: GroupMember[]): string[] {
    const recommendations: string[] = [];

    // Cohesion recommendations
    if (dynamics.cohesionScore < 0.5) {
      recommendations.push('Consider team-building activities to improve group cohesion');
      recommendations.push('Establish clear shared goals and expectations');
    }

    // Participation balance
    if (dynamics.participationBalance < 0.6) {
      recommendations.push('Encourage quieter members to participate more actively');
      recommendations.push('Rotate speaking/leading opportunities among members');
    }

    // Leadership recommendations
    if (dynamics.leadershipStyle === 'laissez_faire') {
      recommendations.push('Identify and develop leadership roles within the group');
    } else if (dynamics.leadershipStyle === 'autocratic') {
      recommendations.push('Encourage more collaborative decision-making processes');
    }

    // Communication effectiveness
    if (dynamics.communicationEffectiveness < 0.6) {
      recommendations.push('Establish regular check-ins and communication schedules');
      recommendations.push('Use structured communication tools and protocols');
    }

    // Conflict management
    if (dynamics.conflictLevel === 'high') {
      recommendations.push('Address underlying conflicts through mediation or discussion');
      recommendations.push('Establish ground rules for respectful communication');
    }

    // Member-specific recommendations
    const observers = members.filter(m => m.role === 'observer');
    if (observers.length > members.length * 0.3) {
      recommendations.push('Provide specific roles and tasks for less active members');
    }

    // Effectiveness improvements
    if (effectiveness.taskCompletion < 0.6) {
      recommendations.push('Break down tasks into smaller, manageable components');
      recommendations.push('Set clear deadlines and accountability measures');
    }

    if (effectiveness.qualityOfOutput < 0.6) {
      recommendations.push('Implement peer review and feedback processes');
      recommendations.push('Leverage diverse member strengths for different tasks');
    }

    return recommendations;
  }

  private determineGroupType(groupData: any): 'study_group' | 'project_team' | 'discussion_group' | 'informal_network' {
    // Simple heuristics based on interaction patterns
    if (groupData.timespan > 30 && groupData.activityLevel > 50) {
      return 'project_team';
    } else if (groupData.activityLevel > 20) {
      return 'study_group';
    } else if (groupData.memberCount > 6) {
      return 'discussion_group';
    } else {
      return 'informal_network';
    }
  }

  private calculateGroupAnalysisConfidence(groupData: any, members: GroupMember[]): number {
    let confidence = 0.5; // Base confidence

    // More data = higher confidence
    if (groupData.activityLevel > 10) confidence += 0.2;
    if (groupData.timespan > 7) confidence += 0.2;
    if (members.length >= 3) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private storeGroupDynamics(analysis: GroupDynamics): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO group_dynamics (group_id, group_type, members, dynamics_analysis, effectiveness_metrics, recommendations, analysis_date, confidence_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    stmt.run(
      analysis.groupId,
      analysis.groupType,
      JSON.stringify(analysis.members),
      JSON.stringify(analysis.dynamicsAnalysis),
      JSON.stringify(analysis.effectivenessMetrics),
      JSON.stringify(analysis.recommendations),
      analysis.analysisDate,
      analysis.confidenceLevel
    );
  }

  // === PEER INFLUENCE MAPPING ===

  async mapPeerInfluence(userId: string, forceRefresh: boolean = false): Promise<PeerInfluenceMap> {
    logger.log('Mapping peer influence network for user: ' + userId);

    // Check for recent analysis if not forcing refresh
    if (!forceRefresh) {
      const existingMap = this.getRecentInfluenceMap(userId);
      if (existingMap) {
        logger.log('Using cached influence map for: ' + userId);
        return existingMap;
      }
    }

    // Gather network data
    const networkData = await this.gatherNetworkData(userId);
    
    // Identify influence connections
    const influenceNetwork = await this.identifyInfluenceConnections(userId, networkData);
    
    // Calculate network metrics
    const networkMetrics = this.calculateNetworkMetrics(influenceNetwork);
    
    // Categorize influence types
    const influenceTypes = this.categorizeInfluenceTypes(influenceNetwork);
    
    // Calculate confidence
    const confidenceLevel = this.calculateInfluenceConfidence(networkData, influenceNetwork);

    const influenceMap: PeerInfluenceMap = {
      centerUserId: userId,
      influenceNetwork,
      networkMetrics,
      influenceTypes,
      analysisDate: new Date().toISOString(),
      confidenceLevel
    };

    // Store influence map
    this.storeInfluenceMap(influenceMap);

    logger.log('Peer influence mapping completed for ' + userId + ': ' + influenceNetwork.length + ' connections found');
    return influenceMap;
  }

  private getRecentInfluenceMap(userId: string): PeerInfluenceMap | null {
    const stmt = this.db.prepare('SELECT * FROM peer_influence_networks WHERE center_user_id = ? AND analysis_date > datetime(?, \'-14 days\') ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(userId, 'now') as any;
    if (!row) return null;

    return {
      centerUserId: row.center_user_id,
      influenceNetwork: JSON.parse(row.influence_network),
      networkMetrics: JSON.parse(row.network_metrics),
      influenceTypes: JSON.parse(row.influence_types),
      analysisDate: row.analysis_date,
      confidenceLevel: row.confidence_level
    };
  }

  private async gatherNetworkData(userId: string): Promise<any> {
    // Get user's interactions
    const interactions = this.db.prepare('SELECT * FROM interaction_history WHERE user_id = ? OR JSON_EXTRACT(recipient_ids, ?) LIKE ? ORDER BY created_at DESC').all(userId, '$', '%' + userId + '%');

    // Get user's relationships
    const relationships = this.db.prepare('SELECT * FROM student_relationships WHERE student_user_id = ? OR contact_user_id = ?').all(userId, userId);

    // Get user contexts
    const userContexts = this.db.prepare('SELECT * FROM academic_context WHERE user_id = ?').all(userId);

    // Extract all connected user IDs
    const connectedUserIds = new Set<string>();
    interactions.forEach((interaction: any) => {
      if (interaction.user_id !== userId) connectedUserIds.add(interaction.user_id);
      try {
        const recipients = JSON.parse(interaction.recipient_ids || '[]');
        recipients.forEach((id: string) => {
          if (id !== userId) connectedUserIds.add(id);
        });
      } catch (e) {
        // Handle parsing errors
      }
    });

    relationships.forEach((rel: any) => {
      if (rel.student_user_id !== userId) connectedUserIds.add(rel.student_user_id);
      if (rel.contact_user_id !== userId) connectedUserIds.add(rel.contact_user_id);
    });

    return {
      interactions,
      relationships,
      userContexts,
      connectedUserIds: Array.from(connectedUserIds),
      networkSize: connectedUserIds.size
    };
  }

  private async identifyInfluenceConnections(userId: string, networkData: any): Promise<InfluenceConnection[]> {
    const connections: InfluenceConnection[] = [];

    for (const connectedUserId of networkData.connectedUserIds) {
      // Get connected user's contexts
      const connectedUserContexts = this.db.prepare('SELECT * FROM academic_context WHERE user_id = ?').all(connectedUserId);
      
      // Find shared interactions
      const sharedInteractions = networkData.interactions.filter((interaction: any) => {
        if (interaction.user_id === connectedUserId) return true;
        try {
          const recipients = JSON.parse(interaction.recipient_ids || '[]');
          return recipients.includes(connectedUserId);
        } catch (e) {
          return false;
        }
      });

      if (sharedInteractions.length < 2) continue; // Need minimum interactions for influence

      // Calculate connection strength
      const connectionStrength = this.calculateConnectionStrength(
        { userId: connectedUserId, interactions: sharedInteractions },
        connectedUserContexts,
        networkData
      );

      if (connectionStrength < 0.1) continue; // Filter weak connections

      // Determine influence direction
      const influenceDirection = this.determineInfluenceDirection(
        { userId: connectedUserId, interactions: sharedInteractions },
        connectedUserContexts,
        networkData
      );

      // Determine influence type
      const influenceType = this.determineInfluenceType(
        { userId: connectedUserId, interactions: sharedInteractions },
        networkData
      );

      // Calculate evidence metrics
      const evidenceMetrics = this.calculateEvidenceMetrics(
        { userId: connectedUserId, interactions: sharedInteractions },
        connectedUserContexts,
        networkData
      );

      // Find connection contexts (courses, projects, etc.)
      const connectionContext = this.findConnectionContexts(connectedUserContexts, networkData.userContexts);

      // Get connected user's name
      const connectedUserPersona = this.db.prepare('SELECT student_name FROM student_personas WHERE user_id = ?').get(connectedUserId) as any;

      connections.push({
        targetUserId: connectedUserId,
        targetName: connectedUserPersona?.student_name || 'Unknown Student',
        connectionStrength,
        influenceDirection,
        influenceType,
        connectionContext,
        evidenceMetrics
      });
    }

    // Sort by connection strength
    return connections.sort((a, b) => b.connectionStrength - a.connectionStrength);
  }

  private calculateConnectionStrength(connection: any, userContexts: any[], networkData: any): number {
    const interactions = connection.interactions;
    
    // Frequency score
    const frequencyScore = Math.min(interactions.length / 10, 1); // 10+ interactions = max score
    
    // Recency score
    const recentInteractions = interactions.filter((i: any) => 
      new Date(i.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    );
    const recencyScore = Math.min(recentInteractions.length / 5, 1);
    
    // Context overlap score
    const contextOverlap = this.calculateContextOverlap(userContexts, networkData.userContexts);
    
    // Timing correlation
    const timingCorrelation = this.calculateTimingCorrelation(connection, userContexts);

    return (frequencyScore * 0.3 + recencyScore * 0.3 + contextOverlap * 0.2 + timingCorrelation * 0.2);
  }

  private calculateContextOverlap(contexts1: any[], contexts2: any[]): number {
    if (contexts1.length === 0 || contexts2.length === 0) return 0;

    const courses1 = new Set(contexts1.map(c => c.course_id));
    const courses2 = new Set(contexts2.map(c => c.course_id));
    
    const intersection = new Set(Array.from(courses1).filter(x => courses2.has(x)));
    const union = new Set(Array.from(courses1).concat(Array.from(courses2)));
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private calculateTimingCorrelation(connection: any, userContexts: any[]): number {
    // Simplified timing correlation
    return 0.5; // Placeholder - would need more sophisticated analysis
  }

  private determineInfluenceDirection(connection: any, userContexts: any[], networkData: any): 'outgoing' | 'incoming' | 'bidirectional' {
    const interactions = connection.interactions;
    
    // Count messages sent vs received
    const outgoingMessages = interactions.filter((i: any) => i.user_id === networkData.userContexts[0]?.user_id);
    const incomingMessages = interactions.filter((i: any) => i.user_id === connection.userId);
    
    const outgoingRatio = outgoingMessages.length / interactions.length;
    
    if (outgoingRatio > 0.7) return 'outgoing';
    if (outgoingRatio < 0.3) return 'incoming';
    return 'bidirectional';
  }

  private determineInfluenceType(connection: any, networkData: any): 'academic' | 'social' | 'motivational' | 'informational' {
    const interactions = connection.interactions;
    
    // Analyze interaction types and content
    const academicKeywords = ['assignment', 'homework', 'study', 'exam', 'grade'];
    const socialKeywords = ['hang out', 'meet up', 'party', 'lunch'];
    const motivationalKeywords = ['encourage', 'support', 'help', 'motivate'];
    
    let academicScore = 0;
    let socialScore = 0;
    let motivationalScore = 0;
    
    interactions.forEach((interaction: any) => {
      const content = (interaction.content || '').toLowerCase();
      academicKeywords.forEach(keyword => {
        if (content.includes(keyword)) academicScore++;
      });
      socialKeywords.forEach(keyword => {
        if (content.includes(keyword)) socialScore++;
      });
      motivationalKeywords.forEach(keyword => {
        if (content.includes(keyword)) motivationalScore++;
      });
    });
    
    // Determine dominant type
    const maxScore = Math.max(academicScore, socialScore, motivationalScore);
    if (maxScore === 0) return 'informational'; // Default
    
    if (academicScore === maxScore) return 'academic';
    if (socialScore === maxScore) return 'social';
    if (motivationalScore === maxScore) return 'motivational';
    
    return 'informational';
  }

  private calculateEvidenceMetrics(connection: any, userContexts: any[], networkData: any): any {
    const interactions = connection.interactions;
    
    const interactionFrequency = interactions.length;
    
    // Response rate calculation
    let responses = 0;
    let opportunities = 0;
    interactions.forEach((interaction: any, index: number) => {
      if (index < interactions.length - 1) {
        opportunities++;
        const nextInteraction = interactions[index + 1];
        const timeDiff = new Date(nextInteraction.created_at).getTime() - new Date(interaction.created_at).getTime();
        if (timeDiff < 24 * 60 * 60 * 1000) { // Within 24 hours
          responses++;
        }
      }
    });
    const responseRate = opportunities > 0 ? responses / opportunities : 0;
    
    // Behavior correlation (simplified)
    const behaviorCorrelation = 0.5; // Placeholder - would need behavioral analysis

    return {
      interactionFrequency,
      responseRate,
      behaviorCorrelation
    };
  }

  private findConnectionContexts(userContexts1: any[], userContexts2: any[]): string[] {
    const contexts = new Set<string>();
    
    userContexts1.forEach(c1 => {
      userContexts2.forEach(c2 => {
        if (c1.course_id === c2.course_id) {
          contexts.add(c1.course_name || c1.course_id);
        }
      });
    });
    
    return Array.from(contexts);
  }

  private calculateNetworkMetrics(influenceNetwork: InfluenceConnection[]): any {
    const networkSize = influenceNetwork.length;
    
    // Influence reach (outgoing connections)
    const outgoingConnections = influenceNetwork.filter(c => 
      c.influenceDirection === 'outgoing' || c.influenceDirection === 'bidirectional'
    ).length;
    const influenceReach = networkSize > 0 ? outgoingConnections / networkSize : 0;
    
    // Influence received (incoming connections)
    const incomingConnections = influenceNetwork.filter(c => 
      c.influenceDirection === 'incoming' || c.influenceDirection === 'bidirectional'
    ).length;
    const influenceReceived = networkSize > 0 ? incomingConnections / networkSize : 0;
    
    // Brokerage position (connections between disconnected groups)
    const brokeragePosition = this.calculateBrokeragePosition(influenceNetwork);
    
    // Cluster coefficient
    const clusterCoefficient = this.calculateClusterCoefficient(influenceNetwork);

    return {
      networkSize,
      influenceReach,
      influenceReceived,
      brokeragePosition,
      clusterCoefficient
    };
  }

  private calculateBrokeragePosition(influenceNetwork: InfluenceConnection[]): number {
    // Simplified brokerage calculation
    return Math.min(influenceNetwork.length / 10, 1);
  }

  private calculateClusterCoefficient(influenceNetwork: InfluenceConnection[]): number {
    // Simplified clustering calculation
    return influenceNetwork.length > 5 ? 0.6 : influenceNetwork.length / 5 * 0.6;
  }

  private categorizeInfluenceTypes(influenceNetwork: InfluenceConnection[]): any {
    const types = {
      academic: 0,
      social: 0,
      motivational: 0,
      informational: 0
    };

    influenceNetwork.forEach(connection => {
      const weight = connection.connectionStrength;
      types[connection.influenceType] += weight;
    });

    // Normalize to sum to 1
    const total = Object.values(types).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      Object.keys(types).forEach(key => {
        types[key as keyof typeof types] /= total;
      });
    }

    return types;
  }

  private calculateInfluenceConfidence(networkData: any, influenceNetwork: InfluenceConnection[]): number {
    let confidence = 0.5; // Base confidence

    // More interactions = higher confidence
    if (networkData.interactions.length > 20) confidence += 0.2;
    if (networkData.networkSize > 5) confidence += 0.2;
    if (influenceNetwork.length > 3) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private storeInfluenceMap(influenceMap: PeerInfluenceMap): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO peer_influence_networks (center_user_id, influence_network, network_metrics, influence_types, analysis_date, confidence_level) VALUES (?, ?, ?, ?, ?, ?)');

    stmt.run(
      influenceMap.centerUserId,
      JSON.stringify(influenceMap.influenceNetwork),
      JSON.stringify(influenceMap.networkMetrics),
      JSON.stringify(influenceMap.influenceTypes),
      influenceMap.analysisDate,
      influenceMap.confidenceLevel
    );
  }

  // Helper method for variance calculation
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  // === COLLABORATION EFFECTIVENESS ANALYSIS ===

  async analyzeCollaborationEffectiveness(
    participants: string[], 
    collaborationType: string = 'study_partnership',
    forceRefresh: boolean = false
  ): Promise<CollaborationEffectiveness> {
    logger.log('Analyzing collaboration effectiveness for: ' + participants.join(', '));
    
    const partnershipId = participants.sort().join('-');
    
    // Check for recent analysis if not forcing refresh
    if (!forceRefresh) {
      const existingAnalysis = this.getRecentCollaborationAnalysis(partnershipId);
      if (existingAnalysis) {
        logger.log('Using cached collaboration analysis for: ' + partnershipId);
        return existingAnalysis;
      }
    }

    // Gather collaboration data
    const collaborationData = await this.gatherCollaborationData(participants);
    
    // Calculate compatibility analysis
    const compatibilityAnalysis = this.calculateCompatibility(participants, collaborationData);
    
    // Calculate outcome metrics
    const outcomeMetrics = this.calculateCollaborationOutcomes(collaborationData, participants);
    
    // Calculate effectiveness score
    const effectivenessScore = this.calculateEffectivenessScore(compatibilityAnalysis, outcomeMetrics);
    
    // Generate improvements and challenges
    const improvements = this.generateCollaborationImprovements(compatibilityAnalysis, outcomeMetrics);
    const potentialChallenges = this.identifyCollaborationChallenges(compatibilityAnalysis, collaborationData);
    
    // Recommend duration
    const recommendedDuration = this.recommendCollaborationDuration(effectivenessScore, compatibilityAnalysis);
    
    // Calculate confidence
    const confidenceLevel = this.calculateCollaborationConfidence(collaborationData, participants);

    const analysis: CollaborationEffectiveness = {
      partnershipId,
      participants,
      collaborationType: collaborationType as any,
      effectivenessScore,
      compatibilityAnalysis,
      outcomeMetrics,
      improvements,
      potentialChallenges,
      recommendedDuration,
      analysisDate: new Date().toISOString(),
      confidenceLevel
    };

    // Store analysis
    this.storeCollaborationEffectiveness(analysis);

    logger.log('Collaboration effectiveness analysis completed for ' + partnershipId + ': ' + (effectivenessScore * 100).toFixed(1) + '% effective');
    return analysis;
  }

  private getRecentCollaborationAnalysis(partnershipId: string): CollaborationEffectiveness | null {
    const stmt = this.db.prepare('SELECT * FROM collaboration_effectiveness WHERE partnership_id = ? AND analysis_date > datetime(?, \'-14 days\') ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(partnershipId, 'now') as any;
    if (!row) return null;

    return {
      partnershipId: row.partnership_id,
      participants: JSON.parse(row.participants),
      collaborationType: row.collaboration_type,
      effectivenessScore: row.effectiveness_score,
      compatibilityAnalysis: JSON.parse(row.compatibility_analysis),
      outcomeMetrics: JSON.parse(row.outcome_metrics),
      improvements: JSON.parse(row.improvements),
      potentialChallenges: JSON.parse(row.potential_challenges),
      recommendedDuration: row.recommended_duration,
      analysisDate: row.analysis_date,
      confidenceLevel: row.confidence_level
    };
  }

  private async gatherCollaborationData(participants: string[]): Promise<any> {
    // Get participant personas
    const placeholders = participants.map(() => '?').join(',');
    const personas = this.db.prepare('SELECT * FROM student_personas WHERE user_id IN (' + placeholders + ')').all(...participants);

    // Get shared interactions
    const sharedInteractions: any[] = [];
    // Simplified - would need more complex queries for actual shared interactions

    // Get existing relationships
    const relationshipPlaceholders = participants.map(() => '?').join(',');
    const relationships = this.db.prepare('SELECT * FROM student_relationships WHERE (student_user_id IN (' + relationshipPlaceholders + ') AND contact_user_id IN (' + relationshipPlaceholders + ')) AND student_user_id != contact_user_id').all(...participants, ...participants);

    // Get academic contexts
    const academicContexts = this.db.prepare('SELECT * FROM academic_context WHERE user_id IN (' + placeholders + ')').all(...participants);

    return {
      personas,
      sharedInteractions,
      relationships,
      academicContexts,
      participantCount: participants.length
    };
  }

  private calculateCompatibility(participants: string[], collaborationData: any): any {
    const personas = collaborationData.personas;
    
    // Learning style match
    const learningStyleMatch = this.calculateLearningStyleCompatibility(personas);
    
    // Communication style match
    const communicationStyleMatch = this.calculateCommunicationCompatibility(personas);
    
    // Schedule compatibility (based on interaction timing patterns)
    const scheduleCompatibility = this.calculateScheduleCompatibility(collaborationData.sharedInteractions);
    
    // Skill complementarity
    const skillComplementarity = this.calculateSkillComplementarity(personas, collaborationData.academicContexts);
    
    // Motivation alignment
    const motivationAlignment = this.calculateMotivationAlignment(personas, collaborationData.sharedInteractions);

    return {
      learningStyleMatch,
      communicationStyleMatch,
      scheduleCompatibility,
      skillComplementarity,
      motivationAlignment
    };
  }

  private calculateLearningStyleCompatibility(personas: any[]): number {
    if (personas.length < 2) return 0.5;

    const styles = personas.map(p => {
      try {
        return JSON.parse(p.learning_style_indicators || '{"visual": 0.5, "auditory": 0.3, "kinesthetic": 0.2}');
      } catch {
        return { visual: 0.5, auditory: 0.3, kinesthetic: 0.2 };
      }
    });

    let compatibility = 0;
    const styleTypes = ['visual', 'auditory', 'kinesthetic'];
    
    styleTypes.forEach(type => {
      const values = styles.map(s => s[type] || 0);
      const variance = this.calculateVariance(values);
      compatibility += (1 - variance) / styleTypes.length;
    });

    return Math.max(0.1, Math.min(compatibility, 1));
  }

  private calculateCommunicationCompatibility(personas: any[]): number {
    if (personas.length < 2) return 0.5;

    const formalityLevels = personas.map(p => {
      switch (p.formality_level) {
        case 'casual': return 1;
        case 'medium': return 2;
        case 'formal': return 3;
        default: return 2;
      }
    });

    const responseTimes = personas.map(p => {
      switch (p.response_time_pattern) {
        case 'immediate': return 1;
        case 'quick': return 2;
        case 'thoughtful': return 3;
        case 'delayed': return 4;
        default: return 2;
      }
    });

    const formalityVariance = this.calculateVariance(formalityLevels);
    const responseVariance = this.calculateVariance(responseTimes);

    const compatibility = (1 - formalityVariance / 2) * 0.6 + (1 - responseVariance / 3) * 0.4;
    return Math.max(0.1, Math.min(compatibility, 1));
  }

  private calculateScheduleCompatibility(sharedInteractions: any[]): number {
    if (sharedInteractions.length === 0) return 0.3;

    const timingOverlap = sharedInteractions.filter(interaction => {
      const hour = new Date(interaction.created_at).getHours();
      return hour >= 9 && hour <= 17;
    }).length / sharedInteractions.length;

    return Math.max(0.2, Math.min(timingOverlap * 1.2, 1));
  }

  private calculateSkillComplementarity(personas: any[], academicContexts: any[]): number {
    if (personas.length < 2 || academicContexts.length === 0) return 0.5;

    const allStrengths = new Set();
    const allChallenges = new Set();

    academicContexts.forEach(context => {
      try {
        // Use actual database columns instead of context_data
        const strengthAreas = context.strength_areas ? JSON.parse(context.strength_areas) : [];
        const challengeAreas = context.challenge_areas ? JSON.parse(context.challenge_areas) : [];
        
        strengthAreas.forEach((area: string) => allStrengths.add(area));
        challengeAreas.forEach((area: string) => allChallenges.add(area));
      } catch {
        // Handle parsing errors gracefully
      }
    });

    const complementarityScore = Math.min((allStrengths.size + allChallenges.size) / 10, 1);
    return Math.max(0.3, complementarityScore);
  }

  private calculateMotivationAlignment(personas: any[], sharedInteractions: any[]): number {
    if (sharedInteractions.length === 0) return 0.5;

    const sentiments = sharedInteractions.map(i => i.sentiment_score || 0);
    const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const sentimentVariance = this.calculateVariance(sentiments);

    const alignmentScore = ((avgSentiment + 1) / 2) * 0.7 + (1 - sentimentVariance) * 0.3;
    return Math.max(0.2, Math.min(alignmentScore, 1));
  }

  private calculateCollaborationOutcomes(collaborationData: any, participants: string[]): any {
    const taskSuccessRate = this.estimateTaskSuccessRate(collaborationData);
    const learningGains = this.estimateLearningGains(collaborationData);
    const satisfactionLevel = this.estimateSatisfactionLevel(collaborationData);
    const retentionRate = this.estimateRetentionRate(collaborationData);

    return {
      taskSuccessRate,
      learningGains,
      satisfactionLevel,
      retentionRate
    };
  }

  private estimateTaskSuccessRate(collaborationData: any): number {
    const interactionCount = collaborationData.sharedInteractions.length;
    const avgEngagement = collaborationData.personas.reduce((sum: number, p: any) => {
      switch (p.engagement_level) {
        case 'high': return sum + 0.8;
        case 'medium': return sum + 0.5;
        case 'low': return sum + 0.2;
        default: return sum + 0.5;
      }
    }, 0) / collaborationData.personas.length;

    return Math.min((interactionCount / 10) * 0.4 + avgEngagement * 0.6, 1);
  }

  private estimateLearningGains(collaborationData: any): number {
    return 0.7; // Placeholder
  }

  private estimateSatisfactionLevel(collaborationData: any): number {
    return 0.8; // Placeholder
  }

  private estimateRetentionRate(collaborationData: any): number {
    return 0.9; // Placeholder
  }

  private calculateEffectivenessScore(compatibilityAnalysis: any, outcomeMetrics: any): number {
    const compatibilityWeight = 0.4;
    const outcomeWeight = 0.6;

    const avgCompatibility = (Object.values(compatibilityAnalysis).reduce((sum: number, val: any) => sum + Number(val), 0) as number) / Object.keys(compatibilityAnalysis).length;
    const avgOutcome = (Object.values(outcomeMetrics).reduce((sum: number, val: any) => sum + Number(val), 0) as number) / Object.keys(outcomeMetrics).length;

    return avgCompatibility * compatibilityWeight + avgOutcome * outcomeWeight;
  }

  private generateCollaborationImprovements(compatibilityAnalysis: any, outcomeMetrics: any): string[] {
    const improvements: string[] = [];

    if (compatibilityAnalysis.learningStyleMatch < 0.6) {
      improvements.push('Explore different learning approaches to accommodate various learning styles');
    }

    if (compatibilityAnalysis.communicationStyleMatch < 0.6) {
      improvements.push('Establish clear communication protocols and preferences');
    }

    if (compatibilityAnalysis.scheduleCompatibility < 0.5) {
      improvements.push('Coordinate schedules and find common available time slots');
    }

    if (outcomeMetrics.taskSuccessRate < 0.7) {
      improvements.push('Break down tasks into smaller, more manageable components');
    }

    return improvements.length > 0 ? improvements : ['Consider regular check-ins to maintain collaboration quality'];
  }

  private identifyCollaborationChallenges(compatibilityAnalysis: any, collaborationData: any): string[] {
    const challenges: string[] = [];

    if (compatibilityAnalysis.skillComplementarity < 0.4) {
      challenges.push('Limited skill diversity may impact problem-solving approaches');
    }

    if (compatibilityAnalysis.motivationAlignment < 0.5) {
      challenges.push('Different motivation levels may affect collaboration sustainability');
    }

    if (collaborationData.participantCount > 4) {
      challenges.push('Large group size may complicate coordination and communication');
    }

    return challenges;
  }

  private recommendCollaborationDuration(effectivenessScore: number, compatibilityAnalysis: any): string {
    if (effectivenessScore > 0.8) return '8-12 weeks';
    if (effectivenessScore > 0.6) return '4-8 weeks';
    if (effectivenessScore > 0.4) return '2-4 weeks';
    return '1-2 weeks (trial period)';
  }

  private calculateCollaborationConfidence(collaborationData: any, participants: string[]): number {
    let confidence = 0.5;

    if (collaborationData.personas.length === participants.length) confidence += 0.2;
    if (collaborationData.sharedInteractions.length > 5) confidence += 0.2;
    if (collaborationData.relationships.length > 0) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private storeCollaborationEffectiveness(analysis: CollaborationEffectiveness): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO collaboration_effectiveness (partnership_id, participants, collaboration_type, effectiveness_score, compatibility_analysis, outcome_metrics, improvements, potential_challenges, recommended_duration, analysis_date, confidence_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    stmt.run(
      analysis.partnershipId,
      JSON.stringify(analysis.participants),
      analysis.collaborationType,
      analysis.effectivenessScore,
      JSON.stringify(analysis.compatibilityAnalysis),
      JSON.stringify(analysis.outcomeMetrics),
      JSON.stringify(analysis.improvements),
      JSON.stringify(analysis.potentialChallenges),
      analysis.recommendedDuration,
      analysis.analysisDate,
      analysis.confidenceLevel
    );
  }

  // === SOCIAL SUPPORT NETWORK ANALYSIS ===

  async analyzeSocialSupportNetwork(userId: string, forceRefresh: boolean = false): Promise<SocialSupportNetwork> {
    logger.log('Analyzing social support network for: ' + userId);

    if (!forceRefresh) {
      const existingAnalysis = this.getRecentSupportAnalysis(userId);
      if (existingAnalysis) {
        logger.log('Using cached support network analysis for: ' + userId);
        return existingAnalysis;
      }
    }

    const networkData = await this.gatherSupportNetworkData(userId);
    const supportLevels = this.analyzeSupportLevels(networkData);
    const networkHealth = this.calculateNetworkHealth(networkData, supportLevels);
    const riskFactors = this.identifySupportRisks(networkData, supportLevels, networkHealth);
    const strengthFactors = this.identifySupportStrengths(networkData, supportLevels, networkHealth);
    const recommendations = this.generateSupportRecommendations(riskFactors, strengthFactors, networkHealth);
    const confidenceLevel = this.calculateSupportConfidence(networkData);

    const analysis: SocialSupportNetwork = {
      userId,
      supportLevels,
      networkHealth,
      riskFactors,
      strengthFactors,
      recommendations,
      analysisDate: new Date().toISOString(),
      confidenceLevel
    };

    this.storeSupportNetwork(analysis);

    logger.log('Support network analysis completed for ' + userId + ': ' + (networkHealth.diversityScore * 100).toFixed(1) + '% diversity');
    return analysis;
  }

  private getRecentSupportAnalysis(userId: string): SocialSupportNetwork | null {
    const stmt = this.db.prepare('SELECT * FROM social_support_networks WHERE user_id = ? AND analysis_date > datetime(?, \'-14 days\') ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(userId, 'now') as any;
    if (!row) return null;

    return {
      userId: row.user_id,
      supportLevels: JSON.parse(row.support_levels),
      networkHealth: JSON.parse(row.network_health),
      riskFactors: JSON.parse(row.risk_factors),
      strengthFactors: JSON.parse(row.strength_factors),
      recommendations: JSON.parse(row.recommendations),
      analysisDate: row.analysis_date,
      confidenceLevel: row.confidence_level
    };
  }

  private async gatherSupportNetworkData(userId: string): Promise<any> {
    const relationships = this.db.prepare('SELECT * FROM student_relationships WHERE student_user_id = ?').all(userId);
    const interactions = this.db.prepare('SELECT ih.*, sr.contact_type, sr.relationship_strength, sr.contact_name FROM interaction_history ih JOIN student_relationships sr ON ((ih.user_id = sr.student_user_id AND JSON_EXTRACT(ih.recipient_ids, ?) = sr.contact_user_id) OR (ih.user_id = sr.contact_user_id AND sr.student_user_id = ?)) WHERE sr.student_user_id = ? ORDER BY ih.created_at DESC').all('$[0]', userId, userId);
    const persona = this.db.prepare('SELECT * FROM student_personas WHERE user_id = ?').get(userId);

    return {
      relationships,
      interactions,
      persona,
      networkSize: relationships.length
    };
  }

  private analyzeSupportLevels(networkData: any): any {
    const academicSupport = this.analyzeSupportType(networkData, 'academic');
    const emotionalSupport = this.analyzeSupportType(networkData, 'emotional');
    const socialSupport = this.analyzeSupportType(networkData, 'social');
    const informationalSupport = this.analyzeSupportType(networkData, 'informational');

    return {
      academic: academicSupport,
      emotional: emotionalSupport,
      social: socialSupport,
      informational: informationalSupport
    };
  }

  private analyzeSupportType(networkData: any, supportType: string): SupportLevel {
    const relevantContacts = networkData.relationships.filter((rel: any) => {
      switch (supportType) {
        case 'academic':
          return rel.contact_type === 'instructor' || rel.contact_type === 'ta' || 
                 (rel.contact_type === 'peer' && rel.relationship_strength > 0.5);
        case 'emotional':
          return rel.contact_type === 'peer' || rel.contact_type === 'advisor';
        case 'social':
          return rel.contact_type === 'peer';
        case 'informational':
          return rel.contact_type === 'instructor' || rel.contact_type === 'ta' || 
                 rel.contact_type === 'advisor' || rel.contact_type === 'peer';
        default:
          return true;
      }
    });

    const availabilityScore = Math.min(relevantContacts.length / 3, 1);
    const qualityScore = relevantContacts.length > 0 ? 
      relevantContacts.reduce((sum: number, contact: any) => sum + (contact.relationship_strength || 0.5), 0) / relevantContacts.length :
      0;

    const supportInteractions = networkData.interactions.filter((int: any) => 
      relevantContacts.some((contact: any) => contact.contact_user_id === int.user_id)
    );
    const utilizationRate = Math.min(supportInteractions.length / 10, 1);

    const supporters: SupportProvider[] = relevantContacts.map((contact: any) => ({
      userId: contact.contact_user_id,
      name: contact.contact_name || contact.contact_type + ' contact',
      supportType: [supportType],
      relationship: contact.contact_type,
      availability: this.calculateAvailability(contact, networkData.interactions),
      effectiveness: contact.relationship_strength || 0.5
    }));

    return {
      availabilityScore,
      qualityScore,
      utilizationRate,
      supporters
    };
  }

  private calculateAvailability(contact: any, interactions: any[]): number {
    const contactInteractions = interactions.filter((int: any) => int.user_id === contact.contact_user_id);
    if (contactInteractions.length === 0) return 0.3;

    const recentInteractions = contactInteractions.filter((int: any) => 
      new Date(int.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    return Math.min(recentInteractions.length / 5, 1);
  }

  private calculateNetworkHealth(networkData: any, supportLevels: any): any {
    const supportTypes = Object.keys(supportLevels);
    const activeSupportTypes = supportTypes.filter(type => 
      supportLevels[type].availabilityScore > 0.2
    ).length;
    const diversityScore = activeSupportTypes / supportTypes.length;

    const redundancyScore = supportTypes.reduce((sum: number, type: string) => {
      return sum + Math.min(supportLevels[type].supporters.length / 2, 1);
    }, 0) / supportTypes.length;

    const avgAvailability = supportTypes.reduce((sum: number, type: string) => {
      return sum + supportLevels[type].availabilityScore;
    }, 0) / supportTypes.length;
    const accessibilityScore = avgAvailability;

    const reciprocityScore = 0.5; // Simplified

    return {
      diversityScore,
      redundancyScore,
      accessibilityScore,
      reciprocityScore
    };
  }

  private identifySupportRisks(networkData: any, supportLevels: any, networkHealth: any): string[] {
    const risks: string[] = [];

    if (networkHealth.diversityScore < 0.5) {
      risks.push('Limited diversity in support types');
    }

    if (networkData.networkSize < 3) {
      risks.push('Small support network size');
    }

    if (supportLevels.emotional.availabilityScore < 0.3) {
      risks.push('Weak emotional support network');
    }

    return risks;
  }

  private identifySupportStrengths(networkData: any, supportLevels: any, networkHealth: any): string[] {
    const strengths: string[] = [];

    if (networkHealth.diversityScore > 0.7) {
      strengths.push('Well-diversified support network');
    }

    if (supportLevels.academic.qualityScore > 0.6) {
      strengths.push('Strong academic support');
    }

    if (networkData.networkSize > 5) {
      strengths.push('Large support network');
    }

    return strengths;
  }

  private generateSupportRecommendations(riskFactors: string[], strengthFactors: string[], networkHealth: any): string[] {
    const recommendations: string[] = [];

    if (riskFactors.includes('Limited diversity in support types')) {
      recommendations.push('Seek connections across different relationship types');
    }

    if (riskFactors.includes('Small support network size')) {
      recommendations.push('Actively participate in study groups and campus activities');
    }

    if (networkHealth.reciprocityScore < 0.5) {
      recommendations.push('Focus on giving support to others to build reciprocal relationships');
    }

    return recommendations.length > 0 ? recommendations : ['Maintain regular contact with support network'];
  }

  private calculateSupportConfidence(networkData: any): number {
    let confidence = 0.5;

    if (networkData.networkSize > 3) confidence += 0.2;
    if (networkData.interactions.length > 10) confidence += 0.2;
    if (networkData.persona) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  private storeSupportNetwork(analysis: SocialSupportNetwork): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO social_support_networks (user_id, support_levels, network_health, risk_factors, strength_factors, recommendations, analysis_date, confidence_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    stmt.run(
      analysis.userId,
      JSON.stringify(analysis.supportLevels),
      JSON.stringify(analysis.networkHealth),
      JSON.stringify(analysis.riskFactors),
      JSON.stringify(analysis.strengthFactors),
      JSON.stringify(analysis.recommendations),
      analysis.analysisDate,
      analysis.confidenceLevel
    );
  }
} 