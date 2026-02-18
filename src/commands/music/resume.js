const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused song'),
    
    aliases: ['unpause', 'continue'],
    
    /**
     * Execute the resume command
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

        if (queue.isPlaying()) {
            const embed = EmbedFactory.warning('Already Playing', 'The music is already playing!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const success = client.musicPlayer.resume(interaction.guildId);

        if (success) {
            const embed = EmbedFactory.success(
                'Resumed',
                `Resumed **${queue.currentTrack.title}**`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to resume the music.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
