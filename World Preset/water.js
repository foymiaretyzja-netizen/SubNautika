// SubNautika World Preset: Water
// Title-screen ocean:
// - broad, natural-looking waves
// - strong but soft sun reflection
// - Fresnel-style sky reflection
// - procedural Simplex/Perlin-style whitecaps
// - snow-like foam concentrated on wave crests

window.SubNautikaWater = (() => {
    let simplex;

    function makeFoamTexture() {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;

        const ctx = canvas.getContext("2d");
        const image = ctx.createImageData(size, size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const nx = x / size;
                const ny = y / size;

                const broad = simplex.noise2D(nx * 3.2, ny * 3.2);
                const medium = simplex.noise2D(nx * 7.5 + 17, ny * 7.5 + 17) * 0.5;
                const fine = simplex.noise2D(nx * 18.0 + 73, ny * 18.0 + 73) * 0.18;

                const n = broad + medium + fine;
                const foam = Math.max(0, Math.min(1, (n + 0.03) * 0.62));

                const i = (y * size + x) * 4;
                const value = Math.floor(foam * 255);

                image.data[i] = value;
                image.data[i + 1] = value;
                image.data[i + 2] = value;
                image.data[i + 3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(8, 8);
        texture.needsUpdate = true;

        return texture;
    }

    function init(scene) {
        simplex = new SimplexNoise();

        // More surface detail than the original while keeping the browser load reasonable.
        const geometry = new THREE.PlaneGeometry(3000, 3000, 190, 190);
        geometry.rotateX(-Math.PI / 2);

        const foamTexture = makeFoamTexture();

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: true,
            uniforms: {
                uTime: { value: 0 },
                uFoam: { value: foamTexture },
                uSunDirection: {
                    value: new THREE.Vector3(-0.65, 0.72, 0.22).normalize()
                }
            },

            vertexShader: `
                uniform float uTime;

                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                varying vec2 vUv;
                varying float vHeight;
                varying float vSlope;

                float wave(vec2 p, float t) {
                    float h = 0.0;

                    // Long rolling swells.
                    h += sin(p.x * 0.0028 + t * 0.34) * 9.5;
                    h += cos(p.y * 0.00235 - t * 0.27) * 7.0;

                    // Strong cross-seas create irregular crests.
                    h += sin((p.x + p.y) * 0.0068 + t * 0.50) * 4.0;
                    h += cos((p.x - p.y) * 0.0105 - t * 0.43) * 2.8;

                    // Choppier harmonics sharpen the tops instead of making perfect sine hills.
                    h += sin(p.x * 0.014 + t * 0.82) * 1.15;
                    h += sin(p.y * 0.019 - t * 0.91) * 0.85;
                    h += sin((p.x * 0.018) + (p.y * 0.012) + t * 1.08) * 0.65;

                    // Tiny ripples.
                    h += sin(p.x * 0.043 + p.y * 0.027 + t * 1.45) * 0.28;

                    return h;
                }

                vec2 derivative(vec2 p, float t) {
                    float dx = 0.0;
                    float dy = 0.0;

                    dx += cos(p.x * 0.0028 + t * 0.34) * 9.5 * 0.0028;
                    dy += -sin(p.y * 0.00235 - t * 0.27) * 7.0 * 0.00235;

                    float a = (p.x + p.y) * 0.0068 + t * 0.50;
                    dx += cos(a) * 4.0 * 0.0068;
                    dy += cos(a) * 4.0 * 0.0068;

                    float b = (p.x - p.y) * 0.0105 - t * 0.43;
                    dx += -sin(b) * 2.8 * 0.0105;
                    dy += sin(b) * 2.8 * 0.0105;

                    float c = p.x * 0.014 + t * 0.82;
                    dx += cos(c) * 1.15 * 0.014;

                    float d = p.y * 0.019 - t * 0.91;
                    dy += -sin(d) * 0.85 * 0.019;

                    float e = p.x * 0.018 + p.y * 0.012 + t * 1.08;
                    dx += cos(e) * 0.65 * 0.018;
                    dy += cos(e) * 0.65 * 0.012;

                    float f = p.x * 0.043 + p.y * 0.027 + t * 1.45;
                    dx += cos(f) * 0.28 * 0.043;
                    dy += cos(f) * 0.28 * 0.027;

                    return vec2(dx, dy);
                }

                void main() {
                    vUv = uv;

                    vec3 p = position;
                    float h = wave(p.xz, uTime);
                    vec2 d = derivative(p.xz, uTime);

                    p.y += h;

                    vec3 localNormal = normalize(vec3(-d.x, 1.0, -d.y));

                    vec4 world = modelMatrix * vec4(p, 1.0);

                    vWorldPosition = world.xyz;
                    vNormal = normalize(normalMatrix * localNormal);
                    vHeight = h;
                    vSlope = length(d);

                    gl_Position = projectionMatrix * viewMatrix * world;
                }
            `,

            fragmentShader: `
                uniform float uTime;
                uniform sampler2D uFoam;
                uniform vec3 uSunDirection;

                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                varying vec2 vUv;
                varying float vHeight;
                varying float vSlope;

                vec3 skyColor(vec3 dir) {
                    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

                    vec3 horizon = vec3(0.72, 0.82, 0.88);
                    vec3 middle = vec3(0.32, 0.52, 0.68);
                    vec3 upper = vec3(0.12, 0.27, 0.43);

                    vec3 sky = mix(horizon, middle, smoothstep(0.12, 0.60, h));
                    sky = mix(sky, upper, smoothstep(0.60, 1.0, h));

                    return sky;
                }

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(cameraPosition - vWorldPosition);
                    vec3 L = normalize(uSunDirection);

                    float facing = max(dot(N, V), 0.0);

                    // This is the part that should make the water stop looking dead.
                    float fresnel = 0.035 + pow(1.0 - facing, 3.6) * 0.82;

                    vec3 deep = vec3(0.004, 0.045, 0.078);
                    vec3 ocean = vec3(0.012, 0.13, 0.20);

                    float heightTint = smoothstep(-11.0, 11.0, vHeight);
                    vec3 base = mix(deep, ocean, heightTint * 0.42);

                    // Fake reflected sky, but shaped by the actual wave normal.
                    vec3 reflectionDirection = reflect(-V, N);
                    vec3 reflectedSky = skyColor(reflectionDirection);

                    base = mix(base, reflectedSky, fresnel * 0.52);

                    // Horizon glow.
                    base += vec3(0.02, 0.09, 0.12) * pow(1.0 - facing, 2.0) * 0.30;

                    // Broad sun reflection + tight glints.
                    vec3 H = normalize(V + L);

                    float broad = pow(max(dot(N, H), 0.0), 18.0);
                    float sparkle = pow(max(dot(N, H), 0.0), 120.0);

                    base += vec3(0.22, 0.50, 0.58) * broad * 0.15;
                    base += vec3(0.78, 0.94, 0.96) * sparkle * 0.72;

                    // ----------------------------------------------------
                    // Snowy foam / whitecaps.
                    // Wave crests + slope decide where foam is allowed.
                    // Simplex texture then breaks it into natural patches.
                    // ----------------------------------------------------
                    vec2 foamUv = vUv * 8.0;
                    foamUv += vec2(uTime * 0.0017, -uTime * 0.0009);

                    float noise = texture2D(uFoam, foamUv).r;

                    float crest = smoothstep(3.0, 8.5, vHeight);
                    float slope = smoothstep(0.07, 0.22, vSlope);

                    float foamMask = crest * slope;
                    foamMask *= smoothstep(0.35, 0.66, noise);

                    // Small fragmented edge foam.
                    float breakup = texture2D(
                        uFoam,
                        foamUv * 1.75 + vec2(-uTime * 0.0008, uTime * 0.0011)
                    ).r;

                    foamMask *= mix(0.58, 1.0, breakup);

                    vec3 snowyFoam = vec3(0.84, 0.94, 0.95);
                    base = mix(base, snowyFoam, clamp(foamMask * 0.88, 0.0, 0.82));

                    // Foam catches light too.
                    float foamLight = pow(max(dot(N, H), 0.0), 28.0) * foamMask;
                    base += vec3(0.65, 0.82, 0.84) * foamLight * 0.26;

                    gl_FragColor = vec4(base, 0.90);
                }
            `
        });

        const water = new THREE.Mesh(geometry, material);
        water.name = "ProceduralOcean";
        scene.add(water);

        return {
            mesh: water,

            update(time) {
                material.uniforms.uTime.value = time;
                foamTexture.offset.x = time * 0.00055;
                foamTexture.offset.y = -time * 0.00028;
            }
        };
    }

    return { init };
})();
