class OctaveNoise {
    constructor(seed, numOctaves) {
        this.seed = seed;
        this.numOctaves = numOctaves;
        this.octaves = new Array(numOctaves);

        for (let i = 0; i < numOctaves; i++) {
            this.octaves[i] = openSimplexNoise(seed);
        }
    }

    compute(x, y) {
        let amplitude = 1;
        let frequency = 1;
        let sum = 0;

        for (let i = 0; i < this.numOctaves; i++) {
            sum += this.octaves[i].noise2D(x * frequency, y * frequency) * amplitude;
            amplitude *= 2;
            frequency *= 0.5;
        }

        return sum;
    }
}

function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
}

function hslToRgb(h, s, l) {
    let r, g, b;

    if (s == 0) {
        r = g = b = 1;
    } else {
        let hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function rgbFloatToInt(r, g, b) {
    let ir = r * 255;
    let ig = g * 255;
    let ib = b * 255;

    return (r << 16) | (g << 8) | b;
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}