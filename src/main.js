import * as THREE from 'three';
import {getAvgFromArray, getRMS, lerp, toFloat} from "./utils.js";
import {EffectComposer, OutputPass, RenderPass, UnrealBloomPass} from "three/addons";

const audioPath = 'public/music.mp3'

let isPlaying, didStart = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize( window.innerWidth, window.innerHeight );

const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2( window.innerWidth, window.innerHeight ),
)
bloomPass.threshold = 0.35;
bloomPass.strength = 2;
bloomPass.radius = 0.6;

const outputPass = new OutputPass()

const composer = new EffectComposer(renderer)
composer.addPass(renderScene)
composer.addPass(bloomPass)
composer.addPass(outputPass)

document.body.appendChild( renderer.domElement );

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 5;

let targetScale = 0
const minScale = 0
const maxScale = 3

let targetXRotation = 0
let targetYRotation = 0

function animate(time) {
    if(isPlaying) {
        const rms = getRMS(analyser);
        const freqData = [...analyser.getFrequencyData()];
        const red = toFloat(getAvgFromArray(freqData.slice(500,512)), 0, 255);
        const green = toFloat(getAvgFromArray(freqData.slice(300,500)), 0, 200);
        const blue = toFloat(getAvgFromArray(freqData.slice(0,300)), 0, 100);
        targetScale = lerp(minScale, maxScale, rms * 3);
        material.color.setRGB(red, green * 2, blue * 4 );

        let xRotation = toFloat(getAvgFromArray(freqData.slice(0,100)));
        xRotation = lerp(-0.02, 0.02, xRotation );
        targetXRotation = lerp(targetXRotation, xRotation, 0.5);
        cube.rotation.x += THREE.MathUtils.clamp(targetXRotation, -0.2, 0.2);
        let yRotation = toFloat(getAvgFromArray(freqData.slice(200,400)));
        yRotation = lerp(-0.02, 0.02, yRotation );
        targetYRotation = lerp(targetYRotation, yRotation, 0.5);
        cube.rotation.y += THREE.MathUtils.clamp(targetYRotation, -0.2, 0.2);
    }

    cube.scale.set(targetScale, targetScale, targetScale)
    composer.render(time)
    requestAnimationFrame( animate );
}

const listener = new THREE.AudioListener();

let analyser, sound;
function playAudio() {
    sound = new THREE.Audio( listener );
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load( audioPath, function( buffer ) {
        sound.setBuffer( buffer );
        sound.setVolume(0.5);
        sound.offset = 123;
        sound.play();
        isPlaying = true
    });
    analyser = new THREE.AudioAnalyser( sound, 1024 );
}

document.body.addEventListener('click', () => {
    if (!isPlaying && !didStart) {
        didStart = true;
        playAudio();
    } else {
        isPlaying ? sound.pause() : sound.play();
        isPlaying = !isPlaying;
    }
})

animate()
