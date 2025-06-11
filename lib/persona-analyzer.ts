// Core Persona Analysis Engine
// This module analyzes Canvas interactions to build comprehensive student personas

import { PersonaDB, StudentPersona, InteractionHistoryEntry, StudentRelationship, AcademicContextData } from './database.js';
import { logger } from './logger.js';

export interface AnalysisResults {
  writingStyle: WritingStyleAnalysis;
  communicationPatterns: CommunicationPatternAnalysis;
  relationshipAnalysis: RelationshipAnalysis;
  academicBehavior: AcademicBehaviorAnalysis;
  confidence: number;
}

export interface WritingStyleAnalysis {
  avgMessageLength: number;
  avgDiscussionLength: number;
  formalityLevel: 'casual' | 'medium' | 'formal';
  vocabularyComplexity: 'simple' | 'medium' | 'complex';
  emojiUsageFrequency: number;
  punctuationStyle: { [key: string]: number };
  keyPhrases: string[];
  sentimentTrend: number;
  topicsOfInterest: string[];
}

export interface CommunicationPatternAnalysis {
  responseTimePattern: 'immediate' | 'quick' | 'thoughtful' | 'delayed';
  preferredInteractionTime: 'morning' | 'afternoon' | 'evening' | 'late';
  communicationFrequency: 'high' | 'medium' | 'low';
  peakActivityHours: number[];
  peakActivityDays: number[];
  interactionTypePreferences: { [key: string]: number };
}

export interface RelationshipAnalysis {
  relationships: Array<{
    contactId: string;
    contactName: string;
    contactType: 'peer' | 'instructor' | 'ta' | 'advisor';
    relationshipStrength: number;
    communicationStyle: string;
    topics: string[];
  }>;
  socialConnectedness: number;
  collaborationPreference: 'group_oriented' | 'independent' | 'mixed';
  networkDiversity: number;
}

export interface AcademicBehaviorAnalysis {
  engagementLevel: 'low' | 'medium' | 'high';
  participationStyle: 'proactive' | 'responsive' | 'observer';
  learningStyleIndicators: { [key: string]: number };
  strengthAreas: string[];
  challengeAreas: string[];
  workloadHandling: 'excellent' | 'good' | 'struggling';
}

export class PersonaAnalyzer {
  private personaDB: PersonaDB;

  constructor(personaDB: PersonaDB) {
    this.personaDB = personaDB;
  }

  static async create(): Promise<PersonaAnalyzer> {
    const personaDB = await PersonaDB.create();
    return new PersonaAnalyzer(personaDB);
  }

  /**
   * Comprehensive analysis of a student's persona based on all available data
   */
  async analyzeStudentPersona(userId: string): Promise<AnalysisResults> {
    logger.info(`Starting comprehensive persona analysis for user: ${userId}`);

    // Get all available data for the student
    const interactions = await this.personaDB.getRecentInteractions(userId, 200);
    const relationships = await this.personaDB.getRelationships(userId);
    const academicContext = await this.personaDB.getAcademicContext(userId);

    if (interactions.length === 0) {
      logger.warn(`No interactions found for user ${userId}`);
      return this.getDefaultAnalysis();
    }

    // Perform parallel analysis across all dimensions
    const [
      writingStyle,
      communicationPatterns,
      relationshipAnalysis,
      academicBehavior
    ] = await Promise.all([
      this.analyzeWritingStyle(interactions),
      this.analyzeCommunicationPatterns(interactions),
      this.analyzeRelationships(interactions, relationships),
      this.analyzeAcademicBehavior(interactions, academicContext)
    ]);

    // Calculate overall confidence based on data quantity and quality
    const confidence = this.calculateConfidence(interactions.length, relationships.length);

    const results: AnalysisResults = {
      writingStyle,
      communicationPatterns,
      relationshipAnalysis,
      academicBehavior,
      confidence
    };

    logger.info(`Persona analysis completed for user ${userId} with confidence: ${confidence}`);
    return results;
  }

