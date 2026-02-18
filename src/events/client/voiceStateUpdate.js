const { EmbedBuilder } = require('discord.js');
const { Logger } = require('../../utils');

// Store for empty channel timeouts (lightweight - just guildId -> timeoutId)
const emptyTimeouts = new Map();

// Timeout duration: 1 minute
const EMPTY_CHANNEL_TIMEOUT = 60000;

module.exports = {
    name: 'voiceStateUpdate',
    once: false,

    /**
     * Handle voice state updates
     * - Leave if channel becomes empty (after 1 minute)
     * - Handle bot mute/unmute
     * @param {VoiceState} oldState 
     * @param {VoiceState} newState 
     * @param {Client} client 
     */
    async execute(oldState, newState, client) {
        const guildId = newState.guild.id;
        const queue = client.musicPlayer?.getQueue(guildId);
        
        // No queue = nothing to do
        if (!queue) return;
        
        const botId = client.user.id;
        const botVoiceChannel = queue.voiceChannel;
        
        // ========================================
        // HANDLE BOT MUTE/UNMUTE
        // ========================================
        if (newState.id === botId) {
            const wasMuted = oldState.serverMute;
            const isMuted = newState.serverMute;
            
            // Bot was muted
            if (!wasMuted && isMuted) {
                Logger.info(`[VOICE] Bot was server muted in ${guildId}`);
                
                // Try to unmute self
                try {
                    const botMember = newState.member;
                    if (botMember && newState.guild.members.me?.permissions.has('MuteMembers')) {
                        await botMember.voice.setMute(false, 'Bot cannot be muted while playing music');
                        Logger.info(`[VOICE] Bot unmuted itself in ${guildId}`);
                    } else {
                        // Cannot unmute - pause and notify
                        if (queue.playing && !queue.paused) {
                            client.musicPlayer.pause(guildId);
                            queue.pausedByMute = true;
                            
                            if (queue.textChannel) {
                                const embed = new EmbedBuilder()
                                    .setColor('#FFA500')
                                    .setTitle('🔇 Bot Muted')
                                    .setDescription([
                                        '**I was muted and cannot unmute myself.**',
                                        '',
                                        'Music has been paused. Please unmute me to resume playback.',
                                        '',
                                        '> *Give me `Mute Members` permission to auto-unmute.*'
                                    ].join('\n'))
                                    .setTimestamp();
                                
                                queue.textChannel.send({ embeds: [embed] }).catch(() => {});
                            }
                        }
                    }
                } catch (e) {
                    Logger.warn(`[VOICE] Failed to handle mute: ${e.message}`);
                }
            }
            
            // Bot was unmuted
            if (wasMuted && !isMuted && queue.pausedByMute) {
                Logger.info(`[VOICE] Bot was unmuted in ${guildId}, resuming...`);
                queue.pausedByMute = false;
                client.musicPlayer.resume(guildId);
            }
            
            return;
        }
        
        // ========================================
        // HANDLE EMPTY CHANNEL DETECTION
        // ========================================
        
        // Skip if 24/7 mode is enabled
        if (queue.is247) return;
        
        // Get current members in bot's voice channel (excluding bots)
        const voiceChannel = newState.guild.channels.cache.get(botVoiceChannel.id);
        if (!voiceChannel) return;
        
        const humanMembers = voiceChannel.members.filter(m => !m.user.bot).size;
        
        // Someone left the channel and now it's empty (only bot)
        if (humanMembers === 0) {
            // Don't set another timeout if one exists
            if (emptyTimeouts.has(guildId)) return;
            
            Logger.info(`[VOICE] Channel empty in ${guildId}, starting 60s timeout...`);
            
            const timeoutId = setTimeout(() => {
                emptyTimeouts.delete(guildId);
                
                // Check again if still empty
                const currentQueue = client.musicPlayer?.getQueue(guildId);
                if (!currentQueue) return;
                
                // Skip if 24/7 was enabled during timeout
                if (currentQueue.is247) return;
                
                const channel = newState.guild.channels.cache.get(currentQueue.voiceChannel.id);
                if (!channel) return;
                
                const stillEmpty = channel.members.filter(m => !m.user.bot).size === 0;
                
                if (stillEmpty) {
                    Logger.info(`[VOICE] Channel still empty after 60s, leaving ${guildId}`);
                    client.musicPlayer.sendEmptyChannelGoodbye(currentQueue);
                    client.musicPlayer.deleteQueue(guildId);
                }
            }, EMPTY_CHANNEL_TIMEOUT);
            
            emptyTimeouts.set(guildId, timeoutId);
        } else {
            // Someone joined - cancel timeout if exists
            if (emptyTimeouts.has(guildId)) {
                Logger.info(`[VOICE] User joined channel in ${guildId}, cancelling leave timeout`);
                clearTimeout(emptyTimeouts.get(guildId));
                emptyTimeouts.delete(guildId);
            }
        }
    },
};
