// SubNautika World Preset entry point.
// Future systems such as terrain, resource spawning, weather, and volumetric
// clouds can be added here without turning index.html into a giant game file.

window.SubNautikaWorld = (() => {
    let scene, camera, renderer, water, clouds;
    let time = 0;

    function createSky(scene) {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 512;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, "#416b91");
        gradient.addColorStop(0.50, "#88aabd");
        gradient.addColorStop(1, "#d2e1e7");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 512);
        scene.background = new THREE.CanvasTexture(canvas);
    }

    function init(container) {
        scene = new THREE.Scene();
        createSky(scene);

        camera = new THREE.PerspectiveCamera(
            55,
            window.innerWidth / window.innerHeight,
            0.1,
            5000
        );
        camera.position.set(0, 45, 160);
        camera.lookAt(0, 15, -100);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        scene.fog = new THREE.Fog(0xd2e1e7, 180, 1150);

        scene.add(new THREE.HemisphereLight(0xc8e8f4, 0x082536, 0.65));

        const sun = new THREE.DirectionalLight(0xffffff, 1.25);
        sun.position.set(120, 220, -160);
        scene.add(sun);

        water = SubNautikaWater.init(scene);
        clouds = SubNautikaClouds.init(scene);

        window.addEventListener("resize", resize);
        requestAnimationFrame(animate);
    }

    function animate() {
        requestAnimationFrame(animate);
        time += 1;

        water.update(time);
        clouds.update(time);

        renderer.render(scene, camera);
    }

    function resize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    return { init };
})();
