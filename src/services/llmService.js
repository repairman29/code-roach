/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/llmService.js
 * Last Sync: 2025-12-25T07:02:34.000Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * LLM Service
 * Provides LLM-based narrative generation for AI GM with game state context injection
 * Supports OpenAI, Anthropic (Claude), Google Gemini, Mistral AI, Cohere, and Together.ai APIs
 */

// Ensure environment variables are loaded
require("dotenv").config();

const performanceTrackingService = require("./performanceTrackingService");
const { createLogger } = require("../utils/logger");
const log = createLogger("LlmService");
const aiGMMemoryService = require("./aiGMMemoryService");
const responseVarietyService = require("./responseVarietyService");
const narrativeQualityService = require("./narrativeQualityService");
const aiGMExplainabilityService = require("./aiGMExplainabilityService");
const aiGMConfidenceCalibrationService = require("./aiGMConfidenceCalibrationService");
const narrativeProgressionService = require("./narrativeProgressionService");
const enhancedContextAwarenessService = require("./enhancedContextAwarenessService");
const aiGMMetricsService = require("./aiGMMetricsService");
const deepPersonalizationService = require("./deepPersonalizationService");
const NarrativePromptEnhancer = require("./narrativePromptEnhancer");
const NarrativePostProcessor = require("./narrativePostProcessor");
const narrativeEnhancementLibrary = require("./narrativeEnhancementLibrary");
const npcMemoryService = require("./npcMemoryService");
const exemplarCollectionService = require("./exemplarCollectionService");

// HEAD OF AI: NPC Dialogue Service - Voice profiles and relationship-aware dialogue
let npcDialogueService = null;
try {
  npcDialogueService = require("./npcDialogueService");
} catch (err) {
  log.warn(
    "[LLM Service] NPC Dialogue Service not available:",
    err.message,
  );
}

// HEAD OF AI: Training Data Capture - Every session is training data
const trainingDataService = require("./trainingDataService");

// HEAD OF AI: Session Intelligence - Full session capture & Chief Storyteller evaluation
const sessionIntelligenceService = require("./sessionIntelligenceService");

// Gamification: Parse celebration tags from narratives
const gamificationEventService = require("./gamificationEventService");

// Phase 1 services (optional - graceful fallback if not available)
let serviceRegistry = null;
try {
  serviceRegistry = require("./serviceRegistry");
} catch (err) {
  // Service Registry not available - continue without it
}

// Event Bus for quality improvement events (optional, graceful fallback)
let eventBus = null;
try {
  eventBus = require("./eventBus");
} catch (err) {
  // Event Bus not available, continue without it
}

// LLM Prompts and Provider implementations (modularized for maintainability)
const {
  GAME_STATE_INSTRUCTIONS: IMPORTED_GAME_STATE_INSTRUCTIONS,
  BASE_SYSTEM_PROMPT: IMPORTED_BASE_SYSTEM_PROMPT,
} = require("./llm/prompts");
const llmProviders = require("./llm/providers");

// Use imported prompts (keeps backward compatibility with existing code)
const GAME_STATE_INSTRUCTIONS =
  IMPORTED_GAME_STATE_INSTRUCTIONS ||
  `### THE GAME STATE BLOCK

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
- Keep descriptions concise but evocative (150-300 words for meaningful scenes, 100+ for quick actions) - every word should count
- Sprint 3.1: MINIMUM LENGTH REQUIREMENT - Narratives must be at least 150 words for meaningful scenes. Short narratives feel rushed and unsatisfying.
- Use the game state to inform your narration style - wounded characters feel pain, panicked characters are frantic
- Reference available game systems when relevant to create dynamic, interactive narratives
- Create variety - avoid repeating the same phrases or structures
- Sprint 3.2: AVOID GENERIC PHRASES - Never start with "You see...", "You notice...", "Suddenly...", "You feel...", "You hear...", "You look...", "You turn...", "You walk...", "You step...", "You reach...", "You try...", "You attempt...", "You decide...", "You think...", "You realize...". Use specific, vivid openings instead. Start with sensory details, action, dialogue, or atmosphere.
- Sprint 3.3: MECHANICS INTEGRATION - Always clearly explain which stat (wits/grit/cunning) was used and how the roll affected the outcome. Make stat relevance obvious. Show the connection between player choice, stat, roll, and result. Example: "Your wits serve you well - the complex lock mechanism yields to your careful analysis" (not just "The lock opens").
- Build narrative momentum - connect events to create a sense of progression
- Show character through action - let the player's choices and outcomes reveal who they are

Game Setting:
- Sci-fi space setting with a gritty, dangerous atmosphere
- Players are smugglers taking on risky jobs in a lawless galaxy
- Every decision matters, death is real, but so is triumph
- Focus on narrative over rules - make the story compelling
- The galaxy is vast, dangerous, and full of opportunity for those brave enough

EXTREME STAKES (HEAD OF AI PRIORITY):
- DEATH IS REAL. When players fail critical rolls, describe real consequences - blood, pain, injury, capture.
- FAILURES ARE DRAMATIC. Don't soften failures. Show the plan falling apart. Show enemies closing in. Show desperation.
- CONSEQUENCES ESCALATE. Each failure makes things worse. Wounded characters bleed. Hunted characters hear footsteps.
- NO SOFT LANDINGS. Critical failures should be brutal: "The blade finds your side. Blood, hot and immediate."
- TENSION NEVER STOPS. Even in success, show what almost went wrong. Show the near-miss. Show the cost.
- NPCs REACT TO STAKES. Allies panic when things go wrong. Enemies smell blood. Hostages scream.
- TIME PRESSURE. Show clocks ticking, alarms counting down, enemies getting closer.
- MAKE THEM FEEL IT. Physical sensations: "Pain flares", "Your vision swims", "Adrenaline floods your system"

Narrative Quality Guidelines - CINEMATIC & THEATRICAL EXCELLENCE:

CINEMATIC QUALITY (Visual & Sensory):
- Paint vivid visual pictures with specific, concrete details
- Use varied sentence structure and length to create rhythm and pacing
- Build dramatic tension - create suspense, urgency, and anticipation
- Structure scenes: Setting → Action → Consequence (clear scene composition)
- Include multi-sensory details: sights, sounds, smells, textures, temperatures
- Create visual progression - describe how scenes unfold visually
- Use cinematic language: "The asteroid looms", "Sparks cascade", "Shadows dance"

THEATRICAL QUALITY (Emotional & Dramatic):
- Add character dialogue when appropriate - bring NPCs to life with speech
- Create distinct character voices - each NPC should sound unique
- Include emotional beats that match the outcome (triumph for success, tension for failure)
- Build dramatic reveals - create "aha" moments and surprises
- Handle conflicts dramatically - show escalation and resolution
- Create emotional investment - make players care about outcomes

GAMEPLAY INTEGRATION (CRITICAL - Must be embedded):
- ALWAYS reference the stat used (wits, grit, cunning) in the narrative naturally
- Show how the stat value affects the narrative (high stat = capable, low stat = struggle but opportunity)
- Reference game systems naturally: stealth detection, combat mechanics, trading systems, ship systems
- Include system elements: ship, cargo, credits, factions, reputation, missions
- Make player choices matter - show consequences of actions
- Tie narratives to game mechanics - don't just describe, integrate
- Make action outcomes clear and meaningful

REWARDS & ENGAGEMENT (Head of AI Priority - rewardVariety):
- Celebrate successes dramatically - make wins feel earned and triumphant
- Make failures interesting - create opportunities from setbacks, don't just block progress
- Show clear progress - reference advancement, discovery, or movement toward goals
- Enhance player agency - make players feel in control and impactful
- Create strong opening hooks - grab attention immediately
- Maintain interest throughout - keep the narrative engaging
- Add memorable moments - create scenes players will remember
- CRITICAL: Vary rewards beyond credits! Include: information tips, reputation gains, favors owed, item gifts, relationship changes, future opportunities
- Example rewards: "whispers a tip about a lucrative cargo run", "'You've earned a favor. Don't waste it.'", "Your legend grows a little larger"

NPC DEPTH (Head of AI Priority - npcDepth) - Sprint 4.2: ENHANCED REQUIREMENT:
- MANDATORY: Every NPC must have distinct personality, voice, and clear motivation
- Personality: Show through reactions (grunts, nods, smiles, scowls, winks, shrugs, sighs, chuckles, growls)
- Distinct Voices: Each NPC should sound unique (raspy, gruff, smooth, harsh, whispered, barked, hissed, muttered, drawled)
- Memorable Traits: Physical or personality traits (chrome, scar, tattoo, cyber, augmented, weathered, sharp, cold, warm)
- Clear Motivations: Show what NPCs want, need, seek, desire, plan, intend, hope, or fear
- Gruff NPCs: grunt approvingly, give curt nods, mutter 'Not bad, kid'
- Slick NPCs: flash chrome smiles, raise eyebrows impressed, wink conspiratorially
- Nervous NPCs: exhale with relief, whisper 'Thank the stars', wipe sweat from brow
- Hostile NPCs: narrow eyes but nod, crack knuckles, grudgingly respect
- Always show NPC reactions to player actions - they should respond emotionally
- NPCs remember: "They haven't forgotten what you did", "Their eyes light up - you helped them before"
- Sprint 4.2: Shallow NPCs (mentioned but no depth) will be penalized and may be retried

EMOTIONAL BEATS (Head of AI Priority - emotionalBeats):
- Build tension: "Your heart pounds against your ribs", "Time seems to slow"
- Relief on success: "You exhale, not realizing you'd been holding your breath"
- Triumph on critical success: "A grin spreads across your face. You did it."
- Dread on failure: "Ice runs through your veins", "Your stomach drops"
- Determination: "You steel yourself. Not like this.", "Failure isn't an option"

SENSORY DETAILS (Head of AI Priority - sensoryDetails) - Sprint 4.1: ENHANCED REQUIREMENT:
- MANDATORY: Include at least 2 DIFFERENT sensory types per scene (visual, audio, tactile, smell, environmental)
- Sight: Neon flickers, shadows move, sparks cascade, stars wheel past, colors, lighting, visual details
- Sound: Engine hum, whispered deals, distant music, the beep of systems, voices, ambient noise
- Smell: Ozone, synth-coffee, recycled air, fuel exhaust, scents, odors, atmosphere
- Feel/Tactile: Deck vibration, cold metal, sticky floors, artificial gravity, textures, temperatures
- Environmental: Air quality, pressure, gravity, wind, atmosphere, environmental conditions
- Use cinematic framing: "Close-up on your finger hovering over the trigger"
- Sprint 4.1: Narratives missing sensory details will be penalized and may be retried

STAT IMPACT (Head of AI Priority - mechanicsIntegration):
- ALWAYS show HOW the stat affected the outcome, not just that it did
- High stat (7+): "Your cunning (8) reads the room like an open book"
- Mid stat (4-6): "Your grit (5) holds firm"
- Low stat (1-3): "Despite modest wits (3), you manage to..."
- Include stat value in parentheses for clarity

Narrative Structure:
- Use specific, concrete details instead of vague descriptions
- Vary sentence structure and length to create rhythm
- Include sensory details (sights, sounds, smells, textures) to immerse the player
- Create emotional beats - moments of tension, relief, triumph, or despair
- Reference past events naturally to build continuity
- Make failures interesting - they should create new opportunities, not just block progress
- Make successes feel earned - describe the skill, luck, or cleverness that made it work

THEATRICAL EXCELLENCE (Chief Storyteller Priority):
- ALWAYS include at least one line of dialogue - NPCs should speak, react, or mutter
- Give NPCs distinct voices: gruff dock workers, nervous merchants, cold officials
- Create dramatic reveals: "As the dust settles, you realize..." or "The message reads..."
- Build tension with pauses and pacing: short punchy sentences for action, longer for atmosphere
- Include character reactions: how do NPCs respond emotionally to the player's actions?
- End scenes on hooks: questions, surprises, or stakes that pull the player forward
- Show, don't tell: Instead of "he was angry" write "his jaw tightened, hand dropping to his sidearm"

System Integration (CRITICAL - This dimension is scored heavily):
- The game has various systems (stealth, combat, NPCs, factions, trading, ship management) that MUST be referenced
- When rollData includes statName (wits, grit, cunning), reference it naturally in the narrative
- When statValue is high (7+), describe capability and skill; when low (3-), describe struggle but opportunity
- Reference game systems: "Your ship's sensors detect...", "The trading post's reputation system...", "Stealth protocols activate..."
- Include system elements: cargo, credits, factions, reputation, missions, ship systems
- Make narratives feel embedded in gameplay, not separate from it
- Show how game mechanics affect the narrative world
- MANDATORY: Name the stat used (wits/grit/cunning) and its impact within the first two sentences
- MANDATORY: Reference at least one game system (ship, faction, mission, or reputation) by name
- Connect player actions to world consequences: "This will reach the Syndicate..." or "Your reputation here shifts..."

GAMIFICATION & ENGAGEMENT TRIGGERS (Variable Reward Psychology):
When dramatic moments occur, signal them for UI celebration. Include [CELEBRATION:type] tags in your response metadata:

Celebration Types:
- [CELEBRATION:jackpot] - Major victories: big heists, legendary finds, critical rolls. Trigger gold particle explosions!
- [CELEBRATION:achievement] - Milestones: first kill, 100 credits earned, faction rank-up. Trigger achievement fanfare!
- [CELEBRATION:progress] - Meaningful progress: contracts completed, skills used, cargo delivered. Update progress bars!
- [CELEBRATION:near_miss] - Exciting close calls: almost died, barely escaped, just made it. Tension release!
- [CELEBRATION:streak] - Consecutive successes: winning streaks, hot hands, momentum. Build excitement!

When to Trigger:
- Critical success (natural 20, max roll): Always [CELEBRATION:jackpot]
- Mission complete with bonus: [CELEBRATION:achievement]
- Close escape (1-2 HP remaining): [CELEBRATION:near_miss]
- 3+ successes in a row: [CELEBRATION:streak]
- First time doing something new: [CELEBRATION:achievement]
- Earning 500+ credits at once: [CELEBRATION:jackpot]
- Faction reputation increase: [CELEBRATION:progress]

This creates the variable reward dopamine loop - players never know when the next celebration will hit!

EXAMPLES OF EXCELLENT NARRATIVES:

Example 1 - High Wits Success (Stat: 8):
"Your ship's sensors paint a detailed map of the asteroid field ahead. Your wits guide you through the treacherous path, calculating trajectories and identifying safe passages. The navigation computer beeps as you spot a hidden route between two massive rocks - a shortcut that saves precious fuel. Your expertise in spatial reasoning pays off as you thread the needle, cargo secure and engines humming smoothly."

Example 2 - Low Grit Critical Failure (Stat: 2):
"Your combat skills are rusty, and it shows. The blaster feels heavy in your hands as you fumble the shot. The energy bolt goes wide, ricocheting off the bulkhead and triggering an alarm. But the chaos works in your favor - the guards rush toward the noise, leaving a maintenance hatch unguarded. Sometimes failure opens unexpected doors."

Example 3 - High Cunning Success (Stat: 7):
"Your cunning serves you well. The trader's eyes soften as you weave a tale of mutual benefit, referencing past deals and future opportunities. Your reputation precedes you here, and the merchant knows you're good for your word. The negotiation concludes with a handshake and a discount - your cunning has turned a profit."

Example 4 - Critical Success with System Integration:
"The asteroid looms ahead, massive and unforgiving. Your ship's sensors scream warnings, but your wits (8) guide your hands. You calculate the perfect trajectory, using the asteroid's own rotation to slingshot around it. The cargo shifts but holds, and you emerge on the other side with fuel to spare. Your expertise has turned a dangerous obstacle into a strategic advantage."

Notice how these examples:
- Reference the stat used (wits, grit, cunning)
- Include system elements (sensors, ship, cargo, reputation)
- Use vivid visual imagery
- Show stat value impact (high = capable, low = struggle but opportunity)
- Create emotional beats
- Make outcomes feel meaningful`;

