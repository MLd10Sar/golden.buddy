import { GoogleGenAI, Modality } from "@google/genai";
import { Session, Interest } from "../types";

function getApiKey(): string | null {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) return process.env.API_KEY;
  } catch (e) {}
  return null;
}

function getAIClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// Guideline helper for base64 decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Guideline helper for raw PCM audio decoding
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Uses Google Search grounding to find a safe public meeting spot AND checks local weather.
 */
export async function getSmartMeetingSpot(areaName: string, activity: Interest) {
  const ai = getAIClient();
  if (!ai) return null;

  try {
    const prompt = `Suggest a specific, senior-safe public meeting spot in ${areaName} for ${activity}. 
                    Also check the current typical weather for ${areaName} and provide a safety tip.
                    Labels needed: 
                    NAME, REASON, HOURS, DIRECTIONS, WEATHER_TIP.`;
    
    // Using gemini-3-pro-preview for complex reasoning and search grounding
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });

    const text = response.text || "";
    const extract = (label: string) => {
      const regex = new RegExp(`${label}:\\s*(.*)`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : "";
    };

    return {
      name: extract('NAME') || "Local Public Library",
      reason: extract('REASON') || "Safe, public, and has plenty of seating.",
      hours: extract('HOURS') || "Generally open 9 AM - 6 PM.",
      directions: extract('DIRECTIONS') || "Meet by the front main doors.",
      weatherTip: extract('WEATHER_TIP') || "Check the window before you go!",
      mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(extract('NAME') + " " + areaName)}`
    };
  } catch (error) {
    return { name: "Local Library", reason: "Safe and public.", hours: "Daylight", directions: "Meet in lobby.", weatherTip: "Stay safe!", mapsUrl: "https://maps.google.com" };
  }
}

/**
 * Reads text aloud for seniors using Gemini TTS.
 */
export async function speakText(text: string) {
  const ai = getAIClient();
  if (!ai) return;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say warmly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      // Following recommended audio decoding practices for raw PCM
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    }
  } catch (e) {
    console.error("TTS Error:", e);
  }
}
