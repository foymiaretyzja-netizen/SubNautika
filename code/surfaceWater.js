// SubNautika Code: surfaceWater.js
// Above-water / surface ocean renderer.
// The full wave mesh is only enabled when the player is close to the
// surface, keeping deep underwater gameplay cheaper.

window.SubNautikaSurfaceWater = (() => {
    const SETTINGS = {
        surfaceY: 42,
        activeDistance: 420,
        size: 3200,
        segments: 160
    };

    let scene = null;
    let camera = null;
    let mesh = null;
    let material = null;
    let lastTime = 0;

    function init(targetScene, targetCamera) {
        scene = targetScene;
        camera = targetCamera;

        const geometry = new THREE.PlaneGeometry(
            SETTINGS.size,
            SETTINGS.size,
            SETTINGS.segments,
            SETTINGS.segments
        );

        geometry.rotateX(-Math.PI / 2);

        material = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: true,
            uniforms: {
                uTime: { value: 0 }
            },

            vertexShader: `
                uniform float uTime;

                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                varying float vHeight;

                float wave(vec2 p, float t) {
                    float h = 0.0;

                    // Long swells.
                    h += sin(p.x * 0.0026 + t * 0.34) * 5.2;
                    h += cos(p.y * 0.0021 - t * 0.27) * 4.0;

                    // Cross-chop.
                    h += sin((p.x + p.y) * 0.0065 + t * 0.52) * 2.1;
                    h += cos((p.x - p.y) * 0.010 + t * 0.46) * 1.5;

                    // Jagged small-scale chop.
                    h += sin(p.x * 0.019 + t * 1.15) * 0.7;
                    h += cos(p.y * 0.026 - t * 1.0) * 0.55;

                    return h;
                }

                void main() {
                    vec3 p = position;
                    float h = wave(p.xz, uTime);

                    float e = 1.25;
                    float hx = wave(p.xz + vec2(e, 0.0), uTime);
                    float hz = wave(p.xz + vec2(0.0, e), uTime);

                    float dx = (hx - h) / e;
                    float dz = (hz - h) / e;

                    p.y += h;

                    vec3 normal = normalize(vec3(-dx, 1.0, -dz));
                    vec4 world = modelMatrix * vec4(p, 1.0);

                    vWorldPosition = world.xyz;
                    vNormal = normalize(normalMatrix * normal);
                    vHeight = h;

                    gl_Position = projectionMatrix * viewMatrix * world;
                }
            `,

            fragmentShader: `
                uniform float uTime;

                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                varying float vHeight;

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(cameraPosition - vWorldPosition);

                    // Surface water should stay blue even when reflecting the sky.
                    vec3 deep = vec3(0.003, 0.055, 0.12);
                    vec3 blue = vec3(0.015, 0.23, 0.38);

                    float heightMix = smoothstep(-6.0, 6.0, vHeight);
                    vec3 water = mix(deep, blue, heightMix);

                    // Cheap sky reflection.
                    vec3 reflected = reflect(-V, N);
                    float skyH = clamp(reflected.y * 0.5 + 0.5, 0.0, 1.0);

                    vec3 skyLow = vec3(0.70, 0.82, 0.89);
                    vec3 skyHigh = vec3(0.16, 0.38, 0.62);
                    vec3 sky = mix(skyLow, skyHigh, smoothstep(0.15, 0.85, skyH));

                    float fresnel = 0.04 + pow(1.0 - max(dot(N, V), 0.0), 3.2) * 0.72;
                    water = mix(water, sky, fresnel * 0.42);

                    // Sun strip.
                    vec3 L = normalize(vec3(-0.5, 0.8, 0.25));
                    vec3 H = normalize(V + L);

                    float broad = pow(max(dot(N, H), 0.0), 24.0);
                    float glint = pow(max(dot(N, H), 0.0), 110.0);

                    water += vec3(0.12, 0.45, 0.58) * broad * 0.16;
                    water += vec3(0.72, 0.92, 0.96) * glint * 0.45;

                    // A small amount of white foam on sharper crests.
                    float foam = smoothstep(3.8, 5.8, vHeight);
                    water = mix(
                        water,
                        vec3(0.82, 0.94, 0.95),
                        foam * 0.33
                    );

                    gl_FragColor = vec4(water, 0.86);
                }
            `
        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = SETTINGS.surfaceY;
        mesh.name = "SurfaceOceanWaves";
        scene.add(mesh);

        return {
            update,
            dispose,
            mesh,
            settings: SETTINGS
        };
    }

    function update(time) {
        if (!mesh || !camera) return;

        material.uniforms.uTime.value = time;

        // Do not keep the expensive surface mesh active when deep underwater
        // or far above it.
        const distance = Math.abs(camera.position.y - SETTINGS.surfaceY);
        mesh.visible = distance <= SETTINGS.activeDistance;
    }

    function dispose() {
        if (!mesh) return;

        scene.remove(mesh);
        mesh.geometry.dispose();
        material.dispose();

        mesh = null;
        material = null;
        scene = null;
        camera = null;
    }

    return {
        init,
        update,
        dispose,
        settings: SETTINGS
    };
})();
