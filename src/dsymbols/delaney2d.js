import * as delaney from './delaney';
import * as props from './properties';
import * as derived from './derived';
import { covers } from './covers';

import { rationals as opsQ } from '../arithmetic/types';


const loopless = (ds, i, j, D) =>
  ds.orbit2(i, j, D).every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const orbitTypes = ds => {
  const result = [];

  for (let i = 0; i < ds.dim; ++i) {
    for (let j = i + 1; j <= ds.dim; ++j) {
      for (const D of ds.orbitReps2(i, j))
        result.push([ds.v(i, j, D), loopless(ds, i, j, D)]);
    }
  }

  return result;
};


const coneDegrees = ds =>
  orbitTypes(ds).filter(([v, c]) => v > 1 && c).map(([v]) => v);


export const curvature = (ds, vDefault=1) => {
  if (ds.dim != 2)
    throw new Error('must be two-dimensional');

  let sum = 0;

  for (const [v, loopless] of orbitTypes(ds)) {
    const numerator = loopless ? 2 : 1;
    const denominator = v || vDefault;
    sum = opsQ.plus(sum, opsQ.div(numerator, denominator));
  }

  return opsQ.minus(sum, ds.size);
};


const fullyBranched = ds => orbitTypes(ds).every(([v]) => !!v);
const signOfCurvature = ds => opsQ.sgn(curvature(ds));


export const isProtoEuclidean = ds => signOfCurvature(ds) >= 0;
export const isProtoSpherical = ds => signOfCurvature(ds) > 0;
export const isEuclidean = ds => fullyBranched(ds) && signOfCurvature(ds) == 0;
export const isHyperbolic = ds => fullyBranched(ds) && signOfCurvature(ds) < 0;


export const isSpherical = ds => {
  if (!fullyBranched(ds) || signOfCurvature(ds) <= 0)
    return false;
  else {
    const dso = derived.orientedCover(ds);
    const cones = orbitTypes(dso).map(([v]) => v).filter(v => v > 1);
    const n = cones.length;

    return !(n == 1 || (n == 2 && cones[0] != cones[1]));
  }
};


export const toroidalCover = ds => {
  if (!isEuclidean(ds))
    throw new Error('must be euclidean');

  const dso = derived.orientedCover(ds);
  const degree = Math.max(...orbitTypes(dso).map(([v]) => v));

  for (const cov of covers(dso, degree)) {
    if (orbitTypes(cov).every(([v]) => v == 1))
      return cov;
  };
};


const opposite = (ds, i, j, D) => {
  let k = i;
  let E = D;

  while ((ds.s(k, E) || E) != E) {
    E = ds.s(k, E);
    k = (i + j) - k;
  }

  return [k, E];
};


const traceBoundary = ds => {
  const ori = props.partialOrientation(ds);
  const result = [];
  const seen = {};

  for (let i = 0; i <= ds.dim; ++i) {
    for (let D = 1; D <= ds.size; ++D) {
      if (ds.s(i, D) == D && !seen[[i, D]]) {
        const corners = [];
        let j = i;
        let k = (i + ori[D] + 3) % 3;
        let E = D;
        let nu;

        do {
          const v = ds.v(j, k, E);
          if (v > 1)
            corners.push(v);

          seen[[j, E]] = true;
          [nu, E] = opposite(ds, k, j, E);
          k = 3 - (j + k);
          j = nu;
        }
        while (!seen[[j, E]]);

        result.push(corners);
      }
    }
  }

  return result;
};


const eulerCharacteristic = ds => {
  const nrLoops = i => ds.elements().filter(D => ds.s(i, D) == D).length;
  const nrOrbits = (i, j) => ds.orbitReps2(i, j).length;

  const nf = ds.size;
  const ne = (3 * nf + nrLoops(0) + nrLoops(1) + nrLoops(2)) / 2;
  const nv = nrOrbits(0, 1) + nrOrbits(0, 2) + nrOrbits(1, 2);

  return nf - ne + nv;
};


const bestCyclic = corners => {
  let best = corners;

  for (let i = 1; i < corners.length; ++i) {
    const candidate = corners.slice(i).concat(corners.slice(0, i));
    const k = candidate.findIndex((_, k) => candidate[k] != best[k]);
    if (candidate[k] > best[k])
      best = candidate;
  }

  return best;
};


export const orbifoldSymbol = ds => {
  const formatNumbers = ns => ns.map(n => n < 10 ? n : `(${n})`).join('');
  const boundaryComponents = traceBoundary(ds);
  const chi = eulerCharacteristic(ds) + boundaryComponents.length;

  const parts = [formatNumbers(coneDegrees(ds).sort().reverse())];

  for (const corners of boundaryComponents) {
    parts.push('*');
    parts.push(formatNumbers(bestCyclic(corners)));
  }

  if (props.isWeaklyOriented(ds))
    parts.push(new Array((2 - chi) / 2).fill('o').join(''))
  else
    parts.push(new Array(2 - chi).fill('x').join(''));

  const sym = parts.join('');

  if (sym == 'x' || sym == '*' || sym == '')
    return '1' + sym;
  else
    return sym;
};


const splitAlong = (ds, cut) => {
  const inCut = {};
  for (const D of cut)
    inCut[D] = inCut[ds.s(1, D)] = true;

  const tmp = delaney.buildDSymbol({
    dim: ds.dim,
    size: ds.size,
    getS: (i, D) => (i == 1 && inCut[D]) ? D : ds.s(i, D) || 0,
    getV: (i, D) => ds.v(i, i+1, D) || 0
  });

  return [
    derived.subsymbol(tmp, [0, 1, 2], cut[0]),
    derived.subsymbol(tmp, [0, 1, 2], ds.s(1, cut[0]))
  ];
};