  /**
   * Analyze writing style patterns from interactions
   */
  private async analyzeWritingStyle(interactions: InteractionHistoryEntry[]): Promise<WritingStyleAnalysis> {
    const messages = interactions.filter(i => i.interaction_type === 'message_sent');
    const discussions = interactions.filter(i => 
      i.interaction_type === 'discussion_post' || i.interaction_type === 'discussion_reply'
    );

    // Calculate average lengths
    const avgMessageLength = messages.length > 0 
      ? messages.reduce((sum, m) => sum + m.content_length, 0) / messages.length 
      : 0;
    
    const avgDiscussionLength = discussions.length > 0
      ? discussions.reduce((sum, d) => sum + d.content_length, 0) / discussions.length
      : 0;

    // Analyze formality level
    const formalityLevel = this.analyzeFormalityLevel(interactions);

    // Analyze vocabulary complexity
    const vocabularyComplexity = this.analyzeVocabularyComplexity(interactions);

    // Analyze emoji usage
    const emojiUsageFrequency = this.analyzeEmojiUsage(interactions);

    // Analyze punctuation patterns
    const punctuationStyle = this.analyzePunctuationStyle(interactions);

    // Extract key phrases and topics
    const keyPhrases = this.extractKeyPhrases(interactions);
    const topicsOfInterest = this.extractTopicsOfInterest(interactions);

    // Calculate sentiment trend
    const sentimentTrend = interactions.length > 0
      ? interactions
          .filter(i => i.sentiment_score !== null)
          .reduce((sum, i) => sum + (i.sentiment_score || 0), 0) / interactions.length
      : 0;

    return {
      avgMessageLength,
      avgDiscussionLength,
      formalityLevel,
      vocabularyComplexity,
      emojiUsageFrequency,
      punctuationStyle,
      keyPhrases,
      sentimentTrend,
      topicsOfInterest
    };
  }

  /**
   * Analyze communication timing and frequency patterns
   */
  private async analyzeCommunicationPatterns(interactions: InteractionHistoryEntry[]): Promise<CommunicationPatternAnalysis> {
    // Analyze response time patterns
    const responseTimePattern = this.analyzeResponseTimePattern(interactions);

    // Find preferred interaction times
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);

    interactions.forEach(interaction => {
      hourCounts[interaction.hour_of_day]++;
      dayCounts[interaction.day_of_week]++;
    });

