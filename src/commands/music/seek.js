const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection, parseDuration } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seek to a specific position in the current song')
        .addStringOption(option =>
            option
                .setName('time')
                .setDescription('Time to seek to (e.g., 1:30, 0:45, 2:15:30)')
                .setRequired(true)
        ),
    
    aliases: ['goto-time'],
    
    /**
     * Execute the seek command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const validation = validateVoiceConnection(interaction);
        if (!validation.valid) {
            const embed = EmbedFactory.error('Voice Error', validation.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const queue = client.musicPlayer.getQueue(interaction.guildId);
        
        if (!queue || !queue.currentTrack) {
            const embed = EmbedFactory.error('No Music', 'There is nothing playing right now!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const timeInput = interaction.options.getString('time');
        
        // Parse time input (supports formats like 1:30, 0:45, 2:15:30)
        const parts = timeInput.split(':').map(Number);
        
        if (parts.some(isNaN)) {
            const embed = EmbedFactory.error(
                'Invalid Time Format',
                'Please use a valid time format: `1:30`, `0:45`, or `2:15:30`'
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        let milliseconds = 0;
        if (parts.length === 3) {
            milliseconds = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        } else if (parts.length === 2) {
            milliseconds = (parts[0] * 60 + parts[1]) * 1000;
        } else {
            milliseconds = parts[0] * 1000;
        }

        const track = queue.currentTrack;
        
        if (milliseconds > track.durationMS) {
            const embed = EmbedFactory.error(
                'Invalid Position',
                `The track is only **${track.duration}** long!`
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const success = client.musicPlayer.seek(interaction.guildId, milliseconds);

        if (success) {
            const embed = EmbedFactory.success(
                'Seeked',
                `Seeked to **${timeInput}** in **${track.title}**`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to seek in the track.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
