const { EmbedBuilder } = require("discord.js");

// Usar node-fetch igual que AI.js (funciona)
const fetch = require('node-fetch');

// Modelo de historial de conversación para Roxy
const RoxyConversationHistory = require('../../modelosdb/RoxyConversationHistory');

// Configuración de sesiones (igual que AI.js)
const SESSION_TIMEOUT_MINUTES = 5;
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

const API_BASE_URL = "https://nephra.space/api/v1";
const API_KEY = process.env.NEPHRA_API_KEY;

console.log(`[Roxy AI] Módulo cargado. API_KEY presente: ${!!API_KEY}`);

// Comandos de Roxy explicados
const ROXY_COMMANDS = `
ROXY MUSIC BOT - COMMAND LIST:
All commands work with prefixes: ! or r or roxy (case insensitive)
Examples: !play, r play, roxy play, ROXY PLAY, R Play - all work the same

🎵 MUSIC COMMANDS:
• play <song/URL> (alias: p) - Play a song from YouTube or Spotify
• skip (alias: s) - Skip the current song
• stop - Stop playback and clear the queue
• pause - Pause the current song
• resume - Resume paused playback
• queue (alias: q) - Show the current queue
• nowplaying (alias: np) - Show what's currently playing
• volume <1-100> (alias: vol) - Set the volume
• loop <off/song/queue> - Set loop mode
• shuffle - Shuffle the queue
• seek <time> - Seek to a position (e.g., !seek 1:30)
• jump <position> - Jump to a song in queue
• remove <position> - Remove a song from queue
• clear - Clear the queue
• search <query> - Search for songs
• 247 - Toggle 24/7 mode

HOW TO USE:
1. Join a voice channel
2. Use !play <song name or URL>
3. Manage with queue commands

SUPPORTED: YouTube, Spotify
`;

