import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function createLanaStage(host, reducedMotion) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    camera.position.set(0, 0.06, 3.25);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(-2, 3, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xb7d9ff, 1.3);
    fillLight.position.set(2, 1, -2);
    scene.add(fillLight);

    const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.prepend(renderer.domElement);

    const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let model;
    try {
        const gltf = await new GLTFLoader().loadAsync('/models/lana.glb');
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const center = bounds.getCenter(new THREE.Vector3());
        const height = bounds.getSize(new THREE.Vector3()).y;
        const scale = 1.48 / height;
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        model = new THREE.Group();
        model.add(gltf.scene);
        scene.add(model);
    } catch (error) {
        observer.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
        throw error;
    }

    let active = false;
    let frameId = 0;
    let reaction = null;
    const baseYaw = -Math.PI / 2;
    host.dataset.reaction = 'idle';

    function reactionPose(now) {
        if (!reaction) return {x: 0, y: 0, z: 0, forward: 0, lift: 0};
        const progress = Math.min((now - reaction.started) / reaction.duration, 1);
        if (progress >= 1) {
            reaction = null;
            host.dataset.reaction = 'idle';
        }
        const swell = Math.sin(Math.PI * progress);

        switch (reaction?.name) {
            case 'playful':
                return {x: -0.035 * swell, y: -0.14 * swell, z: 0.11 * swell, forward: 0.14 * swell, lift: 0};
            case 'sly': {
                const hold = progress < 0.3 ? Math.sin(progress / 0.3 * Math.PI / 2) :
                    progress < 0.68 ? 1 : Math.cos((progress - 0.68) / 0.32 * Math.PI / 2);
                return {x: -0.045 * hold, y: 0.19 * hold, z: -0.08 * hold, forward: 0.1 * hold, lift: 0};
            }
            case 'laugh':
                return {x: 0.065 * swell * Math.sin(progress * Math.PI * 6), y: 0, z: 0.035 * swell,
                    forward: 0.07 * swell, lift: 0.018 * swell * Math.sin(progress * Math.PI * 6)};
            default:
                return {x: 0, y: 0, z: 0, forward: 0, lift: 0};
        }
    }

    function render(now = performance.now()) {
        const seconds = now / 1000;
        const pose = reducedMotion.matches ? {x: 0, y: 0, z: 0, forward: 0, lift: 0} : reactionPose(now);
        model.rotation.set(
            pose.x + (reducedMotion.matches ? 0 : 0.012 * Math.sin(seconds * 1.1)),
            baseYaw + pose.y + (reducedMotion.matches ? 0 : 0.027 * Math.sin(seconds * 0.67)),
            pose.z + (reducedMotion.matches ? 0 : 0.012 * Math.sin(seconds * 0.9))
        );
        model.position.set(0, pose.lift + (reducedMotion.matches ? 0 : 0.012 * Math.sin(seconds * 1.15)), pose.forward);
        renderer.render(scene, camera);
        if (active && !reducedMotion.matches) frameId = requestAnimationFrame(render);
    }

    return {
        setActive(value) {
            if (active === value) return;
            active = value;
            cancelAnimationFrame(frameId);
            if (active) {
                resize();
                render();
            } else {
                reaction = null;
                host.dataset.reaction = 'idle';
            }
        },
        react(name) {
            if (!active || reducedMotion.matches) return;
            const durations = {playful: 1700, sly: 2300, laugh: 1500};
            if (durations[name]) {
                reaction = {name, started: performance.now(), duration: durations[name]};
                host.dataset.reaction = name;
            }
        },
        getAvatarDataUrl() {
            resize();
            render();
            const source = renderer.domElement;
            const avatar = document.createElement('canvas');
            avatar.width = 128;
            avatar.height = 128;
            const cropSize = Math.min(source.width * .46, source.height * .42);
            avatar.getContext('2d').drawImage(
                source,
                (source.width - cropSize) / 2,
                source.height * .08,
                cropSize,
                cropSize,
                0,
                0,
                128,
                128
            );
            return avatar.toDataURL('image/png');
        },
        dispose() {
            active = false;
            cancelAnimationFrame(frameId);
            observer.disconnect();
            renderer.dispose();
        }
    };
}
