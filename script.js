// Every refresh starts from the beginning: no restored scroll position, no cached "back" page
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('pageshow', function(e) { if (e.persisted) location.reload(); });

document.addEventListener('DOMContentLoaded', function() {

    window.scrollTo(0, 0);

    // --- one shared AudioContext (click sounds, alarm) ---
    let sharedAC = null;
    function getAC() {
        try {
            if (!sharedAC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; sharedAC = new C(); }
            if (sharedAC.state === 'suspended') sharedAC.resume();
            return sharedAC;
        } catch (e) { return null; }
    }

    // --- background song: starts when the real website opens ---
    const song = new Audio('audio/song.mp3');
    song.loop = true; song.preload = 'auto'; song.volume = 0.65;
    let songWanted = true, songHeld = false;
    const fab = document.getElementById('music-fab');
    function paintFab() {
        if (!fab) return;
        const on = !song.paused;
        fab.classList.toggle('off', !on);
        fab.setAttribute('aria-label', on ? 'Matikan musik' : 'Nyalakan musik');
    }
    function playSong() {
        if (!songWanted || songHeld) return;
        const p = song.play();
        if (p && p.catch) p.catch(function() { paintFab(); });
    }
    function holdSong() { songHeld = true; song.pause(); }          // paused while recording, so the song is not recorded
    function releaseSong() { songHeld = false; playSong(); }
    song.addEventListener('play', paintFab);
    song.addEventListener('pause', paintFab);
    if (fab) fab.addEventListener('click', function() {
        if (song.paused) { songWanted = true; songHeld = false; playSong(); } else { songWanted = false; song.pause(); }
    });

    // --- Sakura Petals: stay off during the opening gate, start at "ENJOY!" -> website ---
    // startPetals() opens with a dense, fast storm drifting from the top-left toward the
    // bottom-right, then eases down to the normal amount and speed.
    let startPetals = function() {};
    const canvas = document.getElementById('sakura-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let petals = [];
        const BASE = 50;                 // the normal amount
        const STORM = 230;               // extra petals at the very start
        const STORM_MS = 9000;
        // Phones/PCs with "reduce motion" on still get petals, just slower and gentler
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;
        let t0 = 0, running = false, speedMul = 1, target = 0;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function Petal(mode) { this.init(mode); }
        Petal.prototype.init = function(mode) {
            this.w = 25 + Math.random() * 15;
            this.h = 20 + Math.random() * 10;
            this.opacity = this.w / 40;
            this.flip = Math.random();
            this.xSpeed = (1.5 + Math.random() * 2) * calm;
            this.ySpeed = (1 + Math.random() * 1) * calm;
            this.flipSpeed = Math.random() * 0.03;
            if (mode === 'storm') {              // a big cloud just off the top-left corner
                this.x = -canvas.width * (0.05 + Math.random() * 0.95);
                this.y = -canvas.height * (0.05 + Math.random() * 0.95) + Math.random() * canvas.height * 0.25;
            } else if (mode === 'scatter') {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height * 2 - canvas.height;
            } else {                              // 'wrap': re-enter from the left, like before
                this.x = -this.w;
                this.y = Math.random() * canvas.height * 2 - canvas.height;
            }
        };

        Petal.prototype.draw = function() {
            ctx.globalAlpha = this.opacity;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.bezierCurveTo(this.x + this.w / 2, this.y - this.h / 2, this.x + this.w, this.y, this.x + this.w / 2, this.y + this.h / 2);
            ctx.bezierCurveTo(this.x, this.y + this.h, this.x - this.w / 2, this.y, this.x, this.y);
            ctx.closePath();
            ctx.fillStyle = '#FFB7C5';
            ctx.fill();
        };

        Petal.prototype.update = function() {
            this.x += this.xSpeed * speedMul;
            this.y += this.ySpeed * speedMul;
            this.flip += this.flipSpeed;
            this.draw();
        };

        function animate(now) {
            const p = Math.min(1, (now - t0) / STORM_MS);
            speedMul = 1 + 2.4 * Math.pow(1 - p, 2);                    // fast -> normal
            target = BASE + Math.round((STORM) * Math.pow(1 - p, 1.5)); // many -> normal
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = petals.length - 1; i >= 0; i--) {
                const pt = petals[i];
                pt.update();
                if (pt.y > canvas.height || pt.x > canvas.width) {
                    if (petals.length > target) petals.splice(i, 1);     // surplus petals just leave
                    else pt.init('wrap');
                }
            }
            requestAnimationFrame(animate);
        }

        startPetals = function() {
            if (running) return;
            running = true;
            t0 = performance.now();
            petals = [];
            for (let i = 0; i < BASE; i++) petals.push(new Petal('scatter'));
            for (let i = 0; i < STORM; i++) petals.push(new Petal('storm'));
            requestAnimationFrame(animate);
        };
        window.__petals = function() { return petals.length; };   // handy for testing
    }

    // --- Initialize AOS (Animate on Scroll) ---
    try {
        if (window.AOS) {
            AOS.init({ duration: 800, once: true });
        } else {
            // If the library didn't load, show everything instead of leaving it invisible
            document.querySelectorAll('[data-aos]').forEach(el => el.removeAttribute('data-aos'));
        }
    } catch (e) { console.warn('AOS failed', e); }

    // --- Chapters of Us: photo carousels ---
    const AR_MIN = 0.8, AR_MAX = 1.8;
    const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('.carousel').forEach(function(carousel) {
        const track = carousel.querySelector('.carousel-track');
        const slides = Array.from(track.querySelectorAll('.slide'));
        const dotsBox = carousel.querySelector('.carousel-dots');
        const ars = slides.map(function(s) {
            const a = parseFloat(s.dataset.ar) || 0.8;
            return Math.min(Math.max(a, AR_MIN), AR_MAX);
        });

        // blurred backdrop = the photo itself
        slides.forEach(function(slide) {
            const img = slide.querySelector('img');
            const vid = slide.querySelector('video');
            const src = img ? img.getAttribute('src') : (vid && vid.getAttribute('poster'));
            if (src) slide.style.setProperty('--img', 'url("' + src + '")');
        });

        // full-screen viewer (opened by our own click handler below, after a little bounce)
        const photoSlides = slides.filter(function(s) { return s.tagName === 'A'; });
        let lg = null;
        try {
            if (window.lightGallery && photoSlides.length) {
                lg = lightGallery(track, { selector: 'a.slide', speed: 400, download: false });
            }
        } catch (e) { console.warn('chapter gallery failed', e); }

        let dragged = false;
        function bounce(el) {
            if (!el || !el.animate || calmMotion) return;
            el.animate(
                [{ scale: 1 }, { scale: 0.94 }, { scale: 1.06 }, { scale: 0.99 }, { scale: 1 }],
                { duration: 480, easing: 'cubic-bezier(.3,1.2,.5,1)' }
            );
        }
        track.addEventListener('click', function(e) {
            const a = e.target.closest('a.slide');
            if (!a) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (dragged) return;
            bounce(a.querySelector('img'));
            if (lg) setTimeout(function() { lg.openGallery(photoSlides.indexOf(a)); }, calmMotion ? 0 : 230);
        }, true);

        if (slides.length < 2) {
            carousel.classList.add('single');
            carousel.style.setProperty('--ar', ars[0]);
            return;
        }

        const dots = slides.map(function(_, i) {
            const d = document.createElement('span');
            d.addEventListener('click', function() { goTo(i); });
            dotsBox.appendChild(d);
            return d;
        });

        // frame height + slide emphasis follow the swipe, frame by frame
        let ticking = false;
        function update() {
            ticking = false;
            const w = track.clientWidth || 1;
            const s = track.scrollLeft / w;
            const i = Math.max(0, Math.min(slides.length - 1, Math.floor(s)));
            const j = Math.min(slides.length - 1, i + 1);
            const f = Math.min(1, Math.max(0, s - i));
            const hgt = (1 / ars[i]) * (1 - f) + (1 / ars[j]) * f;
            carousel.style.setProperty('--ar', (1 / hgt).toFixed(4));
            const on = Math.round(s);
            slides.forEach(function(sl, k) {
                const dist = Math.min(1, Math.abs(k - s));
                const m = sl.querySelector('img, video');
                if (m) {
                    m.style.opacity = (1 - 0.5 * dist).toFixed(3);
                    m.style.transform = 'scale(' + (1 - 0.07 * dist).toFixed(3) + ')';
                }
                if (dots[k]) dots[k].classList.toggle('on', k === on);
            });
        }
        function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
        track.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        // eased scrolling (same feel for arrows, dots and mouse-drag release)
        let anim = 0;
        function stopAnim() { cancelAnimationFrame(anim); track.style.scrollSnapType = ''; }
        function animateTo(x, dur) {
            cancelAnimationFrame(anim);
            const start = track.scrollLeft, dist = x - start;
            if (!dist) { track.style.scrollSnapType = ''; return; }
            if (calmMotion) { track.scrollLeft = x; track.style.scrollSnapType = ''; return; }
            track.style.scrollSnapType = 'none';
            const t0 = performance.now();
            (function step(t) {
                const p = Math.min(1, (t - t0) / dur);
                const e = 1 - Math.pow(1 - p, 4);       // ease-out quart
                track.scrollLeft = start + dist * e;
                if (p < 1) { anim = requestAnimationFrame(step); } else { track.style.scrollSnapType = ''; }
            })(t0);
        }
        function current() { return Math.round(track.scrollLeft / track.clientWidth); }
        function goTo(i) {
            i = Math.max(0, Math.min(slides.length - 1, i));
            animateTo(i * track.clientWidth, 520);
        }
        carousel.querySelector('.prev').addEventListener('click', function() { goTo(current() - 1); });
        carousel.querySelector('.next').addEventListener('click', function() { goTo(current() + 1); });
        track.addEventListener('touchstart', stopAnim, { passive: true });
        track.addEventListener('wheel', stopAnim, { passive: true });

        // mouse: drag to swipe (touch already swipes natively)
        let down = false, startX = 0, startLeft = 0, startIdx = 0;
        track.addEventListener('pointerdown', function(e) {
            if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('video')) return;
            down = true; dragged = false;
            startX = e.clientX; startLeft = track.scrollLeft; startIdx = current();
            cancelAnimationFrame(anim);
            track.style.scrollSnapType = 'none';
            track.classList.add('dragging');
        });
        window.addEventListener('pointermove', function(e) {
            if (!down) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 5) dragged = true;
            track.scrollLeft = startLeft - dx;
        });
        window.addEventListener('pointerup', function(e) {
            if (!down) return;
            down = false;
            track.classList.remove('dragging');
            const dx = e.clientX - startX;
            let idx = startIdx;
            if (dx < -40) idx = startIdx + 1; else if (dx > 40) idx = startIdx - 1;
            idx = Math.max(0, Math.min(slides.length - 1, idx));
            animateTo(idx * track.clientWidth, 480);
            setTimeout(function() { dragged = false; }, 0);
        });

        update();
    });

    // --- Autoplay the chapter video only while it is on screen ---
    const chapterVideos = document.querySelectorAll('.carousel video');
    if (chapterVideos.length && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(function(entries) {
            entries.forEach(function(en) {
                if (en.isIntersecting) { en.target.play().catch(function() {}); } else { en.target.pause(); }
            });
        }, { threshold: 0.6 });
        chapterVideos.forEach(function(v) { io.observe(v); });
    }

    // --- Confetti burst (shared by the gate and the letter) ---
    // shapes flying toward the viewer
    const SHAPES = [
        '<svg viewBox="0 0 24 24"><polygon points="12,1.5 15,8.5 22.5,9.2 16.8,14.2 18.6,21.8 12,17.8 5.4,21.8 7.2,14.2 1.5,9.2 9,8.5" fill="COLOR" stroke="COLOR" stroke-width="2" stroke-linejoin="round"/></svg>',
        '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="COLOR"/></svg>',
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="COLOR"/></svg>'
    ];
    const COLORS = ['#FF8FB3', '#FFB7C5', '#6CBBF2', '#A9DAF9'];
    function burst(from) {
        if (calmMotion || !document.body.animate) return;
        const layer = document.createElement('div');
        layer.className = 'burst-layer';
        document.body.appendChild(layer);
        const r = from.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const reach = Math.max(window.innerWidth, window.innerHeight);
        let longest = 0;
        for (let i = 0; i < 54; i++) {
            const size = 14 + Math.random() * 22;
            const node = document.createElement('div');
            node.className = 'burst-shape';
            node.style.width = node.style.height = size + 'px';
            node.innerHTML = SHAPES[i % 3].replace(/COLOR/g, COLORS[(i + Math.floor(i / 3)) % 4]);
            layer.appendChild(node);
            const ang = Math.random() * Math.PI * 2;
            const dist = reach * (0.25 + Math.random() * 0.55);
            const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.85;
            const sx = cx - size / 2, sy = cy - size / 2;
            const rot = (Math.random() - 0.5) * 720;
            const grow = 2.2 + Math.random() * 2.8;      // bigger = closer to the viewer
            const dur = 950 + Math.random() * 650, delay = Math.random() * 140;
            longest = Math.max(longest, dur + delay);
            node.animate([
                { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.2) rotate(0deg)', opacity: 1, filter: 'blur(0px)' },
                { transform: 'translate(' + (sx + dx * .55) + 'px,' + (sy + dy * .55) + 'px) scale(' + (grow * .45) + ') rotate(' + (rot * .5) + 'deg)', opacity: 1, filter: 'blur(0px)', offset: .5 },
                { transform: 'translate(' + (sx + dx) + 'px,' + (sy + dy) + 'px) scale(' + grow + ') rotate(' + rot + 'deg)', opacity: 0, filter: 'blur(5px)' }
            ], { duration: dur, delay: delay, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'both' });
        }
        setTimeout(function() { layer.remove(); }, longest + 100);
    }


    // --- Gallery (Notif Favorit Dduy): bounce on tap, then full-screen viewer ---
    (function() {
        const gallery = document.getElementById('lightgallery');
        if (!gallery) return;
        const items = Array.from(gallery.querySelectorAll('a.gal-item'));
        let lg = null;
        try {
            if (window.lightGallery) lg = lightGallery(gallery, { selector: 'a.gal-item', speed: 400, download: false });
        } catch (e) { console.warn('gallery viewer failed', e); }
        gallery.addEventListener('click', function(e) {
            const a = e.target.closest('a.gal-item');
            if (!a) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const img = a.querySelector('img');
            if (img && img.animate && !calmMotion) {
                img.animate(
                    [{ scale: 1 }, { scale: 0.94 }, { scale: 1.06 }, { scale: 0.99 }, { scale: 1 }],
                    { duration: 480, easing: 'cubic-bezier(.3,1.2,.5,1)' }
                );
            }
            if (lg) setTimeout(function() { lg.openGallery(items.indexOf(a)); }, calmMotion ? 0 : 230);
        }, true);
    })();

    // ================= Opening gate =================
    (function() {
        const gate = document.getElementById('gate');
        if (!gate) { startPetals(); return; }   // no gate -> petals right away
        const $ = function(id) { return document.getElementById(id); };
        const D = calmMotion ? 0.25 : 1;                          // duration scale
        const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
        const NEVER = new Promise(function() {});

        // ---- the PIN is only stored as a hash, never as plain digits ----
        const SALT = 'acaa-gate:';
        const PIN_HASH = '7fd699aa57e26f332d7bedac2c901bc19ec1fef50bc55cb7a11bc3c98246842f';
        function sha256hex(str) {
            const rotr = function(n, x) { return (x >>> n) | (x << (32 - n)); };
            const bytes = new TextEncoder().encode(str), l = bytes.length;
            const buf = new Uint8Array(((l + 9 + 63) >> 6) << 6); buf.set(bytes); buf[l] = 0x80;
            const dv = new DataView(buf.buffer);
            dv.setUint32(buf.length - 4, (l * 8) >>> 0); dv.setUint32(buf.length - 8, Math.floor(l * 8 / 4294967296));
            const primes = []; for (let n = 2; primes.length < 64; n++) { if (primes.every(function(p) { return n % p; })) primes.push(n); }
            const K = primes.map(function(p) { return Math.floor((Math.cbrt(p) % 1) * 4294967296); });
            const H = primes.slice(0, 8).map(function(p) { return Math.floor((Math.sqrt(p) % 1) * 4294967296); });
            const w = new Uint32Array(64);
            for (let i = 0; i < buf.length; i += 64) {
                for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
                for (let t = 16; t < 64; t++) {
                    const s0 = rotr(7, w[t-15]) ^ rotr(18, w[t-15]) ^ (w[t-15] >>> 3);
                    const s1 = rotr(17, w[t-2]) ^ rotr(19, w[t-2]) ^ (w[t-2] >>> 10);
                    w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
                }
                let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
                for (let t = 0; t < 64; t++) {
                    const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[t] + w[t]) | 0;
                    const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
                    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
                }
                H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
                H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
            }
            return H.map(function(x) { return (x >>> 0).toString(16).padStart(8, '0'); }).join('');
        }

        // ---- sound effects (generated on the fly, no audio files) ----
        function audio() { return getAC(); }
        function pop() {                                          // bubbly "pop" for the candy buttons
            const a = audio(); if (!a) return;
            const t = a.currentTime;
            const o = a.createOscillator(), g = a.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(480, t);
            o.frequency.exponentialRampToValueAtTime(1040, t + 0.07);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            o.connect(g); g.connect(a.destination);
            o.start(t); o.stop(t + 0.18);
            const n = Math.floor(a.sampleRate * 0.025), nb = a.createBuffer(1, n, a.sampleRate), d = nb.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
            const ns = a.createBufferSource(), ng = a.createGain();
            ns.buffer = nb; ng.gain.value = 0.25; ns.connect(ng); ng.connect(a.destination); ns.start(t);
        }
        function tick() {                                         // small tick for keypad
            const a = audio(); if (!a) return;
            const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(1250, t); o.frequency.exponentialRampToValueAtTime(800, t + 0.04);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
            o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.07);
        }

        // ---- floating background shapes ----
        (function() {
            const bg = $('gate-bg');
            const kinds = [
                '<svg viewBox="0 0 24 24"><polygon points="12,1.5 15,8.5 22.5,9.2 16.8,14.2 18.6,21.8 12,17.8 5.4,21.8 7.2,14.2 1.5,9.2 9,8.5" fill="C" stroke="C" stroke-width="2" stroke-linejoin="round"/></svg>',
                '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="C"/></svg>',
                '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="C"/></svg>'
            ];
            const cols = ['#FF8FB3', '#6CBBF2'];
            for (let i = 0; i < 16; i++) {
                const s = document.createElement('div'), size = 16 + Math.random() * 26;
                s.className = 'gate-shape';
                s.style.cssText = 'left:' + (Math.random() * 96) + '%;top:' + (Math.random() * 94) + '%;width:' + size + 'px;height:' + size + 'px;--t:' + (6 + Math.random() * 6).toFixed(1) + 's;--dl:' + (-Math.random() * 6).toFixed(1) + 's';
                s.innerHTML = kinds[i % 3].replace(/"C"/g, '"' + cols[i % 2] + '"');
                bg.appendChild(s);
            }
        })();

        // ---- animation helpers ----
        function fx(el, frames, ms, easing, delay) {
            return el.animate(frames, { duration: ms * D, easing: easing || 'ease', delay: (delay || 0) * D, fill: 'both' }).finished;
        }
        const fallIn = [{ opacity: 0, transform: 'translateY(-54px)' }, { opacity: 1, transform: 'none' }];
        const fadeOut = [{ opacity: 1 }, { opacity: 0 }];
        const popIn = [
            { opacity: 0, transform: 'translateY(34px) scale(.4)' },
            { opacity: 1, transform: 'translateY(-6px) scale(1.07)', offset: 0.62 },
            { opacity: 1, transform: 'none' }
        ];
        function show(el) { el.hidden = false; }

        function vanish() {
            gate.classList.add('vanishing');
            setTimeout(function() {
                try { window.close(); } catch (e) {}              // only works if the tab was opened by a script
                setTimeout(function() {
                    try { document.documentElement.innerHTML = ''; } catch (e) {}
                    location.replace('about:blank');
                }, 150);
            }, calmMotion ? 50 : 520);
            return NEVER;
        }

        function choose(buttons) {
            return new Promise(function(res) {
                buttons.forEach(function(b) {
                    b.addEventListener('click', function() {
                        pop();
                        buttons.forEach(function(x) { x.disabled = true; });
                        res(b.dataset.act);
                    }, { once: true });
                });
            });
        }

        // ---- particles: pink circle + little stars ("landing" effect) ----
        const fxLayer = document.createElement('div');
        fxLayer.className = 'gate-fxlayer';
        gate.appendChild(fxLayer);
        const ringLayer = document.createElement('div');          // pink circles sit BEHIND the text / Acaa, stars in front
        ringLayer.className = 'gate-fxlayer under';
        gate.insertBefore(ringLayer, $('gate-bg').nextSibling);
        function sparkle(x, y, o) {
            if (calmMotion || !fxLayer.animate) return;
            o = o || {};
            const ringSize = o.ring || 54, n = o.n || 8, reach = o.reach || 74, sMin = o.min || 9, sMax = o.max || 17;
            const ring = document.createElement('div');
            ring.className = 'fx-ring';
            ring.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + ringSize + 'px;height:' + ringSize + 'px';
            ringLayer.appendChild(ring);
            ring.animate([
                { transform: 'translate(-50%,-50%) scale(.15)', opacity: .95 },
                { transform: 'translate(-50%,-50%) scale(1.25)', opacity: .8, offset: .35 },
                { transform: 'translate(-50%,-50%) scale(2.3)', opacity: 0 }
            ], { duration: 720, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' }).finished.then(function() { ring.remove(); }, function() { ring.remove(); });
            for (let i = 0; i < n; i++) {
                const size = sMin + Math.random() * (sMax - sMin);
                const star = document.createElement('div');
                star.className = 'fx-star';
                star.style.width = star.style.height = size + 'px';
                star.innerHTML = SHAPES[0].replace(/COLOR/g, COLORS[i % 4]);
                fxLayer.appendChild(star);
                const ang = -Math.PI * (0.06 + 0.88 * (i + Math.random() * .7) / n);        // upward fan
                const dist = reach * (0.65 + Math.random() * 0.55);
                const sx = x - size / 2, sy = y - size / 2;
                const ex = sx + Math.cos(ang) * dist, ey = sy + Math.sin(ang) * dist + 14;
                const dur = 620 + Math.random() * 380;
                star.animate([
                    { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.2) rotate(0deg)', opacity: 1 },
                    { transform: 'translate(' + (sx + (ex - sx) * .7) + 'px,' + (sy + (ey - sy) * .6) + 'px) scale(1.1) rotate(' + (Math.random() * 160 - 80) + 'deg)', opacity: 1, offset: .55 },
                    { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(.3) rotate(' + (Math.random() * 300 - 150) + 'deg)', opacity: 0 }
                ], { duration: dur, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).finished.then(function() { star.remove(); }, function() { star.remove(); });
            }
        }
        function thump() {                                        // soft landing "boing"
            const a = audio(); if (!a) return;
            const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.14);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
            o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.22);
        }
        function crack() {                                        // little "crack" + sad slide for the broken heart
            const a = audio(); if (!a) return;
            const t = a.currentTime;
            const n = Math.floor(a.sampleRate * 0.09), nb = a.createBuffer(1, n, a.sampleRate), d = nb.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
            const ns = a.createBufferSource(), ng = a.createGain();
            ns.buffer = nb; ng.gain.value = 0.35; ns.connect(ng); ng.connect(a.destination); ns.start(t);
            const o = a.createOscillator(), g = a.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(520, t + 0.05); o.frequency.exponentialRampToValueAtTime(170, t + 0.5);
            g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.exponentialRampToValueAtTime(0.22, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
            o.connect(g); g.connect(a.destination); o.start(t + 0.05); o.stop(t + 0.58);
        }

        // ---- stage 1: "Haiii! i'm Dduy, ur boyfriend" -> plain text, typewriter reveal (3 s until the last letter) ----
        const HI_TYPE_MS = 3000;                                  // first letter -> last letter of "boyfriend"
        const JUMP_EVERY = 3000;                                  // idle: Dduy jumps every 3 seconds
        async function stageHi() {
            const st = $('st-hi'), t = $('t-hi'); show(st);
            const full = t.textContent.trim();
            t.setAttribute('aria-label', full);
            t.textContent = '';
            const chars = [], words = [];
            full.split(' ').forEach(function(w, wi) {
                const ws = document.createElement('span');
                ws.className = 'tw-word'; ws.setAttribute('aria-hidden', 'true');
                if (w.indexOf('Dduy') === 0) ws.classList.add('me');
                Array.from(w).forEach(function(c) {
                    const cs = document.createElement('span');
                    cs.className = 'tw-ch'; cs.textContent = c; ws.appendChild(cs); chars.push({ el: cs, c: c });
                });
                if (wi) t.appendChild(document.createTextNode(' '));
                t.appendChild(ws); words.push(ws);
            });
            const dduy = words[2];
            // moment each letter appears: even spacing, a slightly longer beat after "!" and ","
            const gaps = chars.map(function(o, i) { const prev = i ? chars[i - 1].c : ''; return (prev === '!' ? 5 : prev === ',' ? 4 : 1); });
            let acc = 0; const at = gaps.map(function(g, i) { if (i) acc += g; return acc; });
            const stamps = at.map(function(v) { return v / acc * HI_TYPE_MS * D; });
            let skip = false;
            const early = function(e) { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; skip = true; };
            gate.addEventListener('click', early); document.addEventListener('keydown', early);
            await sleep(300 * D);
            await new Promise(function(res) {
                const t0 = performance.now(); let n = 0;
                (function frame(now) {
                    const el = skip ? Infinity : now - t0;
                    while (n < chars.length && stamps[n] <= el) {
                        if (n) chars[n - 1].el.classList.remove('cur');
                        chars[n].el.classList.add('on', 'cur'); n++;
                    }
                    if (n < chars.length) requestAnimationFrame(frame); else res();
                })(t0);
            });
            gate.removeEventListener('click', early); document.removeEventListener('keydown', early);
            await sleep(skip ? 120 : 450 * D);
            chars[chars.length - 1].el.classList.remove('cur');
            fx($('hint-hi'), [{ opacity: 0 }, { opacity: 1 }], 700);

            // idle: Dduy hops, and a pink circle + stars pop out where he lands
            let hopping = true, hopTimer = null;
            function hop() {
                if (!hopping || calmMotion || !dduy.animate) return;
                dduy.style.transformOrigin = '50% 100%';
                const total = 800;
                dduy.animate([
                    { transform: 'translateY(0) scale(1,1)' },
                    { transform: 'translateY(0) scale(1.1,.86)', offset: .14 },
                    { transform: 'translateY(-40px) scale(.94,1.1)', offset: .42, easing: 'cubic-bezier(.5,0,.9,.55)' },
                    { transform: 'translateY(0) scale(1.15,.82)', offset: .68 },
                    { transform: 'translateY(-8px) scale(.98,1.04)', offset: .83 },
                    { transform: 'translateY(0) scale(1,1)' }
                ], { duration: total, easing: 'ease-out' });
                setTimeout(function() {
                    if (!hopping) return;
                    const r = dduy.getBoundingClientRect();
                    sparkle(r.left + r.width / 2, r.bottom - 2, { ring: Math.max(70, r.width * .55), n: 9, reach: 104, min: 11, max: 20 });
                    thump();
                }, total * .68);
            }
            if (!calmMotion) hopTimer = setInterval(hop, JUMP_EVERY);

            await new Promise(function(res) {
                function go(e) {
                    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                    gate.removeEventListener('click', go); document.removeEventListener('keydown', go); res();
                }
                gate.addEventListener('click', go); document.addEventListener('keydown', go);
            });
            hopping = false; clearInterval(hopTimer);
            audio();                                              // unlock sound on the first tap
            // unlock the song on the first tap too (iOS only lets media start from a tap)
            try { song.muted = true; const up = song.play(); if (up && up.then) up.then(function() { song.pause(); song.currentTime = 0; song.muted = false; }).catch(function() { song.muted = false; }); } catch (e) { song.muted = false; }
            await fx(st, fadeOut, 450);
            st.hidden = true;
        }

        // ---- sounds for the desk scene ----
        function tenot() {                                        // typo: "te-NOT" (two falling buzzy notes)
            const a = audio(); if (!a) return;
            const t = a.currentTime, lp = a.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 1500; lp.connect(a.destination);
            [[392, 0, .1], [233, .11, .26]].forEach(function(n) {
                const o = a.createOscillator(), g = a.createGain();
                o.type = 'square'; o.frequency.setValueAtTime(n[0], t + n[1]);
                o.frequency.exponentialRampToValueAtTime(n[0] * .93, t + n[1] + n[2]);
                g.gain.setValueAtTime(0.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(0.2, t + n[1] + .015);
                g.gain.setValueAtTime(0.2, t + n[1] + n[2] - .04); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + n[2]);
                o.connect(g); g.connect(lp); o.start(t + n[1]); o.stop(t + n[1] + n[2] + .02);
            });
        }
        function sadVoice() {                                     // failure: a drooping "yaaaah..."
            const a = audio(); if (!a) return;
            const t = a.currentTime, dur = 1.35;
            const o = a.createOscillator(), g = a.createGain(), f1 = a.createBiquadFilter(), f2 = a.createBiquadFilter();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(330, t); o.frequency.linearRampToValueAtTime(440, t + .12);
            o.frequency.exponentialRampToValueAtTime(140, t + dur);
            const lfo = a.createOscillator(), lg = a.createGain();   // wobbly vibrato
            lfo.frequency.value = 6.5; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
            f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(420, t); f1.frequency.linearRampToValueAtTime(780, t + .22); f1.frequency.linearRampToValueAtTime(600, t + dur);
            f2.type = 'bandpass'; f2.Q.value = 7; f2.frequency.setValueAtTime(2000, t); f2.frequency.linearRampToValueAtTime(1250, t + dur);
            const mix = a.createGain(); mix.gain.value = 1;
            o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + .09);
            g.gain.setValueAtTime(0.9, t + dur * .55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            g.connect(a.destination);
            o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
        }
        function keyTap() {                                       // soft keyboard tick
            const a = audio(); if (!a) return;
            const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(900 + Math.random() * 260, t); o.frequency.exponentialRampToValueAtTime(520, t + .035);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + .004); g.gain.exponentialRampToValueAtTime(0.0001, t + .05);
            o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + .06);
        }
        function chime() {                                        // finished typing
            const a = audio(); if (!a) return;
            const t = a.currentTime;
            [523.25, 659.25, 783.99, 1046.5].forEach(function(f, i) {
                const o = a.createOscillator(), g = a.createGain();
                o.type = 'sine'; o.frequency.value = f;
                g.gain.setValueAtTime(0.0001, t + i * .09); g.gain.exponentialRampToValueAtTime(0.22, t + i * .09 + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * .09 + .5);
                o.connect(g); g.connect(a.destination); o.start(t + i * .09); o.stop(t + i * .09 + .55);
            });
        }

        // ---- stage 1b: the desk -- objects drop in, camera zooms to the notebook, user types the "perjanjian" ----
        const AGREEMENT = 'Haloow, ini perjanjian lucuuu buat Dduy yang lagi di sana. Aku bakal explore kelucuan yang ada di website ini dengan serius dan gemush. Aku mau liat banget apa yang ada di dalemnya. Knock knock, bring me inside Dduy.';
        const DESK_W = 1225, DESK_H = 688;
        const PAGE = { cx: 648, w: 228, top: 410 };               // the notebook's right page (stage px)
        const MAX_TYPOS = 3;
        async function stageDesk() {
            const st = $('st-desk'), cam = $('desk-cam'), paper = $('paper'), ptext = $('paper-text'), input = $('paper-input');
            const tapPill = $('paper-tap'), hearts = Array.from($('paper-lives').children), fail = $('desk-fail'), failText = $('fail-text');
            const sprites = ['laptop', 'redbook', 'pomade', 'notebook', 'mouse', 'blues', 'lip'].map(function(k) { return $('d-' + k); });
            const S = function(k) { return $('d-' + k); };
            const ease = { out: 'cubic-bezier(.22,1,.36,1)', quadOut: 'cubic-bezier(.5,1,.89,1)', quadIn: 'cubic-bezier(.11,0,.5,0)', io: 'cubic-bezier(.65,0,.35,1)' };

            // make sure the pictures are decoded before the stage shows (no pop-in)
            await Promise.all(Array.from(st.querySelectorAll('img.ds')).map(function(im) {
                return (im.decode ? im.decode() : Promise.resolve()).catch(function() {});
            }));

            // ---- camera: the 16:9 desk is "contained" in the screen; on a tall phone it is turned on its side so it fills the screen ----
            function camFor(mode) {
                const vw = st.clientWidth || window.innerWidth, vh = st.clientHeight || window.innerHeight;
                const portrait = vw / vh < 0.95;
                let s, rot, cx, cy;
                if (mode === 'wide') {
                    cx = DESK_W / 2; cy = DESK_H / 2;
                    if (portrait) { rot = -90; s = Math.min(vh / DESK_W, vw / DESK_H); } else { rot = 0; s = Math.min(vw / DESK_W, vh / DESK_H); }
                } else {
                    rot = 0; cx = PAGE.cx;
                    s = (portrait ? vw * 1.05 : Math.min(vw * 1.02, 720)) / PAGE.w;
                    cy = PAGE.top + (0.5 - 0.07) * vh / s;         // right page's top edge sits ~7% below the top of the screen
                }
                return 'translate(' + (vw / 2) + 'px,' + (vh / 2) + 'px) rotate(' + rot + 'deg) scale(' + s + ') translate(' + (-cx) + 'px,' + (-cy) + 'px)';
            }
            let camMode = 'wide', camBusy = false;
            function placeCam() { if (!camBusy) cam.style.transform = camFor(camMode); }
            async function camTo(mode, ms) {
                const from = camFor(camMode), to = camFor(mode);
                camBusy = true;
                try { await cam.animate([{ transform: from }, { transform: to }], { duration: ms * D, easing: ease.io, fill: 'both' }).finished; } catch (e) {}
                camMode = mode; camBusy = false; cam.style.transform = to;
                cam.getAnimations().forEach(function(a) { a.cancel(); });
            }
            window.addEventListener('resize', placeCam);
            placeCam();

            // ---- show the (empty) desk: wood, mat, phone and glass are just there ----
            show(st); st.style.opacity = 0;
            await fx(st, [{ opacity: 0 }, { opacity: 1 }], 500);
            await sleep(150 * D);

            const A = function(el, frames, ms, easing, delay) { return fx(el, frames, ms, easing, delay); };
            // laptop: slides in from the top
            const pLaptop = A(S('laptop'), [{ opacity: 0, transform: 'translateY(-470px)' }, { opacity: 1, transform: 'none' }], 950, ease.out);
            setTimeout(thump, 800 * D);
            // red book: bounce in, then the Kahf pomade 0.5 s later with a scale bounce
            const bounce = [
                { opacity: 0, transform: 'scale(.15)', easing: 'ease-out' }, { opacity: 1, transform: 'scale(1.14)', offset: .5, easing: 'ease-in-out' },
                { transform: 'scale(.94)', offset: .72, easing: 'ease-in-out' }, { transform: 'scale(1.03)', offset: .88, easing: 'ease-in-out' }, { opacity: 1, transform: 'scale(1)' }
            ];
            const pBook = A(S('redbook'), bounce, 850, 'linear', 420);
            setTimeout(pop, 520 * D);
            const pPom = A(S('pomade'), [
                { opacity: 0, transform: 'scale(0)', easing: 'ease-out' }, { opacity: 1, transform: 'scale(1.35)', offset: .45, easing: 'ease-in-out' },
                { transform: 'scale(.88)', offset: .7, easing: 'ease-in-out' }, { transform: 'scale(1.06)', offset: .86, easing: 'ease-in-out' }, { opacity: 1, transform: 'scale(1)' }
            ], 750, 'linear', 420 + 500);
            setTimeout(pop, 1100 * D);
            // notebook: rises from the bottom, quad-out, with a little settle bounce
            const pNote = A(S('notebook'), [
                { opacity: 0, transform: 'translateY(720px)', easing: ease.quadOut },
                { opacity: 1, transform: 'translateY(-34px)', offset: .62 },
                { transform: 'translateY(0)', offset: .8, easing: 'ease-in-out' },
                { transform: 'translateY(-9px)', offset: .91 },
                { opacity: 1, transform: 'translateY(0)' }
            ], 1150, 'linear', 900);
            setTimeout(thump, 900 * D + 800 * D);
            // mouse: bounce in
            const pMouse = A(S('mouse'), bounce, 800, 'linear', 1500);
            setTimeout(pop, 1650 * D);
            await Promise.all([pLaptop, pBook, pPom, pNote, pMouse]);

            // lip balm: rolls in clockwise from the top, slowing down as it settles
            setTimeout(tick, 120 * D);
            await A(S('lip'), [
                { opacity: 0, transform: 'translate(46px,-330px) rotate(-560deg)', easing: 'cubic-bezier(.25,.6,.4,1)' },
                { opacity: 1, transform: 'translate(7px,-26px) rotate(-62deg)', offset: .56, easing: 'cubic-bezier(.3,.5,.6,1)' },
                { opacity: 1, transform: 'translate(0,0) rotate(0deg)' }
            ], 1900, 'linear');
            await sleep(320 * D);
            // the two blue books: swing in clockwise from the top
            setTimeout(thump, 900 * D);
            await A(S('blues'), [
                { opacity: 0, transform: 'translate(70px,-470px) rotate(-80deg)', easing: 'cubic-bezier(.2,.8,.25,1)' },
                { opacity: 1, transform: 'translate(-4px,6px) rotate(5deg)', offset: .78, easing: 'ease-in-out' },
                { opacity: 1, transform: 'none' }
            ], 1250, 'linear');
            await sleep(550 * D);

            // zoom in to the right-hand page, the agreement fades in ready to type
            await camTo('zoom', 1500);
            await sleep(120 * D);

            // ---- the agreement (translucent card) ----
            ptext.textContent = '';
            const cells = [];
            AGREEMENT.split(' ').forEach(function(w, wi) {
                if (wi) { const sp = document.createElement('span'); sp.className = 'pc'; sp.textContent = ' '; cells.push(sp); ptext.appendChild(sp); }
                const wrap = document.createElement('span'); wrap.className = 'pw';
                Array.from(w).forEach(function(c) { const s = document.createElement('span'); s.className = 'pc'; s.textContent = c; wrap.appendChild(s); cells.push(s); });
                ptext.appendChild(wrap);
            });
            // the space between words can break the line, so it lives outside the nowrap word wrappers (done above)
            let pos = 0, typos = 0, busy = false, finished = false, failed = false;
            cells[0].classList.add('cur');
            paper.hidden = false;
            fx(paper, [{ opacity: 0, transform: 'translateY(26px) scale(.94)' }, { opacity: 1, transform: 'none' }], 700, 'cubic-bezier(.3,1.2,.5,1)');
            hearts.forEach(function(h) { h.classList.remove('lost'); });

            const touch = window.matchMedia('(pointer: coarse)').matches;
            function focusInput() { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }
            input.addEventListener('focus', function() { tapPill.hidden = true; });
            input.addEventListener('blur', function() { if (!finished && touch) tapPill.hidden = false; });
            paper.addEventListener('click', focusInput);
            tapPill.addEventListener('click', focusInput);
            await sleep(750 * D);
            focusInput();
            if (touch && document.activeElement !== input) tapPill.hidden = false;

            function norm(c) { return c.toLowerCase(); }
            function acceptChar(ch) {
                if (finished || busy) return;
                if (ch === '’' || ch === '‘') ch = "'";
                const want = AGREEMENT[pos];
                if (norm(ch) === norm(want)) {
                    cells[pos].classList.remove('cur', 'bad'); cells[pos].classList.add('ok');
                    pos++; keyTap();
                    if (pos >= AGREEMENT.length) { finished = true; return; }
                    cells[pos].classList.add('cur');
                } else {
                    typos++; tenot();
                    const c = cells[pos];
                    c.classList.remove('bad'); void c.offsetWidth; c.classList.add('bad');
                    setTimeout(function() { c.classList.remove('bad'); }, 460);
                    const h = hearts[typos - 1]; if (h) h.classList.add('lost');
                    paper.classList.remove('hit'); void paper.offsetWidth; paper.classList.add('hit');
                    if (typos >= MAX_TYPOS) { finished = true; failed = true; }
                }
            }
            const outcome = new Promise(function(res) {
                function check() { if (finished) { cleanup(); res(failed ? 'fail' : 'done'); } }
                function onKey(e) {
                    if (e.ctrlKey || e.metaKey || e.altKey) return;
                    if (e.key && e.key.length === 1 && e.keyCode !== 229) { e.preventDefault(); acceptChar(e.key); check(); }
                    else if (e.key === ' ') e.preventDefault();
                }
                let last = '';
                function onInput(e) {                              // mobile keyboards / IME: read what was added, then clear
                    const v = input.value; input.value = '';
                    if (e && e.inputType && e.inputType.indexOf('delete') === 0) return;
                    Array.from(v).forEach(function(c) { if (c.trim() !== '' || c === ' ') acceptChar(c); });
                    check();
                }
                function cleanup() { document.removeEventListener('keydown', onKey); input.removeEventListener('input', onInput); }
                document.addEventListener('keydown', onKey);
                input.addEventListener('input', onInput);
            });
            const result = await outcome;
            try { input.blur(); } catch (e) {}
            tapPill.hidden = true;

            if (result === 'fail') {
                // 3 typos: everything fades to white, black "BECUSN'T" + a sad voice, then the page is gone
                await sleep(450 * D);
                fail.hidden = false; failText.hidden = true;
                await fx(fail, [{ opacity: 0 }, { opacity: 1 }], 1100, 'ease-in-out');
                await sleep(250 * D);
                failText.hidden = false;
                sadVoice();
                fx(failText, [
                    { opacity: 0, transform: 'translateY(-40px) scale(.5) rotate(-6deg)' },
                    { opacity: 1, transform: 'translateY(0) scale(1.12) rotate(2deg)', offset: .55 },
                    { opacity: 1, transform: 'none' }
                ], 650, 'cubic-bezier(.3,1.3,.5,1)');
                await sleep(2400 * D);
                window.removeEventListener('resize', placeCam);
                return vanish();
            }

            // ---- success: chime, card leaves, camera zooms out, objects get pulled away one by one ----
            chime();
            const r = paper.getBoundingClientRect();
            sparkle(r.left + r.width / 2, r.top + 8, { ring: 110, n: 12, reach: 150, min: 12, max: 22 });
            await sleep(800 * D);
            await fx(paper, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-18px) scale(.96)' }], 380, 'ease-in');
            paper.hidden = true;
            await camTo('wide', 1500);
            await sleep(450 * D);
            const order = sprites.slice().sort(function() { return Math.random() - .5; });
            const cxs = DESK_W / 2, cys = DESK_H / 2;
            const pulls = order.map(function(el, i) {
                const x = el.offsetLeft + el.offsetWidth / 2 - cxs, y = el.offsetTop + el.offsetHeight / 2 - cys;
                const len = Math.hypot(x, y) || 1, dist = 1250;
                const ang = (Math.random() * 80 - 40);
                return fx(el, [
                    { opacity: 1, transform: 'translate(0,0) scale(1) rotate(0deg)' },
                    { opacity: 1, transform: 'translate(' + (-x / len * 26) + 'px,' + (-y / len * 26) + 'px) scale(1.04) rotate(' + (-ang * .1) + 'deg)', offset: .16, easing: ease.quadIn },
                    { opacity: 0, transform: 'translate(' + (x / len * dist) + 'px,' + (y / len * dist) + 'px) scale(.35) rotate(' + ang + 'deg)' }
                ], 820, 'ease-in', i * 230);
            });
            order.forEach(function(el, i) { setTimeout(function() { tick(); }, (i * 230 + 150) * D); });
            await Promise.all(pulls);
            await sleep(250 * D);
            window.removeEventListener('resize', placeCam);
            await fx(st, fadeOut, 600);
            st.hidden = true;
        }

        // ---- stage 2: "Apakah kamu yang namanya Sasha Oktavia Melani?"  IYAK / BUKAN ----
        async function stageName() {
            const st = $('st-name'), btns = Array.from($('b-name').children); show(st);
            btns.forEach(function(b) { b.style.opacity = 0; });
            await fx($('t-name'), fallIn, 1000, 'cubic-bezier(.2,.8,.2,1)');
            btns.forEach(function(b, i) { fx(b, popIn, 700, 'cubic-bezier(.3,1.2,.5,1)', i * 130); });
            const pick = await choose(btns);
            if (pick === 'no') return vanish();
            await sleep(180 * D);
            await fx(st, fadeOut, 450);
            st.hidden = true;
        }

        // ---- stage 3: nickname pop-up  Sashul / Sasa / Acaa ----
        async function stageNick() {
            const st = $('st-nick'), pop3 = $('pop-nick'), btns = Array.from(pop3.children); show(st);
            pop3.hidden = true;
            await fx($('t-nick'), fallIn, 1000, 'cubic-bezier(.2,.8,.2,1)');
            await sleep(450 * D);
            pop3.hidden = false;
            fx(pop3, popIn, 750, 'cubic-bezier(.3,1.2,.5,1)');
            btns.forEach(function(b, i) { fx(b, popIn, 650, 'cubic-bezier(.3,1.2,.5,1)', 150 + i * 120); });
            const pick = await choose(btns);
            if (pick !== 'Acaa') return vanish();
            await sleep(180 * D);
            await fx(st, fadeOut, 450);
            st.hidden = true;
        }

        // ---- stage 4: PIN calculator (+ broken hearts, Acaa and her chat bubble) ----
        const HEART_PATH = 'M12 21C3 14 1 9.5 1 6.5 1 3.5 3.4 1 6.4 1c2.3 0 4.3 1.2 5.6 3.2C13.3 2.2 15.3 1 17.6 1 20.6 1 23 3.5 23 6.5c0 3-2 7.5-11 14.5z';
        const CLOUD = '<svg viewBox="0 0 64 40"><path d="M17 38A13 13 0 0 1 15 12a18 18 0 0 1 33 3 12.500 12.500 0 0 1 2 23z" fill="#fff" stroke="#CFE6FA" stroke-width="2"/></svg>';
        const SAYS = [
            'hayooo tebak, ada hubungannya sama momenku sekarang lhooo',
            'bjir kok gatau tau seh, hari ini emg aku ada moment apa? pikir yg benerr!',
            'ahh elaaah,  ultahku tanggal berapa emgggg?! sebel dah'
        ];

        // the heart: scales up, tears in two, then the left half fades downward first, the right half after it
        function breakHeart() {
            const host = $('heart-fx');
            if (!host.animate) return;
            const mk = function(side) {                           // side: 'l' | 'r'  (jagged tear down the middle)
                const clip = side === 'l'
                    ? '0,-2 12,-2 10,5 13.500,9.500 10.500,13 13,17 12,24 0,24'
                    : '12,-2 24,-2 24,24 12,24 13,17 10.500,13 13.500,9.500 10,5';
                const id = 'hc' + side + Date.now();
                return '<svg viewBox="0 0 24 22" class="hb-' + side + '"><defs><clipPath id="' + id + '"><polygon points="' + clip + '"/></clipPath></defs>' +
                    '<g clip-path="url(#' + id + ')"><path d="' + HEART_PATH + '" fill="#FF4D7D" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
                    '<path d="M5 4.200c1-1.200 2.400-1.500 3.600-1" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.500" stroke-linecap="round"/></g></svg>';
            };
            const wrap = document.createElement('div');
            wrap.className = 'hb';
            wrap.innerHTML = '<div class="hb" style="position:absolute;inset:0">' + mk('l') + '</div><div class="hb" style="position:absolute;inset:0">' + mk('r') + '</div>';
            host.appendChild(wrap);
            const L = wrap.children[0], R = wrap.children[1];
            const up = wrap.animate([
                { opacity: 0, transform: 'scale(.2)' },
                { opacity: 1, transform: 'scale(2.8)', offset: .55 },
                { opacity: 1, transform: 'scale(2.4)' }
            ], { duration: 520 * D, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' });
            up.finished.then(async function() {
                await wrap.animate([                                // quiver right before it breaks
                    { transform: 'scale(2.4) rotate(0deg)' }, { transform: 'scale(2.5) rotate(-5deg)' },
                    { transform: 'scale(2.4) rotate(4deg)' }, { transform: 'scale(2.55) rotate(-3deg)' }, { transform: 'scale(2.4) rotate(0deg)' }
                ], { duration: 320 * D, fill: 'forwards' }).finished;
                crack();
                L.animate([{ transform: 'none' }, { transform: 'translate(-7px,2px) rotate(-13deg)' }], { duration: 240 * D, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' });
                await R.animate([{ transform: 'none' }, { transform: 'translate(7px,2px) rotate(13deg)' }], { duration: 240 * D, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' }).finished;
                await sleep(260 * D);
                const out = function(el, dx, rot) {
                    return el.animate([
                        { transform: el === L ? 'translate(-7px,2px) rotate(-13deg)' : 'translate(7px,2px) rotate(13deg)', opacity: 1 },
                        { transform: 'translate(' + dx + 'px,56px) rotate(' + rot + 'deg)', opacity: 0 }
                    ], { duration: 650 * D, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' }).finished;
                };
                const pl = out(L, -16, -34);                          // left half goes first …
                await sleep(300 * D);
                await Promise.all([pl, out(R, 16, 34)]);              // … right half follows
                wrap.remove();
            }).catch(function() { wrap.remove(); });
        }

        // Acaa: bounce in (particles after she lands) -> little clouds gather -> they turn into the chat bubble
        const acaaUI = {
            scene: $('pin-scene'), wrap: $('acaa-wrap'), head: $('acaa'), box: $('bubble-box'),
            bubble: $('bubble'), text: $('bubble-text'), tk: 0, bubbleOn: false, smokeT: null, shown: false
        };
        function stopSmoke() { clearInterval(acaaUI.smokeT); acaaUI.smokeT = null; }
        function startSmoke() {
            if (calmMotion) return;
            stopSmoke();
            const head = acaaUI.head;
            function puff() {
                if (!head.animate) return;
                const el = document.createElement('i');
                el.className = 'smoke';
                const w = head.offsetWidth, size = w * (.13 + Math.random() * .1);
                const fromRight = Math.random() < .5;
                el.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + ((fromRight ? .74 : .1) * w + Math.random() * w * .14) + 'px;top:' + (w * (.04 + Math.random() * .16)) + 'px';
                head.appendChild(el);
                const dx = (fromRight ? 1 : -1) * (w * (.25 + Math.random() * .4)), dy = -(w * (.12 + Math.random() * .3));
                el.animate([
                    { transform: 'translate(0,0) scale(.35)', opacity: 0 },
                    { transform: 'translate(' + dx * .35 + 'px,' + dy * .3 + 'px) scale(.9)', opacity: .9, offset: .25 },
                    { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.9)', opacity: 0 }
                ], { duration: 1150 + Math.random() * 350, easing: 'ease-out', fill: 'forwards' }).finished.then(function() { el.remove(); }, function() { el.remove(); });
            }
            puff();
            acaaUI.smokeT = setInterval(puff, 230);
        }
        async function hideBubble() {
            const u = acaaUI;
            if (!u.bubbleOn) return;
            u.bubbleOn = false;
            await u.bubble.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.8)' }], { duration: 220 * D, fill: 'forwards' }).finished.catch(function() {});
        }
        async function exitHead() {
            const u = acaaUI;
            if (!u.shown) return;
            await u.head.animate([
                { transform: 'none', opacity: 1 },
                { transform: 'translateY(-16px) scale(1.08,.94)', opacity: 1, offset: .3 },
                { transform: 'translateY(46px) scale(.15) rotate(-16deg)', opacity: 0 }
            ], { duration: 340 * D, easing: 'ease-in', fill: 'forwards' }).finished.catch(function() {});
        }
        async function revealBubble(msg, alive) {
            const u = acaaUI;
            u.text.textContent = msg;
            u.bubble.getAnimations().forEach(function(a) { a.cancel(); });
            u.bubble.style.opacity = 0;
            const clouds = [];
            const bw = u.box.offsetWidth, bh = u.bubble.offsetHeight;
            const N = calmMotion ? 0 : 8;
            for (let i = 0; i < N; i++) {
                const size = 30 + Math.random() * 26;
                const c = document.createElement('div');
                c.className = 'cloud';
                c.style.width = size + 'px';
                c.style.marginLeft = (-size / 2) + 'px'; c.style.marginTop = (-size * .31) + 'px';
                c.innerHTML = CLOUD;
                u.box.appendChild(c);
                clouds.push(c);
                const ang = Math.random() * Math.PI * 2, far = 90 + Math.random() * 70;
                const sx = Math.cos(ang) * far, sy = Math.sin(ang) * far * .8;
                const tx = (Math.random() - .5) * bw * .62, ty = (Math.random() - .5) * bh * .55;
                c.animate([
                    { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.3)', opacity: 0 },
                    { opacity: 1, offset: .3 },
                    { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(1)', opacity: 1 }
                ], { duration: 650, delay: i * 45, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });
            }
            await sleep(N ? 650 + 45 * N : 0);
            if (!alive()) { clouds.forEach(function(c) { c.remove(); }); return; }
            clouds.forEach(function(c) {
                c.animate([{ opacity: 1, transform: c.style.transform }, { opacity: 0 }], { duration: 320, fill: 'forwards' }).finished.then(function() { c.remove(); }, function() { c.remove(); });
            });
            u.bubbleOn = true;
            await u.bubble.animate([
                { opacity: 0, transform: 'scale(.55)' },
                { opacity: 1, transform: 'scale(1.06)', offset: .6 },
                { opacity: 1, transform: 'scale(1)' }
            ], { duration: 420 * D, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' }).finished.catch(function() {});
        }
        async function acaaSay(side, msg, mood) {
            const u = acaaUI, me = ++u.tk;
            const alive = function() { return me === u.tk; };
            stopSmoke();
            u.head.classList.remove('angry');
            if (u.shown) { await Promise.all([hideBubble(), exitHead()]); if (!alive()) return; }
            u.wrap.className = 'acaa-wrap ' + side + (mood === 'angry' ? ' angry' : '');
            u.wrap.hidden = false;
            u.scene.classList.add('has-head');
            u.head.getAnimations().forEach(function(a) { a.cancel(); });
            u.head.style.opacity = 0;
            u.shown = true;
            await sleep(120 * D);
            if (!alive()) return;
            // bounce in from above; particles when she lands
            const landAt = 0.36, total = 1150 * D;
            u.head.animate([
                { transform: 'translateY(-260px) scale(.9,1.1) rotate(-10deg)', opacity: 0, easing: 'cubic-bezier(.5,0,.9,.55)' },
                { opacity: 1, offset: .1 },
                { transform: 'translateY(0) scale(1,1) rotate(0deg)', opacity: 1, offset: landAt, easing: 'ease-out' },
                { transform: 'translateY(0) scale(1.2,.78)', opacity: 1, offset: .43, easing: 'cubic-bezier(.2,.6,.4,1)' },
                { transform: 'translateY(-48px) scale(.95,1.07)', opacity: 1, offset: .6, easing: 'cubic-bezier(.5,0,.9,.5)' },
                { transform: 'translateY(0) scale(1.1,.9)', opacity: 1, offset: .74, easing: 'cubic-bezier(.2,.6,.4,1)' },
                { transform: 'translateY(-14px) scale(1)', opacity: 1, offset: .86, easing: 'ease-in' },
                { transform: 'none', opacity: 1 }
            ], { duration: total, fill: 'forwards' });
            await sleep(total * landAt);
            if (!alive()) return;
            const r = u.head.getBoundingClientRect();
            sparkle(r.left + r.width / 2, r.bottom - 6, { ring: r.width * .8, n: 12, reach: r.width * .95, min: 12, max: 22 });
            thump();
            await sleep(total * (1 - landAt) + 140 * D);
            if (!alive()) return;
            if (mood === 'angry') { u.head.classList.add('angry'); startSmoke(); }
            await revealBubble(msg, alive);
        }

        async function stagePin() {
            const st = $('st-pin'), calc = $('calc'), disp = $('pin-display'), msg = $('pin-msg');
            const slots = Array.from(disp.children), lives = Array.from($('lives').children);
            let code = '', tries = 3, busy = false;
            show(st);
            fx(calc, [{ opacity: 0, transform: 'scale(.94) translateY(14px)' }, { opacity: 1, transform: 'none' }], 800, 'cubic-bezier(.2,.8,.2,1)');
            setTimeout(function() { acaaSay('right', SAYS[0], 'normal'); }, 700 * D);
            function paint() { slots.forEach(function(s, i) { s.textContent = code[i] || ''; s.classList.toggle('filled', i < code.length); }); }
            return new Promise(function(res) {
                async function submit() {
                    if (busy) return;
                    if (code.length < 6) { disp.classList.remove('shake'); void disp.offsetWidth; disp.classList.add('shake'); msg.textContent = 'PIN-nya 6 angka ya'; return; }
                    busy = true;
                    if (sha256hex(SALT + code) === PIN_HASH) {
                        disp.classList.add('good'); msg.style.color = '#1f8a5e'; msg.textContent = 'Yeay, bener!';
                        acaaUI.tk++; stopSmoke();                 // cancel any pending Acaa steps
                        await sleep(800 * D);
                        document.removeEventListener('keydown', onKey);
                        await fx(st, fadeOut, 450);
                        st.hidden = true;
                        res();
                        return;
                    }
                    tries--;
                    lives[tries].classList.add('lost');
                    disp.classList.remove('shake'); void disp.offsetWidth; disp.classList.add('shake');
                    breakHeart();
                    if (tries <= 0) {
                        msg.textContent = 'Yah, salah terus…';
                        document.removeEventListener('keydown', onKey);
                        await sleep(1500 * D);                    // let the heart finish breaking
                        vanish();
                        return;
                    }
                    msg.textContent = 'Belum pas. Sisa kesempatan: ' + tries;
                    // 1st miss: Acaa hops to the left side; 2nd miss: back to the right, furious
                    if (tries === 2) acaaSay('left', SAYS[1], 'normal');
                    else acaaSay('right', SAYS[2], 'angry');
                    await sleep(600 * D);
                    code = ''; paint(); busy = false;
                }
                function press(k) {
                    if (busy) return;
                    tick();
                    if (k === 'OK') return submit();
                    if (k === 'C') code = '';
                    else if (k === 'B') code = code.slice(0, -1);
                    else if (code.length < 6) code += k;
                    msg.textContent = '';
                    paint();
                }
                function onKey(e) {
                    if (/^[0-9]$/.test(e.key)) press(e.key);
                    else if (e.key === 'Backspace') press('B');
                    else if (e.key === 'Enter') press('OK');
                }
                $('pin-keys').addEventListener('click', function(e) {
                    const b = e.target.closest('.key'); if (b) press(b.dataset.k);
                });
                document.addEventListener('keydown', onKey);
            });
        }

        // ---- stage 5: greeting -> "have a look" -> ENJOY! ----
        const READ = 2500;     // how long each text stays fully visible
        const GAP = 1000;      // pause between the greeting and "have a look"
        const GAP_ENJOY = 1200; // pause between "have a look" and "ENJOY!"
        async function stageGreeting() {
            const st = $('st-hbd'), t1 = $('t-hbd'), t2 = $('t-look'), wrap = $('enjoy-wrap');
            show(st);
            await fx(t1, [{ opacity: 0 }, { opacity: 1 }], 1300, 'ease-out');
            await sleep(READ);
            await fx(t1, fadeOut, 800);
            t1.hidden = true;
            await sleep(GAP);                                     // 1 second before "have a look"
            t2.hidden = false;
            await fx(t2, [
                { opacity: 0, transform: 'scale(.3) translateY(40px)' },
                { opacity: 1, transform: 'scale(1.1) translateY(-6px)', offset: 0.6 },
                { opacity: 1, transform: 'scale(1)' }
            ], 800, 'cubic-bezier(.3,1.2,.5,1)');
            await sleep(READ);
            await fx(t2, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], 320);
            t2.hidden = true;
            await sleep(GAP_ENJOY);                               // 1.2 seconds before "ENJOY!"
            wrap.hidden = false;
            Array.from($('enjoy').children).forEach(function(s, i) { s.style.setProperty('--d', (i * 0.09) + 's'); });
            setTimeout(function() { burst($("enjoy")); }, 700 * D);
            await sleep(2900 * D);
        }

        // ---- into the real website ----
        function enter() {
            document.body.classList.remove('gate-on');
            startPetals();                                       // petals begin here: ENJOY! -> website
            if (fab) fab.hidden = false;
            playSong();                                          // the song starts with the website
            if (window.startEyeGuide) setTimeout(window.startEyeGuide, 1900);
            window.scrollTo(0, 0);
            document.querySelectorAll('.hero-copy, .hero-age').forEach(function(e) {
                e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
            });
            const v = document.querySelector('.hero-video');
            if (v) { try { v.currentTime = 0; const pr = v.play(); if (pr && pr.catch) pr.catch(function() {}); } catch (e) {} }
            if (window.AOS && AOS.refresh) AOS.refresh();
            gate.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }],
                { duration: 900 * D, easing: 'ease-in', fill: 'forwards' }).finished.then(function() { gate.remove(); });
        }

        (async function run() {
            await stageHi();
            await stageDesk();
            await stageName();
            await stageNick();
            await stagePin();
            await stageGreeting();
            enter();
        })().catch(function(err) { console.warn('gate failed, opening site', err); enter(); });
    })();

    // ================= "23 years old": eye-tracking guide -> bounce + glow -> surprise card =================
    (function() {
        const hero = document.querySelector('.hero-section');
        const badge = document.getElementById('age-badge');
        const h1 = document.querySelector('.hero-copy h1');
        const modal = document.getElementById('id-modal');
        if (!hero || !badge || !h1 || !modal) return;
        const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
        const SVGNS = 'http://www.w3.org/2000/svg';
        let overlay = null, cancelled = false, played = false;

        function rel(rect) { const hr = hero.getBoundingClientRect(); return { x: rect.left - hr.left, y: rect.top - hr.top, w: rect.width, h: rect.height }; }
        function fadeAway(el, ms) {
            if (!el) return;
            const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
            a.finished.then(function() { el.remove(); }).catch(function() { el.remove(); });
        }

        const EYE = '<svg viewBox="0 0 32 32" width="30" height="30"><path d="M2 16C6 9 11 6 16 6s10 3 14 10c-4 7-9 10-14 10S6 23 2 16z" fill="#fff" stroke="#2c3e50" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="16" r="6.2" fill="#FF7BA5"/><circle cx="16" cy="16" r="3" fill="#2c3e50"/><circle cx="14.3" cy="14.2" r="1.3" fill="#fff"/></svg>';
        const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1C12.9 7.5 16.5 11.100 23 12 16.500 12.900 12.900 16.500 12 23 11.100 16.500 7.500 12.900 1 12 7.500 11.100 11.100 7.500 12 1z" fill="COLOR" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>';

        function build() {
            overlay = document.createElement('div');
            overlay.className = 'eye-guide';
            hero.appendChild(overlay);

            const t = document.createRange(); t.selectNodeContents(h1);
            const text = rel(t.getBoundingClientRect());
            const bb = rel(badge.getBoundingClientRect());
            const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, r = bb.w / 1.144 / 2;   // the badge is tilted
            const padL = parseFloat(getComputedStyle(hero).paddingLeft) || 20;
            const mx = Math.max(18, Math.min(34, padL * 0.5));
            const P = [
                { x: text.x + text.w * 0.88, y: Math.max(60, text.y - 24) },
                { x: mx, y: Math.max(60, text.y - 24) },
                { x: mx, y: cy },
                { x: cx, y: cy }
            ];
            const E = [P[1], P[2], { x: cx - r - 16, y: cy }];                        // where each line ends

            const svg = document.createElementNS(SVGNS, 'svg');
            svg.setAttribute('class', 'eye-lines');
            overlay.appendChild(svg);
            const segs = E.map(function(end, i) {
                const a = P[i], g = document.createElementNS(SVGNS, 'g'), len = Math.hypot(end.x - a.x, end.y - a.y);
                ['halo', 'core'].forEach(function(cls) {
                    const l = document.createElementNS(SVGNS, 'line');
                    l.setAttribute('class', cls);
                    l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', end.x); l.setAttribute('y2', end.y);
                    l.style.strokeDasharray = len; l.style.strokeDashoffset = len;
                    g.appendChild(l);
                });
                svg.appendChild(g);
                return { g: g, len: len, from: a, to: end };
            });
            const arrow = document.createElementNS(SVGNS, 'path');
            arrow.setAttribute('class', 'arrow');
            arrow.setAttribute('d', 'M0 -9 L16 0 L0 9 Z');
            arrow.setAttribute('transform', 'translate(' + E[2].x + ' ' + E[2].y + ')');
            arrow.style.opacity = 0;
            svg.appendChild(arrow);

            const fixes = P.map(function(p, i) {
                const f = document.createElement('div');
                f.className = 'fix' + (i === 3 ? ' target' : '');
                f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
                if (i === 3) { const d = (r + 14) * 2; f.style.width = d + 'px'; f.style.height = d + 'px'; f.style.margin = (-d / 2) + 'px 0 0 ' + (-d / 2) + 'px'; }
                else f.innerHTML = '<b>' + (i + 1) + '</b>';
                overlay.appendChild(f);
                return f;
            });
            const cursor = document.createElement('div');
            cursor.className = 'eye-cursor';
            cursor.innerHTML = EYE;
            overlay.appendChild(cursor);
            return { P: P, segs: segs, fixes: fixes, cursor: cursor, arrow: arrow, cx: cx, cy: cy, r: r };
        }

        const POP = [
            { opacity: 0, transform: 'scale(.2)' },
            { opacity: 1, transform: 'scale(1.25)', offset: 0.55 },
            { opacity: 1, transform: 'scale(1)' }
        ];
        function popIn(el, ms) { return el.animate(POP, { duration: ms || 520, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' }).finished; }
        function at(p) { return 'translate(' + p.x + 'px,' + p.y + 'px)'; }

        function sparkles(g) {
            const cols = ['#ffffff', '#FFB7C5', '#8CCBF7'];
            for (let i = 0; i < 7; i++) {
                const s = document.createElement('div'), ang = Math.random() * Math.PI * 2, d = g.r + 16 + Math.random() * 30;
                s.className = 'sparkle';
                s.style.left = (g.cx + Math.cos(ang) * d) + 'px'; s.style.top = (g.cy + Math.sin(ang) * d) + 'px';
                s.innerHTML = STAR.replace(/COLOR/g, cols[i % 3]);
                overlay.appendChild(s);
                s.animate([
                    { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                    { opacity: 1, transform: 'scale(1.2) rotate(90deg)', offset: 0.5 },
                    { opacity: 0, transform: 'scale(0) rotate(180deg)' }
                ], { duration: 700, delay: Math.random() * 1200, fill: 'both' });
            }
        }

        function celebrate(g) {
            const base = getComputedStyle(badge).boxShadow;
            badge.classList.add('shine');
            badge.animate([
                { scale: 1, offset: 0, easing: 'ease-out' },
                { scale: 1.36, offset: 0.14, easing: 'ease-in-out' },
                { scale: 0.84, offset: 0.32, easing: 'ease-in-out' },
                { scale: 1.16, offset: 0.5, easing: 'ease-in-out' },
                { scale: 0.96, offset: 0.68, easing: 'ease-in-out' },
                { scale: 1.04, offset: 0.84, easing: 'ease-in-out' },
                { scale: 1, offset: 1 }
            ], { duration: 1100 });
            const glow = 'rgba(255,255,255,1) 0px 0px 0px 7px, rgba(255,205,222,.95) 0px 0px 50px 24px';
            badge.animate([
                { boxShadow: base }, { boxShadow: glow, offset: 0.18 }, { boxShadow: base, offset: 0.4 },
                { boxShadow: glow, offset: 0.6 }, { boxShadow: base, offset: 0.82 }, { boxShadow: glow, offset: 0.92 }, { boxShadow: base }
            ], { duration: 2000, easing: 'ease-in-out' });
            sparkles(g);
            setTimeout(function() { badge.classList.remove('shine'); }, 2100);
        }

        async function play() {
            if (played) return;
            played = true;
            const g = build();
            await sleep(120);
            if (cancelled) return;
            g.cursor.style.transform = at(g.P[0]);
            popIn(g.fixes[0]); popIn(g.cursor, 560);
            for (let i = 0; i < 3; i++) {
                const seg = g.segs[i];
                fixAnim(g.fixes[i]);                                    // the gaze "dwells" here
                await sleep(i === 0 ? 650 : 420);
                if (cancelled) return;
                const ease = 'cubic-bezier(.65,0,.35,1)', ms = 650;
                seg.g.querySelectorAll('line').forEach(function(l) {
                    l.animate([{ strokeDashoffset: seg.len }, { strokeDashoffset: 0 }], { duration: ms, easing: ease, fill: 'forwards' });
                });
                g.cursor.animate([{ transform: at(seg.from) }, { transform: at(seg.to) }], { duration: ms, easing: ease, fill: 'forwards' });
                await sleep(ms);
                if (cancelled) return;
                if (i < 2) popIn(g.fixes[i + 1], 480);
            }
            g.arrow.style.opacity = 1;
            popIn(g.fixes[3], 600);
            await g.cursor.animate([{ transform: at(g.segs[2].to) }, { transform: at({ x: g.cx, y: g.cy }) }], { duration: 260, easing: 'ease-out', fill: 'forwards' }).finished;
            if (cancelled) return;
            g.cursor.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
            celebrate(g);                                               // bounce + shine for 2 seconds
            await sleep(2200);
            if (!cancelled) fadeAway(overlay, 700);                     // then the tracking UI fades out
        }
        function fixAnim(f) {
            f.animate([{ scale: 1 }, { scale: 1.3 }, { scale: 1.12 }], { duration: 600, easing: 'ease-out', fill: 'forwards' });
        }
        window.startEyeGuide = function() { if (!cancelled) play(); };

        // ---------- the surprise card ----------
        const stage = document.getElementById('id-stage'), card = document.getElementById('id-card');
        const closeBtn = document.getElementById('id-close'), hint = document.getElementById('id-hint');
        const backdrop = modal.querySelector('.id-backdrop');
        let closing = false;
        // bounce in: a big, fast first overshoot, then each rebound is smaller and slower
        const BOUNCE_IN = [
            { transform: 'scale(.12) rotate(-10deg)', opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
            { transform: 'scale(1.38) rotate(3deg)', opacity: 1, offset: 0.09, easing: 'ease-in-out' },
            { transform: 'scale(.76) rotate(-2deg)', opacity: 1, offset: 0.23, easing: 'ease-in-out' },
            { transform: 'scale(1.16) rotate(1deg)', offset: 0.41, easing: 'ease-in-out' },
            { transform: 'scale(.92)', offset: 0.61, easing: 'ease-in-out' },
            { transform: 'scale(1.045)', offset: 0.8, easing: 'ease-in-out' },
            { transform: 'scale(1)', opacity: 1, offset: 1 }
        ];
        const BOUNCE_OUT = [
            { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0, easing: 'ease-out' },
            { transform: 'scale(1.15) rotate(-3deg)', opacity: 1, offset: 0.28, easing: 'ease-in-out' },
            { transform: 'scale(.9) rotate(2deg)', opacity: 1, offset: 0.52, easing: 'cubic-bezier(.5,0,.9,.4)' },
            { transform: 'scale(0) rotate(12deg)', opacity: 0, offset: 1 }
        ];
        function openCard() {
            if (!modal.hidden || closing) return;
            cancelled = true;                                           // stop the guide if it is still running
            if (overlay) { fadeAway(overlay, 250); overlay = null; }
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
            card.scrollLeft = 0; hint.classList.remove('gone');
            backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'both' });
            stage.animate(BOUNCE_IN, { duration: calmMotion ? 200 : 1500, fill: 'both' });
            closeBtn.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.35)', offset: 0.6 }, { transform: 'scale(1)' }],
                { duration: 520, delay: calmMotion ? 0 : 950, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'both' });
            closeBtn.focus({ preventScroll: true });
        }
        async function closeCard() {
            if (modal.hidden || closing) return;
            closing = true;
            closeBtn.getAnimations().forEach(function(a) { a.cancel(); });
            closeBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(.65)', offset: 0.4 }, { transform: 'scale(1.2)', offset: 0.7 }, { transform: 'scale(0)' }], { duration: 380, fill: 'forwards' });
            stage.getAnimations().forEach(function(a) { a.cancel(); });
            const out = stage.animate(BOUNCE_OUT, { duration: calmMotion ? 150 : 620, fill: 'forwards' });
            backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: calmMotion ? 150 : 560, delay: calmMotion ? 0 : 120, fill: 'forwards' });
            await out.finished;
            await sleep(120);
            modal.hidden = true;
            [stage, closeBtn, backdrop].forEach(function(el) { el.getAnimations().forEach(function(a) { a.cancel(); }); });
            document.body.style.overflow = '';
            closing = false;
            badge.focus({ preventScroll: true });
        }
        badge.addEventListener('click', openCard);
        closeBtn.addEventListener('click', closeCard);
        backdrop.addEventListener('click', closeCard);
        card.addEventListener('scroll', function() { if (card.scrollLeft > 8) hint.classList.add('gone'); }, { passive: true });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeCard(); });

        if (!document.getElementById('gate')) setTimeout(function() { window.startEyeGuide(); }, 1900);   // no gate -> start on load
    })();

    // ================= Letter mini game =================
    // pink letter -> flies to the front, opens -> rules paper -> "yes aku mengerti"
    // -> 5 minutes of voice recording (saved to the Videos folder) with a countdown -> back to the site
    (function() {
        const btn = document.getElementById('letter-btn');
        const game = document.getElementById('game');
        if (!btn || !game) return;
        const DEMO = window.__GAME_DEMO === true || /[?&]demo(\b|=)/.test(location.search);   // demo: no microphone, short timer
        const SECONDS = window.__GAME_SECONDS || (DEMO ? 25 : 300);
        const $ = function(id) { return document.getElementById(id); };
        const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
        const D = calmMotion ? 0.25 : 1;
        const src = btn.querySelector('.env');
        const dim = game.querySelector('.game-dim'), flyLayer = $('fly-layer'), rules = $('rules');
        const paper = rules.querySelector('.rules-paper');
        const rec = $('rec'), okBtn = $('rules-ok'), errEl = $('rules-err'), toast = $('rec-toast');
        const guard = $('guard'), guardGo = $('guard-go');
        let busy = false;

        // ---------------- 1) the letter flies, opens, and the paper floats to the front ----------------
        function puffs(rect) {
            if (calmMotion) return;
            const cols = ['#ffffff', '#FFD3E0', '#C9E6FB', '#FFB7C5'];
            for (let i = 0; i < 18; i++) {
                const p = document.createElement('i'), s = 10 + Math.random() * 22;
                p.className = 'puff';
                p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.6) + 'px;top:' + (rect.bottom - 6) + 'px;background:' + cols[i % 4];
                flyLayer.appendChild(p);
                const dx = (Math.random() - 0.5) * 130, dy = 40 + Math.random() * 180;
                p.animate([
                    { transform: 'translate(0,0) scale(.4)', opacity: 0.95 },
                    { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.6)', opacity: 0 }
                ], { duration: 600 + Math.random() * 500, delay: 180 + Math.random() * 380, easing: 'ease-out', fill: 'both' })
                    .finished.then(function() { p.remove(); });
            }
        }

        async function openLetter() {
            if (busy) return;
            busy = true;
            const rect = src.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            game.hidden = false; game.classList.remove('recording');
            rules.hidden = true; rec.hidden = true; toast.hidden = true;
            document.body.style.overflow = 'hidden';
            dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 * D, fill: 'forwards' });

            const fly = document.createElement('div');
            fly.className = 'fly';
            fly.style.cssText = 'left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px';
            const clone = src.cloneNode(true);
            clone.style.width = rect.width + 'px'; clone.style.height = rect.height + 'px';
            fly.appendChild(clone); flyLayer.appendChild(fly);
            btn.style.visibility = 'hidden';

            const S = Math.min((vw * 0.74) / rect.width, 2.7);
            const tx = vw / 2 - (rect.left + rect.width / 2), ty = vh * 0.46 - (rect.top + rect.height / 2);
            puffs(rect);
            // rocket launch: squash, shoot forward, overshoot toward the viewer, bounce and settle
            await fly.animate([
                { transform: 'translate(0,0) scale(1,1) rotate(0deg)', offset: 0, easing: 'ease-out' },
                { transform: 'translate(0,12px) scale(1.12,.82) rotate(0deg)', offset: 0.13, easing: 'cubic-bezier(.5,0,1,.6)' },
                { transform: 'translate(' + (tx * 0.5) + 'px,' + (ty * 0.5 - 150) + 'px) scale(' + (S * 0.62) + ',' + (S * 0.78) + ') rotate(-9deg)', offset: 0.36, easing: 'cubic-bezier(.2,.7,.4,1)' },
                { transform: 'translate(' + tx + 'px,' + (ty - 46) + 'px) scale(' + (S * 1.16) + ') rotate(6deg)', offset: 0.6, easing: 'ease-in-out' },
                { transform: 'translate(' + tx + 'px,' + (ty + 16) + 'px) scale(' + (S * 0.94) + ') rotate(-3deg)', offset: 0.8, easing: 'ease-in-out' },
                { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(' + S + ') rotate(0deg)', offset: 1 }
            ], { duration: 1350 * D, fill: 'forwards' }).finished;

            // open the flap, the paper slides up
            const flap = clone.querySelector('.e-flap'), flapWrap = clone.querySelector('.e-flapwrap'), sheet = clone.querySelector('.e-sheet');
            setTimeout(function() { flapWrap.style.zIndex = 1; }, 360 * D);
            flap.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(180deg)' }], { duration: 720 * D, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' });
            await sleep(220 * D);
            sheet.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-64%)', offset: 0.7 }, { transform: 'translateY(-58%)' }], { duration: 760 * D, easing: 'ease-out', fill: 'forwards' });
            await sleep(900 * D);

            // measure where the paper is now and where the real rules paper will sit (FLIP)
            rules.hidden = false; paper.style.opacity = 0;
            const R = paper.getBoundingClientRect(), P = sheet.getBoundingClientRect();
            const s0 = P.width / R.width;
            const dx = (P.left + P.width / 2) - (R.left + R.width / 2), dy = (P.top + P.height / 2) - (R.top + R.height / 2);

            // the outer envelope is thrown out of the screen
            const shell = clone.querySelectorAll('.e-back, .e-front, .e-flapwrap, .e-extras');
            const outX = -(vw * 0.95) / S - 260, outY = (vh * 0.9) / S + 260;
            shell.forEach(function(el, i) {
                el.animate([
                    { transform: 'translate(0,0) rotate(0deg)', offset: 0 },
                    { transform: 'translate(10px,26px) rotate(5deg)', offset: 0.16, easing: 'cubic-bezier(.55,0,.9,.5)' },
                    { transform: 'translate(' + outX + 'px,' + outY + 'px) rotate(-540deg)', offset: 1 }
                ], { duration: 900 * D, delay: i * 25 * D, fill: 'forwards' });
            });
            sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280 * D, delay: 140 * D, fill: 'forwards' });

            // the paper glides forward and floats to the centre of the screen
            const pAnim = paper.animate([
                { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s0 + ') rotate(-4deg)', opacity: 0, offset: 0, easing: 'ease-out' },
                { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s0 + ') rotate(-4deg)', opacity: 1, offset: 0.1, easing: 'ease-in-out' },
                { transform: 'translate(' + (dx * 0.45 - vw * 0.06) + 'px,' + (dy * 0.5 - vh * 0.12) + 'px) scale(' + (s0 + (1 - s0) * 0.36) + ') rotate(-8deg)', opacity: 1, offset: 0.38, easing: 'ease-in-out' },
                { transform: 'translate(' + (vw * 0.05) + 'px,' + (-vh * 0.04) + 'px) scale(' + (s0 + (1 - s0) * 0.72) + ') rotate(5deg)', opacity: 1, offset: 0.66, easing: 'ease-in-out' },
                { transform: 'translate(0,0) scale(1.05) rotate(-1.5deg)', opacity: 1, offset: 0.86, easing: 'ease-in-out' },
                { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1, offset: 1 }
            ], { duration: 1650 * D, fill: 'forwards' });
            await pAnim.finished;
            paper.style.opacity = 1;
            pAnim.cancel();
            fly.remove();
            okBtn.focus({ preventScroll: true });
            busy = false;
        }

        // ---------------- 2) "yes aku mengerti": permissions, then the 5-minute recording ----------------
        function pickMime() {
            const list = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
            for (let i = 0; i < list.length; i++) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {} }
            return '';
        }
        function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }

        okBtn.addEventListener('click', async function() {
            if (busy) return;
            busy = true; okBtn.disabled = true; errEl.hidden = true;
            getAC();                                                   // makes sure the alarm can sound later
            const mime = pickMime(), ext = /mp4/.test(mime) ? 'mp4' : 'webm';
            let handle = null, stream = null;
            if (!DEMO) {
                try {
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
                    // 1) a Save dialog that already points at the Videos folder (Chrome / Edge). Must be the first thing after the click.
                    if (window.showSaveFilePicker) {
                        try {
                            handle = await window.showSaveFilePicker({
                                suggestedName: 'Pesan-Terima-Kasih-Acaa-untuk-Dduy.' + ext,
                                startIn: 'videos',
                                types: [{ description: 'Rekaman suara', accept: ext === 'mp4' ? { 'audio/mp4': ['.mp4', '.m4a'] } : { 'audio/webm': ['.webm'] } }]
                            });
                        } catch (e) { handle = null; }                 // cancelled / not allowed -> a normal download at the end
                    }
                    // 2) the browser's own microphone permission
                    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                } catch (e) {
                    if (handle && handle.remove) { try { await handle.remove(); } catch (_) {} }
                    showError(window.MediaRecorder ? 'Mic-nya belum diizinkan. Klik "Izinkan" di browser, lalu tekan tombol ini lagi ya.' : 'Browser ini belum bisa merekam suara. Coba buka pakai Chrome atau Edge di laptop ya.');
                    okBtn.disabled = false; busy = false;
                    return;
                }
            }
            await beginSession(handle, stream, mime, ext);
        });

        // ---------------- 3) the leave-the-page guard ----------------
        let alarmBuf = null, alarmSrc = null, armed = false, away = false;
        function makeAlarm(ctx) {
            if (alarmBuf && alarmBuf.sampleRate === ctx.sampleRate) return alarmBuf;
            const sr = ctx.sampleRate, len = Math.floor(sr * 1.2), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
            let ph = 0;
            for (let i = 0; i < len; i++) {                           // two-tone siren, 4 x 0.3s = a seamless 1.2s loop
                const t = i / sr, seg = t % 0.3, f = (Math.floor(t / 0.3) % 2) ? 660 : 880;
                ph += 2 * Math.PI * f / sr;
                const env = Math.min(1, seg * 70) * Math.min(1, (0.3 - seg) * 70);
                d[i] = (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph)) * 0.42 * env;
            }
            alarmBuf = buf; return buf;
        }
        function startAlarm() {
            const ctx = getAC(); if (!ctx || alarmSrc) return;
            alarmSrc = ctx.createBufferSource();
            alarmSrc.buffer = makeAlarm(ctx); alarmSrc.loop = true;
            const g = ctx.createGain(); g.gain.value = 0.3;
            alarmSrc.connect(g); g.connect(ctx.destination);
            alarmSrc.start();
            alarmSrc._gain = g;
        }
        function stopAlarm() {
            if (!alarmSrc) return;
            try { alarmSrc.stop(); } catch (e) {}
            try { alarmSrc.disconnect(); alarmSrc._gain.disconnect(); } catch (e) {}
            alarmSrc = null;
        }
        function showGuard(withButton) { guard.hidden = false; guardGo.hidden = !withButton; }
        function hideGuard() { guard.hidden = true; }
        function onMouseLeave() { if (armed && !away) showGuard(false); }       // pointer left the page (other tab / app)
        function onMouseEnter() { if (armed && !away) hideGuard(); }
        function onAway() { if (!armed) return; away = true; showGuard(true); startAlarm(); }   // left the tab or the window
        function onVisibility() { if (document.hidden) onAway(); }
        function onBeforeUnload(e) { e.preventDefault(); e.returnValue = ''; return ''; }
        guardGo.addEventListener('click', function() { stopAlarm(); away = false; hideGuard(); });
        function arm() {
            armed = true; away = false;
            window.addEventListener('blur', onAway);
            document.addEventListener('visibilitychange', onVisibility);
            document.documentElement.addEventListener('mouseleave', onMouseLeave);
            document.documentElement.addEventListener('mouseenter', onMouseEnter);
            window.addEventListener('beforeunload', onBeforeUnload);
        }
        function disarm() {
            armed = false; away = false;
            window.removeEventListener('blur', onAway);
            document.removeEventListener('visibilitychange', onVisibility);
            document.documentElement.removeEventListener('mouseleave', onMouseLeave);
            document.documentElement.removeEventListener('mouseenter', onMouseEnter);
            window.removeEventListener('beforeunload', onBeforeUnload);
            stopAlarm(); hideGuard();
        }

        // ---------------- 4) the recording session ----------------
        const timeEl = $('rec-time'), barEl = $('rec-bar');
        function fmt(s) { const m = Math.floor(s / 60), r = s % 60; return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0'); }
        function say(msg, ms) {
            toast.textContent = msg; toast.hidden = false;
            toast.animate([{ opacity: 0, transform: 'translate(-50%,24px) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1.05)', offset: 0.6 }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { duration: 520, easing: 'ease-out' });
            setTimeout(function() { toast.hidden = true; }, ms || 6500);
        }

        async function beginSession(handle, stream, mime, ext) {
            let writable = null, chain = Promise.resolve(), writeFailed = false, recorder = null;
            const chunks = [];
            if (stream) {
                try { if (handle) writable = await handle.createWritable(); } catch (e) { writable = null; }
                recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 96000 } : undefined);
                recorder.ondataavailable = function(e) {
                    if (!e.data || !e.data.size) return;
                    chunks.push(e.data);
                    if (writable) chain = chain.then(function() { return writable.write(e.data); }).catch(function() { writeFailed = true; });
                };
            }
            holdSong();

            // rules paper bounces away, the recording screen pops in
            await paper.animate([{ transform: 'scale(1) rotate(0deg)', opacity: 1 }, { transform: 'scale(1.08) rotate(-2deg)', opacity: 1, offset: 0.3 }, { transform: 'scale(0) rotate(8deg)', opacity: 0 }], { duration: 480 * D, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' }).finished;
            rules.hidden = true;
            game.classList.add('recording');
            rec.hidden = false;
            timeEl.textContent = fmt(SECONDS); timeEl.style.setProperty('--p', 0); barEl.style.width = '100%';
            rec.animate([
                { transform: 'scale(.2)', opacity: 0, offset: 0, easing: 'ease-out' },
                { transform: 'scale(1.2)', opacity: 1, offset: 0.2, easing: 'ease-in-out' },
                { transform: 'scale(.9)', offset: 0.42, easing: 'ease-in-out' },
                { transform: 'scale(1.05)', offset: 0.64, easing: 'ease-in-out' },
                { transform: 'scale(1)', opacity: 1, offset: 1 }
            ], { duration: 1100 * D, fill: 'both' });
            await sleep(900);
            arm();                                                    // only now: the Save / microphone prompts are over

            if (recorder) recorder.start(1000);                       // the recording and the countdown start together
            const t0 = performance.now();
            const stopBtn = $('rec-stop');
            stopBtn.disabled = false;
            stopBtn.animate([{ transform: 'translateY(-70px) scale(.5)', opacity: 0 }, { transform: 'translateY(8px) scale(1.08)', opacity: 1, offset: 0.65 }, { transform: 'none', opacity: 1 }],
                { duration: 700 * D, delay: 700 * D, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
            await new Promise(function(done) {
                let finished = false;
                function finish() { if (finished) return; finished = true; clearInterval(iv); stopBtn.onclick = null; done(); }
                const iv = setInterval(function() {
                    const el = (performance.now() - t0) / 1000, left = Math.max(0, SECONDS - el), p = Math.min(1, el / SECONDS);
                    timeEl.textContent = fmt(Math.ceil(left));
                    timeEl.style.setProperty('--p', p.toFixed(4));
                    barEl.style.width = ((1 - p) * 100).toFixed(2) + '%';
                    if (left <= 0) finish();
                }, 200);
                stopBtn.onclick = function() { stopBtn.disabled = true; finish(); };   // "segini aja yaww": end early
            });

            // time is up (or ended early): stop, save, bounce back to the website
            disarm();
            let where = 'demo';
            if (recorder) {
                await new Promise(function(res) { recorder.onstop = res; try { recorder.stop(); } catch (e) { res(); } });
                stream.getTracks().forEach(function(t) { t.stop(); });
                await chain;
                where = 'download';
                if (writable && !writeFailed) { try { await writable.close(); where = 'videos'; } catch (e) { writeFailed = true; } }
                if (where !== 'videos') {
                    const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'Pesan-Terima-Kasih-Acaa-untuk-Dduy.' + ext;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(function() { URL.revokeObjectURL(a.href); }, 60000);
                }
            }
            await bounceBack();
            if (where === 'videos') say('Rekaman tersimpan: ' + (handle && handle.name ? handle.name : 'Pesan-Terima-Kasih') + ' (cek folder Videos)');
            else if (where === 'download') say('Rekaman terunduh ke folder Downloads');
            else say('Mode demo: tidak ada suara yang direkam');
            releaseSong();
        }

        async function bounceBack() {
            await rec.animate([
                { transform: 'scale(1)', opacity: 1, offset: 0, easing: 'ease-out' },
                { transform: 'scale(1.14) rotate(-2deg)', opacity: 1, offset: 0.3, easing: 'ease-in-out' },
                { transform: 'scale(.88) rotate(2deg)', opacity: 1, offset: 0.55, easing: 'cubic-bezier(.5,0,.9,.4)' },
                { transform: 'scale(0) rotate(10deg)', opacity: 0, offset: 1 }
            ], { duration: 650 * D, fill: 'forwards' }).finished;
            game.classList.remove('recording');
            await dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450 * D, fill: 'forwards' }).finished;
            rec.hidden = true; game.hidden = true;
            [dim, rec, paper].forEach(function(el) { el.getAnimations().forEach(function(a) { a.cancel(); }); });
            paper.style.opacity = '';
            document.body.style.overflow = '';
            btn.style.visibility = 'visible';
            okBtn.disabled = false; busy = false;
            btn.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.2)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 600, easing: 'cubic-bezier(.3,1.3,.5,1)' });
        }

        btn.addEventListener('click', openLetter);
    })();
});