    const peakActivityHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    const peakActivityDays = dayCounts
      .map((count, day) => ({ day, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(item => item.day);

    // Determine preferred interaction time
    const preferredInteractionTime = this.determinePreferredInteractionTime(peakActivityHours);

    // Calculate communication frequency
    const communicationFrequency = this.calculateCommunicationFrequency(interactions);

    // Analyze interaction type preferences
    const interactionTypePreferences = this.analyzeInteractionTypePreferences(interactions);

    return {
      responseTimePattern,
      preferredInteractionTime,
      communicationFrequency,
      peakActivityHours,
      peakActivityDays,
      interactionTypePreferences
    };
  }

  /**
   * Analyze relationship patterns and social connections
   */
  private async analyzeRelationships(
    interactions: InteractionHistoryEntry[], 
    existingRelationships: StudentRelationship[]
  ): Promise<RelationshipAnalysis> {
    // Build relationship map from interactions
    const relationshipMap = new Map<string, {
      count: number;
      topics: string[];
      communicationStyle: string;
      isPeer: boolean;
      isInstructor: boolean;
    }>();

    interactions.forEach(interaction => {
      if (interaction.recipient_ids && interaction.recipient_ids.length > 0) {
        interaction.recipient_ids.forEach(recipientId => {
          if (!relationshipMap.has(recipientId)) {
            relationshipMap.set(recipientId, {
              count: 0,
              topics: [],
              communicationStyle: 'neutral',
              isPeer: interaction.interaction_with_peers,
              isInstructor: interaction.interaction_with_instructors
            });
          }
          const rel = relationshipMap.get(recipientId)!;
          rel.count++;
          
          // Extract topics from content (simplified)
          const contentTopics = this.extractTopicsFromContent(interaction.content);
          rel.topics.push(...contentTopics);
        });
      }
    });

    // Convert to relationship analysis format
    const relationships = Array.from(relationshipMap.entries()).map(([contactId, data]) => {
      const existingRel = existingRelationships.find(r => r.contact_user_id === contactId);
      
      return {
        contactId,
        contactName: existingRel?.contact_name || `User ${contactId}`,
        contactType: this.determineContactType(data.isPeer, data.isInstructor),
        relationshipStrength: Math.min(data.count / 10, 1.0), // Normalize to 0-1
        communicationStyle: this.determineCommunicationStyle(contactId, interactions),
        topics: [...new Set(data.topics)].slice(0, 5) // Top 5 unique topics
      };
    });

    // Calculate social metrics
    const socialConnectedness = relationships.length > 0 
      ? relationships.reduce((sum, r) => sum + r.relationshipStrength, 0) / relationships.length 
      : 0;

    const collaborationPreference = this.determineCollaborationPreference(interactions);
    const networkDiversity = this.calculateNetworkDiversity(relationships);

    return {
      relationships,
      socialConnectedness,
      collaborationPreference,
      networkDiversity
    };
  }

  /**
   * Analyze academic behavior and learning patterns
   */
  private async analyzeAcademicBehavior(
    interactions: InteractionHistoryEntry[], 
    academicContext: AcademicContextData | null
  ): Promise<AcademicBehaviorAnalysis> {
    // Analyze engagement level based on interaction frequency and quality
    const engagementLevel = this.calculateEngagementLevel(interactions);

    // Determine participation style
    const participationStyle = this.determineParticipationStyle(interactions);

    // Analyze learning style indicators
    const learningStyleIndicators = this.analyzeLearningStyleIndicators(interactions);

    // Extract strength and challenge areas
    const strengthAreas = this.extractStrengthAreas(interactions, academicContext);
    const challengeAreas = this.extractChallengeAreas(interactions, academicContext);

    // Assess workload handling
    const workloadHandling = this.assessWorkloadHandling(interactions, academicContext);

    return {
      engagementLevel,
      participationStyle,
      learningStyleIndicators,
      strengthAreas,
      challengeAreas,
      workloadHandling
    };
  }

  // Helper methods for analysis calculations
  private analyzeFormalityLevel(interactions: InteractionHistoryEntry[]): 'casual' | 'medium' | 'formal' {
    const formalityScores = interactions
      .filter(i => i.formality_score !== null)
      .map(i => i.formality_score!);
    
    if (formalityScores.length === 0) return 'medium';
    
    const avgFormality = formalityScores.reduce((sum, score) => sum + score, 0) / formalityScores.length;
    
    if (avgFormality < 0.3) return 'casual';
    if (avgFormality > 0.7) return 'formal';
    return 'medium';
  }

  private analyzeVocabularyComplexity(interactions: InteractionHistoryEntry[]): 'simple' | 'medium' | 'complex' {
    const complexityScores = interactions
      .filter(i => i.complexity_score !== null)
      .map(i => i.complexity_score!);
    
    if (complexityScores.length === 0) return 'medium';
    
    const avgComplexity = complexityScores.reduce((sum, score) => sum + score, 0) / complexityScores.length;
    
    if (avgComplexity < 0.4) return 'simple';
    if (avgComplexity > 0.7) return 'complex';
    return 'medium';
  }

  private analyzeEmojiUsage(interactions: InteractionHistoryEntry[]): number {
    const totalCharacters = interactions.reduce((sum, i) => sum + i.content_length, 0);
    const emojiCount = interactions.reduce((sum, i) => {
      // Simple emoji detection (could be enhanced with proper emoji library)
      const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
      const matches = i.content.match(emojiRegex);
      return sum + (matches ? matches.length : 0);
    }, 0);
    
    return totalCharacters > 0 ? emojiCount / totalCharacters : 0;
  }

  private analyzePunctuationStyle(interactions: InteractionHistoryEntry[]): { [key: string]: number } {
    const punctuationCounts = {
      period: 0,
      comma: 0,
      exclamation: 0,
      question: 0,
      semicolon: 0,
      colon: 0
    };

    const totalCharacters = interactions.reduce((sum, i) => sum + i.content_length, 0);

    interactions.forEach(interaction => {
      punctuationCounts.period += (interaction.content.match(/\./g) || []).length;
      punctuationCounts.comma += (interaction.content.match(/,/g) || []).length;
      punctuationCounts.exclamation += (interaction.content.match(/!/g) || []).length;
      punctuationCounts.question += (interaction.content.match(/\?/g) || []).length;
      punctuationCounts.semicolon += (interaction.content.match(/;/g) || []).length;
      punctuationCounts.colon += (interaction.content.match(/:/g) || []).length;
    });

    // Normalize to frequencies
    const totalPunctuation = Object.values(punctuationCounts).reduce((sum, count) => sum + count, 0);
    const result: { [key: string]: number } = {};
    
    Object.entries(punctuationCounts).forEach(([key, count]) => {
      result[key] = totalPunctuation > 0 ? count / totalPunctuation : 0;
    });

    return result;
  }

  private extractKeyPhrases(interactions: InteractionHistoryEntry[]): string[] {
    // Simple key phrase extraction (could be enhanced with NLP)
    const allContent = interactions.map(i => i.content.toLowerCase()).join(' ');
    
    const commonPhrases = [
      'i think', 'in my opinion', 'i believe', 'it seems', 'i feel',
      'based on', 'according to', 'from my perspective', 'i understand',
      'let me know', 'thank you', 'please help', 'i need', 'can you'
    ];

    return commonPhrases.filter(phrase => allContent.includes(phrase));
  }

  private extractTopicsOfInterest(interactions: InteractionHistoryEntry[]): string[] {
    // Extract topics from course names and content
    const topics = new Set<string>();
    
    interactions.forEach(interaction => {
      if (interaction.course_name) {
        // Extract subject codes and topics from course names
        const courseTopics = this.extractTopicsFromCourseName(interaction.course_name);
        courseTopics.forEach(topic => topics.add(topic));
      }
      
      // Extract topics from content
      const contentTopics = this.extractTopicsFromContent(interaction.content);
      contentTopics.forEach(topic => topics.add(topic));
    });

    return Array.from(topics).slice(0, 10); // Top 10 topics
  }

  private extractTopicsFromCourseName(courseName: string): string[] {
    const topics: string[] = [];
    
    // Common academic subject mappings
    const subjectMappings: { [key: string]: string[] } = {
      'AA': ['african american studies', 'cultural studies'],
      'CS': ['computer science', 'programming', 'technology'],
      'MATH': ['mathematics', 'statistics', 'analytics'],
      'ENG': ['english', 'literature', 'writing'],
      'HIST': ['history', 'social studies'],
      'PSYC': ['psychology', 'human behavior'],
      'BIOL': ['biology', 'life sciences'],
      'CHEM': ['chemistry', 'laboratory sciences'],
      'PHYS': ['physics', 'physical sciences']
    };

    Object.entries(subjectMappings).forEach(([code, topicList]) => {
      if (courseName.toUpperCase().includes(code)) {
        topics.push(...topicList);
      }
    });

    return topics;
  }

  private extractTopicsFromContent(content: string): string[] {
    // Simple topic extraction based on keywords
    const topics: string[] = [];
    const keywords = [
      'technology', 'research', 'analysis', 'project', 'study', 'learning',
      'collaboration', 'discussion', 'assignment', 'presentation', 'writing',
      'mathematics', 'science', 'literature', 'history', 'psychology'
    ];

    const lowerContent = content.toLowerCase();
    keywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        topics.push(keyword);
      }
    });

