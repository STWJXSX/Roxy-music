/**
 * MODELO DE CLAVES PREMIUM V2
 * Para Roxy Music Bot
 */

const { Schema, model } = require("mongoose");

const premiumKeySchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
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
      "servidor"
    ]
  },
  entityType: { 
    type: String, 
    required: true, 
    enum: ["usuario", "servidor"],
    default: "usuario"
  },
  durationType: {
    type: String,
    required: true,
    enum: ["mensual", "anual", "personalizado", "permanente"],
    default: "mensual"
  },
  customDays: { type: Number, default: null },
  targetId: { type: String, required: true, default: "everyone" },
  createdBy: { type: String, required: true },
  reason: { type: String, default: "Sin motivo especificado" },
  uses: { type: Number, default: 1 },
  maxUses: { type: Number, default: 1 },
  isRedeemed: { type: Boolean, default: false },
  redeemedBy: { type: String, default: null },
  redeemedAt: { type: Date, default: null },
  keyExpiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Validar si la clave es válida
premiumKeySchema.methods.isValid = function(userId = null) {
  if (this.uses <= 0 || this.isRedeemed) return { valid: false, reason: "used" };
  if (this.keyExpiresAt && new Date() > this.keyExpiresAt) {
    return { valid: false, reason: "expired" };
  }
  if (this.targetId !== "everyone" && userId && this.targetId !== userId) {
    return { valid: false, reason: "wrong_user" };
  }
  return { valid: true, reason: null };
};

// Calcular fecha de expiración
premiumKeySchema.methods.calculateExpirationDate = function(fromDate = new Date()) {
  switch (this.durationType) {
    case "mensual":
      return new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "anual":
      return new Date(fromDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    case "personalizado":
      if (this.customDays) {
        return new Date(fromDate.getTime() + this.customDays * 24 * 60 * 60 * 1000);
      }
      return new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "permanente":
      return null;
    default:
      return new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
};

module.exports = model("PremiumKeyV2", premiumKeySchema);
