const { Schema, model } = require('mongoose');

const messageSchema = new Schema({
  role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const sessionSchema = new Schema({
  startTime: { type: Date, default: Date.now },
  lastMessageTime: { type: Date, default: Date.now },
  messages: [messageSchema]
}, { _id: false });

const roxyConversationHistorySchema = new Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  sessions: [sessionSchema],
  userData: { type: Object, default: {} }
});

module.exports = model('RoxyConversationHistory', roxyConversationHistorySchema);
