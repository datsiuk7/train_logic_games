import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { World } from '../scene.js';

for (const kind of ['bulbs', 'kits']) {
  test(`pickup effect carries ${kind} toward the character and cleans up`, () => {
    const scene = new THREE.Scene();
    const robot = new THREE.Group();
    robot.position.set(1, 0, 1);
    scene.add(robot);
    const item = new THREE.Group();
    item.position.set(1, .2, 1);
    scene.add(item);
    const world = {
      scene,
      robot,
      bulbs: new Map(),
      kits: new Map()
    };
    world[kind].set('1,1', item);
    const original = item.position.clone();
    const effect = World.prototype.createPickupEffect.call(world, {
      x: 1, z: 1, bulbs: [], kits: []
    });

    assert.ok(effect);
    effect.frame(.65);
    assert.ok(item.position.y > original.y);
    assert.equal(item.userData.pickingUp, true);
    effect.cleanup();
    assert.ok(item.position.equals(original));
    assert.equal(item.userData.pickingUp, undefined);
    assert.equal(scene.children.length, 2);
  });
}

test('the character crouches to collect an item without tilting its body', async () => {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousMatchMedia = globalThis.matchMedia;
  const world = Object.create(World.prototype);
  world.scene = new THREE.Scene();
  world.robot = new THREE.Group();
  world.scene.add(world.robot);
  world.leftLeg = new THREE.Group();
  world.rightLeg = new THREE.Group();
  world.leftArm = new THREE.Group();
  world.arm = new THREE.Group();
  world.hat = new THREE.Group();
  world.hat.position.y = .77;
  world.bulbs = new Map();
  world.kits = new Map();
  world.angle = 0;
  world.speed = 1;
  world.dead = false;
  world.position = () => new THREE.Vector3();
  world.lights = () => {};
  const item = new THREE.Group();
  world.scene.add(item);
  world.bulbs.set('0,0', item);
  let frame = 0;
  const poses = [];
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.requestAnimationFrame = (callback) => {
    poses.push({ tilt: world.robot.rotation.x, height: world.robot.position.y });
    callback(performance.now() + ++frame * 300);
  };
  try {
    assert.equal(await world.animate({ x: 0, z: 0, bulbs: [], kits: [] }, 'take', () => false), true);
    assert.ok(poses.some((pose) => pose.height < 0));
    assert.ok(poses.every((pose) => pose.tilt === 0));
    assert.equal(world.robot.position.y, 0);
    assert.equal(world.leftLeg.rotation.z, 0);
    assert.equal(world.rightLeg.rotation.z, 0);
  } finally {
    if (previousRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousRaf;
    if (previousMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previousMatchMedia;
  }
});
