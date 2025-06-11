// Context Integration Engine
// This module combines persona data with current Canvas context to provide intelligent, personalized responses

import { PersonaDB, StudentPersona, AcademicContextData } from './database.js';
import { PersonaAnalyzer, AnalysisResults } from './persona-analyzer.js';
import { logger } from './logger.js';

export interface PersonalizedContext {
  studentProfile: StudentProfileSummary;
  currentSituation: CurrentAcademicSituation;
  communicationPreferences: CommunicationPreferences;
  relationshipContext: RelationshipContext;
  responseGuidance: ResponseGuidance;
}

export interface StudentProfileSummary {
  name: string;
  userId: string;
  engagementLevel: 'low' | 'medium' | 'high';
  learningStyle: string;
  academicStrengths: string[];
  currentChallenges: string[];
  interestAreas: string[];
  confidenceLevel: number;
}

export interface CurrentAcademicSituation {
  activeCourses: Array<{
    id: string;
    name: string;
    currentGrade?: string;
    recentActivity: string;
  }>;
  upcomingDeadlines: Array<{
    type: string;
    name: string;
    dueDate: string;
    urgency: 'low' | 'medium' | 'high';
    course: string;
  }>;
  recentSubmissions: Array<{
    type: string;
    name: string;
    submittedDate: string;
    course: string;
  }>;
  workloadStatus: 'light' | 'moderate' | 'heavy' | 'overwhelming';
  stressIndicators: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

export interface CommunicationPreferences {
  preferredTone: 'casual' | 'friendly' | 'professional' | 'formal';
  preferredLength: 'brief' | 'moderate' | 'detailed';
  includeEmojis: boolean;
  formalityLevel: number; // 0-1
  supportLevel: 'minimal' | 'moderate' | 'high';
  encouragementStyle: 'subtle' | 'direct' | 'enthusiastic';
}

export interface RelationshipContext {
  primaryContacts: Array<{
    name: string;
    role: 'peer' | 'instructor' | 'ta' | 'advisor';
    relationshipStrength: number;
    communicationStyle: string;
    suggestedMentions?: boolean;
  }>;
  collaborationOpportunities: string[];
  socialConnectedness: number;
  recommendedApproach: string;
}

export interface ResponseGuidance {
  writingStyleSuggestions: {
    averageLength: number;
    vocabularyLevel: string;
    sentimentTarget: number;
    keyPhrasesToInclude: string[];
    punctuationGuidance: string;
  };
  contentGuidance: {
    topicsToEmphasize: string[];
    learningStyleAdaptations: string[];
    motivationalElements: string[];
    supportElements: string[];
  };
  interactionGuidance: {
    bestTimingHint: string;
    responseUrgency: 'immediate' | 'timely' | 'thoughtful';
    followUpSuggestions: string[];
  };
}

export class ContextEngine {
  private personaDB: PersonaDB;
  private personaAnalyzer: PersonaAnalyzer;

  constructor(personaDB: PersonaDB, personaAnalyzer: PersonaAnalyzer) {
    this.personaDB = personaDB;
    this.personaAnalyzer = personaAnalyzer;
  }

  static async create(): Promise<ContextEngine> {
    const personaDB = await PersonaDB.create();
    const personaAnalyzer = await PersonaAnalyzer.create();
    return new ContextEngine(personaDB, personaAnalyzer);
  }

  /**
   * Generate comprehensive personalized context for a student
   */
  async generatePersonalizedContext(userId: string, contextType?: string): Promise<PersonalizedContext> {
    logger.info(`Generating personalized context for user: ${userId}`);

    // Get or create student persona
    let persona = await this.personaDB.getPersona(userId);
    
    if (!persona || persona.confidence_score < 0.3) {
      logger.info(`Low confidence persona found for ${userId}, running fresh analysis`);
      const analysis = await this.personaAnalyzer.analyzeStudentPersona(userId);
      await this.personaAnalyzer.updatePersonaFromAnalysis(userId, analysis);
      persona = await this.personaDB.getPersona(userId);
    }

    // Get current academic context
    const academicContext = await this.personaDB.getAcademicContext(userId);

    // Get relationships
    const relationships = await this.personaDB.getRelationships(userId);

    // Build comprehensive context
    const personalizedContext: PersonalizedContext = {
      studentProfile: this.buildStudentProfile(persona!, academicContext),
      currentSituation: this.buildCurrentSituation(academicContext),
      communicationPreferences: this.buildCommunicationPreferences(persona!),
      relationshipContext: this.buildRelationshipContext(relationships),
      responseGuidance: this.buildResponseGuidance(persona!, academicContext, contextType)
    };

    logger.info(`Personalized context generated for ${userId} with confidence: ${persona?.confidence_score}`);
    return personalizedContext;
  }

