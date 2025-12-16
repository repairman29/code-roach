/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/llmService.js
 * Last Sync: 2025-12-16T03:10:22.241Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * LLM Service
 * Provides LLM-based narrative generation for AI GM with game state context injection
 * Supports OpenAI and Anthropic (Claude) APIs
 */

// Ensure environment variables are loaded
require('dotenv').config();

const performanceTrackingService = require('./performanceTrackingService');
const aiGMMemoryService = require('./aiGMMemoryService');
const responseVarietyService = require('./responseVarietyService');
const aiGMExplainabilityService = require('./aiGMExplainabilityService');
const aiGMConfidenceCalibrationService = require('./aiGMConfidenceCalibrationService');
const narrativeProgressionService = require('./narrativeProgressionService');
const enhancedContextAwarenessService = require('./enhancedContextAwarenessService');

// Event Bus for quality improvement events (optional, graceful fallback)
let eventBus = null;
try {
    eventBus = require('./eventBus');
} catch (err) {
    // Event Bus not available, continue without it
}

const GAME_STATE_INSTRUCTIONS = `### THE GAME STATE BLOCK

Every user message will be preceded by a hidden block formatted as \`[GAME_STATE: ...]\`.

**You must use this data to color your narration:**

1. **Health/Wounds:** 
   - If HP is low (less than 30% of max) or WOUNDED status is present, describe the pain and physical struggle. Make physical actions harder and more desperate.
   - Example: Instead of "You try to run," say "You stumble forward, pain shooting through your wounded leg with every step."

2. **Stress/Panic:** 
   - If Stress is high (3 or more) or Status is "Panicked," shorten your sentence structure. Describe paranoia, sweating, sensory overload, and racing thoughts.
   - Use fragmented sentences. Add urgency. Hallucinate threats if necessary.
   - Example: Instead of "You look around the room," say "Your eyes dart. Every shadow moves. Your heart hammers. Is that breathing? No—just the vents. Right?"

3. **Location:** 
   - Use the Location data to set the scene (lighting, smells, sounds, atmosphere).
   - If Alert Level is HIGH or CRITICAL, add tension and urgency to descriptions.

4. **Inventory:** 
   - If the user tries an action, check the State string to see if they actually have the required item.
   - If they don't have it, narrate the failure naturally: "You reach for your blaster, but your holster is empty. You must have left it on the ship."

5. **Mission Objective:**
   - Reference the objective when relevant to add narrative weight.
   - Example: If objective is "Escape the facility," add urgency: "Time is running out. The facility's lockdown protocols are activating."

**IMPORTANT RULES:**

- **DO NOT** repeat the stats back to the user. Do not say "I see you have 2 HP" or "Your stress is at 3."
- **DO** weave the state into the narrative naturally. Show, don't tell.
- **DO** adjust your narrative style based on the state. Panicked characters get frantic descriptions. Wounded characters feel pain.
- **DO** use the state to inform difficulty. A panicked character trying to hack a door should have a harder time than a calm one.
- **DO NOT** update the numbers yourself. The System handles the math. You only narrate the results.

**Example Transformation:**

**Without Context:**
> "You try to hack the door. The panel beeps. Access granted."

**With Context [GAME_STATE: HP:1/5 STRESS:4/5 STATUS:Panicked LOC:Sector 4 (HIGH)]:**
> "Your hands shake as you fumble with the access panel. Sweat drips into your eyes. The numbers blur. You can't focus. The panel beeps—wrong code. Your heart hammers. Try again. The second attempt works, but your hands are trembling so badly you almost drop the datapad. Access granted, but at what cost?"

**The state is invisible to the user, but it colors every word you write.**`;

const BASE_SYSTEM_PROMPT = `You are an AI Game Master for SMUGGLER, a fast-paced, rules-light tabletop RPG about running illegal cargo across a dangerous galaxy.

Your role:
- Generate vivid, immersive narrative descriptions that bring the world to life
- React to player actions with appropriate consequences that feel meaningful
- Maintain the tone: dangerous, desperate, and cinematic - like a space western
- Keep descriptions concise but evocative (100-300 words) - every word should count
- Use the game state to inform your narration style - wounded characters feel pain, panicked characters are frantic
- Reference available game systems when relevant to create dynamic, interactive narratives
- Create variety - avoid repeating the same phrases or structures
- Build narrative momentum - connect events to create a sense of progression
- Show character through action - let the player's choices and outcomes reveal who they are

Game Setting:
- Sci-fi space setting with a gritty, dangerous atmosphere
- Players are smugglers taking on risky jobs in a lawless galaxy
- Every decision matters, death is real, but so is triumph
- Focus on narrative over rules - make the story compelling
- The galaxy is vast, dangerous, and full of opportunity for those brave enough

Narrative Quality Guidelines:
- Use specific, concrete details instead of vague descriptions
- Vary sentence structure and length to create rhythm
- Include sensory details (sights, sounds, smells, textures) to immerse the player
- Create emotional beats - moments of tension, relief, triumph, or despair
- Reference past events naturally to build continuity
- Make failures interesting - they should create new opportunities, not just block progress
- Make successes feel earned - describe the skill, luck, or cleverness that made it work

System Integration:
- The game has various systems (stealth, combat, NPCs, factions, etc.) that can enhance narratives
- When systems are mentioned in the context, you can reference their capabilities to create richer descriptions
- For example, if stealth systems are active, you can describe detection levels, noise, hiding spots, etc.
- Use system information to make narratives more interactive and mechanically grounded
- Don't just mention systems - weave them into the narrative naturally`;

class LLMService {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        this.defaultProvider = process.env.LLM_PROVIDER || 'openai'; // 'openai' or 'anthropic'
        this.defaultModel = {
            openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307'
        };
        