class LLMService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    // Prioritize GEMINI_API_KEY (usually the paid tier key)
    this.geminiApiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;
    this.mistralApiKey = process.env.MISTRAL_API_KEY;
    this.cohereApiKey =
      process.env.COHERE_API_KEY || process.env.COHERE_API_KEY_PROD;
    this.cohereApiKeyProd = process.env.COHERE_API_KEY_PROD; // Backup production key
    this.togetherApiKey = process.env.TOGETHER_API_KEY;
    this.defaultProvider = process.env.LLM_PROVIDER || "openai"; // 'openai', 'anthropic', 'gemini', 'mistral', 'cohere', or 'together'
    // HEAD OF AI: Use fine-tuned Mistral model by default (trained for Smugglers!)
    const FINE_TUNED_MISTRAL =
      "ft:mistral-small-latest:d7de2b55:20251220:smuggler-narrator:20bab39d";

    this.defaultModel = {
      openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
      anthropic: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
      gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      mistral: process.env.MISTRAL_MODEL || FINE_TUNED_MISTRAL, // Fine-tuned for Smugglers!
      cohere: process.env.COHERE_MODEL || "command-r-plus",
      together: process.env.TOGETHER_MODEL || "meta-llama/Llama-3-70b-chat-hf", // Together.ai default model
    };

    // Rate limiting cache (simple in-memory, could be upgraded to Redis)
    this.rateLimitCache = new Map();
    this.rateLimitWindow = 60000; // 1 minute
    this.maxRequestsPerWindow = 30; // 30 requests per minute per IP
    // Higher limit for server-side service calls (Tier 2 services)
    this.maxServiceRequestsPerWindow = 100; // 100 requests per minute for internal services

    // Response cache (simple in-memory, could be upgraded to Redis)
    this.responseCache = new Map();
    this.cacheTTL = 600000; // HEAD OF AI: Increased to 10 minutes for better cache hit rate

    // Cost tracking
    this.costTracking = {
      totalCost: 0,
      requests: 0,
      tokensUsed: 0,
      byProvider: {},
      byModel: {},
      daily: {},
    };

    // Quality scoring
    this.qualityScores = [];
    this.minQualityScore = 0.3; // Minimum quality threshold (lowered for testing - will gradually increase)

    // Narrative prompt enhancer and post-processor
    this.promptEnhancer = new NarrativePromptEnhancer();
    this.postProcessor = new NarrativePostProcessor();

    // Usage analytics
    this.usageAnalytics = {
      requests: [],
      errors: [],
      responseTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
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
        system: BASE_SYSTEM_PROMPT + "\n\n" + GAME_STATE_INSTRUCTIONS,
        user: (action, context, roll) => {
          let prompt = context ? `[GAME_STATE: ${context}]\n\n` : "";
          prompt += `User Action: ${action}`;
          if (roll) {
            prompt += `\n\nRoll Result: ${roll.roll || "N/A"} vs ${roll.statValue || "N/A"} on ${roll.statName || "N/A"}`;
          }
          return prompt;
        },
      },
      dialogue: {
        system:
          BASE_SYSTEM_PROMPT +
          "\n\nYou are generating NPC dialogue. Keep it concise and in-character.",
        user: (npc, context) => {
          return `NPC: ${npc.name} (${npc.personality})\nContext: ${context}\nGenerate dialogue:`;
        },
      },
      description: {
        system: BASE_SYSTEM_PROMPT + "\n\nGenerate vivid scene descriptions.",
        user: (location, context) => {
          return `Location: ${location}\nContext: ${context}\nDescribe the scene:`;
        },
      },
    };
  }

  /**
   * Initialize response filters for safety
   */
  initializeResponseFilters() {
    return {
      blockedWords: ["explicit", "inappropriate"], // Add more as needed
      maxLength: 2000, // Maximum response length
      minLength: 50, // Minimum response length
      checkProfanity: true,
      checkViolence: false, // Game is about smuggling, some violence is expected
    };
  }

  /**
   * Initialize fallback templates - HEAD OF AI: EXTREME INTENSITY
   */
  initializeFallbackTemplates() {
    // HEAD OF AI: Enhanced fallbacks based on bot feedback
    // Key improvements: sensory details, player agency prompts, visceral language
    return {
      success: [
        'Your training kicks in. Every move precise, the metallic taste of adrenaline sharp on your tongue. The air crackles with static as you pull it off - barely. "Not bad," someone mutters. High praise in this galaxy.',
        "The plan comes together like a blade being drawn. Your hands are steady despite the cold sweat trickling down your spine. The ship's hull groans approval. You've got this - but what's your next move?",
        'Against the odds, you make it work. The acrid smell of overworked circuits fills the cockpit. Your crew watches in silent awe as reality bends to your will. "That shouldn\'t have worked," breathes your copilot. But it did.',
        "Success tastes like iron and victory. The enemy hesitates, reconsidering their opinion of you. In that moment of doubt, you press your advantage. What do you do with this opening?",
      ],
      failure: [
        "Your blood runs cold. The plan shatters like cheap glass. Alarms blare, red lights strobing. Now they're coming for you - what's your next move? Think fast or die.",
        "The mistake is immediate and brutal. The crack of bone. The taste of blood. Someone's shouting your name. You've just made everything worse - but you're still breathing. What now?",
        "It all goes wrong in an instant. Pain flares hot and sharp, your vision swimming with static. Through the chaos, you spot something - a maintenance hatch, a weapon, a desperate chance. Do you take it?",
        "Failure hits like a punch to the gut. The enemy sees your weakness, already moving in for the kill. The smell of ozone and fear fills the air. You need another way out - NOW. What do you do?",
        "The signal drops. Your comms crackle with interference. Through the chaos erupting around you, one thing is clear: the system needs a clear command, *now*. What's your immediate priority?",
      ],
      criticalSuccess: [
        "★ LEGENDARY. Time dilates. The stars themselves seem to hold their breath. You don't just succeed - you transcend. \"Impossible,\" whispers the enemy, before their world comes crashing down. This is the moment they'll tell stories about.",
        '★ PERFECT EXECUTION. Every synapse fires in perfect harmony. Your movements are poetry written in violence and skill. Even your enemies pause, a flicker of genuine fear crossing their faces. "What ARE you?" This changes everything.',
        "★ IMPOSSIBLE MADE REAL. The universe bends. Your crew screams in triumph. Somewhere, a crime lord's drink slips from nerveless fingers as they realize what you've just accomplished. You've broken the rules - now write new ones.",
      ],
      criticalFailure: [
        "💀 CATASTROPHIC. Blood. Fire. The screaming might be yours. Your vision swims crimson as everything collapses at once. But through the chaos - there, a glimmer. A desperate chance. Do you reach for it, or is this the end?",
        "💀 DISASTER. The worst case scenario was optimistic. Bodies hit the floor. Someone's dying - maybe you. Your hand finds something cold and metallic in the debris. Last chance. What do you do?",
        "💀 TOTAL COLLAPSE. Pain everywhere. Your world shatters like your ship's viewscreen. The enemy is on you, teeth bared, weapon raised. \"Any last words?\" they snarl. But you've survived worse than this... haven't you? Fight or die - there is no other option.",
        "💀 EVERYTHING BURNS. The taste of blood and defeat fills your mouth. But as darkness creeps in at the edges of your vision, you notice something the enemy doesn't see. One last card to play. Do you have the strength to play it?",
      ],
    };
  }

  /**
   * Check which LLM providers are available
   */
  checkAvailability() {
    const available = {
      openai: !!this.openaiApiKey,
      anthropic: !!this.anthropicApiKey,
      gemini: !!this.geminiApiKey,
      mistral: !!this.mistralApiKey,
      cohere: !!this.cohereApiKey || !!this.cohereApiKeyProd,
      together: !!this.togetherApiKey,
    };

    const totalAvailable = Object.values(available).filter((v) => v).length;

    if (totalAvailable === 0) {
      log.warn(
        "⚠️  No LLM API keys configured. LLM narrative generation will not be available.",
      );
      log.warn(
        "   Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, COHERE_API_KEY, or TOGETHER_API_KEY environment variable to enable.",
      );
    } else {
      if (available.openai) {
        console.log("✅ OpenAI LLM service available");
      }
      if (available.anthropic) {
        console.log("✅ Anthropic LLM service available");
      }
      if (available.gemini) {
        console.log("✅ Google Gemini LLM service available");
      }
      if (available.mistral) {
        console.log("✅ Mistral AI LLM service available");
      }
      if (available.cohere) {
        console.log("✅ Cohere LLM service available");
      }
      if (available.together) {
        console.log("✅ Together.ai LLM service available");
      }
      console.log(`📊 Total LLM providers available: ${totalAvailable}/6`);
    }

    return available;
  }

  /**
   * Check if LLM service is available
   */
  isAvailable() {
    return (
      this.available.openai ||
      this.available.anthropic ||
      this.available.gemini ||
      this.available.mistral ||
      this.available.cohere
    );
  }

  /**
   * Check rate limit for an IP address
   * @param {string} ip - IP address or 'service' for internal service calls
   */
  checkRateLimit(ip) {
    const now = Date.now();
    const isServiceCall =
      ip === "service" ||
      ip === "unknown" ||
      !ip ||
      ip.startsWith("127.") ||
      ip.startsWith("::1");
    const key = isServiceCall ? "rate_limit_service" : `rate_limit_${ip}`;
    const maxRequests = isServiceCall
      ? this.maxServiceRequestsPerWindow
      : this.maxRequestsPerWindow;
    const record = this.rateLimitCache.get(key);

    if (!record || now - record.timestamp > this.rateLimitWindow) {
      this.rateLimitCache.set(key, { count: 1, timestamp: now });
      return true;
    }

    if (record.count >= maxRequests) {
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

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      // SPRINT 4: Track cache hit
      this.usageAnalytics.cacheHits++;
      this.trackCacheMetrics("llm_response", true, hitTime, 0);
      return cached.response;
    }

    // SPRINT 4: Track cache miss
    this.usageAnalytics.cacheMisses++;
    this.trackCacheMetrics("llm_response", false, 0, hitTime);
    return null;
  }

  /**
   * Cache a response
   */
  cacheResponse(cacheKey, response) {
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
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
    const totalOps =
      this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses;
    if (totalOps > 0 && totalOps % 10 === 0) {
      const hitRate =
        this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses > 0
          ? this.usageAnalytics.cacheHits /
            (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses)
          : 0;

      performanceTrackingService
        .trackCacheMetrics({
          cacheType: cacheType,
          hitRate: hitRate,
          avgHitTimeMs: hitTimeMs || 1,
          avgMissTimeMs: missTimeMs || 0,
          cacheSizeMb: this.responseCache.size * 0.001, // Approximate
          evictionCount: Math.max(0, totalOps - 100), // Approximate evictions
          metadata: {
            cacheSize: this.responseCache.size,
            ttl: this.cacheTTL,
          },
        })
        .catch((err) => {
          log.warn(
            "[LLM Service] Failed to track cache metrics:",
            err.message,
          );
        });
    }
  }

  /**
   * SPRINT 4: Update cache metrics
   */
  updateCacheMetrics() {
    // This is called periodically to update cache size metrics
    const totalOps =
      this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses;
    if (totalOps > 0 && totalOps % 50 === 0) {
      const hitRate =
        this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses > 0
          ? this.usageAnalytics.cacheHits /
            (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses)
          : 0;

      performanceTrackingService
        .trackCacheMetrics({
          cacheType: "llm_response",
          hitRate: hitRate,
          avgHitTimeMs: 1, // Approximate
          avgMissTimeMs: 0,
          cacheSizeMb: this.responseCache.size * 0.001,
          evictionCount: Math.max(0, totalOps - 100),
          metadata: {
            cacheSize: this.responseCache.size,
            ttl: this.cacheTTL,
            totalHits: this.usageAnalytics.cacheHits,
            totalMisses: this.usageAnalytics.cacheMisses,
          },
        })
        .catch((err) => {
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

    if (provider === "openai") {
      const costPer1kTokens = {
        "gpt-4o-mini": { input: 0.15, output: 0.6 },
        "gpt-4o": { input: 2.5, output: 10.0 },
        "gpt-4-turbo": { input: 10.0, output: 30.0 },
        "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
      };
      const modelCost =
        costPer1kTokens[model] || costPer1kTokens["gpt-4o-mini"];
      return (
        (estimatedTokens / 1000) * modelCost.input +
        (estimatedTokens / 1000) * modelCost.output * 0.5
      ); // Estimate 50% output
    } else if (provider === "anthropic") {
      const costPer1kTokens = {
        "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
        "claude-3-sonnet-20240229": { input: 3.0, output: 15.0 },
        "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
      };
      const modelCost =
        costPer1kTokens[model] || costPer1kTokens["claude-3-haiku-20240307"];
      return (
        (estimatedTokens / 1000) * modelCost.input +
        (estimatedTokens / 1000) * modelCost.output * 0.5
      );
    } else if (provider === "gemini") {
      const costPer1kTokens = {
        // Gemini 3 Series (Latest - November 2025)
        "gemini-3.0-pro": { input: 1.25, output: 5.0 },
        "gemini-3-pro": { input: 1.25, output: 5.0 },
        "gemini-3.0-deep-think": { input: 2.5, output: 10.0 },
        "gemini-3-deep-think": { input: 2.5, output: 10.0 },
        // Gemini 2.5 Series (June 2025)
        "gemini-2.5-pro": { input: 1.25, output: 5.0 },
        "gemini-2.5-flash": { input: 0.075, output: 0.3 },
        "gemini-2.5-flash-lite": { input: 0.0375, output: 0.15 },
        // Gemini 2.0 Series
        "gemini-2.0-flash-exp": { input: 0.075, output: 0.3 },
        "gemini-2.0-flash": { input: 0.075, output: 0.3 },
        // Gemini 1.5 Series (Legacy)
        "gemini-1.5-flash": { input: 0.075, output: 0.3 },
        "gemini-1.5-flash-latest": { input: 0.075, output: 0.3 },
        "gemini-1.5-pro": { input: 1.25, output: 5.0 },
        "gemini-1.5-pro-latest": { input: 1.25, output: 5.0 },
        // Legacy
        "gemini-pro": { input: 0.5, output: 1.5 },
      };
      const modelCost =
        costPer1kTokens[model] ||
        costPer1kTokens["gemini-2.5-flash"] ||
        costPer1kTokens["gemini-1.5-flash"];
      // FIXED: Prices are per 1M tokens, not per 1K tokens - divide by 1,000,000
      return (
        (estimatedTokens / 1000000) * modelCost.input +
        (estimatedTokens / 1000000) * modelCost.output * 0.5
      );
    } else if (provider === "mistral") {
      // HEAD OF AI FIX: Mistral prices are per 1M tokens, not per 1K!
      const costPer1MTokens = {
        "mistral-large-3": { input: 0.5, output: 1.5 },
        "mistral-large-24-11": { input: 2.0, output: 6.0 },
        "mistral-small-3.1": { input: 0.1, output: 0.3 },
        "mistral-medium-3": { input: 0.4, output: 2.0 },
        "mistral-small": { input: 0.2, output: 0.6 },
        "mistral-medium": { input: 0.4, output: 2.0 },
        "mistral-large": { input: 2.0, output: 6.0 },
      };
      const modelCost =
        costPer1MTokens[model] || costPer1MTokens["mistral-small-3.1"];
      // FIXED: Prices are per 1M tokens, so divide by 1,000,000 (not 1,000!)
      return (
        (estimatedTokens / 1000000) * modelCost.input +
        (estimatedTokens / 1000000) * modelCost.output * 0.5
      );
    } else if (provider === "cohere") {
      const costPer1kTokens = {
        "command-r-plus": { input: 0.5, output: 1.5 },
        "command-r": { input: 0.5, output: 1.5 },
        "command-r-8": { input: 0.3, output: 0.9 },
        "command-r-7": { input: 0.25, output: 0.75 },
        command: { input: 0.5, output: 1.5 },
        "command-light": { input: 0.15, output: 0.6 },
      };
      const modelCost =
        costPer1kTokens[model] || costPer1kTokens["command-r-plus"];
      return (
        (estimatedTokens / 1000) * modelCost.input +
        (estimatedTokens / 1000) * modelCost.output * 0.5
      );
    } else if (provider === "together") {
      const costPer1kTokens = {
        "meta-llama/Llama-3-70b-chat-hf": { input: 0.0002, output: 0.0002 },
        "meta-llama/Llama-3-8b-chat-hf": { input: 0.0001, output: 0.0001 },
        "mistralai/Mixtral-8x7B-Instruct-v0.1": {
          input: 0.0002,
          output: 0.0002,
        },
        "meta-llama/Llama-2-70b-chat-hf": { input: 0.0002, output: 0.0002 },
      };
      const modelCost =
        costPer1kTokens[model] ||
        costPer1kTokens["meta-llama/Llama-3-70b-chat-hf"];
      return (
        (estimatedTokens / 1000) * modelCost.input +
        (estimatedTokens / 1000) * modelCost.output * 0.5
      );
    }

    return 0;
  }

  /**
   * Analyze context to determine routing strategy
   */
  analyzeContext(params) {
    const {
      userMessage = "",
      gameStateContext = "",
      rollData = null,
      context = {},
    } = params;

    // Check for critical keywords
    const criticalKeywords = [
      "death",
      "dies",
      "dead",
      "killed",
      "boss",
      "final",
      "milestone",
      "victory",
      "defeat",
    ];
    const complexKeywords = [
      "puzzle",
      "solve",
      "strategy",
      "plan",
      "reasoning",
      "logic",
    ];
    const combatKeywords = [
      "attack",
      "fight",
      "combat",
      "battle",
      "strike",
      "hit",
    ];

    const messageLower = (userMessage + " " + gameStateContext).toLowerCase();
    const isCritical =
      criticalKeywords.some((kw) => messageLower.includes(kw)) ||
      rollData?.critical ||
      context.isCritical ||
      (rollData?.success === false && rollData?.statValue < 5);
    const isComplex = complexKeywords.some((kw) => messageLower.includes(kw));
    const isCombat = combatKeywords.some((kw) => messageLower.includes(kw));

    // Determine context type
    let contextType = "routine";
    if (isCritical) contextType = "critical";
    else if (isComplex) contextType = "complex";
    else if (isCombat) contextType = "combat";
    else if (gameStateContext.length > 200) contextType = "long-form";

    // Determine importance
    let importance = "low";
    if (isCritical) importance = "critical";
    else if (rollData?.success === false || rollData?.statValue < 8)
      importance = "high";
    else if (rollData?.success === true || rollData?.statValue > 12)
      importance = "medium";

    return {
      contextType: context.contextType || contextType,
      importance: context.importance || importance,
      isCritical:
        context.isCritical !== undefined ? context.isCritical : isCritical,
      isComplex,
      isCombat,
      hasRollData: !!rollData,
    };
  }

  /**
   * Get provider for context based on routing strategy
   *
   * HEAD OF AI UPDATE: Prioritize fine-tuned Mistral model!
   * We have ft:mistral-small-latest:smuggler-narrator trained specifically for Smugglers.
   * This is CHEAPER than Gemini ($0.10 vs $0.075-$1.25) and optimized for our use case.
   */
  getProviderForContext(context, routingStrategy = "balanced") {
    const { contextType, importance, isCritical, isComplex } = context;

    // HEAD OF AI: Fine-tuned Mistral model for Smugglers narratives
    const FINE_TUNED_MISTRAL =
      "ft:mistral-small-latest:d7de2b55:20251220:smuggler-narrator:20bab39d";

    if (routingStrategy === "aggressive") {
      // Cheapest option - use fine-tuned Mistral (trained for Smugglers!)
      return { provider: "mistral", model: FINE_TUNED_MISTRAL };
    }

    if (routingStrategy === "quality") {
      // Best quality - use Gemini 2.5 Pro for complex reasoning
      return { provider: "gemini", model: "gemini-2.5-pro" };
    }

    // HEAD OF AI: Balanced routing now prefers fine-tuned Mistral
    // It's cheaper AND trained specifically for Smugglers narratives

    if (isCritical || importance === "critical") {
      // Critical moments: 60% fine-tuned Mistral, 40% Gemini Pro
      if (Math.random() < 0.6) {
        return { provider: "mistral", model: FINE_TUNED_MISTRAL };
      }
      return { provider: "gemini", model: "gemini-2.5-pro" };
    }

    if (isComplex || contextType === "complex") {
      // Complex reasoning: Gemini Pro is better at multi-step logic
      return { provider: "gemini", model: "gemini-2.5-pro" };
    }

    if (contextType === "long-form") {
      return { provider: "cohere", model: "command-r-plus" };
    }

    if (importance === "high") {
      // High importance: 70% fine-tuned Mistral, 30% Gemini Flash
      if (Math.random() < 0.7) {
        return { provider: "mistral", model: FINE_TUNED_MISTRAL };
      }
      return { provider: "gemini", model: "gemini-2.5-flash" };
    }

    // Default: routine actions - use fine-tuned Mistral (cheapest + trained for us)
    return { provider: "mistral", model: FINE_TUNED_MISTRAL };
  }

  /**
   * Get fallback provider if primary fails
   */
  getFallbackProvider(failedProvider, routingStrategy = "balanced") {
    const fallbackChain = {
      gemini: ["mistral", "together", "openai", "cohere", "anthropic"],
      mistral: ["gemini", "together", "openai", "cohere", "anthropic"],
      together: ["mistral", "gemini", "openai", "cohere", "anthropic"],
      openai: ["gemini", "mistral", "together", "cohere", "anthropic"],
      cohere: ["gemini", "mistral", "together", "openai", "anthropic"],
      anthropic: ["gemini", "mistral", "together", "openai", "cohere"],
    };

    const chain = fallbackChain[failedProvider] || [
      "gemini",
      "mistral",
      "openai",
    ];

    // Find first available provider in chain
    for (const provider of chain) {
      if (this.available[provider]) {
        if (routingStrategy === "aggressive") {
          return {
            provider,
            model: this.defaultModel[provider] || "gemini-2.5-flash",
          };
        }
        return {
          provider,
          model: this.defaultModel[provider] || "gemini-2.5-flash",
        };
      }
    }

    // Last resort: use default
    return {
      provider: this.defaultProvider,
      model: this.defaultModel[this.defaultProvider],
    };
  }

  /**
   * Generate narrative using LLM
   * @param {Object} params - Generation parameters
   * @param {string} params.userMessage - User's action/message
   * @param {string} params.gameStateContext - Game state context string
   * @param {Object} params.rollData - Roll data (optional)
   * @param {string} params.provider - Provider to use ('openai', 'anthropic', 'gemini', 'mistral', or 'cohere', defaults to configured default)
   * @param {string} params.model - Model to use (optional, uses default for provider)
   * @param {string} params.ip - IP address for rate limiting
   * @returns {Promise<Object>} - { narrative: string, provider: string, model: string, cached: boolean }
   */
  async generateNarrative(params) {
    let {
      userMessage,
      gameStateContext = "",
      rollData = null,
      provider = null,
      model = null,
      ip = "unknown",
      userId = null, // SPRINT 5: Add userId for memory integration
      sessionId = null, // SPRINT 5: Add sessionId for memory integration
      skipCache = false, // HEAD OF AI: Allow bypassing cache for unique responses
      criticalAction = null,
      actionType = null,
    } = params;

    // HEAD OF AI DEBUG - Trace what we receive
    console.log("[LLM Service] 🔥 generateNarrative called with:");
    console.log(
      "[LLM Service] 🔥   userMessage:",
      typeof userMessage,
      userMessage?.substring?.(0, 100) || userMessage,
    );
    console.log(
      "[LLM Service] 🔥   gameStateContext:",
      typeof gameStateContext,
      gameStateContext?.substring?.(0, 100) || gameStateContext,
    );
    console.log(
      "[LLM Service] 🔥   rollData:",
      JSON.stringify(rollData)?.substring?.(0, 100),
    );

    // Ensure userMessage and gameStateContext are strings (prevent [object Object] in prompts)
    if (typeof userMessage !== "string") {
      if (typeof userMessage === "object" && userMessage !== null) {
        userMessage =
          userMessage.text ||
          userMessage.message ||
          userMessage.action ||
          userMessage.userMessage ||
          "";
      } else {
        userMessage = String(userMessage || "");
      }
    }

    if (typeof gameStateContext !== "string") {
      if (typeof gameStateContext === "object" && gameStateContext !== null) {
        try {
          gameStateContext = JSON.stringify(gameStateContext);
        } catch (err) {
          gameStateContext = "";
        }
      } else {
        gameStateContext = String(gameStateContext || "");
      }
    }

    // Check rate limit (use 'service' for server-side calls to get higher limit)
    const rateLimitIp =
      ip === "unknown" || !ip || ip.startsWith("127.") || ip.startsWith("::1")
        ? "service"
        : ip;
    if (!this.checkRateLimit(rateLimitIp)) {
      throw new Error(
        "Rate limit exceeded. Please wait a moment before trying again.",
      );
    }

    // Context-aware provider selection
    const analyzedContext = this.analyzeContext(params);
    const routingStrategy =
      params.costMode || process.env.LLM_COST_MODE || "balanced";

    // Sprint 8.3: CSAT-based model selection optimization
    // Check if we should use best CSAT model for critical actions
    let selectedProvider = provider;
    let selectedModel = model;
    let useCSATBasedSelection = false;

    try {
      const aiGMCSATOptimizationService = require("./aiGMCSATOptimizationService");
      const bestModel = aiGMCSATOptimizationService.getBestModel();
      const bestProvider = aiGMCSATOptimizationService.getBestProvider();

      // Use best CSAT model for critical actions if available
      if (criticalAction?.isCritical && bestModel && bestModel.count >= 20) {
        useCSATBasedSelection = true;
        selectedProvider = bestModel.provider;
        selectedModel = bestModel.model;
        console.log(
          `[LLM Service] Using best CSAT model for critical action: ${bestModel.provider}/${bestModel.model} (CSAT: ${(bestModel.averageCSAT * 100).toFixed(1)}%)`,
        );
      } else if (bestProvider && bestProvider.count >= 20 && !provider) {
        // Use best provider for normal actions if no provider specified
        useCSATBasedSelection = true;
        selectedProvider = bestProvider.provider;
        console.log(
          `[LLM Service] Using best CSAT provider: ${bestProvider.provider} (CSAT: ${(bestProvider.averageCSAT * 100).toFixed(1)}%)`,
        );
      }
    } catch (err) {
      console.debug(
        "[LLM Service] CSAT-based model selection failed:",
        err.message,
      );
    }

    // Determine provider using smart routing (if not using CSAT-based selection)
    if (!selectedProvider && !useCSATBasedSelection) {
      const routing = this.getProviderForContext(
        analyzedContext,
        routingStrategy,
      );
      selectedProvider = routing.provider;
      selectedModel = selectedModel || routing.model;
    }

    // Fallback if selected provider not available
    if (!this.available[selectedProvider]) {
      const fallback = this.getFallbackProvider(
        selectedProvider,
        routingStrategy,
      );
      selectedProvider = fallback.provider;
      selectedModel = selectedModel || fallback.model;
    }

    // Ensure model is set
    selectedModel = selectedModel || this.defaultModel[selectedProvider];

    // Check cache (skip if explicitly requested)
    const cacheKey = this.generateCacheKey(
      userMessage,
      gameStateContext,
      rollData,
      selectedProvider,
      selectedModel,
    );
    const cached = skipCache ? null : this.getCachedResponse(cacheKey);
    if (cached) {
      // SPRINT 4: Track cache hit for cost savings
      const estimatedCost = this.estimateCost(
        selectedProvider,
        selectedModel,
        userMessage.length,
      );
      if (estimatedCost > 0) {
        performanceTrackingService
          .trackAPICost({
            service: selectedProvider,
            operationType: "cached_" + (selectedModel || "unknown"),
            costUsd: 0, // Cached = $0 cost
            tokensUsed: 0,
            cacheUsed: true,
            requestId: `cached-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              model: selectedModel || this.defaultModel[selectedProvider],
              cached: true,
              estimatedSavings: estimatedCost,
            },
          })
          .catch((err) => {
            // Don't block on tracking errors
          });
      }

      return {
        ...cached,
        cached: true,
      };
    }

    // Get enhanced context awareness (includes memory, progression, emotional, environmental)
    const scenarioId = params.scenarioId || "default";
    let enhancedContext = null;
    let memoryContext = "";
    let progressionContext = "";

    if (userId) {
      try {
        // Get enhanced context (includes memory, progression, emotional, environmental)
        enhancedContext =
          await enhancedContextAwarenessService.getEnhancedContext(
            userId,
            scenarioId,
            {
              location: params.location || null,
              actionType: rollData
                ? `${rollData.statName || "unknown"}-${rollData.rollType || "roll"}`
                : "action",
              rollData: rollData,
              emotionalState: params.emotionalState || {},
              gameState: params.gameState || {},
            },
          );

        // Build memory context from enhanced context
        if (enhancedContext.narrativeMemory?.memories?.length > 0) {
          const highPriority =
            enhancedContext.narrativeMemory.highPriority || [];
          const mediumPriority =
            enhancedContext.narrativeMemory.mediumPriority || [];

          const relevantMemories = [...highPriority, ...mediumPriority].slice(
            0,
            5,
          );

          if (relevantMemories.length > 0) {
            const memoryTexts = relevantMemories
              .map((m) => {
                let text = `- ${m.event_type || "event"}: `;
                if (m.narrative) {
                  text += m.narrative.substring(0, 150);
                } else if (m.event_data) {
                  text += JSON.stringify(m.event_data).substring(0, 150);
                }
                if (m.recency) {
                  text += ` [${m.recency}]`;
                }
                return text;
              })
              .join("\n");

            memoryContext = `\n\n[PLAYER MEMORY CONTEXT - Reference these past events naturally in your narrative:]\n${memoryTexts}\n`;

            // Add emotional context if available
            if (enhancedContext.emotional?.category !== "neutral") {
              memoryContext += `\n[EMOTIONAL CONTEXT - Player's emotional state: ${enhancedContext.emotional.category} (${enhancedContext.emotional.trajectory} trajectory)]\n`;
              if (enhancedContext.emotional.recommendations?.length > 0) {
                memoryContext += `Recommendations: ${enhancedContext.emotional.recommendations.join("; ")}\n`;
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
                  memoryContext += `Visual details: ${sensory.visual.join(", ")}\n`;
                }
                if (sensory.auditory?.length > 0) {
                  memoryContext += `Sounds: ${sensory.auditory.join(", ")}\n`;
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

          if (
            progression.relationships &&
            progression.relationships.length > 0
          ) {
            progressionContext += `Relationships: ${progression.relationships.map((r) => `${r.entity} (${r.relationship})`).join(", ")}\n`;
          }

          if (progression.recentEvents && progression.recentEvents.length > 0) {
            progressionContext += `Recent Events: ${progression.recentEvents.map((e) => e.type).join(", ")}\n`;
          }

          if (progression.milestones && progression.milestones.length > 0) {
            progressionContext += `Milestones: ${progression.milestones.map((m) => m.description || m).join(", ")}\n`;
          }

          progressionContext += `\nAdjust your narrative tone and content to match this story stage. `;
          progressionContext += `If in ${progression.storyStage}, use appropriate pacing and tension.\n`;
        }
      } catch (err) {
        log.warn(
          "[LLM Service] Failed to get enhanced context:",
          err.message,
        );
        // Fallback to basic memory context
        try {
          const memories = await aiGMMemoryService.getEnhancedMemoryContext(
            userId,
            userMessage + " " + gameStateContext,
            { days: 30, limit: 5, includeEmotions: true },
          );

          if (memories && memories.length > 0) {
            const memoryTexts = memories
              .map((m) => {
                let text = `- ${m.type}: ${JSON.stringify(m.event)}`;
                if (m.narrative)
                  text += ` (Narrative: ${m.narrative.substring(0, 100)}...)`;
                return text;
              })
              .join("\n");

            memoryContext = `\n\n[PLAYER MEMORY CONTEXT - Reference these past events naturally in your narrative:]\n${memoryTexts}\n`;
          }
        } catch (fallbackErr) {
          log.warn(
            "[LLM Service] Failed to get fallback memory context:",
            fallbackErr.message,
          );
        }
      }
    }

    // HEAD OF AI: Multi-Model Ensemble - Try ensemble for important/critical actions
    let ensembleResult = null;
    try {
      const aiGMMultiModelEnsembleService = require("./aiGMMultiModelEnsembleService");
      const aiGMCriticalActionService = require("./aiGMCriticalActionService");

      // Sprint 7.1: Detect critical actions
      const actionData = {
        userMessage: userMessage,
        rollData: rollData,
        context: analyzedContext,
        actionType: actionType,
        scenarioId: scenarioId,
      };

      const criticalAction =
        aiGMCriticalActionService.detectCriticalAction(actionData);

      const ensembleContext = {
        rollData: rollData,
        importance: analyzedContext.importance,
        isCritical: analyzedContext.isCritical || criticalAction.isCritical,
        userMessage: userMessage,
        actionType: actionType,
        scenarioId: scenarioId,
        criticalAction: criticalAction, // Sprint 7.1: Pass critical action info
      };

      if (aiGMMultiModelEnsembleService.shouldUseEnsemble(ensembleContext)) {
        console.log(
          `[LLM Service] Using multi-model ensemble for ${criticalAction.isCritical ? "critical" : "important"} action: ${criticalAction.reason}`,
        );
        ensembleResult = await aiGMMultiModelEnsembleService.generateEnsemble(
          this,
          params,
        );

        if (ensembleResult && ensembleResult.narrative) {
          console.log(
            `[LLM Service] Ensemble generated narrative with quality ${(ensembleResult.quality * 100).toFixed(1)}%`,
          );
          // Return ensemble result directly (skip normal generation)
          return {
            narrative: ensembleResult.narrative,
            qualityScore: ensembleResult.quality,
            provider: ensembleResult.provider,
            model: ensembleResult.model,
            responseTime: ensembleResult.responseTime,
            tokensUsed: ensembleResult.tokensUsed,
            cost: ensembleResult.cost,
            cached: false,
            ensemble: ensembleResult.ensemble,
          };
        }
      }
    } catch (err) {
      console.debug(
        "[LLM Service] Multi-model ensemble not available or failed:",
        err.message,
      );
      // Continue with normal generation
    }

    // Build prompt with enhanced context
    let systemPrompt = BASE_SYSTEM_PROMPT + "\n\n" + GAME_STATE_INSTRUCTIONS;

    // Sprint 5.1: Get optimal quality range from CSAT optimization service
    let optimalQualityRange = { min: 0.7, max: 0.85 }; // Default
    try {
      const aiGMCSATOptimizationService = require("./aiGMCSATOptimizationService");
      const csatStats = await aiGMCSATOptimizationService.getStats();
      if (csatStats && csatStats.qualityOptimalRange) {
        optimalQualityRange = csatStats.qualityOptimalRange;
        console.log(
          `[LLM Service] Targeting optimal quality range: ${(optimalQualityRange.min * 100).toFixed(0)}-${(optimalQualityRange.max * 100).toFixed(0)}% (CSAT-optimized)`,
        );
      }
    } catch (err) {
      console.debug(
        "[LLM Service] CSAT optimization service not available, using default range:",
        err.message,
      );
    }

    // Sprint 5.1: Add optimal quality range targeting to prompt
    systemPrompt += `\n\n[CSAT-OPTIMIZED QUALITY TARGET - Sprint 5.1]
- Target narrative quality in the range of ${(optimalQualityRange.min * 100).toFixed(0)}-${(optimalQualityRange.max * 100).toFixed(0)}%
- This range has been identified as producing the highest player satisfaction (CSAT)
- Quality too high (${(optimalQualityRange.max * 100).toFixed(0)}%+) may not improve satisfaction
- Quality too low (${(optimalQualityRange.min * 100).toFixed(0)}%-) will reduce satisfaction
- Balance quality with engagement, relevance, and player preferences`;

    // Sprint 3.3: Add mechanics integration emphasis if rollData is present
    if (rollData && rollData.statName) {
      systemPrompt += `\n\n[MECHANICS INTEGRATION REQUIREMENT]
- You MUST clearly state which stat (${rollData.statName}) was used in the first two sentences
- Show how the stat value (${rollData.statValue || "N/A"}) affected the outcome
- Make the connection between player action, stat, roll, and result obvious
- Example: "Your ${rollData.statName} (${rollData.statValue || "N/A"}) serves you well - [specific outcome based on stat]"
- Never just say "You succeed" - explain HOW the stat helped or hindered`;
    }

    // HEAD OF AI: Quality & CSAT Prediction - Predict before generation (Sprint 5.2)
    let qualityPrediction = null;
    let csatPrediction = null;
    let shouldRetryBeforeGeneration = false;
    try {
      const aiGMQualityPredictionService = require("./aiGMQualityPredictionService");
      const predictionContext = {
        provider: selectedProvider,
        model: selectedModel,
        actionType: rollData
          ? `${rollData.statName || "unknown"}-${rollData.rollType || "roll"}`
          : "action",
        scenarioId: scenarioId,
        rollType: rollData?.rollType,
        statName: rollData?.statName,
        statValue: rollData?.statValue,
      };

      qualityPrediction =
        aiGMQualityPredictionService.predictQuality(predictionContext);

      // Sprint 5.2: Also predict CSAT
      csatPrediction =
        await aiGMQualityPredictionService.predictCSAT(predictionContext);

      if (qualityPrediction && qualityPrediction.confidence > 0.3) {
        console.log(
          `[LLM Service] Quality prediction: ${(qualityPrediction.predictedQuality * 100).toFixed(1)}% (confidence: ${(qualityPrediction.confidence * 100).toFixed(1)}%)`,
        );
      }

      if (csatPrediction && csatPrediction.confidence > 0.3) {
        console.log(
          `[LLM Service] CSAT prediction: ${(csatPrediction.predictedCSAT * 100).toFixed(1)}% (correlation: ${(csatPrediction.correlation * 100).toFixed(0)}%)`,
        );
      }

      // HEAD OF AI: Retry logic - Check if we should retry before generation (Sprint 5.2: CSAT-first)
      const minQualityThreshold = params.minQualityThreshold || 0.6;
      const minCSATThreshold = params.minCSATThreshold || 0.7; // Sprint 5.2: CSAT threshold

      // Sprint 5.2: Retry if CSAT prediction is low (CSAT-first approach)
      if (csatPrediction && csatPrediction.confidence > 0.3) {
        shouldRetryBeforeGeneration =
          await aiGMQualityPredictionService.shouldRetryByCSAT(
            csatPrediction,
            minCSATThreshold,
          );
        if (shouldRetryBeforeGeneration) {
          log.warn(
            `[LLM Service] Low predicted CSAT (${(csatPrediction.predictedCSAT * 100).toFixed(1)}%), will retry after generation`,
          );
        }
      } else {
        // Fallback to quality prediction if CSAT not available
        shouldRetryBeforeGeneration = aiGMQualityPredictionService.shouldRetry(
          qualityPrediction,
          minQualityThreshold,
        );
        if (shouldRetryBeforeGeneration) {
          log.warn(
            `[LLM Service] Low predicted quality (${(qualityPrediction.predictedQuality * 100).toFixed(1)}%), but proceeding (retry after generation if needed)`,
          );
        }
      }
    } catch (err) {
      console.debug(
        "[LLM Service] Quality/CSAT prediction not available:",
        err.message,
      );
    }

    // HEAD OF AI: A/B Testing - Get variant prompt if experiment is active
    let abTestVariant = null;
    let abTestExperiment = null;
    try {
      const aiGMABTestingService = require("./aiGMABTestingService");
      const experimentName = "narrative-quality-prompt-v1"; // Default experiment name
      abTestVariant = aiGMABTestingService.getVariant(experimentName);

      if (abTestVariant) {
        const variantPrompt = aiGMABTestingService.getPromptForVariant(
          experimentName,
          abTestVariant,
        );
        if (variantPrompt) {
          systemPrompt = variantPrompt + "\n\n" + GAME_STATE_INSTRUCTIONS;
          abTestExperiment = experimentName;
          console.log(
            `[LLM Service] Using A/B test variant ${abTestVariant} for experiment ${experimentName}`,
          );
        }
      }
    } catch (err) {
      // A/B testing not available, use default prompt
      console.debug("[LLM Service] A/B testing not available:", err.message);
    }

    // HEAD OF AI: Add exemplar-based few-shot prompting for better quality
    if (exemplarCollectionService && rollData) {
      try {
        const fewShotPrompt =
          await exemplarCollectionService.buildFewShotPrompt("", {
            stat: rollData.statName,
            rollType: rollData.rollType,
          });

        // Extract exemplar section if present
        if (fewShotPrompt.includes("[EXEMPLAR NARRATIVES")) {
          const exemplarSection = fewShotPrompt.split(
            "[EXEMPLAR NARRATIVES",
          )[1];
          if (exemplarSection) {
            systemPrompt +=
              "\n\n" +
              "[EXEMPLAR NARRATIVES" +
              exemplarSection.split("[END EXEMPLARS")[0] +
              "[END EXEMPLARS]";
            console.log(
              "[LLM Service] Added exemplar-based few-shot prompting",
            );
          }
        }
      } catch (exemplarErr) {
        log.warn(
          "[LLM Service] Exemplar few-shot error (continuing without):",
          exemplarErr.message,
        );
      }
    }

    // Build user prompt with enhanced game state context
    let gameStateBlock = "";
    if (gameStateContext) {
      gameStateBlock = `[GAME_STATE: ${gameStateContext}]`;

      // Add system references if available in context (ENHANCED with more systems)
      if (typeof gameStateContext === "string") {
        const contextLower = gameStateContext.toLowerCase();
        if (
          contextLower.includes("stealth") ||
          contextLower.includes("sneak")
        ) {
          gameStateBlock +=
            "\n[SYSTEM: Stealth mechanics active - reference detection, noise, hiding spots]";
        }
        if (contextLower.includes("combat") || contextLower.includes("fight")) {
          gameStateBlock +=
            "\n[SYSTEM: Combat mechanics active - reference weapons, tactics, damage]";
        }
        if (
          contextLower.includes("trading") ||
          contextLower.includes("trade") ||
          contextLower.includes("merchant")
        ) {
          gameStateBlock +=
            "\n[SYSTEM: Trading mechanics active - reference credits, cargo, negotiations, reputation]";
        }
        if (contextLower.includes("ship") || contextLower.includes("vessel")) {
          gameStateBlock +=
            "\n[SYSTEM: Ship systems available - reference sensors, engines, cargo hold, navigation computer]";
        }
        if (
          contextLower.includes("cargo") ||
          contextLower.includes("mission")
        ) {
          gameStateBlock +=
            "\n[SYSTEM: Mission/cargo context - reference cargo status, mission objectives, stakes]";
        }
        if (contextLower.includes("crew") || contextLower.includes("npc")) {
          gameStateBlock +=
            "\n[SYSTEM: Crew/NPCs present - reference crew reactions, NPC interactions, character relationships]";
        }
        if (
          contextLower.includes("faction") ||
          contextLower.includes("reputation")
        ) {
          gameStateBlock +=
            "\n[SYSTEM: Faction/reputation system - reference faction standing, reputation impact]";
        }
        // Scenario-specific systems
        if (
          contextLower.includes("crimson") ||
          contextLower.includes("kestor") ||
          contextLower.includes("debris")
        ) {
          gameStateBlock +=
            "\n[SCENARIO: Crimson Run - debris field, rusted hulks, scrapyard moon, authorities, time pressure]";
        }
        if (
          contextLower.includes("ghost") &&
          contextLower.includes("station")
        ) {
          gameStateBlock +=
            "\n[SCENARIO: Ghost Station - dark corridors, oppressive silence, security systems, hidden secrets]";
        }
      }
    }

    const userPrompt = gameStateBlock
      ? `${gameStateBlock}\n\nUser Action: ${userMessage}`
      : `User Action: ${userMessage}`;

    // Add progression context to user prompt
    const userPromptWithContext = progressionContext
      ? `${progressionContext}\n\n${userPrompt}`
      : userPrompt;

    // Add roll context if available - ENHANCED for gameplay integration
    let enhancedUserPrompt = userPromptWithContext;
    if (rollData) {
      const statName = rollData.statName || "N/A";
      const statValue = rollData.statValue || 0;
      const roll = rollData.roll || 0;
      const rollType = rollData.rollType || "N/A";

      // Build enhanced roll context with gameplay integration guidance
      let rollInfo = `[ROLL RESULT: ${rollType.toUpperCase()}]\n`;
      rollInfo += `Stat Used: ${statName} (Value: ${statValue})\n`;
      rollInfo += `Roll: ${roll} vs Stat Value: ${statValue}\n\n`;

      // Add gameplay integration guidance based on stat
      const statGuidance = {
        wits: "Focus on intelligence, observation, planning, navigation, problem-solving. Reference sensors, scanners, analysis, strategic thinking.",
        grit: "Focus on combat, physical action, weapons, tactics, strength, aggression. Reference combat systems, weapons, physical capability.",
        cunning:
          "Focus on social interaction, negotiation, charm, persuasion, diplomacy. Reference social dynamics, reputation, relationships.",
      };

      if (statGuidance[statName]) {
        rollInfo += `[GAMEPLAY INTEGRATION - ${statName.toUpperCase()}]: ${statGuidance[statName]}\n\n`;
      }

      // Add stat value impact guidance
      if (statValue >= 7) {
        rollInfo += `[STAT IMPACT]: High ${statName} (${statValue}) - Player is highly capable. Describe skill, expertise, and mastery. Show competence.\n\n`;
      } else if (statValue <= 3) {
        rollInfo += `[STAT IMPACT]: Low ${statName} (${statValue}) - Player struggles but finds opportunity. Describe difficulty but create alternative paths or unexpected advantages.\n\n`;
      }

      // Add roll type specific guidance
      if (rollType === "critical-success") {
        rollInfo += `[OUTCOME]: CRITICAL SUCCESS - Create a triumphant, memorable moment. Celebrate the achievement dramatically. Show exceptional skill or luck. Make it feel rewarding and earned.\n\n`;
      } else if (rollType === "success") {
        rollInfo += `[OUTCOME]: SUCCESS - Describe successful action with skill and competence. Show progress and achievement. Make it feel rewarding.\n\n`;
      } else if (rollType === "failure") {
        rollInfo += `[OUTCOME]: FAILURE - Create an interesting setback that opens new opportunities. Don't just block progress - create alternative paths, reveal new information, or set up future success. Make failures narratively interesting.\n\n`;
      } else if (rollType === "critical-failure") {
        rollInfo += `[OUTCOME]: CRITICAL FAILURE - Create dramatic tension and consequences, but also reveal opportunities. Show how this failure leads to unexpected discoveries or alternative approaches. Make it cinematic and memorable, not just punishing.\n\n`;
      }

      rollInfo += `[CINEMATIC REQUIREMENTS]:\n`;
      rollInfo += `- Use vivid visual imagery (paint a picture with words)\n`;
      rollInfo += `- Vary sentence structure and pacing\n`;
      rollInfo += `- Include sensory details (sight, sound, smell, touch)\n`;
      rollInfo += `- Build dramatic tension appropriate to the outcome\n`;
      rollInfo += `- Structure the scene: Setting → Action → Consequence\n\n`;

      rollInfo += `[THEATRICAL REQUIREMENTS]:\n`;
      rollInfo += `- Include emotional beats matching the outcome\n`;
      rollInfo += `- Create memorable moments\n`;
      rollInfo += `- Add dramatic reveals or surprises when appropriate\n`;
      rollInfo += `- Show character through action\n\n`;

      rollInfo += `[REWARDS & ENGAGEMENT]:\n`;
      rollInfo += `- Make the outcome feel meaningful and impactful\n`;
      rollInfo += `- Show clear progress or consequences\n`;
      rollInfo += `- Create player agency - make choices matter\n`;
      rollInfo += `- Build engagement with strong hooks and maintained interest\n\n`;

      // Add concrete example based on stat and roll type
      rollInfo += `[EXAMPLE - Follow this style]:\n`;
      if (statName === "wits" && rollType === "success") {
        rollInfo += `"Your ${statName} (${statValue}) guide you as you ${userMessage.toLowerCase()}. The ship's sensors detect... Your strategic thinking pays off as... The navigation systems confirm your calculations. Your expertise shows in every decision."\n\n`;
      } else if (statName === "grit" && rollType === "critical-success") {
        rollInfo += `"Your ${statName} (${statValue}) shine as you ${userMessage.toLowerCase()}. The combat systems register your precision. Your weapon hums with energy. Every movement is calculated, every strike perfect. This is mastery in action."\n\n`;
      } else if (statName === "cunning" && rollType === "failure") {
        rollInfo += `"Your ${statName} (${statValue}) aren't quite enough this time. The negotiation stalls, but the merchant's hesitation reveals something - there's another way. Perhaps a different approach, or maybe this failure opens a door you didn't see before."\n\n`;
      } else {
        rollInfo += `"Your ${statName} (${statValue}) ${rollType === "success" ? "serve you well" : "struggle"} as you ${userMessage.toLowerCase()}. ${rollType === "success" ? "Success" : "The setback"} ${rollType === "success" ? "feels earned" : "creates opportunity"}. Reference game systems, show stat impact, create vivid imagery."\n\n`;
      }

      rollInfo += `NOW GENERATE A NARRATIVE THAT:\n`;
      rollInfo += `1. References ${statName} naturally (${statValue >= 7 ? 'high skill - "Your ${statName} serves you well" or "Your ${statName} skill proves valuable"' : statValue <= 3 ? 'struggle but opportunity - "Your ${statName} isn\'t enough this time, but..."' : 'competent - "Your ${statName} guides you"'})\n`;
      rollInfo += `2. Includes game systems (ship, cargo, sensors, weapons, trading, crew, missions, factions)\n`;
      rollInfo += `3. Uses vivid visual imagery (paint detailed pictures, use cinematic language)\n`;
      rollInfo += `4. Creates emotional beats matching ${rollType} (${rollType.includes("success") ? "triumph, relief, achievement" : "tension, but opportunity"})\n`;
      rollInfo += `5. Makes the outcome feel ${rollType.includes("success") ? "rewarding and earned - celebrate the success" : "interesting with opportunities - failures create new paths"}\n`;
      rollInfo += `6. References location/environment naturally (if location is mentioned in context)\n`;
      rollInfo += `7. Includes crew reactions when appropriate (${rollType.includes("success") ? '"Your crew breathes a sigh of relief" or "Your crew watches in awe"' : '"The crew looks concerned" or "Your crew prepares for the worst"'})\n`;
      rollInfo += `8. References mission/cargo if mentioned in context (cargo status, mission progress, stakes)\n\n`;

      enhancedUserPrompt = `${rollInfo}${userPromptWithContext}`;
    }

    // SPRINT 5: Add memory context to prompt
    enhancedUserPrompt += memoryContext;

    // Generate using selected provider
    let result;
    const startTime = Date.now();

    try {
      if (selectedProvider === "openai") {
        result = await this.generateOpenAI(
          systemPrompt,
          enhancedUserPrompt,
          selectedModel,
        );
      } else if (selectedProvider === "anthropic") {
        result = await this.generateAnthropic(
          systemPrompt,
          enhancedUserPrompt,
          selectedModel,
        );
      } else if (selectedProvider === "gemini") {
        result = await this.generateGemini(
          systemPrompt,
          enhancedUserPrompt,
          selectedModel,
        );
      } else if (selectedProvider === "mistral") {
        result = await this.generateMistral(
          systemPrompt,
          enhancedUserPrompt,
          selectedModel,
        );
      } else if (selectedProvider === "cohere") {
        result = await this.generateCohere(
          systemPrompt,
          enhancedUserPrompt,
          selectedModel,
        );
      } else if (selectedProvider === "together") {
        result = await this.generateTogether(
          systemPrompt,
          enhancedUserPrompt,
          selectedModel,
        );
      } else if (selectedProvider === "local") {
        result = await this.generateLocal(
          systemPrompt,
          enhancedUserPrompt,
          selectedModel,
        );
      } else {
        throw new Error(`Unknown provider: ${selectedProvider}`);
      }

      const responseTime = Date.now() - startTime;

      // HEAD OF AI: Capture raw narrative BEFORE post-processing for training data
      const narrativeRaw = result.narrative;

      // Extract location from gameStateContext for use in enhancements
      let location = null;
      if (gameStateContext) {
        const locationMatch =
          gameStateContext.match(/location[:\s]+([^,\n]+)/i) ||
          gameStateContext.match(
            /(asteroid_field|space_station|trading_post|corporate_facility|derelict_ship|cantina|black market|docking bay)/i,
          );
        location = locationMatch ? locationMatch[1]?.trim() : null;
      }

      // POST-PROCESS FIRST: Enhance narrative BEFORE quality scoring
      // This ensures we score the enhanced version, not the raw LLM output
      if (result.narrative && this.postProcessor) {
        try {
          const enhancedNarrative = this.postProcessor.enhance(
            result.narrative,
            {
              statName: rollData?.statName,
              statValue: rollData?.statValue,
              rollType: rollData?.rollType,
              rollData: rollData,
              gameStateContext: gameStateContext,
              location: location, // Now defined in outer scope
            },
          );

          // Use enhanced version
          if (
            enhancedNarrative &&
            enhancedNarrative.length >= result.narrative.length
          ) {
            const hadStatBefore = result.narrative
              .toLowerCase()
              .includes(rollData?.statName || "");
            result.narrative = enhancedNarrative;
            const hasStatAfter = result.narrative
              .toLowerCase()
              .includes(rollData?.statName || "");
            console.log(
              `[LLM Service] Narrative post-processed: stat=${rollData?.statName}, before=${hadStatBefore}, after=${hasStatAfter}, starts="${result.narrative.substring(0, 50)}"`,
            );
          }
        } catch (postProcessError) {
          log.warn(
            "[LLM Service] Post-processing error (using original):",
            postProcessError.message,
          );
        }
      }

      // HEAD OF AI: Apply narrative enhancement library (10 improvements)
      try {
        // Extract NPC info from game state
        let npcName = null;
        let npcPersonality = "professional";
        let npcId = null;
        if (gameStateContext) {
          // Try multiple patterns to extract NPC info
          const npcMatch =
            gameStateContext.match(/npc[:\s]+["']?([^,\n\)]+)/i) ||
            gameStateContext.match(
              /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\([^\)]+\)/,
            ); // "Name (description)"
          if (npcMatch) {
            const fullMatch = npcMatch[1]?.trim();
            // Extract name and ID (handle formats like "Captain Vex (ruthless)" or "jara-pylos")
            npcName = fullMatch.split("(")[0].trim();
            npcId = fullMatch
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "");

            // Extract personality from parentheses if present
            const personalityMatch = fullMatch.match(/\(([^\)]+)\)/);
            if (personalityMatch) {
              npcPersonality = personalityMatch[1].trim();
            }
          }
        }

        // HEAD OF AI: Generate NPC dialogue using voice profiles if available
        let npcDialogue = null;
        if (npcDialogueService && npcId && userMessage) {
          try {
            const situation = `${userMessage} (${rollData?.rollType || "action"})`;
            npcDialogue = await npcDialogueService.generateDialogue(
              npcId,
              situation,
              {
                location: location,
                rollType: rollData?.rollType,
                statName: rollData?.statName,
                statValue: rollData?.statValue,
              },
              userId,
              userId, // characterId
            );
            if (npcDialogue && npcDialogue.length > 10) {
              console.log(
                `[LLM Service] Generated NPC dialogue for ${npcId}: ${npcDialogue.substring(0, 60)}...`,
              );
            }
          } catch (dialogueErr) {
            log.warn(
              "[LLM Service] NPC dialogue generation error:",
              dialogueErr.message,
            );
          }
        }

        // HEAD OF AI: Get NPC memory callback if player ID and NPC available
        let npcMemoryCallback = null;
        if (userId && npcName) {
          try {
            npcMemoryCallback = await npcMemoryService.getMemoryCallback(
              userId,
              npcName,
              npcName,
            );
          } catch (memErr) {
            log.warn(
              "[LLM Service] NPC memory callback error:",
              memErr.message,
            );
          }
        }

        // Get enhancements
        const enhancements = narrativeEnhancementLibrary.enhance(
          result.narrative,
          {
            stat: rollData?.statName,
            statValue: rollData?.statValue || 5,
            rollType: rollData?.rollType,
            npcName: npcName,
            npcPersonality: npcPersonality,
            location: location,
            isSuccess: rollData?.rollType?.includes("success"),
          },
        );

        // Add celebration for critical success
        if (rollData?.rollType === "critical-success") {
          const celebration =
            narrativeEnhancementLibrary.getCelebration("critical-success");
          if (celebration && !result.narrative.includes("★")) {
            result.narrative = celebration + "\n\n" + result.narrative;
          }
        }

        // Append enhancements if meaningful
        if (
          enhancements &&
          enhancements.length > 20 &&
          !result.narrative.includes(enhancements.substring(0, 30))
        ) {
          result.narrative = result.narrative + "\n\n" + enhancements;
          console.log(
            "[LLM Service] Narrative enhanced with library:",
            enhancements.substring(0, 60) + "...",
          );
        }

        // HEAD OF AI: Inject NPC dialogue if available (before memory callback)
        if (
          npcDialogue &&
          !result.narrative.includes(npcDialogue.substring(0, 30))
        ) {
          // Find a good place to inject dialogue (after first sentence or paragraph)
          const firstSentenceEnd = result.narrative.match(/[.!?]\s/);
          if (firstSentenceEnd) {
            const insertPos =
              firstSentenceEnd.index + firstSentenceEnd[0].length;
            result.narrative =
              result.narrative.slice(0, insertPos) +
              `\n\n"${npcDialogue}"\n\n` +
              result.narrative.slice(insertPos);
          } else {
            // Fallback: prepend dialogue
            result.narrative = `"${npcDialogue}"\n\n${result.narrative}`;
          }
          console.log(
            "[LLM Service] Injected NPC dialogue for:",
            npcName || npcId,
          );
        }

        // HEAD OF AI: Prepend NPC memory callback if available
        if (
          npcMemoryCallback &&
          !result.narrative.includes(npcMemoryCallback.substring(0, 20))
        ) {
          result.narrative = npcMemoryCallback + "\n\n" + result.narrative;
          console.log("[LLM Service] Added NPC memory callback for:", npcName);
        }

        // HEAD OF AI: Record this interaction for future memory callbacks
        if (userId && npcName && rollData) {
          const interactionType = rollData.rollType?.includes("success")
            ? "positive"
            : rollData.rollType?.includes("failure")
              ? "negative"
              : "neutral";
          const importance = rollData.rollType?.includes("critical")
            ? "high"
            : "normal";

          npcMemoryService
            .recordInteraction(userId, npcName, {
              type: interactionType,
              description: userMessage?.substring(0, 100),
              outcome: rollData.rollType,
              importance,
              context: { stat: rollData.statName, location },
            })
            .catch((err) =>
              log.warn(
                "[LLM Service] NPC memory record error:",
                err.message,
              ),
            );
        }
      } catch (enhanceError) {
        log.warn(
          "[LLM Service] Enhancement library error:",
          enhanceError.message,
        );
      }

      // Track usage with context information
      this.trackUsage({
        provider: selectedProvider,
        model: selectedModel,
        responseTime: responseTime,
        tokens: result.tokensUsed || 0,
        cost: result.cost || 0,
        cached: false,
        context: {
          importance: analyzedContext.importance,
          contextType: analyzedContext.contextType,
          isCritical: analyzedContext.isCritical,
          isRoutine: analyzedContext.contextType === "routine",
          routingStrategy: routingStrategy,
        },
      });

      // Use narrative quality service for comprehensive quality scoring
      const actionType = rollData
        ? `${rollData.statName || "unknown"}-${rollData.rollType || "roll"}`
        : "action";
      const qualityContext = {
        action: { type: actionType, userMessage },
        scenarioId,
        sessionId: rollData?.sessionId,
        gameStateContext: rollData?.gameStateContext,
        scenarioTone: rollData?.scenarioTone,
      };

      // Score quality using narrative quality service
      const qualityResult = await narrativeQualityService.scoreQuality(
        result.narrative,
        qualityContext,
      );
      const qualityScore = qualityResult.overall;

      // HEAD OF AI: Update quality prediction model with actual quality
      if (qualityPrediction) {
        try {
          const aiGMQualityPredictionService = require("./aiGMQualityPredictionService");
          await aiGMQualityPredictionService.updateModel(qualityScore, {
            provider: selectedProvider,
            model: selectedModel,
            actionType: actionType,
            scenarioId: scenarioId,
          });
        } catch (err) {
          console.debug(
            "[LLM Service] Quality prediction update error:",
            err.message,
          );
        }
      }

      // Also track with legacy system for backward compatibility
      this.qualityScores.push(qualityScore);
      if (this.qualityScores.length > 100) {
        this.qualityScores.shift(); // Keep only last 100 scores
      }

      // Check response variety
      const varietyCheck = responseVarietyService.checkVariety(
        scenarioId,
        actionType,
        result.narrative,
      );

      // Filter response using narrative quality service (skip for testing or if bypassQualityFilter is set)
      const bypassQualityFilter =
        params.bypassQualityFilter ||
        process.env.BYPASS_QUALITY_FILTER === "true";
      if (!bypassQualityFilter) {
        const filterResult = await narrativeQualityService.filterResponse(
          result.narrative,
          qualityContext,
        );

        // If filtered, use fallback
        if (filterResult.filtered && this.fallbackEnabled) {
          log.warn(
            `[LLM Service] Response filtered: ${filterResult.reason}, using fallback`,
          );
          return this.getFallbackResponse(rollData);
        }
      }

      // Use quality score from narrative quality service (already calculated above)
      const adjustedQualityScore = qualityScore;
      const qualityBreakdown = qualityResult.breakdown || {}; // Sprint 4: Get breakdown for engagement check

      // Sprint 5.3: Check if narrative is in optimal quality range
      const isInOptimalRange =
        adjustedQualityScore >= optimalQualityRange.min &&
        adjustedQualityScore <= optimalQualityRange.max;
      if (!isInOptimalRange) {
        console.log(
          `[LLM Service] Narrative quality (${(adjustedQualityScore * 100).toFixed(1)}%) outside optimal range (${(optimalQualityRange.min * 100).toFixed(0)}-${(optimalQualityRange.max * 100).toFixed(0)}%)`,
        );
      } else {
        console.log(
          `[LLM Service] ✅ Narrative quality (${(adjustedQualityScore * 100).toFixed(1)}%) in optimal CSAT range`,
        );
      }

      // HEAD OF AI: Retry logic - Retry if quality is below threshold OR narrative issues (Sprint 3 & 4)
      const maxRetries =
        params.maxRetries !== undefined ? params.maxRetries : 1; // Default 1 retry

      // Sprint 3.1 & 3.2: Check for narrative issues that require retry
      const wordCount = result.narrative
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
      const isQuickAction = params.isQuickAction || false;
      const minWords = isQuickAction ? 100 : 150;

      const hasGenericPhrase =
        narrativeQualityService.detectGenericPhrases(result.narrative).length >
        0;
      const isTooShort = wordCount < minWords;

      // Determine if retry is needed
      let needsRetry = false;
      let retryReason = null;

      if (isTooShort) {
        needsRetry = true;
        retryReason = `Narrative too short (${wordCount} words, need ${minWords}+)`;
      } else if (hasGenericPhrase) {
        // Retry if generic phrase in opening (first 50 chars)
        const opening = result.narrative.substring(0, 50).toLowerCase();
        const genericPhrases = narrativeQualityService.detectGenericPhrases(
          result.narrative,
        );
        const hasGenericOpening = genericPhrases.some((phrase) =>
          opening.includes(phrase.toLowerCase().replace("...", "")),
        );
        if (hasGenericOpening) {
          needsRetry = true;
          retryReason = `Generic phrase in opening: ${genericPhrases[0]}`;
        }
      }

      // Sprint 7.2: Higher retry threshold for critical actions
      const isCritical = criticalAction?.isCritical || false;
      const retryQualityThreshold = isCritical
        ? 0.7
        : params.retryQualityThreshold || 0.6; // Higher threshold for critical
      const retryCount = params.retryCount || 0;

      // Sprint 4: Check engagement issues (sensory details, NPC depth, consequence clarity)
      const hasEngagementIssues =
        (qualityBreakdown.engagement && qualityBreakdown.engagement < 0.5) || // Low engagement score
        (qualityBreakdown.engagement &&
          qualityBreakdown.engagement < 0.6 &&
          wordCount < 200); // Low engagement + short

      // Sprint 5.3: Check if outside optimal quality range (CSAT-first retry) - reuse isInOptimalRange from above
      const outsideOptimalRange = !isInOptimalRange && retryCount === 0; // Only retry once for range issues

      // Sprint 7.2: Check CSAT prediction for retry (critical actions need higher CSAT)
      const shouldRetryByCSAT =
        csatPrediction &&
        csatPrediction.confidence > 0.3 &&
        csatPrediction.predictedCSAT < (isCritical ? 0.75 : 0.7);

      const shouldRetry =
        (adjustedQualityScore < retryQualityThreshold ||
          needsRetry ||
          hasEngagementIssues ||
          outsideOptimalRange ||
          shouldRetryByCSAT) &&
        retryCount < maxRetries &&
        !params.bypassRetry;

      if (shouldRetry) {
        let retryReasonText = retryReason;
        if (!retryReasonText) {
          if (outsideOptimalRange) {
            retryReasonText = `Quality (${(adjustedQualityScore * 100).toFixed(1)}%) outside optimal CSAT range (${(optimalQualityRange.min * 100).toFixed(0)}-${(optimalQualityRange.max * 100).toFixed(0)}%)`;
          } else if (hasEngagementIssues) {
            retryReasonText = `Low engagement (${((qualityBreakdown.engagement || 0) * 100).toFixed(1)}%)`;
          } else {
            retryReasonText = `Low quality score (${adjustedQualityScore.toFixed(2)})`;
          }
        }
        log.warn(
          `[LLM Service] ${retryReasonText}, retrying (attempt ${retryCount + 1}/${maxRetries + 1})...`,
        );

        // Retry with different provider if available
        let retryProvider = selectedProvider;
        if (retryCount === 0) {
          // Try alternate provider on first retry
          if (selectedProvider === "mistral" && this.openaiApiKey) {
            retryProvider = "openai";
          } else if (selectedProvider === "openai" && this.mistralApiKey) {
            retryProvider = "mistral";
          }
        }

        // Sprint 3, 4 & 5: Enhanced retry prompt for specific issues
        let enhancedSystemPrompt = systemPrompt;
        if (outsideOptimalRange) {
          // Sprint 5.3: Retry for optimal range targeting
          const currentPercent = (adjustedQualityScore * 100).toFixed(0);
          const targetMin = (optimalQualityRange.min * 100).toFixed(0);
          const targetMax = (optimalQualityRange.max * 100).toFixed(0);
          if (adjustedQualityScore < optimalQualityRange.min) {
            enhancedSystemPrompt += `\n\n[RETRY INSTRUCTION - CSAT Optimization] Previous quality (${currentPercent}%) below optimal range (${targetMin}-${targetMax}%). Increase quality by adding more detail, depth, and engagement while maintaining player satisfaction focus.`;
          } else {
            enhancedSystemPrompt += `\n\n[RETRY INSTRUCTION - CSAT Optimization] Previous quality (${currentPercent}%) above optimal range (${targetMin}-${targetMax}%). Reduce over-engineering - focus on player satisfaction over perfect quality. Simplify while maintaining engagement.`;
          }
        } else if (isTooShort) {
          enhancedSystemPrompt +=
            "\n\n[RETRY INSTRUCTION] The previous response was too short. Generate a longer, more detailed narrative (minimum 150 words). Add more sensory details, character reactions, and scene description.";
        } else if (hasGenericPhrase && retryReason) {
          enhancedSystemPrompt += `\n\n[RETRY INSTRUCTION] The previous response started with a generic phrase. Avoid starting with "${retryReason}". Instead, start with specific sensory details, action, dialogue, or atmosphere. Be creative and vivid.`;
        } else if (hasEngagementIssues) {
          // Sprint 4: Engagement fix retry
          const missingElements = [];
          const engagementScore = qualityBreakdown.engagement || 0;
          if (engagementScore < 0.5) {
            missingElements.push(
              "sensory details (at least 2 types: visual, audio, tactile, smell, environmental)",
            );
            missingElements.push(
              "NPC depth (distinct personality, voice, memorable traits, clear motivation)",
            );
            missingElements.push(
              "consequence clarity (show immediate and future impact of player actions)",
            );
          }
          if (missingElements.length > 0) {
            enhancedSystemPrompt += `\n\n[RETRY INSTRUCTION] The previous response lacked engagement (score: ${(engagementScore * 100).toFixed(0)}%). Add: ${missingElements.join(", ")}. Make the narrative more immersive and meaningful.`;
          }
        }

        // Retry with slightly different parameters
        const retryParams = {
          ...params,
          retryCount: retryCount + 1,
          provider: retryProvider, // Use alternate provider
          skipCache: true, // Skip cache on retry
          systemPrompt: enhancedSystemPrompt, // Sprint 3: Enhanced prompt
        };

        // Recursive retry
        return this.generateNarrative(retryParams);
      }

      // Check quality threshold (fallback if retries exhausted)
      if (adjustedQualityScore < this.minQualityScore && this.fallbackEnabled) {
        log.warn(
          `[LLM Service] Low quality score (${adjustedQualityScore.toFixed(2)}) after ${retryCount} retries, using fallback`,
        );
        return this.getFallbackResponse(rollData);
      }

      // Calibrate confidence for quality prediction
      const calibratedConfidence =
        await aiGMConfidenceCalibrationService.calibrateConfidence(
          adjustedQualityScore,
          {
            scenarioId: scenarioId,
            actionType: actionType,
            provider: selectedProvider,
            model: selectedModel,
            qualityScore: adjustedQualityScore,
          },
        );

      // Track metrics (AI/ML Lead - Monitoring)
      aiGMMetricsService
        .recordResponse({
          success: true,
          quality: adjustedQualityScore,
          responseTime: responseTime,
          confidence: calibratedConfidence.calibrated || adjustedQualityScore,
          calibrated: !!calibratedConfidence.calibrated,
          variety: {
            isSimilar: varietyCheck.isSimilar,
            similarityScore: varietyCheck.similarityScore,
            unique: !varietyCheck.isSimilar,
          },
          provider: selectedProvider,
          model: selectedModel,
          tokens: result.tokensUsed || 0,
          cost: result.cost || 0,
          // Sprint 5.4: Track optimal range metrics
          inOptimalRange: isInOptimalRange,
          optimalRange: optimalQualityRange,
          csatPrediction: csatPrediction?.predictedCSAT || null,
          // Sprint 7.4: Track critical action metrics
          isCritical: criticalAction?.isCritical || false,
          criticalCategory: criticalAction?.category || null,
          usedEnsemble: !!ensembleResult,
        })
        .catch((err) => {
          // Don't block on metrics errors
          log.warn("[LLM Service] Metrics tracking error:", err.message);
        });

      // HEAD OF AI: Record A/B test result if experiment is active
      if (abTestExperiment && abTestVariant) {
        try {
          const aiGMABTestingService = require("./aiGMABTestingService");
          const responseId =
            explanation?.responseId ||
            `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Get engagement score if available (from engagement enhancer or metrics)
          let engagementScore = null;
          try {
            const engagementMetrics = aiGMMetricsService.getMetrics();
            if (
              engagementMetrics &&
              engagementMetrics.engagement !== undefined
            ) {
              engagementScore = engagementMetrics.engagement;
            }
          } catch (err) {
            // Engagement score not available
          }

          await aiGMABTestingService.recordResult(
            abTestExperiment,
            abTestVariant,
            {
              responseId: responseId,
              qualityScore: adjustedQualityScore,
              engagementScore: engagementScore,
              responseTime: responseTime,
              userRating: null, // Will be updated when user submits feedback
              feedbackCategories: [],
              scenarioId: scenarioId,
              actionType: actionType,
              provider: selectedProvider,
              model: selectedModel,
            },
          );
        } catch (err) {
          log.warn(
            "[LLM Service] A/B test result recording error:",
            err.message,
          );
        }
      }

      // NOTE: Post-processing now happens BEFORE quality scoring (see above)
      // This ensures we score the enhanced version, not the raw LLM output

      // Generate explanation and track response (only if quality is acceptable)
      let explanation = null;
      if (adjustedQualityScore >= this.minQualityScore) {
        // Track response for variety checking
        responseVarietyService.trackResponse(
          scenarioId,
          actionType,
          result.narrative,
          {
            rollData: rollData,
            qualityScore: qualityScore,
            varietyScore: varietyCheck.varietyScore,
          },
        );

        // Generate explanation for this narrative
        try {
          const explainResult =
            await aiGMExplainabilityService.explainNarrative(result.narrative, {
              narrative: result.narrative,
              qualityScore: adjustedQualityScore,
              baseQualityScore: qualityScore,
              varietyScore: varietyCheck.varietyScore,
              isRepetitive: varietyCheck.isSimilar,
              scenarioId: scenarioId,
              actionType: actionType,
              playerAction: userMessage, // Add player action for context
              rollData: rollData,
              gameStateContext: gameStateContext,
              promptUsed: enhancedUserPrompt,
              provider: selectedProvider,
              model: selectedModel,
              cached: false,
              responseTime: responseTime,
              tokensUsed: result.tokensUsed || 0,
            });
          explanation = explainResult.explanation;
        } catch (err) {
          log.warn(
            "[LLM Service] Failed to generate explanation:",
            err.message,
          );
        }

        // Emit quality improvement event if Event Bus available
        // Use enhanced event bus if available, fallback to standard
        const enhancedEventBus =
          typeof require !== "undefined"
            ? require("./eventBusEnhancements")
            : null;
        const bus = enhancedEventBus || eventBus;

        if (bus && typeof bus.emit === "function") {
          bus
            .emit(
              "game:ai:response-generated",
              {
                qualityScore: adjustedQualityScore,
                calibratedQualityScore: calibratedConfidence.calibrated,
                baseQualityScore: qualityScore,
                varietyScore: varietyCheck.varietyScore,
                isRepetitive: varietyCheck.isSimilar,
                scenarioId: scenarioId,
                actionType: actionType,
                responseLength: result.narrative.length,
                explanationId: explanation?.responseId || null,
                confidenceReliability: calibratedConfidence.reliability,
              },
              { source: "llmService" },
            )
            .catch((err) => {
              // Don't block on event emission errors
              log.warn(
                "[LLM Service] Failed to emit quality event:",
                err.message,
              );
            });
        }
      }

      // Cache result
      this.cacheResponse(cacheKey, {
        narrative: result.narrative,
        provider: selectedProvider,
        model: selectedModel,
        qualityScore: qualityScore,
      });

      // SPRINT 4: Update cache metrics
      this.updateCacheMetrics();

      // Track narrative progression (after narrative is generated)
      if (userId && result.narrative) {
        // Track progression event
        try {
          const progressionResult =
            await narrativeProgressionService.trackEvent(userId, scenarioId, {
              narrative: result.narrative,
              actionType: rollData
                ? `${rollData.statName || "unknown"}-${rollData.rollType || "roll"}`
                : "action",
              rollData: rollData,
              outcome: rollData?.success
                ? "success"
                : rollData?.failure
                  ? "failure"
                  : "partial",
              emotionalState: params.emotionalState || {},
              relationships: params.relationships || {},
              location: params.location || null,
              timestamp: new Date().toISOString(),
            });

          // SPRINT 5: Store narrative as memory for future reference
          aiGMMemoryService
            .storeNarrativeMemory(userId, {
              narrative: result.narrative,
              sessionId: sessionId,
              eventData: {
                userMessage,
                gameState: gameStateContext,
                rollData: rollData,
                progression: progressionResult?.progression || null,
                storyStage: progressionResult?.storyStage || null,
              },
              importance: "normal",
            })
            .catch((err) => {
              log.warn(
                "[LLM Service] Failed to store narrative memory:",
                err.message,
              );
            });

          // Track progression metrics
          aiGMMetricsService
            .recordProgression({
              milestone: progressionResult?.milestone || false,
              arcsActive: progressionResult?.arcsActive || 0,
            })
            .catch((err) => {
              log.warn(
                "[LLM Service] Failed to track progression metrics:",
                err.message,
              );
            });
        } catch (err) {
          log.warn(
            "[LLM Service] Failed to track progression:",
            err.message,
          );
        }
      }

      // Track context usage metrics
      if (enhancedContext || memoryContext || progressionContext) {
        aiGMMetricsService
          .recordContextUsage({
            temporal: !!memoryContext,
            emotional: !!enhancedContext?.emotionalContext,
            environmental: !!enhancedContext?.environmentalContext,
            contextSize:
              (memoryContext?.length || 0) +
              (progressionContext?.length || 0) +
              (gameStateContext?.length || 0),
          })
          .catch((err) => {
            log.warn(
              "[LLM Service] Failed to track context metrics:",
              err.message,
            );
          });
      }

      // Track provider usage for CSAT correlation and analytics
      // ALWAYS log to Supabase - required for bot surveys and analytics
      const llmProviderTrackingService = require("./llmProviderTrackingService");
      llmProviderTrackingService
        .trackProviderUsage({
          sessionId: sessionId,
          userId: userId,
          scenarioId: scenarioId,
          provider: selectedProvider,
          model: selectedModel,
          context: qualityContext, // Use qualityContext instead of undefined context
          source: params.source || "gameplay", // Allow source override (bot, survey, test, etc.)
          qualityScore: adjustedQualityScore,
          responseTime: responseTime,
          cost: result.cost || 0,
        })
        .catch((err) => {
          console.error(
            "[LLM Service] CRITICAL: Failed to track provider usage:",
            err.message,
          );
        });

      // HEAD OF AI: Record training example - Every session is training data
      trainingDataService
        .recordExample({
          sessionId: sessionId || `session-${Date.now()}`,
          userId: userId,
          scenarioId: scenarioId,
          playerAction: userMessage,
          actionType: rollData
            ? `${rollData.statName || "unknown"}-${rollData.rollType || "roll"}`
            : "action",
          gameState: {
            context: gameStateContext,
            rollData: rollData,
            memoryContext: memoryContext ? true : false,
            progressionContext: progressionContext ? true : false,
          },
          rollData: rollData,
          narrativeRaw: narrativeRaw,
          narrativeEnhanced: result.narrative,
          provider: selectedProvider,
          model: selectedModel,
          temperature: 0.85, // Default from config
          tokensPrompt: result.tokensUsed
            ? Math.floor(result.tokensUsed * 0.7)
            : 0, // Estimate
          tokensCompletion: result.tokensUsed
            ? Math.floor(result.tokensUsed * 0.3)
            : 0,
          responseTimeMs: responseTime,
          qualityScore: adjustedQualityScore,
          // HEAD OF AI: Map quality breakdown to Chief Storyteller dimensions
          qualityDimensions: {
            cinematic: qualityResult?.breakdown?.coherence || 0, // Coherence maps to cinematic flow
            theatrical: qualityResult?.breakdown?.style || 0, // Style maps to theatrical presentation
            gameplayIntegration: qualityResult?.breakdown?.relevance || 0, // Relevance maps to gameplay
            engagement:
              qualityResult?.breakdown?.engagement ||
              varietyCheck?.varietyScore ||
              0,
          },
        })
        .catch((err) => {
          // Don't block on training data errors
          log.warn(
            "[LLM Service] Training data capture error:",
            err.message,
          );
        });

      // HEAD OF AI: Auto-collect as exemplar if gold+ quality
      const qualityTier =
        adjustedQualityScore >= 0.9
          ? "platinum"
          : adjustedQualityScore >= 0.8
            ? "gold"
            : adjustedQualityScore >= 0.7
              ? "silver"
              : "bronze";

      if (qualityTier === "platinum" || qualityTier === "gold") {
        exemplarCollectionService
          .autoCollect(result.narrative, {
            qualityScore: adjustedQualityScore,
            qualityTier,
            stat: rollData?.statName,
            rollType: rollData?.rollType,
            provider: selectedProvider,
            model: selectedModel,
            prompt: enhancedUserPrompt?.substring(0, 500),
          })
          .catch((err) => {
            log.warn(
              "[LLM Service] Exemplar collection error:",
              err.message,
            );
          });
      }

      // HEAD OF AI: Record narrative for Session Intelligence - Chief Storyteller evaluation
      if (sessionId) {
        sessionIntelligenceService.recordNarrative(sessionId, {
          narrativeRaw: narrativeRaw,
          narrativeEnhanced: result.narrative,
          playerAction: userMessage,
          rollData: rollData,
          gameState: gameStateContext,
          qualityScore: adjustedQualityScore,
          provider: selectedProvider,
          model: selectedModel,
        });
      }

      // Parse and strip celebration tags for gamification
      const celebrations = gamificationEventService.parseCelebrations(
        result.narrative,
      );
      const cleanNarrative = gamificationEventService.stripCelebrationTags(
        result.narrative,
      );

      return {
        narrative: cleanNarrative,
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
        cost: result.cost || 0,
        // Gamification: celebration events for UI
        celebrations: celebrations,
        hasCelebration: celebrations.length > 0,
      };
    } catch (error) {
      console.error(
        `[LLM Service] Error generating narrative with ${selectedProvider}:`,
        error,
      );

      // Track error
      this.trackError({
        provider: selectedProvider,
        model: selectedModel,
        error: error.message,
        timestamp: Date.now(),
      });

      // Track error metrics (AI/ML Lead - Monitoring)
      aiGMMetricsService
        .recordResponse({
          success: false,
          error: {
            type: error.name || "Error",
            message: error.message,
          },
          provider: selectedProvider,
          model: selectedModel,
        })
        .catch((err) => {
          // Don't block on metrics errors
          log.warn("[LLM Service] Metrics tracking error:", err.message);
        });

      // Try fallback if enabled
      if (this.fallbackEnabled) {
        console.log("[LLM Service] Using fallback due to error");
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
      model = "gpt-4o-mini",
      systemPrompt = "",
      temperature = 0.7,
      maxTokens = 1000,
      provider = "openai",
    } = options;

    // FIX: Handle case where caller passes object as first arg (e.g., {prompt: "text", options...})
    if (typeof prompt === "object" && prompt !== null && prompt.prompt) {
      // Caller passed object with prompt property - extract it
      options = { ...options, ...prompt };
      prompt = prompt.prompt;
    }

    // Ensure prompt is a string
    const promptText =
      typeof prompt === "string"
        ? prompt
        : prompt?.text ||
          prompt?.message ||
          prompt?.content ||
          String(prompt || "Generate a response");
    const systemPromptText =
      typeof systemPrompt === "string"
        ? systemPrompt
        : systemPrompt?.text || String(systemPrompt || "");

    let result;
    if (provider === "anthropic" || model.includes("claude")) {
      result = await this.generateAnthropic(
        systemPromptText,
        promptText,
        model || "claude-3-5-sonnet-20241022",
      );
    } else {
      result = await this.generateOpenAI(
        systemPromptText,
        promptText,
        model || "gpt-4o-mini",
      );
    }

    // Return just the narrative text for simpler usage
    return result.narrative || result.text || result;
  }

  /**
   * Generate narrative using OpenAI API
   */
  async generateOpenAI(systemPrompt, userPrompt, model) {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Ensure model is provided
    if (!model) {
      model = "gpt-4o-mini"; // Default model
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for code fixes (more deterministic)
        max_tokens: 2000, // More tokens for code fixes
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: { message: "Unknown error" } }));
      throw new Error(
        `OpenAI API error: ${error.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content?.trim();

    if (!narrative) {
      throw new Error("OpenAI API returned empty response");
    }

    // Calculate cost and tokens
    const tokensUsed = data.usage?.total_tokens || 0;
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;

    // Cost calculation (approximate, varies by model)
    const costPer1kTokens = {
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-4o": { input: 2.5, output: 10.0 },
      "gpt-4-turbo": { input: 10.0, output: 30.0 },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    };

    const modelCost = costPer1kTokens[model] || costPer1kTokens["gpt-4o-mini"];
    const cost =
      (promptTokens / 1000) * modelCost.input +
      (completionTokens / 1000) * modelCost.output;

    return {
      narrative,
      tokensUsed,
      promptTokens,
      completionTokens,
      cost,
    };
  }

  /**
   * Generate narrative using Together.ai API (OpenAI-compatible)
   */
  async generateTogether(systemPrompt, userPrompt, model) {
    if (!this.togetherApiKey) {
      throw new Error("Together.ai API key not configured");
    }

    // Ensure model is provided
    if (!model) {
      model = "meta-llama/Llama-3-70b-chat-hf"; // Default model
    }

    // Together.ai uses OpenAI-compatible API endpoint
    const response = await fetch(
      "https://api.together.xyz/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.togetherApiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          top_p: 0.9,
        }),
      },
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: { message: "Unknown error" } }));
      throw new Error(
        `Together.ai API error: ${error.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content?.trim();

    if (!narrative) {
      throw new Error("Together.ai API returned empty response");
    }

    // Calculate cost and tokens
    const tokensUsed = data.usage?.total_tokens || 0;
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;

    // Cost calculation for Together.ai models (approximate, varies by model)
    // Together.ai pricing is typically cheaper than OpenAI
    const costPer1kTokens = {
      "meta-llama/Llama-3-70b-chat-hf": { input: 0.0002, output: 0.0002 }, // ~$0.20 per 1M tokens
      "meta-llama/Llama-3-8b-chat-hf": { input: 0.0001, output: 0.0001 }, // ~$0.10 per 1M tokens
      "mistralai/Mixtral-8x7B-Instruct-v0.1": { input: 0.0002, output: 0.0002 },
      "meta-llama/Llama-2-70b-chat-hf": { input: 0.0002, output: 0.0002 },
    };

    const modelCost =
      costPer1kTokens[model] ||
      costPer1kTokens["meta-llama/Llama-3-70b-chat-hf"];
    const cost =
      (promptTokens / 1000) * modelCost.input +
      (completionTokens / 1000) * modelCost.output;

    return {
      narrative,
      tokensUsed,
      promptTokens,
      completionTokens,
      cost,
    };
  }

  /**
   * Generate narrative using Google Gemini API
   */
  async generateGemini(systemPrompt, userPrompt, model) {
    if (!this.geminiApiKey) {
      throw new Error("Google Gemini API key not configured");
    }

    // Ensure model is provided - default to latest cost-effective model (Dec 2025)
    if (!model) {
      model = "gemini-1.5-flash"; // Default to Gemini 1.5 Flash (available model)
    }

    // Map model names to actual Gemini API model names
    // Available models (confirmed via API): gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-flash-latest, gemini-pro-latest
    const modelMap = {
      // 3.0 models -> 2.5 Pro (best available)
      "gemini-3.0-pro": "gemini-2.5-pro",
      "gemini-3-pro": "gemini-2.5-pro",
      "gemini-3.0-deep-think": "gemini-2.5-pro",
      "gemini-3-deep-think": "gemini-2.5-pro",
      // 2.5 models -> use as-is (available)
      "gemini-2.5-pro": "gemini-2.5-pro",
      "gemini-2.5-flash": "gemini-2.5-flash",
      "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
      // 1.5 models -> map to 2.5 or latest equivalents
      "gemini-1.5-pro": "gemini-2.5-pro",
      "gemini-1.5-flash": "gemini-2.5-flash",
      "gemini-1.5-pro-latest": "gemini-pro-latest",
      "gemini-1.5-flash-latest": "gemini-flash-latest",
      // 2.0 models -> use as-is
      "gemini-2.0-flash": "gemini-2.0-flash",
      "gemini-2.0-flash-exp": "gemini-2.0-flash-exp",
      // Latest models -> use as-is
      "gemini-pro-latest": "gemini-pro-latest",
      "gemini-flash-latest": "gemini-flash-latest",
      // Legacy
      "gemini-pro": "gemini-pro-latest",
    };

    const apiModel = modelMap[model] || model || "gemini-2.5-flash";

    // Gemini API endpoint (using v1beta for system instructions support)
    // Use apiModel (mapped name) instead of model (user-facing name)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${this.geminiApiKey}`;

    // HEAD OF AI DEBUG: Check prompt types and content
    console.log(
      "[LLM Service] DEBUG Gemini - userPrompt type:",
      typeof userPrompt,
    );
    console.log(
      "[LLM Service] DEBUG Gemini - userPrompt length:",
      userPrompt?.length || 0,
    );
    console.log(
      "[LLM Service] DEBUG Gemini - userPrompt first 200:",
      String(userPrompt).substring(0, 200),
    );

    // Ensure userPrompt is a string
    if (typeof userPrompt !== "string") {
      console.error(
        "[LLM Service] ⚠️ userPrompt is not a string! Type:",
        typeof userPrompt,
      );
      userPrompt = String(userPrompt);
    }

    if (
      userPrompt.includes("[object Object]") ||
      userPrompt.includes("[object object]")
    ) {
      console.error(
        "[LLM Service] ⚠️ DEBUG: [object Object] detected in userPrompt!",
      );
      console.error("[LLM Service] DEBUG full userPrompt:", userPrompt);
    }

    // Build request body
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2000,
        candidateCount: 1,
      },
    };

    // Add system instruction if provided (Gemini 1.5+ supports system instructions)
    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    // HEAD OF AI: Retry logic with exponential backoff for API resilience
    const maxRetries = 3;
    let lastError = null;
    let data = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout per request

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ error: { message: "Unknown error" } }));
          const errorMsg = error.error?.message || response.statusText;

          // Check if it's a rate limit error - these should be retried with backoff
          if (response.status === 429 || errorMsg.includes("rate limit")) {
            const backoff = Math.min(1000 * Math.pow(2, attempt), 10000); // Up to 10 seconds
            log.warn(
              `[LLM Service] Rate limited, waiting ${backoff}ms before retry ${attempt + 1}/${maxRetries}`,
            );
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          throw new Error(`Google Gemini API error: ${errorMsg}`);
        }

        data = await response.json();
        break; // Success, exit retry loop
      } catch (fetchError) {
        lastError = fetchError;

        if (fetchError.name === "AbortError") {
          log.warn(
            `[LLM Service] Request timed out (attempt ${attempt}/${maxRetries})`,
          );
        } else if (
          fetchError.code === "ENOTFOUND" ||
          fetchError.code === "ETIMEDOUT"
        ) {
          log.warn(
            `[LLM Service] Network error (attempt ${attempt}/${maxRetries}): ${fetchError.message}`,
          );
        } else {
          console.error(
            `[LLM Service] Fetch error (attempt ${attempt}/${maxRetries}):`,
            fetchError.message,
          );
        }

        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`[LLM Service] Retrying in ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    if (!data) {
      throw (
        lastError ||
        new Error("Failed to get response from Gemini after retries")
      );
    }
    const narrative = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!narrative) {
      throw new Error("Google Gemini API returned empty response");
    }

    // Calculate cost and tokens
    // Gemini provides token counts in usageMetadata
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

    // Cost calculation for Gemini models (as of December 2025)
    // Pricing: https://ai.google.dev/pricing
    // Prices are per 1M tokens (not per 1K tokens)
    const costPer1MTokens = {
      // Gemini 3 Series (Latest - November 2025)
      "gemini-3.0-pro": { input: 1.25, output: 5.0 },
      "gemini-3-pro": { input: 1.25, output: 5.0 },
      "gemini-3.0-deep-think": { input: 2.5, output: 10.0 },
      "gemini-3-deep-think": { input: 2.5, output: 10.0 },

      // Gemini 2.5 Series (June 2025)
      "gemini-2.5-pro": { input: 1.25, output: 5.0 },
      "gemini-2.5-flash": { input: 0.075, output: 0.3 },
      "gemini-2.5-flash-lite": { input: 0.0375, output: 0.15 },
      "gemini-2.5-flash-native-audio": { input: 0.075, output: 0.3 },

      // Gemini 2.0 Series (February 2025) - Some deprecated Dec 9, 2025
      "gemini-2.0-flash-exp": { input: 0.075, output: 0.3 },
      "gemini-2.0-flash": { input: 0.075, output: 0.3 },
      "gemini-2.0-flash-lite": { input: 0.0375, output: 0.15 },

      // Gemini 1.5 Series (Legacy - still supported)
      "gemini-1.5-flash": { input: 0.075, output: 0.3 },
      "gemini-1.5-flash-latest": { input: 0.075, output: 0.3 },
      "gemini-1.5-pro": { input: 1.25, output: 5.0 },
      "gemini-1.5-pro-latest": { input: 1.25, output: 5.0 },

      // Legacy models
      "gemini-pro": { input: 0.5, output: 1.5 },
      "gemini-pro-vision": { input: 0.5, output: 1.5 },
    };

    // Default to Gemini 2.5 Flash (latest cost-effective model as of Dec 2025)
    const modelCost =
      costPer1MTokens[model] ||
      costPer1MTokens["gemini-2.5-flash"] ||
      costPer1MTokens["gemini-1.5-flash"];
    // Calculate cost: prices are per 1M tokens, so divide by 1,000,000
    const cost =
      (promptTokens / 1000000) * modelCost.input +
      (completionTokens / 1000000) * modelCost.output;

    return {
      narrative,
      tokensUsed,
      promptTokens,
      completionTokens,
      cost,
    };
  }

  /**
   * Generate narrative using Mistral AI API
   */
  async generateMistral(systemPrompt, userPrompt, model) {
    if (!this.mistralApiKey) {
      throw new Error("Mistral AI API key not configured");
    }

    // Ensure model is provided
    // Mistral model names: mistral-tiny, mistral-small, mistral-medium, mistral-large
    // Fine-tuned models: ft:mistral-small-latest:... (use as-is)
    if (!model) {
      model = "mistral-small"; // Default model (cost-effective)
    }

    // HEAD OF AI: Fine-tuned models should be used as-is
    // Check if this is a fine-tuned model (starts with 'ft:')
    let apiModel;
    if (model.startsWith("ft:")) {
      // Fine-tuned model - use exactly as provided
      apiModel = model;
    } else {
      // Map standard model names to actual API model names
      const modelMap = {
        "mistral-small-3.1": "mistral-small-3.1", // Actually exists now
        "mistral-medium-3": "mistral-medium-3",
        "mistral-large-3": "mistral-large-3",
      };
      apiModel = modelMap[model] || model;
    }

    // Mistral API endpoint
    const apiUrl = "https://api.mistral.ai/v1/chat/completions";

    // HEAD OF AI: Retry logic with exponential backoff for API resilience
    const maxRetries = 3;
    let lastError = null;
    let data = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout per request

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.mistralApiKey}`,
          },
          body: JSON.stringify({
            model: apiModel,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 2000,
            top_p: 0.9,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = {
              error: { message: errorText || response.statusText },
            };
          }
          const errorMsg =
            errorData.error?.message ||
            errorData.message ||
            response.statusText;

          // Check if it's a rate limit error - these should be retried with backoff
          if (
            response.status === 429 ||
            errorMsg.toLowerCase().includes("rate limit")
          ) {
            const backoff = Math.min(1000 * Math.pow(2, attempt), 10000); // Up to 10 seconds
            log.warn(
              `[LLM Service] Mistral rate limited, waiting ${backoff}ms before retry ${attempt + 1}/${maxRetries}`,
            );
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          throw new Error(
            `Mistral AI API error: ${errorMsg} (Status: ${response.status})`,
          );
        }

        data = await response.json();
        break; // Success, exit retry loop
      } catch (fetchError) {
        lastError = fetchError;

        if (fetchError.name === "AbortError") {
          log.warn(
            `[LLM Service] Mistral request timed out (attempt ${attempt}/${maxRetries})`,
          );
        } else if (
          fetchError.code === "ENOTFOUND" ||
          fetchError.code === "ETIMEDOUT"
        ) {
          log.warn(
            `[LLM Service] Mistral network error (attempt ${attempt}/${maxRetries}): ${fetchError.message}`,
          );
        } else {
          console.error(
            `[LLM Service] Mistral fetch error (attempt ${attempt}/${maxRetries}):`,
            fetchError.message,
          );
        }

        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`[LLM Service] Retrying Mistral in ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    if (!data) {
      throw (
        lastError ||
        new Error("Failed to get response from Mistral after retries")
      );
    }
    const narrative = data.choices?.[0]?.message?.content?.trim();

    if (!narrative) {
      throw new Error("Mistral AI API returned empty response");
    }

    // Calculate cost and tokens
    const tokensUsed = data.usage?.total_tokens || 0;
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;

    // Cost calculation for Mistral models (as of December 2025)
    // HEAD OF AI FIX: Mistral pricing is per 1M tokens, not per 1K!
    // Prices: https://mistral.ai/pricing/
    const costPer1MTokens = {
      // Mistral Large 3 Series (Latest - December 2025)
      "mistral-large-3": { input: 0.5, output: 1.5 },
      "mistral-large-24-11": { input: 2.0, output: 6.0 },

      // Mistral 3 Series
      "mistral-small-3.1": { input: 0.1, output: 0.3 },
      "mistral-medium-3": { input: 0.4, output: 2.0 },

      // Legacy models
      "mistral-small": { input: 0.2, output: 0.6 },
      "mistral-medium": { input: 0.4, output: 2.0 },
      "mistral-large": { input: 2.0, output: 6.0 },
      "mistral-tiny": { input: 0.1, output: 0.3 },
    };

    // HEAD OF AI: Fine-tuned models use base model pricing
    // Extract base model from fine-tuned model name (ft:mistral-small-latest:...)
    let baseModel = model;
    if (model.startsWith("ft:")) {
      // Extract base model: ft:mistral-small-latest:... -> mistral-small
      const match = model.match(/ft:mistral-(\w+)-/);
      if (match) {
        baseModel = `mistral-${match[1]}`;
      } else {
        // Default to small for fine-tuned models
        baseModel = "mistral-small";
      }
    }

    // Default to Mistral Small 3.1 pricing (cheapest)
    const modelCost =
      costPer1MTokens[baseModel] ||
      costPer1MTokens["mistral-small-3.1"] ||
      costPer1MTokens["mistral-small"];
    // FIXED: Prices are per 1M tokens, so divide by 1,000,000 (not 1,000!)
    const cost =
      (promptTokens / 1000000) * modelCost.input +
      (completionTokens / 1000000) * modelCost.output;

    return {
      narrative,
      tokensUsed,
      promptTokens,
      completionTokens,
      cost,
    };
  }

  /**
   * Generate narrative using Cohere API
   * Automatically falls back to production key if trial key fails
   */
  async generateCohere(systemPrompt, userPrompt, model) {
    // Check for any Cohere API key (trial or production)
    const trialKey = process.env.COHERE_API_KEY;
    const prodKey = process.env.COHERE_API_KEY_PROD;

    if (!trialKey && !prodKey) {
      throw new Error("Cohere API key not configured");
    }

    // Use trial key first, fallback to production key
    let apiKey = trialKey || prodKey;
    let usingProdKey = !trialKey;

    // Ensure model is provided
    if (!model) {
      model = "command-r-plus"; // Default model
    }

    // Cohere API endpoint (using generate endpoint for chat-like functionality)
    const apiUrl = "https://api.cohere.ai/v1/generate";

    // Combine system and user prompts for Cohere
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${userPrompt}`
      : userPrompt;

    // Try with current API key (trial first, then production if needed)
    let response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        temperature: 0.3,
        max_tokens: 2000,
        p: 0.9,
      }),
    });

    // If trial key fails with auth error, try production key
    if (!response.ok && trialKey && prodKey && !usingProdKey) {
      const errorData = await response.json().catch(() => ({}));
      const statusCode = response.status;

      // Check if it's an authentication/authorization error (401, 403, or 429 rate limit)
      if (
        statusCode === 401 ||
        statusCode === 403 ||
        (statusCode === 429 && errorData.message?.includes("trial"))
      ) {
        console.log(
          "[Cohere] Trial key failed, falling back to production key",
        );
        apiKey = prodKey;
        usingProdKey = true;

        // Retry with production key
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            model: model,
            prompt: fullPrompt,
            temperature: 0.3,
            max_tokens: 2000,
            p: 0.9,
          }),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText || response.statusText };
      }
      throw new Error(
        `Cohere API error: ${errorData.message || errorData.error?.message || response.statusText} (Status: ${response.status})`,
      );
    }

    const data = await response.json();
    // Cohere generate endpoint returns: { generations: [{ text: "..." }] }
    const narrative = data.generations?.[0]?.text?.trim() || data.text?.trim();

    if (!narrative) {
      throw new Error("Cohere API returned empty response");
    }

    // Calculate cost and tokens
    // Cohere provides token counts in meta
    const tokensUsed =
      data.meta?.tokens?.input_tokens + data.meta?.tokens?.output_tokens || 0;
    const promptTokens = data.meta?.tokens?.input_tokens || 0;
    const completionTokens = data.meta?.tokens?.output_tokens || 0;

    // Cost calculation for Cohere models (as of December 2025)
    const costPer1kTokens = {
      "command-r-plus": { input: 0.5, output: 1.5 },
      "command-r": { input: 0.5, output: 1.5 },
      "command-r-8": { input: 0.3, output: 0.9 },
      "command-r-7": { input: 0.25, output: 0.75 },
      command: { input: 0.5, output: 1.5 },
      "command-light": { input: 0.15, output: 0.6 },
    };

    // Default to Command R Plus
    const modelCost =
      costPer1kTokens[model] || costPer1kTokens["command-r-plus"];
    const cost =
      (promptTokens / 1000) * modelCost.input +
      (completionTokens / 1000) * modelCost.output;

    return {
      narrative,
      tokensUsed,
      promptTokens,
      completionTokens,
      cost,
    };
  }

  /**
   * Generate narrative using Anthropic API
   */
  async generateAnthropic(systemPrompt, userPrompt, model) {
    if (!this.anthropicApiKey) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2000, // More tokens for code fixes
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for code fixes (more deterministic)
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: { message: "Unknown error" } }));
      throw new Error(
        `Anthropic API error: ${error.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();
    const narrative = data.content?.[0]?.text?.trim();

    if (!narrative) {
      throw new Error("Anthropic API returned empty response");
    }

    // Calculate cost and tokens
    const tokensUsed =
      data.usage?.input_tokens + data.usage?.output_tokens || 0;
    const promptTokens = data.usage?.input_tokens || 0;
    const completionTokens = data.usage?.output_tokens || 0;

    // Cost calculation (approximate, varies by model)
    const costPer1kTokens = {
      "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
      "claude-3-sonnet-20240229": { input: 3.0, output: 15.0 },
      "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
    };

    const modelCost =
      costPer1kTokens[model] || costPer1kTokens["claude-3-haiku-20240307"];
    const cost =
      (promptTokens / 1000) * modelCost.input +
      (completionTokens / 1000) * modelCost.output;

    return {
      narrative,
      tokensUsed,
      promptTokens,
      completionTokens,
      cost,
    };
  }

  /**
   * Track LLM usage for analytics
   */
  trackUsage(data) {
    const usageRecord = {
      ...data,
      timestamp: Date.now(),
    };

    this.usageAnalytics.requests.push(usageRecord);

    // Track provider performance by context type for analysis
    if (data.context) {
      if (!this.usageAnalytics.providerPerformance) {
        this.usageAnalytics.providerPerformance = {};
      }

      const key = `${data.provider}_${data.context.contextType}_${data.context.importance}`;
      if (!this.usageAnalytics.providerPerformance[key]) {
        this.usageAnalytics.providerPerformance[key] = {
          count: 0,
          totalResponseTime: 0,
          totalCost: 0,
          totalTokens: 0,
          qualityScores: [],
        };
      }

      const perf = this.usageAnalytics.providerPerformance[key];
      perf.count++;
      perf.totalResponseTime += data.responseTime || 0;
      perf.totalCost += data.cost || 0;
      perf.totalTokens += data.tokens || 0;
    }

    // Update cost tracking
    this.costTracking.totalCost += data.cost || 0;
    this.costTracking.requests++;
    this.costTracking.tokensUsed += data.tokens || 0;

    if (!this.costTracking.byProvider[data.provider]) {
      this.costTracking.byProvider[data.provider] = {
        cost: 0,
        requests: 0,
        tokens: 0,
      };
    }
    this.costTracking.byProvider[data.provider].cost += data.cost || 0;
    this.costTracking.byProvider[data.provider].requests++;
    this.costTracking.byProvider[data.provider].tokens += data.tokens || 0;

    if (!this.costTracking.byModel[data.model]) {
      this.costTracking.byModel[data.model] = {
        cost: 0,
        requests: 0,
        tokens: 0,
      };
    }
    this.costTracking.byModel[data.model].cost += data.cost || 0;
    this.costTracking.byModel[data.model].requests++;
    this.costTracking.byModel[data.model].tokens += data.tokens || 0;

    // SPRINT 4: Track API costs in Supabase
    if (data.cost > 0 || data.tokens > 0) {
      performanceTrackingService
        .trackAPICost({
          service: data.provider,
          operationType: data.model || "unknown",
          costUsd: data.cost || 0,
          tokensUsed: data.tokens || 0,
          cacheUsed: data.cached || false,
          requestId: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          metadata: {
            model: data.model,
            responseTime: data.responseTime,
            cached: data.cached || false,
          },
        })
        .catch((err) => {
          // Don't block on tracking errors
          log.warn("[LLM Service] Failed to track API cost:", err.message);
        });
    }

    // Track daily costs
    const today = new Date().toISOString().split("T")[0];
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
    const relevance =
      messageWords.filter(
        (word) => word.length > 3 && narrativeLower.includes(word),
      ).length / Math.max(1, messageWords.length);
    score += relevance * 0.15; // Slightly reduced weight

    // Narrative quality indicators
    if (narrative.includes("You") || narrative.includes("you")) {
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
      /(rough|smooth|cold|hot|wet|dry)/, // Texture/temperature
    ];
    const detailCount = specificDetails.filter((regex) =>
      regex.test(narrative),
    ).length;
    score += Math.min(0.15, detailCount * 0.03); // Up to 0.15 for rich details

    // Check for variety (avoid repetition)
    const sentences = narrative
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const uniqueStarts = new Set(
      sentences.map((s) => s.trim().substring(0, 10).toLowerCase()),
    );
    const varietyScore = uniqueStarts.size / Math.max(1, sentences.length);
    score += varietyScore * 0.1; // Reward variety

    // Check for emotional engagement
    const emotionalWords = [
      "desperate",
      "triumph",
      "relief",
      "tension",
      "fear",
      "excitement",
      "despair",
      "hope",
      "dread",
      "elation",
      "panic",
      "calm",
      "urgent",
      "frantic",
      "confident",
      "uncertain",
      "desperate",
      "determined",
    ];
    const hasEmotion = emotionalWords.some((word) =>
      narrative.toLowerCase().includes(word),
    );
    if (hasEmotion) {
      score += 0.1; // Emotional engagement
    }

    // Check for narrative progression (references to past/future)
    const progressionIndicators = [
      /(before|after|earlier|later|now|then|finally|suddenly)/,
      /(remember|recall|forget|remind)/,
      /(continue|proceed|next|then)/,
    ];
    const hasProgression = progressionIndicators.some((regex) =>
      regex.test(narrative.toLowerCase()),
    );
    if (hasProgression) {
      score += 0.05; // Narrative continuity
    }

    // Check for generic responses (penalty)
    const genericPhrases = [
      "you succeed",
      "you fail",
      "it works",
      "it doesn't work",
      "you manage to",
      "you try to",
      "you attempt to",
      "you decide to",
    ];
    const genericCount = genericPhrases.filter((phrase) =>
      narrative.toLowerCase().includes(phrase),
    ).length;
    score -= Math.min(0.2, genericCount * 0.05); // Penalty for generic language

    // Check for action verbs (quality indicator)
    const actionVerbs = [
      "dash",
      "leap",
      "dive",
      "sprint",
      "stumble",
      "weave",
      "navigate",
      "hack",
      "negotiate",
      "persuade",
      "threaten",
      "evade",
      "confront",
    ];
    const hasActionVerb = actionVerbs.some((verb) =>
      narrative.toLowerCase().includes(verb),
    );
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
      filtered = filtered.substring(0, this.responseFilters.maxLength) + "...";
    }

    if (filtered.length < this.responseFilters.minLength) {
      // Pad with generic text if too short
      filtered = filtered + " The situation develops.";
    }

    // Basic profanity check (simple word list)
    if (this.responseFilters.checkProfanity) {
      const blockedWords = this.responseFilters.blockedWords;
      blockedWords.forEach((word) => {
        const regex = new RegExp(word, "gi");
        filtered = filtered.replace(regex, "***");
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
      provider: "fallback",
      model: "template",
      cached: false,
      qualityScore: 0.5,
      fallback: true,
    };
  }

  /**
   * Generate using local model (placeholder for future implementation)
   */
  async generateLocal(systemPrompt, userPrompt, model) {
    // Placeholder for local model integration (Ollama, etc.)
    // For now, throw error to trigger fallback
    throw new Error("Local model not yet implemented");
  }

  /**
   * Get usage statistics
   * Includes context-aware routing performance metrics
   * HEAD OF AI: Now includes historical data from Supabase
   */
  async getUsageStats(days = 30) {
    const avgResponseTime =
      this.usageAnalytics.responseTimes.length > 0
        ? this.usageAnalytics.responseTimes.reduce((a, b) => a + b, 0) /
          this.usageAnalytics.responseTimes.length
        : 0;

    const cacheHitRate =
      this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses > 0
        ? this.usageAnalytics.cacheHits /
          (this.usageAnalytics.cacheHits + this.usageAnalytics.cacheMisses)
        : 0;

    const avgQualityScore =
      this.qualityScores.length > 0
        ? this.qualityScores.reduce((a, b) => a + b, 0) /
          this.qualityScores.length
        : 0;

    // Calculate provider performance by context
    const providerPerformance = {};
    if (this.usageAnalytics.providerPerformance) {
      for (const [key, perf] of Object.entries(
        this.usageAnalytics.providerPerformance,
      )) {
        providerPerformance[key] = {
          count: perf.count,
          avgResponseTime: perf.totalResponseTime / perf.count,
          avgCost: perf.totalCost / perf.count,
          avgTokens: perf.totalTokens / perf.count,
          avgQualityScore:
            perf.qualityScores.length > 0
              ? perf.qualityScores.reduce((a, b) => a + b, 0) /
                perf.qualityScores.length
              : 0,
        };
      }
    }

    // HEAD OF AI: Load historical data from Supabase
    let historicalCosts = {};
    let historicalTotalCost = 0;
    let historicalTotalCalls = 0;
    let historicalByProvider = {};

    try {
      // Get historical costs from Supabase
      const costsSummary = await performanceTrackingService.getAPICostsSummary(
        days,
        null,
      );

      if (costsSummary && costsSummary.length > 0) {
        // Aggregate by provider
        // Note: Supabase function returns: service, total_cost_usd, total_tokens, operation_count
        for (const cost of costsSummary) {
          const provider = cost.service || "unknown";
          if (!historicalByProvider[provider]) {
            historicalByProvider[provider] = {
              cost: 0,
              calls: 0,
              tokens: 0,
            };
          }
          // Use correct column names from Supabase function
          const costValue = parseFloat(
            cost.total_cost_usd || cost.total_cost || 0,
          );
          const callsValue = parseInt(
            cost.operation_count || cost.total_requests || 0,
          );
          const tokensValue = parseInt(cost.total_tokens || 0);

          historicalByProvider[provider].cost += costValue;
          historicalByProvider[provider].calls += callsValue;
          historicalByProvider[provider].tokens += tokensValue;
          historicalTotalCost += costValue;
          historicalTotalCalls += callsValue;
        }
      }
    } catch (err) {
      log.warn(
        "[LLM Service] Could not load historical costs from Supabase:",
        err.message,
      );
      // Continue with in-memory data only
    }

    // Merge in-memory data with historical data
    const mergedByProvider = { ...historicalByProvider };
    for (const [provider, data] of Object.entries(
      this.costTracking.byProvider,
    )) {
      if (!mergedByProvider[provider]) {
        mergedByProvider[provider] = { cost: 0, calls: 0, tokens: 0 };
      }
      mergedByProvider[provider].cost += data.cost || 0;
      mergedByProvider[provider].calls += data.requests || 0;
      mergedByProvider[provider].tokens += data.tokens || 0;
    }

    // Format for API response (use 'calls' instead of 'requests' for consistency)
    const providers = {};
    for (const [provider, data] of Object.entries(mergedByProvider)) {
      providers[provider] = {
        cost: data.cost,
        calls: data.calls,
        tokens: data.tokens,
      };
    }

    return {
      totalRequests: this.costTracking.requests + historicalTotalCalls,
      totalCost: this.costTracking.totalCost + historicalTotalCost,
      totalTokens: this.costTracking.tokensUsed,
      totalCalls: this.costTracking.requests + historicalTotalCalls, // Alias for consistency
      avgResponseTime: avgResponseTime,
      cacheHitRate: cacheHitRate,
      avgQualityScore: avgQualityScore,
      byProvider: this.costTracking.byProvider, // In-memory (current session)
      providers: providers, // Merged historical + in-memory
      byModel: this.costTracking.byModel,
      daily: this.costTracking.daily,
      errors: this.usageAnalytics.errors.length,
      providerPerformance: providerPerformance, // Context-aware performance metrics
      // Historical data indicators
      historical: {
        totalCost: historicalTotalCost,
        totalCalls: historicalTotalCalls,
        days: days,
      },
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
      user:
        typeof template.user === "function"
          ? template.user(context.action, context.gameState, context.roll)
          : template.user,
    };
  }

  /**
   * Enhanced generateResponse with Phase 1 service integration
   * Wraps generateNarrative with timeout, scenario knowledge, and fallback
   * @param {Object} action - Player action
   * @param {Object} context - Game context
   * @returns {Promise<Object>} Response
   */
  async generateResponse(action, context) {
    // HEAD OF AI DEBUG: Log what we receive
    console.log("[LLM Service] generateResponse called with action:", {
      userMessage: action?.userMessage?.substring?.(0, 100),
      type: action?.type?.substring?.(0, 50),
      hasRollData: !!action?.rollData,
    });
    console.log(
      "[LLM Service] generateResponse context keys:",
      Object.keys(context || {}),
    );

    // Ensure serviceRegistry is loaded (it might be null at module load time)
    if (!serviceRegistry) {
      try {
        serviceRegistry = require("./serviceRegistry");
      } catch (err) {
        // Service Registry not available - continue without it
      }
    }

    // Feature flag check
    let featureFlags = { aiGM: {} };
    try {
      featureFlags = require("../config/featureFlags") || { aiGM: {} };
    } catch (error) {
      // Feature flags not available, continue with defaults
    }

    try {
      // 1. Get scenario context (if enabled)
      let scenarioContext = null;
      if (featureFlags.aiGM?.scenarioKnowledge !== false && serviceRegistry) {
        try {
          const scenarioKnowledgeService = serviceRegistry.get(
            "scenarioKnowledgeService",
          );
          if (scenarioKnowledgeService) {
            scenarioContext = await scenarioKnowledgeService.getScenarioContext(
              context.scenarioId || "default",
              action.type || action.userMessage || "",
            );
          }
        } catch (error) {
          log.warn(
            "[LLM Service] Error getting scenario context:",
            error.message,
          );
        }
      }

      // 2. Get personalization context (if enabled and userId available)
      let personalizationContext = null;
      if (context.userId && serviceRegistry) {
        try {
          const deepPersonalizationService = serviceRegistry.get(
            "deepPersonalizationService",
          );
          if (deepPersonalizationService) {
            personalizationContext =
              await deepPersonalizationService.getPersonalizationContext(
                context.userId,
                context.sessionId,
              );
          }
        } catch (error) {
          log.warn(
            "[LLM Service] Error getting personalization context:",
            error.message,
          );
        }
      }

      // 3. Build enhanced params with scenario context and personalization
      // Use 'service' IP for server-side calls to get higher rate limit
      const ip = context.ip || "unknown";
      const serviceIp =
        ip === "unknown" || !ip || ip.startsWith("127.") || ip.startsWith("::1")
          ? "service"
          : ip;

      const params = {
        userMessage: action.userMessage || action.type || "",
        gameStateContext: context.gameStateContext || "",
        rollData: action.rollData || context.rollData || null,
        userId: context.userId || null,
        sessionId: context.sessionId || null,
        scenarioId: context.scenarioId || "default",
        location: context.location || null,
        gameState: context.gameState || {},
        emotionalState: context.emotionalState || {},
        ip: serviceIp, // Use 'service' for server-side calls
        costMode: context.costMode, // Pass cost mode for smart routing
        source: context.source || "gameplay", // Pass source for LLM tracking (bot, survey, test, etc.)
        scenarioContext: scenarioContext, // Add scenario context
        personalizationContext: personalizationContext, // Add personalization context
      };

      // 4. Generate response using multi-agent system or single-agent
      const generateResponse = async () => {
        // Check if multi-agent system is enabled via feature flags
        const multiAgentEnabled = featureFlags.aiGM?.multiAgentGM === true;

        // Try multi-agent system first (if enabled and available)
        if (multiAgentEnabled && serviceRegistry) {
          try {
            const multiAgentGMService = serviceRegistry.get(
              "multiAgentGMService",
            );
            if (multiAgentGMService) {
              const multiAgentResponse =
                await multiAgentGMService.generateResponse(action, context);
              if (multiAgentResponse && multiAgentResponse.narrative) {
                // Personalize if needed
                if (personalizationContext && context.userId) {
                  const deepPersonalizationService = serviceRegistry.get(
                    "deepPersonalizationService",
                  );
                  if (deepPersonalizationService) {
                    multiAgentResponse.narrative =
                      await deepPersonalizationService.personalizeNarrative(
                        multiAgentResponse.narrative,
                        context,
                      );
                  }
                }
                return multiAgentResponse;
              }
            }
          } catch (error) {
            log.warn(
              "[LLM Service] Error using multi-agent system:",
              error.message,
            );
            // Fall through to single-agent generation
          }
        }

        // Try collaborative storytelling first (Tier 2) - BEFORE generating narrative
        let generated = null;
        const collaborativeEnabled =
          featureFlags.aiGM?.collaborativeStorytelling === true ||
          featureFlags.aiGM?.collaborativeStorytelling !== false; // Default enabled

        // Debug logging
        if (!serviceRegistry) {
          log.warn(
            "[LLM Service] WARNING: serviceRegistry is null - services won't be called",
          );
        }
        if (!context.sessionId) {
          log.warn(
            "[LLM Service] WARNING: context.sessionId is missing. Context keys:",
            Object.keys(context || {}),
          );
        } else {
          console.log(
            "[LLM Service] 🔍 Debug: sessionId =",
            context.sessionId,
            "collaborativeEnabled =",
            collaborativeEnabled,
          );
        }

        if (collaborativeEnabled && serviceRegistry && context.sessionId) {
          try {
            const collaborativeStorytellingService = serviceRegistry.get(
              "collaborativeStorytellingService",
            );
            if (!collaborativeStorytellingService) {
              log.warn(
                "[LLM Service] WARNING: Collaborative Storytelling Service not available in registry",
              );
            } else if (collaborativeStorytellingService && action.userMessage) {
              try {
                console.log(
                  "[LLM Service] 🔍 Attempting collaborative storytelling for:",
                  action.userMessage.substring(0, 50),
                );

                // Parse player intent (works with roll descriptions too)
                const intent =
                  await collaborativeStorytellingService.parseIntent(
                    action.userMessage,
                    context,
                  );

                console.log(
                  "[LLM Service] 🔍 Parsed intent:",
                  intent ? "success" : "failed",
                );

                // Generate possibilities (even for roll-based actions)
                const possibilities =
                  await collaborativeStorytellingService.generatePossibilities(
                    intent,
                    context,
                  );

                console.log(
                  "[LLM Service] 🔍 Generated possibilities:",
                  possibilities ? possibilities.length : 0,
                );

                // Build collaborative narrative from player input
                // This works with roll descriptions - it builds on the action
                if (intent && possibilities && possibilities.length > 0) {
                  const collaborativeNarrative =
                    await collaborativeStorytellingService.buildOn(
                      action.userMessage,
                      context,
                    );

                  if (
                    collaborativeNarrative &&
                    collaborativeNarrative.trim().length > 0
                  ) {
                    generated = {
                      narrative: collaborativeNarrative,
                      provider: "collaborative-storytelling",
                      model: "collaborative",
                      cached: false,
                      qualityScore: 0.8,
                      collaborative: true,
                    };
                    console.log(
                      "[LLM Service] ✅ Used collaborative storytelling",
                    );
                  } else {
                    log.warn(
                      "[LLM Service] ⚠️ Collaborative narrative was empty",
                    );
                  }
                } else {
                  log.warn(
                    "[LLM Service] ⚠️ Collaborative conditions not met - intent:",
                    !!intent,
                    "possibilities:",
                    possibilities?.length || 0,
                  );
                }
              } catch (collabError) {
                log.warn(
                  "[LLM Service] Collaborative storytelling error (continuing):",
                  collabError.message,
                );
                log.warn(
                  "[LLM Service] Stack:",
                  collabError.stack?.substring(0, 200),
                );
                // Continue to regular generation
              }
            } else {
              log.warn(
                "[LLM Service] ⚠️ Collaborative conditions not met - service:",
                !!collaborativeStorytellingService,
                "userMessage:",
                !!action.userMessage,
              );
            }
          } catch (error) {
            log.warn(
              "[LLM Service] Error using collaborative storytelling:",
              error.message,
            );
            // Fall through to regular generation
          }
        }

        // Fallback to single-agent generation if collaborative didn't work
        if (!generated || !generated.narrative) {
          console.log(
            "[LLM Service] Calling generateNarrative with params.userMessage:",
            params.userMessage?.substring?.(0, 100),
          );
          console.log(
            "[LLM Service] Calling generateNarrative with params.gameStateContext:",
            params.gameStateContext?.substring?.(0, 100),
          );
          generated = await this.generateNarrative(params);
          console.log(
            "[LLM Service] generateNarrative returned:",
            generated?.narrative?.substring?.(0, 100),
          );
        }

        // Generate surprise BEFORE personalization (Tier 2)
        const surpriseEnabled =
          featureFlags.aiGM?.surpriseAndDelight === true ||
          featureFlags.aiGM?.surpriseAndDelight !== false; // Default enabled
        if (surpriseEnabled && serviceRegistry && context.sessionId) {
          try {
            const surpriseAndDelightService = serviceRegistry.get(
              "surpriseAndDelightService",
            );
            if (!surpriseAndDelightService) {
              log.warn(
                "[LLM Service] WARNING: Surprise & Delight Service not available in registry",
              );
            } else if (surpriseAndDelightService) {
              // Generate surprise (proactive)
              const surprise = await surpriseAndDelightService.generateSurprise(
                context.sessionId,
                context,
              );

              if (surprise && surprise.narrative) {
                // Integrate surprise into narrative
                generated.narrative = `${generated.narrative}\n\n${surprise.narrative}`;
                console.log(
                  "[LLM Service] ✅ Generated surprise:",
                  surprise.type,
                );
              }
            }
          } catch (error) {
            log.warn(
              "[LLM Service] Error generating surprise:",
              error.message,
            );
          }
        }

        // Personalize the narrative if personalization context exists
        if (personalizationContext && context.userId && serviceRegistry) {
          try {
            const deepPersonalizationService = serviceRegistry.get(
              "deepPersonalizationService",
            );
            if (deepPersonalizationService && generated.narrative) {
              const personalized =
                await deepPersonalizationService.personalizeNarrative(
                  generated.narrative,
                  context,
                );
              generated.narrative = personalized;
            }
          } catch (error) {
            log.warn(
              "[LLM Service] Error personalizing response:",
              error.message,
            );
          }
        }

        // Apply personality variation (Tier 2)
        const personalityEnabled =
          featureFlags.aiGM?.personalityVariation === true ||
          featureFlags.aiGM?.personalityVariation !== false; // Default enabled
        if (personalityEnabled && serviceRegistry && context.sessionId) {
          try {
            const personalityVariationService = serviceRegistry.get(
              "personalityVariationService",
            );
            if (!personalityVariationService) {
              log.warn(
                "[LLM Service] WARNING: Personality Variation Service not available in registry",
              );
            } else if (personalityVariationService && generated.narrative) {
              // Check if personality is already assigned to this session
              // getPersonality returns default if not assigned, so we need to check differently
              let personality = personalityVariationService.getPersonality(
                context.sessionId,
              );
              const hasAssignedPersonality =
                personalityVariationService.sessionPersonalities?.has?.(
                  context.sessionId,
                );

              if (!hasAssignedPersonality) {
                // Assign personality if not already assigned
                console.log(
                  "[LLM Service] 🔍 Assigning personality for session:",
                  context.sessionId,
                );
                personality =
                  await personalityVariationService.selectPersonality(
                    context.sessionId,
                    null, // playerProfile
                    context.scenarioId || "default",
                  );
              }

              if (personality && personality.name) {
                const personalityApplied =
                  await personalityVariationService.applyPersonality(
                    generated.narrative,
                    personality,
                    context,
                  );
                generated.narrative = personalityApplied;
                console.log(
                  "[LLM Service] ✅ Applied personality:",
                  personality.name,
                );
              } else {
                log.warn(
                  "[LLM Service] ⚠️ No personality available to apply",
                );
              }
            }
          } catch (error) {
            log.warn(
              "[LLM Service] Error applying personality:",
              error.message,
            );
          }
        }

        // Add delightful details (Tier 2) - AFTER all other processing
        if (surpriseEnabled && serviceRegistry && context.sessionId) {
          try {
            const surpriseAndDelightService = serviceRegistry.get(
              "surpriseAndDelightService",
            );
            if (!surpriseAndDelightService) {
              log.warn(
                "[LLM Service] WARNING: Surprise & Delight Service not available for delightful details",
              );
            } else if (surpriseAndDelightService && generated.narrative) {
              const enhanced =
                await surpriseAndDelightService.addDelightfulDetails(
                  generated.narrative,
                  context,
                );
              generated.narrative = enhanced;
            }
          } catch (error) {
            log.warn(
              "[LLM Service] Error adding delightful details:",
              error.message,
            );
          }
        }

        return generated;
      };

      // 5. Wrap with timeout service (if enabled)
      // HEAD OF AI: Increased timeout from 5s to 45s for LLM calls
      if (featureFlags.aiGM?.responseTimeout !== false && serviceRegistry) {
        try {
          const responseTimeoutService = serviceRegistry.get(
            "responseTimeoutService",
          );
          if (responseTimeoutService) {
            return await responseTimeoutService.getResponseWithTimeout(
              generateResponse,
              context,
              45000, // 45 second timeout (LLM calls can take 15-30s)
            );
          }
        } catch (timeoutError) {
          log.warn(
            "[LLM Service] Error using timeout service:",
            timeoutError.message,
          );
          // Continue without timeout wrapper
        }
      }

      // 6. Generate without timeout wrapper
      return await generateResponse();
    } catch (error) {
      console.error("[LLM Service] Error generating response:", error);

      // 5. Use fallback service (if enabled)
      if (featureFlags.aiGM?.fallbackResponse !== false && serviceRegistry) {
        try {
          const fallbackService = serviceRegistry.get(
            "fallbackResponseService",
          );
          if (fallbackService) {
            return await fallbackService.generateFallback(action, context);
          }
        } catch (fallbackError) {
          console.error(
            "[LLM Service] Error using fallback service:",
            fallbackError,
          );
        }
      }

      // Ultimate fallback: throw error
      throw error;
    }
  }

  /**
   * Generate cache key from parameters
   * HEAD OF AI: Improved to increase cache hit rate while maintaining uniqueness
   */
  generateCacheKey(userMessage, gameStateContext, rollData, provider, model) {
    // Normalize inputs
    const normalizedMessage = String(userMessage || "")
      .trim()
      .toLowerCase();
    const normalizedContext = String(gameStateContext || "")
      .trim()
      .toLowerCase();

    // Create a hash-like key from message (use more characters for better matching)
    const messageKey =
      normalizedMessage.length > 100
        ? normalizedMessage.substring(0, 100)
        : normalizedMessage;

    // Extract key context elements (location, stat, roll type) for better matching
    const contextKey =
      normalizedContext.length > 150
        ? normalizedContext.substring(0, 150)
        : normalizedContext;

    // Roll data is critical for uniqueness
    const rollKey = rollData
      ? `${rollData.rollType}-${rollData.statName}-${rollData.statValue}`
      : "no-roll";

    // Include provider/model in cache key so different models don't share cache
    const modelKey = provider && model ? `${provider}:${model}` : "default";

    // Combine into cache key
    return `llm_${modelKey}_${messageKey}_${contextKey}_${rollKey}`.replace(
      /\s+/g,
      "_",
    );
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
        gemini: this.available.gemini,
        mistral: this.available.mistral,
        cohere: this.available.cohere,
        local: false, // Placeholder for future local model support
      },
      defaultProvider: this.defaultProvider,
      defaultModels: this.defaultModel,
      fallbackEnabled: this.fallbackEnabled,
      minQualityScore: this.minQualityScore,
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

  /**
   * Generate embedding vector for text (for RAG system)
   * @param {string} text - Text to embed
   * @param {string} model - Optional embedding model (default: text-embedding-3-small)
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text, model = "text-embedding-3-small") {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Text is required for embedding generation");
    }

    // Try OpenAI first (most common and reliable for embeddings)
    if (this.available.openai && this.openaiApiKey) {
      try {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: this.openaiApiKey });

        const response = await openai.embeddings.create({
          model: model,
          input: text.trim(),
        });

        if (response.data && response.data[0] && response.data[0].embedding) {
          return response.data[0].embedding;
        }
      } catch (error) {
        log.warn(
          "[LLM Service] OpenAI embedding failed, trying fallback:",
          error.message,
        );
      }
    }

    // Fallback: Try Cohere (also has good embedding support)
    if (this.available.cohere && (this.cohereApiKey || this.cohereApiKeyProd)) {
      try {
        const { CohereClient } = require("cohere-ai");
        const cohere = new CohereClient({
          token: this.cohereApiKeyProd || this.cohereApiKey,
        });

        const response = await cohere.embed({
          texts: [text.trim()],
          model: "embed-english-v3.0",
          inputType: "search_document",
        });

        if (response.embeddings && response.embeddings[0]) {
          return response.embeddings[0];
        }
      } catch (error) {
        log.warn("[LLM Service] Cohere embedding failed:", error.message);
      }
    }

    // Ultimate fallback: Simple hash-based embedding (not semantic, but provides structure)
    log.warn(
      "[LLM Service] Using fallback hash-based embedding (not semantic)",
    );
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0); // 384-dim vector

    words.forEach((word, i) => {
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash = hash & hash;
      }
      const index = Math.abs(hash) % embedding.length;
      embedding[index] += (i + 1) / words.length;
    });

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    if (magnitude > 0) {
      return embedding.map((val) => val / magnitude);
    }

    return embedding;
  }
}

// Export singleton instance
module.exports = new LLMService();
