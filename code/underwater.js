// SubNautika Code: underwater.js
// Underwater environment controller.
// Handles underwater atmosphere, fog, lighting, and particulate effects.
// This system becomes lighter when the player is above the surface.

window.SubNautikaUnderwater = (() => {
    const SETTINGS = {
        surfaceY: 42,
        transitionDepth: 18
    };

    let scene = null;
    let underwaterLight = null;
    let surfaceGlow = null;
    let particles = null;
    let fogColor = new THREE.Color(0x043747);
    let surfaceColor = new THREE.Color(0x83b5c6);

    function createParticles() {
        const count = 1800;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const n = i * 3;

            positions[n] = (Math.random() - 0.5) * 1000;
            positions[n + 1] = Math.random() * 220 - 70;
            positions[n + 2] = (Math.random() - 0.5) * 1300;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );

        const material = new THREE.PointsMaterial({
            color: 0x9fe8eb,
            size: 0.11,
            transparent: true,
            opacity: 0.28,
            depthWrite: false
        });

        particles = new THREE.Points(geometry, material);
        particles.name = "UnderwaterParticles";
        scene.add(particles);
    }

    function init(targetScene) {
        scene = targetScene;

        scene.background = fogColor.clone();
        scene.fog = new THREE.FogExp2(fogColor, 0.0065);

        scene.add(new THREE.HemisphereLight(
            0x66d8e6,
            0x001016,
            1.05
        ));

        underwaterLight = new THREE.DirectionalLight(
            0x8cecf2,
            1.0
        );
        underwaterLight.position.set(-180, 260, 160);
        scene.add(underwaterLight);

        surfaceGlow = new THREE.PointLight(
            0x46d9ea,
            1.8,
            1100
        );
        surfaceGlow.position.set(0, SETTINGS.surfaceY + 38, 40);
        scene.add(surfaceGlow);

        createParticles();

        return {
            update,
            dispose,
            surfaceY: SETTINGS.surfaceY
        };
    }

    function update(playerY) {
        if (!scene) return;

        const depth = SETTINGS.surfaceY - playerY;
        const underwaterAmount = THREE.MathUtils.clamp(
            depth / SETTINGS.transitionDepth,
            0,
            1
        );

        // Deep underwater = strong blue fog.
        // Near/above the surface = gradually remove underwater atmosphere.
        scene.fog.density = 0.0012 + underwaterAmount * 0.0053;

        scene.background.copy(
            surfaceColor.clone().lerp(fogColor, underwaterAmount)
        );

        underwaterLight.intensity = 0.15 + underwaterAmount * 0.85;
        surfaceGlow.intensity = 0.15 + underwaterAmount * 1.65;

        if (particles) {
            particles.visible = playerY < SETTINGS.surfaceY + 3;
            particles.material.opacity = 0.07 + underwaterAmount * 0.25;
        }
    }

    function dispose() {
        if (!scene) return;

        if (particles) {
            scene.remove(particles);
            particles.geometry.dispose();
            particles.material.dispose();
            particles = null;
        }

        scene = null;
    }

    return {
        init,
        update,
        dispose,
        settings: SETTINGS
    };
})();
