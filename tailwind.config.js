module.exports = {
  content: ['./build/game.html'],
  theme: {
    extend: {
      colors: {
        // Muted slate base with soft, bold accents
        bgDark: '#1c232a',
        cardDark: '#26303a',
        cardHover: '#303c47',
        spotifyGreen: '#7cc4a4', // main accent (mint); real Spotify green is used as a literal inside the Spotify app
        youtubeRed: '#ee6b5e',
        instaPink: '#e88aa8',
        tinderFlame: '#f07a8e',
        goldAccent: '#f0bf55',
        accentOrange: '#ee8b7e',
        mint: '#7cc4a4',
        coral: '#ee8b7e',
        mustard: '#f0bf55',
        peri: '#8fa7e0',
        lav: '#b4a0d8',
        light: '#e7e9eb',
        num: '#4c5a66',
        gray: {
          100: '#f5f3ee', 200: '#e7e9eb', 300: '#c9d0d6', 400: '#8d9aa5', 500: '#6b7884',
          600: '#4c5a66', 700: '#3d4a56', 800: '#303c47', 900: '#212930', 950: '#181e24',
        },
      },
      fontFamily: {
        sans: ['Rubik', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Hebrew', 'sans-serif'],
      },
    },
  },
};
