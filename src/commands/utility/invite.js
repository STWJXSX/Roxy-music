const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get the bot invite link'),
    
    aliases: ['inv', 'botinvite'],
    
    /**
     * Execute the invite command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=4821191021153344&scope=bot%20applications.commands`;
        
        const embed = new EmbedBuilder()
            .setColor('#FF6B9D')
            .setTitle('🎵 Invite Roxy to your server!')
            .setDescription([
                'Click the button below to add Roxy to your server.',
                '',
                '**Features:**',
                '• 🎶 High quality music playback',
                '• 📺 YouTube support',
                '• 🎧 Spotify support',
                '• 📋 Queue management',
                '• 🔊 Volume control',
                '• 🔁 Loop modes',
                '• ⏭️ Skip, pause, resume controls',
                '• And much more!'
            ].join('\n'))
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: 'Thank you for using Roxy!' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Roxy')
                    .setStyle(ButtonStyle.Link)
                    .setURL(inviteUrl)
                    .setEmoji('🎵'),
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/SrSMRxfUEj')
                    .setEmoji('💬')
            );
        
        return interaction.reply({ embeds: [embed], components: [row] });
    }
};