const cutsOffDisk = (ds, cut, allow2Cone) => {
  const checkCones = cones =>
    cones.length == 0 || (allow2Cone && cones.length == 1 && cones[0] == 2);

  const [patch, rest] = splitAlong(ds, cut);

  if (patch.size == cut.length)
    return false;

  if (eulerCharacteristic(ds) > 0) {
    if (patch.size == ds.size) {
      const vs = [ds.v(0, 1, cut[0]), ds.v(1, 2, cut[0])];
      if (cut.length > 2)
        vs.push(ds.v(1, 2, cut[1]));

      if (checkCones(vs.filter(v => v > 1)))
        return false;
    }

    if (
      patch.size == ds.size - cut.length &&
        cut.every(D => ds.v(0, 1, D) == 1 && ds.v(1, 2, D) == 1) &&
        checkCones(coneDegrees(rest))
    )
      return false;
  }

  return (
    props.isWeaklyOriented(patch) &&
    eulerCharacteristic(patch) == 1 &&
      checkCones(coneDegrees(patch))
  );
};


export const isPseudoConvex = ds => {
  const dso = derived.orientedCover(ds);
  const step = (i, j, D) => dso.s(i, dso.s(j, D));
  const ori = props.partialOrientation(dso);

  for (const A1 of dso.elements().filter(D => ori[D] > 0)) {
    const seen1 = { [A1]: true };

    for (let A2 = dso.s(0, A1); !seen1[A2]; A2 = step(0, 1, A2)) {
      const seen2 = Object.assign({}, seen1, { [A2]: true });
      seen1[A2] = seen1[dso.s(1, A2)] = true;

      let B2;
      for (B2 = dso.s(2, A2); !seen2[B2]; B2 = step(2, 1, B2)) {
        const seen3 = Object.assign({}, seen2, { [B2]: true });
        seen2[B2] = seen2[dso.s(1, B2)] = true;

        for (let B1 = dso.s(0, B2); !seen3[B1]; B1 = step(0, 1, B1)) {
          seen3[B1] = seen3[dso.s(1, B1)] = true;
          const seen4 = Object.assign({}, seen3);

          let T;
          for (T = dso.s(2, B1); !seen4[T]; T = step(2, 1, T)) {
            seen4[T] = seen4[dso.s(1, T)] = true;
          }
          if (T == A1 && cutsOffDisk(dso, [A1, A2, B2, B1], false))
            return false;
        }
      }
      if (B2 == A1 && cutsOffDisk(dso, [A1, A2], true))
        return false;
    }
  }

  return true;
};


if (require.main == module) {
  const test = ds => {
    const is = fn => fn(ds) ? 'is' : 'is not';

    console.log(`ds = ${ds}`);
    console.log(`  curvature is ${curvature(ds)}`);
    console.log(`  symbol ${is(isProtoEuclidean)} proto-euclidean`);
    console.log(`  symbol ${is(isProtoSpherical)} proto-spherical`);
    console.log(`  symbol ${is(isEuclidean)} euclidean`);
    console.log(`  symbol ${is(isHyperbolic)} hyperbolic`);
    console.log(`  symbol ${is(isSpherical)} spherical`);
    console.log(`  symbol ${is(isPseudoConvex)} pseudo-convex`);
    console.log(`  orbifold symbol = ${orbifoldSymbol(ds)}`);

    if (isEuclidean(ds)) {
      const dst = toroidalCover(ds);
      console.log(`  toroidal cover = ${dst}`);

      const curv = curvature(dst);
      const orbs = orbifoldSymbol(dst);

      if (opsQ.eq(curv, 0) && orbs == 'o')
        console.log('    (curvature and orbifold symbol okay)');
      else
        console.error(`    !!!! curvature ${curv}, orbifold symbol ${orbs}`);
    }
    console.log();
  };

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 0,0>'));
  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,0>'));
  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:1:1,1,1:5,3>'));
  test(delaney.parse('<1.1:1:1,1,1:6,3>'));
  test(delaney.parse('<1.1:1:1,1,1:7,3>'));
  test(delaney.parse('<1.1:1:1,1,1:15,3>'));
  test(delaney.parse('<1.1:2:2,1 2,1 2:2,4 4>'));
  test(delaney.parse('<1.1:2:2,1 2,1 2:2,4 5>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
  test(delaney.parse('<1.1:5:2 4 5,1 2 3 5,3 4 5:8 3,8 3>')); //not pseudo-convex
  test(delaney.parse('<1.1:4:2 4,1 3 4,3 4:4,4>'));
  test(delaney.parse('<1.1:4:1 3 4,2 4,4 2 3:4,4>'));
  test(delaney.parse('<1.1:4:1 3 4,2 4,4 2 3:8,12>'));

  test(delaney.parse(
    `<1.1:
    12:1 3 4 5 7 8 9 11 12,2 4 6 8 10 12,12 2 3 5 6 7 9 10 11:
    8 12 16,8 12 16>`
  ));

  test(delaney.parse(
    '<1.1:12:1 3 5 8 10 11 12,2 3 6 7 10 12 11,1 4 5 9 7 11 10 12:3 3 3,6 3 3>'
  ));

  test(delaney.parse(
    '<1.1:16:2 4 6 8 10 12 14 16,16 3 5 7 9 11 13 15,6 5 8 7 14 13 16 15:8,8>'
  ));

  test(delaney.parse(
    '<1.1:16:2 4 6 8 10 12 14 16,16 3 5 7 9 11 13 15,5 6 8 7 14 13 16 15:8,8>'
  ));
}
