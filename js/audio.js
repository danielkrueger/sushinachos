// Tiny generated sound effects, keeping the games self-contained and fast to load.
window.ChefJohnAudio = (() => {
    let audioContext = null;
    let master = null;

    function ensureContext() {
        if (!audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return null;
            audioContext = new AudioContext();
            master = audioContext.createGain();
            master.gain.value = 0.16;
            master.connect(audioContext.destination);
        }
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
        return audioContext;
    }

    function tone(frequency, duration, type = 'sine', volume = 0.25, offset = 0, endFrequency = frequency) {
        const ctx = ensureContext();
        if (!ctx || !master) return;
        const start = ctx.currentTime + offset;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain).connect(master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    function vibrate(pattern) {
        try {
            if (navigator.vibrate) navigator.vibrate(pattern);
        } catch (_) { /* vibration is optional */ }
    }

    function play(name) {
        try {
            if (name === 'coin') {
                tone(660, .09, 'sine', .28);
                tone(990, .13, 'sine', .22, .07);
            } else if (name === 'slice') {
                tone(520, .08, 'triangle', .2, 0, 880);
            } else if (name === 'jump') {
                tone(260, .16, 'square', .16, 0, 620);
            } else if (name === 'turbo') {
                tone(180, .3, 'sawtooth', .22, 0, 720);
                tone(360, .24, 'square', .1, .05, 980);
            } else if (name === 'damage') {
                tone(150, .16, 'sawtooth', .26, 0, 75);
                vibrate([28, 18, 36]);
            } else if (name === 'gameover') {
                tone(240, .24, 'sine', .3, 0, 120);
                tone(120, .34, 'sine', .22, .2, 55);
                vibrate([55, 25, 75]);
            }
        } catch (_) { /* audio is optional */ }
    }

    return { play, unlock: ensureContext };
})();
