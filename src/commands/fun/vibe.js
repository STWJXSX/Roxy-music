const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

// Funny music-related responses
const VIBES = [
    { emoji: '🎸', vibe: 'Rock Legend', message: 'You\'re headbanging so hard your neighbors called the police!' },
    { emoji: '🎹', vibe: 'Piano Prodigy', message: 'Beethoven just rolled over in his grave... out of respect!' },
    { emoji: '🎷', vibe: 'Jazz Cat', message: 'You\'re so smooth, butter is jealous of you!' },
    { emoji: '🎻', vibe: 'Classical Connoisseur', message: 'Your pinky is permanently raised while drinking water!' },
    { emoji: '🎤', vibe: 'Shower Singer', message: 'The shampoo bottles gave you a standing ovation!' },
    { emoji: '🥁', vibe: 'Drum Machine', message: 'You can\'t stop tapping on everything. EVERYTHING.' },
    { emoji: '🎺', vibe: 'Brass Boss', message: 'You wake up your neighbors with a fanfare every morning!' },
    { emoji: '🪗', vibe: 'Accordion Addict', message: 'You polka at weddings even when they\'re playing hip-hop!' },
    { emoji: '🎵', vibe: 'Music Maniac', message: 'You have 847 playlists and still can\'t find something to listen to!' },
    { emoji: '🎶', vibe: 'Melody Master', message: 'You hum in your sleep and it\'s always a banger!' },
    { emoji: '🪘', vibe: 'Bongo Enthusiast', message: 'You turned your desk into a drum kit at work!' },
    { emoji: '🎧', vibe: 'Audiophile Supreme', message: 'You can hear the difference between 320kbps and FLAC... probably!' },
    { emoji: '📻', vibe: 'Radio Star', message: 'Video killed you but you came back stronger!' },
    { emoji: '🪕', vibe: 'Banjo Believer', message: 'Yeehaw is your response to everything!' },
    { emoji: '🔊', vibe: 'Bass Dropper', message: 'Your neighbors\' windows vibrate when you\'re home!' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vibe')
        .setDescription('Check your current music vibe!'),
    
    aliases: ['vibes', 'mood', 'energy'],
    
    async execute(interaction, client) {
        const queue = client.musicPlayer?.getQueue(interaction.guildId);
        const randomVibe = VIBES[Math.floor(Math.random() * VIBES.length)];
        
        let description = `**${randomVibe.emoji} Your vibe: ${randomVibe.vibe}**\n\n${randomVibe.message}`;
        
        if (queue?.currentTrack) {
            description += `\n\n🎵 Currently vibing to: **${queue.currentTrack.title}**`;
        } else {
            description += '\n\n*Start playing some music to enhance your vibe!*';
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('✨ Vibe Check ✨')
            .setDescription(description)
            .setFooter({ text: `Vibe check requested by ${interaction.user.username}` })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    },
};
