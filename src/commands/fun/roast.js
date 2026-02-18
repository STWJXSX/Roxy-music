const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

// Roast messages for different situations
const ROASTS = {
    noMusic: [
        "The queue is emptier than your music taste... oh wait, you don't have one! 🔥",
        "No music playing? Even elevator music would be an improvement! 🛗",
        "The silence is deafening... just like your playlist creativity! 🤫",
        "Queue's empty! Did your good songs get copyrighted? 😏",
        "Nothing playing? Your speaker must be relieved! 🔇",
    ],
    hasMusic: [
        "Oh, you're playing '{song}'? Bold choice for someone with ears! 👂",
        "'{song}'? I've heard better music from a dial-up modem! 📠",
        "Ah yes, '{song}'... the song that makes Nickelback sound good! 🎸",
        "'{song}'? Your neighbors are definitely moving out! 🏃",
        "Playing '{song}'? Even Shazam would refuse to identify this! 📱",
        "'{song}'... at least it's not country. Oh wait, anything would be better! 🤠",
        "'{song}'? My grandma has better music taste, and she's deaf! 👵",
        "Interesting choice with '{song}'... and by interesting I mean questionable! 🤔",
    ],
    compliments: [
        "Just kidding! Your music taste is actually... tolerable! 😄",
        "But hey, at least you're not playing Baby Shark! 🦈",
        "I'm just jealous I can't listen to music like you do! 🥺",
        "Actually, this slaps. Don't tell anyone I said that! 🤫",
        "Okay fine, this is actually a banger! 🔥",
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Get roasted based on your music taste!')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to roast (leave empty to roast yourself)')
                .setRequired(false)
        ),
    
    aliases: ['burn', 'insult', 'judge'],
    
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const queue = client.musicPlayer?.getQueue(interaction.guildId);
        
        let roast;
        let title;
        
        if (queue?.currentTrack) {
            const randomRoast = ROASTS.hasMusic[Math.floor(Math.random() * ROASTS.hasMusic.length)];
            roast = randomRoast.replace('{song}', queue.currentTrack.title);
            title = `🔥 Roasting ${targetUser.username}'s Music Taste`;
        } else {
            roast = ROASTS.noMusic[Math.floor(Math.random() * ROASTS.noMusic.length)];
            title = `🔥 Roasting ${targetUser.username}`;
        }
        
        // 30% chance to add a compliment at the end
        if (Math.random() < 0.3) {
            const compliment = ROASTS.compliments[Math.floor(Math.random() * ROASTS.compliments.length)];
            roast += `\n\n${compliment}`;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle(title)
            .setDescription(roast)
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .setFooter({ text: '🎵 All in good fun! • Roxy Music Bot' })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    },
};
