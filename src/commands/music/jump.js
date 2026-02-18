const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jump')
        .setDescription('Jump to a specific song in the queue')
        .addIntegerOption(option =>
            option
                .setName('position')
                .setDescription('Position of the song to jump to (1, 2, 3...)')
                .setMinValue(1)
                .setRequired(true)
        ),
    
    aliases: ['goto', 'skipto'],
    
    /**
     * Execute the jump command
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

        const targetTrack = tracks[position - 1];
        const success = client.musicPlayer.jump(interaction.guildId, position - 1);

        if (success) {
            const embed = EmbedFactory.success(
                'Jumped to Track',
                `Jumped to **${targetTrack.title}**`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to jump to the track.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
