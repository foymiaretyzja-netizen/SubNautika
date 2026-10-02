// SubNautika World Preset: Water
// Higher quality procedural ocean for the title screen.
// Features:
// - Deformed waves with matching analytic normals
// - Subtle Fresnel-style sky reflection
// - Moving sun glints
// - Perlin/Simplex-style foam texture
// - White "snowy" wave crests / whitecaps

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

                // Broad blobs + smaller breakup.
                const large = simplex.noise2D(nx * 4.0, ny * 4.0);
                const medium = simplex.noise2D(nx * 9.0 + 23.0, ny * 9.0 + 23.0) * 0.45;
                const fine = simplex.noise2D(nx * 18.0 + 71.0, ny * 18.0 + 71.0) * 0.16;

                let n = large + medium + fine;

                // Turn the continuous noise into scattered foam islands.
                n = Math.max(0, Math.min(1, (n - 0.02) * 0.95));

                const i = (y * size + x) * 4;
                const value = Math.floor(n * 255);

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
        texture.repeat.set(7, 7);
        texture.needsUpdate = true;

        return texture;
    }

    function init(scene) {
        simplex = new SimplexNoise();

        // More subdivisions make the large waves smoother without going crazy on vertices.
        const geometry = new THREE.PlaneGeometry(2400, 2400, 190, 190);
        geometry.rotateX(-Math.PI / 2);

        const foamTexture = makeFoamTexture();

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: true,
            uniforms: {
                uTime: { value: 0 },
                uFoam: { value: foamTexture },
                uSunDirection: {
                    value: new THREE.Vector3(0.18, 0.82, -0.32).normalize()
                }
            },

            vertexShader: `
                uniform float uTime;

                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                varying vec2 vUv;
                varying float vWaveHeight;
                varying float vSteepness;

                float waveHeight(vec2 p, float t) {
                    float h = 0.0;

                    h += sin(p.x * 0.0045 + t * 0.48) * 6.5;
                    h += cos(p.y * 0.0038 - t * 0.34) * 4.2;
                    h += sin((p.x + p.y) * 0.0125 + t * 0.72) * 2.0;
                    h += sin((p.x - p.y) * 0.024 - t * 0.55) * 0.75;

                    return h;
                }

                vec2 waveDerivative(vec2 p, float t) {
                    float dx = 0.0;
                    float dy = 0.0;

                    dx += cos(p.x * 0.0045 + t * 0.48) * 6.5 * 0.0045;
                    dx += cos((p.x + p.y) * 0.0125 + t * 0.72) * 2.0 * 0.0125;
                    dx += cos((p.x - p.y) * 0.024 - t * 0.55) * 0.75 * 0.024;

                    dy += -sin(p.y * 0.0038 - t * 0.34) * 4.2 * 0.0038;
                    dy += cos((p.x + p.y) * 0.0125 + t * 0.72) * 2.0 * 0.0125;
                    dy += -cos((p.x - p.y) * 0.024 - t * 0.55) * 0.75 * 0.024;

                    return vec2(dx, dy);
                }

                void main() {
                    vUv = uv;

                    vec3 p = position;
                    float h = waveHeight(p.xz, uTime);
                    vec2 d = waveDerivative(p.xz, uTime);

                    p.y += h;

                    // Correct normal for the deformed surface.
                    vec3 objectNormal = normalize(vec3(-d.x, 1.0, -d.y));

                    vec4 world = modelMatrix * vec4(p, 1.0);

                    vWorldPosition = world.xyz;
                    vNormal = normalize(normalMatrix * objectNormal);
                    vWaveHeight = h;
                    vSteepness = length(d);

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
                varying float vWaveHeight;
                varying float vSteepness;

                vec3 skyGradient(vec3 direction) {
                    float h = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);

                    vec3 horizon = vec3(0.52, 0.73, 0.78);
                    vec3 upper = vec3(0.055, 0.19, 0.31);
                    vec3 high = vec3(0.015, 0.08, 0.15);

                    vec3 sky = mix(horizon, upper, smoothstep(0.18, 0.68, h));
                    sky = mix(sky, high, smoothstep(0.68, 1.0, h));

                    // Tiny bright patch where reflected sunlight sits.
                    float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
                    float sunGlow = pow(sunDot, 32.0);

                    sky += vec3(0.75, 0.9, 0.92) * sunGlow * 0.32;

                    return sky;
                }

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(cameraPosition - vWorldPosition);

                    float facing = max(dot(N, V), 0.0);

                    // Stronger at grazing angles, but still restrained.
                    float fresnel = pow(1.0 - facing, 3.2);
                    fresnel = mix(0.045, 0.5, fresnel);

                    vec3 deepWater = vec3(0.002, 0.035, 0.065);
                    vec3 blueWater = vec3(0.008, 0.11, 0.17);

                    // Slight vertical variation keeps the foreground from becoming a flat color.
                    float depthTint = smoothstep(-8.0, 8.0, vWaveHeight);
                    vec3 waterColor = mix(deepWater, blueWater, depthTint * 0.55);

                    // Reflection direction + procedural sky gives us a cheap, soft reflection.
                    vec3 reflected = reflect(-V, N);
                    vec3 reflection = skyGradient(reflected);

                    // Slight cyan haze near the horizon.
                    float horizonTint = smoothstep(0.0, 0.8, fresnel);
                    waterColor = mix(waterColor, vec3(0.025, 0.18, 0.23), horizonTint * 0.28);

                    // Blend in the reflected sky.
                    waterColor = mix(waterColor, reflection, fresnel * 0.48);

                    // A long, soft sun reflection on the water.
                    vec3 H = normalize(V + normalize(uSunDirection));
                    float sunSpec = pow(max(dot(N, H), 0.0), 180.0);
                    float broadSpec = pow(max(dot(N, H), 0.0), 24.0);

                    waterColor += vec3(0.66, 0.88, 0.92) * sunSpec * 0.42;
                    waterColor += vec3(0.20, 0.48, 0.54) * broadSpec * 0.065;

                    // --- FOAM / "SNOW" ON WAVE CRESTS ---
                    vec2 foamUv = vUv * 7.0;
                    foamUv += vec2(uTime * 0.0025, -uTime * 0.0012);

                    float foamNoise = texture2D(uFoam, foamUv).r;

                    // Positive wave height finds the tops of waves.
                    float crest = smoothstep(2.0, 5.5, vWaveHeight);

                    // Steepness helps keep foam concentrated around sharper peaks.
                    float steep = smoothstep(0.055, 0.20, vSteepness);

                    float foamMask = crest * steep;
                    foamMask *= smoothstep(0.28, 0.64, foamNoise);

                    // A second thin breakup layer prevents perfectly round blobs.
                    vec2 detailUv = foamUv * 1.9 + vec2(-uTime * 0.002, uTime * 0.001);
                    float breakup = texture2D(uFoam, detailUv).r;
                    foamMask *= mix(0.55, 1.0, breakup);

                    vec3 foamColor = vec3(0.82, 0.94, 0.94);
                    waterColor = mix(waterColor, foamColor, clamp(foamMask * 0.72, 0.0, 0.72));

                    // Tiny glimmer riding over foam.
                    float foamSpark = pow(max(dot(N, H), 0.0), 55.0) * foamMask;
                    waterColor += vec3(0.85, 0.96, 0.96) * foamSpark * 0.16;

                    gl_FragColor = vec4(waterColor, 0.965);
                }
            `
        });

        const water = new THREE.Mesh(geometry, material);
        water.position.y = 0;
        water.name = "ProceduralOcean";
        scene.add(water);

        return {
            mesh: water,

            update(time) {
                material.uniforms.uTime.value = time;

                // Keep the foam drifting slowly across the surface.
                foamTexture.offset.x = time * 0.0009;
                foamTexture.offset.y = -time * 0.00045;
            }
        };
    }

    return { init };
})();
