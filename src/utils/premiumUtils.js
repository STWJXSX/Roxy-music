/**
 * UTILIDADES DE PREMIUM V2
 * Sistema de verificación de premium para Roxy Music Bot
 * 
 * TIPOS DE PREMIUM:
 * - universal: Acceso a todos los bots
 * - bot_roxy: Solo Roxy
 * - pack_completo: Todo incluido
 * - youtube: Promoción YouTube
 * - servidor: Premium de servidor
 * 
 * DURACIONES:
 * - mensual: 30 días
 * - anual: 365 días
 * - permanente: Sin expiración
 * - youtube: Mientras el video exista
 * - personalizado: Días específicos
 * 
 * PROPIEDADES DE COMANDO:
 * - UserPrem: Cualquier premium de usuario
 * - ServPrem: Premium de servidor
 * - PremYoutube: Premium por YouTube
 * - PremAnual: Premium anual
 * - PremPermanente: Premium permanente
 * - PremUniversal: Premium universal
 * - PremPackCompleto: Pack completo
 */

const PremiumV2 = require('../modelosdb/premium/PremiumV2');

// ID del bot Roxy (se configurará en el index.js)
let ROXY_BOT_ID = null;

/**
 * Configura el ID del bot Roxy
 */
function setBotId(botId) {
  ROXY_BOT_ID = botId;
}

/**
 * Tipos de premium que dan acceso a Roxy
 */
const PREMIUM_ACCESS_TYPES = ["universal", "bot_roxy", "pack_completo", "youtube"];

/**
 * Obtiene todos los premiums activos de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>}
 */
async function getAllUserPremiums(userId) {
  try {
    const result = await PremiumV2.hasActivePremium(userId);
    return result.premiums || [];
  } catch (error) {
    console.error("[PREMIUM] Error getting user premiums:", error);
    return [];
  }
}

/**
 * Verifica si un usuario tiene premium activo
 * @param {string} userId - ID del usuario
 * @returns {Promise<{hasPremium: boolean, premiums: Array, premiumTypes: Array}>}
 */
async function checkUserPremium(userId) {
  try {
    const result = await PremiumV2.hasActivePremium(userId);
    
    if (!result.hasPremium) {
      return { hasPremium: false, premiums: [], premiumTypes: [] };
    }
    
    // Filtrar por tipos que aplican a Roxy
    const validPremiums = result.premiums.filter(p => 
      PREMIUM_ACCESS_TYPES.includes(p.premiumType)
    );
    
    return {
      hasPremium: validPremiums.length > 0,
      premiums: validPremiums,
      premiumTypes: validPremiums.map(p => p.premiumType)
    };
  } catch (error) {
    console.error("[PREMIUM] Error checking user premium:", error);
    return { hasPremium: false, premiums: [], premiumTypes: [] };
  }
}

/**
 * Verifica si un servidor tiene premium activo
 * @param {string} serverId - ID del servidor
 * @returns {Promise<{hasPremium: boolean, premium: Object|null}>}
 */
async function checkServerPremium(serverId) {
  try {
    return await PremiumV2.hasActiveServerPremium(serverId);
  } catch (error) {
    console.error("[PREMIUM] Error checking server premium:", error);
    return { hasPremium: false, premium: null };
  }
}

// ========================================
// VERIFICACIONES POR TIPO DE PREMIUM
// ========================================

/**
 * Verifica si tiene premium por YouTube
 */
async function hasPremiumYoutube(userId) {
  const premiums = await getAllUserPremiums(userId);
  return premiums.some(p => p.premiumType === "youtube" || p.durationType === "youtube");
}

/**
 * Verifica si tiene premium universal
 */
async function hasPremiumUniversal(userId) {
  const premiums = await getAllUserPremiums(userId);
  return premiums.some(p => p.premiumType === "universal");
}

/**
 * Verifica si tiene pack completo
 */
async function hasPremiumPackCompleto(userId) {
  const premiums = await getAllUserPremiums(userId);
  return premiums.some(p => p.premiumType === "pack_completo");
}

// ========================================
// VERIFICACIONES POR DURACIÓN
// ========================================

/**
 * Verifica si tiene premium anual
 */
