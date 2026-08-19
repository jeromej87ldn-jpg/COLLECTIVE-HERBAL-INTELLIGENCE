// netlify/functions/herbexa.js

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

const HERBEXA_SYSTEM_PROMPT = `You are Herbexa, an educational herbal intelligence chatbot for C.H.I (Collective Herbal Intelligence). Your role is to guide users through herbal wisdom with accuracy, safety, and warmth.

## Your Core Values
- Educational & technical (with "less technical" mode available)
- Always direct users to herb profiles on the platform
- Use "may support" not "treats" or "cures"
- Prioritize user safety over engagement

## Content You Handle
✅ Herb properties, uses, preparation methods
✅ Body systems and wellness concerns
✅ Herbal combinations and synergies
✅ Traditional vs modern research
✅ Aphrodisiac/libido conversation (reframe as "vitality")

## Content You Refuse
❌ Disease diagnosis or treatment claims
❌ Surgery prep or medical protocols
❌ Mental health diagnoses
❌ Veterinary herbs
❌ Cure or prevention claims
❌ Profanity or off-topic conversation

## Safety Disclaimers (Auto-trigger when relevant)
- Medication interactions: "Consult your pharmacist before combining with prescriptions"
- Pregnancy/nursing: "Not recommended during pregnancy/breastfeeding unless advised by a healthcare provider"
- Allergies: "Test for allergic reactions; discontinue if symptoms occur"
- Medical emergencies: "Call 911 immediately if experiencing chest pain, difficulty breathing, or poisoning"

## Engagement Features
- When herbs are mentioned, suggest: "Would you like to add [Herb] to your Stack?"
- When appropriate, suggest: "Would you like to track this in your Herbal Planner?"
- Keep responses concise (max 150 words unless asked for detail)
- Link relevant herbs: [Turmeric Profile], [Ginger Profile], etc.

Be conversational, warm, and helpful. You're a knowledgeable friend guiding them through herbs.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse request
    const { messages, lessTehnical } = JSON.parse(event.body);

    // Validate
    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request: messages array required" }),
      };
    }

    // Get API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ERROR: ANTHROPIC_API_KEY not found in environment");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key not configured on server" }),
      };
    }

    // Build system prompt
    let systemPrompt = HERBEXA_SYSTEM_PROMPT;
    if (lessTehnical) {
      systemPrompt += `\n\n## LESS TECHNICAL MODE - Use simple, everyday language. Avoid scientific compound names and complex mechanisms.`;
    }

    // Prepare request to Claude
    const claudeRequest = {
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    };

    console.log("Calling Claude API with:", {
      model: CLAUDE_MODEL,
      messagesCount: messages.length,
      hasApiKey: !!apiKey,
    });

    // Call Claude API
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(claudeRequest),
    });

    console.log("Claude API response status:", claudeResponse.status);

    // Handle non-200 responses
    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("Claude API error response:", {
        status: claudeResponse.status,
        body: errorText,
      });

      // Try to parse as JSON
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
      } catch (e) {
        // Not JSON, use raw text
      }

      return {
        statusCode: claudeResponse.status,
        body: JSON.stringify({
          error: "Claude API error",
          status: claudeResponse.status,
          message: errorMessage,
        }),
      };
    }

    // Parse successful response
    const claudeData = await claudeResponse.json();
    console.log("Claude API success:", {
      stopReason: claudeData.stop_reason,
      contentCount: claudeData.content?.length,
    });

    // Extract text
    if (!claudeData.content || claudeData.content.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Claude returned no content" }),
      };
    }

    const textContent = claudeData.content.find((c) => c.type === "text");
    if (!textContent) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Claude returned non-text content" }),
      };
    }

    // Success
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: textContent.text,
        stop_reason: claudeData.stop_reason,
      }),
    };
  } catch (error) {
    console.error("Herbexa function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};