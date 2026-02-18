const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the playback volume')
        .addIntegerOption(option =>
            option
                .setName('level')
                .setDescription('Volume level (0-100)')
                .setMinValue(0)
                .setMaxValue(100)
                .setRequired(true)
        ),
    
    aliases: ['vol', 'v'],
    
    /**
     * Execute the volume command
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

        const volume = interaction.options.getInteger('level');
        const oldVolume = Math.round(queue.volume * 100);
        
        const success = client.musicPlayer.setVolume(interaction.guildId, volume);

        if (success) {
            const embed = EmbedFactory.success(
                'Volume Changed',
                `Volume changed from **${oldVolume}%** to **${volume}%**`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to change the volume.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