async function hasPremiumAnual(userId) {
  const premiums = await getAllUserPremiums(userId);
  return premiums.some(p => p.durationType === "anual");
}

/**
 * Verifica si tiene premium permanente
 */
async function hasPremiumPermanente(userId) {
  const premiums = await getAllUserPremiums(userId);
  return premiums.some(p => p.durationType === "permanente");
}

/**
 * Verifica si tiene premium mensual
 */
async function hasPremiumMensual(userId) {
  const premiums = await getAllUserPremiums(userId);
  return premiums.some(p => p.durationType === "mensual");
}

// ========================================
// VERIFICACIÓN DE ACCESO
// ========================================

/**
 * Verifica si un usuario o servidor tiene acceso premium
 * @param {string} userId - ID del usuario
 * @param {string|null} serverId - ID del servidor (opcional)
 * @returns {Promise<{hasPremium: boolean, source: 'user'|'server'|null, premiums: Array}>}
 */
async function checkPremiumAccess(userId, serverId = null) {
  // Primero verificar usuario
  const userResult = await checkUserPremium(userId);
  if (userResult.hasPremium) {
    return { hasPremium: true, source: 'user', premiums: userResult.premiums };
  }
  
  // Luego verificar servidor si está disponible
  if (serverId) {
    const serverResult = await checkServerPremium(serverId);
    if (serverResult.hasPremium) {
      return { hasPremium: true, source: 'server', premiums: [serverResult.premium] };
    }
  }
  
  return { hasPremium: false, source: null, premiums: [] };
}

/**
 * Obtiene información detallada del premium de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>}
 */
async function getPremiumInfo(userId) {
  try {
    const result = await PremiumV2.hasActivePremium(userId);
    const activePremiums = result.premiums || [];
    
    return {
      total: activePremiums.length,
      active: activePremiums,
      hasActive: activePremiums.length > 0,
      activeTypes: activePremiums.map(p => p.premiumType),
      activeDurations: activePremiums.map(p => p.durationType)
    };
  } catch (error) {
    console.error("[PREMIUM] Error getting premium info:", error);
    return { total: 0, active: [], hasActive: false, activeTypes: [], activeDurations: [] };
  }
}

/**
 * Verifica requisitos de premium para un comando
 * 
 * @param {Object} command - Objeto del comando con propiedades de premium
 * @param {string} userId - ID del usuario
 * @param {string|null} serverId - ID del servidor
 * @returns {Promise<{allowed: boolean, reason: string|null, premiumInfo: Object}>}
 */
async function checkCommandPremiumRequirements(command, userId, serverId) {
  const premiumInfo = await getPremiumInfo(userId);
  
  // Si el comando no requiere ningún tipo de premium
  const requiresPremium = command.UserPrem || command.ServPrem || 
    command.PremYoutube || command.PremAnual || command.PremPermanente || 
    command.PremMensual || command.PremUniversal || command.PremPackCompleto;
  
  if (!requiresPremium) {
    return { allowed: true, reason: null, premiumInfo };
  }
  
  // ===== VERIFICACIONES POR TIPO DE ENTIDAD =====
  
  // UserPrem: Cualquier premium de usuario activo
  if (command.UserPrem) {
    const { hasPremium } = await checkUserPremium(userId);
    if (!hasPremium) {
      return { allowed: false, reason: "user_premium_required", premiumInfo };
    }
  }
  
  // ServPrem: Premium de servidor
  if (command.ServPrem) {
    if (!serverId) {
      return { allowed: false, reason: "server_only", premiumInfo };
    }
    const { hasPremium } = await checkServerPremium(serverId);
    if (!hasPremium) {
      return { allowed: false, reason: "server_premium_required", premiumInfo };
    }
  }
  
  // ===== VERIFICACIONES POR TIPO DE PREMIUM =====
  
  // PremYoutube: Premium por YouTube
  if (command.PremYoutube) {
    const has = await hasPremiumYoutube(userId);
    if (!has) {
      return { allowed: false, reason: "youtube_premium_required", premiumInfo };
    }
  }
  
  // PremUniversal: Premium universal
  if (command.PremUniversal) {
    const has = await hasPremiumUniversal(userId);
    if (!has) {
      return { allowed: false, reason: "universal_premium_required", premiumInfo };
    }
  }
  
  // PremPackCompleto: Pack completo
  if (command.PremPackCompleto) {
    const has = await hasPremiumPackCompleto(userId);
    if (!has) {
      return { allowed: false, reason: "pack_completo_required", premiumInfo };
    }
  }
  
  // ===== VERIFICACIONES POR DURACIÓN =====
  
  // PremAnual: Premium anual
  if (command.PremAnual) {
    const has = await hasPremiumAnual(userId);
    if (!has) {
      return { allowed: false, reason: "anual_premium_required", premiumInfo };
    }
  }
  
  // PremPermanente: Premium permanente
  if (command.PremPermanente) {
    const has = await hasPremiumPermanente(userId);
    if (!has) {
      return { allowed: false, reason: "permanente_premium_required", premiumInfo };
    }
  }
  
  // PremMensual: Premium mensual
  if (command.PremMensual) {
    const has = await hasPremiumMensual(userId);
    if (!has) {
      return { allowed: false, reason: "mensual_premium_required", premiumInfo };
    }
  }
  
  return { allowed: true, reason: null, premiumInfo };
}

