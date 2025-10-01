export class AudioHandler {
    /**
     * Standalone audio player + analyzer.
     * Creates its own <audio> element; you can access it via `instance.audioEl`
     * and append it to the DOM if you want native controls.
     *
     * @param {Object} [opts]
     * @param {HTMLCanvasElement} [opts.waveCanvas]  - Optional canvas for waveform.
     * @param {HTMLCanvasElement} [opts.freqCanvas]  - Optional canvas for spectrum.
     * @param {number} [opts.fftSize=2048]          - Power of two (32..32768).
     * @param {number} [opts.smoothing=0.8]         - 0..0.99 analyser smoothing.
     * @param {number} [opts.gain=1]                - Output gain multiplier.
     */
    constructor(opts = {}) {
        // Internal <audio> element (not attached to DOM by default)
        this._audioEl = document.createElement('audio');
        this._audioEl.crossOrigin = 'anonymous';
        this._audioEl.preload = 'auto'; // change to 'none' if you prefer
        // Expose read-only handle
        Object.defineProperty(this, 'audioEl', { get: () => this._audioEl });

        // Optional canvases
        this.waveCanvas = opts.waveCanvas || null;
        this.freqCanvas = opts.freqCanvas || null;

        // Audio graph
        this._ctx = null;
        this._analyser = null;
        this._gainNode = null;
        this._srcNode = null;

        // Buffers + loop state
        this._freqData = null;
        this._timeData = null;
        this._raf = 0;
        this._running = false;
        this._lastStats = { rms: 0, peakDb: -Infinity, dominantHz: 0 };

        // Parameters
        this._fftSize = opts.fftSize || 2048;
        this._smoothing = opts.smoothing ?? 0.8;
        this._gain = opts.gain ?? 1;

        // Bindings
        this._onResize = this._onResize.bind(this);

        // Prepare canvases (handle HiDPI)
        if (this.waveCanvas || this.freqCanvas) {
            this._onResize();
            window.addEventListener('resize', this._onResize);
        }

        // Keep RAF loop in sync with element state
        this._audioEl.addEventListener('play', () => {
            if (!this._running) this._tick();
        });
        this._audioEl.addEventListener('pause', () => {
            cancelAnimationFrame(this._raf);
            this._running = false;
        });
        this._audioEl.addEventListener('ended', () => {
            cancelAnimationFrame(this._raf);
            this._running = false;
        });
    }

    /** Load an audio URL (server must allow CORS if different origin). */
    async loadUrl(url) {
        this._audioEl.src = url;
        this._audioEl.load();
    }

    /** Load from a File/Blob (e.g., from an <input type="file"> or drag-drop). */
    async loadFile(fileOrBlob) {
        const url = URL.createObjectURL(fileOrBlob);
        await this.loadUrl(url);
    }

    /** Start/resume playback and begin real-time analysis. */
    async play() {
        this._ensureGraph();
        await this._audioEl.play();
        this._tick();
    }

    /** Pause playback (analysis loop auto-stops). */
    pause() {
        this._audioEl.pause();
    }

    /** Update FFT size (power of two between 32 and 32768). */
    setFFTSize(n) {
        this._ensureGraph();
        const size = parseInt(n, 10);
        if (![32,64,128,256,512,1024,2048,4096,8192,16384,32768].includes(size)) {
            throw new Error("fftSize must be a power of two between 32 and 32768");
        }
        this._analyser.fftSize = size;
        this._fftSize = size;
        this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
        this._timeData = new Uint8Array(this._analyser.fftSize);
    }

    /** Update analyser smoothing (0..0.99). */
    setSmoothing(v) {
        this._ensureGraph();
        this._smoothing = Math.max(0, Math.min(0.99, Number(v)));
        this._analyser.smoothingTimeConstant = this._smoothing;
    }

    /** Update output gain (linear multiplier, >= 0). */
    setGain(v) {
        this._ensureGraph();
        this._gain = Math.max(0, Number(v));
        this._gainNode.gain.value = this._gain;
    }

    /** Swap or attach canvases later (optional). */
    setCanvases({ waveCanvas = null, freqCanvas = null } = {}) {
        this.waveCanvas = waveCanvas;
        this.freqCanvas = freqCanvas;
        if (waveCanvas || freqCanvas) {
            this._onResize();
            window.addEventListener('resize', this._onResize);
        } else {
            window.removeEventListener('resize', this._onResize);
        }
    }

    /** Get latest computed stats. */
    getStats() {
        return { ...this._lastStats };
    }

    /** Clean up audio graph and listeners. */
    async destroy() {
        cancelAnimationFrame(this._raf);
        this._running = false;
        window.removeEventListener('resize', this._onResize);
        try { this._srcNode && this._srcNode.disconnect(); } catch(e){}
        try { this._analyser && this._analyser.disconnect(); } catch(e){}
        try { this._gainNode && this._gainNode.disconnect(); } catch(e){}
        if (this._ctx && this._ctx.state !== 'closed') await this._ctx.close();
    }

    /* ------------------ Internal ------------------ */

    _ensureGraph() {
        if (!this._ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            this._ctx = new AC();

            this._analyser = this._ctx.createAnalyser();
            this._analyser.fftSize = this._fftSize;
            this._analyser.smoothingTimeConstant = this._smoothing;

            this._gainNode = this._ctx.createGain();
            this._gainNode.gain.value = this._gain;

            this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
            this._timeData = new Uint8Array(this._analyser.fftSize);

            // Build graph: <audio> -> analyser -> gain -> destination
            this._srcNode = this._ctx.createMediaElementSource(this._audioEl);
            this._srcNode.connect(this._analyser);
            this._analyser.connect(this._gainNode).connect(this._ctx.destination);
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
    }

    _onResize() {
        const scale = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const fix = (c) => {
            if (!c) return;
            const dpr = scale();
            const rect = c.getBoundingClientRect();
            c.width = Math.floor(rect.width * dpr);
            c.height = Math.floor(rect.height * dpr);
            const ctx = c.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        fix(this.waveCanvas);
        fix(this.freqCanvas);
    }

    _tick() {
        if (!this._analyser) return;
        this._running = true;

        this._analyser.getByteTimeDomainData(this._timeData);
        this._analyser.getByteFrequencyData(this._freqData);

        this._drawWave(this._timeData);
        this._drawFreq(this._freqData);
        this._updateStats(this._timeData, this._freqData);

        this._raf = requestAnimationFrame(() => this._tick());
    }

    _drawWave(data) {
        const c = this.waveCanvas; if (!c) return;
        const ctx = c.getContext('2d');
        const w = c.clientWidth, h = c.clientHeight;
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle = 'rgba(34,211,238,0.1)';
        ctx.fillRect(0,0,w,h);
        ctx.beginPath();
        const step = Math.max(1, Math.floor(data.length / Math.max(1, w)));
        for (let x=0,i=0;x<w;x++,i+=step){
            const v = data[i]/255; const y = (1 - v) * h;
            if (x===0) ctx.moveTo(0,y); else ctx.lineTo(x,y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(34,211,238,0.9)';
        ctx.stroke();
    }

    _drawFreq(data) {
        const c = this.freqCanvas; if (!c) return;
        const ctx = c.getContext('2d');
        const w = c.clientWidth, h = c.clientHeight;
        ctx.clearRect(0,0,w,h);
        const binW = Math.max(1, w / data.length);
        for (let i=0;i<data.length;i++){
            const mag = data[i];
            const barH = (mag/255) * h;
            ctx.fillStyle = `rgba(34,211,238,${0.15 + 0.85*(mag/255)})`;
            ctx.fillRect(i*binW, h - barH, binW, barH);
        }
    }

    _updateStats(timeBytes, freqBytes) {
        let sumSq=0, peak=0;
        for (let i=0;i<timeBytes.length;i++){
            const s = (timeBytes[i]-128)/128;
            sumSq += s*s; const a = Math.abs(s); if (a>peak) peak=a;
        }
        const rms = Math.sqrt(sumSq/timeBytes.length);
        const peakDb = 20*Math.log10(Math.max(peak, 1e-8));

        let maxMag=-1, maxIdx=0;
        for (let i=1;i<freqBytes.length;i++){ if (freqBytes[i]>maxMag){ maxMag=freqBytes[i]; maxIdx=i; } }
        const nyquist = this._ctx ? this._ctx.sampleRate/2 : 22050;
        const binHz = nyquist / freqBytes.length;
        const dom = maxIdx * binHz;

        this._lastStats = { rms, peakDb, dominantHz: dom };
    }
}
