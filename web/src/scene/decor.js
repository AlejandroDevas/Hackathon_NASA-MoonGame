import { buildLander, disposeObject, footingAt, loadApolloModule } from './lander.js';
import { buildRocks, placeRocks } from './rocks.js';

/**
 * Boulders over the terrain (denser around the landing zone and the robot's start) and the lander on
 * the site point. The simple lander is replaced by NASA's Apollo Lunar Module once that has loaded,
 * if the world is still the one on screen.
 * @param {{
 *   world: {scene: object},
 *   site: {terrain: object},
 *   plan: {x: number, z: number},
 *   rockCache: Map<string, object>,
 *   siteId: string,
 *   isCurrent: () => boolean,
 *   onChange: () => void,
 *   modelUrl: string,
 * }} options `rockCache` keeps the boulder positions per site (meshes are rebuilt for each world);
 *   `isCurrent` says whether `world` is still on screen; `onChange` asks for a new frame and shadow map.
 */
export function addDecor({ world, site, plan, rockCache, siteId, isCurrent, onChange, modelUrl }) {
  if (!rockCache.has(siteId)) {
    rockCache.set(
      siteId,
      placeRocks(site.terrain, {
        patches: [
          { x: 0, z: 0, radiusM: 110, count: 260 },
          { x: plan.x, z: plan.z, radiusM: 80, count: 260 },
        ],
        keepClear: [
          { x: 0, z: 0, radiusM: 7 },
          { x: plan.x, z: plan.z, radiusM: 4 },
        ],
      }),
    );
  }
  world.scene.add(buildRocks(rockCache.get(siteId)));
  const { base, feet } = footingAt(site.terrain, 0, 0);
  const lander = buildLander(feet);
  lander.position.set(0, base, 0);
  world.scene.add(lander);

  const meanFoot = base + feet.reduce((sum, f) => sum + f.dy, 0) / feet.length;
  loadApolloModule(modelUrl).then((model) => {
    if (!model) return;
    if (!isCurrent()) {
      disposeObject(model);
      return;
    }
    world.scene.remove(lander);
    disposeObject(lander);
    model.position.set(0, meanFoot, 0);
    world.scene.add(model);
    onChange();
  });
}