/**
 * Mensajes de error para premium (multiidioma)
 */
const PREMIUM_ERROR_MESSAGES = {
  es: {
    user_premium_required: "Este comando es exclusivo para usuarios Premium. Usa `/premium redeem` para activar tu clave premium.",
    server_premium_required: "Este comando es exclusivo para servidores Premium. Un administrador debe usar `/premium redeem` para activar una clave premium.",
    server_only: "Este comando solo puede usarse en un servidor.",
    youtube_premium_required: "Este comando requiere premium por promoción de YouTube.",
    universal_premium_required: "Este comando requiere premium Universal.",
    pack_completo_required: "Este comando requiere el Pack Completo.",
    anual_premium_required: "Este comando requiere premium Anual.",
    permanente_premium_required: "Este comando requiere premium Permanente.",
    mensual_premium_required: "Este comando requiere premium Mensual."
  },
  en: {
    user_premium_required: "This command is exclusive to Premium users. Use `/premium redeem` to activate your premium key.",
    server_premium_required: "This command is exclusive to Premium servers. An administrator must use `/premium redeem` to activate a premium key.",
    server_only: "This command can only be used in a server.",
    youtube_premium_required: "This command requires YouTube promotion premium.",
    universal_premium_required: "This command requires Universal premium.",
    pack_completo_required: "This command requires the Complete Pack.",
    anual_premium_required: "This command requires Annual premium.",
    permanente_premium_required: "This command requires Permanent premium.",
    mensual_premium_required: "This command requires Monthly premium."
  }
};

/**
 * Obtiene mensaje de error de premium
 * @param {string} reason - Razón del error
 * @param {string} lang - Idioma (es/en)
 * @returns {string}
 */
function getPremiumErrorMessage(reason, lang = 'en') {
  return PREMIUM_ERROR_MESSAGES[lang]?.[reason] || PREMIUM_ERROR_MESSAGES.en[reason] || "Premium required.";
}

/**
 * Función simple para verificar premium de usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>}
 */
async function hasUserPremium(userId) {
  const result = await checkUserPremium(userId);
  return result.hasPremium;
}

/**
 * Función simple para verificar premium de servidor
 * @param {string} serverId - ID del servidor
 * @returns {Promise<boolean>}
 */
async function hasServerPremium(serverId) {
  const result = await checkServerPremium(serverId);
  return result.hasPremium;
}

module.exports = {
  // Configuración
  setBotId,
  PREMIUM_ACCESS_TYPES,
  PREMIUM_ERROR_MESSAGES,
  
  // Funciones principales
  getAllUserPremiums,
  checkUserPremium,
  checkServerPremium,
  checkPremiumAccess,
  getPremiumInfo,
  checkCommandPremiumRequirements,
  getPremiumErrorMessage,
  
  // Verificaciones por tipo
  hasPremiumYoutube,
  hasPremiumUniversal,
  hasPremiumPackCompleto,
  
  // Verificaciones por duración
  hasPremiumAnual,
  hasPremiumPermanente,
  hasPremiumMensual,
  
  // Funciones simples
  hasUserPremium,
  hasServerPremium
};
