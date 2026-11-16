// Visor Three.js reutilizable: modelos .glb (Draco/Meshopt) o piezas procedurales.
// - Iluminación de estudio con RoomEnvironment (sin descargar HDRI) + luz clave con sombra suave.
// - Render bajo demanda: solo dibuja cuando algo cambia (ahorra batería).
// - OrbitControls con límites: sin zoom infinito ni mirar por debajo del piso.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PROCEDURAL } from './pieces.js';

const DRACO_PATH = `https://cdn.jsdelivr.net/npm/three@${window.DM?.three || '0.170.0'}/examples/jsm/libs/draco/gltf/`;

async function loadGLB(url) {
  const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  draco.dispose();
  gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return gltf.scene;
}

export async function mountViewer(el, opts = {}) {
  const o = { autoRotate: el.dataset.autorotate !== undefined, ...opts };
  const W = () => el.clientWidth || 600, H = () => el.clientHeight || 450;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, W() / H(), 1, 5000);

  // Luz clave cálida con sombra suave + relleno frío tenue
  const key = new THREE.DirectionalLight(0xfff1e0, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a1d14, .35));

  // Piso que solo recibe sombra (fondo transparente → se integra con el CSS)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: .42 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Contenido
  let object;
  const src = el.dataset.model;
  const proc = el.dataset.procedural;
  try {
    if (src) object = await loadGLB(src);
    else object = (PROCEDURAL[proc] || PROCEDURAL.aparador)();
  } catch (err) {
    console.error('[visor] no se pudo cargar el modelo', err);
    el.querySelector('.viewer-loading')?.replaceChildren('No se pudo cargar el modelo 3D');
    renderer.dispose();
    return null;
  }
  scene.add(object);

  // Encadre automático según el tamaño del objeto
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z)); // apoyado en y=0, centrado en XZ
  const radius = size.length() / 2;
  floor.scale.setScalar(radius * 8);
  const target = new THREE.Vector3(0, size.y * .45, 0);
  const fit = () => {
    camera.aspect = W() / H();
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitH = radius / Math.sin(fov / 2);
    const fitW = fitH / Math.min(1, camera.aspect);
    return Math.max(fitH, fitW) * 1.02;
  };
  let dist = fit();
  camera.position.set(dist * .62, dist * .42, dist * .66).add(target);
  camera.near = dist / 50; camera.far = dist * 20;
  camera.updateProjectionMatrix();

  key.position.set(radius * 1.6, radius * 3, radius * 1.4);
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -radius * 1.6; sc.right = sc.top = radius * 1.6; sc.near = radius * .5; sc.far = radius * 8;
  sc.updateProjectionMatrix();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  controls.enablePan = false;
  controls.minDistance = dist * .55;
  controls.maxDistance = dist * 1.6;
  controls.minPolarAngle = THREE.MathUtils.degToRad(20);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
  controls.autoRotate = o.autoRotate;
  controls.autoRotateSpeed = .6;
  controls.update();

  // Render bajo demanda
  let visible = true, frame = 0, interacting = false;
  const render = () => renderer.render(scene, camera);
  const loop = () => {
    frame = 0;
    const moving = controls.update();
    render();
    if (visible && (moving || interacting || controls.autoRotate)) frame = requestAnimationFrame(loop);
  };
  const request = () => { if (!frame) frame = requestAnimationFrame(loop); };
  controls.addEventListener('start', () => { interacting = true; controls.autoRotate = false; hideHint(); request(); });
  controls.addEventListener('end', () => { interacting = false; request(); });
  controls.addEventListener('change', request);

  const hint = el.querySelector('.viewer-hint');
  const hideHint = () => { if (hint) hint.style.opacity = '0'; };

  new ResizeObserver(() => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    request();
  }).observe(el);

  // Pausa cuando no está en pantalla
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) request(); }).observe(el);

  el.dataset.ready = '';
  request();
  return { scene, camera, renderer, controls, object, request };
}
