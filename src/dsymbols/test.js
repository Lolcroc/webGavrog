// To run: node -r esm test.js

import { orientedCover } from './derived';
import { traversal, partialOrientation, isOriented, isWeaklyOriented, orbits } from './properties';
import { toroidalCover } from './delaney2d'
import { makeCover, skeleton, tilesByTranslations } from './tilings'

import { fundamentalGroup, Boundary } from './fundamental';

import { relatorMatrix } from '../fpgroups/freeWords';
import { rationalLinearAlgebraModular } from '../arithmetic/types';

import { convertTile } from '../ui/makeScene'

if (require.main == module) {
  const delaney = require('./delaney');
  const util = require('util')

  const remainingIndices = (ds, i) => ds.indices().filter(j => j != i);

  const inspect = obj => {
    console.log(util.inspect(obj, {showHidden: false, depth: null}))
    // console.log(util.inspect(obj, false, null, true /* enable colors */));
  }

  const test = ds => {
    // console.log(orbits(ds, [0, 1]));
    // inspect(ds);
    // console.log();
    // console.log('inds', ds.indices());
    // console.log('elems', ds.elements());
    // for (const [Di, i, D] of traversal(ds, ds.indices(), ds.elements())) {
    //   console.log(Di, i, D);
    // }
    // console.log(partialOrientation(ds));
    // inspect(orientedCover(ds));

    console.log('Toroidal Cover');
    const cov = makeCover(ds);
    inspect(cov);
    cov.orbits2(0, 1); // Creates orbits since its lazy
    cov.orbits2(1, 2); // Creates orbits since its lazy
    cov.orbits2(2, 3); // Creates orbits since its lazy
    // for (const [D, i, Di] of traversal(cov, remainingIndices(cov, 0), cov.elements())) {
    //   inspect([D, i, Di])
    // }
    // inspect(orbits(cov, remainingIndices(cov, 0)));
    console.log('Boundary');
    const bnd = new Boundary(cov);
    inspect(bnd)
    console.log('Skeleton');
    const skel = skeleton(cov);
    inspect(skel);

    console.log('Fundamental Group')
    // inspect(orbits(cov, remainingIndices(cov, 0)))
    const { nrGenerators, relators, cones, gen2edge, edge2word } = fundamentalGroup(cov);

    // inspect(bnd.glue(1, 2));
    inspect({ nrGenerators, relators, cones, gen2edge, edge2word });
    // inspect(skeleton(makeCover(ds)));
    const { orbitReps, centers, tiles: rawTiles } = tilesByTranslations(ds, cov, skel);

    console.log('Tiles by translations')
    inspect({ orbitReps, centers, rawTiles });
    inspect(rawTiles.map(tile => convertTile(tile, centers)));
  }

  // test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  // test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:3 2:1 2 3,1 3,2 3:4 8,3>')); // 2d tiling
  // test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));

}