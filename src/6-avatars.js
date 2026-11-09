  <!-- ================= TINDER PORTRAITS =================
       If image files are listed in TINDER_PHOTOS (put them in img/tinder/ next to index.html),
       profiles use them. Otherwise each profile gets a generated illustrated portrait.
  -->
  <script>
    // Example: const TINDER_PHOTOS = ['img/tinder/01.jpg', 'img/tinder/02.jpg'];
    const TINDER_PHOTOS = [];

    const AV_SKIN = ['#f6d3b3', '#eec19b', '#e0ac82', '#c98e62', '#a8714a', '#7d5235'];
    const AV_HAIR = ['#1b1210', '#2e1d14', '#4a2c1a', '#6b3f22', '#a0652e', '#c99a56', '#e2c27d', '#7a1f2b', '#2b2b38'];
    const AV_TOP = ['#e11d48', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#f8fafc', '#111827', '#db2777', '#14b8a6', '#6366f1'];
    const AV_BG = [['#ff9a9e', '#fad0c4'], ['#a18cd1', '#fbc2eb'], ['#84fab0', '#8fd3f4'], ['#fccb90', '#d57eeb'], ['#e0c3fc', '#8ec5fc'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867'], ['#ffecd2', '#fcb69f']];
    const AV_STYLES = ['long', 'curly', 'bun', 'bob', 'ponytail', 'waves'];
    const AV_LIPS = ['#c2185b', '#d0566b', '#b4474f', '#e57373', '#9c2a3a'];

    function genAvatar() {
      return {
        skin: rnd(0, AV_SKIN.length - 1), hair: rnd(0, AV_HAIR.length - 1), top: rnd(0, AV_TOP.length - 1),
        bg: rnd(0, AV_BG.length - 1), style: pick(AV_STYLES), lips: rnd(0, AV_LIPS.length - 1),
        earrings: Math.random() < 0.5, glasses: Math.random() < 0.15, eyes: rnd(0, 2), id: rnd(0, 1e9),
      };
    }

    function avatarSVG(a) {
      const skin = AV_SKIN[a.skin], hair = AV_HAIR[a.hair], top = AV_TOP[a.top], [b1, b2] = AV_BG[a.bg], lips = AV_LIPS[a.lips];
      const g = 'g' + a.id;
      let back = '', front = '';
      switch (a.style) {
        case 'long':
          back = `<path d="M50 105 Q48 45 100 40 Q152 45 150 105 L158 215 Q100 232 42 215 Z" fill="${hair}"/>`;
          front = `<path d="M57 100 Q60 52 100 50 Q142 52 143 100 Q128 70 100 68 Q78 70 57 100 Z" fill="${hair}"/>`;
          break;
        case 'waves':
          back = `<path d="M48 105 Q44 42 100 38 Q156 42 152 105 Q165 140 150 165 Q166 190 148 215 Q100 230 52 215 Q34 190 50 165 Q35 140 48 105 Z" fill="${hair}"/>`;
          front = `<path d="M57 104 Q58 50 100 49 Q140 50 144 98 Q120 62 92 72 Q74 80 57 104 Z" fill="${hair}"/>`;
          break;
        case 'curly': {
          const curls = [];
          for (let i = 0; i < 22; i++) {
            const ang = Math.PI * (0.95 + i / 21 * 1.1);
            curls.push(`<circle cx="${(100 + Math.cos(ang) * 58).toFixed(1)}" cy="${(105 + Math.sin(ang) * 62).toFixed(1)}" r="${16 + (i % 3) * 3}" fill="${hair}"/>`);
          }
          for (let i = 0; i < 8; i++) curls.push(`<circle cx="${44 + (i % 2) * 112 + (i % 4 < 2 ? 0 : (i % 2 ? -6 : 6))}" cy="${130 + Math.floor(i / 2) * 18}" r="15" fill="${hair}"/>`);
          back = curls.join('');
          front = `<path d="M58 98 Q62 54 100 52 Q138 54 142 98 Q126 74 100 72 Q76 74 58 98 Z" fill="${hair}"/>`;
          break;
        }
        case 'bun':
          back = `<circle cx="100" cy="38" r="24" fill="${hair}"/>`;
          front = `<path d="M56 104 Q54 52 100 50 Q146 52 144 104 Q132 66 100 64 Q68 66 56 104 Z" fill="${hair}"/>`;
          break;
        case 'bob':
          back = `<path d="M50 105 Q48 45 100 40 Q152 45 150 105 L152 160 Q138 168 128 158 L72 158 Q62 168 48 160 Z" fill="${hair}"/>`;
          front = `<path d="M56 112 Q56 52 100 50 Q144 52 144 112 Q140 74 118 70 L84 70 Q60 74 56 112 Z" fill="${hair}"/>`;
          break;
        case 'ponytail':
          back = `<path d="M136 70 Q178 90 160 170 Q154 196 140 205 Q150 160 140 110 Z" fill="${hair}"/>`;
          front = `<path d="M56 104 Q54 50 100 48 Q146 50 144 104 Q130 64 100 62 Q70 64 56 104 Z" fill="${hair}"/>`;
          break;
      }
      const eyeY = 108, ex = [82, 118];
      const eye = (x) => a.eyes === 0
        ? `<ellipse cx="${x}" cy="${eyeY}" rx="6" ry="4.5" fill="#fff"/><circle cx="${x}" cy="${eyeY}" r="3.4" fill="#2b1a10"/><path d="M${x - 7} ${eyeY - 3} Q${x} ${eyeY - 8} ${x + 7} ${eyeY - 3}" stroke="#1b1210" stroke-width="2" fill="none"/>`
        : a.eyes === 1
          ? `<path d="M${x - 7} ${eyeY} Q${x} ${eyeY - 6} ${x + 7} ${eyeY}" stroke="#1b1210" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
          : `<ellipse cx="${x}" cy="${eyeY}" rx="5.5" ry="5" fill="#fff"/><circle cx="${x}" cy="${eyeY + 0.5}" r="3.6" fill="#3b2414"/><circle cx="${x + 1.2}" cy="${eyeY - 0.8}" r="1.1" fill="#fff"/><path d="M${x - 7} ${eyeY - 4} L${x - 9} ${eyeY - 7} M${x + 7} ${eyeY - 4} L${x + 9} ${eyeY - 7}" stroke="#1b1210" stroke-width="1.6"/>`;
      return `<svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" class="w-full h-full" style="direction:ltr">
        <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient></defs>
        <rect width="200" height="250" fill="url(#${g})"/>
        ${back}
        <path d="M30 250 Q32 195 100 190 Q168 195 170 250 Z" fill="${top}"/>
        <path d="M78 196 Q100 214 122 196" stroke="${skin}" stroke-width="10" fill="none"/>
        <rect x="88" y="150" width="24" height="44" rx="10" fill="${skin}"/>
        <ellipse cx="100" cy="108" rx="42" ry="50" fill="${skin}"/>
        <ellipse cx="58" cy="112" rx="6" ry="9" fill="${skin}"/><ellipse cx="142" cy="112" rx="6" ry="9" fill="${skin}"/>
        ${a.earrings ? `<circle cx="58" cy="124" r="3.5" fill="#f5c542"/><circle cx="142" cy="124" r="3.5" fill="#f5c542"/>` : ''}
        ${front}
        <path d="M74 97 Q82 92 90 96 M110 96 Q118 92 126 97" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${eye(ex[0])}${eye(ex[1])}
        ${a.glasses ? `<g stroke="#222" stroke-width="2.4" fill="none"><circle cx="82" cy="108" r="11"/><circle cx="118" cy="108" r="11"/><path d="M93 108 L107 108"/></g>` : ''}
        <path d="M100 112 Q97 124 101 127" stroke="#00000033" stroke-width="2" fill="none" stroke-linecap="round"/>
        <ellipse cx="78" cy="126" rx="7" ry="4" fill="#ff7a8a" opacity="0.25"/><ellipse cx="122" cy="126" rx="7" ry="4" fill="#ff7a8a" opacity="0.25"/>
        <path d="M89 138 Q100 147 111 138 Q100 142 89 138 Z" fill="${lips}"/>
      </svg>`;
    }

    // Picture for a Tinder profile: a photo if available, otherwise the illustrated portrait
    function profilePicture(p) {
      if (TINDER_PHOTOS.length && p.photo !== undefined && p.photo !== null) {
        return `<img src="${TINDER_PHOTOS[p.photo % TINDER_PHOTOS.length]}" alt="" class="w-full h-full object-cover">`;
      }
      if (!p.avatar) p.avatar = genAvatar();
      return avatarSVG(p.avatar);
    }
  </script>