    return topics;
  }

  // Additional helper methods...
  private analyzeResponseTimePattern(interactions: InteractionHistoryEntry[]): 'immediate' | 'quick' | 'thoughtful' | 'delayed' {
    // This would ideally analyze time between related messages
    // For now, return a default based on interaction frequency
    const recentInteractions = interactions.filter(i => {
      const interactionDate = new Date(i.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return interactionDate > weekAgo;
    });

    if (recentInteractions.length > 10) return 'immediate';
    if (recentInteractions.length > 5) return 'quick';
    if (recentInteractions.length > 2) return 'thoughtful';
    return 'delayed';
  }

  private determinePreferredInteractionTime(peakHours: number[]): 'morning' | 'afternoon' | 'evening' | 'late' {
    const avgHour = peakHours.reduce((sum, hour) => sum + hour, 0) / peakHours.length;
    
    if (avgHour < 12) return 'morning';
    if (avgHour < 17) return 'afternoon';
    if (avgHour < 22) return 'evening';
    return 'late';
  }

  private calculateCommunicationFrequency(interactions: InteractionHistoryEntry[]): 'high' | 'medium' | 'low' {
    const daysWithInteractions = new Set(
      interactions.map(i => new Date(i.created_at).toDateString())
    ).size;

    if (daysWithInteractions > 10) return 'high';
    if (daysWithInteractions > 3) return 'medium';
    return 'low';
  }

  private analyzeInteractionTypePreferences(interactions: InteractionHistoryEntry[]): { [key: string]: number } {
    const typeCounts: { [key: string]: number } = {};
    
    interactions.forEach(interaction => {
      typeCounts[interaction.interaction_type] = (typeCounts[interaction.interaction_type] || 0) + 1;
    });

    const total = interactions.length;
    const preferences: { [key: string]: number } = {};
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      preferences[type] = count / total;
    });

    return preferences;
  }

  private determineContactType(isPeer: boolean, isInstructor: boolean): 'peer' | 'instructor' | 'ta' | 'advisor' {
    if (isInstructor) return 'instructor';
    if (isPeer) return 'peer';
    return 'ta'; // Default assumption
  }

  private determineCommunicationStyle(contactId: string, interactions: InteractionHistoryEntry[]): string {
    const contactInteractions = interactions.filter(i => 
      i.recipient_ids && i.recipient_ids.includes(contactId)
    );

    if (contactInteractions.length === 0) return 'neutral';

    const avgFormality = contactInteractions
      .filter(i => i.formality_score !== null)
      .reduce((sum, i) => sum + (i.formality_score || 0), 0) / contactInteractions.length;

    if (avgFormality > 0.7) return 'formal';
    if (avgFormality < 0.3) return 'casual';
    return 'friendly';
  }

  private determineCollaborationPreference(interactions: InteractionHistoryEntry[]): 'group_oriented' | 'independent' | 'mixed' {
    const groupInteractions = interactions.filter(i => i.is_group_work).length;
    const totalInteractions = interactions.length;
    
    if (totalInteractions === 0) return 'mixed';
    
    const groupRatio = groupInteractions / totalInteractions;
    
    if (groupRatio > 0.6) return 'group_oriented';
    if (groupRatio < 0.2) return 'independent';
    return 'mixed';
  }

  private calculateNetworkDiversity(relationships: Array<{contactType: string}>): number {
    const types = new Set(relationships.map(r => r.contactType));
    return types.size / 4; // Normalize by max possible types (peer, instructor, ta, advisor)
  }

  private calculateEngagementLevel(interactions: InteractionHistoryEntry[]): 'low' | 'medium' | 'high' {
    const avgContentLength = interactions.reduce((sum, i) => sum + i.content_length, 0) / interactions.length;
    const interactionFrequency = interactions.length;
    
    const engagementScore = (avgContentLength / 100) + (interactionFrequency / 10);
    
    if (engagementScore > 2) return 'high';
    if (engagementScore > 1) return 'medium';
    return 'low';
  }

  private determineParticipationStyle(interactions: InteractionHistoryEntry[]): 'proactive' | 'responsive' | 'observer' {
    const initiatedDiscussions = interactions.filter(i => i.interaction_type === 'discussion_post').length;
    const replies = interactions.filter(i => i.interaction_type === 'discussion_reply').length;
    const total = interactions.length;
    
    if (total === 0) return 'observer';
    
    const initiationRatio = initiatedDiscussions / total;
    const responseRatio = replies / total;
    
    if (initiationRatio > 0.3) return 'proactive';
    if (responseRatio > 0.4) return 'responsive';
    return 'observer';
  }

  private analyzeLearningStyleIndicators(interactions: InteractionHistoryEntry[]): { [key: string]: number } {
    // Simplified learning style analysis based on content patterns
    const indicators = {
      visual: 0,
      auditory: 0,
      kinesthetic: 0,
      reading: 0
    };

    const totalInteractions = interactions.length;
    if (totalInteractions === 0) return indicators;

    interactions.forEach(interaction => {
      const content = interaction.content.toLowerCase();
      
      // Visual indicators
      if (content.includes('see') || content.includes('show') || content.includes('picture') || content.includes('diagram')) {
        indicators.visual += 1;
      }
      
      // Auditory indicators
      if (content.includes('hear') || content.includes('listen') || content.includes('discuss') || content.includes('talk')) {
        indicators.auditory += 1;
      }
      
      // Kinesthetic indicators
      if (content.includes('do') || content.includes('practice') || content.includes('hands-on') || content.includes('try')) {
        indicators.kinesthetic += 1;
      }
      
      // Reading/writing indicators
      if (content.includes('read') || content.includes('write') || content.includes('text') || content.includes('note')) {
        indicators.reading += 1;
      }
    });

    // Normalize to percentages
    const total = Object.values(indicators).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      Object.keys(indicators).forEach(key => {
        indicators[key as keyof typeof indicators] = indicators[key as keyof typeof indicators] / total;
      });
    }

    return indicators;
  }

  private extractStrengthAreas(interactions: InteractionHistoryEntry[], academicContext: AcademicContextData | null): string[] {
    const strengths: string[] = [];
    
    // Analyze from academic context if available
    if (academicContext && academicContext.strength_areas) {
      strengths.push(...academicContext.strength_areas);
    }

    // Infer from interaction patterns
    const topicFrequency = new Map<string, number>();
    interactions.forEach(interaction => {
      const topics = this.extractTopicsFromContent(interaction.content);
      topics.forEach(topic => {
        topicFrequency.set(topic, (topicFrequency.get(topic) || 0) + 1);
      });
    });

    // Top engaging topics could indicate strengths
    const topTopics = Array.from(topicFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    strengths.push(...topTopics);

    return [...new Set(strengths)]; // Remove duplicates
  }

  private extractChallengeAreas(interactions: InteractionHistoryEntry[], academicContext: AcademicContextData | null): string[] {
    const challenges: string[] = [];
    
    // From academic context
    if (academicContext && academicContext.challenge_areas) {
      challenges.push(...academicContext.challenge_areas);
    }

    // Infer from interaction sentiment in specific topics
    const lowSentimentTopics: string[] = [];
    interactions.forEach(interaction => {
      if (interaction.sentiment_score && interaction.sentiment_score < -0.2) {
        const topics = this.extractTopicsFromContent(interaction.content);
        lowSentimentTopics.push(...topics);
      }
    });

    challenges.push(...lowSentimentTopics);

    return [...new Set(challenges)]; // Remove duplicates
  }

  private assessWorkloadHandling(interactions: InteractionHistoryEntry[], academicContext: AcademicContextData | null): 'excellent' | 'good' | 'struggling' {
    // Use academic context workload level if available
    if (academicContext) {
      switch (academicContext.current_workload_level) {
        case 'light': return 'excellent';
        case 'moderate': return 'good';
        case 'heavy': return 'good';
        case 'overwhelming': return 'struggling';
      }
    }

    // Infer from interaction patterns
    const recentInteractions = interactions.filter(i => {
      const interactionDate = new Date(i.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return interactionDate > weekAgo;
    });

    const avgSentiment = recentInteractions
      .filter(i => i.sentiment_score !== null)
      .reduce((sum, i) => sum + (i.sentiment_score || 0), 0) / recentInteractions.length;

    if (avgSentiment > 0.2) return 'excellent';
    if (avgSentiment > -0.1) return 'good';
    return 'struggling';
  }

  private calculateConfidence(interactionCount: number, relationshipCount: number): number {
    // Confidence based on data availability
    const dataPoints = interactionCount + (relationshipCount * 2);
    
    // Normalize to 0-1 scale
    const maxPoints = 100; // Arbitrary maximum for full confidence
    return Math.min(dataPoints / maxPoints, 1.0);
  }

  private getDefaultAnalysis(): AnalysisResults {
    return {
      writingStyle: {
        avgMessageLength: 0,
        avgDiscussionLength: 0,
        formalityLevel: 'medium',
        vocabularyComplexity: 'medium',
        emojiUsageFrequency: 0,
        punctuationStyle: {},
        keyPhrases: [],
        sentimentTrend: 0,
        topicsOfInterest: []
      },
      communicationPatterns: {
        responseTimePattern: 'thoughtful',
        preferredInteractionTime: 'evening',
        communicationFrequency: 'medium',
        peakActivityHours: [],
        peakActivityDays: [],
        interactionTypePreferences: {}
      },
      relationshipAnalysis: {
        relationships: [],
        socialConnectedness: 0,
        collaborationPreference: 'mixed',
        networkDiversity: 0
      },
      academicBehavior: {
        engagementLevel: 'medium',
        participationStyle: 'observer',
        learningStyleIndicators: {},
        strengthAreas: [],
        challengeAreas: [],
        workloadHandling: 'good'
      },
      confidence: 0.0
    };
  }

  /**
   * Update student persona with analysis results
   */
  async updatePersonaFromAnalysis(userId: string, analysis: AnalysisResults): Promise<void> {
    const personaData: Partial<StudentPersona> = {
      avg_message_length: Math.round(analysis.writingStyle.avgMessageLength),
      avg_discussion_length: Math.round(analysis.writingStyle.avgDiscussionLength),
      formality_level: analysis.writingStyle.formalityLevel,
      vocabulary_complexity: analysis.writingStyle.vocabularyComplexity,
      emoji_usage_frequency: analysis.writingStyle.emojiUsageFrequency,
      punctuation_style: analysis.writingStyle.punctuationStyle,
      response_time_pattern: analysis.communicationPatterns.responseTimePattern,
      preferred_interaction_time: analysis.communicationPatterns.preferredInteractionTime,
      communication_frequency: analysis.communicationPatterns.communicationFrequency,
      engagement_level: analysis.academicBehavior.engagementLevel,
      participation_style: analysis.academicBehavior.participationStyle,
      collaboration_preference: analysis.relationshipAnalysis.collaborationPreference,
      topics_of_interest: analysis.writingStyle.topicsOfInterest,
      learning_style_indicators: analysis.academicBehavior.learningStyleIndicators,
      total_interactions_analyzed: 0, // Will be set by caller
      confidence_score: analysis.confidence
    };

    await this.personaDB.createOrUpdatePersona(userId, personaData);
    logger.info(`Persona updated for user ${userId} with confidence ${analysis.confidence}`);
  }
} 