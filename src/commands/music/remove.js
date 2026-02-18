const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option =>
            option
                .setName('position')
                .setDescription('Position of the song to remove (1, 2, 3...)')
                .setMinValue(1)
                .setRequired(true)
        ),
    
    aliases: ['rm', 'delete'],
    
    /**
     * Execute the remove command
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
        
        if (!queue) {
            const embed = EmbedFactory.error('No Music', 'There is nothing playing right now!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const position = interaction.options.getInteger('position');
        const tracks = client.musicPlayer.getTracks(interaction.guildId);

        if (position > tracks.length) {
            const embed = EmbedFactory.error(
                'Invalid Position',
                `The queue only has **${tracks.length}** tracks!`
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const removedTrack = client.musicPlayer.removeTrack(interaction.guildId, position - 1);

        if (removedTrack) {
            const embed = EmbedFactory.success(
                'Track Removed',
                `Removed **${removedTrack.title}** from the queue`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to remove the track.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