  /**
   * Generate context-aware response suggestions
   */
  async generateResponseSuggestions(
    userId: string, 
    inputText: string, 
    responseType: 'message' | 'discussion' | 'email' = 'message'
  ): Promise<{
    suggestedResponse: string;
    alternativeResponses: string[];
    stylingTips: string[];
    contextualNotes: string[];
  }> {
    const context = await this.generatePersonalizedContext(userId, responseType);
    
    // Analyze input to understand intent
    const intent = this.analyzeInputIntent(inputText);
    
    // Generate response based on persona and context
    const suggestedResponse = this.generatePersonalizedResponse(inputText, context, responseType, intent);
    
    // Generate alternatives with different approaches
    const alternativeResponses = this.generateAlternativeResponses(inputText, context, responseType);
    
    // Provide styling guidance
    const stylingTips = this.generateStylingTips(context);
    
    // Add contextual notes
    const contextualNotes = this.generateContextualNotes(context, intent);

    return {
      suggestedResponse,
      alternativeResponses,
      stylingTips,
      contextualNotes
    };
  }

  private buildStudentProfile(persona: StudentPersona, academicContext: AcademicContextData | null): StudentProfileSummary {
    return {
      name: persona.display_name || `User ${persona.user_id}`,
      userId: persona.user_id,
      engagementLevel: persona.engagement_level,
      learningStyle: this.describeLearningStyle(persona.learning_style_indicators),
      academicStrengths: academicContext?.strength_areas || [],
      currentChallenges: academicContext?.challenge_areas || [],
      interestAreas: persona.topics_of_interest,
      confidenceLevel: persona.confidence_score
    };
  }

  private buildCurrentSituation(academicContext: AcademicContextData | null): CurrentAcademicSituation {
    if (!academicContext) {
      return {
        activeCourses: [],
        upcomingDeadlines: [],
        recentSubmissions: [],
        workloadStatus: 'moderate',
        stressIndicators: { level: 'medium', factors: ['Unknown academic status'] }
      };
    }

    return {
      activeCourses: academicContext.current_courses.map(course => ({
        id: course.id || '',
        name: course.name || 'Unknown Course',
        currentGrade: course.grade || undefined,
        recentActivity: 'Active participation'
      })),
      upcomingDeadlines: academicContext.upcoming_deadlines.map(deadline => ({
        type: deadline.type || 'assignment',
        name: deadline.name || 'Unnamed',
        dueDate: deadline.due_date || '',
        urgency: this.calculateUrgency(deadline.due_date),
        course: deadline.course_name || deadline.course_id || 'Unknown'
      })),
      recentSubmissions: academicContext.recent_submissions.map(submission => ({
        type: submission.type || 'submission',
        name: submission.name || 'Unnamed',
        submittedDate: submission.submitted_date || '',
        course: submission.course_name || 'Unknown'
      })),
      workloadStatus: academicContext.current_workload_level,
      stressIndicators: {
        level: this.calculateStressLevel(academicContext.current_stress_indicators),
        factors: this.extractStressFactors(academicContext.current_stress_indicators)
      }
    };
  }

  private buildCommunicationPreferences(persona: StudentPersona): CommunicationPreferences {
    const formalityMap = {
      'casual': 0.2,
      'medium': 0.5,
      'formal': 0.8
    };

    const preferredTone = this.determineTone(persona.formality_level, persona.engagement_level);
    const preferredLength = this.determinePreferredLength(persona.avg_message_length, persona.avg_discussion_length);
    
    return {
      preferredTone,
      preferredLength,
      includeEmojis: persona.emoji_usage_frequency > 0.02,
      formalityLevel: formalityMap[persona.formality_level],
      supportLevel: this.determineSupportLevel(persona.engagement_level),
      encouragementStyle: this.determineEncouragementStyle(persona.participation_style)
    };
  }

