// Escena 3D del portal: carga el proyecto, permite cambiar terminaciones y marcar puntos.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildProyecto } from '../three/mueble.js';

export function createScene(el) {
  const W = () => el.clientWidth || 800, H = () => el.clientHeight || 600;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, W() / H(), 1, 10000);
  const key = new THREE.DirectionalLight(0xfff3e6, 1.5);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
  scene.add(key, key.target, new THREE.HemisphereLight(0xe6ecff, 0x2b2118, .45));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
  controls.screenSpacePanning = true;

  let current = null, proyecto = null, center = new THREE.Vector3(), radius = 200;
  const listeners = { render: [] };

  // ----- render bajo demanda
  let frame = 0, interacting = false;
  const loop = () => {
    frame = 0;
    const moving = controls.update();
    renderer.render(scene, camera);
    listeners.render.forEach((fn) => fn());
    if (moving || interacting) frame = requestAnimationFrame(loop);
  };
  const request = () => { if (!frame) frame = requestAnimationFrame(loop); };
  controls.addEventListener('start', () => { interacting = true; request(); });
  controls.addEventListener('end', () => { interacting = false; request(); });
  controls.addEventListener('change', request);
  window.addEventListener('dm:texture', request);
  new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); request(); }).observe(el);

  function frameAll(view = 'tres-cuartos') {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = (radius / Math.sin(fov / 2)) * (camera.aspect < 1 ? 1.35 : .95);
    const dirs = {
      'tres-cuartos': new THREE.Vector3(.55, .45, 1),
      frente: new THREE.Vector3(0, .12, 1),
      planta: new THREE.Vector3(0, 1, .02),
    };
    const d = (dirs[view] || dirs['tres-cuartos']).clone().normalize();
    camera.position.copy(center).addScaledVector(d, dist);
    camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.minDistance = dist * .25; controls.maxDistance = dist * 2.2;
    controls.update();
    request();
  }

  function build(sel) {
    if (current) {
      scene.remove(current.group);
      current.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    current = buildProyecto(proyecto, sel);
    scene.add(current.group);
    if (roomHidden && current.room) current.room.visible = false;
    request();
  }

  let roomHidden = false;
  return {
    setProject(p, sel) {
      proyecto = p;
      build(sel);
      const b = current.bounds;
      b.getCenter(center);
      radius = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 60);
      key.position.set(center.x + radius * 1.2, center.y + radius * 2.6, center.z + radius * 2);
      key.target.position.copy(center);
      const sc = key.shadow.camera;
      sc.left = sc.bottom = -radius * 2; sc.right = sc.top = radius * 2; sc.near = 1; sc.far = radius * 8; sc.updateProjectionMatrix();
      frameAll();
    },
    update(sel) { build(sel); },
    view: frameAll,
    toggleRoom() { roomHidden = !roomHidden; if (current?.room) current.room.visible = !roomHidden; request(); return !roomHidden; },
    // Devuelve el punto 3D (coordenadas del proyecto) bajo el cursor, solo sobre los muebles.
    pick(clientX, clientY) {
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(current.furniture, true)[0];
      if (!hit) return null;
      let mod = hit.object; while (mod && !mod.userData.modulo) mod = mod.parent;
      return { x: +hit.point.x.toFixed(1), y: +hit.point.y.toFixed(1), z: +hit.point.z.toFixed(1), modulo: mod?.userData.modulo || '' };
    },
    // Proyecta un punto 3D a coordenadas de pantalla relativas al visor (para dibujar los pines).
    toScreen(p) {
      const v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
      return { x: (v.x + 1) / 2 * W(), y: (1 - v.y) / 2 * H(), visible: v.z < 1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05 };
    },
    onRender(fn) { listeners.render.push(fn); },
    request,
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', .85); },
    canvas: renderer.domElement,
  };
}
