const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the queue'),
    
    aliases: ['mix', 'random'],
    
    /**
     * Execute the shuffle command
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

        if (queue.tracks.length < 2) {
            const embed = EmbedFactory.warning(
                'Not Enough Tracks',
                'Need at least 2 tracks in the queue to shuffle!'
            );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const success = client.musicPlayer.shuffle(interaction.guildId);

        if (success) {
            const embed = EmbedFactory.success(
                'Queue Shuffled',
                `Shuffled **${queue.tracks.length}** tracks in the queue!`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to shuffle the queue.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