  private buildRelationshipContext(relationships: any[]): RelationshipContext {
    const primaryContacts = relationships
      .sort((a, b) => b.relationship_strength - a.relationship_strength)
      .slice(0, 5)
      .map(rel => ({
        name: rel.contact_name || `User ${rel.contact_user_id}`,
        role: rel.contact_type,
        relationshipStrength: rel.relationship_strength,
        communicationStyle: rel.communication_style_with_contact || 'neutral',
        suggestedMentions: rel.relationship_strength > 0.6
      }));

    const socialConnectedness = relationships.length > 0 
      ? relationships.reduce((sum, rel) => sum + rel.relationship_strength, 0) / relationships.length
      : 0;

    return {
      primaryContacts,
      collaborationOpportunities: this.identifyCollaborationOpportunities(relationships),
      socialConnectedness,
      recommendedApproach: this.recommendCommunicationApproach(socialConnectedness, relationships)
    };
  }

  private buildResponseGuidance(
    persona: StudentPersona, 
    academicContext: AcademicContextData | null, 
    contextType?: string
  ): ResponseGuidance {
    return {
      writingStyleSuggestions: {
        averageLength: this.calculateTargetLength(persona, contextType),
        vocabularyLevel: persona.vocabulary_complexity,
        sentimentTarget: this.calculateTargetSentiment(persona, academicContext),
        keyPhrasesToInclude: this.suggestKeyPhrases(persona),
        punctuationGuidance: this.generatePunctuationGuidance(persona.punctuation_style)
      },
      contentGuidance: {
        topicsToEmphasize: persona.topics_of_interest.slice(0, 3),
        learningStyleAdaptations: this.generateLearningStyleAdaptations(persona.learning_style_indicators),
        motivationalElements: this.generateMotivationalElements(persona, academicContext),
        supportElements: this.generateSupportElements(persona, academicContext)
      },
      interactionGuidance: {
        bestTimingHint: this.generateTimingHint(persona.preferred_interaction_time),
        responseUrgency: this.determineResponseUrgency(persona.response_time_pattern),
        followUpSuggestions: this.generateFollowUpSuggestions(persona, academicContext)
      }
    };
  }

  private generatePersonalizedResponse(
    inputText: string, 
    context: PersonalizedContext, 
    responseType: string, 
    intent: string
  ): string {
    const { studentProfile, communicationPreferences, currentSituation } = context;

    // Start with base response structure
    let response = '';

    // Add appropriate greeting based on formality
    if (communicationPreferences.preferredTone === 'casual') {
      response += 'Hey! ';
    } else if (communicationPreferences.preferredTone === 'formal') {
      response += 'Hello, ';
    } else {
      response += 'Hi! ';
    }

    // Add personalized content based on intent and context
    if (intent.includes('help') || intent.includes('question')) {
      response += this.generateHelpResponse(inputText, context);
    } else if (intent.includes('share') || intent.includes('update')) {
      response += this.generateShareResponse(inputText, context);
    } else if (intent.includes('collaborate')) {
      response += this.generateCollaborationResponse(inputText, context);
    } else {
      response += this.generateGeneralResponse(inputText, context);
    }

    // Add supportive elements based on current situation
    if (currentSituation.workloadStatus === 'overwhelming') {
      response += ' I know things are pretty busy right now, so don\'t hesitate to reach out if you need any support!';
    }

    // Add emoji if preferred
    if (communicationPreferences.includeEmojis) {
      response = this.addAppropriateEmojis(response, responseType);
    }

    // Adjust length to preference
    response = this.adjustResponseLength(response, communicationPreferences.preferredLength);

    return response;
  }

  private generateAlternativeResponses(
    inputText: string, 
    context: PersonalizedContext, 
    responseType: string
  ): string[] {
    const alternatives: string[] = [];

    // Generate more formal alternative
    const formalContext = { 
      ...context, 
      communicationPreferences: { 
        ...context.communicationPreferences, 
        preferredTone: 'formal' as const,
        includeEmojis: false 
      } 
    };
    alternatives.push(this.generatePersonalizedResponse(inputText, formalContext, responseType, 'general'));

    // Generate more casual alternative
    const casualContext = { 
      ...context, 
      communicationPreferences: { 
        ...context.communicationPreferences, 
        preferredTone: 'casual' as const,
        includeEmojis: true 
      } 
    };
    alternatives.push(this.generatePersonalizedResponse(inputText, casualContext, responseType, 'general'));

    // Generate brief alternative
    const briefContext = { 
      ...context, 
      communicationPreferences: { 
        ...context.communicationPreferences, 
        preferredLength: 'brief' as const 
      } 
    };
    alternatives.push(this.generatePersonalizedResponse(inputText, briefContext, responseType, 'general'));

    return alternatives.filter((alt, index, arr) => arr.indexOf(alt) === index); // Remove duplicates
  }

