// Persona System MCP Tools
// These tools expose the persona analysis and context generation capabilities to Claude

import { CallToolRequest, CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { PersonaDB, InteractionHistoryEntry } from '../lib/database.js';
import { PersonaAnalyzer } from '../lib/persona-analyzer.js';
import { ContextEngine } from '../lib/context-engine.js';
import { logger } from '../lib/logger.js';

/**
 * Analyze and update a student's persona based on their Canvas interactions
 */
export async function analyzeStudentPersona(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const params = request.params || {};
    const userId = params.userId as string;
    const forceRefresh = params.forceRefresh as boolean | undefined;

    if (!userId) {
      throw new Error('userId parameter is required');
    }

    logger.info(`Starting persona analysis for user: ${userId}`);

    const analyzer = await PersonaAnalyzer.create();
    const personaDB = await PersonaDB.create();

    // Check if we should force a fresh analysis
    if (forceRefresh) {
      logger.info('Force refresh requested - running complete analysis');
    } else {
      // Check existing persona confidence
      const existingPersona = await personaDB.getPersona(userId);
      if (existingPersona && existingPersona.confidence_score > 0.7) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `High confidence persona already exists for user ${userId}`,
              persona: existingPersona,
              analysis_skipped: true
            }, null, 2)
          }] as TextContent[]
        };
      }
    }

    // Run comprehensive analysis
    const analysisResults = await analyzer.analyzeStudentPersona(userId);
    
    // Update persona with results
    await analyzer.updatePersonaFromAnalysis(userId, analysisResults);
    
    // Get the updated persona
    const updatedPersona = await personaDB.getPersona(userId);

    logger.info(`Persona analysis completed for user ${userId} with confidence: ${analysisResults.confidence}`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Persona analysis completed for user ${userId}`,
          analysis: analysisResults,
          persona: updatedPersona,
          recommendations: {
            writing_style: `${analysisResults.writingStyle.formalityLevel} formality with ${analysisResults.writingStyle.vocabularyComplexity} vocabulary`,
            communication_timing: `Prefers ${analysisResults.communicationPatterns.preferredInteractionTime} interactions with ${analysisResults.communicationPatterns.responseTimePattern} responses`,
            engagement_approach: `${analysisResults.academicBehavior.engagementLevel} engagement student with ${analysisResults.academicBehavior.participationStyle} participation style`,
            relationship_strategy: `${analysisResults.relationshipAnalysis.collaborationPreference} collaboration preference with ${analysisResults.relationshipAnalysis.socialConnectedness.toFixed(2)} social connectedness`
          }
        }, null, 2)
      }] as TextContent[]
    };

  } catch (error) {
    logger.error('Error in analyzeStudentPersona:', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          troubleshooting: 'Check that the user has sufficient interaction history in the database'
        }, null, 2)
      }] as TextContent[]
    };
  }
}

/**
 * Get personalized context for a student to inform response generation
 */
export async function getPersonalizedContext(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const params = request.params || {};
    const userId = params.userId as string;
    const contextType = params.contextType as string | undefined;

    if (!userId) {
      throw new Error('userId parameter is required');
    }

    logger.info(`Generating personalized context for user: ${userId}`);

    const contextEngine = await ContextEngine.create();
    const personalizedContext = await contextEngine.generatePersonalizedContext(userId, contextType);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Personalized context generated for user ${userId}`,
          context: personalizedContext,
          usage_guidance: {
            communication_tone: `Use ${personalizedContext.communicationPreferences.preferredTone} tone`,
            response_length: `Aim for ${personalizedContext.communicationPreferences.preferredLength} responses`,
            key_topics: personalizedContext.studentProfile.interestAreas.slice(0, 3),
            support_level: `Provide ${personalizedContext.communicationPreferences.supportLevel} support`,
            current_status: `Student workload: ${personalizedContext.currentSituation.workloadStatus}`,
            timing_hint: personalizedContext.responseGuidance.interactionGuidance.bestTimingHint
          }
        }, null, 2)
      }] as TextContent[]
    };

  } catch (error) {
    logger.error('Error in getPersonalizedContext:', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, null, 2)
      }] as TextContent[]
    };
  }
}

