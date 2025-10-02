import * as THREE from 'three';
import {AudioHandler} from "./audio-handler.js";
import {getAvgFromArray, lerp, toFloat} from "./utils.js";

const audioPath = 'public/music.mp3'

let isPlaying, didStart = false;

let stats = { rms: 0, peakDb: -Infinity, dominantHz: 0, freqBytes: [], timeBytes: [] };

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 5;

let targetScale = 0
const minScale = 0
const maxScale = 3

function animate(time) {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    cube.scale.set(targetScale, targetScale, targetScale)
    renderer.render( scene, camera );
}

const waveCanvas = document.getElementById('wave');
const freqCanvas = document.getElementById('freq');
const rmsEl = document.getElementById('rms');
const peakEl = document.getElementById('peak');
const domEl = document.getElementById('dom');

const audio = new AudioHandler({waveCanvas, freqCanvas});
document.body.addEventListener('click', () => {
    if (!isPlaying && !didStart) {
        didStart = true;
        audio.loadUrl(audioPath).then(() => {
            isPlaying = true
            audio.play()
        })
    } else {
        isPlaying ? audio.pause() : audio.play();
        isPlaying = !isPlaying;
    }
})

function refreshStats() {
    stats = audio.getStats();
    rmsEl.textContent = stats.rms.toFixed(3);
    peakEl.textContent = isFinite(stats.peakDb) ? stats.peakDb.toFixed(1) + ' dBFS' : '—';
    domEl.textContent = (stats.dominantHz>=20 && stats.dominantHz<=20000) ? Math.round(stats.dominantHz)+' Hz' : '—';
    targetScale = lerp(minScale, maxScale, stats.rms*2);

    if (stats.freqBytes.length > 0) {
        const red = getAvgFromArray(stats.freqBytes.slice(700, 750))
        const green = getAvgFromArray(stats.freqBytes.slice(300, 400))
        const blue = getAvgFromArray(stats.freqBytes.slice(0, 100))
        material.color.setRGB(
            toFloat(red, 0, 255),
            toFloat(green, 0, 255),
            toFloat(blue, 0, 255),
        )
    }
    requestAnimationFrame(refreshStats);
}
refreshStats();
