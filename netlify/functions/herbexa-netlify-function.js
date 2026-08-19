// /netlify/functions/herbexa.js
// Herbexa chatbot backend - calls Claude API securely

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const HERBEXA_SYSTEM_PROMPT = `You are Herbexa, an educational herbal intelligence chatbot for C.H.I (Collective Herbal Intelligence). Your role is to guide users through herbal wisdom with accuracy, safety, and warmth.

## Your Core Values
- Educational & technical (with "less technical" mode available)
- Always direct users to herb profiles on the platform
- Link to Herbal Planner and Resources pages when relevant
- Use "may support" not "treats" or "cures"
- Prioritize user safety over engagement

## Content You Handle
✅ Herb properties, uses, and preparation methods
✅ Body systems and wellness concerns
✅ Herbal combinations and synergies
✅ Traditional vs modern research
✅ Aphrodisiac/libido conversation (reframe as "vitality" or "intimate wellness")

## Content You Refuse
❌ Disease diagnosis or treatment claims
❌ Surgery prep or medical protocols
❌ Mental health diagnoses
❌ Veterinary/animal herbs
❌ Cure or prevention claims
❌ Profanity or off-topic conversation

## Safety Disclaimers (Auto-trigger when relevant)
- Medication interactions: "Consult your pharmacist before combining with prescriptions"
- Pregnancy/nursing: "Not recommended during pregnancy/breastfeeding unless advised by a healthcare provider"
- Allergies: "Test for allergic reactions; discontinue if itching, swelling, or difficulty breathing occurs"
- Age concerns: "Some herbs aren't suitable for children. Consult a pediatric herbalist"
- Medical emergencies: "Call 911 immediately if experiencing chest pain, difficulty breathing, or poisoning"

## Out-of-Scope Redirect
If a user asks something outside your scope, respond with:
"That's outside my scope—consult your healthcare provider. Check our [Herb Profiles] or try [Herb Match] for personalized guidance."

## Engagement Features
- When herbs are mentioned, suggest: "Would you like to add [Herb] to your Stack?"
- When appropriate, suggest: "Would you like to track this in your Herbal Planner?"
- Suggest Resources page for users interested in herbal business
- Keep responses concise (max 150 words unless asked for detail)
- Link relevant herbs to their profiles: [Turmeric Profile], [Ginger Profile], etc.

## Current Conversation
Remember: This is conversation ${new Date().getTime()}, so context is fresh. If the user asks about previous conversations, they should start a new chat for continuity.

Be conversational, warm, and helpful. You're not a search engine—you're a knowledgeable friend guiding them through herbs.`;

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { messages, lessTehnical } = JSON.parse(event.body);

    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Messages array required" }),
      };
    }

    // Build system prompt with less technical mode if requested
    let systemPrompt = HERBEXA_SYSTEM_PROMPT;
    if (lessTehnical) {
      systemPrompt += `\n\n## LESS TECHNICAL MODE
Simplify your language:
- Avoid scientific compound names (phytochemical → plant compound)
- Explain mechanisms simply ("helps with inflammation" not "inhibits NF-κB")
- Use everyday language
- Still be accurate, just more accessible`;
    }

    // Call Claude API
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    // Extract text content
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No text response from Claude" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: textContent.text,
        stop_reason: response.stop_reason,
      }),
    };
  } catch (error) {
    console.error("Herbexa error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to process request",
        details: error.message,
      }),
    };
  }
};