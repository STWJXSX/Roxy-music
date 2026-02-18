const { SlashCommandBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');
const { QueueRepeatMode } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set the loop mode')
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('Loop mode')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'off' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' },
                    { name: 'Autoplay', value: 'autoplay' }
                )
        ),
    
    aliases: ['repeat', 'lp'],
    
    /**
     * Execute the loop command
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

        const mode = interaction.options.getString('mode');
        
        const modeMap = {
            'off': QueueRepeatMode.OFF,
            'track': QueueRepeatMode.TRACK,
            'queue': QueueRepeatMode.QUEUE,
            'autoplay': QueueRepeatMode.AUTOPLAY,
        };

        const modeNames = {
            'off': 'Off',
            'track': 'Track Loop',
            'queue': 'Queue Loop',
            'autoplay': 'Autoplay',
        };

        const success = client.musicPlayer.setLoop(interaction.guildId, modeMap[mode]);

        if (success) {
            const embed = EmbedFactory.success(
                'Loop Mode Changed',
                `Loop mode set to **${modeNames[mode]}**`
            );
            return interaction.reply({ embeds: [embed] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to change the loop mode.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
