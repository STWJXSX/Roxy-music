const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear the entire queue'),
    
    aliases: ['empty', 'cls'],
    
    /**
     * Execute the clear command
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

        const trackCount = queue.tracks.length;

        if (trackCount === 0) {
            const embed = EmbedFactory.warning('Queue Empty', 'The queue is already empty!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const success = client.musicPlayer.clearQueue(interaction.guildId);

        if (success) {
            const embed = EmbedFactory.success(
                'Queue Cleared',
                `Removed **${trackCount}** tracks from the queue`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to clear the queue.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
