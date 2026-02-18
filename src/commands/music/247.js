const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggle 24/7 mode - bot stays in voice channel'),
    
    aliases: ['stay', 'stayconnected'],
    
    /**
     * Execute the 24/7 command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const validation = validateVoiceConnection(interaction);
        if (!validation.valid) {
            const embed = EmbedFactory.error('Voice Error', validation.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const guildId = interaction.guildId;
        const queue = client.musicPlayer.getQueue(guildId);

        if (!queue) {
            const embed = EmbedFactory.error('No Queue', 'There is no active queue. Use `/play` first to start playing music.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Toggle 24/7 mode
        queue.is247 = !queue.is247;

        if (queue.is247) {
            const embed = EmbedFactory.success(
                '🌙 24/7 Mode Enabled',
                'I will stay in the voice channel even when the queue is empty.\n\n' +
                '**Note:** Use `/stop` or `/leave` to force me to leave.'
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.info(
                '☀️ 24/7 Mode Disabled',
                'I will leave the voice channel when the queue is empty.'
            );
            return interaction.reply({ embeds: [embed] });
        }
    },
};