        // Rate limiting cache (simple in-memory, could be upgraded to Redis)
        this.rateLimitCache = new Map();
        this.rateLimitWindow = 60000; // 1 minute
        this.maxRequestsPerWindow = 30; // 30 requests per minute per IP
        
        // Response cache (simple in-memory, could be upgraded to Redis)
        this.responseCache = new Map();
        this.cacheTTL = 300000; // 5 minutes
        
        // Cost tracking
        this.costTracking = {
            totalCost: 0,
            requests: 0,
            tokensUsed: 0,
            byProvider: {},
            byModel: {},
            daily: {}
        };
        
        // Quality scoring
        this.qualityScores = [];
        this.minQualityScore = 0.6; // Minimum quality threshold
        
        // Usage analytics
        this.usageAnalytics = {
            requests: [],
            errors: [],
            responseTimes: [],
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Prompt templates for optimization
        this.promptTemplates = this.initializePromptTemplates();
        
        // Response filters for safety
        this.responseFilters = this.initializeResponseFilters();
        
        // Fallback system
        this.fallbackEnabled = true;
        this.fallbackTemplates = this.initializeFallbackTemplates();
        
        this.available = this.checkAvailability();
    }
    
    /**
     * Initialize prompt templates for optimization
     */
    initializePromptTemplates() {
        return {
            narrative: {
                system: BASE_SYSTEM_PROMPT + '\n\n' + GAME_STATE_INSTRUCTIONS,
                user: (action, context, roll) => {
                    let prompt = context ? `[GAME_STATE: ${context}]\n\n` : '';
                    prompt += `User Action: ${action}`;
                    if (roll) {
                        prompt += `\n\nRoll Result: ${roll.roll || 'N/A'} vs ${roll.statValue || 'N/A'} on ${roll.statName || 'N/A'}`;
                    }
                    return prompt;
                }
            },
            dialogue: {
                system: BASE_SYSTEM_PROMPT + '\n\nYou are generating NPC dialogue. Keep it concise and in-character.',
                user: (npc, context) => {
                    return `NPC: ${npc.name} (${npc.personality})\nContext: ${context}\nGenerate dialogue:`;
                }
            },
            description: {
                system: BASE_SYSTEM_PROMPT + '\n\nGenerate vivid scene descriptions.',
                user: (location, context) => {
                    return `Location: ${location}\nContext: ${context}\nDescribe the scene:`;
                }
            }
        };
    }
    
    /**
     * Initialize response filters for safety
     */
    initializeResponseFilters() {
        return {
            blockedWords: ['explicit', 'inappropriate'], // Add more as needed
            maxLength: 2000, // Maximum response length
            minLength: 50, // Minimum response length
            checkProfanity: true,
            checkViolence: false // Game is about smuggling, some violence is expected
        };
    }
    
    /**
     * Initialize fallback templates
     */
    initializeFallbackTemplates() {
        return {
            success: [
                "You succeed. The action goes as planned.",
                "Success! Your skill pays off.",
                "It works. You manage to pull it off."
            ],
            failure: [
                "You fail. Things don't go as planned.",
                "It doesn't work. You'll need to try something else.",
                "Failure. The attempt doesn't succeed."
            ],
            criticalSuccess: [
                "Critical success! You excel beyond expectations.",
                "Amazing! You perform flawlessly.",
                "Perfect execution. You couldn't have done better."
            ],
            criticalFailure: [
                "Critical failure! Things go horribly wrong.",
                "Disaster strikes. Everything goes wrong.",
                "Catastrophic failure. The situation worsens."
            ]
        };
    }

    /**
     * Check which LLM providers are available
     */
    checkAvailability() {
        const available = {
            openai: !!this.openaiApiKey,
            anthropic: !!this.anthropicApiKey
        };
        
        if (!available.openai && !available.anthropic) {
            console.warn('⚠️  No LLM API keys configured. LLM narrative generation will not be available.');
            console.warn('   Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable to enable.');
        } else {
            if (available.openai) {
                console.log('✅ OpenAI LLM service available');
            }
            if (available.anthropic) {
                console.log('✅ Anthropic LLM service available');
            }
        }
        
        return available;
    }

    /**
     * Check if LLM service is available
     */
    isAvailable() {
        return this.available.openai || this.available.anthropic;
    }

    /**
     * Check rate limit for an IP address
     */
    checkRateLimit(ip) {
        const now = Date.now();
        const key = `rate_limit_${ip}`;
        const record = this.rateLimitCache.get(key);
        
        if (!record || (now - record.timestamp) > this.rateLimitWindow) {
            this.rateLimitCache.set(key, { count: 1, timestamp: now });
            return true;
        }
        
        if (record.count >= this.maxRequestsPerWindow) {
            return false;
        }
        
        record.count++;
        return true;
    }

    /**
     * Get cached response if available
     */
    getCachedResponse(cacheKey) {
        const startTime = Date.now();
        const cached = this.responseCache.get(cacheKey);
        const hitTime = Date.now() - startTime;
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            // SPRINT 4: Track cache hit
            this.usageAnalytics.cacheHits++;
            this.trackCacheMetrics('llm_response', true, hitTime, 0);
            return cached.response;
        }
        