/**
 * Generate personalized response suggestions based on input text and student context
 */
export async function generatePersonalizedResponse(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const params = request.params || {};
    const userId = params.userId as string;
    const inputText = params.inputText as string;
    const responseType = params.responseType as 'message' | 'discussion' | 'email' | undefined;

    if (!userId || !inputText) {
      throw new Error('userId and inputText parameters are required');
    }

    logger.info(`Generating personalized response for user: ${userId}`);

    const contextEngine = await ContextEngine.create();
    const responseSuggestions = await contextEngine.generateResponseSuggestions(
      userId, 
      inputText, 
      responseType || 'message'
    );

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Personalized response suggestions generated for user ${userId}`,
          input_text: inputText,
          response_type: responseType || 'message',
          suggestions: responseSuggestions,
          usage_instructions: {
            primary_suggestion: 'Use the suggestedResponse as the main recommendation',
            alternatives: 'Consider alternativeResponses for different approaches',
            styling: 'Apply stylingTips to match the student\'s communication style',
            context: 'Use contextualNotes to understand the student\'s current situation'
          }
        }, null, 2)
      }] as TextContent[]
    };

  } catch (error) {
    logger.error('Error in generatePersonalizedResponse:', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, null, 2)
      }] as TextContent[]
    };
  }
}

/**
 * Record a new interaction for persona learning and analysis
 */
export async function recordInteraction(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const params = request.params || {};
    const userId = params.userId as string;
    const interactionType = params.interactionType as 'discussion_post' | 'discussion_reply' | 'message_sent' | 'message_received';
    const content = params.content as string;
    const courseId = params.courseId as string | undefined;
    const courseName = params.courseName as string | undefined;
    const recipientIds = params.recipientIds as string[] | undefined;
    const discussionTopicId = params.discussionTopicId as string | undefined;
    const assignmentContext = params.assignmentContext as string | undefined;

    if (!userId || !interactionType || !content) {
      throw new Error('userId, interactionType, and content parameters are required');
    }

    logger.info(`Recording ${interactionType} interaction for user: ${userId}`);

    const personaDB = await PersonaDB.create();
    const now = new Date();

    // Simple sentiment analysis (could be enhanced with proper NLP)
    const sentimentScore = calculateSimpleSentiment(content);
    
    // Simple formality analysis
    const formalityScore = calculateSimpleFormality(content);
    
    // Simple complexity analysis
    const complexityScore = calculateSimpleComplexity(content);

    const interactionData: InteractionHistoryEntry = {
      user_id: userId,
      interaction_type: interactionType,
      content: content,
      content_length: content.length,
      word_count: content.split(/\s+/).length,
      sentiment_score: sentimentScore,
      formality_score: formalityScore,
      complexity_score: complexityScore,
      course_id: courseId,
      course_name: courseName,
      recipient_ids: recipientIds || [],
      discussion_topic_id: discussionTopicId,
      assignment_context: assignmentContext,
      created_at: now.toISOString(),
      day_of_week: now.getDay(),
      hour_of_day: now.getHours(),
      interaction_with_peers: interactionType.includes('discussion') || Boolean(recipientIds && recipientIds.length > 0),
      interaction_with_instructors: false, // Could be enhanced with role detection
      is_group_work: Boolean(recipientIds && recipientIds.length > 1),
      analysis_version: '1.0'
    };

    const interactionId = await personaDB.addInteraction(interactionData);

    logger.info(`Interaction recorded with ID: ${interactionId} for user ${userId}`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Interaction recorded successfully for user ${userId}`,
          interaction_id: interactionId,
          analysis: {
            sentiment_score: sentimentScore,
            formality_score: formalityScore,
            complexity_score: complexityScore,
            word_count: interactionData.word_count,
            content_length: interactionData.content_length
          },
          recommendation: 'Consider running persona analysis after recording several interactions for updated insights'
        }, null, 2)
      }] as TextContent[]
    };

  } catch (error) {
    logger.error('Error in recordInteraction:', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, null, 2)
      }] as TextContent[]
    };
  }
}

