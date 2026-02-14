
import { GoogleGenAI } from "@google/genai";
import { Session, Interest } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates an AI-powered insight on why two buddies are a good match.
 */
export async function getBuddyInsight(user: Session, buddy: any) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User: ${user.displayName}, interests: ${user.interests.join(", ")}. 
                Buddy: ${buddy.displayName}, interests: ${buddy.interests.join(", ")}.
                Explain in 1-2 friendly sentences why they should meet. 
                Keep it very warm, simple, and encouraging for a senior. 
                Also suggest 1 specific icebreaker question.`,
      config: {
        systemInstruction: "You are a warm social facilitator for seniors. Your goal is to foster community and reduce loneliness by highlighting shared interests.",
      }
    });
    
    const text = response.text || "";
    // Basic split for insight and icebreaker
    const [insight, icebreaker] = text.split(/\?|\./).reduce((acc: string[], val, idx, arr) => {
        if (idx < arr.length - 1) acc[0] = (acc[0] || "") + val + (idx === arr.length - 2 ? "?" : ".");
        else acc[1] = val.trim();
        return acc;
    }, []);

    return {
      insight: insight || text,
      icebreaker: icebreaker || "How long have you lived in the neighborhood?"
    };
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return null;
  }
}

/**
 * Uses Google Search/Maps grounding to find a safe public meeting spot with specific metadata.
 */
export async function getSmartMeetingSpot(areaName: string, activity: Interest) {
  try {
    const prompt = `Find one specific, very safe, and popular public meeting spot in ${areaName} for two seniors to meet for ${activity}. 
                    Provide exactly these 5 fields with these exact labels:
                    NAME: (The name of the place)
                    REASON: (1 sentence why it is safe and good for seniors - e.g. lighting, seating)
                    HOURS: (Typical opening hours)
                    MAPS: (A direct Google Maps URL if available)
                    DIRECTIONS: (1 simple arrival tip for seniors - e.g. 'Meet near the main entrance benches')`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => chunk.web?.uri).filter(Boolean) || [];

    // Helper to extract values based on labels
    const extract = (label: string) => {
      const regex = new RegExp(`${label}:\\s*(.*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : "";
    };

    return {
      name: extract('NAME') || "Local Community Hub",
      reason: extract('REASON') || "A safe and central place to meet.",
      hours: extract('HOURS') || "Generally open during daylight hours.",
      mapsUrl: extract('MAPS') || "https://maps.google.com",
      directions: extract('DIRECTIONS') || "Meet at the main entrance.",
      sources: sources.slice(0, 2)
    };
  } catch (error) {
    console.error("Gemini Spot Error:", error);
    return { 
      name: "The Local Library", 
      reason: "Safe, quiet, and plenty of seating.", 
      hours: "Varies - Check local listings", 
      mapsUrl: "https://maps.google.com",
      directions: "Meet by the front reception desk inside.",
      sources: [] 
    };
  }
}

/**
 * Polishes a coordination note or suggests one if none exists.
 */
export async function polishCoordinationNote(note: string, activity?: Interest, areaName?: string) {
  try {
    const isSuggestion = !note.trim();
    const prompt = isSuggestion
      ? `You are an AI for a senior social app. Suggest one very warm, short, and practical coordination note for a senior meeting a buddy for ${activity || 'an activity'} in ${areaName || 'the neighborhood'}. 
         The note should help them spot each other (e.g., "I'll be near the fountain in a blue jacket").
         Return ONLY the text of the note.`
      : `You are an AI for a senior social app. Polish this coordination note for meeting a buddy for ${activity || 'an activity'} in ${areaName || 'the neighborhood'}.
         Make it warmer, clearer, and more helpful for seniors.
         Original note: "${note}"
         Return ONLY the polished text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || note;
  } catch (error) {
    console.error("Polish Error:", error);
    return note;
  }
}
