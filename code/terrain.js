// SubNautika Code: terrain.js
// Large, streaming terrain system.
//
// Design:
//   - The terrain is effectively infinite because chunks are generated around
//     the player as they move.
//   - The center is a broad, relatively flat area.
//   - The farther from the world center, the deeper the terrain becomes.
//   - A huge circular drop-off forms around the outer region.
//   - Deterministic noise adds natural variation without destroying the
//     large-scale circular profile.
//
// This file is intentionally independent from the title-screen world preset.
// Systems/game.html can load this file when the actual gameplay world begins.

window.SubNautikaTerrain = (() => {
    const SETTINGS = {
        chunkSize: 256,
        // Vertices per side. 32 gives enough shape while staying browser friendly.
        resolution: 32,

        // Number of chunks kept around the player.
        viewDistance: 5,

        // Broad center of the map.
        flatRadius: 900,

        // Start of the huge descent.
        slopeStart: 900,

        // End of the long descent and beginning of the hard drop.
        dropStart: 6200,
        dropEnd: 8200,

        // Depth values are measured relative to the water surface.
        centerHeight: -18,
        outerDepth: -230,
        abyssDepth: -620,

        // Small natural terrain detail.
        detailAmplitude: 14,
        detailScale: 0.006,

        // How often the streaming manager checks for new chunks.
        updateInterval: 0.18
    };

    const chunks = new Map();

    let scene = null;
    let camera = null;
    let material = null;
    let lastUpdate = 0;
    let lastPlayerChunkX = null;
    let lastPlayerChunkZ = null;

    function chunkKey(x, z) {
        return x + "," + z;
    }

    // Fast deterministic hash. Same world position always gets the same value.
    function hash2(x, z) {
        let h = Math.imul(x, 374761393);
        h = Math.imul(h ^ Math.imul(z, 668265263), 1274126177);
        h ^= h >>> 13;
        h = Math.imul(h, 2246822519);
        h ^= h >>> 16;

        return (h >>> 0) / 4294967295;
    }

    function valueNoise(x, z) {
        const x0 = Math.floor(x);
        const z0 = Math.floor(z);

        const tx = x - x0;
        const tz = z - z0;

        const sx = tx * tx * (3 - 2 * tx);
        const sz = tz * tz * (3 - 2 * tz);

        const a = hash2(x0, z0);
        const b = hash2(x0 + 1, z0);
        const c = hash2(x0, z0 + 1);
        const d = hash2(x0 + 1, z0 + 1);

        const ab = a + (b - a) * sx;
        const cd = c + (d - c) * sx;

        return ab + (cd - ab) * sz;
    }

    function fbm(x, z) {
        let value = 0;
        let amplitude = 0.5;
        let frequency = 1;

        for (let i = 0; i < 4; i++) {
            value += valueNoise(x * frequency, z * frequency) * amplitude;
            frequency *= 2;
            amplitude *= 0.5;
        }

        return value;
    }

    function smooth01(value) {
        value = Math.max(0, Math.min(1, value));
        return value * value * (3 - 2 * value);
    }

    function terrainProfile(distance) {
        // Huge central plateau.
        if (distance <= SETTINGS.flatRadius) {
            return SETTINGS.centerHeight;
        }

        // Long, gentle descent from the central plateau.
        if (distance < SETTINGS.dropStart) {
            const t = smooth01(
                (distance - SETTINGS.slopeStart) /
                (SETTINGS.dropStart - SETTINGS.slopeStart)
            );

            return SETTINGS.centerHeight +
                (SETTINGS.outerDepth - SETTINGS.centerHeight) * t;
        }

        // The outer edge becomes much steeper, creating the enormous drop-off.
        if (distance < SETTINGS.dropEnd) {
            const t = smooth01(
                (distance - SETTINGS.dropStart) /
                (SETTINGS.dropEnd - SETTINGS.dropStart)
            );

            // Smoother start, extremely steep finish.
            const steepT = Math.pow(t, 2.7);

            return SETTINGS.outerDepth +
                (SETTINGS.abyssDepth - SETTINGS.outerDepth) * steepT;
        }

        // Past the drop-off, stay deep while allowing small terrain variation.
        return SETTINGS.abyssDepth;
    }

    function getHeight(worldX, worldZ) {
        const distance = Math.sqrt(worldX * worldX + worldZ * worldZ);

        let height = terrainProfile(distance);

        // Broad rolling terrain, strongest outside the central flat area.
        const outsideFactor = smooth01(
            (distance - SETTINGS.flatRadius) / 1200
        );

        const broadNoise =
            (fbm(worldX * 0.00085 + 100, worldZ * 0.00085 - 50) - 0.5) *
            20;

        const mediumNoise =
            (fbm(worldX * 0.0032 - 30, worldZ * 0.0032 + 80) - 0.5) *
            9;

        const fineNoise =
            (valueNoise(
                worldX * SETTINGS.detailScale,
                worldZ * SETTINGS.detailScale
            ) - 0.5) * SETTINGS.detailAmplitude;

        height += broadNoise * outsideFactor;
        height += mediumNoise * outsideFactor;
        height += fineNoise * outsideFactor;

        // Keep the central area intentionally calm and fairly flat.
        if (distance < SETTINGS.flatRadius * 0.8) {
            const centerFade = smooth01(
                distance / (SETTINGS.flatRadius * 0.8)
            );

            height = SETTINGS.centerHeight +
                (height - SETTINGS.centerHeight) * centerFade * 0.35;
        }

        // Never let noise accidentally build a mountain through the drop-off.
        if (distance > SETTINGS.dropStart) {
            height = Math.min(height, terrainProfile(distance) + 12);
        }

        return height;
    }

    function createChunk(chunkX, chunkZ) {
        const key = chunkKey(chunkX, chunkZ);

        if (chunks.has(key)) {
            return chunks.get(key);
        }

        const geometry = new THREE.PlaneGeometry(
            SETTINGS.chunkSize,
            SETTINGS.chunkSize,
            SETTINGS.resolution,
            SETTINGS.resolution
        );

        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;

        const originX =
            chunkX * SETTINGS.chunkSize +
            SETTINGS.chunkSize * 0.5;

        const originZ =
            chunkZ * SETTINGS.chunkSize +
            SETTINGS.chunkSize * 0.5;

        for (let i = 0; i < positions.count; i++) {
            const localX = positions.getX(i);
            const localZ = positions.getZ(i);

            const worldX = originX + localX;
            const worldZ = originZ + localZ;

            positions.setY(
                i,
                getHeight(worldX, worldZ)
            );
        }

        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(originX, 0, originZ);
        mesh.name = "TerrainChunk_" + chunkX + "_" + chunkZ;

        scene.add(mesh);

        const data = {
            x: chunkX,
            z: chunkZ,
            mesh,
            geometry
        };

        chunks.set(key, data);
        return data;
    }

    function removeChunk(chunkX, chunkZ) {
        const key = chunkKey(chunkX, chunkZ);
        const chunk = chunks.get(key);

        if (!chunk) {
            return;
        }

        scene.remove(chunk.mesh);

        chunk.geometry.dispose();

        chunks.delete(key);
    }

    function updateStreaming(force = false) {
        if (!camera) {
            return;
        }

        const playerChunkX =
            Math.floor(camera.position.x / SETTINGS.chunkSize);

        const playerChunkZ =
            Math.floor(camera.position.z / SETTINGS.chunkSize);

        if (
            !force &&
            playerChunkX === lastPlayerChunkX &&
            playerChunkZ === lastPlayerChunkZ
        ) {
            return;
        }

        lastPlayerChunkX = playerChunkX;
        lastPlayerChunkZ = playerChunkZ;

        const wanted = new Set();

        for (
            let z = playerChunkZ - SETTINGS.viewDistance;
            z <= playerChunkZ + SETTINGS.viewDistance;
            z++
        ) {
            for (
                let x = playerChunkX - SETTINGS.viewDistance;
                x <= playerChunkX + SETTINGS.viewDistance;
                x++
            ) {
                wanted.add(chunkKey(x, z));
                createChunk(x, z);
            }
        }

        for (const chunk of chunks.values()) {
            if (!wanted.has(chunkKey(chunk.x, chunk.z))) {
                removeChunk(chunk.x, chunk.z);
            }
        }
    }

    function init(options = {}) {
        scene = options.scene;
        camera = options.camera;

        if (!scene || !camera) {
            throw new Error(
                "SubNautikaTerrain.init requires { scene, camera }."
            );
        }

        material = options.material || new THREE.MeshStandardMaterial({
            color: 0x173e3d,
            roughness: 0.92,
            metalness: 0.02
        });

        updateStreaming(true);
        lastUpdate = performance.now();

        return {
            getHeight,
            update,
            dispose,
            settings: SETTINGS
        };
    }

    function update(delta = 0) {
        const now = performance.now();

        if (
            now - lastUpdate >=
            SETTINGS.updateInterval * 1000
        ) {
            lastUpdate = now;
            updateStreaming(false);
        }
    }

    function dispose() {
        for (const chunk of chunks.values()) {
            scene.remove(chunk.mesh);
            chunk.geometry.dispose();
        }

        chunks.clear();
        lastPlayerChunkX = null;
        lastPlayerChunkZ = null;
    }

    return {
        init,
        getHeight,
        update,
        dispose,
        settings: SETTINGS
    };
})();
