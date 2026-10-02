// SubNautika World Preset: 2D Clouds
// Lightweight procedural cloud sheet. This is intentionally a temporary layer
// until volumetric clouds are added.

window.SubNautikaClouds = (() => {
    function makeCloudTexture() {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        const simplex = new SimplexNoise();
        const image = ctx.createImageData(size, size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const nx = x / size;
                const ny = y / size;
                let n = simplex.noise2D(nx * 3.5, ny * 3.5);
                n += simplex.noise2D(nx * 8.0 + 20, ny * 8.0 + 20) * 0.35;
                n = Math.max(0, Math.min(1, (n + 0.15) * 1.25));

                const alpha = Math.pow(n, 2.2) * 175;
                const i = (y * size + x) * 4;
                image.data[i] = 245;
                image.data[i + 1] = 249;
                image.data[i + 2] = 248;
                image.data[i + 3] = Math.floor(alpha);
            }
        }

        ctx.putImageData(image, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1.5, 1.5);
        return texture;
    }

    function init(scene) {
        const texture = makeCloudTexture();
        const geometry = new THREE.PlaneGeometry(3600, 3600);
        geometry.rotateX(Math.PI / 2);

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            opacity: 0.42
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 520, -500);
        mesh.name = "Procedural2DClouds";
        scene.add(mesh);

        return {
            mesh,
            update(time) {
                texture.offset.x = time * 0.0007;
                texture.offset.y = time * 0.00018;
            }
        };
    }

    return { init };
})();