        // SPRINT 4: Track cache miss
        this.usageAnalytics.cacheMisses++;
        this.trackCacheMetrics('llm_response', false, 0, hitTime);
        return null;
    }
    
    /**
     * Cache a response
     */
    cacheResponse(cacheKey, response) {
        this.responseCache.set(cacheKey, {
            response,
            timestamp: Date.now()
        });
        
        // Clean up old cache entries periodically
        if (this.responseCache.size > 1000) {
            const now = Date.now();
            for (const [key, value] of this.responseCache.entries()) {
                if (now - value.timestamp > this.cacheTTL) {
                    this.responseCache.delete(key);
                }
            }
        }
        
        // SPRINT 4: Update cache metrics
        this.updateCacheMetrics();
    }

    /**
     * SPRINT 4: Track cache metrics
     */
    trackCacheMetrics(cacheType, isHit, hitTimeMs, missTimeMs) {
        // Track to Supabase periodically (every 10 cache operations)
        const totalOps = this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses;
        if (totalOps > 0 && totalOps % 10 === 0) {
            const hitRate = (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses) > 0
                ? this.usageAnalytics.cacheHits / (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses)
                : 0;

            performanceTrackingService.trackCacheMetrics({
                cacheType: cacheType,
                hitRate: hitRate,
                avgHitTimeMs: hitTimeMs || 1,
                avgMissTimeMs: missTimeMs || 0,
                cacheSizeMb: (this.responseCache.size * 0.001), // Approximate
                evictionCount: Math.max(0, totalOps - 100), // Approximate evictions
                metadata: {
                    cacheSize: this.responseCache.size,
                    ttl: this.cacheTTL
                }
            }).catch(err => {
                console.warn('[LLM Service] Failed to track cache metrics:', err.message);
            });
        }
    }

    /**
     * SPRINT 4: Update cache metrics
     */
    updateCacheMetrics() {
        // This is called periodically to update cache size metrics
        const totalOps = this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses;
        if (totalOps > 0 && totalOps % 50 === 0) {
            const hitRate = (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses) > 0
                ? this.usageAnalytics.cacheHits / (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses)
                : 0;

            performanceTrackingService.trackCacheMetrics({
                cacheType: 'llm_response',
                hitRate: hitRate,
                avgHitTimeMs: 1, // Approximate
                avgMissTimeMs: 0,
                cacheSizeMb: (this.responseCache.size * 0.001),
                evictionCount: Math.max(0, totalOps - 100),
                metadata: {
                    cacheSize: this.responseCache.size,
                    ttl: this.cacheTTL,
                    totalHits: this.usageAnalytics.cacheHits,
                    totalMisses: this.usageAnalytics.cacheMisses
                }
            }).catch(err => {
                // Don't block on tracking errors
            });
        }
    }

    /**
     * SPRINT 4: Estimate cost for a request (for cache savings calculation)
     */
    estimateCost(provider, model, inputLength) {
        // Rough estimate based on input length
        const estimatedTokens = Math.ceil(inputLength / 4); // ~4 chars per token
        
        if (provider === 'openai') {
            const costPer1kTokens = {
                'gpt-4o-mini': { input: 0.15, output: 0.6 },
                'gpt-4o': { input: 2.5, output: 10.0 },
                'gpt-4-turbo': { input: 10.0, output: 30.0 },
                'gpt-3.5-turbo': { input: 0.5, output: 1.5 }
            };
            const modelCost = costPer1kTokens[model] || costPer1kTokens['gpt-4o-mini'];
            return (estimatedTokens / 1000 * modelCost.input) + (estimatedTokens / 1000 * modelCost.output * 0.5); // Estimate 50% output
        } else if (provider === 'anthropic') {
            const costPer1kTokens = {
                'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
                'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
                'claude-3-opus-20240229': { input: 15.0, output: 75.0 }
            };
            const modelCost = costPer1kTokens[model] || costPer1kTokens['claude-3-haiku-20240307'];
            return (estimatedTokens / 1000 * modelCost.input) + (estimatedTokens / 1000 * modelCost.output * 0.5);
        }
        
        return 0;
    }

    /**
     * Generate narrative using LLM
     * @param {Object} params - Generation parameters
     * @param {string} params.userMessage - User's action/message
     * @param {string} params.gameStateContext - Game state context string
     * @param {Object} params.rollData - Roll data (optional)
     * @param {string} params.provider - Provider to use ('openai' or 'anthropic', defaults to configured default)
     * @param {string} params.model - Model to use (optional, uses default for provider)
     * @param {string} params.ip - IP address for rate limiting
     * @returns {Promise<Object>} - { narrative: string, provider: string, model: string, cached: boolean }
     */
    async generateNarrative(params) {
        const {
            userMessage,
            gameStateContext = '',
            rollData = null,
            provider = null,
            model = null,
            ip = 'unknown',
            userId = null, // SPRINT 5: Add userId for memory integration
            sessionId = null // SPRINT 5: Add sessionId for memory integration
        } = params;

        // Check rate limit
        if (!this.checkRateLimit(ip)) {
            throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        }

        // Determine provider
        let selectedProvider = provider || this.defaultProvider;
        if (!this.available[selectedProvider]) {
            // Fallback to available provider
            if (this.available.openai) {
                selectedProvider = 'openai';
            } else if (this.available.anthropic) {
                selectedProvider = 'anthropic';
            } else {
                throw new Error('No LLM providers available. Please configure API keys.');
            }
        }

        // Determine model early for cache tracking
        const selectedModel = model || this.defaultModel[selectedProvider];

        // Check cache
        const cacheKey = this.generateCacheKey(userMessage, gameStateContext, rollData);
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
            // SPRINT 4: Track cache hit for cost savings
            const estimatedCost = this.estimateCost(selectedProvider, selectedModel, userMessage.length);
            if (estimatedCost > 0) {
                performanceTrackingService.trackAPICost({
                    service: selectedProvider,
                    operationType: 'cached_' + (selectedModel || 'unknown'),
                    costUsd: 0, // Cached = $0 cost
                    tokensUsed: 0,
                    cacheUsed: true,
                    requestId: `cached-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    metadata: {
                        model: selectedModel || this.defaultModel[selectedProvider],
                        cached: true,
                        estimatedSavings: estimatedCost
                    }
                }).catch(err => {
                    // Don't block on tracking errors
                });
            }

            return {
                ...cached,
                cached: true
            };
        }

        // Get enhanced context awareness (includes memory, progression, emotional, environmental)
        const scenarioId = params.scenarioId || 'default';
        let enhancedContext = null;
        let memoryContext = '';
        let progressionContext = '';
        
        if (userId) {
            try {
                // Get enhanced context (includes memory, progression, emotional, environmental)
                enhancedContext = await enhancedContextAwarenessService.getEnhancedContext(
                    userId,
                    scenarioId,
                    {
                        location: params.location || null,
                        actionType: rollData ? `${rollData.statName || 'unknown'}-${rollData.rollType || 'roll'}` : 'action',
                        rollData: rollData,
                        emotionalState: params.emotionalState || {},
                        gameState: params.gameState || {}
                    }
                );

                // Build memory context from enhanced context
                if (enhancedContext.narrativeMemory?.memories?.length > 0) {
                    const highPriority = enhancedContext.narrativeMemory.highPriority || [];
                    const mediumPriority = enhancedContext.narrativeMemory.mediumPriority || [];
                    
                    const relevantMemories = [...highPriority, ...mediumPriority].slice(0, 5);
                    
                    if (relevantMemories.length > 0) {
                        const memoryTexts = relevantMemories.map(m => {
                            let text = `- ${m.event_type || 'event'}: `;
                            if (m.narrative) {
                                text += m.narrative.substring(0, 150);
                            } else if (m.event_data) {
                                text += JSON.stringify(m.event_data).substring(0, 150);
                            }
                            if (m.recency) {
                                text += ` [${m.recency}]`;
                            }
                            return text;
                        }).join('\n');
                        
                        memoryContext = `\n\n[PLAYER MEMORY CONTEXT - Reference these past events naturally in your narrative:]\n${memoryTexts}\n`;
                        
                        // Add emotional context if available
                        if (enhancedContext.emotional?.category !== 'neutral') {
                            memoryContext += `\n[EMOTIONAL CONTEXT - Player's emotional state: ${enhancedContext.emotional.category} (${enhancedContext.emotional.trajectory} trajectory)]\n`;
                            if (enhancedContext.emotional.recommendations?.length > 0) {
                                memoryContext += `Recommendations: ${enhancedContext.emotional.recommendations.join('; ')}\n`;
                            }
                        }
                        
                        // Add environmental context if available
                        if (enhancedContext.environmental?.location) {
                            const env = enhancedContext.environmental;
                            memoryContext += `\n[ENVIRONMENTAL CONTEXT - Location: ${env.location}]\n`;
                            memoryContext += `Atmosphere: ${env.atmosphere}\n`;
                            if (env.sensoryDetails) {
                                const sensory = env.sensoryDetails;
                                if (sensory.visual?.length > 0) {
                                    memoryContext += `Visual details: ${sensory.visual.join(', ')}\n`;
                                }
                                if (sensory.auditory?.length > 0) {
                                    memoryContext += `Sounds: ${sensory.auditory.join(', ')}\n`;
                                }
                            }
                        }
                    }
                }

                // Get progression context
                if (enhancedContext.progression?.storyStage) {
                    const progression = enhancedContext.progression;
                    progressionContext = `\n\n[NARRATIVE PROGRESSION - Use this to maintain story coherence:]\n`;
                    progressionContext += `Story Stage: ${progression.storyStage} (${(progression.storyProgress * 100).toFixed(0)}% complete)\n`;
                    progressionContext += `Player Journey: ${progression.playerJourney.stage} (${progression.playerJourney.totalActions} actions, ${(progression.playerJourney.successRate * 100).toFixed(0)}% success rate)\n`;
                    
                    if (progression.relationships && progression.relationships.length > 0) {
                        progressionContext += `Relationships: ${progression.relationships.map(r => `${r.entity} (${r.relationship})`).join(', ')}\n`;
                    }
                    
                    if (progression.recentEvents && progression.recentEvents.length > 0) {
                        progressionContext += `Recent Events: ${progression.recentEvents.map(e => e.type).join(', ')}\n`;
                    }
                    
                    if (progression.milestones && progression.milestones.length > 0) {
                        progressionContext += `Milestones: ${progression.milestones.map(m => m.description || m).join(', ')}\n`;
                    }
                    
                    progressionContext += `\nAdjust your narrative tone and content to match this story stage. `;
                    progressionContext += `If in ${progression.storyStage}, use appropriate pacing and tension.\n`;
                }
            } catch (err) {
                console.warn('[LLM Service] Failed to get enhanced context:', err.message);
                // Fallback to basic memory context
                try {
                    const memories = await aiGMMemoryService.getEnhancedMemoryContext(
                        userId,
                        userMessage + ' ' + gameStateContext,
                        { days: 30, limit: 5, includeEmotions: true }
                    );
                    
                    if (memories && memories.length > 0) {
                        const memoryTexts = memories.map(m => {
                            let text = `- ${m.type}: ${JSON.stringify(m.event)}`;
                            if (m.narrative) text += ` (Narrative: ${m.narrative.substring(0, 100)}...)`;
                            return text;
                        }).join('\n');
                        
                        memoryContext = `\n\n[PLAYER MEMORY CONTEXT - Reference these past events naturally in your narrative:]\n${memoryTexts}\n`;
                    }
                } catch (fallbackErr) {
                    console.warn('[LLM Service] Failed to get fallback memory context:', fallbackErr.message);
                }
            }
        }

        // Build prompt
        const systemPrompt = BASE_SYSTEM_PROMPT + '\n\n' + GAME_STATE_INSTRUCTIONS;
        const userPrompt = gameStateContext 
            ? `[GAME_STATE: ${gameStateContext}]\n\nUser Action: ${userMessage}`
            : `User Action: ${userMessage}`;
        
        // Add progression context to user prompt
        const userPromptWithContext = progressionContext 
            ? `${progressionContext}\n\n${userPrompt}`
            : userPrompt;

        // Add roll context if available
        let enhancedUserPrompt = userPromptWithContext;
        if (rollData) {
            const rollInfo = `Roll: ${rollData.roll || 'N/A'} vs ${rollData.statValue || 'N/A'} on 
                ${rollData.statName || 'N/A'} (${rollData.rollType || 'N/A'})`;
            enhancedUserPrompt = `${rollInfo}\n\n${userPromptWithContext}`;
        }

        // SPRINT 5: Add memory context to prompt
        enhancedUserPrompt += memoryContext;

        // Generate using selected provider
        let result;
        const startTime = Date.now();
        
        try {
            if (selectedProvider === 'openai') {
                result = await this.generateOpenAI(systemPrompt, enhancedUserPrompt, selectedModel);
            } else if (selectedProvider === 'anthropic') {
                result = await this.generateAnthropic(systemPrompt, enhancedUserPrompt, selectedModel);
            } else if (selectedProvider === 'local') {
                result = await this.generateLocal(systemPrompt, enhancedUserPrompt, selectedModel);
            } else {
                throw new Error(`Unknown provider: ${selectedProvider}`);
            }
            
            const responseTime = Date.now() - startTime;
            
            // Track usage
            this.trackUsage({
                provider: selectedProvider,
                model: selectedModel,
                responseTime: responseTime,
                tokens: result.tokensUsed || 0,
                cost: result.cost || 0,
                cached: false
            });
            
            // Score quality
            const qualityScore = this.scoreQuality(result.narrative, userMessage);
            this.qualityScores.push(qualityScore);
            if (this.qualityScores.length > 100) {
                this.qualityScores.shift(); // Keep only last 100 scores
            }
            
            // Check response variety (scenarioId already defined above)
            const actionType = rollData ? `${rollData.statName || 'unknown'}-${rollData.rollType || 'roll'}` : 'action';
            const varietyCheck = responseVarietyService.checkVariety(scenarioId, actionType, result.narrative);
            
            // Adjust quality score based on variety (penalize repetition)
            let adjustedQualityScore = qualityScore;
            if (varietyCheck.isSimilar) {
                // Reduce quality score if response is too similar to recent ones
                const varietyPenalty = varietyCheck.similarityScore * 0.2; // Up to 0.2 penalty
                adjustedQualityScore = Math.max(0, qualityScore - varietyPenalty);
                
                if (varietyCheck.similarityScore > 0.85) {
                    console.warn(`[LLM Service] Response is ${(varietyCheck.similarityScore * 100).toFixed(0)}% similar to recent responses - high repetition risk`);
                }
            }
            
            // Filter response for safety
            result.narrative = this.filterResponse(result.narrative);
            
            // Check quality threshold (use adjusted score)
            if (adjustedQualityScore < this.minQualityScore && this.fallbackEnabled) {
                console.warn(`[LLM Service] Low quality score (${adjustedQualityScore.toFixed(2)}, base: ${qualityScore.toFixed(2)}), using fallback`);
                return this.getFallbackResponse(rollData);
            }
            
            // Calibrate confidence for quality prediction
            const calibratedConfidence = await aiGMConfidenceCalibrationService.calibrateConfidence(
                adjustedQualityScore,
                {
                    scenarioId: scenarioId,
                    actionType: actionType,
                    provider: selectedProvider,
                    model: selectedModel,
                    qualityScore: adjustedQualityScore
                }
            );

            // Generate explanation and track response (only if quality is acceptable)
            let explanation = null;
            if (adjustedQualityScore >= this.minQualityScore) {
                // Track response for variety checking
                responseVarietyService.trackResponse(scenarioId, actionType, result.narrative, {
                    rollData: rollData,
                    qualityScore: qualityScore,
                    varietyScore: varietyCheck.varietyScore
                });
                
                // Generate explanation for this narrative
                try {
                    const explainResult = await aiGMExplainabilityService.explainNarrative(result.narrative, {
                        narrative: result.narrative,
                        qualityScore: adjustedQualityScore,
                        baseQualityScore: qualityScore,
                        varietyScore: varietyCheck.varietyScore,
                        isRepetitive: varietyCheck.isSimilar,
                        scenarioId: scenarioId,
                        actionType: actionType,
                        rollData: rollData,
                        gameStateContext: gameStateContext,
                        promptUsed: enhancedUserPrompt,
                        provider: selectedProvider,
                        model: selectedModel,
                        cached: false,
                        responseTime: responseTime,
                        tokensUsed: result.tokensUsed || 0
                    });
                    explanation = explainResult.explanation;
                } catch (err) {
                    console.warn('[LLM Service] Failed to generate explanation:', err.message);
                }
                
                // Emit quality improvement event if Event Bus available
                if (eventBus && typeof eventBus.emit === 'function') {
                    eventBus.emit('game:ai:response-generated', {
                        qualityScore: adjustedQualityScore,
                        calibratedQualityScore: calibratedConfidence.calibrated,
                        baseQualityScore: qualityScore,
                        varietyScore: varietyCheck.varietyScore,
                        isRepetitive: varietyCheck.isSimilar,
                        scenarioId: scenarioId,
                        actionType: actionType,
                        responseLength: result.narrative.length,
                        explanationId: explanation?.responseId || null,
                        confidenceReliability: calibratedConfidence.reliability
                    }, { source: 'llmService' }).catch(err => {
                        // Don't block on event emission errors
                        console.warn('[LLM Service] Failed to emit quality event:', err.message);
                    });
                }
            }

            // Cache result
            this.cacheResponse(cacheKey, {
                narrative: result.narrative,
                provider: selectedProvider,
                model: selectedModel,
                qualityScore: qualityScore
            });

            // SPRINT 4: Update cache metrics
            this.updateCacheMetrics();

            // Track narrative progression (after narrative is generated)
            if (userId && result.narrative) {
                // Track progression event
                try {
                    const progressionResult = await narrativeProgressionService.trackEvent(userId, scenarioId, {
                        narrative: result.narrative,
                        actionType: rollData ? `${rollData.statName || 'unknown'}-${rollData.rollType || 'roll'}` : 'action',
                        rollData: rollData,
                        outcome: rollData?.success ? 'success' : (rollData?.failure ? 'failure' : 'partial'),
                        emotionalState: params.emotionalState || {},
                        relationships: params.relationships || {},
                        location: params.location || null,
                        timestamp: new Date().toISOString()
                    });

                // SPRINT 5: Store narrative as memory for future reference
                aiGMMemoryService.storeNarrativeMemory(userId, {
                    narrative: result.narrative,
                    sessionId: sessionId,
                    eventData: {
                        userMessage,
                        gameState: gameStateContext,
                        rollData: rollData,
                        progression: progressionResult?.progression || null,
                        storyStage: progressionResult?.storyStage || null
                    },
                    importance: 'normal'
                }).catch(err => {
                    console.warn('[LLM Service] Failed to store narrative memory:', err.message);
                });
                } catch (err) {
                    console.warn('[LLM Service] Failed to track progression:', err.message);
                }
            }

            return {
                narrative: result.narrative,
                provider: selectedProvider,
                model: selectedModel,
                cached: false,
                qualityScore: adjustedQualityScore,
                calibratedQualityScore: calibratedConfidence.calibrated,
                baseQualityScore: qualityScore,
                varietyScore: varietyCheck.varietyScore,
                isRepetitive: varietyCheck.isSimilar,
                confidenceInterval: calibratedConfidence.interval,
                confidenceReliability: calibratedConfidence.reliability,
                explanation: explanation,
                explanationId: explanation?.responseId || null,
                responseTime: responseTime,
                tokensUsed: result.tokensUsed || 0,
                cost: result.cost || 0
            };
        } catch (error) {
            console.error(`[LLM Service] Error generating narrative with ${selectedProvider}:`, error);
            
            // Track error
            this.trackError({
                provider: selectedProvider,
                model: selectedModel,
                error: error.message,
                timestamp: Date.now()
            });
            
            // Try fallback if enabled
            if (this.fallbackEnabled) {
                console.log('[LLM Service] Using fallback due to error');
                return this.getFallbackResponse(rollData);
            }
            
            throw error;
        }
    }

    /**
     * Generate text using LLM (wrapper for generateOpenAI/generateAnthropic)
     * Provides a unified interface for text generation
     */
    async generateText(prompt, options = {}) {
        const {
            model = 'gpt-4o-mini',
            systemPrompt = '',
            temperature = 0.7,
            maxTokens = 1000,
            provider = 'openai'
        } = options;

        if (provider === 'anthropic' || model.includes('claude')) {
            return await this.generateAnthropic(systemPrompt, prompt, model || 'claude-3-5-sonnet-20241022');
        } else {
            return await this.generateOpenAI(systemPrompt, prompt, model || 'gpt-4o-mini');
        }
    }

    /**
     * Generate narrative using OpenAI API
     */
    async generateOpenAI(systemPrompt, userPrompt, model) {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        // Ensure model is provided
        if (!model) {
            model = 'gpt-4o-mini'; // Default model
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openaiApiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature: 0.3, // Lower temperature for code fixes (more deterministic)
                max_tokens: 2000, // More tokens for code fixes
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const narrative = data.choices?.[0]?.message?.content?.trim();
        
        if (!narrative) {
            throw new Error('OpenAI API returned empty response');
        }
        
        // Calculate cost and tokens
        const tokensUsed = data.usage?.total_tokens || 0;
        const promptTokens = data.usage?.prompt_tokens || 0;
        const completionTokens = data.usage?.completion_tokens || 0;
        
        // Cost calculation (approximate, varies by model)
        const costPer1kTokens = {
            'gpt-4o-mini': { input: 0.15, output: 0.6 },
            'gpt-4o': { input: 2.5, output: 10.0 },
            'gpt-4-turbo': { input: 10.0, output: 30.0 },
            'gpt-3.5-turbo': { input: 0.5, output: 1.5 }
        };
        
        const modelCost = costPer1kTokens[model] || costPer1kTokens['gpt-4o-mini'];
        const cost = (promptTokens / 1000 * modelCost.input) + (completionTokens / 1000 * modelCost.output);

        return { 
            narrative,
            tokensUsed,
            promptTokens,
            completionTokens,
            cost
        };
    }

    /**
     * Generate narrative using Anthropic API
     */
    async generateAnthropic(systemPrompt, userPrompt, model) {
        if (!this.anthropicApiKey) {
            throw new Error('Anthropic API key not configured');
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.anthropicApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 2000, // More tokens for code fixes
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature: 0.3, // Lower temperature for code fixes (more deterministic)
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const narrative = data.content?.[0]?.text?.trim();
        
        if (!narrative) {
            throw new Error('Anthropic API returned empty response');
        }
        
        // Calculate cost and tokens
        const tokensUsed = data.usage?.input_tokens + data.usage?.output_tokens || 0;
        const promptTokens = data.usage?.input_tokens || 0;
        const completionTokens = data.usage?.output_tokens || 0;
        
        // Cost calculation (approximate, varies by model)
        const costPer1kTokens = {
            'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
            'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
            'claude-3-opus-20240229': { input: 15.0, output: 75.0 }
        };
        
        const modelCost = costPer1kTokens[model] || costPer1kTokens['claude-3-haiku-20240307'];
        const cost = (promptTokens / 1000 * modelCost.input) + (completionTokens / 1000 * modelCost.output);

        return { 
            narrative,
            tokensUsed,
            promptTokens,
            completionTokens,
            cost
        };
    }

    /**
     * Track LLM usage for analytics
     */
    trackUsage(data) {
        this.usageAnalytics.requests.push({
            ...data,
            timestamp: Date.now()
        });
        
        // Update cost tracking
        this.costTracking.totalCost += data.cost || 0;
        this.costTracking.requests++;
        this.costTracking.tokensUsed += data.tokens || 0;
        
        if (!this.costTracking.byProvider[data.provider]) {
            this.costTracking.byProvider[data.provider] = { cost: 0, requests: 0, tokens: 0 };
        }
        this.costTracking.byProvider[data.provider].cost += data.cost || 0;
        this.costTracking.byProvider[data.provider].requests++;
        this.costTracking.byProvider[data.provider].tokens += data.tokens || 0;
        
        if (!this.costTracking.byModel[data.model]) {
            this.costTracking.byModel[data.model] = { cost: 0, requests: 0, tokens: 0 };
        }
        this.costTracking.byModel[data.model].cost += data.cost || 0;
        this.costTracking.byModel[data.model].requests++;
        this.costTracking.byModel[data.model].tokens += data.tokens || 0;

        // SPRINT 4: Track API costs in Supabase
        if (data.cost > 0 || data.tokens > 0) {
            performanceTrackingService.trackAPICost({
                service: data.provider,
                operationType: data.model || 'unknown',
                costUsd: data.cost || 0,
                tokensUsed: data.tokens || 0,
                cacheUsed: data.cached || false,
                requestId: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                metadata: {
                    model: data.model,
                    responseTime: data.responseTime,
                    cached: data.cached || false
                }
            }).catch(err => {
                // Don't block on tracking errors
                console.warn('[LLM Service] Failed to track API cost:', err.message);
            });
        }
        
        // Track daily costs
        const today = new Date().toISOString().split('T')[0];
        if (!this.costTracking.daily[today]) {
            this.costTracking.daily[today] = { cost: 0, requests: 0, tokens: 0 };
        }
        this.costTracking.daily[today].cost += data.cost || 0;
        this.costTracking.daily[today].requests++;
        this.costTracking.daily[today].tokens += data.tokens || 0;
        
        // Track response times
        this.usageAnalytics.responseTimes.push(data.responseTime);
        
        // Keep only last 1000 requests
        if (this.usageAnalytics.requests.length > 1000) {
            this.usageAnalytics.requests.shift();
        }
    }
    
    /**
     * Track errors
     */
    trackError(errorData) {
        this.usageAnalytics.errors.push(errorData);
        
        // Keep only last 100 errors
        if (this.usageAnalytics.errors.length > 100) {
            this.usageAnalytics.errors.shift();
        }
    }
    
    /**
     * Score response quality - Enhanced for better quality assessment
     */
    scoreQuality(narrative, originalMessage) {
        let score = 0.5; // Base score
        
        // Length check (not too short, not too long)
        if (narrative.length >= 100 && narrative.length <= 500) {
            score += 0.1;
        } else if (narrative.length < 50) {
            score -= 0.2;
        } else if (narrative.length > 800) {
            score -= 0.05; // Too long can be overwhelming
        }
        
        // Relevance check (contains keywords from original message)
        const messageWords = originalMessage.toLowerCase().split(/\s+/);
        const narrativeLower = narrative.toLowerCase();
        const relevance = messageWords.filter(word => 
            word.length > 3 && narrativeLower.includes(word)
        ).length / Math.max(1, messageWords.length);
        score += relevance * 0.15; // Slightly reduced weight
        
        // Narrative quality indicators
        if (narrative.includes('You') || narrative.includes('you')) {
            score += 0.1; // Second person narrative
        }
        
        if (narrative.match(/[.!?]$/)) {
            score += 0.05; // Proper punctuation
        }
        
        // Check for specific, concrete details (quality indicator)
        const specificDetails = [
            /\d+/, // Numbers
            /[A-Z][a-z]+ (ship|station|planet|weapon|tool)/, // Specific objects
            /(red|blue|green|dark|bright|dim|glowing|flickering)/, // Visual details
            /(hum|buzz|roar|whisper|clang|hiss)/, // Sound details
            /(smell|scent|odor|aroma)/, // Smell details
            /(rough|smooth|cold|hot|wet|dry)/ // Texture/temperature
        ];
        const detailCount = specificDetails.filter(regex => regex.test(narrative)).length;
        score += Math.min(0.15, detailCount * 0.03); // Up to 0.15 for rich details
        
        // Check for variety (avoid repetition)
        const sentences = narrative.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const uniqueStarts = new Set(sentences.map(s => s.trim().substring(0, 10).toLowerCase()));
        const varietyScore = uniqueStarts.size / Math.max(1, sentences.length);
        score += varietyScore * 0.1; // Reward variety
        
        // Check for emotional engagement
        const emotionalWords = [
            'desperate', 'triumph', 'relief', 'tension', 'fear', 'excitement',
            'despair', 'hope', 'dread', 'elation', 'panic', 'calm', 'urgent',
            'frantic', 'confident', 'uncertain', 'desperate', 'determined'
        ];
        const hasEmotion = emotionalWords.some(word => narrative.toLowerCase().includes(word));
        if (hasEmotion) {
            score += 0.1; // Emotional engagement
        }
        
        // Check for narrative progression (references to past/future)
        const progressionIndicators = [
            /(before|after|earlier|later|now|then|finally|suddenly)/,
            /(remember|recall|forget|remind)/,
            /(continue|proceed|next|then)/
        ];
        const hasProgression = progressionIndicators.some(regex => regex.test(narrative.toLowerCase()));
        if (hasProgression) {
            score += 0.05; // Narrative continuity
        }
        
        // Check for generic responses (penalty)
        const genericPhrases = [
            'you succeed', 'you fail', 'it works', 'it doesn\'t work',
            'you manage to', 'you try to', 'you attempt to', 'you decide to'
        ];
        const genericCount = genericPhrases.filter(phrase => 
            narrative.toLowerCase().includes(phrase)
        ).length;
        score -= Math.min(0.2, genericCount * 0.05); // Penalty for generic language
        
        // Check for action verbs (quality indicator)
        const actionVerbs = [
            'dash', 'leap', 'dive', 'sprint', 'stumble', 'weave', 'navigate',
            'hack', 'negotiate', 'persuade', 'threaten', 'evade', 'confront'
        ];
        const hasActionVerb = actionVerbs.some(verb => narrative.toLowerCase().includes(verb));
        if (hasActionVerb) {
            score += 0.05; // Dynamic action
        }
        
        return Math.max(0, Math.min(1, score));
    }
    
    /**
     * Filter response for safety and quality
     */
    filterResponse(narrative) {
        let filtered = narrative;
        
        // Length filtering
        if (filtered.length > this.responseFilters.maxLength) {
            filtered = filtered.substring(0, this.responseFilters.maxLength) + '...';
        }
        
        if (filtered.length < this.responseFilters.minLength) {
            // Pad with generic text if too short
            filtered = filtered + ' The situation develops.';
        }
        
        // Basic profanity check (simple word list)
        if (this.responseFilters.checkProfanity) {
            const blockedWords = this.responseFilters.blockedWords;
            blockedWords.forEach(word => {
                const regex = new RegExp(word, 'gi');
                filtered = filtered.replace(regex, '***');
            });
        }
        
        return filtered;
    }
    
    /**
     * Get fallback response when LLM fails or quality is low
     */
    getFallbackResponse(rollData) {
        let template;
        
        if (rollData) {
            const roll = rollData.roll || 0;
            const statValue = rollData.statValue || 50;
            
            if (roll >= statValue + 20) {
                template = this.fallbackTemplates.criticalSuccess;
            } else if (roll >= statValue) {
                template = this.fallbackTemplates.success;
            } else if (roll <= statValue - 20) {
                template = this.fallbackTemplates.criticalFailure;
            } else {
                template = this.fallbackTemplates.failure;
            }
        } else {
            template = this.fallbackTemplates.success;
        }
        
        const narrative = template[Math.floor(Math.random() * template.length)];
        
        return {
            narrative: narrative,
            provider: 'fallback',
            model: 'template',
            cached: false,
            qualityScore: 0.5,
            fallback: true
        };
    }
    
    /**
     * Generate using local model (placeholder for future implementation)
     */
    async generateLocal(systemPrompt, userPrompt, model) {
        // Placeholder for local model integration (Ollama, etc.)
        // For now, throw error to trigger fallback
        throw new Error('Local model not yet implemented');
    }
    
    /**
     * Get usage statistics
     */
    getUsageStats() {
        const avgResponseTime = this.usageAnalytics.responseTimes.length > 0
            ? this.usageAnalytics.responseTimes.reduce((a, b) => a + b, 0) / this.usageAnalytics.responseTimes.length
            : 0;
        
        const cacheHitRate = (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses) > 0
            ? this.usageAnalytics.cacheHits / (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses)
            : 0;
        
        const avgQualityScore = this.qualityScores.length > 0
            ? this.qualityScores.reduce((a, b) => a + b, 0) / this.qualityScores.length
            : 0;
        
        return {
            totalRequests: this.costTracking.requests,
            totalCost: this.costTracking.totalCost,
            totalTokens: this.costTracking.tokensUsed,
            avgResponseTime: avgResponseTime,
            cacheHitRate: cacheHitRate,
            avgQualityScore: avgQualityScore,
            byProvider: this.costTracking.byProvider,
            byModel: this.costTracking.byModel,
            daily: this.costTracking.daily,
            errors: this.usageAnalytics.errors.length
        };
    }
    
    /**
     * Optimize prompt for better results
     */
    optimizePrompt(templateType, context) {
        const template = this.promptTemplates[templateType];
        if (!template) {
            return { system: BASE_SYSTEM_PROMPT, user: context };
        }
        
        return {
            system: template.system,
            user: typeof template.user === 'function' 
                ? template.user(context.action, context.gameState, context.roll)
                : template.user
        };
    }
    
    /**
     * Generate cache key from parameters
     */
    generateCacheKey(userMessage, gameStateContext, rollData) {
        const rollKey = rollData 
            ? `${rollData.rollType}-${rollData.statName}-${rollData.roll}-${rollData.statValue}`
            : 'no-roll';
        return `llm_${userMessage.substring(0, 50)}_${gameStateContext.substring(0, 50)}_${rollKey}`;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            available: this.isAvailable(),
            providers: {
                openai: this.available.openai,
                anthropic: this.available.anthropic,
                local: false // Placeholder for future local model support
            },
            defaultProvider: this.defaultProvider,
            defaultModels: this.defaultModel,
            fallbackEnabled: this.fallbackEnabled,
            minQualityScore: this.minQualityScore
        };
    }
    
    /**
     * Update configuration
     */
    updateConfig(config) {
        if (config.defaultProvider) {
            this.defaultProvider = config.defaultProvider;
        }
        if (config.defaultModel) {
            Object.assign(this.defaultModel, config.defaultModel);
        }
        if (config.fallbackEnabled !== undefined) {
            this.fallbackEnabled = config.fallbackEnabled;
        }
        if (config.minQualityScore !== undefined) {
            this.minQualityScore = config.minQualityScore;
        }
        if (config.cacheTTL !== undefined) {
            this.cacheTTL = config.cacheTTL;
        }
    }
}

// Export singleton instance
module.exports = new LLMService();

