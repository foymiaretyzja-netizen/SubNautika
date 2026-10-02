// SubNautika World Preset: Water
// Rougher open-ocean title-screen water.
// The surface uses warped fractal noise + directional swells so it
// looks like an ocean, not a giant pool or a moving blanket.
// Includes:
// - sharp/choppy wave crests
// - saturated blue/teal water
// - soft sky reflection
// - sun glints
// - procedural snowy whitecaps

window.SubNautikaWater = (() => {
    function init(scene) {
        // Extra subdivisions are important now because the surface contains
        // sharper, smaller wave features.
        const geometry = new THREE.PlaneGeometry(3000, 3000, 210, 210);
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: true,
            uniforms: {
                uTime: { value: 0 },
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

                // Cheap animated 3D value noise for the browser.
                float hash31(vec3 p) {
                    p = fract(p * 0.1031);
                    p += dot(p, p.yzx + 33.33);
                    return fract((p.x + p.y) * p.z);
                }

                float noise3(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);

                    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
                    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
                    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
                    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
                    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
                    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
                    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
                    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

                    float nx00 = mix(n000, n100, f.x);
                    float nx10 = mix(n010, n110, f.x);
                    float nx01 = mix(n001, n101, f.x);
                    float nx11 = mix(n011, n111, f.x);

                    float nxy0 = mix(nx00, nx10, f.y);
                    float nxy1 = mix(nx01, nx11, f.y);

                    return mix(nxy0, nxy1, f.z) * 2.0 - 1.0;
                }

                float fbm(vec3 p) {
                    float value = 0.0;
                    float amp = 0.58;

                    value += noise3(p) * amp;
                    p = p * 2.03 + vec3(17.0, 9.0, 13.0);
                    amp *= 0.5;

                    value += noise3(p) * amp;
                    p = p * 2.01 + vec3(31.0, 14.0, 21.0);
                    amp *= 0.5;

                    value += noise3(p) * amp;
                    p = p * 2.07 + vec3(53.0, 27.0, 8.0);
                    amp *= 0.5;

                    value += noise3(p) * amp;

                    return value;
                }

                float oceanHeight(vec2 p, float t) {
                    // Big open-ocean swells.
                    float swellA = sin(p.x * 0.00255 + t * 0.34);
                    float swellB = sin(p.y * 0.00215 - t * 0.29);
                    float swellC = sin((p.x + p.y) * 0.0048 + t * 0.43);

                    // Domain warp makes the swells bend and wander.
                    vec3 warpSample = vec3(
                        p.x * 0.00135 + 4.0,
                        p.y * 0.00135 - 9.0,
                        t * 0.075
                    );

                    float warpX = fbm(warpSample) * 95.0;
                    float warpY = fbm(warpSample + vec3(19.0, -7.0, 11.0)) * 95.0;

                    vec2 warped = p + vec2(warpX, warpY);

                    float n = fbm(vec3(
                        warped.x * 0.00235,
                        warped.y * 0.00235,
                        t * 0.085
                    ));

                    // Sharpen the noise so we get actual crests instead of
                    // rounded hills.
                    float sharp = sign(n) * pow(abs(n), 0.62);

                    // Medium/choppy structure.
                    float chop = fbm(vec3(
                        p.x * 0.0082,
                        p.y * 0.0082,
                        t * 0.17 + 31.0
                    ));

                    float directional = sin(
                        p.x * 0.016 +
                        p.y * 0.010 +
                        t * 1.05 +
                        n * 2.2
                    );

                    float height = 0.0;

                    height += swellA * 7.5;
                    height += swellB * 6.0;
                    height += swellC * 3.4;

                    height += sharp * 7.8;
                    height += chop * 2.4;
                    height += directional * 0.9;

                    // Slightly exaggerate positive crests.
                    float crestBoost = max(height, 0.0);
                    height += crestBoost * crestBoost * 0.012;

                    return height;
                }

                void main() {
                    vUv = uv;

                    vec3 p = position;
                    float h = oceanHeight(p.xz, uTime);

                    // Numerical surface gradient. This is what makes the
                    // lighting actually follow the rough wave shape.
                    float e = 1.35;
                    float hx = oceanHeight(p.xz + vec2(e, 0.0), uTime);
                    float hz = oceanHeight(p.xz + vec2(0.0, e), uTime);

                    p.y += h;

                    float dx = (hx - h) / e;
                    float dz = (hz - h) / e;

                    vec3 localNormal = normalize(vec3(-dx, 1.0, -dz));
                    vec4 world = modelMatrix * vec4(p, 1.0);

                    vWorldPosition = world.xyz;
                    vNormal = normalize(normalMatrix * localNormal);
                    vHeight = h;
                    vSlope = length(vec2(dx, dz));

                    gl_Position = projectionMatrix * viewMatrix * world;
                }
            `,

            fragmentShader: `
                uniform float uTime;
                uniform vec3 uSunDirection;

                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                varying vec2 vUv;
                varying float vHeight;
                varying float vSlope;

                vec3 skyColor(vec3 dir) {
                    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

                    // Keep the reflection blue/teal so the ocean does not turn gray.
                    vec3 horizon = vec3(0.44, 0.70, 0.78);
                    vec3 middle = vec3(0.14, 0.36, 0.55);
                    vec3 upper = vec3(0.035, 0.14, 0.28);

                    vec3 sky = mix(
                        horizon,
                        middle,
                        smoothstep(0.10, 0.58, h)
                    );

                    return mix(
                        sky,
                        upper,
                        smoothstep(0.58, 1.0, h)
                    );
                }

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(cameraPosition - vWorldPosition);
                    vec3 L = normalize(uSunDirection);

                    float facing = max(dot(N, V), 0.0);

                    // Fresnel gives the horizon a visible reflection without
                    // turning the entire ocean into a mirror.
                    float fresnel = 0.025 + pow(1.0 - facing, 3.0) * 0.78;

                    // More saturated base colors restore the old title-screen
                    // blue instead of washing everything into pale gray-blue.
                    vec3 deepBlue = vec3(0.002, 0.035, 0.085);
                    vec3 richBlue = vec3(0.005, 0.105, 0.20);
                    vec3 crestBlue = vec3(0.01, 0.18, 0.27);

                    float heightMix = smoothstep(-13.0, 13.0, vHeight);
                    vec3 base = mix(deepBlue, richBlue, heightMix);

                    // Brighter angled surfaces help define individual waves.
                    float faceLight = smoothstep(
                        0.32,
                        0.92,
                        dot(N, normalize(vec3(-0.25, 0.9, 0.35))) * 0.5 + 0.5
                    );

                    base = mix(base, crestBlue, faceLight * 0.34);

                    // Reflected sky.
                    vec3 reflectedDirection = reflect(-V, N);
                    vec3 reflectedSky = skyColor(reflectedDirection);

                    base = mix(base, reflectedSky, fresnel * 0.42);

                    // Sun streaks that break across rough wave faces.
                    vec3 H = normalize(V + L);

                    float broad = pow(max(dot(N, H), 0.0), 16.0);
                    float glint = pow(max(dot(N, H), 0.0), 95.0);

                    base += vec3(0.04, 0.28, 0.38) * broad * 0.26;
                    base += vec3(0.58, 0.88, 0.92) * glint * 0.62;

                    // ----------------------------------------------------
                    // Snowy ocean foam / whitecaps.
                    // Sharp wave peaks + steep slopes control the mask.
                    // ----------------------------------------------------

                    vec2 foamUv = vUv * 10.0;

                    float foamNoise = 0.5 + 0.5 * sin(
                        foamUv.x * 2.6 +
                        sin(foamUv.y * 1.8 + uTime * 0.003)
                    );

                    float foamBreak = 0.5 + 0.5 * sin(
                        foamUv.y * 7.0 -
                        foamUv.x * 3.4 -
                        uTime * 0.004
                    );

                    float crest = smoothstep(4.5, 10.0, vHeight);
                    float steep = smoothstep(0.075, 0.26, vSlope);

                    float foam = crest * steep;
                    foam *= smoothstep(0.45, 0.75, foamNoise);
                    foam *= mix(0.64, 1.0, foamBreak);

                    // A little foam can form just below the crest too.
                    float shoulder = smoothstep(7.0, 2.5, abs(vHeight - 5.5));
                    foam += shoulder * steep * 0.09;

                    vec3 snow = vec3(0.88, 0.97, 0.98);

                    base = mix(
                        base,
                        snow,
                        clamp(foam * 0.88, 0.0, 0.82)
                    );

                    // Whitecaps catch the sun and sparkle.
                    float foamGlint = pow(max(dot(N, H), 0.0), 30.0) * foam;
                    base += vec3(0.7, 0.9, 0.92) * foamGlint * 0.28;

                    gl_FragColor = vec4(base, 0.965);
                }
            `
        });

        const water = new THREE.Mesh(geometry, material);
        water.name = "ProceduralRoughOcean";
        scene.add(water);

        return {
            mesh: water,

            update(time) {
                material.uniforms.uTime.value = time;
            }
        };
    }

    return { init };
})();
