/**
 * Voice channel related validations and utilities
 */

/**
 * Check if user is in a voice channel
 * @param {Object} member - Guild member
 * @returns {Object} { valid: boolean, channel: VoiceChannel|null }
 */
function getUserVoiceChannel(member) {
    const channel = member.voice?.channel;
    return {
        valid: !!channel,
        channel: channel || null,
    };
}

/**
 * Check if bot is in the same voice channel as user
 * @param {Object} member - Guild member
 * @param {Object} botMember - Bot's guild member
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateSameVoiceChannel(member, botMember) {
    const userChannel = member.voice?.channel;
    const botChannel = botMember.voice?.channel;

    if (!userChannel) {
        return {
            valid: false,
            reason: 'You need to be in a voice channel to use this command!',
        };
    }

    if (botChannel && botChannel.id !== userChannel.id) {
        return {
            valid: false,
            reason: 'You need to be in the same voice channel as me!',
        };
    }

    return { valid: true, reason: null };
}

/**
 * Check if bot can join and speak in a voice channel
 * @param {Object} channel - Voice channel
 * @param {Object} botMember - Bot's guild member
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateBotPermissions(channel, botMember) {
    const permissions = channel.permissionsFor(botMember);

    if (!permissions.has('Connect')) {
        return {
            valid: false,
            reason: 'I don\'t have permission to join that voice channel!',
        };
    }

    if (!permissions.has('Speak')) {
        return {
            valid: false,
            reason: 'I don\'t have permission to speak in that voice channel!',
        };
    }

    return { valid: true, reason: null };
}

/**
 * Full voice validation for music commands
 * @param {Object} interaction - Discord interaction
 * @returns {Object} { valid: boolean, reason: string, channel: VoiceChannel|null }
 */
function validateVoiceConnection(interaction) {
    const member = interaction.member;
    const botMember = interaction.guild.members.me;

    // Check if user is in voice channel
    const userVoice = getUserVoiceChannel(member);
    if (!userVoice.valid) {
        return {
            valid: false,
            reason: 'You need to be in a voice channel to use this command!',
            channel: null,
        };
    }

    // Check bot permissions
    const permCheck = validateBotPermissions(userVoice.channel, botMember);
    if (!permCheck.valid) {
        return {
            valid: false,
            reason: permCheck.reason,
            channel: null,
        };
    }

    // Check if bot is in different channel
    const sameChannel = validateSameVoiceChannel(member, botMember);
    if (!sameChannel.valid && botMember.voice?.channel) {
        return {
            valid: false,
            reason: sameChannel.reason,
            channel: null,
        };
    }

    return {
        valid: true,
        reason: null,
        channel: userVoice.channel,
    };
}

module.exports = {
    getUserVoiceChannel,
    validateSameVoiceChannel,
    validateBotPermissions,
    validateVoiceConnection,
};