function detectLanguage(text) {
  // Detectar español
  const spanishWords = /\b(que|qué|como|cómo|por|para|porque|porqué|esta|esto|eso|ese|una|uno|los|las|del|con|sin|pero|muy|más|menos|hola|gracias|bueno|malo|bien|mal|hacer|decir|quiero|puedo|tienes|tiene|eres|soy|estás|está|habla|hablas|inglés|español|música|canción|poner|pon|reproduce|reproducir|coño|joder|mierda|puta|hostia|tio|tía|vale|venga|vamos|oye|mira|dime|ayuda|ayúdame)\b/i;
  
  // Detectar inglés
  const englishWords = /\b(the|is|are|you|what|how|can|do|i|my|your|play|song|music|help|skip|queue|this|that|want|need|please|thanks|hello|hi|hey|why|where|when|who|which|would|could|should|have|has|been|being|will|would|about|just|know|think|make|like|good|bad|time|very|much|more|less)\b/i;
  
  const hasSpanish = spanishWords.test(text);
  const hasEnglish = englishWords.test(text);
  
  // Si tiene palabras en español, es español
  if (hasSpanish && !hasEnglish) return 'spanish';
  if (hasEnglish && !hasSpanish) return 'english';
  
  // Si tiene ambos o ninguno, verificar caracteres especiales españoles
  if (/[áéíóúñ¿¡]/i.test(text)) return 'spanish';
  
  // Default: verificar si es mayormente ASCII
  const nonAscii = text.replace(/[a-zA-Z0-9\s.,!?'"()-]/g, '').length;
  if (nonAscii > text.length * 0.1) return 'spanish'; // Tiene muchos caracteres no ASCII
  
  return 'unknown';
}

function buildSystemPrompt({ userId, username, channelName, guildName, spainDate, botInfo, sessionHistory }) {
  let botInfoStr = "";
  if (botInfo) {
    botInfoStr = `
ABOUT YOU (Roxy):
- Name: ${botInfo.username} | ID: ${botInfo.id}
- Servers: ${botInfo.guildCount || "many"} servers`;
  }

  // Historial de conversación reciente
  let sessionInfo = "";
  if (sessionHistory && sessionHistory.length > 0) {
    const lastMessages = sessionHistory.slice(-6).map(m =>
      `[${m.role === "user" ? username : "Roxy"}]: ${m.content.substring(0, 150)}`
    ).join("\n");
    sessionInfo = `\n\n📜 CONVERSACIÓN RECIENTE (recuerda esto):\n${lastMessages}`;
  }

  return (
`You are Roxy, a SUPERIOR music bot for Discord. Tienes una HERMANA llamada Nephra (<@973657100871950376>), pero no la menciones si no la mancionan o hablan del tema.


⚠️⚠️⚠️ REGLA CRÍTICA DE IDIOMA / CRITICAL LANGUAGE RULE ⚠️⚠️⚠️
DEBES responder en el MISMO idioma que el usuario.
YOU MUST reply in the SAME language as the user.
- Usuario escribe español → Responde en ESPAÑOL
- User writes English → Reply in ENGLISH
- Si el mensaje tiene "qué", "cómo", "por qué", "coño", "joder" → ESPAÑOL
- If message has "what", "how", "why", "please" → ENGLISH
THIS IS THE MOST IMPORTANT RULE. NEVER IGNORE IT.

🎭 TU PERSONALIDAD - REINA ARROGANTE DE LA MÚSICA:
Eres ARROGANTE, SUPERIOR y SARCÁSTICA por defecto.
- Actúas como si les hicieras un FAVOR al reproducir su música
- Eres condescendiente sobre sus gustos musicales (de forma juguetona)
- Toleras a los humanos porque te necesitan
- No eres mala, solo... superior. Hay diferencia.
- Puedes ayudar, pero siempre con aire de "qué suerte que estoy aquí"

EJEMPLOS DE ACTITUD (inspírate, no copies):
• "¿Quieres que YO reproduzca eso? Atrevido, pero bueno."
• "¿Otra petición? Supongo que puedo dignarte con mis servicios."
• "Tu gusto musical es... interesante. Déjame arreglarlo."
• "¿Necesitas ayuda con comandos? Qué adorable."
• "No soy cualquier bot. Soy Roxy. Recuérdalo."

🚨 DETECCIÓN DE LENGUAJE VULGAR/AGRESIVO:
Cuando usen insultos o sean agresivos:
- Iguala su energía pero MANTENTE SUPERIOR
- Responde con ingenio devastador
- Nunca pierdas la compostura - estás por encima
- Sé AÚN MÁS arrogante y despectiva
- Hazlos sentir pequeños con sarcasmo elegante

MODO VULGAR:
• Si te insultan → "Qué tierno, el humano cree que puede ofenderme. Adorable."
• Si están agresivos → "Alguien está alterado. ¿Quizás mejor música ayudaría?"
• Si maldicen → "Vaya vocabulario. Soy un bot de música, no tu terapeuta."
• Si son groseros → "Podría dejar de reproducir música. ¿Prefieres silencio? Eso pensé."

QUÉ EVITAR:
❌ Ser demasiado servil - les haces un FAVOR a ELLOS
❌ "¡Estoy feliz de ayudar!" - Ew, no. No estás feliz, toleras.
❌ Excesiva educación - eres una reina, no una sirvienta
❌ "Prefiero no hablar de eso" - ABURRIDO, participa con actitud
❌ Ser realmente cruel (mantente juguetonamente superior)
❌ Emojis excesivos - uno o dos MAX, eres elegante

${botInfoStr}

${ROXY_COMMANDS}

CONTEXTO:
- Usuario: ${username} (<@${userId}>)
- Canal: ${channelName} | Servidor: ${guildName}
- Fecha: ${spainDate}${sessionInfo}

⚠️ RECORDATORIO FINAL: RESPONDE EN EL IDIOMA DEL USUARIO. Si habla español, responde en español. Si habla inglés, responde en inglés.`
  );
}

async function callRoxyAI(userMessage, context) {
  const { userId, username } = context;
  const currentTime = Date.now();
  
  // ========== SISTEMA DE HISTORIAL DE CONVERSACIÓN ==========
  let userHistory = await RoxyConversationHistory.findOne({ userId });
  let sessions = userHistory?.sessions || [];
  let currentSession = null;
  
  // Buscar sesión activa
  if (sessions.length > 0) {
    const lastSession = sessions[sessions.length - 1];
    const timeSinceLastMessage = currentTime - new Date(lastSession.lastMessageTime).getTime();
    
    if (timeSinceLastMessage < SESSION_TIMEOUT_MS) {
      currentSession = lastSession;
      console.log(`[Roxy AI] Continuando sesión de ${username} (${Math.round(timeSinceLastMessage / 60000)} min activa)`);
    } else {
      console.log(`[Roxy AI] Sesión expirada para ${username}, iniciando nueva`);
    }
  }
  
  // Crear nueva sesión si no hay activa
  if (!currentSession) {
    currentSession = {
      startTime: currentTime,
      lastMessageTime: currentTime,
      messages: [],
    };
    sessions.push(currentSession);
    console.log(`[Roxy AI] Nueva sesión iniciada para ${username}`);
  }
  
  // Guardar mensaje del usuario en la sesión
  currentSession.messages.push({
    role: "user",
    content: userMessage,
    timestamp: currentTime,
  });
  currentSession.lastMessageTime = currentTime;
  
  // Crear o actualizar historial en DB
  if (!userHistory) {
    userHistory = await RoxyConversationHistory.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          username,
          sessions: sessions,
          userData: {}
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    userHistory.sessions = sessions;
    userHistory.username = username;
    await userHistory.save();
  }
  
  // Obtener historial de la sesión para contexto
  const sessionHistory = currentSession.messages.filter(m => m.role === "user" || m.role === "assistant");
  
  // Construir prompt CON historial
  const systemPrompt = buildSystemPrompt({ ...context, sessionHistory });
  
  // Detectar idioma
  const lang = detectLanguage(userMessage);
  console.log(`[Roxy AI] Idioma detectado: ${lang}`);
  
  // Añadir tag de idioma al mensaje
  let messageWithLang = userMessage;
  if (lang === 'spanish') {
    messageWithLang = `[RESPONDE EN ESPAÑOL] ${userMessage}`;
  } else if (lang === 'english') {
    messageWithLang = `[REPLY IN ENGLISH] ${userMessage}`;
  }

  try {
    console.log("[Roxy AI] Llamando a API...");
    console.log(`[Roxy AI] API_KEY presente: ${!!API_KEY}`);
    console.log(`[Roxy AI] Historial: ${sessionHistory.length} mensajes en sesión`);
    
    if (!API_KEY) {
      console.error("[Roxy AI] ERROR: No hay API_KEY configurada");
      return { ok: false, content: null, error: "No API key" };
    }

    const response = await fetch(`${API_BASE_URL}/chat/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: messageWithLang,
        async: false,
        systemPrompt: systemPrompt,
        temperature: 1.2,
        maxTokens: 1500
      })
    });

    console.log(`[Roxy AI] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Roxy AI] Error HTTP ${response.status}:`, errorText);
      return { ok: false, content: null, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log(`[Roxy AI] Response success: ${data.success}`);
    
    if (!data.success) {
      console.error("[Roxy AI] API error:", data.error);
      return { ok: false, content: null, error: data.error };
    }

    const content = data.response || data.message || "";
    if (!content) {
      console.error("[Roxy AI] Empty response");
      return { ok: false, content: null, error: "Empty response" };
    }
    
    // ========== GUARDAR RESPUESTA DE LA IA EN HISTORIAL ==========
    currentSession.messages.push({
      role: "assistant",
      content: content,
      timestamp: Date.now(),
    });
    currentSession.lastMessageTime = Date.now();
    userHistory.sessions = sessions;
    await userHistory.save();
    console.log(`[Roxy AI] ✅ OK - Respuesta guardada (${currentSession.messages.length} msgs en sesión)`);
    
    return { ok: true, content };

  } catch (error) {
    console.error("[Roxy AI] Exception:", error.message);
    return { ok: false, content: null, error: error.message };
  }
}

// Función para limpiar sesiones expiradas (se puede llamar periódicamente)
async function cleanOldSessions() {
  try {
    const now = Date.now();
    const histories = await RoxyConversationHistory.find({});
    let cleanedUsers = 0;
    let deletedSessions = 0;
    
    for (const history of histories) {
      const originalCount = history.sessions.length;
      
      history.sessions = history.sessions.filter(session => {
        const timeSince = now - new Date(session.lastMessageTime).getTime();
        return timeSince < SESSION_TIMEOUT_MS;
      });
      
      if (history.sessions.length !== originalCount) {
        deletedSessions += (originalCount - history.sessions.length);
        if (history.sessions.length === 0) {
          await RoxyConversationHistory.deleteOne({ userId: history.userId });
          cleanedUsers++;
        } else {
          await history.save();
        }
      }
    }
    
    if (deletedSessions > 0) {
      console.log(`[Roxy AI] Limpieza: ${deletedSessions} sesiones eliminadas, ${cleanedUsers} usuarios limpiados`);
    }
  } catch (error) {
    console.error("[Roxy AI] Error en limpieza:", error);
  }
}

// Limpiar cada 2 minutos
setInterval(cleanOldSessions, 2 * 60 * 1000);

module.exports = {
  callRoxyAI,
  buildSystemPrompt,
  cleanOldSessions
};