/**
 * Update a student's academic context for more accurate persona insights
 */
export async function updateAcademicContext(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const params = request.params || {};
    const userId = params.userId as string;
    const currentCourses = params.currentCourses as any[] | undefined;
    const upcomingDeadlines = params.upcomingDeadlines as any[] | undefined;
    const recentSubmissions = params.recentSubmissions as any[] | undefined;
    const workloadLevel = params.workloadLevel as 'light' | 'moderate' | 'heavy' | 'overwhelming' | undefined;
    const strengthAreas = params.strengthAreas as string[] | undefined;
    const challengeAreas = params.challengeAreas as string[] | undefined;

    if (!userId) {
      throw new Error('userId parameter is required');
    }

    logger.info(`Updating academic context for user: ${userId}`);

    const personaDB = await PersonaDB.create();

    // Get existing context or create new one
    let existingContext = await personaDB.getAcademicContext(userId);
    
    const contextData = {
      user_id: userId,
      current_courses: currentCourses || existingContext?.current_courses || [],
      upcoming_deadlines: upcomingDeadlines || existingContext?.upcoming_deadlines || [],
      recent_submissions: recentSubmissions || existingContext?.recent_submissions || [],
      current_workload_level: workloadLevel || existingContext?.current_workload_level || 'moderate',
      grade_trends: existingContext?.grade_trends || {},
      strength_areas: strengthAreas || existingContext?.strength_areas || [],
      challenge_areas: challengeAreas || existingContext?.challenge_areas || [],
      semester_progress: existingContext?.semester_progress || 0.5,
      time_until_major_deadlines: existingContext?.time_until_major_deadlines || 7,
      current_stress_indicators: existingContext?.current_stress_indicators || {},
      recently_studied_topics: existingContext?.recently_studied_topics || [],
      active_discussion_topics: existingContext?.active_discussion_topics || [],
      collaboration_opportunities: existingContext?.collaboration_opportunities || []
    };

    await personaDB.updateAcademicContext(userId, contextData);

    logger.info(`Academic context updated for user ${userId}`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Academic context updated successfully for user ${userId}`,
          context: contextData,
          recommendation: 'Academic context update will improve persona analysis accuracy on next analysis run'
        }, null, 2)
      }] as TextContent[]
    };

  } catch (error) {
    logger.error('Error in updateAcademicContext:', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, null, 2)
      }] as TextContent[]
    };
  }
}

/**
 * Get a comprehensive student profile summary
 */
export async function getStudentProfile(request: CallToolRequest): Promise<CallToolResult> {
  try {
    const params = request.params || {};
    const userId = params.userId as string;

    if (!userId) {
      throw new Error('userId parameter is required');
    }

    logger.info(`Retrieving student profile for user: ${userId}`);

    const personaDB = await PersonaDB.create();
    
    const [persona, academicContext, relationships, recentInteractions] = await Promise.all([
      personaDB.getPersona(userId),
      personaDB.getAcademicContext(userId),
      personaDB.getRelationships(userId),
      personaDB.getRecentInteractions(userId, 10)
    ]);

    if (!persona) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            message: `No persona found for user ${userId}`,
            recommendation: 'Run persona analysis first to create a profile',
            available_interactions: recentInteractions.length
          }, null, 2)
        }] as TextContent[]
      };
    }

    const profile = {
      basic_info: {
        user_id: persona.user_id,
        display_name: persona.display_name,
        confidence_level: persona.confidence_score,
        last_analysis: persona.last_analysis_date,
        total_interactions: persona.total_interactions_analyzed
      },
      communication_style: {
        formality_level: persona.formality_level,
        vocabulary_complexity: persona.vocabulary_complexity,
        avg_message_length: persona.avg_message_length,
        avg_discussion_length: persona.avg_discussion_length,
        emoji_usage: persona.emoji_usage_frequency,
        preferred_timing: persona.preferred_interaction_time,
        response_pattern: persona.response_time_pattern
      },
      academic_behavior: {
        engagement_level: persona.engagement_level,
        participation_style: persona.participation_style,
        collaboration_preference: persona.collaboration_preference,
        learning_style: persona.learning_style_indicators,
        topics_of_interest: persona.topics_of_interest
      },
      current_context: academicContext ? {
        active_courses: academicContext.current_courses.length,
        workload_level: academicContext.current_workload_level,
        upcoming_deadlines: academicContext.upcoming_deadlines.length,
        strength_areas: academicContext.strength_areas,
        challenge_areas: academicContext.challenge_areas
      } : null,
      social_connections: {
        total_relationships: relationships.length,
        peer_connections: relationships.filter(r => r.contact_type === 'peer').length,
        instructor_connections: relationships.filter(r => r.contact_type === 'instructor').length,
        strong_relationships: relationships.filter(r => r.relationship_strength > 0.6).length
      },
      recent_activity: {
        interactions_last_week: recentInteractions.length,
        interaction_types: [...new Set(recentInteractions.map(i => i.interaction_type))],
        courses_active_in: [...new Set(recentInteractions.map(i => i.course_name).filter(Boolean))]
      }
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `Complete student profile retrieved for user ${userId}`,
          profile: profile,
          insights: {
            confidence_assessment: persona.confidence_score > 0.7 ? 'High confidence - reliable insights' : 
                                   persona.confidence_score > 0.4 ? 'Medium confidence - good insights' : 
                                   'Low confidence - more data needed',
            communication_summary: `${persona.formality_level} formality, ${persona.engagement_level} engagement`,
            recommendation: persona.confidence_score < 0.5 ? 'Consider recording more interactions for better analysis' : 
                           'Profile is well-established and ready for personalized responses'
          }
        }, null, 2)
      }] as TextContent[]
    };

  } catch (error) {
    logger.error('Error in getStudentProfile:', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, null, 2)
      }] as TextContent[]
    };
  }
}

// Helper functions for simple text analysis
function calculateSimpleSentiment(text: string): number {
  // Simple sentiment analysis based on positive/negative word counts
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'enjoy', 'happy', 'excited', 'thank'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'difficult', 'hard', 'problem', 'issue'];
  
  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  
  words.forEach(word => {
    if (positiveWords.some(pos => word.includes(pos))) positiveCount++;
    if (negativeWords.some(neg => word.includes(neg))) negativeCount++;
  });
  
  const totalSentimentWords = positiveCount + negativeCount;
  if (totalSentimentWords === 0) return 0;
  
  return (positiveCount - negativeCount) / totalSentimentWords;
}

function calculateSimpleFormality(text: string): number {
  // Simple formality analysis based on indicators
  const formalIndicators = ['therefore', 'however', 'furthermore', 'additionally', 'consequently', 'please', 'would', 'could'];
  const informalIndicators = ['yeah', 'yep', 'nah', 'gonna', 'wanna', 'kinda', 'sorta', 'lol', 'haha'];
  
  const words = text.toLowerCase().split(/\s+/);
  let formalCount = 0;
  let informalCount = 0;
  
  words.forEach(word => {
    if (formalIndicators.includes(word)) formalCount++;
    if (informalIndicators.includes(word)) informalCount++;
  });
  
  // Check for contractions (informal)
  const contractionCount = (text.match(/\w+'\w+/g) || []).length;
  informalCount += contractionCount;
  
  const totalIndicators = formalCount + informalCount;
  if (totalIndicators === 0) return 0.5; // Default to medium formality
  
  return formalCount / totalIndicators;
}

function calculateSimpleComplexity(text: string): number {
  // Simple complexity analysis based on word length and sentence structure
  const words = text.split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const avgSentenceLength = words.length / sentences.length;
  
  // Normalize complexity score (0-1)
  const wordComplexity = Math.min(avgWordLength / 8, 1); // 8+ chars = complex
  const sentenceComplexity = Math.min(avgSentenceLength / 20, 1); // 20+ words = complex
  
  return (wordComplexity + sentenceComplexity) / 2;
} 