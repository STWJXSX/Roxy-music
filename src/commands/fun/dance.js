const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

// Dance move suggestions based on genre keywords
const DANCE_MOVES = {
    default: [
        { move: "The Robot 🤖", description: "Move your arms in stiff, mechanical motions. Pretend you have no joints!" },
        { move: "The Sprinkler 💦", description: "Put one arm behind your head and move the other in an arc like a sprinkler!" },
        { move: "The Shopping Cart 🛒", description: "Push an imaginary shopping cart while bobbing your head!" },
        { move: "The Floss 🦷", description: "Swing your arms side to side while moving your hips!" },
        { move: "The Dad Dance 👨", description: "Snap your fingers and point randomly while barely moving your feet!" },
        { move: "The Penguin 🐧", description: "Keep your arms at your sides and waddle!" },
        { move: "The Invisible DJ 🎧", description: "Pretend to scratch records in the air!" },
        { move: "The Macarena 💃", description: "You know the moves. Don't pretend you don't." },
        { move: "The Shoulder Shimmy ✨", description: "Just move your shoulders up and down. That's it. That's the move." },
        { move: "The Air Guitar 🎸", description: "Shred an imaginary guitar solo like you're at Wembley!" },
        { move: "The Running Man 🏃", description: "Run in place but make it groovy!" },
        { move: "The Worm 🐛", description: "WARNING: May require medical attention afterwards. Proceed with caution." },
        { move: "The Noodle Arms 🍝", description: "Let your arms go completely limp and just... wiggle!" },
        { move: "The Two-Step 👟", description: "Step left, step right. You're basically a professional now!" },
        { move: "The Moonwalk 🌙", description: "Slide backwards while looking forward. Channel your inner MJ!" },
    ],
    rock: [
        { move: "The Headbang 🤘", description: "Whip your hair back and forth! Safety not guaranteed." },
        { move: "The Air Guitar Solo 🎸", description: "Close your eyes, feel the music, shred that invisible axe!" },
        { move: "The Mosh Pit Shuffle 💪", description: "Bump into imaginary people aggressively but friendly!" },
    ],
    electronic: [
        { move: "The Rave Shuffle 🕺", description: "Fast feet movements! Like you're running but cooler!" },
        { move: "The Glow Stick Wave 🌈", description: "Wave your arms like you have glow sticks (real ones optional)!" },
        { move: "The Bass Face 😫", description: "Wait for the drop... NOW MAKE THE FACE!" },
    ],
    hiphop: [
        { move: "The Stanky Leg 🦵", description: "Make one leg go wobbly! It's supposed to look like that, trust me." },
        { move: "The Dougie 😎", description: "Lean back and brush your hair back. You're now certified cool." },
        { move: "The Dab 💫", description: "It's 2016 somewhere in the multiverse!" },
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dance')
        .setDescription('Get a random dance move suggestion for the current song!'),
    
    aliases: ['moves', 'howtodance', 'dancemove'],
    
    async execute(interaction, client) {
        const queue = client.musicPlayer?.getQueue(interaction.guildId);
        
        let moves = DANCE_MOVES.default;
        let genre = 'any music';
        
        // Check if there's a song playing and try to match genre
        if (queue?.currentTrack) {
            const title = queue.currentTrack.title.toLowerCase();
            
            if (title.includes('rock') || title.includes('metal') || title.includes('punk')) {
                moves = [...DANCE_MOVES.default, ...DANCE_MOVES.rock];
                genre = 'rock';
            } else if (title.includes('edm') || title.includes('house') || title.includes('techno') || title.includes('dubstep')) {
                moves = [...DANCE_MOVES.default, ...DANCE_MOVES.electronic];
                genre = 'electronic';
            } else if (title.includes('hip') || title.includes('hop') || title.includes('rap') || title.includes('trap')) {
                moves = [...DANCE_MOVES.default, ...DANCE_MOVES.hiphop];
                genre = 'hip-hop';
            }
        }
        
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#FF1493')
            .setTitle(`💃 Dance Move Suggestion`)
            .setDescription(`**${randomMove.move}**\n\n${randomMove.description}`)
            .setFooter({ text: `Perfect for ${genre}! • Roxy Music Bot` })
            .setTimestamp();
        
        if (queue?.currentTrack) {
            embed.addFields({
                name: '🎵 Currently Playing',
                value: queue.currentTrack.title.substring(0, 100),
                inline: false
            });
        }
        
        return interaction.reply({ embeds: [embed] });
    },
};
