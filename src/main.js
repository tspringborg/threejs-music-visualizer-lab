import * as THREE from 'three';
import {AudioHandler} from "./audio-handler.js";

const audioPath = 'public/music.mp3'

let isPlaying, didStart = false;

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

function animate() {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render( scene, camera );
}

const audio = new AudioHandler();
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
