/**
 * MODELO DE PREMIUM V2 - Sistema Centralizado
 * Para Roxy Music Bot
 */

const { Schema, model } = require("mongoose");

const premiumSchema = new Schema({
  discordId: { type: String, required: true, index: true },
  entityType: { 
    type: String, 
    required: true, 
    enum: ["usuario", "servidor"],
    index: true
  },
  premiumType: { 
    type: String, 
    required: true, 
    enum: [
      "universal",
      "bot_catbot",
      "bot_catbotfn",
      "bot_roxy",
      "web",
      "pack_completo",
      "youtube",
      "servidor"
    ],
    index: true
  },
  applicableBots: [{
    type: String,
    enum: ["973657100871950376", "1305273926229950465", "1308187740092764200", "all"]
  }],
  durationType: {
    type: String,
    required: true,
    enum: ["mensual", "anual", "personalizado", "permanente", "youtube"],
    default: "mensual"
  },
  customDays: { type: Number, default: null },
  activatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null, index: true },
  key: { type: String, required: true },
  createdBy: { type: String, required: true },
  activatedBy: { type: String, required: true },
  reason: { type: String, default: "Sin motivo especificado" },
  youtubeData: {
    videoUrl: { type: String, default: null },
    videoId: { type: String, default: null },
    channelId: { type: String, default: null },
    lastChecked: { type: Date, default: null },
    isVideoActive: { type: Boolean, default: true },
    checkFailCount: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true, index: true },
  renewalHistory: [{
    renewedAt: { type: Date },
    previousExpiresAt: { type: Date },
    newExpiresAt: { type: Date },
    renewedBy: { type: String },
    method: { type: String }
  }],
  metadata: {
    source: { type: String, default: "key" },
    originalPremiumId: { type: String, default: null },
    notes: { type: String, default: null }
  }
}, {
  timestamps: true
});

premiumSchema.index({ discordId: 1, entityType: 1, premiumType: 1 });
premiumSchema.index({ expiresAt: 1, isActive: 1 });

// Verificar si un usuario tiene premium activo para un bot específico
premiumSchema.statics.hasActivePremium = async function(userId, botId = null) {
  const now = new Date();
  
  const query = {
    discordId: userId,
    entityType: "usuario",
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: now } }
    ]
  };
  
  const premiums = await this.find(query);
  
  if (!premiums.length) return { hasPremium: false, premiums: [] };
  
  if (!botId) {
    return { hasPremium: true, premiums };
  }
  
  // Filtrar por bot aplicable
  const applicablePremiums = premiums.filter(p => {
    // Universal y pack completo aplican a todos
    if (["universal", "pack_completo"].includes(p.premiumType)) return true;
    // Si tiene bots específicos configurados
    if (p.applicableBots && (p.applicableBots.includes(botId) || p.applicableBots.includes("all"))) return true;
    // Tipos específicos de bot
    if (p.premiumType === "bot_catbot" && botId === "973657100871950376") return true;
    if (p.premiumType === "bot_catbotfn" && botId === "1305273926229950465") return true;
    if (p.premiumType === "bot_roxy" && botId === "1308187740092764200") return true;
    if (p.premiumType === "bot_roxy") return true; // Roxy acepta su propio tipo
    return false;
  });
  
  return { hasPremium: applicablePremiums.length > 0, premiums: applicablePremiums };
};

// Verificar premium de servidor
premiumSchema.statics.hasActiveServerPremium = async function(serverId) {
  const now = new Date();
  
  const premium = await this.findOne({
    discordId: serverId,
    entityType: "servidor",
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: now } }
    ]
  });
  
  return { hasPremium: !!premium, premium };
};

module.exports = model("PremiumV2", premiumSchema);