  // Helper methods for context building
  private describeLearningStyle(indicators: { [key: string]: number }): string {
    const maxIndicator = Object.entries(indicators).reduce((a, b) => 
      indicators[a[0]] > indicators[b[0]] ? a : b, ['mixed', 0]
    );
    
    if (maxIndicator[1] > 0.4) {
      return `${maxIndicator[0]}-oriented learner`;
    }
    return 'multi-modal learner';
  }

  private calculateUrgency(dueDate: string): 'low' | 'medium' | 'high' {
    if (!dueDate) return 'medium';
    
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 2) return 'high';
    if (daysUntilDue <= 7) return 'medium';
    return 'low';
  }

  private calculateStressLevel(stressIndicators: any): 'low' | 'medium' | 'high' {
    if (!stressIndicators || typeof stressIndicators !== 'object') return 'medium';
    
    const values = Object.values(stressIndicators);
    const avgStress = values.reduce((sum: number, val) => sum + (Number(val) || 0), 0) / values.length;
    
    if (avgStress > 0.7) return 'high';
    if (avgStress > 0.4) return 'medium';
    return 'low';
  }

  private extractStressFactors(stressIndicators: any): string[] {
    if (!stressIndicators || typeof stressIndicators !== 'object') return [];
    
    return Object.entries(stressIndicators)
      .filter(([_, value]) => Number(value) > 0.5)
      .map(([factor]) => factor);
  }

  private determineTone(formalityLevel: string, engagementLevel: string): 'casual' | 'friendly' | 'professional' | 'formal' {
    if (formalityLevel === 'formal') return 'formal';
    if (formalityLevel === 'casual' && engagementLevel === 'high') return 'casual';
    if (engagementLevel === 'high') return 'friendly';
    return 'professional';
  }

  private determinePreferredLength(avgMessage: number, avgDiscussion: number): 'brief' | 'moderate' | 'detailed' {
    const avgLength = (avgMessage + avgDiscussion) / 2;
    
    if (avgLength > 200) return 'detailed';
    if (avgLength > 75) return 'moderate';
    return 'brief';
  }

  private determineSupportLevel(engagementLevel: string): 'minimal' | 'moderate' | 'high' {
    switch (engagementLevel) {
      case 'high': return 'moderate';
      case 'medium': return 'moderate';
      case 'low': return 'high';
      default: return 'moderate';
    }
  }

  private determineEncouragementStyle(participationStyle?: string): 'subtle' | 'direct' | 'enthusiastic' {
    switch (participationStyle) {
      case 'proactive': return 'enthusiastic';
      case 'responsive': return 'direct';
      case 'observer': return 'subtle';
      default: return 'direct';
    }
  }

  private identifyCollaborationOpportunities(relationships: any[]): string[] {
    const opportunities: string[] = [];
    
    const strongPeerRelationships = relationships.filter(
      rel => rel.contact_type === 'peer' && rel.relationship_strength > 0.5
    );
    
    if (strongPeerRelationships.length > 0) {
      opportunities.push('Study group formation');
      opportunities.push('Peer collaboration projects');
    }
    
    const instructorRelationships = relationships.filter(rel => rel.contact_type === 'instructor');
    if (instructorRelationships.length > 0) {
      opportunities.push('Office hours discussions');
      opportunities.push('Research opportunities');
    }
    
    return opportunities;
  }

  private recommendCommunicationApproach(socialConnectedness: number, relationships: any[]): string {
    if (socialConnectedness > 0.7) {
      return 'Leverage your strong network for collaborative learning';
    } else if (socialConnectedness > 0.4) {
      return 'Continue building relationships while maintaining current connections';
    } else {
      return 'Focus on building stronger connections with peers and instructors';
    }
  }

  private calculateTargetLength(persona: StudentPersona, contextType?: string): number {
    let baseLength = persona.avg_message_length;
    
    if (contextType === 'discussion') {
      baseLength = persona.avg_discussion_length;
    }
    
    // Ensure reasonable bounds
    return Math.max(50, Math.min(300, baseLength));
  }

  private calculateTargetSentiment(persona: StudentPersona, academicContext: AcademicContextData | null): number {
    // Base positive sentiment, adjusted for current stress
    let targetSentiment = 0.2;
    
    if (academicContext?.current_stress_indicators) {
      const stressLevel = this.calculateStressLevel(academicContext.current_stress_indicators);
      if (stressLevel === 'high') targetSentiment = 0.4; // More positive for stressed students
    }
    
    return targetSentiment;
  }

