// SubNautika World Preset: Water
// Procedural ocean with animated waves, subtle Fresnel reflection, and Perlin-style foam.

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
                const n1 = simplex.noise2D(nx * 5.0, ny * 5.0);
                const n2 = simplex.noise2D(nx * 13.0 + 40, ny * 13.0 + 40) * 0.45;
                const n = n1 + n2;
                const foam = Math.max(0, Math.min(1, (n - 0.18) * 1.9));
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
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 3);
        texture.needsUpdate = true;
        return texture;
    }

    function init(scene) {
        simplex = new SimplexNoise();

        const geometry = new THREE.PlaneGeometry(2200, 2200, 160, 160);
        geometry.rotateX(-Math.PI / 2);

        const foamTexture = makeFoamTexture();

        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                uTime: { value: 0 },
                uFoam: { value: foamTexture },
                uSunDirection: { value: new THREE.Vector3(0.15, 0.8, -0.35).normalize() }
            },
            vertexShader: `
                uniform float uTime;
                varying vec3 vWorldPosition;
                varying vec3 vNormal;
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    vec3 p = position;

                    float large = sin(p.x * 0.006 + uTime * 0.65) * 4.0;
                    large += sin(p.z * 0.004 - uTime * 0.48) * 3.0;
                    float medium = sin((p.x + p.z) * 0.018 + uTime * 1.1) * 1.15;

                    p.y += large + medium;

                    vec4 world = modelMatrix * vec4(p, 1.0);
                    vWorldPosition = world.xyz;
                    vNormal = normalize(normalMatrix * normal);

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

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(cameraPosition - vWorldPosition);

                    // Fresnel gives the water a restrained sky reflection near grazing angles.
                    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);

                    vec3 deep = vec3(0.002, 0.045, 0.075);
                    vec3 shallow = vec3(0.015, 0.20, 0.29);
                    vec3 skyReflection = vec3(0.30, 0.58, 0.67);

                    float horizon = smoothstep(-0.2, 0.65, V.y);
                    vec3 reflection = mix(vec3(0.035, 0.16, 0.23), skyReflection, horizon);

                    vec3 color = mix(deep, shallow, fresnel * 0.7);
                    color = mix(color, reflection, fresnel * 0.32);

                    // Moving Perlin-style foam patches, deliberately subtle.
                    vec2 foamUv = vUv * 3.0 + vec2(uTime * 0.004, -uTime * 0.002);
                    float foam = texture2D(uFoam, foamUv).r;
                    foam *= smoothstep(0.35, 0.95, fresnel);
                    color += vec3(0.48, 0.78, 0.78) * foam * 0.16;

                    // A soft sun streak rather than a mirror-like reflection.
                    vec3 H = normalize(V + normalize(uSunDirection));
                    float highlight = pow(max(dot(N, H), 0.0), 90.0);
                    color += vec3(0.7, 0.9, 0.92) * highlight * 0.22;

                    float alpha = 0.92;
                    gl_FragColor = vec4(color, alpha);
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
                material.uniforms.uFoam.value.offset.x = time * 0.003;
                material.uniforms.uFoam.value.offset.y = -time * 0.0015;
            }
        };
    }

    return { init };
})();
