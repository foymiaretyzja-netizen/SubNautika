// SubNautika World Preset entry point.
// This file owns the 3D world. Additional systems can be plugged in here:
// water, clouds, resource generation, weather, terrain, etc.

window.SubNautikaWorld = (() => {
    let scene, camera, renderer, water, clouds;
    let time = 0;

    function init(container) {
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            1,
            10000
        );
        camera.position.set(0, 40, 150);
        camera.lookAt(0, 0, -200);

        // Transparent renderer lets the UI page's soft sky gradient show through.
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        renderer.setClearColor(0x000000, 0);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Three.js r128 uses outputEncoding.
        if ("outputEncoding" in renderer) {
            renderer.outputEncoding = THREE.sRGBEncoding;
        }

        container.appendChild(renderer.domElement);

        // The old Exp2 fog gave the horizon much more depth than a hard color fade.
        scene.fog = new THREE.FogExp2(0xb8d0e0, 0.001);

        // Lighting is deliberately closer to the old title screen.
        scene.add(new THREE.AmbientLight(0x404040, 1.2));

        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(-100, 100, 50);
        scene.add(sun);

        water = SubNautikaWater.init(scene);
        clouds = SubNautikaClouds.init(scene);

        window.addEventListener("resize", resize);
        requestAnimationFrame(animate);
    }

    function animate() {
        requestAnimationFrame(animate);

        // Same slow, calm rhythm as the old title screen.
        time += 0.002;

        water.update(time);
        clouds.update(time);

        // Gentle camera drift adds parallax to the wave field.
        camera.position.x = Math.sin(time) * 30;
        camera.lookAt(0, 0, -200);

        renderer.render(scene, camera);
    }

    function resize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    return { init };
})();