  private suggestKeyPhrases(persona: StudentPersona): string[] {
    const phrases: string[] = [];
    
    // Add phrases based on engagement level
    if (persona.engagement_level === 'high') {
      phrases.push('I\'m excited about', 'I\'d love to explore', 'This is really interesting');
    } else if (persona.engagement_level === 'low') {
      phrases.push('I\'m working on understanding', 'Could you help me', 'I\'m learning about');
    }
    
    // Add phrases based on participation style
    if (persona.participation_style === 'proactive') {
      phrases.push('I\'d like to suggest', 'What if we', 'I think we could');
    }
    
    return phrases;
  }

  private generatePunctuationGuidance(punctuationStyle?: { [key: string]: number }): string {
    if (!punctuationStyle) return 'Use standard punctuation';
    
    const guidance: string[] = [];
    
    if (punctuationStyle.exclamation > 0.1) {
      guidance.push('Use exclamation points for enthusiasm');
    }
    if (punctuationStyle.question > 0.1) {
      guidance.push('Ask questions to encourage engagement');
    }
    
    return guidance.join(', ') || 'Use standard punctuation';
  }

  private generateLearningStyleAdaptations(learningStyle: { [key: string]: number }): string[] {
    const adaptations: string[] = [];
    
    Object.entries(learningStyle).forEach(([style, weight]) => {
      if (weight > 0.3) {
        switch (style) {
          case 'visual':
            adaptations.push('Include visual references or diagrams when helpful');
            break;
          case 'auditory':
            adaptations.push('Suggest discussion or verbal explanation');
            break;
          case 'kinesthetic':
            adaptations.push('Recommend hands-on practice or application');
            break;
          case 'reading':
            adaptations.push('Provide written resources or detailed explanations');
            break;
        }
      }
    });
    
    return adaptations;
  }

  private generateMotivationalElements(persona: StudentPersona, academicContext: AcademicContextData | null): string[] {
    const elements: string[] = [];
    
    if (persona.engagement_level === 'low') {
      elements.push('Acknowledge small progress and efforts');
      elements.push('Connect to personal interests where possible');
    }
    
    if (academicContext?.strength_areas && academicContext.strength_areas.length > 0) {
      elements.push(`Highlight connections to their strengths: ${academicContext.strength_areas.join(', ')}`);
    }
    
    return elements;
  }

  private generateSupportElements(persona: StudentPersona, academicContext: AcademicContextData | null): string[] {
    const elements: string[] = [];
    
    if (academicContext?.challenge_areas && academicContext.challenge_areas.length > 0) {
      elements.push('Offer specific help with known challenge areas');
      elements.push('Provide encouragement and normalize struggles');
    }
    
    if (academicContext?.current_workload_level === 'overwhelming') {
      elements.push('Acknowledge workload pressure');
      elements.push('Suggest prioritization or time management strategies');
    }
    
    return elements;
  }

  private generateTimingHint(preferredTime?: string): string {
    if (!preferredTime) return 'No specific timing preference identified';
    
    const hints = {
      'morning': 'Best response time: morning hours for peak engagement',
      'afternoon': 'Best response time: afternoon for active discussion',
      'evening': 'Best response time: evening hours for thoughtful responses',
      'late': 'Best response time: late evening for focused conversation'
    };
    
    return hints[preferredTime as keyof typeof hints] || 'Flexible timing approach';
  }

  private determineResponseUrgency(responsePattern?: string): 'immediate' | 'timely' | 'thoughtful' {
    switch (responsePattern) {
      case 'immediate': return 'immediate';
      case 'quick': return 'timely';
      case 'thoughtful': return 'thoughtful';
      case 'delayed': return 'thoughtful';
      default: return 'timely';
    }
  }

  private generateFollowUpSuggestions(persona: StudentPersona, academicContext: AcademicContextData | null): string[] {
    const suggestions: string[] = [];
    
    if (persona.participation_style === 'observer') {
      suggestions.push('Follow up privately to encourage participation');
    }
    
    if (academicContext?.upcoming_deadlines && academicContext.upcoming_deadlines.length > 0) {
      suggestions.push('Check in about upcoming deadline progress');
    }
    
    if (persona.collaboration_preference === 'group_oriented') {
      suggestions.push('Suggest group study or collaboration opportunities');
    }
    
    return suggestions;
  }

  private analyzeInputIntent(inputText: string): string {
    const text = inputText.toLowerCase();
    
    if (text.includes('help') || text.includes('?') || text.includes('how')) return 'help';
    if (text.includes('share') || text.includes('tell') || text.includes('update')) return 'share';
    if (text.includes('collaborate') || text.includes('together') || text.includes('group')) return 'collaborate';
    
    return 'general';
  }

  private generateHelpResponse(inputText: string, context: PersonalizedContext): string {
    const { studentProfile, communicationPreferences } = context;
    
    let response = `I'd be happy to help you with that! `;
    
    if (studentProfile.academicStrengths.length > 0) {
      response += `Given your strengths in ${studentProfile.academicStrengths[0]}, `;
    }
    
    response += `let me provide some guidance that might work well for your ${studentProfile.learningStyle}.`;
    
    return response;
  }

  private generateShareResponse(inputText: string, context: PersonalizedContext): string {
    const { communicationPreferences } = context;
    
    if (communicationPreferences.preferredTone === 'casual') {
      return `Thanks for sharing that with me! That's really interesting - `;
    } else {
      return `Thank you for sharing this information. I appreciate you keeping me updated on `;
    }
  }

  private generateCollaborationResponse(inputText: string, context: PersonalizedContext): string {
    const { relationshipContext } = context;
    
    let response = `I love that you're thinking about collaboration! `;
    
    if (relationshipContext.primaryContacts.length > 0) {
      response += `You might want to reach out to ${relationshipContext.primaryContacts[0].name} - `;
    }
    
    response += `it could be a great opportunity to work together.`;
    
    return response;
  }

  private generateGeneralResponse(inputText: string, context: PersonalizedContext): string {
    return `Thanks for reaching out! I'm here to help however I can.`;
  }

  private addAppropriateEmojis(response: string, responseType: string): string {
    // Add contextually appropriate emojis
    if (response.includes('help')) {
      response = response.replace('help', 'help 🤝');
    }
    if (response.includes('great') || response.includes('excellent')) {
      response += ' 🎉';
    }
    if (responseType === 'discussion' && response.includes('interesting')) {
      response = response.replace('interesting', 'interesting 🤔');
    }
    
    return response;
  }

  private adjustResponseLength(response: string, preferredLength: 'brief' | 'moderate' | 'detailed'): string {
    switch (preferredLength) {
      case 'brief':
        // Keep it concise
        return response.split('.')[0] + '.';
      case 'detailed':
        // Could add more context here
        return response + ' Let me know if you need any additional information or clarification!';
      default:
        return response;
    }
  }

  private generateStylingTips(context: PersonalizedContext): string[] {
    const tips: string[] = [];
    const { communicationPreferences, studentProfile } = context;

    tips.push(`Use ${communicationPreferences.preferredTone} tone`);
    tips.push(`Aim for ${communicationPreferences.preferredLength} responses`);
    
    if (communicationPreferences.includeEmojis) {
      tips.push('Consider including appropriate emojis');
    }
    
    if (studentProfile.engagementLevel === 'low') {
      tips.push('Use encouraging and supportive language');
    }
    
    if (communicationPreferences.formalityLevel > 0.7) {
      tips.push('Maintain professional language and structure');
    } else if (communicationPreferences.formalityLevel < 0.3) {
      tips.push('Feel free to use casual, conversational language');
    }

    return tips;
  }

  private generateContextualNotes(context: PersonalizedContext, intent: string): string[] {
    const notes: string[] = [];
    const { studentProfile, currentSituation, relationshipContext } = context;

    // Academic context notes
    if (currentSituation.workloadStatus === 'overwhelming') {
      notes.push('Student is currently experiencing high academic workload pressure');
    }

    if (currentSituation.stressIndicators.level === 'high') {
      notes.push('High stress indicators detected - consider providing extra support');
    }

    // Engagement context
    if (studentProfile.engagementLevel === 'low') {
      notes.push('Student shows low engagement - may benefit from encouragement');
    }

    // Social context
    if (relationshipContext.socialConnectedness < 0.3) {
      notes.push('Student has limited social connections - consider facilitating peer interactions');
    }

    // Learning style context
    if (studentProfile.learningStyle.includes('visual')) {
      notes.push('Student prefers visual learning - consider suggesting diagrams or visual aids');
    }

    // Confidence context
    if (studentProfile.confidenceLevel < 0.5) {
      notes.push('Limited persona data available - responses may be less personalized');
    }

    // Intent-specific notes
    if (intent === 'help') {
      notes.push('Student is seeking assistance - prioritize clear, helpful responses');
    } else if (intent === 'collaborate') {
      notes.push('Student is interested in collaboration - suggest group opportunities');
    }

    return notes;
  }
} 